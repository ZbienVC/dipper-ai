import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
dotenv.config();

import { randomUUID } from 'crypto';
import { Low } from 'lowdb';
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

// ─── Database ──────────────────────────────────────────────────────────────────
type User = {
  id: string; email: string; username: string; password_hash: string;
  plan: string; messages_today: number; messages_reset_date: string;
  tokens_used_today: number; tokens_reset_date: string;
  created_at: string;
};
type Agent = {
  id: string; user_id: string; name: string; emoji: string; description: string;
  system_prompt: string; model: string; provider: string; template_id?: string;
  total_messages: number; is_active: boolean; embed_token: string;
  deployed_telegram_token?: string; deployed_discord_webhook?: string;
  deployed_embed_enabled: boolean; created_at: string; updated_at: string;
  autonomous_mode?: boolean; response_delay_ms?: number;
};
type Message = { id: string; conversation_id: string; role: string; content: string; model_used?: string; created_at: string; };
type Conversation = { id: string; agent_id: string; user_id?: string; channel: string; message_count: number; created_at: string; };
type Integration = {
  id: string; user_id: string; type: string;
  credentials: Record<string, string>;
  connected: boolean; bot_info?: string; agent_id?: string; created_at: string;
};
type ScheduledMessage = {
  id: string; agent_id: string; user_id: string;
  message: string; cron_expression: string; channel: string;
  recipient_id: string; created_at: string; last_run?: string;
};

type ActivityLog = {
  id: string;
  user_id: string;
  agent_id: string;
  agent_name: string;
  event_type: 'message_received' | 'message_sent' | 'command_executed' | 'integration_connected' | 'integration_disconnected' | 'agent_created' | 'agent_updated' | 'error' | 'automation_triggered' | 'scheduled_sent';
  channel: 'web' | 'telegram' | 'sms' | 'discord' | 'twitter' | 'system';
  summary: string;
  details?: string;
  model_used?: string;
  tokens_used?: number;
  latency_ms?: number;
  status: 'success' | 'error';
  error_message?: string;
  created_at: string;
};

type DBSchema = {
  users: User[]; agents: Agent[]; conversations: Conversation[];
  messages: Message[]; integrations: Integration[];
  scheduled_messages: ScheduledMessage[];
  activity_logs: ActivityLog[];
};

// ─── Plan Definitions ─────────────────────────────────────────────────────────
const PLANS: Record<string, { agents: number; messagesPerDay: number; allowedModels: string[]; maxTokens: number }> = {
  free:     { agents: 1,  messagesPerDay: 20,   allowedModels: ['claude-haiku-4-5'], maxTokens: 512  },
  pro:      { agents: 5,  messagesPerDay: 500,  allowedModels: ['claude-haiku-4-5', 'claude-sonnet-4-5', 'gpt-4o-mini'], maxTokens: 1024 },
  business: { agents: 25, messagesPerDay: 5000, allowedModels: ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-opus-4-5', 'gpt-4o', 'gpt-4o-mini', 'gemini-1.5-pro', 'gemini-1.5-flash'], maxTokens: 2048 },
};

// Backward compat for code that used PLAN_LIMITS
const PLAN_LIMITS = Object.fromEntries(
  Object.entries(PLANS).map(([k, v]) => [k, { agents: v.agents, messagesPerDay: v.messagesPerDay }])
);

function getEffectiveModel(user: User, requestedModel: string): string {
  const plan = PLANS[user.plan] || PLANS.free;
  if (plan.allowedModels.includes(requestedModel)) return requestedModel;
  // Downgrade silently to cheapest model on plan
  const cheapest = plan.allowedModels[0];
  console.log(`[model-gate] User ${user.email} requested ${requestedModel}, using ${cheapest} (plan: ${user.plan})`);
  return cheapest;
}

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

function adminAuth(req: any, res: any, next: any) {
  const adminToken = req.headers['x-admin-token'];
  if (adminToken !== 'admin-token') return res.status(401).json({ error: 'Admin unauthorized' });
  next();
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

function resetTokensIfNeeded(user: User) {
  const today = new Date().toISOString().split('T')[0];
  if (user.tokens_reset_date !== today) {
    user.tokens_used_today = 0;
    user.tokens_reset_date = today;
  }
}

// ─── AI Call ──────────────────────────────────────────────────────────────────
async function callAI(provider: string, model: string, systemPrompt: string, messages: any[], maxTokens = 1024) {
  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model, max_tokens: maxTokens, system: systemPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    });
    const text = (response.content[0] as any).text as string;
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
    return { text, tokensUsed };
  }
  if (provider === 'openai') {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model, max_tokens: maxTokens,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    });
    const text = response.choices[0].message.content || '';
    const tokensUsed = response.usage?.total_tokens || 0;
    return { text, tokensUsed };
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
    return { text: result.text || '', tokensUsed: 0 };
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

// Send Telegram message helper
async function sendTelegramMessage(botToken: string, chatId: string | number, text: string) {
  return fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

async function sendTelegramTyping(botToken: string, chatId: string | number) {
  return fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  });
}

// ─── Express ──────────────────────────────────────────────────────────────────
let db: Low<DBSchema>;
const save = () => { try { db.write(); } catch { /* in-memory mode */ } };
const findUser = (id: string) => db.data.users.find(u => u.id === id);
const findUserByEmail = (email: string) => db.data.users.find(u => u.email === email.toLowerCase());
const findAgent = (id: string, userId?: string) => db.data.agents.find(a => a.id === id && a.is_active && (userId ? a.user_id === userId : true));

function logActivity(params: Omit<ActivityLog, 'id' | 'created_at'>) {
  if (!db?.data?.activity_logs) return;
  const log: ActivityLog = { id: randomUUID(), created_at: new Date().toISOString(), ...params };
  db.data.activity_logs.push(log);
  const userLogs = db.data.activity_logs.filter(l => l.user_id === params.user_id);
  if (userLogs.length > 10000) {
    const oldest = userLogs.sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    db.data.activity_logs = db.data.activity_logs.filter(l => l.id !== oldest.id);
  }
  save();
}

// ─── In-memory cron runner ────────────────────────────────────────────────────
function parseCronMinute(expr: string): boolean {
  try {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return false;
    const now = new Date();
    const [minute, hour, dom, month, dow] = parts;
    const match = (field: string, val: number) => {
      if (field === '*') return true;
      const num = parseInt(field);
      return !isNaN(num) && num === val;
    };
    return match(minute, now.getMinutes())
      && match(hour, now.getHours())
      && match(dom, now.getDate())
      && match(month, now.getMonth() + 1)
      && match(dow, now.getDay());
  } catch { return false; }
}

function startCronRunner() {
  setInterval(async () => {
    if (!db?.data?.scheduled_messages) return;
    const now = new Date().toISOString().slice(0, 16); // minute-precision
    for (const scheduled of db.data.scheduled_messages) {
      if (scheduled.last_run === now) continue; // already ran this minute
      if (!parseCronMinute(scheduled.cron_expression)) continue;
      scheduled.last_run = now;
      save();
      try {
        const agent = db.data.agents.find(a => a.id === scheduled.agent_id && a.is_active);
        if (!agent) continue;
        const user = findUser(scheduled.user_id);
        if (!user) continue;
        const effectiveModel = getEffectiveModel(user, agent.model);
        const provider = effectiveModel.startsWith('gpt') ? 'openai' : effectiveModel.startsWith('gemini') ? 'google' : 'anthropic';
        const { text } = await callAI(provider, effectiveModel, agent.system_prompt, [{ role: 'user', content: scheduled.message }]);
        if (scheduled.channel === 'telegram') {
          const intg = db.data.integrations.find(i => i.user_id === agent.user_id && i.type === 'telegram' && i.connected);
          if (intg) {
            const { botToken } = decodeCredentials(intg.credentials);
            if (botToken) {
              await sendTelegramMessage(botToken, scheduled.recipient_id, text);
            }
          }
        }
      } catch (e) { console.error('[cron error]', e); }
    }
  }, 60_000);
}

async function startServer() {
  // Initialize DB
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'dipperai.json');
  try {
    const { JSONFileSync } = await import('lowdb/node');
    const adapter = new JSONFileSync<DBSchema>(dbPath);
    db = new Low<DBSchema>(adapter, { users: [], agents: [], conversations: [], messages: [], integrations: [], scheduled_messages: [], activity_logs: [] });
    try { db.read(); } catch { /* fresh */ }
    if (!db.data.scheduled_messages) db.data.scheduled_messages = [];
    if (!db.data.activity_logs) db.data.activity_logs = [];
    db.write();
    console.log('[DipperAI] File DB:', dbPath);
  } catch {
    console.warn('[DipperAI] Read-only filesystem, using in-memory DB');
    const { MemorySync } = await import('lowdb');
    db = new Low<DBSchema>(new MemorySync<DBSchema>(), { users: [], agents: [], conversations: [], messages: [], integrations: [], scheduled_messages: [], activity_logs: [] });
  }

  startCronRunner();

  const app = express();
  app.use(cors({ origin: true, credentials: true }));

  // Stripe webhook needs raw body
  app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());

  // ─── Auth ──────────────────────────────────────────────────────────────────
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, username, password } = req.body;
      if (!email || !username || !password) return res.status(400).json({ error: 'Missing fields' });
      if (findUserByEmail(email)) return res.status(409).json({ error: 'Email already taken' });
      if (db.data.users.find(u => u.username === username)) return res.status(409).json({ error: 'Username already taken' });
      const id = randomUUID();
      const today = new Date().toISOString().split('T')[0];
      const user: User = {
        id, email: email.toLowerCase(), username, password_hash: await bcrypt.hash(password, 10),
        plan: 'free', messages_today: 0, messages_reset_date: today,
        tokens_used_today: 0, tokens_reset_date: today,
        created_at: new Date().toISOString(),
      };
      db.data.users.push(user);
      save();
      const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '30d' });
      res.json({ token, user: { id, email: user.email, username, plan: 'free' } });
    } catch (e: any) {
      console.error('[register error]', e?.message);
      res.status(500).json({ error: 'Registration failed: ' + (e?.message || 'Unknown error') });
    }
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

  // ─── Usage ────────────────────────────────────────────────────────────────
  app.get('/api/usage', auth, (req: any, res) => {
    const user: User = req.user;
    resetTokensIfNeeded(user);
    const today = new Date().toISOString().split('T')[0];
    if (user.messages_reset_date !== today) {
      user.messages_today = 0;
      user.messages_reset_date = today;
      save();
    }
    const plan = PLANS[user.plan] || PLANS.free;
    const agentCount = db.data.agents.filter(a => a.user_id === user.id && a.is_active).length;
    res.json({
      plan: user.plan,
      messagesUsedToday: user.messages_today,
      messagesLimitToday: plan.messagesPerDay,
      tokensUsedToday: user.tokens_used_today || 0,
      agentsUsed: agentCount,
      agentsLimit: plan.agents,
      allowedModels: plan.allowedModels,
    });
  });

  // Templates
  app.get('/api/templates', (_req, res) => res.json(AGENT_TEMPLATES));

  // ─── Agents ───────────────────────────────────────────────────────────────
  app.get('/api/agents', auth, (req: any, res) => {
    res.json(db.data.agents.filter(a => a.user_id === req.userId && a.is_active).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  });

  app.post('/api/agents', auth, (req: any, res) => {
    if (!checkLimit(req.user, 'agents'))
      return res.status(403).json({ error: `Agent limit reached for ${req.user.plan} plan.` });
    const { name, emoji, description, systemPrompt, model, provider, templateId, autonomous_mode, response_delay_ms } = req.body;
    if (!name || !systemPrompt) return res.status(400).json({ error: 'Name and system prompt required' });
    const agent: Agent = {
      id: randomUUID(), user_id: req.userId, name, emoji: emoji || '🤖',
      description: description || '', system_prompt: systemPrompt,
      model: model || 'claude-haiku-4-5', provider: provider || 'anthropic',
      template_id: templateId, total_messages: 0, is_active: true,
      embed_token: randomUUID().replace(/-/g, ''), deployed_embed_enabled: false,
      autonomous_mode: autonomous_mode || false,
      response_delay_ms: response_delay_ms || 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    db.data.agents.push(agent);
    save();
    logActivity({ user_id: req.userId, agent_id: agent.id, agent_name: agent.name, event_type: 'agent_created', channel: 'system', summary: 'Agent created: ' + name, status: 'success' });
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
    const { name, emoji, description, systemPrompt, model, provider, autonomous_mode, response_delay_ms } = req.body;
    if (name) agent.name = name;
    if (emoji) agent.emoji = emoji;
    if (description !== undefined) agent.description = description;
    if (systemPrompt) agent.system_prompt = systemPrompt;
    if (model) agent.model = model;
    if (provider) agent.provider = provider;
    if (autonomous_mode !== undefined) agent.autonomous_mode = autonomous_mode;
    if (response_delay_ms !== undefined) agent.response_delay_ms = response_delay_ms;
    agent.updated_at = new Date().toISOString();
    save();
    res.json(agent);
  });

  app.delete('/api/agents/:id', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (agent) {
      agent.is_active = false;
      db.data.integrations.forEach(i => { if (i.agent_id === agent.id) i.agent_id = undefined; });
      save();
    }
    res.json({ success: true });
  });

  // ─── Chat ─────────────────────────────────────────────────────────────────
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
    const rawModel = modelMap[requestedModel || agent.model] || requestedModel || agent.model;

    // Plan-based model gating — silently downgrade
    const effectiveModel = getEffectiveModel(req.user, rawModel);
    const activeProvider = effectiveModel.startsWith('gpt') ? 'openai' : effectiveModel.startsWith('gemini') ? 'google' : 'anthropic';

    let convId = conversationId;
    if (!convId) {
      convId = randomUUID();
      db.data.conversations.push({ id: convId, agent_id: agent.id, user_id: req.userId, channel: 'web', message_count: 0, created_at: new Date().toISOString() });
    }

    const history = db.data.messages.filter(m => m.conversation_id === convId).map(m => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: message });

    const plan = PLANS[req.user.plan] || PLANS.free;
    const startTime = Date.now();
    try {
      const { text: content, tokensUsed } = await callAI(activeProvider, effectiveModel, agent.system_prompt, history, plan.maxTokens);
      const latency_ms = Date.now() - startTime;
      db.data.messages.push({ id: randomUUID(), conversation_id: convId, role: 'user', content: message, created_at: new Date().toISOString() });
      db.data.messages.push({ id: randomUUID(), conversation_id: convId, role: 'assistant', content, model_used: effectiveModel, created_at: new Date().toISOString() });
      agent.total_messages++;
      req.user.messages_today++;
      resetTokensIfNeeded(req.user);
      req.user.tokens_used_today = (req.user.tokens_used_today || 0) + tokensUsed;
      console.log(`[chat] model=${effectiveModel} tokens=${tokensUsed}`);
      save();
      logActivity({ user_id: req.userId, agent_id: agent.id, agent_name: agent.name, event_type: 'message_sent', channel: 'web', summary: 'Replied to web chat message', details: content.slice(0, 200), model_used: effectiveModel, tokens_used: tokensUsed, latency_ms, status: 'success' });
      res.json({ content, conversationId: convId, model_used: effectiveModel });
    } catch (e: any) {
      console.error('[chat error]', e?.message, e?.status, e?.error);
      logActivity({ user_id: req.userId, agent_id: agent.id, agent_name: agent.name, event_type: 'error', channel: 'web', summary: 'Error during web chat', status: 'error', error_message: e?.message });
      res.status(500).json({ error: e?.message || 'AI call failed', details: e?.error || e?.status });
    }
  });

  // ─── Schedule message ──────────────────────────────────────────────────────
  app.post('/api/agents/:id/schedule', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { message, cronExpression, channel, recipientId } = req.body;
    if (!message || !cronExpression || !channel || !recipientId)
      return res.status(400).json({ error: 'message, cronExpression, channel, recipientId required' });
    const scheduled: ScheduledMessage = {
      id: randomUUID(), agent_id: agent.id, user_id: req.userId,
      message, cron_expression: cronExpression, channel, recipient_id: recipientId,
      created_at: new Date().toISOString(),
    };
    db.data.scheduled_messages.push(scheduled);
    save();
    res.json(scheduled);
  });

  app.get('/api/agents/:id/schedules', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(db.data.scheduled_messages.filter(s => s.agent_id === agent.id));
  });

  app.delete('/api/agents/:id/schedules/:scheduleId', auth, (req: any, res) => {
    const idx = db.data.scheduled_messages.findIndex(s => s.id === req.params.scheduleId && s.user_id === req.userId);
    if (idx !== -1) { db.data.scheduled_messages.splice(idx, 1); save(); }
    res.json({ success: true });
  });

  // Legacy chat
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
      const { text: content } = await callAI(provider, model, systemPrompt, messages);
      res.json({ reply: content });
    } catch (e: any) {
      console.error('[chat error]', e?.message, e?.status, e?.error);
      res.status(500).json({ error: e?.message || 'AI call failed', details: e?.error || e?.status });
    }
  });

  app.get('/api/test-ai', async (_req, res) => {
    try {
      const { text: content } = await callAI('anthropic', 'claude-haiku-4-5', 'You are a test bot.', [{ role: 'user', content: 'Say OK' }]);
      res.json({ status: 'ok', reply: content });
    } catch (e: any) {
      res.status(500).json({ status: 'error', error: e?.message, details: e?.error });
    }
  });

  app.get('/api/analytics', auth, (req: any, res) => {
    const agents = db.data.agents.filter(a => a.user_id === req.userId && a.is_active);
    const totalMessages = agents.reduce((sum, a) => sum + a.total_messages, 0);
    res.json({ agents: agents.map(a => ({ id: a.id, name: a.name, emoji: a.emoji, total_messages: a.total_messages })), totalMessages });
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // ─── Billing ──────────────────────────────────────────────────────────────
  app.post('/api/billing/checkout', auth, async (req: any, res) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.json({ error: 'Billing not configured', demo: true });

    const { plan } = req.body;
    if (!plan || !['pro', 'business'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });

    const priceId = plan === 'pro' ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_BUSINESS_PRICE_ID;
    if (!priceId) return res.json({ error: 'Billing not configured', demo: true });

    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' as any });
      const appUrl = process.env.APP_URL || 'http://localhost:3001';
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: req.user.email,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/dashboard/billing?success=true`,
        cancel_url: `${appUrl}/dashboard/billing`,
        metadata: { userId: req.userId, plan },
      });
      res.json({ url: session.url });
    } catch (e: any) {
      console.error('[stripe checkout error]', e?.message);
      res.status(500).json({ error: e?.message || 'Stripe error' });
    }
  });

  app.post('/api/billing/webhook', async (req, res) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeKey || !webhookSecret) return res.json({ received: true });

    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' as any });
      const sig = req.headers['stripe-signature'] as string;
      const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        const customerEmail = session.customer_email || session.customer_details?.email;
        const plan = session.metadata?.plan;
        if (customerEmail && plan) {
          const user = findUserByEmail(customerEmail);
          if (user) { user.plan = plan; save(); }
        }
      }

      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;
        // Get customer email from Stripe
        try {
          const customer = await stripe.customers.retrieve(customerId) as any;
          if (customer.email) {
            const user = findUserByEmail(customer.email);
            if (user) { user.plan = 'free'; save(); }
          }
        } catch {}
      }

      res.json({ received: true });
    } catch (e: any) {
      console.error('[stripe webhook error]', e?.message);
      res.status(400).json({ error: e?.message });
    }
  });

  app.get('/api/billing/portal', auth, async (req: any, res) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.json({ error: 'Billing not configured', demo: true });

    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' as any });

      // Find or create customer
      const customers = await stripe.customers.list({ email: req.user.email, limit: 1 });
      let customerId = customers.data[0]?.id;
      if (!customerId) {
        const customer = await stripe.customers.create({ email: req.user.email });
        customerId = customer.id;
      }

      const appUrl = process.env.APP_URL || 'http://localhost:3001';
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/dashboard/billing`,
      });
      res.json({ url: portalSession.url });
    } catch (e: any) {
      console.error('[stripe portal error]', e?.message);
      res.status(500).json({ error: e?.message || 'Stripe error' });
    }
  });

  // ─── Admin ────────────────────────────────────────────────────────────────
  app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    if (password !== adminPass) return res.status(401).json({ error: 'Invalid admin password' });
    res.json({ token: 'admin-token' });
  });

  app.get('/api/admin/stats', adminAuth, (req, res) => {
    const users = db.data.users;
    const agents = db.data.agents.filter(a => a.is_active);
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().slice(0, 7);

    const messagesToday = users.reduce((sum, u) => sum + (u.messages_reset_date === today ? u.messages_today : 0), 0);
    const messagesThisMonth = db.data.messages.filter(m => m.created_at.startsWith(thisMonth) && m.role === 'user').length;

    const planBreakdown = { free: 0, pro: 0, business: 0 };
    users.forEach(u => { const p = u.plan as keyof typeof planBreakdown; if (p in planBreakdown) planBreakdown[p]++; });

    const recentUsers = [...users].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10).map(u => ({
      id: u.id, email: u.email, plan: u.plan,
      agentCount: agents.filter(a => a.user_id === u.id).length,
      messages_today: u.messages_reset_date === today ? u.messages_today : 0,
      created_at: u.created_at,
    }));

    const apiKeyStatus = {
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
    };

    res.json({ totalUsers: users.length, totalAgents: agents.length, messagesToday, messagesThisMonth, planBreakdown, recentUsers, apiKeyStatus });
  });

  app.get('/api/admin/users', adminAuth, (_req, res) => {
    const today = new Date().toISOString().split('T')[0];
    res.json(db.data.users.map(u => ({
      id: u.id, email: u.email, username: u.username, plan: u.plan,
      agentCount: db.data.agents.filter(a => a.user_id === u.id && a.is_active).length,
      messages_today: u.messages_reset_date === today ? u.messages_today : 0,
      created_at: u.created_at,
    })));
  });

  app.patch('/api/admin/users/:id', adminAuth, (req, res) => {
    const user = findUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { plan } = req.body;
    if (!plan || !['free', 'pro', 'business'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
    user.plan = plan;
    save();
    res.json({ success: true, plan });
  });

  // ─── Integrations ─────────────────────────────────────────────────────────
  if (!db.data.integrations) db.data.integrations = [];

  app.get('/api/integrations', auth, (req: any, res) => {
    const items = db.data.integrations.filter(i => i.user_id === req.userId);
    res.json(items.map(i => ({ id: i.id, type: i.type, connected: i.connected, bot_info: i.bot_info, agent_id: i.agent_id, created_at: i.created_at })));
  });

  app.put('/api/integrations/:type/assign', auth, (req: any, res) => {
    const { type } = req.params;
    const { agentId } = req.body;
    const intg = db.data.integrations.find(i => i.user_id === req.userId && i.type === type);
    if (!intg) return res.status(404).json({ error: 'Integration not found' });
    if (agentId) {
      const agent = findAgent(agentId, req.userId);
      if (!agent) return res.status(404).json({ error: 'Agent not found' });
    }
    intg.agent_id = agentId || undefined;
    save();
    res.json({ success: true, agent_id: intg.agent_id });
  });

  app.get('/api/integrations/:type/status', auth, async (req: any, res) => {
    const { type } = req.params;
    const intg = db.data.integrations.find(i => i.user_id === req.userId && i.type === type);
    if (!intg || !intg.connected) return res.json({ connected: false });
    const creds = decodeCredentials(intg.credentials);
    let extra: any = {};
    try {
      if (type === 'telegram' && creds.botToken) {
        const r = await fetch(`https://api.telegram.org/bot${creds.botToken}/getMe`);
        const d: any = await r.json();
        if (d.ok) extra = { bot_username: d.result.username, bot_name: d.result.first_name };
      }
    } catch { /* ignore */ }
    res.json({ connected: true, bot_info: intg.bot_info, agent_id: intg.agent_id, ...extra });
  });

  app.post('/api/integrations/:type/connect', auth, async (req: any, res) => {
    const { type } = req.params;
    const userId = req.userId;

    try {
      let bot_info: string | undefined;

      if (type === 'telegram') {
        const { botToken, agentId } = req.body;
        if (!botToken) return res.status(400).json({ error: 'botToken required' });
        const r = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const data: any = await r.json();
        if (!data.ok) return res.status(400).json({ error: 'Invalid bot token', details: data.description });
        bot_info = data.result.username;
        const appUrl = process.env.APP_URL;
        if (appUrl && agentId) {
          const agent = findAgent(agentId, userId);
          if (agent) {
            await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: `${appUrl}/api/integrations/telegram/webhook/${agentId}` }),
            }).catch(() => {});
          }
        }
        const existing = db.data.integrations.find(i => i.user_id === userId && i.type === 'telegram');
        if (existing) {
          existing.credentials = encodeCredentials({ botToken });
          existing.bot_info = bot_info;
          existing.connected = true;
          if (agentId) existing.agent_id = agentId;
        } else {
          db.data.integrations.push({ id: randomUUID(), user_id: userId, type: 'telegram', credentials: encodeCredentials({ botToken }), connected: true, bot_info, agent_id: agentId || undefined, created_at: new Date().toISOString() });
        }
        save();
        logActivity({ user_id: userId, agent_id: req.body.agentId || '', agent_name: '', event_type: 'integration_connected', channel: 'telegram', summary: 'Connected Telegram integration', status: 'success' });
        return res.json({ success: true, bot_info });
      }

      if (type === 'discord') {
        const { botToken, guildId, channelId, agentId } = req.body;
        if (!botToken) return res.status(400).json({ error: 'botToken required' });
        const dr = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bot ${botToken}` } });
        if (!dr.ok) return res.status(400).json({ error: 'Invalid Discord bot token.' });
        const discordBot: any = await dr.json();
        bot_info = discordBot.username;
        const existing = db.data.integrations.find(i => i.user_id === userId && i.type === 'discord');
        const creds = encodeCredentials({ botToken, guildId: guildId || '', channelId: channelId || '' });
        if (existing) { existing.credentials = creds; existing.connected = true; existing.bot_info = bot_info; if (agentId) existing.agent_id = agentId; }
        else db.data.integrations.push({ id: randomUUID(), user_id: userId, type: 'discord', credentials: creds, connected: true, bot_info, agent_id: agentId || undefined, created_at: new Date().toISOString() });
        save();
        logActivity({ user_id: userId, agent_id: agentId || '', agent_name: '', event_type: 'integration_connected', channel: 'discord', summary: 'Connected Discord integration', status: 'success' });
        return res.json({ success: true, bot_info });
      }

      if (type === 'sms') {
        const { accountSid, authToken, phoneNumber, agentId } = req.body;
        if (!accountSid || !authToken || !phoneNumber) return res.status(400).json({ error: 'accountSid, authToken, and phoneNumber required' });
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
          headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}` },
        });
        if (!r.ok) return res.status(400).json({ error: 'Invalid Twilio credentials.' });
        const creds = encodeCredentials({ accountSid, authToken, phoneNumber });
        const existing = db.data.integrations.find(i => i.user_id === userId && i.type === 'sms');
        if (existing) { existing.credentials = creds; existing.connected = true; existing.bot_info = phoneNumber; if (agentId) existing.agent_id = agentId; }
        else db.data.integrations.push({ id: randomUUID(), user_id: userId, type: 'sms', credentials: creds, connected: true, bot_info: phoneNumber, agent_id: agentId || undefined, created_at: new Date().toISOString() });
        save();
        logActivity({ user_id: userId, agent_id: agentId || '', agent_name: '', event_type: 'integration_connected', channel: 'sms', summary: 'Connected SMS integration', status: 'success' });
        return res.json({ success: true, bot_info: phoneNumber });
      }

      if (type === 'twitter') {
        const { apiKey, apiSecret, accessToken, accessTokenSecret, agentId } = req.body;
        if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) return res.status(400).json({ error: 'All four Twitter credentials required' });
        const creds = encodeCredentials({ apiKey, apiSecret, accessToken, accessTokenSecret });
        const existing = db.data.integrations.find(i => i.user_id === userId && i.type === 'twitter');
        if (existing) { existing.credentials = creds; existing.connected = true; if (agentId) existing.agent_id = agentId; }
        else db.data.integrations.push({ id: randomUUID(), user_id: userId, type: 'twitter', credentials: creds, connected: true, agent_id: agentId || undefined, created_at: new Date().toISOString() });
        save();
        logActivity({ user_id: userId, agent_id: agentId || '', agent_name: '', event_type: 'integration_connected', channel: 'twitter', summary: 'Connected Twitter integration', status: 'success' });
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

  // ─── Telegram webhook (improved) ──────────────────────────────────────────
  app.post('/api/integrations/telegram/webhook/:agentId', async (req, res) => {
    const { agentId } = req.params;
    res.json({ ok: true }); // Respond immediately to Telegram
    try {
      const update = req.body;
      const agent = db.data.agents.find(a => a.id === agentId && a.is_active);
      if (!agent) return;

      const msg = update?.message || update?.channel_post;
      if (!msg?.text) return;
      if (msg.from?.is_bot) return;

      const chatId = msg.chat?.id;
      if (!chatId) return;

      const integration = db.data.integrations.find(i => i.user_id === agent.user_id && i.type === 'telegram' && i.connected);
      if (!integration) return;
      const { botToken } = decodeCredentials(integration.credentials);
      if (!botToken) return;

      const text = msg.text.trim();

      // Handle commands
      if (text === '/start') {
        const welcome = `👋 Hi! I'm ${agent.name}. How can I help you today?\n\nType /help to see available commands.`;
        await sendTelegramMessage(botToken, chatId, welcome);
        return;
      }

      if (text === '/help') {
        const helpText = `🤖 *${agent.name}* Help\n\n/start — Start the conversation\n/help — Show this help\n\nJust send me a message and I'll respond!`;
        await sendTelegramMessage(botToken, chatId, helpText);
        return;
      }

      // Send typing indicator
      await sendTelegramTyping(botToken, chatId);

      // Get user for plan-based model selection
      const agentOwner = findUser(agent.user_id);
      const effectiveModel = agentOwner ? getEffectiveModel(agentOwner, agent.model) : agent.model;
      const provider = effectiveModel.startsWith('gpt') ? 'openai' : effectiveModel.startsWith('gemini') ? 'google' : 'anthropic';

      const history = [{ role: 'user', content: text }];
      const { text: reply } = await callAI(provider, effectiveModel, agent.system_prompt, history);

      // Handle delay if configured
      if (agent.response_delay_ms && agent.response_delay_ms > 0) {
        await new Promise(r => setTimeout(r, Math.min(agent.response_delay_ms!, 5000)));
      }

      await sendTelegramMessage(botToken, chatId, reply);
      agent.total_messages++;
      save();
      logActivity({ user_id: agent.user_id, agent_id: agent.id, agent_name: agent.name, event_type: 'message_sent', channel: 'telegram', summary: 'Replied to Telegram message', details: reply.slice(0, 200), model_used: effectiveModel, status: 'success' });
    } catch (e) { console.error('[telegram webhook error]', e); }
  });

  // ─── Twilio SMS webhook ────────────────────────────────────────────────────
  app.post('/api/webhooks/sms/inbound', express.urlencoded({ extended: false }), async (req, res) => {
    res.type('text/xml').send('<Response></Response>');
    try {
      const { From, To, Body } = req.body;
      if (!Body || !To) return;

      const integrations = db.data.integrations.filter(i => i.type === 'sms' && i.connected);
      let matchedIntg: Integration | undefined;
      for (const intg of integrations) {
        const creds = decodeCredentials(intg.credentials);
        if (creds.phoneNumber === To) { matchedIntg = intg; break; }
      }
      if (!matchedIntg) return;

      const agentId = matchedIntg.agent_id;
      if (!agentId) return;
      const agent = db.data.agents.find(a => a.id === agentId && a.is_active);
      if (!agent) return;

      const history = [{ role: 'user', content: Body }];
      const { text: reply } = await callAI(agent.provider, agent.model, agent.system_prompt, history);

      const { accountSid, authToken, phoneNumber } = decodeCredentials(matchedIntg.credentials);
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: phoneNumber, To: From, Body: reply }).toString(),
      });
      agent.total_messages++;
      save();
      logActivity({ user_id: agent.user_id, agent_id: agent.id, agent_name: agent.name, event_type: 'message_sent', channel: 'sms', summary: 'Replied to SMS message', details: reply.slice(0, 200), model_used: agent.model, status: 'success' });
    } catch (e) { console.error('[sms inbound error]', e); }
  });

  // ─── Activity ─────────────────────────────────────────────────────────────
  app.get('/api/activity', auth, (req: any, res) => {
    const { agentId, channel, status, limit = '50', offset = '0' } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit) || 50, 200);
    const off = parseInt(offset) || 0;
    let logs = db.data.activity_logs.filter(l => l.user_id === req.userId);
    if (agentId) logs = logs.filter(l => l.agent_id === agentId);
    if (channel) logs = logs.filter(l => l.channel === channel);
    if (status) logs = logs.filter(l => l.status === status);
    logs = [...logs].sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json({ logs: logs.slice(off, off + lim), total: logs.length });
  });

  app.get('/api/activity/stats', auth, (req: any, res) => {
    const allLogs = db.data.activity_logs.filter(l => l.user_id === req.userId);
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const messageLogs = allLogs.filter(l => l.event_type === 'message_sent' || l.event_type === 'message_received');
    const messagesToday = messageLogs.filter(l => l.created_at.startsWith(today)).length;
    const messagesThisWeek = messageLogs.filter(l => l.created_at >= weekAgo).length;
    const withLatency = allLogs.filter(l => l.latency_ms != null && l.latency_ms > 0);
    const avgResponseTimeMs = withLatency.length > 0
      ? Math.round(withLatency.reduce((sum, l) => sum + (l.latency_ms || 0), 0) / withLatency.length)
      : 0;
    const successLogs = allLogs.filter(l => l.status === 'success').length;
    const successRate = allLogs.length > 0 ? Math.round((successLogs / allLogs.length) * 100) : 100;
    const channelCounts: Record<string, number> = {};
    allLogs.forEach(l => { channelCounts[l.channel] = (channelCounts[l.channel] || 0) + 1; });
    const topChannels = Object.entries(channelCounts).sort((a, b) => b[1] - a[1]).map(([channel, count]) => ({ channel, count }));
    const activeAgents = [...new Set(allLogs.map(l => l.agent_id))].length;
    res.json({ totalMessages: messageLogs.length, messagesToday, messagesThisWeek, avgResponseTimeMs, successRate, topChannels, activeAgents });
  });

  app.delete('/api/activity', auth, (req: any, res) => {
    db.data.activity_logs = db.data.activity_logs.filter(l => l.user_id !== req.userId);
    save();
    res.json({ success: true });
  });

  // ─── Frontend ─────────────────────────────────────────────────────────────
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
