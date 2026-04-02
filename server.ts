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

type UserMemory = {
  id: string;
  agent_id: string;
  user_identifier: string;
  channel: string;
  facts: {
    name?: string;
    preferences?: string[];
    past_issues?: string[];
    custom: Record<string, string>;
  };
  summary?: string;
  summary_updated_at?: string;
  message_count: number;
  last_seen: string;
  first_seen: string;
  created_at: string;
  updated_at: string;
};

type Automation = {
  id: string;
  user_id: string;
  agent_id: string;
  name: string;
  description?: string;
  trigger_type: 'schedule' | 'manual';
  trigger_config: {
    cron?: string;
    timezone?: string;
    label?: string;
  };
  action_type: 'send_message' | 'post_to_channel' | 'send_ai_response';
  action_config: {
    channel: 'telegram' | 'sms' | 'discord';
    recipient?: string;
    message_template?: string;
    ai_prompt?: string;
    topic?: string;
  };
  is_active: boolean;
  run_count: number;
  last_run_at?: string;
  next_run_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
};

type AutomationRun = {
  id: string;
  automation_id: string;
  user_id: string;
  status: 'success' | 'error' | 'skipped';
  output?: string;
  error_message?: string;
  started_at: string;
  completed_at?: string;
};

type KnowledgeSource = {
  id: string;
  agent_id: string;
  user_id: string;
  name: string;
  type: 'text' | 'url' | 'faq';
  content: string;
  chunks: string[];
  status: 'ready' | 'processing' | 'error';
  char_count: number;
  chunk_count: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
};

type AgentTeam = {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  orchestrator_agent_id: string;
  member_agent_ids: string[];
  created_at: string;
  updated_at: string;
};

type TeamTask = {
  id: string;
  team_id: string;
  user_id: string;
  title: string;
  instructions: string;
  status: 'pending' | 'running' | 'success' | 'error';
  orchestrator_plan?: string;
  result_summary?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
};

type TeamTaskLog = {
  id: string;
  task_id: string;
  agent_id: string;
  role: 'orchestrator' | 'specialist';
  action: 'plan' | 'delegate' | 'work' | 'handoff' | 'summary' | 'error';
  content: string;
  created_at: string;
};

type Lead = {
  id: string;
  user_id: string;
  agent_id: string;
  agent_name: string;
  identifier: string;
  channel: string;
  display_name?: string;
  email?: string;
  phone?: string;
  stage: 'new' | 'contacted' | 'qualified' | 'proposal' | 'closed_won' | 'closed_lost';
  tags: string[];
  notes: string;
  message_count: number;
  last_contact: string;
  first_contact: string;
  value?: number;
  memory_summary?: string;
  created_at: string;
  updated_at: string;
};

type DBSchema = {
  users: User[]; agents: Agent[]; conversations: Conversation[];
  messages: Message[]; integrations: Integration[];
  scheduled_messages: ScheduledMessage[];
  activity_logs: ActivityLog[];
  user_memories: UserMemory[];
  automations: Automation[];
  automation_runs: AutomationRun[];
  knowledge_sources: KnowledgeSource[];
  agent_teams: AgentTeam[];
  team_tasks: TeamTask[];
  team_task_logs: TeamTaskLog[];
  leads: Lead[];
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

// ─── Memory Helpers ───────────────────────────────────────────────────────────
async function extractAndUpdateMemory(
  agentId: string,
  userIdentifier: string,
  channel: string,
  conversationHistory: { role: string; content: string }[],
  _agentSystemPrompt: string
): Promise<void> {
  try {
    if (!db?.data?.user_memories) db.data.user_memories = [];
    const now = new Date().toISOString();
    let mem = db.data.user_memories.find(m => m.agent_id === agentId && m.user_identifier === userIdentifier && m.channel === channel);
    if (!mem) {
      mem = {
        id: randomUUID(), agent_id: agentId, user_identifier: userIdentifier, channel,
        facts: { custom: {} },
        message_count: 0, last_seen: now, first_seen: now,
        created_at: now, updated_at: now,
      };
      db.data.user_memories.push(mem);
    }
    mem.message_count++;
    mem.last_seen = now;
    mem.updated_at = now;

    // Every 5 messages, extract facts
    if (mem.message_count % 5 === 0 && conversationHistory.length > 0) {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const convoText = conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n');
        const extractResp = await client.messages.create({
          model: 'claude-haiku-4-5', max_tokens: 512,
          system: 'You are a fact extractor. Return ONLY valid JSON, no extra text.',
          messages: [{
            role: 'user',
            content: `Extract key facts from this conversation. Return JSON exactly like: {"name": "string or null", "preferences": ["..."], "past_issues": ["..."], "custom_facts": {"key": "value"}}. Be concise.\n\nConversation:\n${convoText.slice(0, 3000)}`,
          }],
        });
        const raw = (extractResp.content[0] as any).text as string;
        const parsed = JSON.parse(raw.trim());
        if (parsed.name && !mem.facts.name) mem.facts.name = parsed.name;
        if (Array.isArray(parsed.preferences)) {
          mem.facts.preferences = [...new Set([...(mem.facts.preferences || []), ...parsed.preferences])];
        }
        if (Array.isArray(parsed.past_issues)) {
          mem.facts.past_issues = [...new Set([...(mem.facts.past_issues || []), ...parsed.past_issues])];
        }
        if (parsed.custom_facts && typeof parsed.custom_facts === 'object') {
          mem.facts.custom = { ...mem.facts.custom, ...parsed.custom_facts };
        }
      } catch { /* fail silently */ }
    }

    // Every 20 messages, generate rolling summary
    if (mem.message_count % 20 === 0 && conversationHistory.length > 0) {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const convoText = conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n');
        const sumResp = await client.messages.create({
          model: 'claude-haiku-4-5', max_tokens: 256,
          system: 'Summarize the conversation in 2-3 sentences for future context. Be concise and factual.',
          messages: [{ role: 'user', content: convoText.slice(0, 4000) }],
        });
        mem.summary = (sumResp.content[0] as any).text as string;
        mem.summary_updated_at = new Date().toISOString();
      } catch { /* fail silently */ }
    }

    mem.updated_at = new Date().toISOString();

    // ─── Upsert Lead from memory ──────────────────────────────────────────────
    try {
      if (!db.data.leads) db.data.leads = [];
      const agent = db.data.agents.find(a => a.id === agentId);
      let lead = db.data.leads.find(l => l.agent_id === agentId && l.identifier === userIdentifier);
      if (!lead) {
        lead = {
          id: randomUUID(),
          user_id: agent?.user_id || '',
          agent_id: agentId,
          agent_name: agent?.name || 'Unknown',
          identifier: userIdentifier,
          channel,
          stage: 'new',
          tags: [],
          notes: '',
          message_count: mem.message_count,
          last_contact: mem.last_seen,
          first_contact: mem.first_seen,
          created_at: now,
          updated_at: now,
        };
        db.data.leads.push(lead);
      }
      // Sync non-manual fields
      lead.message_count = mem.message_count;
      lead.last_contact = mem.last_seen;
      lead.agent_name = agent?.name || lead.agent_name;
      if (mem.facts.name && !lead.display_name) lead.display_name = mem.facts.name;
      if (mem.summary) lead.memory_summary = mem.summary;
      lead.updated_at = now;
    } catch { /* fail silently */ }

    save();
  } catch { /* fail silently — never block chat */ }
}

function buildMemoryContext(agentId: string, userIdentifier: string, channel: string): string {
  if (!db?.data?.user_memories) return '';
  const mem = db.data.user_memories.find(m => m.agent_id === agentId && m.user_identifier === userIdentifier && m.channel === channel);
  if (!mem) return '';
  const lines: string[] = ['=== User Memory ==='];
  if (mem.facts.name) lines.push(`Name: ${mem.facts.name}`);
  if (mem.facts.preferences?.length) lines.push(`Preferences: ${mem.facts.preferences.join(', ')}`);
  if (mem.facts.past_issues?.length) lines.push(`Past issues: ${mem.facts.past_issues.join(', ')}`);
  if (Object.keys(mem.facts.custom).length) {
    for (const [k, v] of Object.entries(mem.facts.custom)) lines.push(`${k}: ${v}`);
  }
  if (mem.summary) lines.push(`Summary: ${mem.summary}`);
  const lastSeen = new Date(mem.last_seen);
  const diffMs = Date.now() - lastSeen.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const lastSeenStr = diffDays === 0 ? 'today' : diffDays === 1 ? 'yesterday' : `${diffDays} days ago`;
  lines.push(`Last seen: ${lastSeenStr}`);
  lines.push('=== End Memory ===');
  return lines.join('\n');
}

// ─── Knowledge Base Helpers ───────────────────────────────────────────────────

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize));
    start += chunkSize - overlap;
  }
  return chunks;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function retrieveRelevantChunks(agentId: string, query: string, topK: number = 3): string[] {
  if (!db?.data?.knowledge_sources) return [];
  const sources = db.data.knowledge_sources.filter(s => s.agent_id === agentId && s.status === 'ready');
  if (sources.length === 0) return [];

  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (queryWords.length === 0) return [];

  const allChunks: { text: string; score: number }[] = [];

  for (const source of sources) {
    for (const chunk of source.chunks) {
      const chunkLower = chunk.toLowerCase();
      const score = queryWords.reduce((s, word) => {
        const count = (chunkLower.match(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        return s + count;
      }, 0);
      if (score > 0) allChunks.push({ text: chunk, score });
    }
  }

  return allChunks
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(c => c.text);
}

function buildKnowledgeContext(agentId: string, query: string): string {
  const chunks = retrieveRelevantChunks(agentId, query, 3);
  if (chunks.length === 0) return '';
  return `=== Relevant Knowledge ===\n${chunks.join('\n\n')}\n=== End Knowledge ===`;
}

// ─── Automation Helpers ───────────────────────────────────────────────────────

function getNextRunAt(cronExpression: string, timezone?: string): string {
  try {
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length !== 5) throw new Error('invalid cron');
    const [minuteField, hourField, , , dowField] = parts;

    const now = new Date();
    const candidate = new Date(now);
    candidate.setSeconds(0, 0);
    candidate.setMinutes(candidate.getMinutes() + 1); // start from next minute

    // Resolve minute
    let targetMinute: number;
    if (minuteField === '*') targetMinute = candidate.getMinutes();
    else if (minuteField.startsWith('*/')) {
      const step = parseInt(minuteField.slice(2));
      const cur = candidate.getMinutes();
      const next = cur + (step - (cur % step));
      targetMinute = next >= 60 ? 0 : next;
      if (next >= 60) candidate.setHours(candidate.getHours() + 1);
    } else targetMinute = parseInt(minuteField);

    // Resolve hour
    let targetHour: number;
    if (hourField === '*') targetHour = candidate.getHours();
    else targetHour = parseInt(hourField);

    candidate.setMinutes(targetMinute, 0, 0);
    candidate.setHours(targetHour);

    // If candidate is in the past (for this day), advance by 1 day
    if (candidate <= now) {
      candidate.setDate(candidate.getDate() + 1);
    }

    // Day of week handling
    if (dowField !== '*') {
      const targetDow = parseInt(dowField);
      while (candidate.getDay() !== targetDow) {
        candidate.setDate(candidate.getDate() + 1);
      }
    }

    return candidate.toISOString();
  } catch {
    // fallback: 24h from now
    return new Date(Date.now() + 86400000).toISOString();
  }
}

async function executeAutomation(automation: Automation): Promise<AutomationRun> {
  if (!db.data.automation_runs) db.data.automation_runs = [];
  const startedAt = new Date().toISOString();
  const runId = randomUUID();

  const run: AutomationRun = {
    id: runId,
    automation_id: automation.id,
    user_id: automation.user_id,
    status: 'success',
    started_at: startedAt,
  };

  try {
    const agent = db.data.agents.find(a => a.id === automation.agent_id);
    if (!agent) throw new Error('Agent not found');

    let outputText = '';

    if (automation.action_type === 'send_message') {
      outputText = automation.action_config.message_template || '';
    } else {
      // send_ai_response or post_to_channel — generate with AI
      const prompt = automation.action_config.ai_prompt || automation.action_config.topic || 'Generate a helpful message.';
      const { text } = await callAI(agent.provider, agent.model, agent.system_prompt, [{ role: 'user', content: prompt }], 512);
      outputText = text;
    }

    // Send via channel
    const channel = automation.action_config.channel;
    const recipient = automation.action_config.recipient;

    if (channel === 'telegram') {
      const botToken = agent.deployed_telegram_token;
      if (!botToken) throw new Error('No Telegram bot token configured on agent');
      if (!recipient) throw new Error('No recipient (chat_id) configured');
      const resp = await sendTelegramMessage(botToken, recipient, outputText);
      if (!resp.ok) throw new Error(`Telegram API error: ${resp.status}`);
    } else if (channel === 'sms') {
      const integration = db.data.integrations.find(i => i.user_id === automation.user_id && i.type === 'sms' && i.connected);
      if (!integration) throw new Error('No SMS/Twilio integration connected');
      const creds = decodeCredentials(integration.credentials);
      // Support both legacy key names and current names
      const acctSid = creds.accountSid || creds.account_sid;
      const authTok = creds.authToken || creds.auth_token;
      const fromNum = creds.phoneNumber || creds.from_number;
      if (!acctSid || !authTok || !fromNum) throw new Error('Twilio credentials incomplete');
      const body = new URLSearchParams({
        From: fromNum, To: recipient || '', Body: outputText,
      });
      const twilioResp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${acctSid}/Messages.json`, {
        method: 'POST',
        headers: { 'Authorization': 'Basic ' + Buffer.from(`${acctSid}:${authTok}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      if (!twilioResp.ok) throw new Error(`Twilio error: ${twilioResp.status}`);
    } else if (channel === 'discord') {
      const webhookUrl = agent.deployed_discord_webhook || automation.action_config.recipient;
      if (!webhookUrl) throw new Error('No Discord webhook configured');
      const resp = await fetch(webhookUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: outputText }),
      });
      if (!resp.ok) throw new Error(`Discord webhook error: ${resp.status}`);
    }

    run.output = outputText;
    run.status = 'success';
    automation.last_error = undefined;
  } catch (e: any) {
    run.status = 'error';
    run.error_message = e?.message || 'Unknown error';
    automation.last_error = run.error_message;
  }

  run.completed_at = new Date().toISOString();
  db.data.automation_runs.push(run);

  // Update automation stats
  automation.run_count = (automation.run_count || 0) + 1;
  automation.last_run_at = startedAt;
  if (automation.trigger_type === 'schedule' && automation.trigger_config?.cron) {
    automation.next_run_at = getNextRunAt(automation.trigger_config.cron, automation.trigger_config.timezone);
  }
  automation.updated_at = new Date().toISOString();

  logActivity({
    user_id: automation.user_id,
    agent_id: automation.agent_id,
    agent_name: db.data.agents.find(a => a.id === automation.agent_id)?.name || 'Unknown',
    event_type: 'automation_triggered',
    channel: (automation.action_config.channel as any) || 'system',
    summary: `Automation "${automation.name}" ${run.status === 'success' ? 'ran successfully' : 'failed'}`,
    details: run.output?.slice(0, 200) || run.error_message,
    status: run.status === 'success' ? 'success' : 'error',
    error_message: run.error_message,
  });

  save();
  return run;
}

function startAutomationRunner() {
  setInterval(async () => {
    if (!db?.data?.automations) return;
    const now = new Date();
    const active = db.data.automations.filter(a => a.is_active && a.next_run_at);
    for (const automation of active) {
      if (!automation.next_run_at) continue;
      const nextRun = new Date(automation.next_run_at);
      if (now >= nextRun) {
        executeAutomation(automation).catch(e => console.error('[automation-runner]', e));
      }
    }
  }, 60000);
}

// in-memory cron runner
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
    db = new Low<DBSchema>(adapter, { users: [], agents: [], conversations: [], messages: [], integrations: [], scheduled_messages: [], activity_logs: [], user_memories: [], automations: [], automation_runs: [], knowledge_sources: [], agent_teams: [], team_tasks: [], team_task_logs: [], leads: [] });
    try { db.read(); } catch { /* fresh */ }
    if (!db.data.scheduled_messages) db.data.scheduled_messages = [];
    if (!db.data.activity_logs) db.data.activity_logs = [];
    if (!db.data.user_memories) db.data.user_memories = [];
    if (!db.data.automations) db.data.automations = [];
    if (!db.data.automation_runs) db.data.automation_runs = [];
    if (!db.data.agent_teams) db.data.agent_teams = [];
    if (!db.data.team_tasks) db.data.team_tasks = [];
    if (!db.data.team_task_logs) db.data.team_task_logs = [];
    if (!db.data.leads) db.data.leads = [];
    db.write();
    console.log('[DipperAI] File DB:', dbPath);
  } catch {
    console.warn('[DipperAI] Read-only filesystem, using in-memory DB');
    const { MemorySync } = await import('lowdb');
    db = new Low<DBSchema>(new MemorySync<DBSchema>(), { users: [], agents: [], conversations: [], messages: [], integrations: [], scheduled_messages: [], activity_logs: [], user_memories: [], automations: [], automation_runs: [], knowledge_sources: [], agent_teams: [], team_tasks: [], team_task_logs: [], leads: [] });
  }

  startCronRunner();
  startAutomationRunner();

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
      const memoryContext = buildMemoryContext(agent.id, req.userId, 'web');
      const knowledgeContext = buildKnowledgeContext(agent.id, message);
      const basePrompt = knowledgeContext ? `${knowledgeContext}\n\n${agent.system_prompt}` : agent.system_prompt;
      const systemPromptWithMemory = memoryContext ? `${memoryContext}\n\n${basePrompt}` : basePrompt;
      const { text: content, tokensUsed } = await callAI(activeProvider, effectiveModel, systemPromptWithMemory, history, plan.maxTokens);
      const latency_ms = Date.now() - startTime;
      db.data.messages.push({ id: randomUUID(), conversation_id: convId, role: 'user', content: message, created_at: new Date().toISOString() });
      db.data.messages.push({ id: randomUUID(), conversation_id: convId, role: 'assistant', content, model_used: effectiveModel, created_at: new Date().toISOString() });
      agent.total_messages++;
      req.user.messages_today++;
      resetTokensIfNeeded(req.user);
      req.user.tokens_used_today = (req.user.tokens_used_today || 0) + tokensUsed;
      console.log(`[chat] model=${effectiveModel} tokens=${tokensUsed}`);
      save();
      // Async memory extraction — never block response
      extractAndUpdateMemory(agent.id, req.userId, 'web', [...history, { role: 'assistant', content }], agent.system_prompt).catch(() => {});
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

  // Per-agent detailed analytics with time-series (last 30 days)
  app.get('/api/analytics/agent/:id', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const logs = db.data.activity_logs.filter(l => l.agent_id === agent.id);
    const messageLogs = logs.filter(l => l.event_type === 'message_sent');

    // Build 30-day time series
    const days: Record<string, { date: string; messages: number; errors: number; tokens: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      days[d] = { date: d, messages: 0, errors: 0, tokens: 0 };
    }
    for (const log of logs) {
      const d = log.created_at.split('T')[0];
      if (days[d]) {
        if (log.event_type === 'message_sent') days[d].messages++;
        if (log.status === 'error') days[d].errors++;
        if (log.tokens_used) days[d].tokens += log.tokens_used;
      }
    }

    const channelBreakdown: Record<string, number> = {};
    for (const log of messageLogs) channelBreakdown[log.channel] = (channelBreakdown[log.channel] || 0) + 1;

    const withLatency = logs.filter(l => l.latency_ms != null && l.latency_ms > 0);
    const avgLatency = withLatency.length > 0 ? Math.round(withLatency.reduce((s, l) => s + (l.latency_ms || 0), 0) / withLatency.length) : 0;
    const totalTokens = logs.reduce((s, l) => s + (l.tokens_used || 0), 0);
    const memories = (db.data.user_memories || []).filter(m => m.agent_id === agent.id);

    res.json({
      agent: { id: agent.id, name: agent.name, emoji: agent.emoji, model: agent.model, provider: agent.provider, total_messages: agent.total_messages },
      timeSeries: Object.values(days),
      channelBreakdown,
      avgLatency,
      totalTokens,
      uniqueUsers: memories.length,
      totalLogs: logs.length,
    });
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

      const telegramUserId = String(msg.from?.id || chatId);
      const memoryContext = buildMemoryContext(agent.id, telegramUserId, 'telegram');
      const tgKnowledgeContext = buildKnowledgeContext(agent.id, text);
      const tgBasePrompt = tgKnowledgeContext ? `${tgKnowledgeContext}\n\n${agent.system_prompt}` : agent.system_prompt;
      const systemPromptWithMemory = memoryContext ? `${memoryContext}\n\n${tgBasePrompt}` : tgBasePrompt;

      // Find or create conversation for this Telegram chat to maintain history
      const tgChatKey = `tg_${chatId}`;
      let tgConv = db.data.conversations.find(c => c.agent_id === agent.id && c.channel === 'telegram' && (c as any).external_id === tgChatKey);
      if (!tgConv) {
        const newConv = { id: randomUUID(), agent_id: agent.id, user_id: undefined as any, channel: 'telegram', message_count: 0, created_at: new Date().toISOString(), external_id: tgChatKey } as any;
        db.data.conversations.push(newConv);
        tgConv = newConv;
        save();
      }

      // Load last 10 messages for this conversation as context
      const tgHistory = db.data.messages
        .filter(m => m.conversation_id === tgConv!.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));
      tgHistory.push({ role: 'user', content: text });

      const { text: reply } = await callAI(provider, effectiveModel, systemPromptWithMemory, tgHistory);

      // Store messages in conversation
      db.data.messages.push({ id: randomUUID(), conversation_id: tgConv.id, role: 'user', content: text, created_at: new Date().toISOString() });
      db.data.messages.push({ id: randomUUID(), conversation_id: tgConv.id, role: 'assistant', content: reply, model_used: effectiveModel, created_at: new Date().toISOString() });
      (tgConv as any).message_count = ((tgConv as any).message_count || 0) + 2;

      // Handle delay if configured
      if (agent.response_delay_ms && agent.response_delay_ms > 0) {
        await new Promise(r => setTimeout(r, Math.min(agent.response_delay_ms!, 5000)));
      }

      await sendTelegramMessage(botToken, chatId, reply);
      agent.total_messages++;
      save();
      // Async memory extraction
      extractAndUpdateMemory(agent.id, telegramUserId, 'telegram', [...tgHistory, { role: 'assistant', content: reply }], agent.system_prompt).catch(() => {});
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

      // Find or create conversation for this SMS number to maintain history
      let smsConv = db.data.conversations.find(c => c.agent_id === agent.id && c.channel === 'sms' && (c as any).external_id === From);
      if (!smsConv) {
        const newConv = { id: randomUUID(), agent_id: agent.id, user_id: undefined as any, channel: 'sms', message_count: 0, created_at: new Date().toISOString(), external_id: From } as any;
        db.data.conversations.push(newConv);
        smsConv = newConv;
        save();
      }

      // Load last 10 messages for context
      const smsConvHistory = db.data.messages
        .filter(m => m.conversation_id === smsConv!.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));
      smsConvHistory.push({ role: 'user', content: Body });
      const history = smsConvHistory;
      const smsMemoryContext = buildMemoryContext(agent.id, From, 'sms');
      const smsKnowledgeContext = buildKnowledgeContext(agent.id, Body);
      const smsBasePrompt = smsKnowledgeContext ? `${smsKnowledgeContext}\n\n${agent.system_prompt}` : agent.system_prompt;
      const smsSystemPrompt = smsMemoryContext ? `${smsMemoryContext}\n\n${smsBasePrompt}` : smsBasePrompt;
      const { text: reply } = await callAI(agent.provider, agent.model, smsSystemPrompt, history);

      const { accountSid, authToken, phoneNumber } = decodeCredentials(matchedIntg.credentials);
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: phoneNumber, To: From, Body: reply }).toString(),
      });
      // Store messages in conversation for future history
      db.data.messages.push({ id: randomUUID(), conversation_id: smsConv!.id, role: 'user', content: Body, created_at: new Date().toISOString() });
      db.data.messages.push({ id: randomUUID(), conversation_id: smsConv!.id, role: 'assistant', content: reply, model_used: agent.model, created_at: new Date().toISOString() });
      (smsConv as any).message_count = ((smsConv as any).message_count || 0) + 2;
      agent.total_messages++;
      save();
      extractAndUpdateMemory(agent.id, From, 'sms', [...history, { role: 'assistant', content: reply }], agent.system_prompt).catch(() => {});
      logActivity({ user_id: agent.user_id, agent_id: agent.id, agent_name: agent.name, event_type: 'message_sent', channel: 'sms', summary: 'Replied to SMS message', details: reply.slice(0, 200), model_used: agent.model, status: 'success' });
    } catch (e) { console.error('[sms inbound error]', e); }
  });

  // ─── SMS opt-out/STOP handler ───────────────────────────────────────────
  app.post('/api/webhooks/sms/optout', express.urlencoded({ extended: false }), async (req, res) => {
    const OPT_OUT_KEYWORDS = ['STOP', 'UNSUBSCRIBE', 'QUIT', 'CANCEL', 'END'];
    const OPT_IN_KEYWORDS = ['START', 'YES', 'UNSTOP'];
    const { From, Body } = req.body;
    if (!From || !Body) return res.type('text/xml').send('<Response></Response>');
    const bodyUpper = Body.trim().toUpperCase();
    if (OPT_OUT_KEYWORDS.includes(bodyUpper)) {
      // Mark as opted out in a simple set
      if (!db.data.activity_logs) db.data.activity_logs = [];
      logActivity({ user_id: 'system', agent_id: 'system', agent_name: 'System', event_type: 'message_received', channel: 'sms', summary: `SMS opt-out from ${From}`, status: 'success' });
      return res.type('text/xml').send(`<Response><Message>You've been unsubscribed. Reply START to resubscribe.</Message></Response>`);
    }
    if (OPT_IN_KEYWORDS.includes(bodyUpper)) {
      return res.type('text/xml').send(`<Response><Message>You've been resubscribed. Reply STOP at any time to opt out.</Message></Response>`);
    }
    res.type('text/xml').send('<Response></Response>');
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

  // ─── Memory API ───────────────────────────────────────────────────────────
  app.get('/api/agents/:id/memories', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const memories = (db.data.user_memories || []).filter(m => m.agent_id === agent.id);
    const total = memories.length;
    const paged = memories.slice(offset, offset + limit).map(m => ({
      id: m.id,
      user_identifier: m.user_identifier,
      channel: m.channel,
      name: m.facts.name,
      message_count: m.message_count,
      last_seen: m.last_seen,
      first_seen: m.first_seen,
    }));
    res.json({ memories: paged, total });
  });

  app.get('/api/agents/:id/memories/:userId', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const mem = (db.data.user_memories || []).find(m => m.agent_id === agent.id && m.id === req.params.userId);
    if (!mem) return res.status(404).json({ error: 'Memory not found' });
    res.json(mem);
  });

  app.delete('/api/agents/:id/memories/:userId', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!db.data.user_memories) db.data.user_memories = [];
    db.data.user_memories = db.data.user_memories.filter(m => !(m.agent_id === agent.id && m.id === req.params.userId));
    save();
    res.json({ success: true });
  });

  app.delete('/api/agents/:id/memories', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!db.data.user_memories) db.data.user_memories = [];
    db.data.user_memories = db.data.user_memories.filter(m => m.agent_id !== agent.id);
    save();
    res.json({ success: true });
  });

  // ─── Embed Public Endpoints ───────────────────────────────────────────────

  // GET /api/embed/:token/info — public, no auth
  app.get('/api/embed/:token/info', (req, res) => {
    const agent = db.data.agents.find(a => a.embed_token === req.params.token && a.deployed_embed_enabled && a.is_active);
    if (!agent) return res.status(404).json({ error: 'Widget not found or disabled' });
    res.json({ name: agent.name, description: agent.description, emoji: agent.emoji });
  });

  // POST /api/embed/:token/chat — public, no auth
  app.post('/api/embed/:token/chat', async (req, res) => {
    const agent = db.data.agents.find(a => a.embed_token === req.params.token && a.deployed_embed_enabled && a.is_active);
    if (!agent) return res.status(404).json({ error: 'Widget not found or disabled' });

    const { message, conversationId } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    let convId = conversationId;
    if (!convId) {
      convId = randomUUID();
      db.data.conversations.push({ id: convId, agent_id: agent.id, user_id: undefined, channel: 'web', message_count: 0, created_at: new Date().toISOString() });
    }

    const history = db.data.messages.filter(m => m.conversation_id === convId).map(m => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: message });

    const startTime = Date.now();
    try {
      const embedUserId = `embed_${conversationId || convId}`;
      const embedMemoryContext = buildMemoryContext(agent.id, embedUserId, 'web');
      const embedKnowledgeContext = buildKnowledgeContext(agent.id, message);
      const embedBasePrompt = embedKnowledgeContext ? `${embedKnowledgeContext}\n\n${agent.system_prompt}` : agent.system_prompt;
      const embedSystemPrompt = embedMemoryContext ? `${embedMemoryContext}\n\n${embedBasePrompt}` : embedBasePrompt;
      const { text: content, tokensUsed } = await callAI(agent.provider, agent.model, embedSystemPrompt, history, 1024);
      const latency_ms = Date.now() - startTime;
      db.data.messages.push({ id: randomUUID(), conversation_id: convId, role: 'user', content: message, created_at: new Date().toISOString() });
      db.data.messages.push({ id: randomUUID(), conversation_id: convId, role: 'assistant', content, model_used: agent.model, created_at: new Date().toISOString() });
      agent.total_messages++;
      save();
      extractAndUpdateMemory(agent.id, embedUserId, 'web', [...history, { role: 'assistant', content }], agent.system_prompt).catch(() => {});
      logActivity({ user_id: agent.user_id, agent_id: agent.id, agent_name: agent.name, event_type: 'message_sent', channel: 'web', summary: 'Replied via web embed widget', details: content.slice(0, 200), model_used: agent.model, tokens_used: tokensUsed, latency_ms, status: 'success' });
      res.json({ content, conversationId: convId });
    } catch (e: any) {
      logActivity({ user_id: agent.user_id, agent_id: agent.id, agent_name: agent.name, event_type: 'error', channel: 'web', summary: 'Embed chat error', status: 'error', error_message: e?.message });
      res.status(500).json({ error: e?.message || 'AI call failed' });
    }
  });

  // PATCH /api/agents/:id/embed — auth required — toggle embed on/off
  app.patch('/api/agents/:id/embed', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { deployed_embed_enabled } = req.body;
    if (typeof deployed_embed_enabled === 'boolean') {
      agent.deployed_embed_enabled = deployed_embed_enabled;
    } else {
      agent.deployed_embed_enabled = !agent.deployed_embed_enabled;
    }
    agent.updated_at = new Date().toISOString();
    save();
    res.json(agent);
  });

  // ─── Knowledge Base Routes ────────────────────────────────────────────────

  // GET /api/agents/:id/knowledge
  app.get('/api/agents/:id/knowledge', auth, (req: any, res) => {
    if (!db.data.knowledge_sources) db.data.knowledge_sources = [];
    const agent = db.data.agents.find(a => a.id === req.params.id && a.user_id === req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const sources = db.data.knowledge_sources.filter(s => s.agent_id === req.params.id);
    const totalChars = sources.reduce((sum, s) => sum + s.char_count, 0);
    res.json({ sources, totalChars, limit: 50000 });
  });

  // POST /api/agents/:id/knowledge
  app.post('/api/agents/:id/knowledge', auth, async (req: any, res) => {
    if (!db.data.knowledge_sources) db.data.knowledge_sources = [];
    const agent = db.data.agents.find(a => a.id === req.params.id && a.user_id === req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const { name, type, content } = req.body;
    if (!name || !type || !content) return res.status(400).json({ error: 'name, type, and content are required' });
    if (!['text', 'url', 'faq'].includes(type)) return res.status(400).json({ error: 'type must be text, url, or faq' });

    // Check total char limit
    const existingSources = db.data.knowledge_sources.filter(s => s.agent_id === req.params.id);
    const existingChars = existingSources.reduce((sum, s) => sum + s.char_count, 0);

    const sourceId = randomUUID();
    const now = new Date().toISOString();

    // Create placeholder
    const newSource: KnowledgeSource = {
      id: sourceId,
      agent_id: req.params.id,
      user_id: req.userId,
      name,
      type,
      content: '',
      chunks: [],
      status: 'processing',
      char_count: 0,
      chunk_count: 0,
      created_at: now,
      updated_at: now,
    };
    db.data.knowledge_sources.push(newSource);
    save();
    res.json(newSource);

    // Process async
    (async () => {
      try {
        let textContent = content;

        if (type === 'url') {
          const resp = await fetch(content, { signal: AbortSignal.timeout(15000) });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const html = await resp.text();
          textContent = stripHtml(html);
        }

        if (textContent.length > 100000) textContent = textContent.slice(0, 100000);

        // Check limit
        if (existingChars + textContent.length > 50000) {
          const allowed = 50000 - existingChars;
          if (allowed <= 0) throw new Error('Knowledge base limit reached (50,000 characters)');
          textContent = textContent.slice(0, allowed);
        }

        const chunks = chunkText(textContent, 500, 50);
        const src = db.data.knowledge_sources.find(s => s.id === sourceId);
        if (src) {
          src.content = textContent;
          src.chunks = chunks;
          src.status = 'ready';
          src.char_count = textContent.length;
          src.chunk_count = chunks.length;
          src.updated_at = new Date().toISOString();
          save();
        }
      } catch (err: any) {
        const src = db.data.knowledge_sources.find(s => s.id === sourceId);
        if (src) {
          src.status = 'error';
          src.error_message = err.message || 'Processing failed';
          src.updated_at = new Date().toISOString();
          save();
        }
      }
    })();
  });

  // DELETE /api/agents/:id/knowledge/:sourceId
  app.delete('/api/agents/:id/knowledge/:sourceId', auth, (req: any, res) => {
    if (!db.data.knowledge_sources) db.data.knowledge_sources = [];
    const agent = db.data.agents.find(a => a.id === req.params.id && a.user_id === req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const idx = db.data.knowledge_sources.findIndex(s => s.id === req.params.sourceId && s.agent_id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Source not found' });
    db.data.knowledge_sources.splice(idx, 1);
    save();
    res.json({ success: true });
  });

  // POST /api/agents/:id/knowledge/search
  app.post('/api/agents/:id/knowledge/search', auth, (req: any, res) => {
    if (!db.data.knowledge_sources) db.data.knowledge_sources = [];
    const agent = db.data.agents.find(a => a.id === req.params.id && a.user_id === req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    const sources = db.data.knowledge_sources.filter(s => s.agent_id === req.params.id && s.status === 'ready');
    const queryWords = query.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);

    const allChunks: { text: string; score: number; sourceName: string }[] = [];
    for (const source of sources) {
      for (const chunk of source.chunks) {
        const chunkLower = chunk.toLowerCase();
        const score = queryWords.reduce((s: number, word: string) => {
          const count = (chunkLower.match(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
          return s + count;
        }, 0);
        if (score > 0) allChunks.push({ text: chunk, score, sourceName: source.name });
      }
    }

    const results = allChunks.sort((a, b) => b.score - a.score).slice(0, 3);
    res.json({ results, queryWords });
  });

  // ─── Automation Routes ────────────────────────────────────────────────────

  // GET /api/automations
  app.get('/api/automations', auth, (req: any, res) => {
    if (!db.data.automations) db.data.automations = [];
    if (!db.data.automation_runs) db.data.automation_runs = [];
    const automations = db.data.automations.filter(a => a.user_id === req.userId);
    const today = new Date().toISOString().split('T')[0];
    const result = automations.map(a => {
      const runs = db.data.automation_runs.filter(r => r.automation_id === a.id);
      const todayRuns = runs.filter(r => r.started_at.startsWith(today));
      const agent = db.data.agents.find(ag => ag.id === a.agent_id);
      return { ...a, agent_name: agent?.name || 'Unknown', runs_today: todayRuns.length, total_runs: runs.length };
    });
    res.json(result);
  });

  // POST /api/automations
  app.post('/api/automations', auth, (req: any, res) => {
    if (!db.data.automations) db.data.automations = [];
    const { name, description, agent_id, trigger_type, trigger_config, action_type, action_config } = req.body;
    if (!name || !agent_id || !action_type || !action_config) return res.status(400).json({ error: 'Missing required fields' });
    const agent = findAgent(agent_id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const now = new Date().toISOString();
    const next_run_at = trigger_type === 'schedule' && trigger_config?.cron
      ? getNextRunAt(trigger_config.cron, trigger_config.timezone)
      : undefined;
    const automation: Automation = {
      id: randomUUID(), user_id: req.userId, agent_id, name,
      description, trigger_type: trigger_type || 'manual',
      trigger_config: trigger_config || {},
      action_type, action_config,
      is_active: true, run_count: 0,
      next_run_at, created_at: now, updated_at: now,
    };
    db.data.automations.push(automation);
    save();
    res.json(automation);
  });

  // GET /api/automations/:id
  app.get('/api/automations/:id', auth, (req: any, res) => {
    if (!db.data.automations) return res.status(404).json({ error: 'Not found' });
    const automation = db.data.automations.find(a => a.id === req.params.id && a.user_id === req.userId);
    if (!automation) return res.status(404).json({ error: 'Automation not found' });
    res.json(automation);
  });

  // PATCH /api/automations/:id
  app.patch('/api/automations/:id', auth, async (req: any, res) => {
    if (!db.data.automations) return res.status(404).json({ error: 'Not found' });
    const automation = db.data.automations.find(a => a.id === req.params.id && a.user_id === req.userId);
    if (!automation) return res.status(404).json({ error: 'Automation not found' });
    const { name, description, agent_id, trigger_type, trigger_config, action_type, action_config } = req.body;
    if (name !== undefined) automation.name = name;
    if (description !== undefined) automation.description = description;
    if (agent_id !== undefined) automation.agent_id = agent_id;
    if (trigger_type !== undefined) automation.trigger_type = trigger_type;
    if (trigger_config !== undefined) automation.trigger_config = trigger_config;
    if (action_type !== undefined) automation.action_type = action_type;
    if (action_config !== undefined) automation.action_config = action_config;
    if (automation.trigger_type === 'schedule' && automation.trigger_config?.cron) {
      automation.next_run_at = getNextRunAt(automation.trigger_config.cron, automation.trigger_config.timezone);
    }
    automation.updated_at = new Date().toISOString();
    save();
    res.json(automation);
  });

  // DELETE /api/automations/:id
  app.delete('/api/automations/:id', auth, (req: any, res) => {
    if (!db.data.automations) return res.status(404).json({ error: 'Not found' });
    const idx = db.data.automations.findIndex(a => a.id === req.params.id && a.user_id === req.userId);
    if (idx === -1) return res.status(404).json({ error: 'Automation not found' });
    db.data.automations.splice(idx, 1);
    if (db.data.automation_runs) {
      db.data.automation_runs = db.data.automation_runs.filter(r => r.automation_id !== req.params.id);
    }
    save();
    res.json({ success: true });
  });

  // PATCH /api/automations/:id/toggle
  app.patch('/api/automations/:id/toggle', auth, (req: any, res) => {
    if (!db.data.automations) return res.status(404).json({ error: 'Not found' });
    const automation = db.data.automations.find(a => a.id === req.params.id && a.user_id === req.userId);
    if (!automation) return res.status(404).json({ error: 'Automation not found' });
    automation.is_active = !automation.is_active;
    if (automation.is_active && automation.trigger_type === 'schedule' && automation.trigger_config?.cron) {
      automation.next_run_at = getNextRunAt(automation.trigger_config.cron, automation.trigger_config.timezone);
    }
    automation.updated_at = new Date().toISOString();
    save();
    res.json(automation);
  });

  // POST /api/automations/:id/run — manual trigger
  app.post('/api/automations/:id/run', auth, async (req: any, res) => {
    if (!db.data.automations) return res.status(404).json({ error: 'Not found' });
    const automation = db.data.automations.find(a => a.id === req.params.id && a.user_id === req.userId);
    if (!automation) return res.status(404).json({ error: 'Automation not found' });
    try {
      const run = await executeAutomation(automation);
      res.json(run);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Run failed' });
    }
  });

  // GET /api/automations/:id/runs
  app.get('/api/automations/:id/runs', auth, (req: any, res) => {
    if (!db.data.automation_runs) return res.json([]);
    const automation = db.data.automations?.find(a => a.id === req.params.id && a.user_id === req.userId);
    if (!automation) return res.status(404).json({ error: 'Automation not found' });
    const runs = db.data.automation_runs
      .filter(r => r.automation_id === req.params.id)
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .slice(0, 50);
    res.json(runs);
  });

  // ─── Team Task Helpers ────────────────────────────────────────────────────

  async function runTeamTask(taskId: string) {
    if (!db.data.team_tasks) db.data.team_tasks = [];
    if (!db.data.team_task_logs) db.data.team_task_logs = [];

    const task = db.data.team_tasks.find(t => t.id === taskId);
    if (!task) return;

    const appendLog = (agentId: string, role: 'orchestrator' | 'specialist', action: TeamTaskLog['action'], content: string) => {
      const log: TeamTaskLog = { id: randomUUID(), task_id: taskId, agent_id: agentId, role, action, content, created_at: new Date().toISOString() };
      db.data.team_task_logs.push(log);
      save();
    };

    const markError = (msg: string) => {
      task.status = 'error';
      task.error_message = msg;
      task.updated_at = new Date().toISOString();
      save();
    };

    try {
      const team = db.data.agent_teams?.find(t => t.id === task.team_id);
      if (!team) { markError('Team not found'); return; }

      const orchestrator = db.data.agents.find(a => a.id === team.orchestrator_agent_id && a.is_active);
      if (!orchestrator) { markError('Orchestrator agent not found'); return; }

      const members = team.member_agent_ids
        .map(id => db.data.agents.find(a => a.id === id && a.is_active))
        .filter(Boolean) as Agent[];

      const memberList = members.map(a => `- ${a.name} (id: ${a.id}): ${a.description || a.system_prompt.slice(0, 100)}`).join('\n');

      // Step 1: Orchestrator creates plan
      const planPrompt = `You are an orchestrator managing a team of AI specialists.

Team: "${team.name}"
${team.description ? `Description: ${team.description}` : ''}

Available specialists:
${memberList}

Task Title: ${task.title}
Instructions: ${task.instructions}

Your job: Break this task into subtasks and assign each to the most appropriate specialist.
Return ONLY a valid JSON array (no markdown, no extra text), like:
[
  { "agent_id": "...", "agent_name": "...", "objective": "..." },
  ...
]
Each agent_id must be from the list above. Be specific about each objective.`;

      const planResult = await callAI(orchestrator.provider, orchestrator.model, orchestrator.system_prompt, [{ role: 'user', content: planPrompt }], 1024);
      appendLog(orchestrator.id, 'orchestrator', 'plan', planResult.text);

      let plan: { agent_id: string; agent_name: string; objective: string }[] = [];
      try {
        const cleaned = planResult.text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        plan = JSON.parse(cleaned);
        if (!Array.isArray(plan)) throw new Error('Not array');
      } catch {
        markError('Orchestrator did not return a valid plan JSON');
        appendLog(orchestrator.id, 'orchestrator', 'error', 'Failed to parse plan JSON: ' + planResult.text.slice(0, 500));
        return;
      }

      task.orchestrator_plan = JSON.stringify(plan);
      task.updated_at = new Date().toISOString();
      save();

      // Step 2: Delegate and execute each subtask
      const specialistOutputs: { agentName: string; objective: string; result: string }[] = [];

      for (const step of plan) {
        const specialist = members.find(a => a.id === step.agent_id);
        if (!specialist) {
          appendLog(step.agent_id || 'unknown', 'specialist', 'error', `Agent not found: ${step.agent_id}`);
          continue;
        }

        appendLog(orchestrator.id, 'orchestrator', 'delegate', `Delegating to ${specialist.name}: ${step.objective}`);

        try {
          const workResult = await callAI(
            specialist.provider,
            specialist.model,
            specialist.system_prompt,
            [{ role: 'user', content: step.objective }],
            1024
          );
          appendLog(specialist.id, 'specialist', 'work', workResult.text);
          appendLog(specialist.id, 'specialist', 'handoff', `Completed: ${step.objective}`);
          specialistOutputs.push({ agentName: specialist.name, objective: step.objective, result: workResult.text });
        } catch (e: any) {
          appendLog(specialist.id, 'specialist', 'error', `Error: ${e?.message || 'Unknown error'}`);
          specialistOutputs.push({ agentName: specialist.name, objective: step.objective, result: `Error: ${e?.message}` });
        }
      }

      // Step 3: Orchestrator summarizes
      const summaryInput = specialistOutputs.map(o =>
        `${o.agentName} worked on: "${o.objective}"\nResult: ${o.result}`
      ).join('\n\n---\n\n');

      const summaryPrompt = `You orchestrated a team to complete the following task:
Title: ${task.title}
Instructions: ${task.instructions}

Here are the specialists' outputs:
${summaryInput}

Now write a comprehensive final summary of what was accomplished, combining all results into a cohesive response for the user.`;

      const summaryResult = await callAI(orchestrator.provider, orchestrator.model, orchestrator.system_prompt, [{ role: 'user', content: summaryPrompt }], 1500);
      appendLog(orchestrator.id, 'orchestrator', 'summary', summaryResult.text);

      task.result_summary = summaryResult.text;
      task.status = 'success';
      task.updated_at = new Date().toISOString();
      save();

      const user = findUser(task.user_id);
      logActivity({
        user_id: task.user_id,
        agent_id: orchestrator.id,
        agent_name: orchestrator.name,
        event_type: 'command_executed',
        channel: 'system',
        summary: `Team "${team.name}" ran task "${task.title}"`,
        details: `Status: success. ${plan.length} subtask(s) completed.`,
        status: 'success',
      });
      if (user) { user.messages_today = (user.messages_today || 0) + plan.length + 2; save(); }

    } catch (e: any) {
      markError(e?.message || 'Unknown error');
      const team = db.data.agent_teams?.find(t => t.id === task.team_id);
      const orchestrator = team ? db.data.agents.find(a => a.id === team.orchestrator_agent_id) : null;
      if (orchestrator) appendLog(orchestrator.id, 'orchestrator', 'error', e?.message || 'Unknown error');
      logActivity({
        user_id: task.user_id,
        agent_id: orchestrator?.id || 'unknown',
        agent_name: orchestrator?.name || 'Orchestrator',
        event_type: 'command_executed',
        channel: 'system',
        summary: `Team "${team?.name || ''}" task "${task.title}" failed`,
        details: e?.message || 'Unknown error',
        status: 'error',
        error_message: e?.message,
      });
    }
  }

  // ─── Teams API ────────────────────────────────────────────────────────────

  // GET /api/teams
  app.get('/api/teams', auth, (req: any, res) => {
    if (!db.data.agent_teams) db.data.agent_teams = [];
    const teams = db.data.agent_teams.filter(t => t.user_id === req.userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    // Enrich with member info
    const enriched = teams.map(team => {
      const members = team.member_agent_ids.map(id => db.data.agents.find(a => a.id === id && a.is_active)).filter(Boolean);
      const orchestrator = db.data.agents.find(a => a.id === team.orchestrator_agent_id);
      const lastTasks = (db.data.team_tasks || []).filter(t => t.team_id === team.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 1);
      return { ...team, members, orchestrator, lastTask: lastTasks[0] || null };
    });
    res.json(enriched);
  });

  // POST /api/teams
  app.post('/api/teams', auth, (req: any, res) => {
    if (!db.data.agent_teams) db.data.agent_teams = [];
    const { name, description, orchestrator_agent_id, member_agent_ids } = req.body;
    if (!name || !orchestrator_agent_id || !Array.isArray(member_agent_ids)) {
      return res.status(400).json({ error: 'name, orchestrator_agent_id, and member_agent_ids are required' });
    }
    const now = new Date().toISOString();
    const team: AgentTeam = {
      id: randomUUID(), user_id: req.userId, name, description,
      orchestrator_agent_id, member_agent_ids, created_at: now, updated_at: now,
    };
    db.data.agent_teams.push(team);
    save();
    res.status(201).json(team);
  });

  // GET /api/teams/:id
  app.get('/api/teams/:id', auth, (req: any, res) => {
    if (!db.data.agent_teams) return res.status(404).json({ error: 'Not found' });
    const team = db.data.agent_teams.find(t => t.id === req.params.id && t.user_id === req.userId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const members = team.member_agent_ids.map(id => db.data.agents.find(a => a.id === id && a.is_active)).filter(Boolean);
    const orchestrator = db.data.agents.find(a => a.id === team.orchestrator_agent_id);
    const lastTasks = (db.data.team_tasks || []).filter(t => t.team_id === team.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
    res.json({ ...team, members, orchestrator, lastTasks });
  });

  // PATCH /api/teams/:id
  app.patch('/api/teams/:id', auth, (req: any, res) => {
    if (!db.data.agent_teams) return res.status(404).json({ error: 'Not found' });
    const team = db.data.agent_teams.find(t => t.id === req.params.id && t.user_id === req.userId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const { name, description, orchestrator_agent_id, member_agent_ids } = req.body;
    if (name !== undefined) team.name = name;
    if (description !== undefined) team.description = description;
    if (orchestrator_agent_id !== undefined) team.orchestrator_agent_id = orchestrator_agent_id;
    if (Array.isArray(member_agent_ids)) team.member_agent_ids = member_agent_ids;
    team.updated_at = new Date().toISOString();
    save();
    res.json(team);
  });

  // DELETE /api/teams/:id
  app.delete('/api/teams/:id', auth, (req: any, res) => {
    if (!db.data.agent_teams) return res.status(404).json({ error: 'Not found' });
    const idx = db.data.agent_teams.findIndex(t => t.id === req.params.id && t.user_id === req.userId);
    if (idx === -1) return res.status(404).json({ error: 'Team not found' });
    db.data.agent_teams.splice(idx, 1);
    save();
    res.json({ success: true });
  });

  // POST /api/teams/:id/tasks — create & run async
  app.post('/api/teams/:id/tasks', auth, async (req: any, res) => {
    if (!db.data.agent_teams) return res.status(404).json({ error: 'Team not found' });
    const team = db.data.agent_teams.find(t => t.id === req.params.id && t.user_id === req.userId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const { title, instructions } = req.body;
    if (!title || !instructions) return res.status(400).json({ error: 'title and instructions are required' });
    if (!db.data.team_tasks) db.data.team_tasks = [];
    const now = new Date().toISOString();
    const task: TeamTask = {
      id: randomUUID(), team_id: team.id, user_id: req.userId,
      title, instructions, status: 'running',
      created_at: now, updated_at: now,
    };
    db.data.team_tasks.push(task);
    save();
    setTimeout(() => runTeamTask(task.id), 10);
    res.status(201).json(task);
  });

  // GET /api/team-tasks
  app.get('/api/team-tasks', auth, (req: any, res) => {
    if (!db.data.team_tasks) return res.json([]);
    let tasks = db.data.team_tasks.filter(t => t.user_id === req.userId);
    if (req.query.team_id) tasks = tasks.filter(t => t.team_id === req.query.team_id);
    if (req.query.status) tasks = tasks.filter(t => t.status === req.query.status);
    tasks = tasks.sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(tasks);
  });

  // GET /api/team-tasks/:id
  app.get('/api/team-tasks/:id', auth, (req: any, res) => {
    if (!db.data.team_tasks) return res.status(404).json({ error: 'Not found' });
    const task = db.data.team_tasks.find(t => t.id === req.params.id && t.user_id === req.userId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const logs = (db.data.team_task_logs || []).filter(l => l.task_id === task.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const logsWithAgent = logs.map(l => ({ ...l, agent: db.data.agents.find(a => a.id === l.agent_id) }));
    res.json({ ...task, logs: logsWithAgent });
  });

  // POST /api/team-tasks/:id/run — rerun
  app.post('/api/team-tasks/:id/run', auth, async (req: any, res) => {
    if (!db.data.team_tasks) return res.status(404).json({ error: 'Not found' });
    const task = db.data.team_tasks.find(t => t.id === req.params.id && t.user_id === req.userId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    // Reset task state
    task.status = 'running';
    task.orchestrator_plan = undefined;
    task.result_summary = undefined;
    task.error_message = undefined;
    task.updated_at = new Date().toISOString();
    // Clear old logs
    if (db.data.team_task_logs) {
      db.data.team_task_logs = db.data.team_task_logs.filter(l => l.task_id !== task.id);
    }
    save();
    setTimeout(() => runTeamTask(task.id), 10);
    res.json(task);
  });

  // ─── Lead CRM Endpoints ───────────────────────────────────────────────────

  // GET /api/leads/stats
  app.get('/api/leads/stats', auth, (req: any, res) => {
    if (!db.data.leads) return res.json({ total: 0, byStage: {}, totalValue: 0, newThisWeek: 0 });
    const leads = db.data.leads.filter(l => l.user_id === req.userId);
    const byStage: Record<string, number> = {
      new: 0, contacted: 0, qualified: 0, proposal: 0, closed_won: 0, closed_lost: 0,
    };
    let totalValue = 0;
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let newThisWeek = 0;
    for (const l of leads) {
      byStage[l.stage] = (byStage[l.stage] || 0) + 1;
      if (l.value) totalValue += l.value;
      if (l.created_at >= oneWeekAgo) newThisWeek++;
    }
    res.json({ total: leads.length, byStage, totalValue, newThisWeek });
  });

  // GET /api/leads
  app.get('/api/leads', auth, (req: any, res) => {
    if (!db.data.leads) return res.json({ leads: [], total: 0 });
    let leads = db.data.leads.filter(l => l.user_id === req.userId);
    const { stage, agentId, search, limit = '50', offset = '0' } = req.query as any;
    if (stage) leads = leads.filter(l => l.stage === stage);
    if (agentId) leads = leads.filter(l => l.agent_id === agentId);
    if (search) {
      const q = search.toLowerCase();
      leads = leads.filter(l =>
        l.display_name?.toLowerCase().includes(q) ||
        l.identifier.toLowerCase().includes(q) ||
        l.notes.toLowerCase().includes(q) ||
        l.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    leads = leads.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const total = leads.length;
    const paged = leads.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    res.json({ leads: paged, total, offset: parseInt(offset), limit: parseInt(limit) });
  });

  // GET /api/leads/:id
  app.get('/api/leads/:id', auth, (req: any, res) => {
    if (!db.data.leads) return res.status(404).json({ error: 'Not found' });
    const lead = db.data.leads.find(l => l.id === req.params.id && l.user_id === req.userId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const agent = db.data.agents.find(a => a.id === lead.agent_id);
    const memory = db.data.user_memories?.find(m => m.agent_id === lead.agent_id && m.user_identifier === lead.identifier);
    res.json({ ...lead, agent, memory });
  });

  // POST /api/leads
  app.post('/api/leads', auth, (req: any, res) => {
    if (!db.data.leads) db.data.leads = [];
    const { agent_id, identifier, channel, display_name, email, phone, stage, tags, notes, value } = req.body;
    if (!agent_id || !identifier || !channel) return res.status(400).json({ error: 'agent_id, identifier, channel required' });
    const agent = db.data.agents.find(a => a.id === agent_id && a.user_id === req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const now = new Date().toISOString();
    const lead: Lead = {
      id: randomUUID(),
      user_id: req.userId,
      agent_id,
      agent_name: agent.name,
      identifier,
      channel,
      display_name,
      email,
      phone,
      stage: stage || 'new',
      tags: tags || [],
      notes: notes || '',
      message_count: 0,
      last_contact: now,
      first_contact: now,
      value,
      created_at: now,
      updated_at: now,
    };
    db.data.leads.push(lead);
    save();
    res.status(201).json(lead);
  });

  // PATCH /api/leads/:id
  app.patch('/api/leads/:id', auth, (req: any, res) => {
    if (!db.data.leads) return res.status(404).json({ error: 'Not found' });
    const lead = db.data.leads.find(l => l.id === req.params.id && l.user_id === req.userId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const { stage, display_name, email, phone, value, tags, notes } = req.body;
    if (stage && stage !== lead.stage) {
      const dateStr = new Date().toISOString().split('T')[0];
      lead.notes = (lead.notes || '') + `\n[${dateStr}] Stage: ${lead.stage} → ${stage}`;
      lead.stage = stage;
    }
    if (display_name !== undefined) lead.display_name = display_name;
    if (email !== undefined) lead.email = email;
    if (phone !== undefined) lead.phone = phone;
    if (value !== undefined) lead.value = value;
    if (tags !== undefined) lead.tags = tags;
    if (notes !== undefined) lead.notes = notes;
    lead.updated_at = new Date().toISOString();
    save();
    res.json(lead);
  });

  // DELETE /api/leads/:id
  app.delete('/api/leads/:id', auth, (req: any, res) => {
    if (!db.data.leads) return res.status(404).json({ error: 'Not found' });
    const idx = db.data.leads.findIndex(l => l.id === req.params.id && l.user_id === req.userId);
    if (idx === -1) return res.status(404).json({ error: 'Lead not found' });
    db.data.leads.splice(idx, 1);
    save();
    res.json({ ok: true });
  });

  // POST /api/leads/:id/note
  app.post('/api/leads/:id/note', auth, (req: any, res) => {
    if (!db.data.leads) return res.status(404).json({ error: 'Not found' });
    const lead = db.data.leads.find(l => l.id === req.params.id && l.user_id === req.userId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const { note } = req.body;
    if (!note) return res.status(400).json({ error: 'note required' });
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 16);
    lead.notes = (lead.notes ? lead.notes + '\n' : '') + `[${ts}] ${note}`;
    lead.updated_at = new Date().toISOString();
    save();
    res.json(lead);
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
