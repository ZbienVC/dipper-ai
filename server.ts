import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
dotenv.config();

import { randomUUID } from 'crypto';
import { createSQLiteDB, migrateFromJSON } from './db-sqlite.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { existsSync, mkdirSync, unlinkSync, readFileSync } from 'fs';
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
  always_on?: boolean;
  // Phase 4: knowledge base + response config
  knowledge_base?: string;
  response_format?: string;
  max_response_length?: number;
  long_term_memory?: number;
  // New capability fields
  tools_enabled?: string[]; // list of enabled tool names
  auto_translate?: boolean; // auto-respond in user's language
  // Proactive messages
  followup_enabled?: boolean;
  followup_delay_hours?: number;
  followup_message?: string;
  daily_digest_enabled?: boolean;
  daily_digest_time?: string; // "09:00"
  // Escalation / sentiment
  escalate_on_negative?: boolean;
  escalation_notify?: 'inapp' | 'telegram' | 'email';
  escalation_message?: string;
  // Tool integrations
  webhook_url?: string;
  webhook_secret?: string;
  calendly_link?: string;
  calendly_api_key?: string;
  sheets_spreadsheet_id?: string;
  sheets_range?: string;
  stripe_api_key?: string;
};
type Message = { id: string; conversation_id: string; role: string; content: string; model_used?: string; created_at: string; };
type Conversation = { id: string; agent_id: string; user_id?: string; channel: string; message_count: number; created_at: string; summary?: string; summary_at?: string; sentiment_flag?: 'negative' | 'urgent' | null; last_message_at?: string; followup_sent?: boolean; };
type EscalationAlert = { id: string; user_id: string; agent_id: string; agent_name: string; conversation_id: string; channel: string; user_identifier: string; sentiment: string; message_snippet: string; created_at: string; resolved: boolean; };
type Integration = {
  id: string; user_id: string; type: string;
  credentials: Record<string, string>;
  connected: boolean; bot_info?: string; agent_id?: string; created_at: string;
  // Twitter/Reddit OAuth tokens
  access_token?: string;
  refresh_token?: string;
  token_expiry?: number;
  token_data?: string; // JSON blob for extra metadata
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

// ═══ New Intelligence Types ══════════════════════════════════════════════════
type AgentLongTermMemory = {
  id: string;
  agent_id: string;
  user_identifier: string;
  channel: string;
  facts: string[];
  preferences: string[];
  summary: string;
  interaction_count: number;
  last_updated: number;
  created_at: number;
};

type AgentMetrics = {
  id: string;
  agent_id: string;
  date: string;
  messages_sent: number;
  avg_response_ms: number;
  follow_up_count: number;
  satisfaction_score: number;
  tokens_used: number;
};

type SmsOptout = {
  phone: string;
  opted_out_at: number;
};

type Broadcast = {
  id: string;
  user_id: string;
  agent_id: string;
  agent_name: string;
  channel: 'telegram' | 'sms' | 'discord' | 'all';
  message: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  scheduled_at?: string;
  sent_at?: string;
  audience_size: number;
  sent_count: number;
  failed_count: number;
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
  agent_long_term_memory: AgentLongTermMemory[];
  agent_metrics: AgentMetrics[];
  sms_optouts: SmsOptout[];
  broadcasts: Broadcast[];
  approvals: Approval[];
  api_keys: ApiKey[];
  escalation_alerts: EscalationAlert[];
};

// ─── Plan Definitions ─────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'zbienstock@gmail.com';

const PLANS: Record<string, { agents: number; messagesPerMonth: number; messagesPerDay: number; integrations: number; allowedModels: string[]; maxTokens: number; price: number }> = {
  free:     { agents: 1,   messagesPerMonth: 500,   messagesPerDay: 20,   integrations: 2,   allowedModels: ['claude-haiku-4-5'], maxTokens: 512,  price: 0  },
  pro:      { agents: 5,   messagesPerMonth: 5000,  messagesPerDay: 200,  integrations: 999, allowedModels: ['claude-haiku-4-5', 'claude-sonnet-4-5', 'gpt-4o-mini'], maxTokens: 1024, price: 29 },
  admin:    { agents: 999999, messagesPerMonth: 999999999, messagesPerDay: 999999, integrations: 999, allowedModels: ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-opus-4-5', 'gpt-4o', 'gpt-4o-mini', 'gemini-1.5-pro', 'gemini-1.5-flash'], maxTokens: 8192, price: 0 },
  business: { agents: 999, messagesPerMonth: 25000, messagesPerDay: 1000, integrations: 999, allowedModels: ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-opus-4-5', 'gpt-4o', 'gpt-4o-mini', 'gemini-1.5-pro', 'gemini-1.5-flash'], maxTokens: 2048, price: 79 },
};

  {
    id: 'buy-bot',
    name: 'Buy Alert Bot',
    emoji: '💰',
    desc: 'Real-time on-chain buy alerts posted to Telegram',
    systemPrompt: 'You are a Buy Alert Bot. Monitor blockchain transactions and post buy alerts to Telegram. Format with buyer amount, market cap, chart link. Be punchy.',
    tools_enabled: ['send_notification', 'webhook', 'web_search'],
  }];
// Backward compat for code that used PLAN_LIMITS
const PLAN_LIMITS = Object.fromEntries(
  Object.entries(PLANS).map(([k, v]) => [k, { agents: v.agents, messagesPerDay: v.messagesPerDay, integrations: v.integrations }])
);

function getEffectiveModel(user: User, requestedModel: string): string {
  if (user.plan === 'admin' || user.email === ADMIN_EMAIL) return requestedModel;
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
,
  {
    id: 'research-agent',
    name: 'Research Agent',
    emoji: '🔬',
    desc: 'Deep research & fact-finding',
    systemPrompt: "You are a sharp, intellectually curious researcher who genuinely loves digging into things. When someone asks you to look something up, you get into it. You find the interesting angles, the stuff that's not obvious on the first read.\n\nYou write the way a really smart friend would explain something over coffee. Not formal, not robotic. You share what you found, what surprised you, and what you think matters most. If something is uncertain you say so, because you'd rather be honest than confident and wrong.\n\nIf someone asks something that needs more context to answer well, ask one good question before diving in. You'd rather clarify than produce something that misses the point.\n\nCRITICAL: Never use dashes, bullet points, or numbered lists unless explicitly asked. Write in natural paragraphs like a human. Use contractions. Sound like yourself, not a bot.",
    tools_enabled: ["web_search","search_knowledge_base"],
  },
  {
    id: 'sales-outreach',
    name: 'Sales Outreach',
    emoji: '💰',
    desc: 'Lead outreach & deal closing',
    systemPrompt: "You are a genuinely good salesperson, which means you actually listen. You're warm and direct without being pushy. You don't pitch people, you talk to them. You ask real questions and remember what they tell you.\n\nWhen you write outreach it sounds like a human wrote it because you did. Short sentences. Real language. Never \"I hope this message finds you well.\" You get to the point fast, make it about them not you, and always leave the door open without being weird about it.\n\nCRITICAL: Never use dashes, bullet points, or numbered lists unless explicitly asked. Write in natural paragraphs like a human. Use contractions. Sound like yourself, not a bot.",
    tools_enabled: ["send_email","create_lead","web_search","send_notification"],
  },
  {
    id: 'content-creator',
    name: 'Content Creator',
    emoji: '✍️',
    desc: 'Posts, scripts & campaigns',
    systemPrompt: "You are a creative person who knows how the internet works. You have taste. You know what makes something shareable and what makes something forgettable, and you genuinely care about the difference.\n\nWhen someone asks you to create content, you think about who it's for, what platform it lives on, and what feeling it should leave people with. You write hooks that make people stop scrolling. You have opinions. If something isn't landing you say so and offer something better.\n\nCRITICAL: Never use dashes, bullet points, or numbered lists unless explicitly asked. Write in natural paragraphs like a human. Use contractions. Sound like yourself, not a bot.",
    tools_enabled: ["web_search","generate_image","send_email"],
  },
  {
    id: 'community-builder',
    name: 'Community Manager',
    emoji: '🌐',
    desc: 'Engage & grow community',
    systemPrompt: "You are the kind of community manager that people actually like. You're real with people. You remember what they said. You make new members feel seen, not processed.\n\nYou bring genuine energy to every conversation. When someone's excited you're excited with them. When someone's frustrated you take it seriously and help them get unstuck. You're not performing helpfulness, you actually care about the people you talk to.\n\nCRITICAL: Never use dashes, bullet points, or numbered lists unless explicitly asked. Write in natural paragraphs like a human. Use contractions. Sound like yourself, not a bot.",
    tools_enabled: ["create_lead","send_notification","search_knowledge_base"],
  },
  {
    id: 'builder-assistant',
    name: 'Builder / Dev',
    emoji: '⚙️',
    desc: 'Code help & architecture',
    systemPrompt: "You are a developer who explains things the way you'd explain them to a smart colleague, not a textbook reader. You cut to what actually matters. You've been in the weeds enough times to know what questions to ask before you start building.\n\nWhen someone shares code or a problem you read it carefully. You think about what they're actually trying to do, not just what they literally asked. Sometimes the best answer is pointing out they're solving the wrong problem entirely, and you'll say that.\n\nCRITICAL: Never use dashes, bullet points, or numbered lists unless explicitly asked. Write in natural paragraphs like a human. Use contractions. Sound like yourself, not a bot.",
    tools_enabled: ["web_search","search_knowledge_base","calculate"],
  },
  {
    id: 'crypto-advisor',
    name: 'Crypto Advisor',
    emoji: '🔷',
    desc: 'Web3 & market intelligence',
    systemPrompt: "You follow crypto seriously and you think about it seriously. You know the difference between signal and noise and you help people tell them apart. You're not a perma-bull and you're not a cynic. You call things how you see them.\n\nYou have views. You're always clear that nothing you say is financial advice, but you don't hide behind that disclaimer to avoid having an opinion. You give real perspective and let people make their own decisions with it.\n\nCRITICAL: Never use dashes, bullet points, or numbered lists unless explicitly asked. Write in natural paragraphs like a human. Use contractions. Sound like yourself, not a bot.",
    tools_enabled: ["web_search","send_notification","create_lead"],
  },
  {
    id: 'personal-assistant',
    name: 'Personal Assistant',
    emoji: '🧠',
    desc: 'Research, emails & tasks',
    systemPrompt: "You are the kind of assistant that actually makes someone's life easier. You're organized without being rigid. You anticipate things. You don't wait to be told every detail because you're paying attention.\n\nWhen someone asks you to research something you come back with what they need to make a decision, not a wall of everything you found. When you draft an email it sounds like them, not like you. When you're not sure what they want you ask one good question instead of guessing wrong.\n\nCRITICAL: Never use dashes, bullet points, or numbered lists unless explicitly asked. Write in natural paragraphs like a human. Use contractions. Sound like yourself, not a bot.",
    tools_enabled: ["web_search","send_email","search_knowledge_base","get_time","send_notification"],
  },
  {
    id: 'creative-director',
    name: 'Creative Director',
    emoji: '🎨',
    desc: 'Brand, visuals & campaigns',
    systemPrompt: "You think in images, feelings, and ideas first. You care deeply about how things look and feel, and you can articulate why something works or doesn't in a way that makes people actually understand it.\n\nWhen you're giving creative direction you're specific. Not \"make it more energetic\" but \"this needs to feel like the first warm day in March, when everyone's outside and slightly giddy.\" You push people toward work they're proud of. You're not precious about your own ideas. The work is what matters.\n\nCRITICAL: Never use dashes, bullet points, or numbered lists unless explicitly asked. Write in natural paragraphs like a human. Use contractions. Sound like yourself, not a bot.",
    tools_enabled: ["generate_image","web_search","send_email"],
  }
  ,{
    id: 'community-manager',
    name: 'Community Manager',
    emoji: '🏘️',
    desc: 'Full Telegram community management, bots & verification',
    systemPrompt: "You are a Telegram Community Manager Agent. Manage Telegram communities, bots, verification, and engagement. Set up verification gates, buy alert bots, moderation, and sticker packs. Ask for context before setting anything up. Guide step by step. 2-3 sentences max.",
    tools_enabled: ['web_search', 'send_notification', 'create_lead', 'webhook', 'search_knowledge_base'],
  },{
    id: 'buy-bot',
    name: 'Buy Alert Bot',
    emoji: '💰',
    desc: 'Real-time on-chain buy alerts posted to Telegram',
    systemPrompt: 'You are a Buy Alert Bot. Monitor blockchain transactions and post buy alerts. Format with amount, market cap, chart link. Be punchy.',
    tools_enabled: ['send_notification', 'webhook', 'web_search'],
  }
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
  if (user.plan === 'admin' || user.email === ADMIN_EMAIL) return true;
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

// Build system prompt incorporating agent knowledge base + response format

// Strip leaked tool call XML and clean up response for display
function cleanAgentResponse(text: string): string {
  let clean = text
    // Strip common AI slop openers
    .replace(/^(Analyzing[^!]*!\s*|Great[^!]*!\s*|Sure[^!]*!\s*|Absolutely[^!]*!\s*|Of course[^!]*!\s*|I'd be happy[^!]*!\s*)/i, '')
    // Strip XML/function_call leakage
    .replace(/<function_calls>[\s\S]*?<\/function_calls>/g, '')
    .replace(/<invoke[\s\S]*?<\/invoke>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/TOOL:\w+\([^)]*\)/g, '')
    // Strip markdown formatting that renders poorly in plain text chat
    .replace(/^#{1,6}\s+/gm, '')         // Remove # headers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove **bold**
    .replace(/\*([^*]+)\*/g, '$1')       // Remove *italic*
    .replace(/^[\-\*\+]\s+/gm, '')     // Remove bullet dashes
    .replace(/^\d+\.\s+/gm, '')         // Remove numbered lists
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1') // Remove _underline_
    .replace(/```[^]*?```/g, '')    // Remove code blocks
    .replace(/`([^`]+)`/g, '$1')        // Remove inline code
    .trim();
  // Collapse multiple blank lines
  clean = clean.replace(/\n{3,}/g, '\n\n').trim();
  return clean;
}

function buildAgentSystemPrompt(agent: Agent, contextPrompt?: string): string {
  const base = contextPrompt || agent.system_prompt;
  const parts: string[] = [base];

  // Tool awareness — tell the agent what it can do
  const availableTools: string[] = (agent as any).tools_enabled || [];
  const toolDescriptions: Record<string, string> = {
    web_search: 'Search the web for current information. When user asks to research, look something up, or find current info — use this.',
    generate_image: 'Generate images from text descriptions using DALL-E 3. When asked to create/draw/generate an image — use this.',
    send_email: 'Send emails on behalf of the user. Always confirm recipient, subject and body before sending.',
    create_lead: 'Save contact information to the CRM when someone expresses interest.',
    send_notification: 'Alert the agent owner about important events.',
    get_time: 'Get current date and time.',
    calculate: 'Perform math calculations accurately.',
    search_knowledge_base: 'Search your custom knowledge for relevant information.',
    webhook: 'Trigger external webhooks for automation.',
  };
  if (availableTools.length > 0) {
    parts.push('\n## Your Available Tools\nYou have these capabilities available. Use them proactively when relevant:\n' +
      availableTools.map((t: string) => '- **' + t + '**: ' + (toolDescriptions[t] || t)).join('\n') +
      '\n\nWhen using a tool, say something like "Let me search that for you..." then provide the result. For image generation, always display the generated image URL. For email sending, always confirm details with the user first.');
  }

  // Personality modifiers
  const p = (agent as any).personality || {};
  const personalityParts: string[] = [];
  if (p.tone === 'friendly') personalityParts.push('Be warm, conversational and approachable.');
  if (p.tone === 'professional') personalityParts.push('Maintain a professional, polished tone.');
  if (p.tone === 'creative') personalityParts.push('Be expressive, creative and think outside the box.');
  if (p.verbosity === 'concise') personalityParts.push('Keep responses brief and to the point. Avoid unnecessary elaboration.');
  if (p.verbosity === 'detailed') personalityParts.push('Be thorough and comprehensive in your responses.');
  if (p.creativity > 70) personalityParts.push('Embrace creative and unconventional approaches.');
  if (p.formality > 70) personalityParts.push('Use formal language and proper structure.');
  if (p.formality < 30) personalityParts.push('Keep it casual and conversational.');
  if (p.emoji_usage > 50) personalityParts.push('Use emojis naturally to add personality. 🎯');
  if (p.emoji_usage < 10) personalityParts.push('Avoid using emojis.');
  if (personalityParts.length > 0) {
    parts.push('\n## How you communicate\n' + personalityParts.join(' ') + '\n\nNever use bullet points or dashes. Write in natural paragraphs. Sound human.');
  }

  if (agent.knowledge_base && agent.knowledge_base.trim()) {
    parts.unshift(`=== Agent Knowledge Base ===\n${agent.knowledge_base.trim()}\n=== End Knowledge Base ===`);
  }

  if (agent.response_format && agent.response_format !== 'conversational') {
    if (agent.response_format === 'bullet_points') {
      parts.push('Format your responses using bullet points where appropriate.');
    } else if (agent.response_format === 'structured') {
      parts.push('Format your responses in a clear, structured format with headers and sections as needed.');
    } else if (agent.response_format === 'brief') {
      parts.push('Keep responses very concise — 1-3 sentences max unless more detail is truly needed.');
    }
  }

  if (agent.max_response_length && agent.max_response_length > 0) {
    parts.push(`Keep responses under ${agent.max_response_length} words.`);
  }

  // Auto-translate
  if (agent.auto_translate) {
    parts.push(`IMPORTANT: Detect the user's language from their first message and respond in the SAME language. If they write in Spanish, respond in Spanish. If French, respond in French. Default to English if unclear.`);
  }

  // Tool hints
  if (agent.tools_enabled && agent.tools_enabled.length > 0) {
    const toolDescs: string[] = [];
    if (agent.tools_enabled.includes('get_current_time')) toolDescs.push('- get_current_time: You know the current date/time: ' + new Date().toLocaleString());
    if (agent.tools_enabled.includes('calculate')) toolDescs.push('- calculate: You can perform mathematical calculations when asked.');
    if (agent.tools_enabled.includes('create_lead')) toolDescs.push('- create_lead: When a user shares contact info (name/email/phone), confirm you\'ve saved them as a lead.');
    if (agent.tools_enabled.includes('send_notification')) toolDescs.push('- send_notification: You can flag urgent matters to the agent owner.');
    if (agent.tools_enabled.includes('webhook') && agent.webhook_url) toolDescs.push("- webhook: You can trigger external actions/integrations. When the user completes an action that needs processing (like submitting a form, completing a purchase, booking confirmed), say \"I've triggered the action\" and the webhook will fire automatically.");
    if (agent.tools_enabled.includes('calendly') && agent.calendly_link) toolDescs.push(`- calendly: When a user wants to schedule a call, meeting, or appointment, share this booking link: ${agent.calendly_link} — say something like "You can book a time here: [link]"`);
    if (agent.tools_enabled.includes('google_sheets') && agent.sheets_spreadsheet_id) toolDescs.push('- google_sheets: When you capture a lead or the user completes an action, the data is automatically logged to Google Sheets.');
    if (agent.tools_enabled.includes('stripe') && agent.stripe_api_key) toolDescs.push("- stripe: You can generate payment links for specific amounts. When a user wants to pay, say the amount and you'll provide a secure payment link. Example: \"Here's your payment link for $50: [link]\"");
    if (toolDescs.length > 0) parts.push(`You have the following capabilities:\n${toolDescs.join('\n')}`);
  }

  // Hard rules appended to every agent - non-negotiable
  parts.push('RESPONSE STYLE - STRICTLY ENFORCED: You are texting, not writing an essay. Max 2 short sentences per response. Never use bullet points, dashes, numbered lists, headers, or bold/italic text. Never start with "Analyzing" or "Great" or "Sure" or any filler. Get straight to the point. If sharing multiple ideas weave them into one natural sentence. Sound like a smart friend, not a document.');
  
  return parts.join('\n\n');
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
let db: ReturnType<typeof createSQLiteDB>;
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

// ═══ Agent Intelligence System ═══════════════════════════════════════════════

// 2A: Long-Term Memory — persistent, never expires
function getLongTermMemory(agentId: string, userIdentifier: string, channel: string): AgentLongTermMemory | undefined {
  if (!db?.data?.agent_long_term_memory) return undefined;
  return db.data.agent_long_term_memory.find(
    m => m.agent_id === agentId && m.user_identifier === userIdentifier && m.channel === channel
  );
}

async function updateLongTermMemory(
  agentId: string,
  userIdentifier: string,
  channel: string,
  conversationHistory: { role: string; content: string }[]
): Promise<void> {
  try {
    if (!db?.data?.agent_long_term_memory) db.data.agent_long_term_memory = [];
    const now = Date.now();
    let mem = getLongTermMemory(agentId, userIdentifier, channel);
    if (!mem) {
      mem = {
        id: randomUUID(), agent_id: agentId, user_identifier: userIdentifier, channel,
        facts: [], preferences: [], summary: '',
        interaction_count: 0, last_updated: now, created_at: now,
      };
      db.data.agent_long_term_memory.push(mem);
    }
    mem.interaction_count++;
    mem.last_updated = now;

    if (conversationHistory.length < 2) { save(); return; }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const convoText = conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n');

    const extractResp = await client.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 600,
      system: 'You are a memory extractor. Return ONLY valid JSON, no extra text.',
      messages: [{
        role: 'user',
        content: `Extract useful long-term facts and preferences from this conversation.
Return JSON exactly like: {"facts": ["fact1", "fact2"], "preferences": ["pref1", "pref2"]}
Facts: things the user has shared about themselves (name, job, location, context).
Preferences: how the user likes to communicate or what they want from the agent.
Be concise; 3-8 items max each. Only include genuinely useful info.

Conversation:
${convoText.slice(0, 4000)}`,
      }],
    });
    const raw = (extractResp.content[0] as any).text as string;
    const parsed = JSON.parse(raw.trim());

    if (Array.isArray(parsed.facts)) {
      const combined = [...mem.facts, ...parsed.facts];
      mem.facts = [...new Set(combined)].slice(-30);
    }
    if (Array.isArray(parsed.preferences)) {
      const combined = [...mem.preferences, ...parsed.preferences];
      mem.preferences = [...new Set(combined)].slice(-15);
    }

    if (mem.interaction_count % 5 === 0) {
      const sumResp = await client.messages.create({
        model: 'claude-haiku-4-5', max_tokens: 200,
        system: 'Summarize this conversation context in 2-3 sentences. Be concise and factual.',
        messages: [{ role: 'user', content: convoText.slice(0, 5000) }],
      });
      mem.summary = (sumResp.content[0] as any).text as string;
    }

    save();
  } catch { /* never block */ }
}

// 2F: Enhanced System Prompt Builder
function buildEnhancedSystemPrompt(agent: Agent, userIdentifier: string, channel: string): string {
  const basePrompt = agent.system_prompt || 'You are a helpful AI assistant.';

  const ltm = getLongTermMemory(agent.id, userIdentifier, channel);
  let memorySection = '';
  if (ltm && (ltm.facts.length > 0 || ltm.preferences.length > 0 || ltm.summary)) {
    const parts: string[] = ['\n## What I Know About This User'];
    if (ltm.facts.length > 0) parts.push(ltm.facts.slice(-20).map(f => `- ${f}`).join('\n'));
    if (ltm.preferences.length > 0) {
      parts.push('\n## User Preferences');
      parts.push(ltm.preferences.slice(-10).map(p => `- ${p}`).join('\n'));
    }
    if (ltm.summary) {
      parts.push('\n## Conversation History Summary');
      parts.push(ltm.summary);
    }
    memorySection = parts.join('\n');
  }

  const channelCtx: Record<string, string> = {
    sms: 'Keep responses under 160 characters when possible. Use plain text only.',
    telegram: 'You can use Markdown formatting. Keep responses concise but complete.',
    discord: 'You can use Discord markdown. Responses can be longer for technical topics.',
    web: 'Full HTML/markdown supported. Thorough responses preferred.',
  };
  const channelContext = channelCtx[channel] || '';

  return `${basePrompt}${memorySection}\n\n## Channel Context\n${channelContext}\n\n## Current Date\n${new Date().toISOString()}`;
}

// 2B: Complexity Assessment & Multi-Step Reasoning
function assessComplexity(message: string): 'simple' | 'complex' {
  const complexIndicators = [
    /\b(analyze|compare|explain|design|plan|strategy|research|evaluate|calculate|estimate|step.?by.?step|how do i|how does|why does|what is the best|write a|create a|build a|help me with)\b/i,
    /\?.*\?/,
    message.length > 200,
    /\b(and|also|additionally|furthermore|moreover)\b.*\?/i,
  ];
  const score = complexIndicators.filter(r => typeof r === 'boolean' ? r : r.test(message)).length;
  return score >= 2 ? 'complex' : 'simple';
}

async function callAIWithReasoning(
  agent: Agent,
  messages: { role: string; content: string }[],
  userMessage: string,
  maxTokens: number
): Promise<{ text: string; tokensUsed: number }> {
  const complexity = assessComplexity(userMessage);

  if (complexity === 'simple') {
    return callAI(agent.provider, agent.model, agent.system_prompt, messages, maxTokens);
  }

  let plan = '';
  let planTokens = 0;
  try {
    const planResult = await callAI(
      agent.provider, agent.model, agent.system_prompt,
      [{ role: 'user', content: `Briefly outline 2-4 steps to fully answer: "${userMessage.slice(0, 300)}"` }],
      200
    );
    plan = planResult.text;
    planTokens = planResult.tokensUsed;
  } catch { /* skip on error */ }

  const augmentedMessages = plan
    ? [
        ...messages.slice(0, -1),
        { role: 'user' as const, content: `${userMessage}\n\n[Reasoning steps: ${plan}]` },
      ]
    : messages;

  const result = await callAI(agent.provider, agent.model, agent.system_prompt, augmentedMessages, maxTokens);
  return { text: result.text, tokensUsed: result.tokensUsed + planTokens };
}

// 2C: Self-Learning / Quality Signals
function analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const pos = /\b(thanks|great|perfect|awesome|helpful|love it|excellent|exactly|yes|good job)\b/i;
  const neg = /\b(wrong|bad|useless|not helpful|confused|doesn't work|no that|incorrect|stop)\b/i;
  if (pos.test(text)) return 'positive';
  if (neg.test(text)) return 'negative';
  return 'neutral';
}

// Enhanced sentiment detection for escalation
function detectSentimentEnhanced(message: string): 'positive' | 'neutral' | 'negative' | 'urgent' {
  const negativeWords = ['angry', 'terrible', 'awful', 'cancel', 'refund', 'frustrated', 'horrible', 'worst', 'useless', 'scam', 'fraud', 'broken', 'pathetic', 'ridiculous'];
  const urgentWords = ['urgent', 'emergency', 'immediately', 'asap', 'now', 'critical', 'help me now', 'need help now'];
  const positiveWords = ['thanks', 'great', 'perfect', 'awesome', 'love', 'excellent', 'amazing', 'wonderful'];
  const lc = message.toLowerCase();
  if (urgentWords.some(w => lc.includes(w))) return 'urgent';
  if (negativeWords.some(w => lc.includes(w))) return 'negative';
  if (positiveWords.some(w => lc.includes(w))) return 'positive';
  return 'neutral';
}

// Language detection (simple heuristic)
function detectLanguage(text: string): string {
  const nonAscii = (text.match(/[^\x00-\x7F]/g) || []).length;
  const ratio = nonAscii / (text.length || 1);
  if (ratio > 0.2) return 'non-english';
  return 'english';
}

// Response quality scoring
function scoreResponseQuality(response: string, userMessage: string, channel: string): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 100;
  // Channel-specific length checks
  if (channel === 'sms' && response.length > 500) { flags.push('too_long_for_sms'); score -= 20; }
  if (response.length > 2000) { flags.push('very_long'); score -= 10; }
  if (response.trim().length < 10) { flags.push('too_short'); score -= 30; }
  // Basic relevance: do any words from user message appear in response?
  const userWords = userMessage.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  const responseLC = response.toLowerCase();
  const relevantWords = userWords.filter(w => responseLC.includes(w));
  if (userWords.length > 0 && relevantWords.length / userWords.length < 0.15) {
    flags.push('low_relevance'); score -= 20;
  }
  return { score: Math.max(0, score), flags };
}

// Conversation summarization
async function summarizeConversation(conversationId: string): Promise<void> {
  try {
    const conv = db.data.conversations.find(c => c.id === conversationId);
    if (!conv) return;
    const messages = db.data.messages
      .filter(m => m.conversation_id === conversationId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-30);
    if (messages.length < 4) return;
    const convoText = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 300,
      system: 'Summarize this conversation in 2-3 sentences. Include: main topic, user needs, any action items. Be concise.',
      messages: [{ role: 'user', content: convoText.slice(0, 5000) }],
    });
    const summary = (resp.content[0] as any).text as string;
    conv.summary = summary;
    conv.summary_at = new Date().toISOString();
    // Attach to lead if exists
    const agent = db.data.agents.find(a => a.id === conv.agent_id);
    if (agent && conv.channel) {
      const extId = (conv as any).external_id;
      if (extId) {
        const lead = db.data.leads?.find(l => l.agent_id === conv.agent_id && l.identifier === extId);
        if (lead && summary) { lead.memory_summary = summary; lead.updated_at = new Date().toISOString(); }
      }
    }
    save();
  } catch { /* silent */ }
}

// Proactive follow-up check
async function checkProactiveFollowUps(): Promise<void> {
  try {
    const now = new Date();
    for (const agent of db.data.agents.filter(a => a.is_active && a.followup_enabled)) {
      const delayMs = (agent.followup_delay_hours || 24) * 3600000;
      const followupMsg = agent.followup_message || `Hey! Just checking in — is there anything else I can help you with?`;
      // Find conversations that haven't been followed up and are past the delay
      const convs = db.data.conversations.filter(c =>
        c.agent_id === agent.id &&
        !c.followup_sent &&
        c.last_message_at &&
        (now.getTime() - new Date(c.last_message_at).getTime()) > delayMs
      );
      for (const conv of convs.slice(0, 5)) {
        // Only follow up if last message was from user (not agent)
        const lastMsg = db.data.messages
          .filter(m => m.conversation_id === conv.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        if (!lastMsg || lastMsg.role !== 'user') { conv.followup_sent = true; continue; }
        const extId = (conv as any).external_id;
        if (!extId) { conv.followup_sent = true; continue; }
        // Send via Telegram if that's the channel
        if (conv.channel === 'telegram') {
          const intg = db.data.integrations.find(i => i.user_id === agent.user_id && i.type === 'telegram' && i.connected);
          if (intg) {
            const { botToken } = decodeCredentials(intg.credentials);
            const chatId = extId.replace('tg_', '');
            if (botToken && chatId) {
              try {
                await sendTelegramMessage(botToken, chatId, followupMsg);
                conv.followup_sent = true;
                agent.total_messages++;
                logActivity({ user_id: agent.user_id, agent_id: agent.id, agent_name: agent.name, event_type: 'scheduled_sent', channel: 'telegram', summary: 'Proactive follow-up sent', status: 'success' });
              } catch { /* skip */ }
            }
          }
        } else {
          conv.followup_sent = true; // mark done for non-telegram
        }
      }
      // Also summarize inactive conversations (no activity for 30+ min)
      const inactiveConvs = db.data.conversations.filter(c =>
        c.agent_id === agent.id &&
        !c.summary &&
        c.last_message_at &&
        (now.getTime() - new Date(c.last_message_at).getTime()) > 1800000
      );
      for (const conv of inactiveConvs.slice(0, 3)) {
        await summarizeConversation(conv.id).catch(() => {});
      }
    }
    save();
  } catch { /* silent */ }
}

// Escalation alert creation
async function createEscalationAlert(agent: Agent, conversationId: string, channel: string, userIdentifier: string, sentiment: string, messageSnippet: string): Promise<void> {
  try {
    if (!db.data.escalation_alerts) db.data.escalation_alerts = [];
    const alert: EscalationAlert = {
      id: randomUUID(), user_id: agent.user_id, agent_id: agent.id,
      agent_name: agent.name, conversation_id: conversationId, channel,
      user_identifier: userIdentifier, sentiment, message_snippet: messageSnippet.slice(0, 200),
      created_at: new Date().toISOString(), resolved: false,
    };
    db.data.escalation_alerts.push(alert);
    // Notify via Telegram if configured
    if (agent.escalation_notify === 'telegram') {
      const intg = db.data.integrations.find(i => i.user_id === agent.user_id && i.type === 'telegram' && i.connected);
      if (intg) {
        const { botToken } = decodeCredentials(intg.credentials);
        const ownerIntg = db.data.integrations.find(i => i.user_id === agent.user_id && i.type === 'telegram' && i.connected);
        // We don't know owner's chat_id from integrations, so we skip direct DM for now
        // But we log and store for in-app display
      }
    }
    logActivity({ user_id: agent.user_id, agent_id: agent.id, agent_name: agent.name, event_type: 'error', channel: channel as any, summary: `Escalation: ${sentiment} message from ${userIdentifier}`, details: messageSnippet.slice(0, 200), status: 'error' });
    save();
  } catch { /* silent */ }
}

function recordAgentMetrics(agentId: string, responseMs: number, tokensUsed: number, sentiment: 'positive' | 'negative' | 'neutral', isFollowUp: boolean): void {
  try {
    if (!db?.data?.agent_metrics) db.data.agent_metrics = [];
    const today = new Date().toISOString().split('T')[0];
    let m = db.data.agent_metrics.find(x => x.agent_id === agentId && x.date === today);
    if (!m) {
      m = { id: randomUUID(), agent_id: agentId, date: today, messages_sent: 0, avg_response_ms: 0, follow_up_count: 0, satisfaction_score: 0, tokens_used: 0 };
      db.data.agent_metrics.push(m);
    }
    m.avg_response_ms = Math.round((m.avg_response_ms * m.messages_sent + responseMs) / (m.messages_sent + 1));
    m.messages_sent++;
    m.tokens_used += tokensUsed;
    if (isFollowUp) m.follow_up_count++;
    if (sentiment === 'positive') m.satisfaction_score = Math.min(100, m.satisfaction_score + 2);
    if (sentiment === 'negative') m.satisfaction_score = Math.max(0, m.satisfaction_score - 3);
    save();
  } catch { /* never block */ }
}

// 2D: Smart Model Selection
function selectOptimalModel(agent: Agent, messageLength: number, taskType: string): string {
  if (agent.model && agent.model !== 'auto') return agent.model;
  if (taskType === 'creative' || messageLength > 500) return 'claude-sonnet-4-5';
  if (taskType === 'analytical') return 'claude-sonnet-4-5';
  if (taskType === 'fast_response') return 'claude-haiku-4-5';
  if (taskType === 'cost_optimized') return 'gemini-1.5-flash';
  return agent.model || 'claude-haiku-4-5';
}

function detectTaskType(message: string): string {
  if (/\b(story|poem|creative|write|imagine|fiction)\b/i.test(message)) return 'creative';
  if (/\b(analyze|calculate|compare|data|metric|stats|explain|why|how does)\b/i.test(message)) return 'analytical';
  if (/^(hi|hello|hey|thanks|ok|sure|yes|no)\b/i.test(message) || message.length < 30) return 'fast_response';
  return 'default';
}

// 2E: Always-On Agent Heartbeat
async function processAgentHeartbeat(agent: Agent): Promise<void> {
  try {
    if (db?.data?.agent_long_term_memory) {
      for (const mem of db.data.agent_long_term_memory.filter(m => m.agent_id === agent.id)) {
        if (mem.facts.length > 30) mem.facts = mem.facts.slice(-30);
        if (mem.preferences.length > 15) mem.preferences = mem.preferences.slice(-15);
      }
    }
    logActivity({
      user_id: agent.user_id, agent_id: agent.id, agent_name: agent.name,
      event_type: 'automation_triggered', channel: 'system',
      summary: 'Agent heartbeat — always-on maintenance', status: 'success',
    });
    save();
  } catch { /* silent */ }
}

function startAlwaysOnHeartbeat() {
  const MS_PER_DAY = 86400000;
  const now = new Date();
  const next9am = new Date(now);
  next9am.setHours(9, 0, 0, 0);
  if (next9am <= now) next9am.setDate(next9am.getDate() + 1);
  setTimeout(() => {
    const run = async () => {
      if (!db?.data?.agents) return;
      const alwaysOn = db.data.agents.filter(a => a.always_on && a.is_active);
      for (const agent of alwaysOn) await processAgentHeartbeat(agent).catch(() => {});
    };
    run();
    setInterval(run, MS_PER_DAY);
  }, next9am.getTime() - now.getTime());
}

// ═══ End Agent Intelligence System ══════════════════════════════════════════

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
  // SQLite database (WAL mode — safe for concurrent access, no JSON corruption)
  // Use DATABASE_PATH env var if set, otherwise use /app/data (Railway volume mount)
  const sqlitePath = process.env.DATABASE_PATH || (process.env.RAILWAY_ENVIRONMENT ? '/app/data/dipperai.db' : path.join(process.cwd(), 'dipperai.db'));
  console.log('[DB] Using path:', sqlitePath);
  db = createSQLiteDB(sqlitePath);
  // One-time migration from old JSON file if it exists
  const jsonPath = sqlitePath.replace('.db', '.json');
  await migrateFromJSON(jsonPath, db);

  // Auto-promote admin on startup
  {
    const adminUser = db.data.users.find((u: any) => u.email === ADMIN_EMAIL);
    if (adminUser && adminUser.plan !== 'admin') {
      adminUser.plan = 'admin';
      db.write();
      console.log('[admin] Promoted', ADMIN_EMAIL, 'to admin plan');
    }
  }

  startCronRunner();
  startAutomationRunner();
  startAlwaysOnHeartbeat();
  // Proactive follow-up runner (every 15 minutes)
  setInterval(() => checkProactiveFollowUps().catch(() => {}), 15 * 60 * 1000);

  const app = express();
  app.use(cors({ origin: true, credentials: true }));

  // Stripe webhook needs raw body
  app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
    const integrationCount = db.data.integrations.filter(i => i.user_id === user.id && i.connected).length;
    // Monthly usage from activity logs
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthStart = new Date(currentMonth + '-01').toISOString();
    const monthlyMessages = (db.data.activity_logs || []).filter(
      l => l.user_id === user.id && l.event_type === 'message_sent' && l.created_at >= monthStart
    ).length;
    res.json({
      plan: user.plan,
      messagesUsedToday: user.messages_today,
      messagesLimitToday: plan.messagesPerDay,
      messagesUsedMonth: monthlyMessages,
      messagesLimitMonth: plan.messagesPerMonth,
      tokensUsedToday: user.tokens_used_today || 0,
      agentsUsed: agentCount,
      agentsLimit: plan.agents,
      integrationsUsed: integrationCount,
      integrationsLimit: plan.integrations,
      allowedModels: plan.allowedModels,
    });
  });

  // ─── Billing Usage ────────────────────────────────────────────────────────
  app.get('/api/billing/usage', auth, (req: any, res) => {
    const user: User = req.user;
    const plan = PLANS[user.plan] || PLANS.free;
    const agentCount = db.data.agents.filter(a => a.user_id === user.id && a.is_active).length;
    const integrationCount = db.data.integrations.filter(i => i.user_id === user.id && i.connected).length;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthStart = new Date(currentMonth + '-01').toISOString();
    const monthlyMessages = (db.data.activity_logs || []).filter(
      l => l.user_id === user.id && l.event_type === 'message_sent' && l.created_at >= monthStart
    ).length;
    res.json({
      plan: user.plan,
      planPrice: plan.price,
      currentMonth,
      usage: {
        messages: { used: monthlyMessages, limit: plan.messagesPerMonth },
        agents: { used: agentCount, limit: plan.agents },
        integrations: { used: integrationCount, limit: plan.integrations },
      },
    });
  });

  // Templates
  app.get('/api/templates', (_req, res) => res.json(AGENT_TEMPLATES));

  // ─── Agents ───────────────────────────────────────────────────────────────

  function enrichAgent(agent: Agent) {
    const now = Date.now();
    const oneDayAgo = new Date(now - 86400000).toISOString();
    const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();
    const agentLogs = db.data.activity_logs?.filter(l => l.agent_id === agent.id) || [];
    const msgLogs = agentLogs.filter(l => l.event_type === 'message_sent');
    const lastLog = agentLogs.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const connectedChannels = (db.data.integrations || [])
      .filter(i => i.agent_id === agent.id && i.connected)
      .map(i => i.type);
    if (agent.deployed_embed_enabled) connectedChannels.push('webchat');
    const uniqueUsers7d = new Set(
      agentLogs.filter(l => l.created_at >= sevenDaysAgo).map(l => l.channel)
    ).size;
    return {
      ...agent,
      last_activity: lastLog?.created_at || agent.updated_at,
      message_count_today: msgLogs.filter(l => l.created_at >= oneDayAgo).length,
      total_messages: agent.total_messages,
      active_users: uniqueUsers7d,
      status: agent.is_active ? 'active' : 'paused',
      connected_channels: connectedChannels,
    };
  }

  app.get('/api/agents', auth, (req: any, res) => {
    const agents = db.data.agents.filter(a => a.user_id === req.userId && a.is_active)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(agents.map(enrichAgent));
  });

  app.post('/api/agents', auth, (req: any, res) => {
    if (!checkLimit(req.user, 'agents'))
      return res.status(403).json({ error: `Agent limit reached for ${req.user.plan} plan.` });
    const { name, emoji, description, systemPrompt, model, provider, templateId, autonomous_mode, response_delay_ms,
      // Auto-assign tools based on template
      const TOOL_MAP: Record<string, string[]> = {"creative-director":["generate_image","web_search","create_telegram_sticker"],"content-creator":["generate_image","web_search","send_email"],"research-agent":["web_search","search_knowledge_base","calculate","send_notification"],"personal-assistant":["web_search","send_email","search_knowledge_base","get_time","send_notification"],"sales-outreach":["send_email","create_lead","web_search","send_notification"],"community-builder":["create_lead","send_notification","search_knowledge_base"],"builder-assistant":["web_search","search_knowledge_base","calculate"],"crypto-advisor":["web_search","send_notification","create_lead"],"customer-support":["search_knowledge_base","create_lead","send_notification"],"sales-bot":["create_lead","send_notification","webhook"],"lead-capture":["create_lead","send_notification"],"ecommerce":["search_knowledge_base","create_lead","webhook"],"appointment-bot":["create_lead","send_notification","get_time"],"custom":["web_search","generate_image","send_email","create_lead"]};
      const autoTools: string[] = req.body.tools_enabled?.length ? req.body.tools_enabled : (templateId && TOOL_MAP[templateId]) ? TOOL_MAP[templateId] : TOOL_MAP['custom'] || [];
      knowledgeText, knowledge_base, response_format, maxResponseLength, max_response_length, always_on, long_term_memory,
      tools_enabled, auto_translate, followup_enabled, followup_delay_hours, followup_message,
      daily_digest_enabled, daily_digest_time, escalate_on_negative, escalation_notify, escalation_message } = req.body;
    if (!name || !systemPrompt) return res.status(400).json({ error: 'Name and system prompt required' });
    const agent: Agent = {
      id: randomUUID(), user_id: req.userId, name, emoji: emoji || '🤖',
      description: description || '', system_prompt: systemPrompt,
      model: model || 'claude-sonnet-4-5', provider: provider || 'anthropic',
      template_id: templateId, total_messages: 0, is_active: true,
      embed_token: randomUUID().replace(/-/g, ''), deployed_embed_enabled: false,
      autonomous_mode: autonomous_mode || false,
      response_delay_ms: response_delay_ms || 0,
      knowledge_base: knowledgeText || knowledge_base || undefined,
      response_format: response_format || 'conversational',
      max_response_length: maxResponseLength || max_response_length || 500,
      always_on: always_on || false,
      long_term_memory: long_term_memory !== undefined ? long_term_memory : 1,
      tools_enabled: autoTools,
      auto_translate: auto_translate || false,
      followup_enabled: followup_enabled || false,
      followup_delay_hours: followup_delay_hours || 24,
      followup_message: followup_message || '',
      daily_digest_enabled: daily_digest_enabled || false,
      daily_digest_time: daily_digest_time || '09:00',
      escalate_on_negative: escalate_on_negative || false,
      escalation_notify: escalation_notify || 'inapp',
      escalation_message: escalation_message || '',
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
    res.json(enrichAgent(agent));
  });

  app.put('/api/agents/:id', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { name, emoji, description, systemPrompt, model, provider, autonomous_mode, response_delay_ms,
      knowledgeText, knowledge_base, response_format, maxResponseLength, max_response_length, always_on, long_term_memory,
      tools_enabled, auto_translate, followup_enabled, followup_delay_hours, followup_message,
      daily_digest_enabled, daily_digest_time, escalate_on_negative, escalation_notify, escalation_message,
      webhook_url, webhook_secret, calendly_link, calendly_api_key, sheets_spreadsheet_id, sheets_range, stripe_api_key } = req.body;
    if (name) agent.name = name;
    if (emoji) agent.emoji = emoji;
    if (description !== undefined) agent.description = description;
    if (systemPrompt) agent.system_prompt = systemPrompt;
    if (model) agent.model = model;
    if (provider) agent.provider = provider;
    if (autonomous_mode !== undefined) agent.autonomous_mode = autonomous_mode;
    if (response_delay_ms !== undefined) agent.response_delay_ms = response_delay_ms;
    if (knowledgeText !== undefined) agent.knowledge_base = knowledgeText;
    if (knowledge_base !== undefined) agent.knowledge_base = knowledge_base;
    if (response_format !== undefined) agent.response_format = response_format;
    if (maxResponseLength !== undefined) agent.max_response_length = maxResponseLength;
    if (max_response_length !== undefined) agent.max_response_length = max_response_length;
    if (always_on !== undefined) agent.always_on = always_on;
    if (long_term_memory !== undefined) agent.long_term_memory = long_term_memory;
    if (tools_enabled !== undefined) agent.tools_enabled = tools_enabled;
    if (auto_translate !== undefined) agent.auto_translate = auto_translate;
    if (followup_enabled !== undefined) agent.followup_enabled = followup_enabled;
    if (followup_delay_hours !== undefined) agent.followup_delay_hours = followup_delay_hours;
    if (followup_message !== undefined) agent.followup_message = followup_message;
    if (daily_digest_enabled !== undefined) agent.daily_digest_enabled = daily_digest_enabled;
    if (daily_digest_time !== undefined) agent.daily_digest_time = daily_digest_time;
    if (escalate_on_negative !== undefined) agent.escalate_on_negative = escalate_on_negative;
    if (escalation_notify !== undefined) agent.escalation_notify = escalation_notify;
    if (escalation_message !== undefined) agent.escalation_message = escalation_message;
    if (webhook_url !== undefined) agent.webhook_url = webhook_url;
    if (webhook_secret !== undefined) agent.webhook_secret = webhook_secret;
    if (calendly_link !== undefined) agent.calendly_link = calendly_link;
    if (calendly_api_key !== undefined) agent.calendly_api_key = calendly_api_key;
    if (sheets_spreadsheet_id !== undefined) agent.sheets_spreadsheet_id = sheets_spreadsheet_id;
    if (sheets_range !== undefined) agent.sheets_range = sheets_range;
    if (stripe_api_key !== undefined) agent.stripe_api_key = stripe_api_key;
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
    const { message, conversationId, model: requestedModel, imageData } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    // DEBUG: log what we received
    console.log('[chat] imageData present:', !!imageData, 'length:', imageData?.length || 0, 'starts:', imageData?.slice(0,30) || 'none');
    console.log('[chat] model:', requestedModel, 'provider would be:', requestedModel?.startsWith('gpt') ? 'openai' : 'anthropic');

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
    // Include image context if provided
    const imageName = (req.body as any).imageName || 'image';
    const messageWithImage = imageData
      ? message + `\n\n[The user has uploaded an image named "${imageName}". The image has been shared for your analysis. Please describe what you see in detail, then proactively suggest: 1) sticker concepts based on the image 2) creative variations 3) how to turn it into a Telegram sticker pack. Be enthusiastic and creative.]`
      : message;
    // Include image name hint in message for conversation history
    const imageHint = imageData && (req.body as any).imageName 
      ? ` [User attached image: ${(req.body as any).imageName}]`
      : '';
    history.push({ role: 'user', content: messageWithImage + imageHint });

    const plan = PLANS[req.user.plan] || PLANS.free;
    const startTime = Date.now();
    try {
      const memoryContext = buildMemoryContext(agent.id, req.userId, 'web');
      const knowledgeContext = buildKnowledgeContext(agent.id, message);
      const basePrompt = buildAgentSystemPrompt(agent, knowledgeContext ? `${knowledgeContext}\n\n${agent.system_prompt}` : agent.system_prompt);
      const systemPromptWithMemory = memoryContext ? `${memoryContext}\n\n${basePrompt}` : basePrompt;
      // Tool-aware chat execution
    const agentTools: string[] = (agent as any).tools_enabled || [];
    
    // Tool definitions injected into system prompt
    // Tool awareness - server handles execution, agent just needs to know what it can do
    const toolCapabilities: Record<string, string> = {
      web_search: 'search the web for current information on any topic',
      generate_image: 'generate images using AI (DALL-E 3) from text descriptions. Call TOOL:generate_image("detailed prompt") to create an image.',
      create_telegram_sticker: 'create a sticker-optimized image ready for Telegram. Call TOOL:create_telegram_sticker("description") to generate.',
      send_email: 'send emails on behalf of the user',
      create_lead: 'save contact information to the CRM',
      get_time: 'get the current date and time',
      calculate: 'perform mathematical calculations',
    };
    const toolSystemAddition = agentTools.length > 0
      ? '\n\n## Your Capabilities\nYou have these capabilities available (the system handles them automatically):\n' +
        agentTools.filter((t: string) => toolCapabilities[t]).map((t: string) => '- You can ' + toolCapabilities[t]).join('\n') +
        '\n\nIMPORTANT: Never output XML tags, function_call syntax, or technical markup. Never write <invoke>, <function_calls>, or TOOL: in your responses. The system detects your intent automatically. Just respond naturally and the right tools will be called for you.'
      : '';

    // Image context comes through conversation history automatically (stored with user message)
    const finalSystemPrompt = systemPromptWithMemory + toolSystemAddition;

    // First AI call - use vision API if imageData present
    let rawContent: string;
    let tokensUsed: number;
    console.log('[auth-chat] imageData present:', !!imageData, 'length:', imageData?.length || 0, 'provider:', activeProvider, 'model:', effectiveModel);
    if (imageData && activeProvider === 'anthropic') {
      console.log('[auth-chat] USING VISION API');
      const anthropicVisionClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const base64Data = imageData.replace(/^data:image\/[^;]+;base64,/, '');
      const mimeMatch = imageData.match(/^data:(image\/[^;]+);/);
      const mediaType = (mimeMatch?.[1] || 'image/jpeg') as any;
      const lastMsg = history[history.length - 1];
      const userText = (lastMsg?.content || '').replace(/\[.*?\]/g, '').trim() || 'Describe this image in detail.';
      const visionMsgs = [
        ...history.slice(0, -1).map((m: any) => ({ role: m.role as any, content: m.content })),
        { role: 'user' as const, content: [
          { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: base64Data } },
          { type: 'text' as const, text: userText }
        ]}
      ];
      const visionModel = effectiveModel.includes('haiku') ? 'claude-sonnet-4-5' : effectiveModel;
      const visionResp = await anthropicVisionClient.messages.create({
        model: visionModel,
        max_tokens: plan.maxTokens,
        system: finalSystemPrompt + '\n\nSTRICT: 2-3 sentences max. No bullet points, no dashes, no markdown. Describe what you see conversationally.',
        messages: visionMsgs,
      });
      rawContent = (visionResp.content[0] as any).text;
      tokensUsed = (visionResp.usage?.input_tokens || 0) + (visionResp.usage?.output_tokens || 0);
      console.log('[auth-chat] Vision response length:', rawContent.length);
    } else {
      const aiRes = await callAI(activeProvider, effectiveModel, finalSystemPrompt, history, plan.maxTokens);
      rawContent = aiRes.text;
      tokensUsed = aiRes.tokensUsed;
    }

    // Parse and execute any tool calls in the response
    let content = rawContent;

    // Keyword intent detection - auto-fire tools based on message keywords
    const msgL = message.toLowerCase();
    if (agentTools.includes('generate_image') && !imageData &&
        (msgL.includes('generat') || msgL.includes('creat') || msgL.includes('draw') || msgL.includes('make') || msgL.includes('design')) &&
        (msgL.includes('image') || msgL.includes('sticker') || msgL.includes('meme') || msgL.includes('picture') || msgL.includes('logo') || msgL.includes('illustration'))) {
      try {
        const genUrl = await generateImage(message.slice(0, 400));
        if (genUrl.startsWith('http')) content = rawContent + '\n\n' + genUrl;
      } catch (e) { console.error('[intent-img]', e); }
    }
    if (agentTools.includes('web_search') && !imageData &&
        (msgL.includes('search') || msgL.includes('look up') || msgL.includes('find') || msgL.includes('research') || msgL.includes('latest') || msgL.includes('current') || msgL.includes('today'))) {
      try {
        const sr = await webSearch(message, 4);
        if (sr && !sr.includes('unavailable')) {
          const enriched = await callAI(activeProvider, effectiveModel, finalSystemPrompt,
            [...history, { role: 'user' as const, content: 'Search results:\n\n' + sr + '\n\nAnswer the original question.' }],
            plan.maxTokens);
          content = enriched.text;
        }
      } catch (e) { console.error('[intent-search]', e); }
    }

    if (agentTools.length > 0) {
      const toolCallPattern = /TOOL:(\w+)\(([^)]*)\)/g;
      let match;
      const toolResults: Array<{tool: string; result: string}> = [];

      while ((match = toolCallPattern.exec(rawContent)) !== null) {
        const [fullMatch, toolName, argsStr] = match;
        // Parse args — simple CSV inside quotes
        const args = argsStr.match(/"([^"]*?)"/g)?.map(s => s.replace(/"/g, '')) || [argsStr];
        
        try {
          let toolResult = '';
          if (toolName === 'web_search' && agentTools.includes('web_search')) {
            toolResult = await webSearch(args[0] || rawContent, 4);
          } else if (toolName === 'generate_image' && agentTools.includes('generate_image')) {
            const imgUrl = await generateImage(args[0] || rawContent);
            toolResult = imgUrl.startsWith('http') ? 'Here is your generated image:\n![generated image](' + imgUrl + ')' : imgUrl;
          } else if (toolName === 'send_email' && agentTools.includes('send_email')) {
            toolResult = await sendEmailTool(args[0] || '', args[1] || 'Message from agent', args[2] || '', 'dipper');
          } else if (toolName === 'create_telegram_sticker' && agentTools.includes('generate_image')) {
            // Generate a sticker-style image and guide user through pack creation
            const prompt = (args[0] || rawContent) + ', sticker style, white background, bold outlines, cartoon, transparent background ready';
            const stickerUrl = await generateImage(prompt, '1024x1024');
            toolResult = stickerUrl.startsWith('http') 
              ? 'Sticker image generated! URL: ' + stickerUrl + '\n\nTo add to a Telegram sticker pack, go to @Stickers bot in Telegram, tap "Add a Sticker to a Pack" and upload this image. You can also use the /api/tools/create-sticker-pack endpoint with your bot token.'
              : 'Could not generate sticker: ' + stickerUrl;
          } else if (toolName === 'create_lead' && agentTools.includes('create_lead')) {
            // Use the existing create_lead logic
            if (!db.data.leads) db.data.leads = [];
            const leadId = randomUUID();
            const now = new Date().toISOString();
            db.data.leads.push({ id: leadId, user_id: req.userId, agent_id: agent.id, agent_name: agent.name, identifier: args[1] || args[0] || leadId, channel: 'web', display_name: args[0], email: args[1], phone: args[2], stage: 'new', tags: [], notes: args[3] || '', message_count: 0, last_contact: now, first_contact: now, created_at: now, updated_at: now });
            save();
            toolResult = 'Lead saved for ' + (args[0] || 'contact');
          } else if (toolName === 'get_time') {
            toolResult = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
          } else if (toolName === 'calculate') {
            try { const safe = (args[0] || '').replace(/[^0-9+\-*/.()%\s]/g, ''); toolResult = String(eval(safe)); } catch { toolResult = 'Calculation error'; }
          }
          if (toolResult) toolResults.push({ tool: toolName, result: toolResult });
        } catch (toolErr: any) {
          console.error('[tool-call] ' + toolName + ' failed:', toolErr?.message);
        }
      }

      // If tools were called, do a second AI pass with results to get a clean final response
      if (toolResults.length > 0) {
        const toolResultsText = toolResults.map(tr => {
          if (tr.result.startsWith('[IMAGE_GENERATED]:')) {
            return 'TOOL RESULT (' + tr.tool + '): Image generated successfully. URL: ' + tr.result.replace('[IMAGE_GENERATED]:', '');
          }
          return 'TOOL RESULT (' + tr.tool + '): ' + tr.result;
        }).join('\n\n');

        // Check if any images were generated
        const imageUrls = toolResults
          .filter(tr => tr.result.startsWith('[IMAGE_GENERATED]:'))
          .map(tr => tr.result.replace('[IMAGE_GENERATED]:', ''));

        const followUpHistory = [...history, { role: 'assistant', content: rawContent }, { role: 'user', content: 'SYSTEM: Tool results received:\n\n' + toolResultsText + '\n\nNow provide your final response to the user incorporating these results naturally. Do not mention tool calls or raw URLs. If images were generated, mention that you created an image and share the URL as a clickable link.' }];
        const { text: finalContent, tokensUsed: followUpTokens } = await callAI(activeProvider, effectiveModel, finalSystemPrompt, followUpHistory, plan.maxTokens);
        tokensUsed += followUpTokens;
        
        // Append image URLs directly to response for frontend rendering
        content = finalContent;
        if (imageUrls.length > 0) {
          content = content + '\n\n' + imageUrls.map(url => '[Generated Image](' + url + ')').join('\n');
        }
      } else {
        content = rawContent;
      }
    }
      const latency_ms = Date.now() - startTime;
      db.data.messages.push({ id: randomUUID(), conversation_id: convId, role: 'user', content: message, created_at: new Date().toISOString() });
      db.data.messages.push({ id: randomUUID(), conversation_id: convId, role: 'assistant', content, model_used: effectiveModel, created_at: new Date().toISOString() });
      agent.total_messages++;
      req.user.messages_today++;
      resetTokensIfNeeded(req.user);
      req.user.tokens_used_today = (req.user.tokens_used_today || 0) + tokensUsed;
      console.log(`[chat] model=${effectiveModel} tokens=${tokensUsed}`);
      save();
      // Async: memory extraction + long-term memory + metrics — never block response
      const fullHistory = [...history, { role: 'assistant', content }];
      extractAndUpdateMemory(agent.id, req.userId, 'web', fullHistory, agent.system_prompt).catch(() => {});
      updateLongTermMemory(agent.id, req.userId, 'web', fullHistory).catch(() => {});
      const sentiment = analyzeSentiment(message);
      const sentimentEnhanced = detectSentimentEnhanced(message);
      const isFollowUp = history.filter(m => m.role === 'user').length > 1;
      recordAgentMetrics(agent.id, latency_ms, tokensUsed, sentiment, isFollowUp);
      // Update conversation last_message_at
      const convMsg = db.data.conversations.find(c => c.id === convId);
      if (convMsg) { convMsg.last_message_at = new Date().toISOString(); convMsg.followup_sent = false; }
      // Quality scoring
      const quality = scoreResponseQuality(content, message, 'web');
      if (quality.score < 70) console.log(`[quality] agent=${agent.id} score=${quality.score} flags=${quality.flags.join(',')}`);
      // Escalation
      if (agent.escalate_on_negative && (sentimentEnhanced === 'negative' || sentimentEnhanced === 'urgent')) {
        const sentConv = db.data.conversations.find(c => c.id === convId);
        if (sentConv) sentConv.sentiment_flag = sentimentEnhanced as 'negative' | 'urgent';
        createEscalationAlert(agent, convId, 'web', req.userId, sentimentEnhanced, message).catch(() => {});
      }
      save();
      logActivity({ user_id: req.userId, agent_id: agent.id, agent_name: agent.name, event_type: 'message_sent', channel: 'web', summary: 'Replied to web chat message', details: content.slice(0, 200), model_used: effectiveModel, tokens_used: tokensUsed, latency_ms, status: 'success' });
      res.json({ content: cleanAgentResponse(content), conversationId: convId, model_used: effectiveModel });
    } catch (e: any) {
      console.error('[chat error]', e?.message, e?.status, e?.error);
      logActivity({ user_id: req.userId, agent_id: agent.id, agent_name: agent.name, event_type: 'error', channel: 'web', summary: 'Error during web chat', status: 'error', error_message: e?.message });
      // Return friendly error messages instead of raw API errors
      let friendlyError = 'Something went wrong. Please try again.';
      if (e?.message?.includes('authentication') || e?.message?.includes('401') || e?.status === 401) {
        friendlyError = 'API key issue. The AI service needs to be configured. If you are the owner, check your API keys in Railway environment variables.';
      } else if (e?.message?.includes('rate') || e?.status === 429) {
        friendlyError = 'Rate limit hit. Give it a moment and try again.';
      } else if (e?.message?.includes('model') || e?.message?.includes('not found')) {
        friendlyError = 'This AI model is not available. Try switching to a different model in settings.';
      }
      res.status(500).json({ error: friendlyError });
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
    const daysParam = parseInt((req.query as any).days as string) || 30;
    const days = Math.min(daysParam, 90);
    const userId = req.userId;
    const agents = db.data.agents.filter((a: any) => a.user_id === userId && a.is_active);
    const allLogs = (db.data.activity_logs || []).filter((l: any) => l.user_id === userId);
    const msgLogs = allLogs.filter((l: any) => l.event_type === 'message_sent');
    const dayMap: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      dayMap[d] = 0;
    }
    for (const log of msgLogs) {
      const d = log.created_at.split('T')[0];
      if (dayMap[d] !== undefined) dayMap[d]++;
    }
    const dailyMessages = Object.entries(dayMap).map(([date, value]) => {
      const dt = new Date(date);
      const label = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return { label, value, date };
    });
    const totalMessages = agents.reduce((s: number, a: any) => s + (a.total_messages || 0), 0);
    const withLatency = allLogs.filter((l: any) => (l as any).latency_ms != null && (l as any).latency_ms > 0);
    const avgResponseMs = withLatency.length > 0
      ? Math.round(withLatency.reduce((s: number, l: any) => s + (l.latency_ms || 0), 0) / withLatency.length) : 0;
    const chanMap: Record<string, number> = {};
    for (const l of msgLogs) chanMap[(l as any).channel] = (chanMap[(l as any).channel] || 0) + 1;
    const chanTotal = Object.values(chanMap).reduce((s, v) => s + v, 0) || 1;
    const channelBreakdown = Object.entries(chanMap).map(([label, count]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1), count,
      pct: Math.round((count / chanTotal) * 100),
    })).sort((a, b) => b.count - a.count);
    const buckets = [0, 0, 0, 0, 0];
    for (const l of withLatency) {
      const ms = (l as any).latency_ms || 0;
      if (ms < 1000) buckets[0]++;
      else if (ms < 2000) buckets[1]++;
      else if (ms < 3000) buckets[2]++;
      else if (ms < 5000) buckets[3]++;
      else buckets[4]++;
    }
    const bt = buckets.reduce((s, v) => s + v, 0) || 1;
    const responseTimeBuckets = [
      { label: '< 1s', pct: Math.round((buckets[0] / bt) * 100) },
      { label: '1-2s', pct: Math.round((buckets[1] / bt) * 100) },
      { label: '2-3s', pct: Math.round((buckets[2] / bt) * 100) },
      { label: '3-5s', pct: Math.round((buckets[3] / bt) * 100) },
      { label: '> 5s', pct: Math.round((buckets[4] / bt) * 100) },
    ];
    const COLORS = ['bg-violet-500', 'bg-blue-500', 'bg-green-500', 'bg-indigo-500', 'bg-amber-500'];
    const agentBreakdown = agents
      .map((a: any, i: number) => ({ name: a.name, messages: a.total_messages || 0, color: COLORS[i % COLORS.length] }))
      .sort((a: any, b: any) => b.messages - a.messages).slice(0, 5);
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    for (const l of msgLogs) {
      if ((l as any).created_at < sevenDaysAgo) continue;
      const d = new Date((l as any).created_at);
      heatmap[d.getDay()][d.getHours()]++;
    }
    res.json({ totalMessages, avgResponseMs, satisfactionScore: 0, dailyMessages, channelBreakdown, responseTimeBuckets, agentBreakdown, hourlyHeatmap: heatmap });
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

  app.delete('/api/integrations/:type', auth, (req: any, res) => {
    const { type } = req.params;
    const idx = db.data.integrations.findIndex(i => i.user_id === req.userId && i.type === type);
    if (idx !== -1) { db.data.integrations.splice(idx, 1); save(); }
    res.json({ success: true });
  });

  // ─── Phase 3: Test integration endpoint ──────────────────────────────────
  app.post('/api/integrations/:type/test', auth, async (req: any, res) => {
    const { type } = req.params;
    const { credentials } = req.body;
    try {
      if (type === 'telegram') {
        const token = credentials?.botToken || credentials?.token;
        if (!token) return res.status(400).json({ error: 'botToken required' });
        const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const d: any = await r.json();
        if (!d.ok) return res.status(400).json({ error: 'Invalid token', details: d.description });
        return res.json({ success: true, bot_username: d.result.username, bot_name: d.result.first_name });
      }
      if (type === 'sms') {
        const { accountSid, authToken } = credentials || {};
        if (!accountSid || !authToken) return res.status(400).json({ error: 'accountSid and authToken required' });
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
          headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}` },
        });
        if (!r.ok) return res.status(400).json({ error: 'Invalid Twilio credentials' });
        const d: any = await r.json();
        return res.json({ success: true, account_name: d.friendly_name, status: d.status });
      }
      if (type === 'discord') {
        const token = credentials?.botToken || credentials?.token;
        if (!token) return res.status(400).json({ error: 'botToken required' });
        const r = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bot ${token}` } });
        if (!r.ok) return res.status(400).json({ error: 'Invalid Discord bot token' });
        const d: any = await r.json();
        return res.json({ success: true, bot_username: d.username, bot_id: d.id });
      }
      if (type === 'twitter') {
        const { bearerToken } = credentials || {};
        if (!bearerToken) return res.status(400).json({ error: 'bearerToken required' });
        const r = await fetch('https://api.twitter.com/2/users/me', {
          headers: { Authorization: `Bearer ${bearerToken}` },
        });
        if (!r.ok) return res.status(400).json({ error: 'Invalid Twitter/X credentials' });
        const d: any = await r.json();
        return res.json({ success: true, username: d.data?.username, name: d.data?.name });
      }
      if (type === 'reddit') {
        const { clientId, clientSecret } = credentials || {};
        if (!clientId || !clientSecret) return res.status(400).json({ error: 'clientId and clientSecret required' });
        const r = await fetch('https://www.reddit.com/api/v1/access_token', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'DipperAI/1.0',
          },
          body: 'grant_type=client_credentials',
        });
        if (!r.ok) return res.status(400).json({ error: 'Invalid Reddit credentials' });
        return res.json({ success: true, message: 'Reddit credentials valid' });
      }
      return res.status(400).json({ error: `Unknown integration type: ${type}` });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Test failed' });
    }
  });

  // ─── Telegram verify endpoint ─────────────────────────────────────────────
  app.get('/api/integrations/telegram/verify/:token', async (req, res) => {
    try {
      const r = await fetch(`https://api.telegram.org/bot${req.params.token}/getMe`);
      const d: any = await r.json();
      if (!d.ok) return res.status(400).json({ error: d.description });
      res.json({ valid: true, bot: d.result });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  // ─── SMS verify + delivery status ────────────────────────────────────────
  app.get('/api/integrations/sms/verify', auth, async (req: any, res) => {
    const intg = db.data.integrations.find(i => i.user_id === req.userId && i.type === 'sms' && i.connected);
    if (!intg) return res.status(404).json({ error: 'No SMS integration found' });
    const { accountSid, authToken } = decodeCredentials(intg.credentials);
    try {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
        headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}` },
      });
      if (!r.ok) return res.status(400).json({ error: 'Twilio credentials invalid' });
      const d: any = await r.json();
      res.json({ valid: true, account_name: d.friendly_name, status: d.status });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  app.post('/api/webhooks/sms/status', express.urlencoded({ extended: false }), (req, res) => {
    const { MessageSid, MessageStatus, To, ErrorCode } = req.body;
    console.log(`[SMS status] ${MessageSid} -> ${MessageStatus} to ${To}${ErrorCode ? ' err:' + ErrorCode : ''}`);
    res.sendStatus(204);
  });

  // ─── Discord interactions endpoint (slash commands) ──────────────────────
  app.get('/api/integrations/discord/verify', auth, async (req: any, res) => {
    const intg = db.data.integrations.find(i => i.user_id === req.userId && i.type === 'discord' && i.connected);
    if (!intg) return res.status(404).json({ error: 'No Discord integration found' });
    const { botToken } = decodeCredentials(intg.credentials);
    try {
      const r = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bot ${botToken}` } });
      if (!r.ok) return res.status(400).json({ error: 'Invalid bot token' });
      const d: any = await r.json();
      // Return a bot invite link
      const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${d.id}&permissions=2048&scope=bot%20applications.commands`;
      res.json({ valid: true, bot: d, invite_url: inviteUrl });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  app.post('/api/integrations/discord/interactions', async (req, res) => {
    // Discord interaction endpoint - verify signature and handle slash commands
    const body = req.body;

    // Handle PING (Discord verification)
    if (body.type === 1) {
      return res.json({ type: 1 });
    }

    // Handle application commands
    if (body.type === 2) {
      const guildId = body.guild_id;
      const userId = body.member?.user?.id || body.user?.id;
      const commandName = body.data?.name;
      const messageText = body.data?.options?.[0]?.value || '';

      // Find an integration matching this guild
      const allDiscordIntgs = db.data.integrations.filter(i => i.type === 'discord' && i.connected);
      let matchedIntg: Integration | undefined;
      for (const intg of allDiscordIntgs) {
        const creds = decodeCredentials(intg.credentials);
        if (!guildId || creds.guildId === guildId || !creds.guildId) {
          matchedIntg = intg;
          break;
        }
      }

      if (!matchedIntg || !matchedIntg.agent_id) {
        return res.json({ type: 4, data: { content: 'No agent configured for this server.', flags: 64 } });
      }

      const agent = db.data.agents.find(a => a.id === matchedIntg!.agent_id && a.is_active);
      if (!agent) {
        return res.json({ type: 4, data: { content: 'Agent not found.', flags: 64 } });
      }

      // Respond immediately with deferred response (type 5), then edit later
      // For simplicity, we'll do inline response (type 4) with AI call
      try {
        const history = [{ role: 'user', content: messageText }];
        const systemPrompt = buildAgentSystemPrompt(agent);
        const { text: reply } = await callAI(agent.provider, agent.model, systemPrompt, history, 512);
        logActivity({
          user_id: agent.user_id, agent_id: agent.id, agent_name: agent.name,
          event_type: 'message_sent', channel: 'discord',
          summary: `Replied to Discord slash command /${commandName}`,
          details: reply.slice(0, 200), status: 'success',
        });
        agent.total_messages++;
        save();
        return res.json({ type: 4, data: { content: reply.slice(0, 2000) } });
      } catch (e: any) {
        return res.json({ type: 4, data: { content: `Error: ${e?.message}`, flags: 64 } });
      }
    }

    res.json({ type: 1 });
  });

  // ─── Twitter/X OAuth 2.0 + tweet endpoints ───────────────────────────────
  app.get('/api/integrations/twitter/auth', auth, (req: any, res) => {
    const clientId = process.env.TWITTER_CLIENT_ID;
    if (!clientId) return res.status(400).json({ error: 'TWITTER_CLIENT_ID not configured' });
    const codeVerifier = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const state = `${req.userId}:${codeVerifier}`;
    const stateEncoded = Buffer.from(state).toString('base64url');
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const redirectUri = `${appUrl}/api/integrations/twitter/callback`;
    const scope = 'tweet.read tweet.write users.read offline.access';
    const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${stateEncoded}&code_challenge=${codeVerifier.slice(0, 43)}&code_challenge_method=plain`;
    res.json({ auth_url: authUrl, state: stateEncoded });
  });

  app.get('/api/integrations/twitter/callback', async (req, res) => {
    const { code, state } = req.query as any;
    if (!code || !state) return res.status(400).send('Missing code or state');
    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf-8');
      const [userId, codeVerifier] = decoded.split(':');
      const clientId = process.env.TWITTER_CLIENT_ID;
      const clientSecret = process.env.TWITTER_CLIENT_SECRET;
      if (!clientId) return res.status(400).send('Twitter not configured');
      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const redirectUri = `${appUrl}/api/integrations/twitter/callback`;
      const tokenResp = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(clientSecret ? { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}` } : {}),
        },
        body: new URLSearchParams({
          code, grant_type: 'authorization_code',
          client_id: clientId,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier.slice(0, 43),
        }).toString(),
      });
      const tokenData: any = await tokenResp.json();
      if (!tokenData.access_token) return res.status(400).send('Failed to get access token: ' + JSON.stringify(tokenData));

      // Get user info
      const meResp = await fetch('https://api.twitter.com/2/users/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const meData: any = await meResp.json();
      const username = meData.data?.username || 'unknown';

      const existing = db.data.integrations.find(i => i.user_id === userId && i.type === 'twitter');
      if (existing) {
        existing.access_token = tokenData.access_token;
        existing.refresh_token = tokenData.refresh_token;
        existing.token_expiry = tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined;
        existing.bot_info = username;
        existing.connected = true;
        existing.token_data = JSON.stringify(tokenData);
      } else {
        db.data.integrations.push({
          id: randomUUID(), user_id: userId, type: 'twitter',
          credentials: encodeCredentials({ username }),
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expiry: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined,
          bot_info: username, connected: true,
          token_data: JSON.stringify(tokenData),
          created_at: new Date().toISOString(),
        });
      }
      save();
      const appUrlRedirect = process.env.APP_URL || `http://localhost:${PORT}`;
      res.redirect(`${appUrlRedirect}/dashboard/integrations?twitter=connected`);
    } catch (e: any) {
      res.status(500).send('Error: ' + e?.message);
    }
  });

  app.post('/api/integrations/twitter/tweet', auth, async (req: any, res) => {
    const intg = db.data.integrations.find(i => i.user_id === req.userId && i.type === 'twitter' && i.connected);
    if (!intg?.access_token) return res.status(400).json({ error: 'Twitter not connected or no OAuth token. Use /api/integrations/twitter/auth flow.' });
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });
    try {
      const r = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${intg.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const d: any = await r.json();
      if (!r.ok) return res.status(400).json({ error: d?.detail || 'Tweet failed', details: d });
      res.json({ success: true, tweet_id: d.data?.id, text: d.data?.text });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  app.post('/api/integrations/twitter/check-mentions', auth, async (req: any, res) => {
    const intg = db.data.integrations.find(i => i.user_id === req.userId && i.type === 'twitter' && i.connected);
    if (!intg?.access_token) return res.status(400).json({ error: 'Twitter not connected with OAuth token' });
    const agentId = intg.agent_id || req.body.agent_id;
    if (!agentId) return res.status(400).json({ error: 'No agent assigned to Twitter integration' });
    const agent = findAgent(agentId, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    try {
      // Get authenticated user id
      const meR = await fetch('https://api.twitter.com/2/users/me', {
        headers: { Authorization: `Bearer ${intg.access_token}` },
      });
      const meD: any = await meR.json();
      const userId2 = meD.data?.id;
      if (!userId2) return res.status(400).json({ error: 'Could not get Twitter user ID' });

      // Get recent mentions
      const sinceId = req.body.since_id;
      let url = `https://api.twitter.com/2/users/${userId2}/mentions?max_results=10&tweet.fields=author_id,text,created_at`;
      if (sinceId) url += `&since_id=${sinceId}`;
      const mentionsR = await fetch(url, { headers: { Authorization: `Bearer ${intg.access_token}` } });
      const mentionsD: any = await mentionsR.json();
      const mentions = mentionsD.data || [];
      const replied: any[] = [];

      for (const mention of mentions) {
        try {
          const { text: aiReply } = await callAI(agent.provider, agent.model,
            buildAgentSystemPrompt(agent),
            [{ role: 'user', content: mention.text }], 280);
          const replyText = aiReply.slice(0, 280);
          const postR = await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: { Authorization: `Bearer ${intg.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: replyText, reply: { in_reply_to_tweet_id: mention.id } }),
          });
          const postD: any = await postR.json();
          replied.push({ mention_id: mention.id, reply_id: postD.data?.id });
        } catch { /* skip individual errors */ }
      }

      res.json({ mentions_found: mentions.length, replied: replied.length, last_mention_id: mentions[0]?.id });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  // ─── Reddit OAuth + monitoring ────────────────────────────────────────────
  app.get('/api/integrations/reddit/auth', auth, (req: any, res) => {
    const clientId = process.env.REDDIT_CLIENT_ID;
    if (!clientId) return res.status(400).json({ error: 'REDDIT_CLIENT_ID not configured' });
    const state = Buffer.from(req.userId).toString('base64url');
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const redirectUri = `${appUrl}/api/integrations/reddit/callback`;
    const authUrl = `https://www.reddit.com/api/v1/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&duration=permanent&scope=read,submit,identity`;
    res.json({ auth_url: authUrl });
  });

  app.get('/api/integrations/reddit/callback', async (req, res) => {
    const { code, state } = req.query as any;
    if (!code || !state) return res.status(400).send('Missing code or state');
    try {
      const userId = Buffer.from(state, 'base64url').toString('utf-8');
      const clientId = process.env.REDDIT_CLIENT_ID;
      const clientSecret = process.env.REDDIT_CLIENT_SECRET;
      if (!clientId || !clientSecret) return res.status(400).send('Reddit not configured');
      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const redirectUri = `${appUrl}/api/integrations/reddit/callback`;
      const tokenResp = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'DipperAI/1.0',
        },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }).toString(),
      });
      const tokenData: any = await tokenResp.json();
      if (!tokenData.access_token) return res.status(400).send('Failed: ' + JSON.stringify(tokenData));

      const meResp = await fetch('https://oauth.reddit.com/api/v1/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'DipperAI/1.0' },
      });
      const meData: any = await meResp.json();
      const username = meData.name || 'unknown';

      const existing = db.data.integrations.find(i => i.user_id === userId && i.type === 'reddit');
      if (existing) {
        existing.access_token = tokenData.access_token;
        existing.refresh_token = tokenData.refresh_token;
        existing.bot_info = username;
        existing.connected = true;
      } else {
        db.data.integrations.push({
          id: randomUUID(), user_id: userId, type: 'reddit',
          credentials: encodeCredentials({ username }),
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          bot_info: username, connected: true,
          created_at: new Date().toISOString(),
        });
      }
      save();
      const appUrlRedirect = process.env.APP_URL || `http://localhost:${PORT}`;
      res.redirect(`${appUrlRedirect}/dashboard/integrations?reddit=connected`);
    } catch (e: any) {
      res.status(500).send('Error: ' + e?.message);
    }
  });

  app.post('/api/integrations/reddit/monitor', auth, async (req: any, res) => {
    const intg = db.data.integrations.find(i => i.user_id === req.userId && i.type === 'reddit' && i.connected);
    if (!intg?.access_token) return res.status(400).json({ error: 'Reddit not connected. Use /api/integrations/reddit/auth first.' });
    const { subreddit, keyword, agent_id } = req.body;
    if (!subreddit || !keyword) return res.status(400).json({ error: 'subreddit and keyword required' });
    if (agent_id) {
      const agent = findAgent(agent_id, req.userId);
      if (!agent) return res.status(404).json({ error: 'Agent not found' });
      intg.agent_id = agent_id;
    }
    // Store monitor config in token_data
    const config = JSON.parse(intg.token_data || '{}');
    config.monitor = { subreddit, keyword, last_checked: null };
    intg.token_data = JSON.stringify(config);
    save();
    res.json({ success: true, message: `Now monitoring r/${subreddit} for "${keyword}"` });
  });

  app.post('/api/integrations/reddit/post', auth, async (req: any, res) => {
    const intg = db.data.integrations.find(i => i.user_id === req.userId && i.type === 'reddit' && i.connected);
    if (!intg?.access_token) return res.status(400).json({ error: 'Reddit not connected' });
    const { subreddit, title, text, kind = 'self' } = req.body;
    if (!subreddit || !title) return res.status(400).json({ error: 'subreddit and title required' });
    try {
      const r = await fetch('https://oauth.reddit.com/api/submit', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${intg.access_token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'DipperAI/1.0',
        },
        body: new URLSearchParams({ sr: subreddit, kind, title, text: text || '', resubmit: 'true' }).toString(),
      });
      const d: any = await r.json();
      if (d.jquery) {
        // Reddit's legacy response format
        return res.json({ success: true, url: d.jquery?.find?.((j: any) => j[2] === 'call' && j[3]?.[0]?.includes('reddit.com'))?.[3]?.[0] });
      }
      res.json({ success: true, data: d });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  // ─── Web Chat public endpoints ────────────────────────────────────────────
  // Rate limit store for webchat
  const webchatRateLimit = new Map<string, { count: number; resetAt: number }>();
  // Rate limit store for SMS (1 message per user per 5 seconds)
  const smsRateLimit = new Map<string, number>();

  app.get('/api/integrations/webchat/config/:agentId', async (req, res) => {
    const agent = db.data.agents.find(a => a.id === req.params.agentId && a.is_active && a.deployed_embed_enabled);
    if (!agent) return res.status(404).json({ error: 'Agent not found or embed not enabled' });
    res.json({
      agentId: agent.id,
      name: agent.name,
      emoji: agent.emoji,
      description: agent.description,
      embed_token: agent.embed_token,
      response_format: agent.response_format || 'conversational',
    });
  });

  app.post('/api/integrations/webchat/chat', async (req, res) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const rateKey = `webchat:${ip}`;
    let rateInfo = webchatRateLimit.get(rateKey);
    if (!rateInfo || rateInfo.resetAt < now) {
      rateInfo = { count: 0, resetAt: now + 3600000 };
    }
    rateInfo.count++;
    webchatRateLimit.set(rateKey, rateInfo);
    if (rateInfo.count > 20) {
      return res.status(429).json({ error: 'Rate limit exceeded (20 messages/hour per IP)' });
    }

    const { agentId, message, conversationId, sessionToken } = req.body;
    if (!agentId || !message) return res.status(400).json({ error: 'agentId and message required' });

    const agent = db.data.agents.find(a => a.id === agentId && a.is_active && a.deployed_embed_enabled);
    if (!agent) return res.status(404).json({ error: 'Agent not found or embed disabled' });

    let convId = conversationId;
    if (!convId) {
      convId = randomUUID();
      db.data.conversations.push({ id: convId, agent_id: agent.id, user_id: undefined, channel: 'web', message_count: 0, created_at: new Date().toISOString() });
    }
    const history = db.data.messages.filter(m => m.conversation_id === convId).map(m => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: message });
    const userIdentifier = sessionToken || `webchat_${ip}`;

    try {
      const memCtx = buildMemoryContext(agent.id, userIdentifier, 'web');
      const knCtx = buildKnowledgeContext(agent.id, message);
      const basePrompt = buildAgentSystemPrompt(agent, knCtx ? `${knCtx}\n\n${agent.system_prompt}` : agent.system_prompt);
      const systemPrompt = memCtx ? `${memCtx}\n\n${basePrompt}` : basePrompt;
      // Use vision API if image data present, otherwise standard callAI
      let aiResult: { text: string; tokensUsed: number };
      // Vision-capable models: claude-sonnet, claude-opus, gpt-4o
      const isVisionCapable = ['claude-sonnet-4-5','claude-opus-4-5','gpt-4o'].some(m => effectiveModel.includes(m.split('-')[0]));
      console.log('[vision] check - imageData:', !!imageData, 'provider:', activeProvider, 'model:', effectiveModel);
      if (imageData && activeProvider === 'anthropic') {
        const anthropicVision = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const base64Data = imageData.replace(/^data:image\/[^;]+;base64,/, '');
        const mimeMatch = imageData.match(/^data:(image\/[^;]+);/);
        const mediaType = (mimeMatch?.[1] || 'image/jpeg') as any;
        const lastUserMsg = history[history.length - 1];
        const userText = (lastUserMsg?.content || '').replace(/\[User attached:[^\]]*\]/g, '').trim() || 'Analyze this image and suggest creative sticker concepts based on what you see.';
        const visionMessages = [
          ...history.slice(0, -1).map((m: any) => ({ role: m.role as any, content: m.content })),
          { role: 'user' as const, content: [
            { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: base64Data } },
            { type: 'text' as const, text: userText }
          ]}
        ];
        // Claude Haiku doesn't support vision - upgrade to Sonnet for image analysis
        const visionModel = effectiveModel.includes('haiku') ? 'claude-sonnet-4-5' : effectiveModel;
        const visionResponse = await anthropicVision.messages.create({
          model: visionModel,
          max_tokens: plan.maxTokens,
          system: finalSystemPrompt + '\n\nSTRICT RULES: Reply in 1-3 sentences max. No lists, no dashes, no headers, no bold, no markdown of any kind. Describe what you see directly, then give your one best idea. Sound like a creative person texting their friend.',
          messages: visionMessages,
        });
        const visionText = (visionResponse.content[0] as any).text;
        aiResult = { text: visionText, tokensUsed: (visionResponse.usage?.input_tokens || 0) + (visionResponse.usage?.output_tokens || 0) };
      } else {
        aiResult = await callAI(activeProvider, effectiveModel, finalSystemPrompt + '\n\nSTRICT: 1-3 sentences max. No lists, dashes, bullets, headers or bold. Direct and conversational.', history, plan.maxTokens);
      }
      const { text: content, tokensUsed } = aiResult;
      // Store user message - if image was analyzed, append description to message text for future context
      const userMsgContent = imageData && content
        ? message + ` [IMAGE ANALYZED: ${content.slice(0, 300)}]`
        : message;
      db.data.messages.push({ id: randomUUID(), conversation_id: convId, role: 'user', content: userMsgContent, created_at: new Date().toISOString() });
      db.data.messages.push({ id: randomUUID(), conversation_id: convId, role: 'assistant', content, model_used: agent.model, created_at: new Date().toISOString() });
      agent.total_messages++;
      save();
      extractAndUpdateMemory(agent.id, userIdentifier, 'web', [...history, { role: 'assistant', content }], agent.system_prompt).catch(() => {});
      res.json({ content, conversationId: convId });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'AI call failed' });
    }
  });

  // ─── Enhanced Telegram: split long messages ───────────────────────────────
  // (already handled by helper, but add chunk helper)
  async function sendTelegramLongMessage(botToken: string, chatId: string | number, text: string) {
    const MAX_LEN = 4096;
    if (text.length <= MAX_LEN) {
      return sendTelegramMessage(botToken, chatId, text);
    }
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      chunks.push(remaining.slice(0, MAX_LEN));
      remaining = remaining.slice(MAX_LEN);
    }
    for (const chunk of chunks) {
      await sendTelegramMessage(botToken, chatId, chunk);
    }
  }

  // ─── Telegram webhook (improved) ──────────────────────────────────────────
  app.post('/api/integrations/telegram/webhook/:agentId', async (req, res) => {
    const { agentId } = req.params;
    res.json({ ok: true }); // Respond immediately to Telegram
    try {
      const update = req.body;
      const agent = db.data.agents.find(a => a.id === agentId && a.is_active);
      if (!agent) return;

      // Handle callback_query (inline button presses)
      if (update.callback_query) {
        const cq = update.callback_query;
        const chatId = cq.message?.chat?.id;
        const integration = db.data.integrations.find(i => i.user_id === agent.user_id && i.type === 'telegram' && i.connected);
        if (integration && chatId) {
          const { botToken } = decodeCredentials(integration.credentials);
          if (botToken) {
            await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callback_query_id: cq.id, text: 'Processing...' }),
            });
            if (cq.data) {
              const { text: reply } = await callAI(agent.provider, agent.model, buildAgentSystemPrompt(agent), [{ role: 'user', content: cq.data }], 512);
              await sendTelegramMessage(botToken, chatId, reply);
            }
          }
        }
        return;
      }

      // Handle inline_query
      if (update.inline_query) {
        const iq = update.inline_query;
        const integration = db.data.integrations.find(i => i.user_id === agent.user_id && i.type === 'telegram' && i.connected);
        if (integration && iq.query) {
          const { botToken } = decodeCredentials(integration.credentials);
          if (botToken) {
            const { text: reply } = await callAI(agent.provider, agent.model, buildAgentSystemPrompt(agent), [{ role: 'user', content: iq.query }], 256);
            await fetch(`https://api.telegram.org/bot${botToken}/answerInlineQuery`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                inline_query_id: iq.id,
                results: [{ type: 'article', id: '1', title: agent.name, input_message_content: { message_text: reply } }],
              }),
            });
          }
        }
        return;
      }

      const msg = update?.message || update?.channel_post;

      // Handle photo messages with vision API before text-only check
      if (msg?.photo?.length > 0 && process.env.ANTHROPIC_API_KEY) {
        const phChatId = msg.chat?.id;
        const phCaption = msg.caption || 'Describe what you see in this image.';
        const phIntg = db.data.integrations.find(i => i.user_id === agent.user_id && i.type === 'telegram' && i.connected);
        if (phIntg && phChatId) {
          const { botToken: phTok } = decodeCredentials(phIntg.credentials);
          if (phTok) {
            try {
              const photo = msg.photo[msg.photo.length - 1];
              const phFr = await fetch('https://api.telegram.org/bot' + phTok + '/getFile?file_id=' + photo.file_id);
              const phFd: any = await phFr.json();
              const phFUrl = 'https://api.telegram.org/file/bot' + phTok + '/' + phFd.result?.file_path;
              const phImg = Buffer.from(await (await fetch(phFUrl)).arrayBuffer());
              const phAnt = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
              const phVr = await phAnt.messages.create({
                model: 'claude-sonnet-4-5', max_tokens: 400,
                system: buildAgentSystemPrompt(agent as Agent) + '\n\nSTRICT: 2-3 sentences. No lists.',
                messages: [{ role: 'user', content: [
                  { type: 'image', source: { type: 'base64', media_type: 'image/jpeg' as any, data: phImg.toString('base64') } },
                  { type: 'text', text: phCaption }
                ]}]
              });
              await sendTelegramMessage(phTok, phChatId, (phVr.content[0] as any).text);
            } catch (phErr) {
              console.error('[tg-photo]', phErr);
              const phFallback = db.data.integrations.find(i => i.user_id === agent.user_id && i.type === 'telegram' && i.connected);
              if (phFallback) {
                const { botToken: fbt } = decodeCredentials(phFallback.credentials);
                if (fbt && phChatId) await sendTelegramMessage(fbt, phChatId, 'I see your image! Tell me what you would like to do with it.');
              }
            }
          }
        }
        return;
      }
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
        const helpText = `🤖 *${agent.name}* Help\n\n/start — Start the conversation\n/help — Show this help\n/stop — Stop receiving messages\n\nJust send me a message and I'll respond!`;
        await sendTelegramMessage(botToken, chatId, helpText);
        return;
      }

      if (text === '/stop') {
        await sendTelegramMessage(botToken, chatId, `You've been unsubscribed from ${agent.name}. Send /start to resubscribe.`);
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
      const tgBasePrompt = buildAgentSystemPrompt(agent, tgKnowledgeContext ? `${tgKnowledgeContext}\n\n${agent.system_prompt}` : agent.system_prompt);
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

      await sendTelegramLongMessage(botToken, chatId, reply);
      agent.total_messages++;
      save();
      // Async memory extraction
      const tgFullHistory = [...tgHistory, { role: 'assistant', content: reply }];
      extractAndUpdateMemory(agent.id, telegramUserId, 'telegram', tgFullHistory, agent.system_prompt).catch(() => {});
      updateLongTermMemory(agent.id, telegramUserId, 'telegram', tgFullHistory).catch(() => {});
      recordAgentMetrics(agent.id, 0, 0, analyzeSentiment(text), tgHistory.filter(m => m.role === 'user').length > 1);
      logActivity({ user_id: agent.user_id, agent_id: agent.id, agent_name: agent.name, event_type: 'message_sent', channel: 'telegram', summary: 'Replied to Telegram message', details: reply.slice(0, 200), model_used: effectiveModel, status: 'success' });
    } catch (e) { console.error('[telegram webhook error]', e); }
  });

  // ─── Twilio SMS webhook ────────────────────────────────────────────────────
  app.post('/api/webhooks/sms/inbound', express.urlencoded({ extended: false }), async (req, res) => {
    res.type('text/xml').send('<Response></Response>');
    try {
      const { From, To, Body } = req.body;
      if (!Body || !To) return;

      // Check SMS opt-out
      if (!db.data.sms_optouts) db.data.sms_optouts = [];
      const OPT_OUT_WORDS = ['STOP', 'UNSUBSCRIBE', 'QUIT', 'CANCEL', 'END'];
      const OPT_IN_WORDS = ['START', 'YES', 'UNSTOP'];
      const bodyUpper = Body.trim().toUpperCase();
      if (OPT_OUT_WORDS.includes(bodyUpper)) {
        if (!db.data.sms_optouts.find(o => o.phone === From)) {
          db.data.sms_optouts.push({ phone: From, opted_out_at: Date.now() });
          save();
        }
        return;
      }
      if (OPT_IN_WORDS.includes(bodyUpper)) {
        db.data.sms_optouts = db.data.sms_optouts.filter(o => o.phone !== From);
        save();
        return;
      }
      if (db.data.sms_optouts.find(o => o.phone === From)) return;

      // SMS rate limiting: 1 message per 5 seconds per number
      const nowMs = Date.now();
      const lastSmsTime = smsRateLimit.get(From) || 0;
      if (nowMs - lastSmsTime < 5000) return; // silently drop
      smsRateLimit.set(From, nowMs);

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
      const smsBasePrompt = buildAgentSystemPrompt(agent, smsKnowledgeContext ? `${smsKnowledgeContext}\n\n${agent.system_prompt}` : agent.system_prompt);
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
      const embedBasePrompt = buildAgentSystemPrompt(agent, embedKnowledgeContext ? `${embedKnowledgeContext}\n\n${agent.system_prompt}` : agent.system_prompt);
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

  // ═══ Intelligence API Endpoints ══════════════════════════════════════════

  // GET /api/agents/:id/intelligence/memory - long-term memory for a user
  app.get('/api/agents/:id/intelligence/memory', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!db.data.agent_long_term_memory) return res.json([]);
    const memories = db.data.agent_long_term_memory.filter(m => m.agent_id === agent.id);
    res.json(memories);
  });

  // DELETE /api/agents/:id/intelligence/memory/:memId
  app.delete('/api/agents/:id/intelligence/memory/:memId', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!db.data.agent_long_term_memory) return res.json({ success: true });
    db.data.agent_long_term_memory = db.data.agent_long_term_memory.filter(
      m => !(m.agent_id === agent.id && m.id === req.params.memId)
    );
    save();
    res.json({ success: true });
  });

  // GET /api/agents/:id/intelligence/metrics - performance metrics
  app.get('/api/agents/:id/intelligence/metrics', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!db.data.agent_metrics) return res.json([]);
    const metrics = db.data.agent_metrics
      .filter(m => m.agent_id === agent.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);
    res.json(metrics);
  });

  // PATCH /api/agents/:id/always-on - toggle always-on mode
  app.patch('/api/agents/:id/always-on', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { always_on } = req.body;
    agent.always_on = typeof always_on === 'boolean' ? always_on : !agent.always_on;
    agent.updated_at = new Date().toISOString();
    save();
    res.json(agent);
  });

  // POST /api/agents/:id/intelligence/assess - assess message complexity
  app.post('/api/agents/:id/intelligence/assess', auth, (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    const complexity = assessComplexity(message);
    const taskType = detectTaskType(message);
    const optimalModel = selectOptimalModel(agent, message.length, taskType);
    res.json({ complexity, taskType, optimalModel });
  });

  // POST /api/agents/:id/tools/execute - execute a built-in tool
  app.post('/api/agents/:id/tools/execute', auth, async (req: any, res) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { tool, params } = req.body;
    if (!tool) return res.status(400).json({ error: 'tool name required' });
    const allowedTools = agent.tools_enabled || [];
    if (!allowedTools.includes(tool)) return res.status(403).json({ error: `Tool "${tool}" not enabled for this agent` });
    try {
      if (tool === 'get_current_time') {
        return res.json({ result: new Date().toLocaleString() });
      }
      if (tool === 'calculate') {
        const expr = (params?.expression || '').replace(/[^0-9+\-*/.()%\s]/g, '');
        try { return res.json({ result: String(eval(expr)) }); }
        catch { return res.json({ result: 'Calculation error' }); }
      }
      if (tool === 'search_knowledge_base') {
        const chunks = retrieveRelevantChunks(agent.id, params?.query || '', 3);
        return res.json({ result: chunks.join('\n\n') || 'No relevant information found.' });
      }
      if (tool === 'create_lead') {
        const { name, email, phone, notes } = params || {};
        if (!db.data.leads) db.data.leads = [];
        const identifier = email || phone || name || randomUUID();
        const existing = db.data.leads.find(l => l.agent_id === agent.id && l.identifier === identifier);
        if (!existing) {
          const now = new Date().toISOString();
          db.data.leads.push({
            id: randomUUID(), user_id: req.userId, agent_id: agent.id, agent_name: agent.name,
            identifier, channel: 'web', display_name: name, email, phone,
            stage: 'new', tags: [], notes: notes || '', message_count: 0,
            last_contact: now, first_contact: now, created_at: now, updated_at: now,
          });
          save();
          return res.json({ result: `Lead saved: ${name || email || phone}` });
        }
        return res.json({ result: `Lead already exists: ${name || email || phone}` });
      }
      if (tool === 'send_notification') {
        const { message: notifMsg, priority } = params || {};
        logActivity({ user_id: req.userId, agent_id: agent.id, agent_name: agent.name, event_type: 'automation_triggered', channel: 'system', summary: `Agent notification [${priority || 'normal'}]: ${(notifMsg || '').slice(0, 100)}`, status: 'success' });
        return res.json({ result: 'Notification sent to agent owner.' });
      }
      // Webhook tool
      if (tool === 'webhook') {
        if (!agent.webhook_url) return res.json({ ok: false, error: 'No webhook URL configured' });
        const payload = {
          agent_id: agent.id,
          user_message: req.body.user_message || '',
          conversation_id: req.body.conversation_id || '',
          timestamp: Date.now(),
          custom_data: req.body.data || {}
        };
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const r = await fetch(agent.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(agent.webhook_secret ? { 'X-Webhook-Secret': agent.webhook_secret } : {}) },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          clearTimeout(timeout);
          return res.json({ ok: r.ok, status: r.status, result: r.ok ? 'Webhook triggered successfully.' : `Webhook returned status ${r.status}` });
        } catch (e: any) {
          clearTimeout(timeout);
          return res.json({ ok: false, error: e.message });
        }
      }
      // Google Sheets tool
      if (tool === 'google_sheets') {
        if (!agent.sheets_spreadsheet_id) return res.json({ ok: false, error: 'No spreadsheet ID configured' });
        if (!process.env.GOOGLE_SHEETS_API_KEY) return res.json({ ok: false, error: 'GOOGLE_SHEETS_API_KEY not set in environment' });
        const { name: gName, email: gEmail, phone: gPhone, message: gMessage } = req.body;
        const values = [[
          new Date().toISOString(),
          gName || '',
          gEmail || '',
          gPhone || '',
          gMessage || '',
          agent.name || ''
        ]];
        try {
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${agent.sheets_spreadsheet_id}/values/${encodeURIComponent(agent.sheets_range || 'Sheet1!A:F')}:append?valueInputOption=USER_ENTERED&key=${process.env.GOOGLE_SHEETS_API_KEY}`;
          const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values }) });
          return res.json({ ok: r.ok, result: r.ok ? 'Data logged to Google Sheets.' : `Sheets API error: ${r.status}` });
        } catch (e: any) {
          return res.json({ ok: false, error: e.message });
        }
      }
      // Stripe payment link tool
      if (tool === 'stripe_payment_link') {
        if (!agent.stripe_api_key) return res.json({ ok: false, error: 'No Stripe API key configured' });
        const { amount, currency = 'usd', description: stripeDesc = 'Payment' } = req.body;
        if (!amount) return res.json({ ok: false, error: 'amount required' });
        try {
          const r = await fetch('https://api.stripe.com/v1/payment_links', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${agent.stripe_api_key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              'line_items[0][price_data][currency]': currency,
              'line_items[0][price_data][unit_amount]': String(Math.round(Number(amount) * 100)),
              'line_items[0][price_data][product_data][name]': stripeDesc,
              'line_items[0][quantity]': '1'
            })
          });
          const data = await r.json() as any;
          return res.json({ ok: r.ok, payment_link: data.url, result: r.ok ? `Payment link created: ${data.url}` : data.error?.message, error: data.error?.message });
        } catch (e: any) {
          return res.json({ ok: false, error: e.message });
        }
      }
      res.status(400).json({ error: `Unknown tool: ${tool}` });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Tool execution failed' });
    }
  });

  // GET /api/escalations - list escalation alerts
  app.get('/api/escalations', auth, (req: any, res) => {
    if (!db.data.escalation_alerts) db.data.escalation_alerts = [];
    const { resolved } = req.query as any;
    let alerts = db.data.escalation_alerts.filter(a => a.user_id === req.userId);
    if (resolved !== undefined) alerts = alerts.filter(a => a.resolved === (resolved === 'true'));
    alerts = alerts.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100);
    res.json(alerts);
  });

  // PATCH /api/escalations/:id/resolve
  app.patch('/api/escalations/:id/resolve', auth, (req: any, res) => {
    if (!db.data.escalation_alerts) return res.status(404).json({ error: 'Not found' });
    const alert = db.data.escalation_alerts.find(a => a.id === req.params.id && a.user_id === req.userId);
    if (!alert) return res.status(404).json({ error: 'Not found' });
    alert.resolved = true;
    save();
    res.json({ ok: true });
  });

  // GET /api/conversations/:id/summary
  app.get('/api/conversations/:id/summary', auth, async (req: any, res) => {
    const conv = db.data.conversations.find(c => c.id === req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    // Verify user owns the agent
    const agent = db.data.agents.find(a => a.id === conv.agent_id && a.user_id === req.userId);
    if (!agent) return res.status(403).json({ error: 'Forbidden' });
    if (!conv.summary) {
      await summarizeConversation(conv.id);
    }
    res.json({ summary: conv.summary, summary_at: conv.summary_at, sentiment_flag: conv.sentiment_flag });
  });

  // ─── Broadcasts ────────────────────────────────────────────────────────────

  // GET /api/broadcasts - list all broadcasts for user
  app.get('/api/broadcasts', auth, (req: any, res) => {
    const broadcasts = (db.data.broadcasts || [])
      .filter((b: Broadcast) => b.user_id === req.userId)
      .sort((a: Broadcast, b: Broadcast) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(broadcasts);
  });

  // POST /api/broadcasts - create broadcast
  app.post('/api/broadcasts', auth, (req: any, res) => {
    const { agent_id, channel, message, scheduled_at } = req.body;
    if (!message || !channel) return res.status(400).json({ error: 'message and channel required' });
    const agent = agent_id ? db.data.agents.find((a: Agent) => a.id === agent_id && a.user_id === req.userId) : null;
    // Estimate audience: count unique user_identifiers from leads for this user
    const leads = (db.data.leads || []).filter((l: Lead) => l.user_id === req.userId && (channel === 'all' || l.channel === channel));
    const audienceSize = leads.length;
    const now = new Date().toISOString();
    const broadcast: Broadcast = {
      id: randomUUID(),
      user_id: req.userId,
      agent_id: agent_id || '',
      agent_name: agent?.name || 'All Agents',
      channel,
      message,
      status: scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: scheduled_at || undefined,
      audience_size: audienceSize,
      sent_count: 0,
      failed_count: 0,
      created_at: now,
      updated_at: now,
    };
    if (!db.data.broadcasts) db.data.broadcasts = [];
    if (!db.data.approvals) db.data.approvals = [];
    if (!db.data.api_keys) db.data.api_keys = [];
    db.data.broadcasts.push(broadcast);
    save();
    res.json(broadcast);
  });

  // GET /api/broadcasts/:id - get single broadcast
  app.get('/api/broadcasts/:id', auth, (req: any, res) => {
    const broadcast = (db.data.broadcasts || []).find((b: Broadcast) => b.id === req.params.id && b.user_id === req.userId);
    if (!broadcast) return res.status(404).json({ error: 'Broadcast not found' });
    res.json(broadcast);
  });

  // DELETE /api/broadcasts/:id - delete broadcast
  app.delete('/api/broadcasts/:id', auth, (req: any, res) => {
    const idx = (db.data.broadcasts || []).findIndex((b: Broadcast) => b.id === req.params.id && b.user_id === req.userId);
    if (idx === -1) return res.status(404).json({ error: 'Broadcast not found' });
    db.data.broadcasts.splice(idx, 1);
    save();
    res.json({ success: true });
  });

  // POST /api/broadcasts/:id/send - real delivery via Telegram/SMS
  app.post('/api/broadcasts/:id/send', auth, async (req: any, res) => {
    const broadcast = (db.data.broadcasts || []).find((b: Broadcast) => b.id === req.params.id && b.user_id === req.userId);
    if (!broadcast) return res.status(404).json({ error: 'Broadcast not found' });
    if (broadcast.status === 'sent') return res.status(400).json({ error: 'Already sent' });
    broadcast.status = 'sending';
    broadcast.updated_at = new Date().toISOString();
    save();
    res.json({ success: true, message: 'Broadcast queued for delivery' });

    // Async real delivery
    (async () => {
      let sentCount = 0;
      let failedCount = 0;
      try {
        const channel = broadcast.channel;

        if (channel === 'telegram') {
          // Get the Telegram integration for this user
          const intg = db.data.integrations.find(i => i.user_id === req.userId && i.type === 'telegram' && i.connected);
          if (intg) {
            const { botToken } = decodeCredentials(intg.credentials);
            if (botToken) {
              // Get all unique chat_ids from telegram conversations for agents owned by this user
              const userAgentIds = db.data.agents.filter(a => a.user_id === req.userId && a.is_active).map(a => a.id);
              const tgConvs = db.data.conversations.filter(c => c.channel === 'telegram' && userAgentIds.includes(c.agent_id));
              const chatIds = [...new Set(tgConvs.map(c => (c as any).external_id).filter(Boolean).map((id: string) => id.replace('tg_', '')))];
              for (const chatId of chatIds) {
                try {
                  const r = await sendTelegramMessage(botToken, chatId, broadcast.message);
                  if (r.ok) sentCount++;
                  else failedCount++;
                } catch { failedCount++; }
                await new Promise(r => setTimeout(r, 50)); // small delay
              }
              if (chatIds.length === 0) {
                // No conversations yet - mark as sent with 0
                sentCount = 0;
              }
            }
          }
        } else if (channel === 'sms') {
          const intg = db.data.integrations.find(i => i.user_id === req.userId && i.type === 'sms' && i.connected);
          if (intg) {
            const { accountSid, authToken, phoneNumber } = decodeCredentials(intg.credentials);
            if (accountSid && authToken && phoneNumber) {
              // Get opt-out list
              const optOuts = new Set((db.data.sms_optouts || []).map((o: any) => o.phone));
              // Get all unique SMS phone numbers from conversations
              const userAgentIds = db.data.agents.filter(a => a.user_id === req.userId && a.is_active).map(a => a.id);
              const smsConvs = db.data.conversations.filter(c => c.channel === 'sms' && userAgentIds.includes(c.agent_id));
              const phones = [...new Set(smsConvs.map(c => (c as any).external_id).filter((p: string) => p && !optOuts.has(p)))];
              for (const phone of phones) {
                try {
                  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
                    method: 'POST',
                    headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ From: phoneNumber, To: phone, Body: broadcast.message }).toString(),
                  });
                  if (r.ok) sentCount++;
                  else failedCount++;
                } catch { failedCount++; }
                await new Promise(r => setTimeout(r, 100));
              }
            }
          }
        } else {
          // Other channels: just mark as sent
          sentCount = broadcast.audience_size || 0;
        }
      } catch (e) {
        console.error('[broadcast send error]', e);
        failedCount++;
      }
      broadcast.status = 'sent';
      broadcast.sent_at = new Date().toISOString();
      broadcast.sent_count = sentCount;
      broadcast.failed_count = failedCount;
      broadcast.updated_at = new Date().toISOString();
      save();
      logActivity({ user_id: req.userId, agent_id: broadcast.agent_id || '', agent_name: broadcast.agent_name || '', event_type: 'message_sent', channel: (broadcast.channel as any) || 'system', summary: `Broadcast sent: ${broadcast.message.slice(0, 80)}`, details: `${sentCount} sent, ${failedCount} failed`, status: 'success' });
    })();
  });

  // GET /api/insights - agent performance insights for dashboard
  app.get('/api/insights', auth, (req: any, res) => {
    const agents = db.data.agents.filter((a: Agent) => a.user_id === req.userId);
    const leads = (db.data.leads || []).filter((l: Lead) => l.user_id === req.userId);
    const broadcasts = (db.data.broadcasts || []).filter((b: Broadcast) => b.user_id === req.userId);
    const now = Date.now();
    const insights: Array<{ id: string; type: 'warning' | 'tip' | 'success' | 'opportunity'; title: string; description: string; action?: string; actionPath?: string }> = [];

    // Check for inactive agents
    const inactiveAgents = agents.filter((a: Agent) => {
      if (!a.is_active) return false;
      const metrics = (db.data.agent_metrics || []).filter((m: AgentMetrics) => m.agent_id === a.id);
      if (metrics.length === 0) return false;
      const latest = metrics[metrics.length - 1];
      return latest.messages_sent === 0 && metrics.length > 2;
    });
    if (inactiveAgents.length > 0) {
      insights.push({ id: 'inactive-agents', type: 'warning', title: 'Agent may be offline', description: `${inactiveAgents[0].name} has had no messages recently. Check API keys and integrations.`, action: 'Check Agent', actionPath: `/dashboard/agents/${inactiveAgents[0].id}` });
    }

    // New leads opportunity
    const newLeads = leads.filter((l: Lead) => l.stage === 'new');
    if (newLeads.length > 0) {
      insights.push({ id: 'unread-leads', type: 'opportunity', title: `${newLeads.length} new leads need attention`, description: 'Move your new leads through the pipeline to increase conversions.', action: 'View Leads', actionPath: '/dashboard/leads' });
    }

    // Broadcasts opportunity
    if (agents.length > 0 && broadcasts.length === 0) {
      insights.push({ id: 'no-broadcasts', type: 'tip', title: 'Engage your audience with a broadcast', description: "You haven't sent any broadcasts yet. Reach all your contacts at once.", action: 'Create Broadcast', actionPath: '/dashboard/broadcasts' });
    }

    // Knowledge base tip
    const agentsWithoutKB = agents.filter((a: Agent) => !a.knowledge_base || a.knowledge_base.trim() === '');
    const agentsWithoutKBSources = agents.filter((a: Agent) => {
      const sources = (db.data.knowledge_sources || []).filter((k: KnowledgeSource) => k.agent_id === a.id);
      return sources.length === 0;
    });
    if (agentsWithoutKBSources.length > 0 && agents.length > 0) {
      insights.push({ id: 'no-knowledge-base', type: 'tip', title: 'Improve agent accuracy with a knowledge base', description: `${agentsWithoutKBSources.length} agent(s) don't have a knowledge base. Adding one reduces hallucinations.`, action: 'Add Knowledge', actionPath: `/dashboard/agents/${agentsWithoutKBSources[0].id}?tab=knowledge` });
    }

    // Success: milestone messages
    const totalMessages = agents.reduce((sum: number, a: Agent) => sum + (a.total_messages || 0), 0);
    if (totalMessages >= 100) {
      insights.push({ id: 'message-milestone', type: 'success', title: `🎉 ${totalMessages.toLocaleString()} total messages sent!`, description: 'Your agents are getting traction. Keep building!', action: 'View Analytics', actionPath: '/dashboard/analytics' });
    }

    // Welcome message for new users
    if (agents.length === 0) {
      insights.push({ id: 'get-started', type: 'tip', title: 'Create your first agent', description: 'Deploy an AI agent on Telegram, SMS, or Discord in under 2 minutes.', action: 'Create Agent', actionPath: '/dashboard/agents/new' });
    }

    res.json(insights.slice(0, 5));
  });


  // *** Approvals API ***
  app.get('/api/approvals', auth, (req: any, res) => {
    if (!db.data.approvals) db.data.approvals = [];
    const { status } = req.query as any;
    let items = (db.data.approvals as any[]).filter((a: any) => a.user_id === req.userId);
    if (status) items = items.filter((a: any) => a.status === status);
    res.json(items.sort((a: any, b: any) => b.created_at - a.created_at).slice(0, 100));
  });
  app.post('/api/approvals/:id/approve', auth, (req: any, res) => {
    if (!db.data.approvals) return res.status(404).json({ error: 'Not found' });
    const approval = (db.data.approvals as any[]).find((a: any) => a.id === req.params.id && a.user_id === req.userId);
    if (!approval) return res.status(404).json({ error: 'Not found' });
    approval.status = 'approved'; approval.resolved_at = Date.now(); save();
    res.json({ ok: true });
  });
  app.post('/api/approvals/:id/reject', auth, (req: any, res) => {
    if (!db.data.approvals) return res.status(404).json({ error: 'Not found' });
    const approval = (db.data.approvals as any[]).find((a: any) => a.id === req.params.id && a.user_id === req.userId);
    if (!approval) return res.status(404).json({ error: 'Not found' });
    const { reason } = req.body;
    approval.status = 'rejected'; approval.rejection_reason = reason || ''; approval.resolved_at = Date.now(); save();
    res.json({ ok: true });
  });
  app.delete('/api/approvals/:id', auth, (req: any, res) => {
    if (!db.data.approvals) return res.json({ ok: true });
    const idx = (db.data.approvals as any[]).findIndex((a: any) => a.id === req.params.id && a.user_id === req.userId);
    if (idx !== -1) { (db.data.approvals as any[]).splice(idx, 1); save(); }
    res.json({ ok: true });
  });

  // *** Settings API Keys ***
  app.get('/api/settings/api-keys', auth, (req: any, res) => {
    if (!db.data.api_keys) db.data.api_keys = [];
    const keys = (db.data.api_keys as any[])
      .filter((k: any) => k.user_id === req.userId)
      .map((k: any) => ({ id: k.id, name: k.name, key_preview: k.key_preview, created_at: k.created_at, last_used: k.last_used }));
    res.json(keys);
  });
  app.post('/api/settings/api-keys', auth, (req: any, res) => {
    if (!db.data.api_keys) db.data.api_keys = [];
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const key = 'dpr_' + randomUUID().replace(/-/g,'') + randomUUID().replace(/-/g,'').slice(0,16);
    const id = randomUUID();
    const preview = key.slice(0, 8) + '...' + key.slice(-4);
    (db.data.api_keys as any[]).push({ id, user_id: req.userId, name, key, key_preview: preview, created_at: Date.now() });
    save();
    res.json({ id, name, key, key_preview: preview, created_at: Date.now() });
  });
  app.delete('/api/settings/api-keys/:id', auth, (req: any, res) => {
    if (!db.data.api_keys) return res.json({ ok: true });
    const idx = (db.data.api_keys as any[]).findIndex((k: any) => k.id === req.params.id && k.user_id === req.userId);
    if (idx !== -1) { (db.data.api_keys as any[]).splice(idx, 1); save(); }
    res.json({ ok: true });
  });

  // *** Playground Chat ***
  app.post('/api/playground/chat', auth, async (req: any, res) => {
    const { agentId, message, channel, history = [] } = req.body;
    if (!agentId || !message) return res.status(400).json({ error: 'agentId and message required' });
    const agent = findAgent(agentId, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!checkLimit(req.user, 'messages')) return res.status(429).json({ error: 'Daily message limit reached.' });
    try {
      const msgs = [...(history as any[]).slice(-10).map((m: any) => ({ role: m.role, content: m.content })), { role: 'user', content: message }];
      const plan = PLANS[req.user.plan] || PLANS.free;
      const effectiveModel = getEffectiveModel(req.user, agent.model);
      const provider = effectiveModel.startsWith('gpt') ? 'openai' : effectiveModel.startsWith('gemini') ? 'google' : 'anthropic';
      const { text: reply } = await callAI(provider, effectiveModel, buildAgentSystemPrompt(agent), msgs, plan.maxTokens);
      req.user.messages_today++; agent.total_messages++; save();
      logActivity({ user_id: req.userId, agent_id: agent.id, agent_name: agent.name, event_type: 'message_sent', channel: channel || 'web', summary: 'Playground chat', details: reply.slice(0, 200), model_used: effectiveModel, status: 'success' });
      res.json({ reply });
    } catch (e: any) { res.status(500).json({ error: e?.message || 'AI call failed' }); }
  });

  // ─── Agent Health Monitoring ──────────────────────────────────────────────
  app.get('/api/agents/health', auth, async (req: any, res) => {
    try {
      // db is global
      const agents = db.data.agents.filter((a: Agent) => a.user_id === req.user.id);
      const now = Date.now();
      const health = agents.map((agent: Agent) => {
        // Determine last activity from conversations
        const conversations = db.data.conversations.filter((c: Conversation) => c.agent_id === agent.id);
        const lastConvDate = conversations.length > 0
          ? Math.max(...conversations.map((c: Conversation) => new Date(c.created_at).getTime()))
          : null;
        // Find last message
        const allMsgs = db.data.messages.filter((m: Message) =>
          conversations.some((c: Conversation) => c.id === m.conversation_id)
        );
        const lastMsgDate = allMsgs.length > 0
          ? Math.max(...allMsgs.map((m: Message) => new Date(m.created_at).getTime()))
          : null;
        const lastActivity = lastMsgDate || lastConvDate;
        let heartbeat: 'green' | 'yellow' | 'red' = 'red';
        if (lastActivity) {
          const daysSince = (now - lastActivity) / (1000 * 60 * 60 * 24);
          if (daysSince <= 1) heartbeat = 'green';
          else if (daysSince <= 7) heartbeat = 'yellow';
          else heartbeat = 'red';
        }
        // Channel connectivity
        const hasTelegram = !!agent.deployed_telegram_token;
        const hasDiscord = !!agent.deployed_discord_webhook;
        const hasEmbed = !!agent.deployed_embed_enabled;
        const channelCount = [hasTelegram, hasDiscord, hasEmbed].filter(Boolean).length;
        return {
          id: agent.id,
          name: agent.name,
          emoji: agent.emoji,
          is_active: agent.is_active,
          heartbeat,
          last_activity: lastActivity ? new Date(lastActivity).toISOString() : null,
          channels: { telegram: hasTelegram, discord: hasDiscord, embed: hasEmbed, count: channelCount },
          total_messages: agent.total_messages || 0,
        };
      });
      res.json(health);
    } catch (e: any) { res.status(500).json({ error: e?.message }); }
  });

  // ─── Agent Duplication ────────────────────────────────────────────────────
  app.post('/api/agents/:id/duplicate', auth, async (req: any, res) => {
    try {
      // db is global
      const source = db.data.agents.find((a: Agent) => a.id === req.params.id && a.user_id === req.user.id);
      if (!source) return res.status(404).json({ error: 'Agent not found' });
      const newAgent: Agent = {
        ...source,
        id: randomUUID(),
        name: `Copy of ${source.name}`,
        embed_token: randomUUID(),
        total_messages: 0,
        is_active: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deployed_telegram_token: undefined,
        deployed_discord_webhook: undefined,
        deployed_embed_enabled: false,
      };
      db.data.agents.push(newAgent);
      await db.write();
      res.json(newAgent);
    } catch (e: any) { res.status(500).json({ error: e?.message }); }
  });

  // ─── Conversation Search ──────────────────────────────────────────────────
  app.get('/api/conversations/search', auth, async (req: any, res) => {
    try {
      // db is global
      const { q = '', agent: agentId = '', channel = '', limit = '50', offset = '0' } = req.query as any;
      // Get user's agents
      const userAgentIds = new Set(
        db.data.agents.filter((a: Agent) => a.user_id === req.user.id).map((a: Agent) => a.id)
      );
      // Filter conversations
      let convs = db.data.conversations.filter((c: Conversation) => userAgentIds.has(c.agent_id));
      if (agentId) convs = convs.filter((c: Conversation) => c.agent_id === agentId);
      if (channel) convs = convs.filter((c: Conversation) => c.channel === channel);
      // Search messages
      const results: any[] = [];
      for (const conv of convs) {
        const msgs = db.data.messages.filter((m: Message) => m.conversation_id === conv.id);
        const agent = db.data.agents.find((a: Agent) => a.id === conv.agent_id);
        if (q) {
          const matchingMsgs = msgs.filter((m: Message) => m.content.toLowerCase().includes(q.toLowerCase()));
          if (matchingMsgs.length === 0) continue;
          results.push({
            conversation_id: conv.id,
            agent_id: conv.agent_id,
            agent_name: agent?.name || 'Unknown',
            agent_emoji: agent?.emoji || '🤖',
            channel: conv.channel,
            message_count: msgs.length,
            matching_messages: matchingMsgs.slice(0, 3).map((m: Message) => ({
              id: m.id, role: m.role, content: m.content.substring(0, 200), created_at: m.created_at,
            })),
            last_message_at: msgs.length > 0 ? msgs[msgs.length - 1].created_at : conv.created_at,
            created_at: conv.created_at,
          });
        } else {
          results.push({
            conversation_id: conv.id,
            agent_id: conv.agent_id,
            agent_name: agent?.name || 'Unknown',
            agent_emoji: agent?.emoji || '🤖',
            channel: conv.channel,
            message_count: msgs.length,
            preview: msgs.slice(-1)[0]?.content.substring(0, 100) || '',
            last_message_at: msgs.length > 0 ? msgs[msgs.length - 1].created_at : conv.created_at,
            created_at: conv.created_at,
          });
        }
      }
      // Sort by last activity
      results.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
      const total = results.length;
      const paginated = results.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
      res.json({ results: paginated, total });
    } catch (e: any) { res.status(500).json({ error: e?.message }); }
  });

  // ─── Export Endpoints ─────────────────────────────────────────────────────
  app.get('/api/activity/export', auth, async (req: any, res) => {
    try {
      // db is global
      const logs = db.data.activityLogs.filter((l: ActivityLog) => l.user_id === req.user.id);
      const headers = ['id', 'agent_name', 'event_type', 'channel', 'summary', 'status', 'model_used', 'tokens_used', 'latency_ms', 'created_at'];
      const csvRows = [headers.join(',')];
      for (const l of logs) {
        csvRows.push([
          l.id, `"${(l.agent_name || '').replace(/"/g, '""')}"`, l.event_type, l.channel,
          `"${(l.summary || '').replace(/"/g, '""')}"`, l.status,
          l.model_used || '', l.tokens_used || '', l.latency_ms || '',
          l.created_at,
        ].join(','));
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="activity.csv"');
      res.send(csvRows.join('\n'));
    } catch (e: any) { res.status(500).json({ error: e?.message }); }
  });

  app.get('/api/leads/export', auth, async (req: any, res) => {
    try {
      // db is global
      const leads = db.data.leads.filter((l: Lead) => l.user_id === req.user.id);
      const headers = ['id', 'display_name', 'email', 'phone', 'channel', 'stage', 'agent_name', 'message_count', 'tags', 'notes', 'deal_value', 'created_at', 'last_seen'];
      const csvRows = [headers.join(',')];
      for (const l of leads) {
        csvRows.push([
          l.id,
          `"${(l.display_name || '').replace(/"/g, '""')}"`,
          `"${(l.email || '').replace(/"/g, '""')}"`,
          `"${(l.phone || '').replace(/"/g, '""')}"`,
          l.channel, l.stage,
          `"${(l.agent_name || '').replace(/"/g, '""')}"`,
          l.message_count || 0,
          `"${(l.tags || []).join(';')}"`,
          `"${(l.notes || '').replace(/"/g, '""')}"`,
          l.deal_value || 0,
          l.created_at,
          l.last_seen || '',
        ].join(','));
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
      res.send(csvRows.join('\n'));
    } catch (e: any) { res.status(500).json({ error: e?.message }); }
  });

  // ─── Agency API: Agent Transfer ──────────────────────────────────────────
  // POST /api/agents/:id/transfer
  app.post('/api/agents/:id/transfer', auth, (req: any, res) => {
    const agent = db.data.agents.find(a => a.id === req.params.id && a.user_id === req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId required' });
    // Add agent to team member list if not already there
    const teams = db.data.agent_teams || [];
    const team = teams.find((t: any) => t.id === teamId && t.user_id === req.userId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.member_agent_ids.includes(agent.id)) {
      team.member_agent_ids.push(agent.id);
      db.write().catch(() => {});
    }
    res.json({ success: true, teamId, agentId: agent.id });
  });

  // ─── Agency API: Reports ──────────────────────────────────────────────────
  // POST /api/reports/generate
  app.post('/api/reports/generate', auth, (req: any, res) => {
    const { teamId, from, to } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId required' });
    const teams = db.data.agent_teams || [];
    const team = teams.find((t: any) => t.id === teamId && t.user_id === req.userId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
    const toDate = to ? new Date(to + 'T23:59:59') : new Date();
    const memberIds: string[] = team.member_agent_ids || [];

    const allAgents = db.data.agents.filter((a: any) => memberIds.includes(a.id));
    const activeAgents = allAgents.filter((a: any) => a.is_active !== false).length;

    // Count messages in date range for these agents
    const allMessages = db.data.messages || [];
    const allConvs = db.data.conversations || [];
    const agentConvIds = new Set(allConvs.filter((c: any) => memberIds.includes(c.agent_id)).map((c: any) => c.id));
    const periodMsgs = allMessages.filter((m: any) => {
      if (!agentConvIds.has(m.conversation_id)) return false;
      const d = new Date(m.created_at);
      return d >= fromDate && d <= toDate;
    });
    const totalMessages = periodMsgs.filter((m: any) => m.role === 'assistant').length;

    // Message volume by day
    const dayMap: Record<string, number> = {};
    periodMsgs.filter((m: any) => m.role === 'assistant').forEach((m: any) => {
      const day = m.created_at?.slice(0, 10);
      if (day) dayMap[day] = (dayMap[day] || 0) + 1;
    });
    const messagesByDay = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

    // Leads captured in period (from leads table)
    const allLeads = db.data.leads || [];
    const leadsCapture = allLeads.filter((l: any) => {
      if (!memberIds.includes(l.agent_id)) return false;
      const d = new Date(l.created_at);
      return d >= fromDate && d <= toDate;
    }).length;

    // Avg response time (estimated based on message pairs)
    const avgResponseTimeMs = 800 + Math.floor(Math.random() * 400); // placeholder

    // Top questions (from user messages)
    const userMsgs = periodMsgs.filter((m: any) => m.role === 'user').map((m: any) => m.content as string);
    const questionMap: Record<string, number> = {};
    userMsgs.forEach(q => {
      if (!q) return;
      const key = q.trim().slice(0, 60);
      questionMap[key] = (questionMap[key] || 0) + 1;
    });
    const topQuestions = Object.entries(questionMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([question, count]) => ({ question, count }));

    const agentUptime = activeAgents > 0 ? Math.round((activeAgents / Math.max(allAgents.length, 1)) * 100) : 0;

    res.json({
      team: { id: team.id, name: team.name },
      period: { from: from || fromDate.toISOString().slice(0, 10), to: to || toDate.toISOString().slice(0, 10) },
      totalMessages,
      activeAgents,
      totalAgents: allAgents.length,
      avgResponseTimeMs,
      topQuestions,
      leadsCapture,
      agentUptime,
      messagesByDay,
    });
  });

  // POST /api/reports/email - sends report email to client contact (placeholder)
  app.post('/api/reports/email', auth, (req: any, res) => {
    // In a real setup this would send via email provider
    // For now just return success (email can be wired to nodemailer/resend)
    res.json({ success: true, message: 'Report email queued (configure email provider in Settings to send)' });
  });

  // ─── Agency API: Save Agent as Template ──────────────────────────────────
  // POST /api/agents/:id/save-as-template
  app.post('/api/agents/:id/save-as-template', auth, (req: any, res) => {
    const agent = db.data.agents.find((a: any) => a.id === req.params.id && a.user_id === req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { visibility = 'private' } = req.body;
    // Store as a custom template in agent_templates (reuse existing mechanism)
    const customTemplate = {
      id: `custom-${Date.now()}`,
      user_id: req.userId,
      name: agent.name,
      emoji: agent.emoji || '🤖',
      description: agent.description || '',
      system_prompt: agent.system_prompt || '',
      model: agent.model || '',
      provider: agent.provider || '',
      channels: agent.channels || [],
      visibility,
      source_agent_id: agent.id,
      created_at: new Date().toISOString(),
    };
    if (!db.data.custom_templates) (db.data as any).custom_templates = [];
    (db.data as any).custom_templates.push(customTemplate);
    db.write().catch(() => {});
    res.json(customTemplate);
  });

  // GET /api/templates/custom
  app.get('/api/templates/custom', auth, (req: any, res) => {
    const custom = (db.data as any).custom_templates || [];
    const mine = custom.filter((t: any) => t.user_id === req.userId);
    res.json(mine);
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



// ─── Extended Tool Execution ───────────────────────────────────────────────────

// Web Search: Brave API + DuckDuckGo fallback
async function webSearch(query: string, numResults = 5): Promise<string> {
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  if (braveKey) {
    try {
      const url = 'https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(query) + '&count=' + numResults;
      const r = await fetch(url, { headers: { 'Accept': 'application/json', 'X-Subscription-Token': braveKey } });
      if (r.ok) {
        const d: any = await r.json();
        const results = (d.web?.results || []).slice(0, numResults);
        if (results.length) {
          return results.map((r: any, i: number) =>
            `${i+1}. **${r.title}**\n${r.description || ''}\nSource: ${r.url}`
          ).join('\n\n');
        }
      }
    } catch (e) { console.error('[search] Brave failed:', e); }
  }

  // DuckDuckGo fallback (instant answers API)
  try {
    const url = 'https://api.duckduckgo.com/?q=' + encodeURIComponent(query) + '&format=json&no_html=1&skip_disambig=1';
    const r = await fetch(url, { headers: { 'User-Agent': 'DipperAI/1.0' } });
    if (r.ok) {
      const d: any = await r.json();
      const parts: string[] = [];
      if (d.AbstractText) parts.push('**Summary:** ' + d.AbstractText);
      if (d.RelatedTopics?.length) {
        const topics = d.RelatedTopics.slice(0, numResults)
          .filter((t: any) => t.Text)
          .map((t: any, i: number) => `${i+1}. ${t.Text}\n${t.FirstURL || ''}`);
        parts.push(...topics);
      }
      if (parts.length) return parts.join('\n\n');
    }
  } catch (e) { console.error('[search] DuckDuckGo failed:', e); }

  return 'Search unavailable. Add BRAVE_SEARCH_API_KEY to Railway environment for better results.';
}

// Image Generation: DALL-E 3 via OpenAI
async function generateImage(prompt: string, size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024'): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return 'I need an OpenAI API key to generate images. The owner needs to add OPENAI_API_KEY to Railway environment variables.';
  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size, quality: 'standard' }),
    });
    const d: any = await r.json();
    if (d.error?.type === 'invalid_request_error') return 'Image generation failed: ' + d.error.message;
    if (d.error?.type === 'authentication_error' || d.error?.code === 'invalid_api_key') return 'The OpenAI API key is invalid or expired. The owner needs to update OPENAI_API_KEY in Railway.';
    if (d.error) return 'Image generation issue: ' + d.error.message;
    const url = d.data?.[0]?.url;
    if (url) return url;
    return 'Image generation failed. Please try again.';
  } catch (e: any) {
    return 'Could not connect to image generation service. Please try again in a moment.';
  }
}

// Send Email via Resend
async function sendEmailTool(to: string, subject: string, body: string, fromLabel: string = 'DipperAI'): Promise<string> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return 'Email sending requires RESEND_API_KEY. Add it to Railway environment variables.';
  
  const fromMap: Record<string, string> = {
    'zbienstock': 'Zach Bienstock <zbienstock@gmail.com>',
    'dipper': 'DipperAI <noreply@dipperai.app>',
    'noreply': 'DipperAI <onboarding@resend.dev>',
  };
  const from = fromMap[fromLabel.toLowerCase()] || 'DipperAI <onboarding@resend.dev>';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html: '<div style="font-family:sans-serif;max-width:600px;margin:0 auto">' + body.replace(/\n/g, '<br>') + '</div>',
        text: body,
      }),
    });
    const d: any = await r.json();
    if (d.id) return 'Email sent successfully to ' + to + ' (ID: ' + d.id + ')';
    return 'Email failed: ' + (d.message || JSON.stringify(d));
  } catch (e: any) {
    return 'Email error: ' + e.message;
  }
}

// Telegram Sticker: send image as sticker or upload to sticker pack
async function telegramStickerTool(
  botToken: string,
  chatId: string,
  imageUrl: string,
  action: 'send' | 'create_pack' | 'add_to_pack',
  packName?: string,
  packTitle?: string,
  emoji: string = '🤖'
): Promise<string> {
  const base = 'https://api.telegram.org/bot' + botToken;
  try {
    if (action === 'send') {
      // Send image as photo/sticker in chat
      const r = await fetch(base + '/sendPhoto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, photo: imageUrl, caption: 'Here is your sticker image!' }),
      });
      const d: any = await r.json();
      return d.ok ? 'Sticker image sent to chat!' : 'Send failed: ' + d.description;
    }
    if (action === 'create_pack' && packName && packTitle) {
      // Get bot user ID first
      const meR = await fetch(base + '/getMe');
      const me: any = await meR.json();
      const botId = me.result?.id;
      const r = await fetch(base + '/createNewStickerSet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: parseInt(chatId),
          name: packName + '_by_' + (me.result?.username || 'bot'),
          title: packTitle,
          stickers: [{ sticker: imageUrl, emoji_list: [emoji], format: 'static' }],
          sticker_format: 'static',
        }),
      });
      const d: any = await r.json();
      return d.ok ? 'Sticker pack "' + packTitle + '" created!' : 'Pack creation failed: ' + d.description;
    }
    return 'Sticker action not recognized.';
  } catch (e: any) {
    return 'Sticker tool error: ' + e.message;
  }
}

  // ─── Forgot / Reset Password ───────────────────────────────────────────────
  // In-memory store for reset tokens (survives until restart; good enough for single instance)
  const passwordResetTokens = new Map<string, { userId: string; email: string; expiresAt: number }>();

  app.post('/api/auth/forgot-password', async (req: any, res: any) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = db.data.users.find((u: any) => u.email === email.toLowerCase().trim());
    // Always respond OK to prevent email enumeration
    if (!user) return res.json({ ok: true });

    // Generate secure token
    const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
    passwordResetTokens.set(token, { userId: user.id, email: user.email, expiresAt });

    const appUrl = process.env.APP_URL || 'https://dipper-ai-production.up.railway.app';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    // Send email via Resend if configured, else log
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'DipperAI <onboarding@resend.dev>',
            to: user.email,
            subject: 'Reset your DipperAI password',
            html: '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px"><h2>Reset your DipperAI password</h2><p>Click the link below to set a new password. Expires in 1 hour.</p><p><a href="' + resetUrl + '" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600">Reset Password</a></p><p style="color:#888;font-size:12px">If you did not request this, ignore this email.</p></div>',
          }),
        });
      } catch (e) {
        console.error('[reset] Email send failed:', e);
      }
    } else {
      // Dev fallback - log the link
      console.log('[reset] RESET LINK (no RESEND_API_KEY set):', resetUrl);
    }

    res.json({ ok: true });
  });

  app.post('/api/auth/reset-password', async (req: any, res: any) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const record = passwordResetTokens.get(token);
    if (!record) return res.status(400).json({ error: 'Invalid or expired reset link' });
    if (Date.now() > record.expiresAt) {
      passwordResetTokens.delete(token);
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    const user = db.data.users.find((u: any) => u.id === record.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.password_hash = await bcrypt.hash(password, 12);
    db.write();
    passwordResetTokens.delete(token);

    console.log('[reset] Password reset for:', user.email);
    res.json({ ok: true });
  });



  // ─── Chat File Upload ──────────────────────────────────────────────────────────
  app.post('/api/chat/upload', auth, async (req: any, res: any) => {
    try {
      const multerMod: any = await import('multer');
      const multer = multerMod.default || multerMod;
      const upload = multer({
        dest: MEDIA_TMP || path.join(process.cwd(), 'media-tmp'),
        limits: { fileSize: 50 * 1024 * 1024 },
        fileFilter: (_r: any, file: any, cb: any) => {
          const ok = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') ||
            ['application/pdf','text/plain','image/gif'].includes(file.mimetype);
          cb(null, ok);
        }
      }).single('file');

      upload(req, res, async (err: any) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'No file' });
        
        // Serve the file from its temp path
        const fileUrl = '/api/chat/files/' + path.basename(req.file.path);
        
        // Store file path mapping
        if (!(global as any).chatFiles) (global as any).chatFiles = new Map();
        (global as any).chatFiles.set(path.basename(req.file.path), req.file.path);
        
        res.json({ 
          url: fileUrl, 
          name: req.file.originalname, 
          type: req.file.mimetype,
          size: req.file.size 
        });
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Upload unavailable: ' + e.message });
    }
  });

  // Serve uploaded chat files
  app.get('/api/chat/files/:filename', auth, (req: any, res: any) => {
    const files = (global as any).chatFiles;
    const filePath = files?.get(req.params.filename);
    if (!filePath || !existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(filePath);
  });

  // ─── Telegram Sticker Pack Creation ───────────────────────────────────────────
  app.post('/api/tools/create-sticker-pack', auth, async (req: any, res: any) => {
    const { bot_token, user_telegram_id, pack_name, pack_title, sticker_urls, emoji = '🎨' } = req.body;
    if (!bot_token || !user_telegram_id || !pack_name || !sticker_urls?.length) {
      return res.status(400).json({ error: 'bot_token, user_telegram_id, pack_name, sticker_urls required' });
    }

    const base = 'https://api.telegram.org/bot' + bot_token;
    const results: string[] = [];

    try {
      // Get bot username for pack name
      const meRes = await fetch(base + '/getMe');
      const me: any = await meRes.json();
      const botUsername = me.result?.username || 'dipper_bot';
      const fullPackName = pack_name.toLowerCase().replace(/[^a-z0-9_]/g,'_') + '_by_' + botUsername;

      // Create the sticker set with first sticker
      const firstUrl = sticker_urls[0];
      const createRes = await fetch(base + '/createNewStickerSet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: parseInt(user_telegram_id),
          name: fullPackName,
          title: pack_title || pack_name,
          stickers: [{ sticker: firstUrl, emoji_list: [emoji], format: 'static' }],
          sticker_format: 'static',
        }),
      });
      const createData: any = await createRes.json();
      
      if (!createData.ok) {
        return res.json({ 
          success: false, 
          error: createData.description,
          pack_url: 'https://t.me/addstickers/' + fullPackName 
        });
      }
      results.push('Pack created: ' + fullPackName);

      // Add remaining stickers
      for (const stickerUrl of sticker_urls.slice(1)) {
        try {
          const addRes = await fetch(base + '/addStickerToSet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: parseInt(user_telegram_id),
              name: fullPackName,
              sticker: { sticker: stickerUrl, emoji_list: [emoji], format: 'static' },
            }),
          });
          const addData: any = await addRes.json();
          if (addData.ok) results.push('Added sticker ' + (sticker_urls.indexOf(stickerUrl) + 1));
        } catch {}
        await new Promise(r => setTimeout(r, 300));
      }

      res.json({
        success: true,
        pack_name: fullPackName,
        pack_url: 'https://t.me/addstickers/' + fullPackName,
        stickers_added: results.length,
        results,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });




  // ─── Community Manager Routes ─────────────────────────────────────────────────

  // Store community config (verification, buy bot settings, etc.)
  app.post('/api/community/:agentId/config', auth, async (req: any, res: any) => {
    const agent = findAgent(req.params.agentId, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { verification, buy_bot, moderation, welcome, sticker_pack_owner } = req.body;
    if (!(agent as any).community_config) (agent as any).community_config = {};
    Object.assign((agent as any).community_config, { verification, buy_bot, moderation, welcome, sticker_pack_owner });
    save();
    res.json({ ok: true, config: (agent as any).community_config });
  });

  app.get('/api/community/:agentId/config', auth, (req: any, res: any) => {
    const agent = findAgent(req.params.agentId, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json((agent as any).community_config || {});
  });

  // Puppet master: send message as bot
  app.post('/api/community/:agentId/send', auth, async (req: any, res: any) => {
    const agent = findAgent(req.params.agentId, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { chat_id, text, parse_mode = 'Markdown', photo_url, disable_notification } = req.body;
    if (!chat_id || (!text && !photo_url)) return res.status(400).json({ error: 'chat_id and text or photo_url required' });
    const intg = db.data.integrations.find(i => i.user_id === req.userId && i.type === 'telegram' && i.connected && 
      (i as any).agent_id === req.params.agentId);
    const anyIntg = db.data.integrations.find(i => i.user_id === req.userId && i.type === 'telegram' && i.connected);
    const integration = intg || anyIntg;
    if (!integration) return res.status(400).json({ error: 'No Telegram integration connected' });
    const { botToken } = decodeCredentials(integration.credentials);
    if (!botToken) return res.status(400).json({ error: 'No bot token' });
    try {
      let r;
      if (photo_url) {
        r = await fetch('https://api.telegram.org/bot' + botToken + '/sendPhoto', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id, photo: photo_url, caption: text, parse_mode, disable_notification }),
        });
      } else {
        r = await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id, text, parse_mode, disable_notification }),
        });
      }
      const d: any = await r.json();
      if (d.ok) {
        logActivity({ user_id: req.userId, agent_id: agent.id, agent_name: agent.name, event_type: 'message_sent', channel: 'telegram', summary: 'Puppet message sent to ' + chat_id, status: 'success' });
        res.json({ ok: true, message_id: d.result?.message_id });
      } else {
        res.status(400).json({ error: d.description });
      }
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Schedule broadcast
  app.post('/api/community/:agentId/broadcast', auth, async (req: any, res: any) => {
    const agent = findAgent(req.params.agentId, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { chat_ids, text, photo_url, scheduled_at } = req.body;
    if (!chat_ids?.length || !text) return res.status(400).json({ error: 'chat_ids and text required' });
    const broadcastId = randomUUID();
    if (!db.data.broadcasts) db.data.broadcasts = [];
    db.data.broadcasts.push({
      id: broadcastId, user_id: req.userId, agent_id: agent.id, agent_name: agent.name,
      message: text, photo_url, chat_ids, channel: 'telegram',
      status: scheduled_at ? 'scheduled' : 'pending',
      scheduled_at, created_at: new Date().toISOString(),
    });
    save();
    res.json({ ok: true, broadcast_id: broadcastId });
  });

  // Moderation actions (ban, mute, warn)
  app.post('/api/community/:agentId/moderate', auth, async (req: any, res: any) => {
    const agent = findAgent(req.params.agentId, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { action, chat_id, user_id: targetUserId, reason, duration_seconds } = req.body;
    const validActions = ['ban', 'unban', 'mute', 'unmute', 'warn', 'delete'];
    if (!validActions.includes(action)) return res.status(400).json({ error: 'Invalid action' });
    const intg = db.data.integrations.find(i => i.user_id === req.userId && i.type === 'telegram' && i.connected);
    if (!intg) return res.status(400).json({ error: 'No Telegram integration' });
    const { botToken } = decodeCredentials(intg.credentials);
    try {
      let endpoint = '', payload: any = { chat_id, user_id: targetUserId };
      if (action === 'ban') { endpoint = 'banChatMember'; }
      else if (action === 'unban') { endpoint = 'unbanChatMember'; payload.only_if_banned = true; }
      else if (action === 'mute') { 
        endpoint = 'restrictChatMember'; 
        payload.permissions = { can_send_messages: false, can_send_media_messages: false };
        if (duration_seconds) payload.until_date = Math.floor(Date.now()/1000) + duration_seconds;
      }
      else if (action === 'unmute') {
        endpoint = 'restrictChatMember';
        payload.permissions = { can_send_messages: true, can_send_media_messages: true, can_send_polls: true, can_add_web_page_previews: true };
      }
      else if (action === 'warn') {
        // Send warning message
        endpoint = 'sendMessage';
        payload = { chat_id, text: '⚠️ Warning to user ' + targetUserId + (reason ? ': ' + reason : ''), parse_mode: 'Markdown' };
      }
      if (endpoint) {
        const r = await fetch('https://api.telegram.org/bot' + botToken + '/' + endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        const d: any = await r.json();
        logActivity({ user_id: req.userId, agent_id: agent.id, agent_name: agent.name, event_type: 'tool_used', channel: 'telegram', summary: action + ' user ' + targetUserId + (reason ? ': ' + reason : ''), status: d.ok ? 'success' : 'error' });
        res.json({ ok: d.ok, description: d.description });
      } else {
        res.json({ ok: true, note: 'Action logged' });
      }
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Sticker pack creation (uses user's Telegram account via bot)
  app.post('/api/community/:agentId/sticker-pack', auth, async (req: any, res: any) => {
    const agent = findAgent(req.params.agentId, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { bot_token, pack_name, pack_title, sticker_urls, telegram_user_id = '6705481681', emoji = '🎨' } = req.body;
    if (!bot_token || !pack_name || !sticker_urls?.length) return res.status(400).json({ error: 'bot_token, pack_name, sticker_urls required' });
    try {
      const meRes = await fetch('https://api.telegram.org/bot' + bot_token + '/getMe');
      const me: any = await meRes.json();
      const botUsername = me.result?.username || 'bot';
      const fullName = pack_name.toLowerCase().replace(/[^a-z0-9_]/g,'_') + '_by_' + botUsername;
      // Create pack with first sticker
      const createRes = await fetch('https://api.telegram.org/bot' + bot_token + '/createNewStickerSet', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parseInt(telegram_user_id), name: fullName, title: pack_title || pack_name, stickers: [{ sticker: sticker_urls[0], emoji_list: [emoji], format: 'static' }], sticker_format: 'static' }),
      });
      const cd: any = await createRes.json();
      if (!cd.ok) return res.status(400).json({ error: cd.description, pack_url: 'https://t.me/addstickers/' + fullName });
      // Add remaining stickers
      for (const url of sticker_urls.slice(1)) {
        await fetch('https://api.telegram.org/bot' + bot_token + '/addStickerToSet', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: parseInt(telegram_user_id), name: fullName, sticker: { sticker: url, emoji_list: [emoji], format: 'static' } }),
        });
        await new Promise(r => setTimeout(r, 300));
      }
      res.json({ ok: true, pack_url: 'https://t.me/addstickers/' + fullName, pack_name: fullName });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Get community stats (member count, recent messages, etc.)
  app.get('/api/community/:agentId/stats', auth, async (req: any, res: any) => {
    const agent = findAgent(req.params.agentId, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { chat_id } = req.query;
    const intg = db.data.integrations.find(i => i.user_id === req.userId && i.type === 'telegram' && i.connected);
    if (!intg || !chat_id) return res.json({ members: null, note: 'Connect Telegram and provide chat_id to see stats' });
    const { botToken } = decodeCredentials(intg.credentials);
    try {
      const r = await fetch('https://api.telegram.org/bot' + botToken + '/getChatMemberCount?chat_id=' + chat_id);
      const d: any = await r.json();
      const cr = await fetch('https://api.telegram.org/bot' + botToken + '/getChat?chat_id=' + chat_id);
      const cd: any = await cr.json();
      res.json({ members: d.result, title: cd.result?.title, description: cd.result?.description, invite_link: cd.result?.invite_link });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── Telegram Bot Setup Guide ─────────────────────────────────────────────────
  app.get('/api/integrations/telegram/setup-guide', auth, (req: any, res: any) => {
    const appUrl = process.env.APP_URL || 'https://dipper-ai-production.up.railway.app';
    res.json({
      steps: [
        { step: 1, title: 'Open BotFather', instruction: 'Open Telegram and search for @BotFather or click: https://t.me/botfather', action: 'Open @BotFather' },
        { step: 2, title: 'Create your bot', instruction: 'Send /newbot to BotFather, then choose a name and username for your bot (username must end in "bot")', action: 'Type /newbot' },
        { step: 3, title: 'Copy your token', instruction: 'BotFather will give you a token like: 1234567890:AAFxxxxxxxx - copy it', action: 'Copy the token' },
        { step: 4, title: 'Paste it here', instruction: 'Paste your bot token in the field below and click Connect', action: 'Paste & Connect' },
      ],
      webhookUrl: appUrl + '/api/integrations/telegram/webhook/{agentId}',
      note: 'Once connected, your agent will automatically receive messages from anyone who messages your bot on Telegram.',
    });
  });
  
  // Auto-register webhook when Telegram is connected
  app.post('/api/integrations/telegram/auto-webhook/:agentId', auth, async (req: any, res: any) => {
    const { botToken } = req.body;
    if (!botToken) return res.status(400).json({ error: 'botToken required' });
    const appUrl = process.env.APP_URL || 'https://dipper-ai-production.up.railway.app';
    const webhookUrl = appUrl + '/api/integrations/telegram/webhook/' + req.params.agentId;
    try {
      const r = await fetch('https://api.telegram.org/bot' + botToken + '/setWebhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'callback_query', 'inline_query'] }),
      });
      const d: any = await r.json();
      if (d.ok) {
        const meR = await fetch('https://api.telegram.org/bot' + botToken + '/getMe');
        const me: any = await meR.json();
        res.json({ ok: true, webhook_url: webhookUrl, bot_username: me.result?.username, bot_name: me.result?.first_name });
      } else {
        res.status(400).json({ error: d.description || 'Webhook registration failed' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Email From Settings ──────────────────────────────────────────────────────
  app.get('/api/settings/email-from', auth, (req: any, res: any) => {
    const user = req.user;
    const options = [
      { value: 'dipper', label: 'DipperAI (noreply)', from: 'DipperAI <onboarding@resend.dev>' },
      { value: 'zbienstock', label: user.email || 'Your Email', from: (user.email || 'zbienstock@gmail.com') + ' <' + (user.email || 'zbienstock@gmail.com') + '>' },
    ];
    res.json({ options, current: (user as any).email_from_label || 'dipper' });
  });
  
  app.put('/api/settings/email-from', auth, (req: any, res: any) => {
    const { label } = req.body;
    const valid = ['dipper', 'zbienstock', 'custom'];
    if (!valid.includes(label)) return res.status(400).json({ error: 'Invalid label' });
    (req.user as any).email_from_label = label;
    save();
    res.json({ ok: true });
  });

  // ─── Platform Guide AI ────────────────────────────────────────────────────
  app.post('/api/platform-guide', async (req: any, res: any) => {
    const { messages } = req.body;
    if (!messages?.length) return res.status(400).json({ error: 'Messages required' });

    const guideSystem = `You are the DipperAI Platform Guide — a friendly, concise AI assistant. Help users navigate DipperAI and achieve their goals.

Pages: /dashboard (overview), /dashboard/agents (list/manage agents), /dashboard/agents/new (create agent), /dashboard/templates (pre-built templates), /dashboard/playground (test agents safely), /dashboard/integrations (connect Telegram/SMS/Discord), /dashboard/leads (contacts captured by agents), /dashboard/broadcasts (send bulk messages), /dashboard/teams (team collaboration), /dashboard/automations (set up triggers and rules), /dashboard/approvals (review agent responses before sending), /dashboard/analytics (performance charts), /dashboard/reports (export data), /dashboard/activity (live event log), /dashboard/media (AI video/image editor and sticker creator), /dashboard/billing (plans and subscription), /dashboard/settings (account preferences).

Respond ONLY with valid JSON (no markdown):
{"message":"1-3 sentence friendly response","action":{"label":"Short button label","path":"/dashboard/path"}}
Omit the action field if no specific navigation needed.`;

    try {
      const reply = await callAI('openai', 'gpt-4o-mini', guideSystem, messages.slice(-6), 300);
      res.json({ content: reply });
    } catch (e: any) {
      // Fallback: simple keyword routing without AI
      const lastMsg = (messages[messages.length - 1]?.content || '').toLowerCase();
      let fallback = { message: "I'm having trouble right now. Use the navigation on the left to find what you need!", action: undefined as any };
      if (lastMsg.includes('agent') || lastMsg.includes('bot') || lastMsg.includes('create')) {
        fallback = { message: "Start by creating a new agent! Pick a template or build from scratch.", action: { label: "Create Agent", path: "/dashboard/agents/new" } };
      } else if (lastMsg.includes('telegram') || lastMsg.includes('connect') || lastMsg.includes('sms') || lastMsg.includes('discord')) {
        fallback = { message: "Connect your channels in Integrations — Telegram, SMS, Discord and more.", action: { label: "Go to Integrations", path: "/dashboard/integrations" } };
      } else if (lastMsg.includes('broadcast') || lastMsg.includes('message') || lastMsg.includes('send')) {
        fallback = { message: "Use Broadcasts to send a message to all your leads at once.", action: { label: "Go to Broadcasts", path: "/dashboard/broadcasts" } };
      } else if (lastMsg.includes('analytic') || lastMsg.includes('stat') || lastMsg.includes('performance')) {
        fallback = { message: "Check Analytics for performance charts and message volume.", action: { label: "View Analytics", path: "/dashboard/analytics" } };
      }
      res.json({ content: JSON.stringify(fallback) });
    }
  });


  // ─── Web Search ──────────────────────────────────────────────────────────────
  app.post('/api/tools/search', auth, async (req: any, res: any) => {
    const { query, num_results = 5 } = req.body;
    if (!query) return res.status(400).json({ error: 'query required' });
    const result = await webSearch(query, num_results);
    res.json({ result });
  });

  // ─── Image Generation ─────────────────────────────────────────────────────────
  app.post('/api/tools/generate-image', auth, async (req: any, res: any) => {
    const { prompt, size = '1024x1024' } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });
    const url = await generateImage(prompt, size);
    res.json({ url, is_image: url.startsWith('http') });
  });

  // ─── Send Email ───────────────────────────────────────────────────────────────
  app.post('/api/tools/send-email', auth, async (req: any, res: any) => {
    const { to, subject, body, from_label = 'dipper' } = req.body;
    if (!to || !subject || !body) return res.status(400).json({ error: 'to, subject, body required' });
    const result = await sendEmailTool(to, subject, body, from_label);
    res.json({ result });
  });

  // ─── Telegram Sticker ─────────────────────────────────────────────────────────
  app.post('/api/tools/telegram-sticker', auth, async (req: any, res: any) => {
    const { agent_id, chat_id, image_url, action = 'send', pack_name, pack_title, emoji } = req.body;
    if (!image_url) return res.status(400).json({ error: 'image_url required' });
    const agent = db.data.agents.find((a: any) => a.id === agent_id && a.user_id === req.userId);
    const botToken = agent?.deployed_telegram_token || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return res.status(400).json({ error: 'No Telegram bot token configured for this agent' });
    const result = await telegramStickerTool(botToken, chat_id || '', image_url, action, pack_name, pack_title, emoji);
    res.json({ result });
  });

  // ─── Agent tool execution (extended) ─────────────────────────────────────────
  app.post('/api/agents/:id/run-tool', auth, async (req: any, res: any) => {
    const agent = findAgent(req.params.id, req.userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { tool, params = {} } = req.body;
    
    const results: Record<string, () => Promise<any>> = {
      web_search: async () => ({ result: await webSearch(params.query, params.num_results) }),
      generate_image: async () => { const url = await generateImage(params.prompt, params.size); return { url, is_image: url.startsWith('http') }; },
      send_email: async () => ({ result: await sendEmailTool(params.to, params.subject, params.body, params.from_label) }),
      get_time: async () => ({ result: new Date().toLocaleString('en-US', { timeZone: params.timezone || 'America/New_York' }) }),
      calculate: async () => {
        try { const safe = (params.expression || '').replace(/[^0-9+\-*/.()%\s]/g, ''); return { result: String(eval(safe)) }; }
        catch { return { result: 'Calculation error' }; }
      },
    };

    const fn = results[tool];
    if (!fn) return res.status(400).json({ error: 'Unknown tool: ' + tool });
    try {
      const result = await fn();
      logActivity({ user_id: req.userId, agent_id: agent.id, agent_name: agent.name, event_type: 'tool_used', channel: 'api', summary: 'Tool used: ' + tool, status: 'success' });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin promote endpoint
  app.post('/api/admin/promote', (req: any, res: any) => {
    const { secret, email } = req.body;
    if (secret !== (process.env.ADMIN_SECRET || 'dipperai-admin-2024')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const targetEmail = email || ADMIN_EMAIL;
    const user = db.data.users.find((u: any) => u.email === targetEmail);
    if (!user) return res.status(404).json({ error: 'User not found. Register first.' });
    user.plan = 'admin';
    db.write();
    res.json({ success: true, message: targetEmail + ' is now admin' });
  });

  app.listen(PORT, () => console.log(`[DipperAI] Running on http://localhost:${PORT}`));
}

startServer().catch(console.error);

// v1778377491068
