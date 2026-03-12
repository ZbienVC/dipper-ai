# DipperAI — Backend Architecture & Engineering Spec
*Version 1.0 — March 2026*

---

## 1. HIGH-LEVEL BACKEND ARCHITECTURE

### Core Services

```
┌─────────────────────────────────────────────────────────────┐
│                        API Gateway                           │
│              (Express / Next.js API Routes)                  │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────┘
       │          │          │          │          │
   Auth       Workspace   Agents    Runtime   Integrations
  Service     Service    Service   Orchestrator  Service
       │          │          │          │          │
       └──────────┴──────────┴──────────┴──────────┘
                              │
                    ┌─────────┴─────────┐
                    │   PostgreSQL DB   │
                    │  + pgvector ext   │
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
           Redis           BullMQ           S3/Storage
         (sessions,       (jobs,           (files,
          cache)          automations)      knowledge)
```

### Module Breakdown

| Module | Responsibility |
|---|---|
| AuthService | JWT, session, OAuth, API keys |
| WorkspaceService | Workspace CRUD, members, invites, roles |
| AgentService | Agent CRUD, personality, model settings |
| RuntimeOrchestrator | Handles inbound events → response pipeline |
| ThreadService | Conversation thread resolution and history |
| MemoryService | Session + rolling summary + structured memory |
| KnowledgeService | Upload, chunk, embed, retrieve |
| PromptBuilder | Assembles final prompt from all context |
| ModelService | Routes to OpenAI/Anthropic/Gemini, handles retries |
| ToolRouter | Detects and executes commands/tools |
| ApprovalService | Draft creation, approval queue, send-on-approve |
| DeliveryService | Sends outbound via the right channel |
| AutomationEngine | BullMQ-based scheduler and trigger handler |
| AnalyticsService | Event ingestion, aggregation, dashboard queries |
| BillingService | Plan enforcement, usage metering, Stripe hooks |
| SMSService | Twilio inbound/outbound, campaigns |
| TelegramService | Bot webhook, reply/post flows |

---

## 2. DATABASE SCHEMA

### Implementation Order
1. users, workspaces, workspace_members, roles
2. agents, agent_personality, agent_model_settings
3. knowledge_sources, knowledge_chunks
4. commands, agent_integrations
5. conversation_threads, messages, memory_entries
6. automations, automation_runs
7. approval_queue, integration_events
8. analytics_events, subscriptions
9. audit_logs, marketplace_items

---

### users
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
email           TEXT UNIQUE NOT NULL
email_verified  BOOLEAN DEFAULT false
name            TEXT
avatar_url      TEXT
password_hash   TEXT  -- null if OAuth only
google_id       TEXT UNIQUE
created_at      TIMESTAMPTZ DEFAULT now()
last_login_at   TIMESTAMPTZ
is_active       BOOLEAN DEFAULT true
```
Indexes: email, google_id

---

### workspaces
```sql
id              UUID PRIMARY KEY
name            TEXT NOT NULL
slug            TEXT UNIQUE NOT NULL
plan            TEXT DEFAULT 'free'  -- free, pro, business
owner_id        UUID REFERENCES users(id)
created_at      TIMESTAMPTZ DEFAULT now()
logo_url        TEXT
settings        JSONB DEFAULT '{}'
```
Indexes: slug, owner_id

---

### workspace_members
```sql
id              UUID PRIMARY KEY
workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE
user_id         UUID REFERENCES users(id)
role            TEXT NOT NULL  -- owner, admin, editor, viewer
invited_by      UUID REFERENCES users(id)
joined_at       TIMESTAMPTZ DEFAULT now()
invite_token    TEXT UNIQUE  -- null after accepted
invite_email    TEXT  -- for pending invites
UNIQUE(workspace_id, user_id)
```

---

### agents
```sql
id              UUID PRIMARY KEY
workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE
name            TEXT NOT NULL
slug            TEXT NOT NULL
description     TEXT
avatar_url      TEXT
status          TEXT DEFAULT 'draft'  -- draft, active, paused, archived
is_public       BOOLEAN DEFAULT false
template_id     UUID REFERENCES agent_templates(id)
created_by      UUID REFERENCES users(id)
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
UNIQUE(workspace_id, slug)
```
Indexes: workspace_id, status, is_public

---

### agent_personality
```sql
id              UUID PRIMARY KEY
agent_id        UUID UNIQUE REFERENCES agents(id) ON DELETE CASCADE
bio             TEXT
lore            TEXT
adjectives      TEXT[]  -- ['witty', 'helpful', 'direct']
topics          TEXT[]
example_posts   TEXT[]
communication_style  TEXT  -- 'professional', 'friendly', 'witty', etc.
forbidden_words TEXT[]
tone_inspiration TEXT  -- e.g. "Like Gary Vee"
system_prompt   TEXT  -- assembled system prompt (cached)
updated_at      TIMESTAMPTZ DEFAULT now()
```

---

### agent_model_settings
```sql
id              UUID PRIMARY KEY
agent_id        UUID UNIQUE REFERENCES agents(id) ON DELETE CASCADE
provider        TEXT DEFAULT 'openai'  -- openai, anthropic, google
model           TEXT DEFAULT 'gpt-4o'
temperature     FLOAT DEFAULT 0.7  -- 0.0 = predictable, 1.0 = creative
max_tokens      INT DEFAULT 500
top_p           FLOAT DEFAULT 1.0
system_prompt_override  TEXT  -- optional full override
updated_at      TIMESTAMPTZ DEFAULT now()
```

---

### agent_templates
```sql
id              UUID PRIMARY KEY
name            TEXT NOT NULL
description     TEXT
category        TEXT  -- 'support', 'sales', 'marketing', 'community', 'personal'
icon            TEXT  -- emoji or icon key
default_personality  JSONB
default_model_settings  JSONB
is_featured     BOOLEAN DEFAULT false
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()
```

---

### knowledge_sources
```sql
id              UUID PRIMARY KEY
agent_id        UUID REFERENCES agents(id) ON DELETE CASCADE
type            TEXT  -- 'pdf', 'docx', 'txt', 'url', 'text'
name            TEXT
url             TEXT  -- for URL type
storage_path    TEXT  -- S3 path for files
status          TEXT DEFAULT 'pending'  -- pending, processing, ready, failed
chunk_count     INT DEFAULT 0
error_message   TEXT
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

---

### knowledge_chunks
```sql
id              UUID PRIMARY KEY
source_id       UUID REFERENCES knowledge_sources(id) ON DELETE CASCADE
agent_id        UUID REFERENCES agents(id) ON DELETE CASCADE
content         TEXT NOT NULL
embedding       vector(1536)  -- pgvector, size depends on model
chunk_index     INT
metadata        JSONB  -- page_number, section, etc.
created_at      TIMESTAMPTZ DEFAULT now()
```
Indexes: `CREATE INDEX ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)`

---

### commands
```sql
id              UUID PRIMARY KEY
agent_id        UUID REFERENCES agents(id) ON DELETE CASCADE
trigger         TEXT NOT NULL  -- '/help', 'what are your hours', regex
type            TEXT  -- 'static', 'template', 'webhook', 'workflow'
response        TEXT  -- for static type
template        TEXT  -- for template type (with {{variables}})
webhook_url     TEXT  -- for webhook type
webhook_method  TEXT DEFAULT 'POST'
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()
UNIQUE(agent_id, trigger)
```

---

### command_executions
```sql
id              UUID PRIMARY KEY
command_id      UUID REFERENCES commands(id)
thread_id       UUID REFERENCES conversation_threads(id)
message_id      UUID REFERENCES messages(id)
input           TEXT
output          TEXT
status          TEXT  -- success, failed
duration_ms     INT
created_at      TIMESTAMPTZ DEFAULT now()
```

---

### agent_integrations
```sql
id              UUID PRIMARY KEY
agent_id        UUID REFERENCES agents(id) ON DELETE CASCADE
type            TEXT  -- 'sms', 'telegram', 'x', 'discord'
status          TEXT DEFAULT 'disconnected'  -- connected, disconnected, error
config          JSONB  -- encrypted credentials, channel IDs, etc.
is_active       BOOLEAN DEFAULT true
requires_approval  BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
UNIQUE(agent_id, type)
```

---

### sms_numbers
```sql
id              UUID PRIMARY KEY
workspace_id    UUID REFERENCES workspaces(id)
agent_id        UUID REFERENCES agents(id)
phone_number    TEXT UNIQUE NOT NULL  -- E.164 format
twilio_sid      TEXT
is_active       BOOLEAN DEFAULT true
quiet_hours_start  TIME  -- e.g. 22:00
quiet_hours_end    TIME  -- e.g. 08:00
timezone        TEXT DEFAULT 'America/New_York'
opt_out_keywords  TEXT[] DEFAULT ARRAY['STOP','UNSUBSCRIBE','QUIT']
created_at      TIMESTAMPTZ DEFAULT now()
```

---

### sms_opt_outs
```sql
id              UUID PRIMARY KEY
phone_number    TEXT NOT NULL
workspace_id    UUID REFERENCES workspaces(id)
opted_out_at    TIMESTAMPTZ DEFAULT now()
```

---

### telegram_bots
```sql
id              UUID PRIMARY KEY
workspace_id    UUID REFERENCES workspaces(id)
agent_id        UUID REFERENCES agents(id)
bot_token       TEXT NOT NULL  -- store encrypted
bot_username    TEXT
chat_ids        TEXT[]  -- authorized chat IDs
webhook_secret  TEXT
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()
```

---

### conversation_threads
```sql
id              UUID PRIMARY KEY
agent_id        UUID REFERENCES agents(id)
channel         TEXT  -- 'web', 'sms', 'telegram', 'discord', 'x'
external_id     TEXT  -- phone number, telegram chat ID, discord channel ID
user_identifier TEXT  -- who the conversation is with
status          TEXT DEFAULT 'active'  -- active, closed, archived
message_count   INT DEFAULT 0
last_message_at TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT now()
UNIQUE(agent_id, channel, external_id)
```

---

### messages
```sql
id              UUID PRIMARY KEY
thread_id       UUID REFERENCES conversation_threads(id) ON DELETE CASCADE
role            TEXT  -- 'user', 'assistant', 'system'
content         TEXT NOT NULL
channel         TEXT
external_message_id  TEXT  -- Twilio SID, Telegram message_id, etc.
status          TEXT DEFAULT 'sent'  -- pending, sent, delivered, failed, pending_approval
tokens_used     INT
model           TEXT
latency_ms      INT
metadata        JSONB
created_at      TIMESTAMPTZ DEFAULT now()
```
Indexes: thread_id, created_at, status

---

### memory_entries
```sql
id              UUID PRIMARY KEY
agent_id        UUID REFERENCES agents(id) ON DELETE CASCADE
thread_id       UUID REFERENCES conversation_threads(id)
type            TEXT  -- 'session', 'summary', 'structured'
key             TEXT  -- for structured: 'user_name', 'last_order', etc.
value           TEXT
embedding       vector(1536)  -- for semantic search of memories
importance      INT DEFAULT 0  -- 0-10 score for retention priority
expires_at      TIMESTAMPTZ  -- for session memory
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

---

### automations
```sql
id              UUID PRIMARY KEY
agent_id        UUID REFERENCES agents(id) ON DELETE CASCADE
name            TEXT NOT NULL
trigger_type    TEXT  -- 'schedule', 'webhook', 'event', 'manual'
trigger_config  JSONB  -- cron string, event type, etc.
action_type     TEXT  -- 'send_message', 'post', 'notify'
action_config   JSONB  -- channel, content template, etc.
is_active       BOOLEAN DEFAULT true
requires_approval  BOOLEAN DEFAULT false
next_run_at     TIMESTAMPTZ
last_run_at     TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT now()
```

---

### automation_runs
```sql
id              UUID PRIMARY KEY
automation_id   UUID REFERENCES automations(id) ON DELETE CASCADE
status          TEXT  -- pending, running, completed, failed, skipped
output          TEXT
error_message   TEXT
started_at      TIMESTAMPTZ
completed_at    TIMESTAMPTZ
job_id          TEXT  -- BullMQ job ID
```

---

### approval_queue
```sql
id              UUID PRIMARY KEY
agent_id        UUID REFERENCES agents(id)
thread_id       UUID REFERENCES conversation_threads(id)
automation_id   UUID REFERENCES automations(id)  -- null if reply
type            TEXT  -- 'reply', 'post', 'campaign_message'
channel         TEXT
recipient       TEXT  -- phone, chat_id, etc.
draft_content   TEXT NOT NULL
edited_content  TEXT  -- if reviewer edits before approving
status          TEXT DEFAULT 'pending'  -- pending, approved, rejected, expired, sent
reviewed_by     UUID REFERENCES users(id)
reviewed_at     TIMESTAMPTZ
expires_at      TIMESTAMPTZ  -- auto-expire after X hours
rejection_reason TEXT
created_at      TIMESTAMPTZ DEFAULT now()
```

---

### analytics_events
```sql
id              UUID PRIMARY KEY
workspace_id    UUID REFERENCES workspaces(id)
agent_id        UUID REFERENCES agents(id)
event_type      TEXT  -- 'message_sent', 'message_received', 'command_executed', etc.
channel         TEXT
thread_id       UUID
metadata        JSONB
created_at      TIMESTAMPTZ DEFAULT now()
```
Indexes: workspace_id + created_at, agent_id + event_type, partition by month in production

---

### subscriptions
```sql
id              UUID PRIMARY KEY
workspace_id    UUID UNIQUE REFERENCES workspaces(id)
plan            TEXT DEFAULT 'free'  -- free, pro, business
status          TEXT DEFAULT 'active'  -- active, canceled, past_due, trialing
stripe_customer_id    TEXT
stripe_subscription_id TEXT
current_period_start  TIMESTAMPTZ
current_period_end    TIMESTAMPTZ
cancel_at_period_end  BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

---

### audit_logs
```sql
id              UUID PRIMARY KEY
workspace_id    UUID REFERENCES workspaces(id)
user_id         UUID REFERENCES users(id)
action          TEXT  -- 'agent.created', 'member.invited', 'integration.connected'
target_type     TEXT  -- 'agent', 'workspace', 'member'
target_id       UUID
metadata        JSONB
ip_address      TEXT
created_at      TIMESTAMPTZ DEFAULT now()
```

---

## 3. API TASK LIST

### Auth Routes `/api/auth`
```
POST /auth/signup              — email/password registration
POST /auth/login               — email/password login → JWT
POST /auth/logout              — invalidate session
POST /auth/refresh             — refresh access token
GET  /auth/me                  — current user profile
POST /auth/google              — OAuth callback handler
POST /auth/forgot-password     — send reset email
POST /auth/reset-password      — apply new password
GET  /auth/verify/:token       — email verification
POST /api-keys                 — create API key
DELETE /api-keys/:id           — revoke API key
```

### Workspace Routes `/api/workspaces`
```
POST   /workspaces             — create workspace
GET    /workspaces             — list user's workspaces
GET    /workspaces/:id         — get workspace details
PATCH  /workspaces/:id         — update name, logo, settings
DELETE /workspaces/:id         — delete workspace (owner only)
GET    /workspaces/:id/members — list members
POST   /workspaces/:id/invite  — invite by email
DELETE /workspaces/:id/members/:userId — remove member
PATCH  /workspaces/:id/members/:userId — change role
POST   /workspaces/:id/join/:token     — accept invite
```

### Agent Routes `/api/workspaces/:workspaceId/agents`
```
POST   /agents                 — create agent
GET    /agents                 — list agents (with pagination/filter)
GET    /agents/:id             — get agent details
PATCH  /agents/:id             — update name, description, status
DELETE /agents/:id             — soft delete agent
PATCH  /agents/:id/personality — update personality fields
GET    /agents/:id/personality — get personality
PATCH  /agents/:id/model       — update model settings
GET    /agents/:id/model       — get model settings
POST   /agents/:id/duplicate   — clone agent
PATCH  /agents/:id/visibility  — toggle public/private
```

### Chat / Test Routes
```
POST /agents/:id/chat          — send test message, returns response
GET  /agents/:id/chat/history  — get test chat history
DELETE /agents/:id/chat/history — clear test chat
```

### Knowledge Routes
```
POST   /agents/:id/knowledge           — upload file or add URL
GET    /agents/:id/knowledge           — list knowledge sources
DELETE /agents/:id/knowledge/:sourceId — delete source
GET    /agents/:id/knowledge/:sourceId/status — processing status
POST   /agents/:id/knowledge/search    — test retrieval query
```

### Commands Routes
```
POST   /agents/:id/commands    — create command
GET    /agents/:id/commands    — list commands
PATCH  /agents/:id/commands/:commandId — update
DELETE /agents/:id/commands/:commandId — delete
POST   /agents/:id/commands/:commandId/test — test command
```

### Integrations Routes
```
GET    /agents/:id/integrations              — list integrations
POST   /agents/:id/integrations/sms/connect — connect Twilio number
DELETE /agents/:id/integrations/sms         — disconnect SMS
POST   /agents/:id/integrations/telegram/connect — connect bot token
DELETE /agents/:id/integrations/telegram    — disconnect Telegram
PATCH  /agents/:id/integrations/:type/settings — update settings
```

### Inbound Webhook Routes (unauthenticated, verified by signature)
```
POST /webhooks/sms/inbound     — Twilio inbound SMS
POST /webhooks/sms/status      — Twilio delivery status
POST /webhooks/telegram/:botId — Telegram webhook
POST /webhooks/discord/:guildId — Discord webhook
```

### Approval Routes
```
GET    /workspaces/:id/approvals           — list pending approvals
GET    /workspaces/:id/approvals/:approvalId — get approval detail
POST   /workspaces/:id/approvals/:approvalId/approve — approve + send
POST   /workspaces/:id/approvals/:approvalId/reject  — reject
PATCH  /workspaces/:id/approvals/:approvalId/edit    — edit draft
```

### Automation Routes
```
POST   /agents/:id/automations            — create automation
GET    /agents/:id/automations            — list automations
PATCH  /agents/:id/automations/:automationId — update
DELETE /agents/:id/automations/:automationId — delete
POST   /agents/:id/automations/:automationId/run — manual trigger
GET    /agents/:id/automations/:automationId/runs — run history
PATCH  /agents/:id/automations/:automationId/toggle — enable/disable
```

### Analytics Routes
```
GET /workspaces/:id/analytics/overview   — messages, agents, usage totals
GET /workspaces/:id/analytics/agents     — per-agent stats
GET /agents/:id/analytics                — detailed agent analytics
GET /agents/:id/analytics/threads        — conversation stats
```

### Billing Routes
```
GET    /workspaces/:id/billing           — current plan + usage
POST   /workspaces/:id/billing/checkout  — Stripe checkout session
POST   /workspaces/:id/billing/portal    — Stripe customer portal
POST   /webhooks/stripe                  — Stripe webhook handler
```

---

## 4. AGENT RUNTIME ARCHITECTURE

### Full Pipeline (all channels share this core)

```
INBOUND EVENT (SMS / Telegram / Web Chat / Scheduled)
        │
        ▼
1. EVENT NORMALIZATION
   - Extract: channel, external_id, user_identifier, content
   - Validate webhook signature
   - Normalize to standard InboundEvent schema

        │
        ▼
2. AGENT RESOLUTION
   - Look up agent by phone number / bot token / agent_id
   - Check agent status (active? paused?)
   - Load agent + personality + model settings

        │
        ▼
3. THREAD RESOLUTION (ThreadService)
   - Find or create conversation_thread (agent_id + channel + external_id)
   - Load last N messages for context window
   - Increment message_count

        │
        ▼
4. MEMORY LOADING (MemoryService)
   - Load active session memories for this thread
   - Load relevant structured memories (user name, preferences)
   - Load rolling summary if thread > 20 messages

        │
        ▼
5. KNOWLEDGE RETRIEVAL (KnowledgeService)
   - Embed user query
   - Vector similarity search against knowledge_chunks
   - Filter by relevance threshold (cosine similarity > 0.75)
   - Return top 3-5 chunks

        │
        ▼
6. COMMAND DETECTION (ToolRouter)
   - Check message against command triggers (exact + regex)
   - If command match: execute command, skip to delivery
   - Otherwise: continue to prompt assembly

        │
        ▼
7. PROMPT ASSEMBLY (PromptBuilder)
   - System prompt from personality (bio, lore, style, forbidden words)
   - Memory context injection
   - Knowledge context injection
   - Recent conversation history
   - Current user message
   - Final assembled prompt

        │
        ▼
8. MODEL EXECUTION (ModelService)
   - Route to correct provider (OpenAI / Anthropic / Gemini)
   - Apply model settings (temperature, max_tokens)
   - Retry on rate limit (3x with backoff)
   - Track token usage and latency

        │
        ▼
9. APPROVAL CHECK (ApprovalService)
   - If integration.requires_approval = true:
     → Create approval_queue entry (status: pending)
     → Notify workspace admins
     → STOP here — do not send
   - Otherwise: continue to delivery

        │
        ▼
10. OUTBOUND DELIVERY (DeliveryService)
    - Route to correct channel (SMS via Twilio, Telegram via Bot API, etc.)
    - Handle delivery failures with retry
    - Save external_message_id on success

        │
        ▼
11. PERSISTENCE & ANALYTICS
    - Save assistant message to messages table
    - Update thread.last_message_at
    - Emit analytics_event (message_sent, tokens_used, latency_ms)
    - Update memory if needed (MemoryService.onMessageSaved)
```

---

## 5. MEMORY SYSTEM

### Three-Layer Architecture

**Layer 1 — Session Memory**
- Scope: per conversation thread, short-lived
- Storage: memory_entries with type='session', expires_at = now() + 24h
- What gets stored: things mentioned in current session (user's name, their problem, preferences stated)
- Extraction: after every assistant response, lightweight extraction prompt identifies key facts
- Cost control: max 10 session memories per thread, TTL 24h

**Layer 2 — Rolling Summary**
- Scope: per thread, permanent
- Trigger: every 20 messages, generate a summary of the conversation so far
- Storage: memory_entries with type='summary'
- Retrieval: always injected into context if thread > 20 messages old
- Cost control: max 500 tokens per summary, keep only last 3 summaries per thread

**Layer 3 — Structured Memory**
- Scope: per thread (could expand to per-user later)
- Storage: memory_entries with type='structured', key/value pairs
- Examples: user_name, company_name, last_issue, subscription_tier, preferences
- How promoted: extraction pipeline identifies high-confidence facts after each exchange
- Retrieval: all structured memories for a thread loaded at runtime start
- Retention: no expiry unless explicitly cleared or updated

### Cost Control Rules
- Skip memory extraction if response was < 50 tokens (likely a command response)
- Cap knowledge retrieval at 5 chunks
- Cap memory context injection at 800 tokens total
- Never store PII in memory (phone numbers, credit cards) — strip via regex

---

## 6. KNOWLEDGE / RAG SYSTEM

### Ingestion Pipeline

```
FILE UPLOAD / URL INPUT
        │
        ▼
1. STORAGE — save file to S3, record knowledge_source (status: pending)
        │
        ▼
2. PARSING (queue job)
   - PDF → pdfjs or pdf-parse
   - DOCX → mammoth
   - TXT → direct
   - URL → fetch + readability/cheerio
        │
        ▼
3. CHUNKING
   - Strategy: recursive character text splitter
   - Chunk size: 512 tokens, overlap: 64 tokens
   - Preserve sentence boundaries
   - Store chunk_index and source metadata
        │
        ▼
4. EMBEDDING GENERATION
   - Provider: OpenAI text-embedding-3-small (1536 dims, cheapest/best ratio)
   - Batch 100 chunks at a time
   - Store in knowledge_chunks.embedding (pgvector)
        │
        ▼
5. INDEX UPDATE — update source status to 'ready', update chunk_count
```

### Retrieval at Runtime
```javascript
async function retrieveRelevantChunks(agentId, query, topK = 5) {
  const queryEmbedding = await embedText(query);
  return db.query(`
    SELECT content, metadata, 1 - (embedding <=> $1) AS similarity
    FROM knowledge_chunks
    WHERE agent_id = $2
      AND 1 - (embedding <=> $1) > 0.75
    ORDER BY similarity DESC
    LIMIT $3
  `, [queryEmbedding, agentId, topK]);
}
```

### V1 Limits
- Max 5 knowledge sources per agent
- Max 50MB per file
- Max 10,000 chunks per agent
- URL content refreshed manually (no auto-sync in V1)

---

## 7. COMMANDS / TOOLS SYSTEM

### Command Types

**Static** — exact match triggers fixed response
```json
{ "trigger": "/hours", "type": "static", "response": "We're open 9-5 EST Mon-Fri." }
```

**Template** — response uses variables from message
```json
{ "trigger": "/price {{product}}", "type": "template", "template": "The price of {{product}} is..." }
```

**Webhook** — POST to external URL, return response
```json
{ "trigger": "/order {{id}}", "type": "webhook", "webhook_url": "https://api.yourapp.com/orders/{{id}}" }
```

**Workflow** — internal actions (create ticket, send email, log lead)
```json
{ "trigger": "I want to speak to a human", "type": "workflow", "workflow": "escalate_to_human" }
```

### Detection Flow
1. Strip whitespace, lowercase
2. Check exact triggers first (O(1) hash lookup)
3. Then regex triggers
4. If match → execute → inject result as assistant message
5. If no match → continue to LLM pipeline

### Parameter Extraction
- Webhook commands: extract `{{param}}` patterns, fill from user message via simple NLP
- Validate required params before executing
- Return error message if params missing

---

## 8. SMS IMPLEMENTATION (Twilio V1)

### Setup Flow
1. User connects Twilio credentials (Account SID + Auth Token) in workspace settings
2. Credentials stored encrypted in agent_integrations.config
3. User selects/assigns a Twilio phone number to an agent
4. System sets Twilio webhook URL to `https://api.dipperai.com/webhooks/sms/inbound`

### Inbound Flow
```
Twilio POST /webhooks/sms/inbound
  → Validate Twilio signature (X-Twilio-Signature header)
  → Look up agent by To (phone number)
  → Check opt-out list
  → Check quiet hours (skip if in quiet hours)
  → Run full RuntimeOrchestrator pipeline
  → Reply via Twilio REST API (or TwiML response)
  → Log delivery to messages table
```

### Outbound Flow (Automations / Campaigns)
```
Automation triggers → BullMQ job
  → Check opt-out list
  → Check quiet hours
  → If requires_approval: create approval_queue entry
  → Else: POST to Twilio /Messages
  → Handle delivery status webhook (/webhooks/sms/status)
  → Update message status
```

### Safety Controls
- Respect opt-out keywords (STOP, UNSUBSCRIBE, QUIT, CANCEL)
- Auto-respond to opt-out: "You've been unsubscribed. Reply START to resubscribe."
- Quiet hours: configurable per phone number
- Rate limit: max 1 message per second per number (BullMQ rate limiter)
- Max message length: 1600 chars (auto-split into segments)

### Failure/Retry Strategy
- On Twilio API error: retry 3x with exponential backoff via BullMQ
- On invalid number: mark thread as invalid, stop future messages
- On persistent failure: alert workspace admin via email

---

## 9. TELEGRAM IMPLEMENTATION

### Setup Flow
1. User creates bot via @BotFather, gets bot token
2. User enters token in DipperAI UI
3. Backend calls Telegram setWebhook API → points to `/webhooks/telegram/:botId`
4. Backend validates bot is reachable, stores token encrypted

### Inbound Flow
```
Telegram POST /webhooks/telegram/:botId
  → Validate request (compare bot token in URL)
  → Parse Update object (message, callback_query, etc.)
  → Normalize to InboundEvent schema
  → Resolve thread (agent_id + channel='telegram' + chat.id)
  → Run RuntimeOrchestrator pipeline
  → Reply via Telegram sendMessage API
```

### Supported Update Types (V1)
- message (text)
- callback_query (inline buttons — future)
- /start command (welcome message)
- /help command (auto-generated from commands list)

### Auto-Post Support
- Automation can POST to a specific chat_id
- Supports text, markdown formatting
- Optional approval before send

---

## 10. AUTOMATION ENGINE (BullMQ)

### Queue Structure
```
queues/
  automation:scheduled  — cron-based jobs
  automation:triggered  — event-based jobs
  automation:manual     — manual run-now
  knowledge:ingestion   — file processing jobs
  delivery:sms          — outbound SMS with rate limiting
  delivery:telegram     — outbound Telegram
  notifications:email   — internal alerts
```

### Trigger Types (V1)
| Trigger | Example |
|---|---|
| Schedule (cron) | Every Monday 9am — send weekly summary |
| Delay after event | 24h after no reply — send follow-up |
| Manual | "Run now" button in UI |
| Webhook | External service triggers agent |

### Action Types (V1)
| Action | Description |
|---|---|
| send_message | Send to specific thread/contact |
| post | Post to channel (Telegram channel, etc.) |
| notify_team | Send internal Slack/email notification |
| create_approval | Create approval queue item instead of sending |

### BullMQ Job Structure
```typescript
{
  name: 'automation:run',
  data: {
    automationId: string,
    agentId: string,
    triggerContext: Record<string, any>
  },
  opts: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500
  }
}
```

### Safety Controls
- Max 10 automations per agent (free), 50 (pro), unlimited (business)
- Dry-run mode: executes pipeline but doesn't deliver (for testing)
- Kill switch: global pause all automations for workspace
- Rate limiter on delivery queues (SMS: 1/s, Telegram: 30/s)

---

## 11. APPROVAL WORKFLOW

### Status Transitions
```
pending → approved → sent
pending → rejected (no send)
pending → expired (timeout, no action taken)
pending → edited → approved → sent
```

### Configuration
- Per-integration setting: `requires_approval = true/false`
- Per-automation: `requires_approval = true/false`
- Applies to: replies, auto-posts, campaign messages

### Implementation Flow
1. ApprovalService creates approval_queue entry with draft content
2. Notification sent to workspace admins (email + in-app)
3. Admin reviews in Approvals dashboard
4. Admin can: Approve (send as-is), Edit + Approve, Reject
5. On approve: DeliveryService sends immediately
6. On reject: rejection_reason saved, no message sent
7. Expiry: if no action in 24h → status = expired, notification sent

### Backend Module
```typescript
class ApprovalService {
  async createDraft(data: ApprovalDraft): Promise<ApprovalQueueItem>
  async approve(approvalId: string, reviewedBy: string): Promise<void>
  async reject(approvalId: string, reason: string, reviewedBy: string): Promise<void>
  async editAndApprove(approvalId: string, editedContent: string, reviewedBy: string): Promise<void>
  async expireStale(): Promise<void>  // run via cron job
  async getPending(workspaceId: string): Promise<ApprovalQueueItem[]>
}
```

---

## 12. ANALYTICS + LOGGING

### Event Types
```
message_received     — inbound from any channel
message_sent         — outbound delivered
message_failed       — delivery failure
command_executed     — tool/command triggered
automation_run       — automation job completed
approval_created     — new item in approval queue
approval_approved    — approved by reviewer
approval_rejected    — rejected by reviewer
agent_activated      — agent went live
integration_connected — new channel connected
error_occurred       — runtime error with severity
knowledge_retrieved  — RAG retrieval triggered
```

### Event Schema
```typescript
{
  id: UUID,
  workspace_id: UUID,
  agent_id: UUID,
  event_type: string,
  channel: 'web' | 'sms' | 'telegram' | 'discord',
  thread_id?: UUID,
  metadata: {
    tokens_used?: number,
    latency_ms?: number,
    model?: string,
    error_code?: string,
    [key: string]: any
  },
  created_at: timestamp
}
```

### Aggregation
- Daily rollups via BullMQ cron: compute totals per workspace/agent for past day
- Store in analytics_daily_rollups table for fast dashboard queries
- Raw events kept 90 days, rollups kept forever

### Dashboard Queries (Pre-aggregated)
- Messages sent last 30 days (daily breakdown)
- Top performing agents by message volume
- Response rate (messages received vs sent)
- Average response latency
- Integration health status

---

## 13. BILLING ARCHITECTURE

### Plan Definitions
```typescript
const PLANS = {
  free: {
    agents: 1,
    messages_per_month: 100,
    integrations: ['sms'],
    knowledge_sources_per_agent: 1,
    team_members: 1,
    analytics_retention_days: 7
  },
  pro: {
    agents: 10,
    messages_per_month: 10000,
    integrations: ['sms', 'telegram', 'discord', 'x'],
    knowledge_sources_per_agent: 5,
    team_members: 5,
    analytics_retention_days: 90
  },
  business: {
    agents: Infinity,
    messages_per_month: Infinity,
    integrations: 'all',
    knowledge_sources_per_agent: 20,
    team_members: Infinity,
    analytics_retention_days: 365
  }
}
```

### Enforcement Pattern
```typescript
// BillingGuard middleware
async function requireFeature(workspaceId: string, feature: string) {
  const sub = await getSubscription(workspaceId);
  const plan = PLANS[sub.plan];
  if (!planAllows(plan, feature)) {
    throw new UpgradeRequiredError(feature, sub.plan);
  }
}

// Usage metering
async function checkAgentLimit(workspaceId: string) {
  const count = await countActiveAgents(workspaceId);
  const plan = await getPlan(workspaceId);
  if (count >= PLANS[plan].agents) throw new LimitReachedError('agents');
}
```

### Stripe Integration (when ready)
- `stripe.checkout.sessions.create` → hosted checkout
- `stripe.billingPortal.sessions.create` → self-service plan changes
- Webhook: `customer.subscription.updated/deleted` → update subscriptions table
- Metered billing hook: increment usage counter on each message sent

---

## 14. SECURITY

### Credential Storage
- Twilio tokens, Telegram bot tokens: encrypted at rest using AES-256-GCM
- Encryption key stored in environment variable (KMS in production)
- Never returned in API responses (masked: `****5678`)

### Webhook Verification
- Twilio: verify `X-Twilio-Signature` header
- Telegram: verify bot token in URL matches stored token
- Stripe: verify `stripe-signature` header
- All webhooks: IP allowlist where provider publishes IPs

### RBAC
```
owner   → full access including billing, delete workspace
admin   → manage agents, members, integrations, approvals
editor  → create/edit agents, view analytics
viewer  → view only, can approve messages
```

### Rate Limiting
- Auth endpoints: 10 req/min per IP
- API endpoints: 100 req/min per workspace
- Chat test: 30 req/min per user
- Webhooks: no limit (handled by providers)

### Tenant Isolation
- Every DB query includes `workspace_id` filter
- Row-level security via PostgreSQL RLS policies
- API keys scoped to workspace

### Audit Logging
- Log all mutations (create, update, delete, role changes)
- Log all integration connections/disconnections
- Retain audit logs 1 year minimum
- Never log message content in audit logs (privacy)

---

## 15. IMPLEMENTATION PHASES

### Phase 1 — Foundation (Week 1-2)
**Goal:** Users can sign up, create workspaces, and invite members
- [ ] PostgreSQL setup + schema migrations (users, workspaces, members, subscriptions)
- [ ] JWT auth (signup, login, refresh, logout)
- [ ] Google OAuth
- [ ] Workspace CRUD + member invites
- [ ] RBAC middleware
- [ ] Audit logging service
- **Done when:** User can sign up, create workspace, invite a member, roles enforced on routes

### Phase 2 — Agents + Personality (Week 2-3)
**Goal:** Users can create, configure, and test agents
- [ ] Agent CRUD (create, list, get, update, delete, duplicate)
- [ ] Personality builder (save/load all fields)
- [ ] Model settings (provider, model, temperature, etc.)
- [ ] Template system (seed 10 templates)
- [ ] PromptBuilder service (assemble system prompt from personality)
- [ ] Test chat endpoint (web chat only, no integrations yet)
- [ ] ModelService (OpenAI first, Anthropic + Gemini next)
- **Done when:** User can create agent, set personality, and chat with it in test mode

### Phase 3 — Knowledge (Week 3-4)
**Goal:** Agents can answer questions from uploaded documents
- [ ] File upload API + S3 storage
- [ ] PDF/DOCX/TXT parser (BullMQ job)
- [ ] Text chunking service
- [ ] Embedding generation (OpenAI text-embedding-3-small)
- [ ] pgvector storage + indexing
- [ ] Retrieval service + relevance filtering
- [ ] Inject retrieved chunks into PromptBuilder
- [ ] URL ingestion
- **Done when:** Upload a PDF, ask a question in test chat, get answer from document

### Phase 4 — SMS Integration (Week 4-5)
**Goal:** Agents can send and receive SMS via Twilio
- [ ] Workspace Twilio credentials storage (encrypted)
- [ ] Phone number assignment to agents
- [ ] Inbound Twilio webhook handler
- [ ] Thread resolution for SMS
- [ ] Full runtime pipeline for SMS
- [ ] Outbound SMS delivery
- [ ] Opt-out/opt-in handling
- [ ] Quiet hours enforcement
- [ ] Delivery status tracking
- **Done when:** Text a Twilio number, get a real AI response from your agent

### Phase 5 — Telegram Integration (Week 5)
**Goal:** Agents work as Telegram bots
- [ ] Bot token connection + webhook registration
- [ ] Inbound Telegram webhook handler
- [ ] Thread resolution for Telegram
- [ ] Reply via Telegram Bot API
- [ ] /start and /help auto-commands
- **Done when:** Message your Telegram bot, get AI response

### Phase 6 — Automations + Approvals (Week 6)
**Goal:** Agents can post on schedule with optional human review
- [ ] BullMQ setup + queue definitions
- [ ] Automation CRUD API
- [ ] Cron scheduler (register/unregister jobs on create/update/delete)
- [ ] Automation runner (execute pipeline, handle output)
- [ ] Approval queue data model + API
- [ ] Approval workflow (create draft, notify, approve/reject)
- [ ] Send-on-approve flow
- [ ] Manual "Run Now" trigger
- **Done when:** Create scheduled SMS automation, it runs on schedule, requires approval before sending

### Phase 7 — Memory + Analytics (Week 7)
**Goal:** Agents remember users and you can see performance metrics
- [ ] Session memory extraction pipeline
- [ ] Rolling summary generation (every 20 messages)
- [ ] Structured memory promotion
- [ ] Memory injection into PromptBuilder
- [ ] Analytics event ingestion
- [ ] Daily rollup BullMQ job
- [ ] Analytics API endpoints
- [ ] Dashboard query endpoints
- **Done when:** Agent remembers user's name across sessions; dashboard shows message volume

### Phase 8 — Billing + Polish (Week 8)
**Goal:** Platform is monetization-ready
- [ ] Stripe integration (checkout, portal, webhooks)
- [ ] Plan enforcement middleware (agent limits, message limits, feature gating)
- [ ] Usage metering hooks
- [ ] Billing dashboard API
- [ ] Email notifications (invite, approval needed, limit warnings)
- [ ] Rate limiting hardening
- [ ] Security audit (RBAC, tenant isolation, credential encryption)
- **Done when:** User can upgrade to Pro, limits enforced, Stripe billing works end-to-end

---

## 16. ENGINEERING TASK CHECKLIST

### Auth & Users
- [ ] **Set up PostgreSQL + run migrations**
  - Objective: Production-ready DB with all schema tables
  - Notes: Use `node-postgres` or Drizzle ORM. Run migrations via drizzle-kit or custom migrator.
  - Dependencies: none

- [ ] **Implement JWT auth (signup/login/refresh)**
  - Objective: Stateless auth with access + refresh tokens
  - Notes: Access token 15min TTL, refresh token 7d TTL stored in httpOnly cookie. Use `jsonwebtoken`.
  - Dependencies: users table

- [ ] **Google OAuth**
  - Objective: One-click login with Google
  - Notes: Use Passport.js google-oauth20 strategy or Auth.js. Store google_id on user.
  - Dependencies: users table, JWT auth

- [ ] **Email verification flow**
  - Objective: Verify user email before full access
  - Notes: Send verification link via Resend or SendGrid. 24h expiry token.
  - Dependencies: users table, email service

### Workspaces
- [ ] **Workspace CRUD API**
  - Objective: Users can create and manage multiple workspaces
  - Notes: Slug auto-generated from name (unique). Owner auto-added as member.
  - Dependencies: auth, workspaces table

- [ ] **Member invite system**
  - Objective: Invite users by email with role assignment
  - Notes: Generate signed invite token (JWT). Accept flow handles new vs existing users.
  - Dependencies: workspace_members, email service

- [ ] **RBAC middleware**
  - Objective: Enforce permissions on all workspace-scoped routes
  - Notes: `requireRole(minRole)` middleware. Roles ordered: viewer < editor < admin < owner.
  - Dependencies: workspace_members table

### Agents
- [ ] **Agent CRUD with personality + model settings**
  - Objective: Full agent lifecycle management
  - Notes: Create agent → auto-create personality + model_settings rows. Use transactions.
  - Dependencies: agents, agent_personality, agent_model_settings tables

- [ ] **Template system**
  - Objective: Seed 10+ templates users can start from
  - Notes: Store in DB. On "use template" → copy personality + model settings to new agent.
  - Dependencies: agent_templates table

- [ ] **PromptBuilder service**
  - Objective: Assemble final system prompt from all agent data
  - Notes: Format: `You are {name}. {bio}. {lore}. Your personality: {adjectives}. Topics: {topics}. Never say: {forbidden_words}. {memory_context}. {knowledge_context}.`
  - Dependencies: agent_personality, MemoryService, KnowledgeService

### Runtime
- [ ] **RuntimeOrchestrator**
  - Objective: Single entry point for all inbound events
  - Notes: Orchestrates all services in correct order. Returns structured response.
  - Dependencies: ThreadService, MemoryService, KnowledgeService, ToolRouter, PromptBuilder, ModelService, ApprovalService, DeliveryService

- [ ] **ModelService (OpenAI first)**
  - Objective: Send assembled prompt to LLM, return completion
  - Notes: Use `openai` SDK. Handle 429 with exponential backoff. Log tokens + latency.
  - Dependencies: agent_model_settings

- [ ] **Add Anthropic + Gemini support to ModelService**
  - Objective: Multi-provider model routing
  - Notes: Strategy pattern — each provider implements same `complete(prompt, settings)` interface.
  - Dependencies: ModelService (OpenAI)

### Knowledge
- [ ] **File upload + S3 storage**
  - Objective: Accept PDF/DOCX/TXT files, store securely
  - Notes: Use multer for upload. Use `@aws-sdk/client-s3` for storage. Max 50MB.
  - Dependencies: knowledge_sources table, S3 bucket

- [ ] **Parsing + chunking BullMQ job**
  - Objective: Process uploaded files into text chunks
  - Notes: PDF: pdf-parse. DOCX: mammoth. Chunk: 512 tokens, 64 overlap. Queue job on upload.
  - Dependencies: BullMQ, file upload

- [ ] **Embedding + pgvector storage**
  - Objective: Generate embeddings for all chunks
  - Notes: OpenAI text-embedding-3-small. Batch 100 chunks. Store vector in pgvector column.
  - Dependencies: chunking job, pgvector extension

- [ ] **Retrieval service**
  - Objective: Semantic search over agent's knowledge base
  - Notes: Embed query → cosine similarity search → return top 5 above 0.75 threshold.
  - Dependencies: knowledge_chunks with embeddings

### SMS
- [ ] **Twilio credential storage + phone number assignment**
  - Objective: Securely store Twilio creds, map numbers to agents
  - Notes: Encrypt Account SID + Auth Token with AES-256-GCM. Store IV + ciphertext.
  - Dependencies: agent_integrations, sms_numbers tables

- [ ] **Inbound Twilio webhook**
  - Objective: Receive and process inbound SMS
  - Notes: Verify Twilio signature. Check opt-out. Check quiet hours. Run orchestrator.
  - Dependencies: RuntimeOrchestrator, Twilio signature verification

- [ ] **Opt-out handling**
  - Objective: TCPA-compliant opt-out management
  - Notes: Auto-detect STOP keywords. Save to sms_opt_outs. Reply with confirmation.
  - Dependencies: sms_opt_outs table

### Automations
- [ ] **BullMQ setup**
  - Objective: Reliable job queue for automations and delivery
  - Notes: Redis connection. Separate queues per concern. Bull Board for monitoring (admin only).
  - Dependencies: Redis

- [ ] **Automation CRUD + scheduler registration**
  - Objective: Create/update/delete automations with cron scheduling
  - Notes: On create/update: register BullMQ repeatable job. On delete: remove job. Use cron-parser for validation.
  - Dependencies: automations table, BullMQ

- [ ] **Approval workflow**
  - Objective: Human review before outbound sends
  - Notes: Create draft → notify admins → approve/reject → send or discard. Expire after 24h via cron.
  - Dependencies: approval_queue table, DeliveryService, notification service

### Analytics
- [ ] **Analytics event ingestion**
  - Objective: Fire-and-forget event tracking throughout the codebase
  - Notes: Async, never block main request. `analyticsService.track(event)` pattern.
  - Dependencies: analytics_events table

- [ ] **Daily rollup job**
  - Objective: Pre-aggregate stats for fast dashboard queries
  - Notes: BullMQ cron job runs at midnight. Aggregates previous day per workspace + agent.
  - Dependencies: analytics_events table, BullMQ

### Billing
- [ ] **Plan enforcement middleware**
  - Objective: Block over-limit actions with upgrade prompt
  - Notes: Check on agent create, message send, member invite. Return 402 with upgrade URL.
  - Dependencies: subscriptions table, PLANS config

- [ ] **Stripe checkout + webhooks**
  - Objective: Accept payments and sync plan status
  - Notes: Checkout creates Stripe customer + subscription. Webhook syncs status changes.
  - Dependencies: subscriptions table, Stripe SDK

### Security
- [ ] **Credential encryption service**
  - Objective: Encrypt all third-party API keys at rest
  - Notes: AES-256-GCM with key from env. Helper functions: encrypt(plaintext), decrypt(ciphertext+iv).
  - Dependencies: crypto module

- [ ] **Webhook signature verification**
  - Objective: Ensure webhooks come from legitimate sources
  - Notes: Twilio: HMAC-SHA1. Stripe: HMAC-SHA256. Telegram: token in URL.
  - Dependencies: each integration's webhook handler

- [ ] **Rate limiting**
  - Objective: Prevent abuse and protect downstream APIs
  - Notes: Use `express-rate-limit` + Redis store for distributed rate limiting.
  - Dependencies: Redis, Express

---

*Save this document. This is your engineering bible for DipperAI.*
*Estimated build time with one engineer: 6-8 weeks for full Phase 1-8.*
*Estimated build time with AI assistance (Claude Code / Codex): 2-3 weeks.*
