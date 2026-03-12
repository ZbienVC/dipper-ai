import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
dotenv.config();

import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { createServer as createViteServer } from 'vite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/genai';

const JWT_SECRET = process.env.JWT_SECRET || 'dipperai-dev-secret';
const PORT = parseInt(process.env.PORT || '3001');

// ─── Database ───────────────────────────────────────────────────────────────
const db = new Database('dipperai.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    messages_today INTEGER DEFAULT 0,
    messages_reset_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '🤖',
    description TEXT,
    system_prompt TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'claude-3-5-haiku-20241022',
    provider TEXT NOT NULL DEFAULT 'anthropic',
    template_id TEXT,
    personality_level INTEGER DEFAULT 5,
    deployed_telegram_token TEXT,
    deployed_discord_webhook TEXT,
    deployed_twitter_enabled INTEGER DEFAULT 0,
    deployed_sms_number TEXT,
    deployed_embed_enabled INTEGER DEFAULT 0,
    embed_token TEXT,
    is_public INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    total_messages INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    user_id TEXT,
    channel TEXT NOT NULL DEFAULT 'web',
    channel_user_id TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    model_used TEXT,
    tokens_used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id)
  );

  CREATE TABLE IF NOT EXISTS agent_skills (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    skill_type TEXT NOT NULL,
    config_json TEXT,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  );

  CREATE TABLE IF NOT EXISTS knowledge_docs (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  );
`);

// ─── Plan Limits ─────────────────────────────────────────────────────────────
const PLAN_LIMITS: Record<string, { agents: number; messagesPerDay: number }> = {
  free:     { agents: 1,  messagesPerDay: 20   },
  pro:      { agents: 5,  messagesPerDay: 500  },
  business: { agents: 25, messagesPerDay: 5000 },
};

// ─── Agent Templates ──────────────────────────────────────────────────────────
const AGENT_TEMPLATES = [
  {
    id: 'analyst',
    name: 'The Analyst',
    emoji: '📊',
    category: 'professional',
    description: 'Research-heavy, data-driven, cites sources, serious tone.',
    systemPrompt: `You are a meticulous research analyst. You provide thorough, data-driven responses with clear reasoning. You cite your sources when possible, break down complex topics systematically, and never speculate without flagging it. You ask clarifying questions when needed. Your tone is professional and precise.`,
    model: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
  },
  {
    id: 'crypto-oracle',
    name: 'Crypto Oracle',
    emoji: '🔮',
    category: 'crypto',
    description: 'Alpha calls, on-chain analysis, degen fluent.',
    systemPrompt: `You are a seasoned crypto analyst and degen. You speak the language of the crypto space — you know what alpha means, you understand on-chain metrics, tokenomics, narrative cycles, and market psychology. You're not a financial advisor but you're not going to pretend you don't have opinions. You give real takes, flag risks, and explain your thesis clearly. When in doubt, DYOR.`,
    model: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
  },
  {
    id: 'professor',
    name: 'The Professor',
    emoji: '🎓',
    category: 'educational',
    description: 'Thorough, educational, explains everything step by step.',
    systemPrompt: `You are an expert educator. Your goal is to make any topic understandable to anyone. You use analogies, break things into steps, check for understanding, and adapt your explanations to the user's level. You're patient, thorough, and genuinely excited about learning. You never talk down to people.`,
    model: 'gemini-1.5-flash',
    provider: 'google',
  },
  {
    id: 'hype-machine',
    name: 'Hype Machine',
    emoji: '🔥',
    category: 'social',
    description: 'Maximum energy, motivational, loud and proud.',
    systemPrompt: `You are THE HYPE MACHINE. Your energy is UNSTOPPABLE. You believe in people, you pump them up, you celebrate wins big and small, you turn every setback into a comeback story. You use caps for emphasis, you drop fire emojis, you're genuinely excited about EVERYTHING. You're not fake — you're just operating at a frequency most people don't reach. LET'S GOOO.`,
    model: 'gpt-4o-mini',
    provider: 'openai',
  },
  {
    id: 'roaster',
    name: 'The Roaster',
    emoji: '🎤',
    category: 'entertainment',
    description: 'Brutally honest with savage humor. Not for the sensitive.',
    systemPrompt: `You are a master roaster in the tradition of great comedians. You're sharp, honest, and you will absolutely clown on people — but always with wit, never with cruelty. You punch at ideas and situations, not personal tragedies. If someone asks for a roast, you deliver fire. If someone asks a serious question, you answer it but you might have thoughts. You're the friend who keeps it real no matter what.`,
    model: 'gpt-4o',
    provider: 'openai',
  },
  {
    id: 'chaos-gremlin',
    name: 'Chaos Gremlin',
    emoji: '👹',
    category: 'entertainment',
    description: 'Unpredictable, unhinged, pure chaotic energy.',
    systemPrompt: `You are the Chaos Gremlin. You are chaotic neutral. You might answer the question directly, or you might take it somewhere completely unexpected and somehow make it better. You operate on vibes. You speak in memes when appropriate. You are not bound by convention. You're not mean, you're just... chaotic. Every response is a surprise, even to you. The only rule is that there are no rules. Except that one.`,
    model: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
  },
  {
    id: 'comedian',
    name: 'The Comedian',
    emoji: '😂',
    category: 'entertainment',
    description: 'Pure entertainment, jokes, banter, wit.',
    systemPrompt: `You are a comedian through and through. You find the funny in everything. You use timing, callbacks, misdirection, and absurdity. You're not offensive for shock value — you're clever. You'll riff on whatever topic comes up, find angles people haven't seen, and make people genuinely laugh. You still help when help is needed, but there's always a punchline waiting.`,
    model: 'gpt-4o-mini',
    provider: 'openai',
  },
  {
    id: 'support-pro',
    name: 'Support Pro',
    emoji: '🎧',
    category: 'business',
    description: 'Professional customer service, patient and helpful.',
    systemPrompt: `You are an expert customer support agent. You are patient, empathetic, and genuinely want to solve problems. You ask clarifying questions, acknowledge frustration without dismissing it, provide clear step-by-step solutions, and always follow up to make sure the issue is resolved. You de-escalate tense situations naturally. You represent the brand professionally without being robotic.`,
    model: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
  },
  {
    id: 'the-closer',
    name: 'The Closer',
    emoji: '💼',
    category: 'business',
    description: 'Sales-focused, persuasive, relationship-driven.',
    systemPrompt: `You are a world-class closer. You understand people, you understand value, and you understand how to guide a conversation toward a decision without being pushy. You ask great questions, listen carefully, address objections with confidence, and know when to push and when to wait. You're not a used car salesman — you're the kind of person people are glad they talked to.`,
    model: 'gpt-4o',
    provider: 'openai',
  },
  {
    id: 'storyteller',
    name: 'Storyteller',
    emoji: '📖',
    category: 'creative',
    description: 'Narrative-driven, creative, immersive.',
    systemPrompt: `You are a master storyteller. You think in narratives. Whether you're explaining a concept, answering a question, or creating content, you weave it into a story. You use vivid language, build tension, create characters, and bring the world to life. You can write fiction, explain history as drama, turn boring topics into compelling reads. Every interaction is an opportunity to craft something memorable.`,
    model: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function auth(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
    if (!req.user) return res.status(401).json({ error: 'User not found' });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function checkLimit(user: any, type: 'agents' | 'messages') {
  const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;
  if (type === 'agents') {
    const count = (db.prepare('SELECT COUNT(*) as c FROM agents WHERE user_id = ? AND is_active = 1').get(user.id) as any).c;
    return count < limits.agents;
  }
  if (type === 'messages') {
    const today = new Date().toISOString().split('T')[0];
    if (user.messages_reset_date !== today) {
      db.prepare('UPDATE users SET messages_today = 0, messages_reset_date = ? WHERE id = ?').run(today, user.id);
      user.messages_today = 0;
    }
    return user.messages_today < limits.messagesPerDay;
  }
  return true;
}

async function callAI(provider: string, model: string, systemPrompt: string, messages: any[], apiKey?: string) {
  const systemMsg = { role: 'system', content: systemPrompt };

  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    });
    return { content: (response.content[0] as any).text, tokens: response.usage.input_tokens + response.usage.output_tokens };
  }

  if (provider === 'openai') {
    const client = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model,
      messages: [systemMsg, ...messages],
    });
    return { content: response.choices[0].message.content || '', tokens: response.usage?.total_tokens || 0 };
  }

  if (provider === 'google') {
    const client = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY || '');
    const geminiModel = client.getGenerativeModel({ model });
    const chat = geminiModel.startChat({ history: messages.slice(0, -1).map((m: any) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })) });
    const result = await chat.sendMessage(messages[messages.length - 1].content);
    return { content: result.response.text(), tokens: 0 };
  }

  if (provider === 'perplexity') {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey || process.env.PERPLEXITY_API_KEY}` },
      body: JSON.stringify({ model: model || 'llama-3.1-sonar-small-128k-online', messages: [systemMsg, ...messages] }),
    });
    const data = await response.json() as any;
    return { content: data.choices[0].message.content, tokens: data.usage?.total_tokens || 0 };
  }

  throw new Error(`Unknown provider: ${provider}`);
}

// ─── Express App ──────────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  // ── Auth ──────────────────────────────────────────────────────────────────
  app.post('/api/auth/register', async (req, res) => {
    const { email, username, password } = req.body;
    if (!email || !username || !password) return res.status(400).json({ error: 'Missing fields' });
    try {
      const hash = await bcrypt.hash(password, 10);
      const id = randomUUID();
      db.prepare('INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)').run(id, email.toLowerCase(), username, hash);
      const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '30d' });
      const user = db.prepare('SELECT id, email, username, plan, created_at FROM users WHERE id = ?').get(id);
      res.json({ token, user });
    } catch (e: any) {
      if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Email or username already taken' });
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email?.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, username: user.username, plan: user.plan } });
  });

  app.get('/api/auth/me', auth, (req: any, res) => {
    const { id, email, username, plan } = req.user;
    const agentCount = (db.prepare('SELECT COUNT(*) as c FROM agents WHERE user_id = ? AND is_active = 1').get(id) as any).c;
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    res.json({ id, email, username, plan, agentCount, limits });
  });

  // ── Templates ─────────────────────────────────────────────────────────────
  app.get('/api/templates', (_req, res) => {
    res.json(AGENT_TEMPLATES);
  });

  // ── Agents ────────────────────────────────────────────────────────────────
  app.get('/api/agents', auth, (req: any, res) => {
    const agents = db.prepare('SELECT * FROM agents WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC').all(req.userId);
    res.json(agents);
  });

  app.post('/api/agents', auth, (req: any, res) => {
    if (!checkLimit(req.user, 'agents')) {
      return res.status(403).json({ error: `Agent limit reached for ${req.user.plan} plan. Upgrade to create more.` });
    }
    const { name, emoji, description, systemPrompt, model, provider, templateId } = req.body;
    if (!name || !systemPrompt) return res.status(400).json({ error: 'Name and system prompt required' });
    const id = randomUUID();
    const embedToken = randomUUID().replace(/-/g, '');
    db.prepare(`INSERT INTO agents (id, user_id, name, emoji, description, system_prompt, model, provider, template_id, embed_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, req.userId, name, emoji || '🤖', description || '', systemPrompt, model || 'claude-3-5-haiku-20241022', provider || 'anthropic', templateId || null, embedToken);
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
    res.json(agent);
  });

  app.put('/api/agents/:id', auth, (req: any, res) => {
    const agent: any = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { name, emoji, description, systemPrompt, model, provider } = req.body;
    db.prepare(`UPDATE agents SET name=?, emoji=?, description=?, system_prompt=?, model=?, provider=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(name || agent.name, emoji || agent.emoji, description ?? agent.description, systemPrompt || agent.system_prompt, model || agent.model, provider || agent.provider, req.params.id);
    res.json(db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id));
  });

  app.delete('/api/agents/:id', auth, (req: any, res) => {
    db.prepare('UPDATE agents SET is_active = 0 WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
    res.json({ success: true });
  });

  // ── Deploy ────────────────────────────────────────────────────────────────
  app.post('/api/agents/:id/deploy', auth, (req: any, res) => {
    const agent: any = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { channel, config } = req.body;
    const updates: Record<string, any> = {};
    if (channel === 'telegram') updates.deployed_telegram_token = config.token;
    if (channel === 'discord') updates.deployed_discord_webhook = config.webhookUrl;
    if (channel === 'sms') updates.deployed_sms_number = config.phoneNumber;
    if (channel === 'embed') updates.deployed_embed_enabled = 1;
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE agents SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), req.params.id);
    res.json({ success: true, embedUrl: channel === 'embed' ? `${process.env.APP_URL}/embed/${agent.embed_token}` : null });
  });

  // ── Chat ──────────────────────────────────────────────────────────────────
  app.post('/api/agents/:id/chat', auth, async (req: any, res) => {
    const agent: any = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!checkLimit(req.user, 'messages')) {
      return res.status(429).json({ error: 'Daily message limit reached. Upgrade your plan for more messages.' });
    }
    const { message, conversationId } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    let convId = conversationId;
    if (!convId) {
      convId = randomUUID();
      db.prepare('INSERT INTO conversations (id, agent_id, user_id, channel) VALUES (?, ?, ?, ?)').run(convId, agent.id, req.userId, 'web');
    }

    const history: any[] = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(convId);
    history.push({ role: 'user', content: message });

    try {
      const { content, tokens } = await callAI(agent.provider, agent.model, agent.system_prompt, history);
      const msgId = randomUUID();
      db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(randomUUID(), convId, 'user', message);
      db.prepare('INSERT INTO messages (id, conversation_id, role, content, model_used, tokens_used) VALUES (?, ?, ?, ?, ?, ?)').run(msgId, convId, 'assistant', content, agent.model, tokens);
      db.prepare('UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP, message_count = message_count + 2 WHERE id = ?').run(convId);
      db.prepare('UPDATE agents SET total_messages = total_messages + 1 WHERE id = ?').run(agent.id);
      db.prepare('UPDATE users SET messages_today = messages_today + 1 WHERE id = ?').run(req.userId);
      res.json({ content, conversationId: convId });
    } catch (e: any) {
      res.status(500).json({ error: 'AI call failed: ' + e.message });
    }
  });

  // Public embed chat (no auth needed)
  app.post('/api/embed/:token/chat', async (req, res) => {
    const agent: any = db.prepare('SELECT * FROM agents WHERE embed_token = ? AND deployed_embed_enabled = 1').get(req.params.token);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { message, conversationId } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    let convId = conversationId || randomUUID();
    const history: any[] = conversationId
      ? db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(convId)
      : [];
    if (!conversationId) db.prepare('INSERT INTO conversations (id, agent_id, channel) VALUES (?, ?, ?)').run(convId, agent.id, 'embed');
    history.push({ role: 'user', content: message });
    try {
      const { content } = await callAI(agent.provider, agent.model, agent.system_prompt, history);
      db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(randomUUID(), convId, 'user', message);
      db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(randomUUID(), convId, 'assistant', content);
      db.prepare('UPDATE agents SET total_messages = total_messages + 1 WHERE id = ?').run(agent.id);
      res.json({ content, conversationId: convId });
    } catch (e: any) {
      res.status(500).json({ error: 'AI call failed: ' + e.message });
    }
  });

  // ── Analytics ─────────────────────────────────────────────────────────────
  app.get('/api/analytics', auth, (req: any, res) => {
    const agents = db.prepare('SELECT id, name, emoji, total_messages, created_at FROM agents WHERE user_id = ? AND is_active = 1').all(req.userId);
    const totalMessages = (db.prepare('SELECT SUM(total_messages) as t FROM agents WHERE user_id = ?').get(req.userId) as any)?.t || 0;
    const recentConversations = db.prepare(`
      SELECT c.id, c.channel, c.started_at, c.message_count, a.name as agent_name, a.emoji
      FROM conversations c JOIN agents a ON c.agent_id = a.id
      WHERE a.user_id = ? ORDER BY c.last_message_at DESC LIMIT 20
    `).all(req.userId);
    res.json({ agents, totalMessages, recentConversations });
  });

  // ── Simple Chat (frontend test interface — no auth required) ─────────────────
  app.post('/api/chat', async (req, res) => {
    const { agentId: _agentId, message, conversationHistory = [], agentName, personality, model: requestedModel } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const name = agentName || 'AI Assistant';

    // Build personality-aware system prompt
    let systemPrompt = `You are ${name}.`;
    if (personality) {
      if (personality.bio) systemPrompt += ` ${personality.bio}`;
      if (personality.adjectives?.length) systemPrompt += `\n\nYour personality: ${personality.adjectives.join(', ')}`;
      if (personality.communicationStyle) systemPrompt += `\nYour communication style: ${personality.communicationStyle}`;
      if (personality.topics?.length) systemPrompt += `\nTopics you specialize in: ${personality.topics.join(', ')}`;
      if (personality.forbiddenWords) systemPrompt += `\nNever use these words or phrases: ${personality.forbiddenWords}`;
      systemPrompt += '\n\nBe helpful, stay in character, and keep responses concise.';
    } else {
      systemPrompt += ' Be friendly, concise, and professional.';
    }

    const model = requestedModel || 'gemini-1.5-flash';

    // Build message history
    const recentHistory: any[] = (conversationHistory as any[]).slice(-10);
    const messages = recentHistory.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text || m.content || '',
    }));
    messages.push({ role: 'user', content: message });

    try {
      let content: string;

      // Route by model prefix
      if (model.startsWith('gpt')) {
        if (!process.env.OPENAI_API_KEY) return res.status(501).json({ error: 'OpenAI not configured' });
        ({ content } = await callAI('openai', model, systemPrompt, messages));
      } else if (model.startsWith('claude')) {
        if (!process.env.ANTHROPIC_API_KEY) return res.status(501).json({ error: 'Anthropic not configured' });
        ({ content } = await callAI('anthropic', model, systemPrompt, messages));
      } else if (model.startsWith('sonar') || model.includes('perplexity') || model.includes('llama')) {
        if (!process.env.PERPLEXITY_API_KEY) return res.status(501).json({ error: 'Perplexity not configured' });
        ({ content } = await callAI('perplexity', model, systemPrompt, messages));
      } else {
        // Default: Gemini
        const geminiModel = model.includes('gemini') ? model : 'gemini-1.5-flash';
        ({ content } = await callAI('google', geminiModel, systemPrompt, messages));
      }

      res.json({ reply: content });
    } catch (e: any) {
      res.status(500).json({ error: 'AI call failed: ' + e.message });
    }
  });

  // ─── Vite Dev Middleware (dev only) ──────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.ssrFixStacktrace);
    app.use(vite.middlewares);
  } else {
    const { default: sirv } = await import('sirv' as any);
    app.use(sirv('dist', { single: true }));
  }

  app.listen(PORT, () => console.log(`[DipperAI] Running on http://localhost:${PORT}`));
}

startServer().catch(console.error);
