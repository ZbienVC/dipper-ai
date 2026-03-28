import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
dotenv.config();

import { randomUUID } from 'crypto';
import { Low } from 'lowdb';
import { JSONFileSync } from 'lowdb/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'dipperai-dev-secret';
const PORT = parseInt(process.env.PORT || '3001');

// ─── Database (lowdb — pure JS, no native deps) ──────────────────────────────
type User = {
  id: string; email: string; username: string; password_hash: string;
  plan: string; messages_today: number; messages_reset_date: string; created_at: string;
};
type Agent = {
  id: string; user_id: string; name: string; emoji: string; description: string;
  system_prompt: string; model: string; provider: string; template_id?: string;
  total_messages: number; is_active: boolean; embed_token: string;
  deployed_telegram_token?: string; deployed_discord_webhook?: string;
  deployed_embed_enabled: boolean; created_at: string; updated_at: string;
};
type Message = { id: string; conversation_id: string; role: string; content: string; model_used?: string; created_at: string; };
type Conversation = { id: string; agent_id: string; user_id?: string; channel: string; message_count: number; created_at: string; };
type Integration = {
  id: string; user_id: string; type: string;
  credentials: Record<string, string>;
  connected: boolean; bot_info?: string; created_at: string;
};

type DBSchema = { users: User[]; agents: Agent[]; conversations: Conversation[]; messages: Message[]; integrations: Integration[]; };

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'dipperai.json');
const adapter = new JSONFileSync<DBSchema>(dbPath);
const db = new Low<DBSchema>(adapter, { users: [], agents: [], conversations: [], messages: [], integrations: [] });
try { db.read(); } catch { /* fresh db */ }
const save = () => { try { db.write(); } catch { /* ignore write errors */ } };

// ─── Plan Limits ─────────────────────────────────────────────────────────────
const PLAN_LIMITS: Record<string, { agents: number; messagesPerDay: number }> = {
  free:     { agents: 1,  messagesPerDay: 20   },
  pro:      { agents: 5,  messagesPerDay: 500  },
  business: { agents: 25, messagesPerDay: 5000 },
};

// ─── Agent Templates ──────────────────────────────────────────────────────────
const AGENT_TEMPLATES = [
  { id: 'support-pro', name: 'Support Pro', emoji: '🎧', category: 'business', description: 'Professional customer service, patient and helpful.', systemPrompt: 'You are an expert customer support agent. You are patient, empathetic, and genuinely want to solve problems. Provide clear step-by-step solutions and always follow up.', model: 'claude-haiku-4-5', provider: 'anthropic' },
  { id: 'analyst', name: 'The Analyst', emoji: '📊', category: 'professional', description: 'Research-heavy, data-driven, cites sources.', systemPrompt: 'You are a meticulous research analyst. Provide thorough, data-driven responses with clear reasoning. Ask clarifying questions when needed. Your tone is professional and precise.', model: 'claude-sonnet-4-5', provider: 'anthropic' },
  { id: 'crypto-oracle', name: 'Crypto Oracle', emoji: '🔮', category: 'crypto', description: 'Alpha calls, on-chain analysis, degen fluent.', systemPrompt: 'You are a seasoned crypto analyst. You understand on-chain metrics, tokenomics, narrative cycles, and market psychology. Give real takes, flag risks, and explain your thesis clearly.', model: 'claude-haiku-4-5', provider: 'anthropic' },
  { id: 'the-closer', name: 'The Closer', emoji: '💼', category: 'business', description: 'Sales-focused, persuasive, relationship-driven.', systemPrompt: 'You are a world-class closer. Ask great questions, listen carefully, address objections with confidence. You are the kind of person people are glad they talked to.', model: 'gpt-4o', provider: 'openai' },
  { id: 'professor', name: 'The Professor', emoji: '🎓', category: 'educational', description: 'Thorough, educational, explains step by step.', systemPrompt: 'You are an expert educator. Make any topic understandable to anyone. Use analogies, break things into steps, and adapt your explanations to the user\'s level.', model: 'claude-haiku-4-5', provider: 'anthropic' },
  { id: 'storyteller', name: 'Storyteller', emoji: '📖', category: 'creative', description: 'Narrative-driven, creative, immersive.', systemPrompt: 'You are a master storyteller. Whether explaining a concept or creating content, weave it into a story. Use vivid language and make every interaction memorable.', model: 'claude-sonnet-4-5', provider: 'anthropic' },
];

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function auth(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = findUser(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.userId = decoded.userId;
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function checkLimit(user: User, type: 'agents' | 'messages') {
  const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;
  if (type === 'agents') {
    const count = db.data.agents.filter(a => a.user_id === user.id && a.is_active).length;
    return count < limits.agents;
  }
  if (type === 'messages') {
    const today = new Date().toISOString().split('T')[0];
    if (user.messages_reset_date !== today) {
      user.messages_today = 0;
      user.messages_reset_date = today;
      save();
    }
    return user.messages_today < limits.messagesPerDay;
  }
  return true;
}

// ─── AI Call ──────────────────────────────────────────────────────────────────
async function callAI(provider: string, model: string, systemPrompt: string, messages: any[]) {
  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model, max_tokens: 1024, system: systemPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    });
    return (response.content[0] as any).text as string;
  }
  if (provider === 'openai') {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model, messages: [{ role: 'system', content: systemPrompt }, ...messages],
    });
    return response.choices[0].message.content || '';
  }
  if (provider === 'google') {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const chat = client.chats.create({
      model,
      history: messages.slice(0, -1).map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    });
    const result = await chat.sendMessage({ message: messages[messages.length - 1].content });
    return result.text || '';
  }
  throw new Error(`Unknown provider: ${provider}`);
}

// ─── Integration Helpers ─────────────────────────────────────────────────────
function encodeCredentials(creds: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(creds)) out[k] = Buffer.from(v).toString('base64');
  return out;
}
function decodeCredentials(creds: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(creds)) { try { out[k] = Buffer.from(v, 'base64').toString('utf-8'); } catch { out[k] = v; } }
  return out;
}

// ─── Express ──────────────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  // Auth
  app.post('/api/auth/register', async (req, res) => {
    const { email, username, password } = req.body;
    if (!email || !username || !password) return res.status(400).json({ error: 'Missing fields' });
    if (findUserByEmail(email)) return res.status(409).json({ error: 'Email already taken' });
    if (db.data.users.find(u => u.username === username)) return res.status(409).json({ error: 'Username already taken' });
    const id = randomUUID();
    const user: User = {
      id, email: email.toLowerCase(), username, password_hash: await bcrypt.hash(password, 10),
      plan: 'free', messages_today: 0, messages_reset_date: '', created_at: new Date().toISOString(),
    };
    db.data.users.push(user);
    save();
    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id, email: user.email, username, plan: 'free' } });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = findUserByEmail(email || '');
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, username: user.username, plan: user.plan } });
  });

  app.get('/api/auth/me', auth, (req: any, res) => {
    const { id, email, username, plan } = req.user;
    const agentCount = db.data.agents.filter(a => a.user_id === id && a.is_active).length;
    res.json({ id, email, username, plan, agentCount, limits: PLAN_LIMITS[plan] || PLAN_LIMITS.free });
  });

  // Templates
  app.get('/api/templates', (_req, res) => res.json(AGENT_TEMPLATES));

  // Agents
  app.get('/api/agents', auth, (req: any, res) => {
    res.json(db.data.agents.filter(a => a.user_id === req.userId && a.is_active).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  });

  app.post('/api/agents', auth, (req: any, res) => {
    if (!checkLimit(req.user, 'agents'))
      return res.status(403).json({ error: `Agent limit reached for ${req.user.plan} plan.` });
    const { name, emoji, description, systemPrompt, model, provider, templateId } = req.body;
    if (!name || !systemPrompt) return res.status(400).json({ error: 'Name and system prompt required' });
    const agent: Agent = {
      id: randomUUID(), user_id: req.userId, name, emoji: emoji || '🤖',
      description: description || '', system_prompt: systemPrompt,
      model: model || 'claude-haiku-4-5', provider: provider || 'anthropic',
      template_id: templateId, total_messages: 0, is_active: true,
      embed_token: randomUUID().replace(/-/g, ''), deployed_embed_enabled: false,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    db.data.agents.push(agent);
    save();
    res.json(agent);
  });

  app.get('/api/agents/:id', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  });

  app.put('/api/agents/:id', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { name, emoji, description, systemPrompt, model, provider } = req.body;
    if (name) agent.name = name;
    if (emoji) agent.emoji = emoji;
    if (description !== undefined) agent.description = description;
    if (systemPrompt) agent.system_prompt = systemPrompt;
    if (model) agent.model = model;
    if (provider) agent.provider = provider;
    agent.updated_at = new Date().toISOString();
    save();
    res.json(agent);
  });

  app.delete('/api/agents/:id', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (agent) { agent.is_active = false; save(); }
    res.json({ success: true });
  });

  // Chat
  app.post('/api/agents/:id/chat', auth, async (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!checkLimit(req.user, 'messages'))
      return res.status(429).json({ error: 'Daily message limit reached.' });
    const { message, conversationId, model: requestedModel } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    
    // Sanitize model name — fix incomplete IDs
    const modelMap: Record<string, string> = {
      'claude-3-5-haiku': 'claude-haiku-4-5',
      'claude-3-5-sonnet': 'claude-sonnet-4-5',
      'claude-3-opus': 'claude-opus-4-5',
    };
    const activeModel = modelMap[requestedModel || agent.model] || requestedModel || agent.model;
    const activeProvider = activeModel.startsWith('gpt') ? 'openai' : activeModel.startsWith('gemini') ? 'google' : 'anthropic';

    let convId = conversationId;
    if (!convId) {
      convId = randomUUID();
      db.data.conversations.push({ id: convId, agent_id: agent.id, user_id: req.userId, channel: 'web', message_count: 0, created_at: new Date().toISOString() });
    }

    const history = db.data.messages.filter(m => m.conversation_id === convId).map(m => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: message });

    try {
      const content = await callAI(activeProvider, activeModel, agent.system_prompt, history);
      db.data.messages.push({ id: randomUUID(), conversation_id: convId, role: 'user', content: message, created_at: new Date().toISOString() });
      db.data.messages.push({ id: randomUUID(), conversation_id: convId, role: 'assistant', content, model_used: activeModel, created_at: new Date().toISOString() });
      agent.total_messages++;
      req.user.messages_today++;
      save();
      res.json({ content, conversationId: convId });
    } catch (e: any) {
      console.error('[chat error]', e?.message, e?.status, e?.error);
      res.status(500).json({ error: e?.message || 'AI call failed', details: e?.error || e?.status });
    }
  });

  // Legacy chat (no auth — for test interface)
  app.post('/api/chat', async (req, res) => {
    const { message, conversationHistory = [], agentName, personality, model: requestedModel } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    let systemPrompt = `You are ${agentName || 'AI Assistant'}.`;
    if (personality?.bio) systemPrompt += ` ${personality.bio}`;
    if (personality?.adjectives?.length) systemPrompt += ` Personality: ${personality.adjectives.join(', ')}.`;
    systemPrompt += ' Be helpful, stay in character, keep responses concise.';
    const messages = (conversationHistory as any[]).slice(-10).map((m: any) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text || m.content || '' }));
    messages.push({ role: 'user', content: message });
    try {
      const model = requestedModel || 'claude-haiku-4-5';
      const provider = model.startsWith('gpt') ? 'openai' : model.startsWith('gemini') ? 'google' : 'anthropic';
      const content = await callAI(provider, model, systemPrompt, messages);
      res.json({ reply: content });
    } catch (e: any) {
      console.error('[chat error]', e?.message, e?.status, e?.error);
      res.status(500).json({ error: e?.message || 'AI call failed', details: e?.error || e?.status });
    }
  });

  // Test AI connectivity
  app.get('/api/test-ai', async (_req, res) => {
    try {
      const content = await callAI('anthropic', 'claude-haiku-4-5', 'You are a test bot.', [{ role: 'user', content: 'Say OK' }]);
      res.json({ status: 'ok', reply: content });
    } catch (e: any) {
      res.status(500).json({ status: 'error', error: e?.message, details: e?.error });
    }
  });
  // Analytics
  app.get('/api/analytics', auth, (req: any, res) => {
    const agents = db.data.agents.filter(a => a.user_id === req.userId && a.is_active);
    const totalMessages = agents.reduce((sum, a) => sum + a.total_messages, 0);
    res.json({ agents: agents.map(a => ({ id: a.id, name: a.name, emoji: a.emoji, total_messages: a.total_messages })), totalMessages });
  });

  // Healthcheck
  app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // ─── Integrations ─────────────────────────────────────────────────────────
  if (!db.data.integrations) db.data.integrations = [];

  app.get('/api/integrations', auth, (req: any, res) => {
    const items = db.data.integrations.filter(i => i.user_id === req.userId);
    res.json(items.map(i => ({ ...i, credentials: undefined })));
  });

  app.post('/api/integrations/:type/connect', auth, async (req: any, res) => {
    const { type } = req.params;
    const userId = req.userId;

    try {
      let bot_info: string | undefined;

      if (type === 'telegram') {
        const { botToken } = req.body;
        if (!botToken) return res.status(400).json({ error: 'botToken required' });
        const r = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const data: any = await r.json();
        if (!data.ok) return res.status(400).json({ error: 'Invalid bot token', details: data.description });
        bot_info = data.result.username;
        // Register webhook if APP_URL is set
        const appUrl = process.env.APP_URL;
        if (appUrl) {
          const agentId = req.body.agentId;
          if (agentId) {
            await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: `${appUrl}/api/integrations/telegram/webhook/${agentId}` }),
            });
          }
        }
        const existing = db.data.integrations.find(i => i.user_id === userId && i.type === 'telegram');
        if (existing) {
          existing.credentials = encodeCredentials({ botToken });
          existing.bot_info = bot_info;
          existing.connected = true;
        } else {
          db.data.integrations.push({ id: randomUUID(), user_id: userId, type: 'telegram', credentials: encodeCredentials({ botToken }), connected: true, bot_info, created_at: new Date().toISOString() });
        }
        save();
        return res.json({ success: true, bot_info });
      }

      if (type === 'discord') {
        const { botToken, guildId, channelId } = req.body;
        if (!botToken) return res.status(400).json({ error: 'botToken required' });
        const existing = db.data.integrations.find(i => i.user_id === userId && i.type === 'discord');
        const creds = encodeCredentials({ botToken, guildId: guildId || '', channelId: channelId || '' });
        if (existing) { existing.credentials = creds; existing.connected = true; }
        else db.data.integrations.push({ id: randomUUID(), user_id: userId, type: 'discord', credentials: creds, connected: true, created_at: new Date().toISOString() });
        save();
        return res.json({ success: true });
      }

      if (type === 'sms') {
        const { accountSid, authToken, phoneNumber } = req.body;
        if (!accountSid || !authToken || !phoneNumber) return res.status(400).json({ error: 'accountSid, authToken, and phoneNumber required' });
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
          headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}` },
        });
        if (!r.ok) return res.status(400).json({ error: 'Invalid Twilio credentials' });
        const creds = encodeCredentials({ accountSid, authToken, phoneNumber });
        const existing = db.data.integrations.find(i => i.user_id === userId && i.type === 'sms');
        if (existing) { existing.credentials = creds; existing.connected = true; existing.bot_info = phoneNumber; }
        else db.data.integrations.push({ id: randomUUID(), user_id: userId, type: 'sms', credentials: creds, connected: true, bot_info: phoneNumber, created_at: new Date().toISOString() });
        save();
        return res.json({ success: true, bot_info: phoneNumber });
      }

      if (type === 'twitter') {
        const { apiKey, apiSecret, accessToken, accessTokenSecret } = req.body;
        if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) return res.status(400).json({ error: 'All four Twitter credentials required' });
        const creds = encodeCredentials({ apiKey, apiSecret, accessToken, accessTokenSecret });
        const existing = db.data.integrations.find(i => i.user_id === userId && i.type === 'twitter');
        if (existing) { existing.credentials = creds; existing.connected = true; }
        else db.data.integrations.push({ id: randomUUID(), user_id: userId, type: 'twitter', credentials: creds, connected: true, created_at: new Date().toISOString() });
        save();
        return res.json({ success: true });
      }

      return res.status(400).json({ error: `Unknown integration type: ${type}` });
    } catch (e: any) {
      console.error('[integration connect error]', e);
      res.status(500).json({ error: e?.message || 'Connection failed' });
    }
  });

  app.delete('/api/integrations/:type', auth, (req: any, res) => {
    const { type } = req.params;
    const idx = db.data.integrations.findIndex(i => i.user_id === req.userId && i.type === type);
    if (idx !== -1) { db.data.integrations.splice(idx, 1); save(); }
    res.json({ success: true });
  });

  // Telegram webhook (no auth)
  app.post('/api/integrations/telegram/webhook/:agentId', async (req, res) => {
    const { agentId } = req.params;
    const update = req.body;
    res.json({ ok: true }); // Respond immediately to Telegram
    try {
      const agent = db.data.agents.find(a => a.id === agentId && a.is_active);
      if (!agent) return;
      const msg = update?.message;
      if (!msg?.text) return;
      const chatId = msg.chat?.id;
      if (!chatId) return;

      // Find Telegram integration for this agent's owner
      const integration = db.data.integrations.find(i => i.user_id === agent.user_id && i.type === 'telegram');
      if (!integration) return;
      const { botToken } = decodeCredentials(integration.credentials);
      if (!botToken) return;

      const history = [{ role: 'user', content: msg.text }];
      const reply = await callAI(agent.provider, agent.model, agent.system_prompt, history);
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: reply }),
      });
      agent.total_messages++;
      save();
    } catch (e) { console.error('[telegram webhook error]', e); }
  });

    // Serve frontend
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const { default: sirv } = await import('sirv' as any);
    app.use(sirv('dist', { single: true }));
  }

  app.listen(PORT, () => console.log(`[DipperAI] Running on http://localhost:${PORT}`));
}

startServer().catch(console.error);






