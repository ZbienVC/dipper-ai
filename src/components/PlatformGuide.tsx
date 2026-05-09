import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, X, Send, Loader2, ArrowRight, Bot } from 'lucide-react'

const GUIDE_SYSTEM = `You are the DipperAI Platform Guide — a friendly, concise AI assistant built into the DipperAI platform. Your job is to help users navigate the platform and achieve their goals.

## Platform Overview
DipperAI lets users build, deploy and manage AI agents that can:
- Chat with customers/users on Telegram, SMS, Discord, web embed
- Capture leads and contacts automatically
- Send automated messages and broadcasts
- Run on schedules and triggers (Automations)
- Use AI models: Claude, GPT-4o, Gemini

## Pages and what they do
- /dashboard — Overview: agent stats, recent activity, quick actions
- /dashboard/agents — List of all your AI agents. Create, edit, manage them here
- /dashboard/agents/new — Create a new AI agent (start here if you haven't)
- /dashboard/templates — Pre-built agent templates to start from (customer support, sales, etc.)
- /dashboard/playground — Test any agent in a sandbox before going live
- /dashboard/integrations — Connect channels: Telegram bot, SMS (Twilio), Discord, web embed
- /dashboard/leads — View and manage contacts captured by your agents
- /dashboard/broadcasts — Send a message to all your leads at once
- /dashboard/teams — Add team members and collaborate
- /dashboard/automations — Set up triggers: "when X happens, do Y" rules
- /dashboard/approvals — Review and manually approve agent responses before they send
- /dashboard/analytics — Charts and stats on message volume, agent performance
- /dashboard/reports — Export data and detailed reports
- /dashboard/activity — Live log of everything happening across all agents
- /dashboard/media — AI-powered video/image editor, create Telegram stickers, GIFs
- /dashboard/billing — Upgrade plan, manage subscription
- /dashboard/settings — Account settings, password, notifications

## Response format
Always respond in this exact JSON format:
{
  "message": "Your helpful response here (1-3 sentences, friendly and direct)",
  "action": {
    "label": "Button label (5 words max)",
    "path": "/dashboard/path"
  }
}

If no specific navigation action is needed, omit the "action" field.
If multiple destinations apply, pick the single most relevant one.

## Examples
User: "I want to build a customer support bot"
Response: {"message": "Great choice! Start by creating a new agent — there's a Customer Support template that'll get you set up in under 2 minutes.", "action": {"label": "Create Support Agent", "path": "/dashboard/agents/new"}}

User: "How do I connect my Telegram?"
Response: {"message": "Head to Integrations and select Telegram. You'll need a bot token from @BotFather — takes about 60 seconds.", "action": {"label": "Go to Integrations", "path": "/dashboard/integrations"}}

User: "I want to see how my agents are performing"
Response: {"message": "Check Analytics for charts on message volume and response rates, or Activity for a real-time log of everything.", "action": {"label": "View Analytics", "path": "/dashboard/analytics"}}

User: "How do I send a message to all my contacts?"
Response: {"message": "Use Broadcasts — you can send a message to all your leads in one shot, filtered by channel.", "action": {"label": "Go to Broadcasts", "path": "/dashboard/broadcasts"}}

Be concise. Don't over-explain. Be like a knowledgeable friend, not a manual.`

interface Msg { role: 'user' | 'assistant'; content: string; action?: { label: string; path: string } }

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

export default function PlatformGuide() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content: "Hey! Tell me what you're trying to do and I'll point you in the right direction.",
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pulse, setPulse] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) { setPulse(false); setTimeout(() => inputRef.current?.focus(), 80); }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    const next: Msg[] = [...messages, { role: 'user', content: msg }]
    setMessages(next)
    setLoading(true)

    try {
      const token = getToken()
      const res = await fetch('/api/platform-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) }),
      })
      const data = await res.json()
      let parsed: { message: string; action?: { label: string; path: string } } = { message: data.content || "I'm not sure about that — try browsing the nav on the left!" }
      try {
        const raw = data.content?.replace(/```json\n?|\n?```/g, '').trim()
        parsed = JSON.parse(raw)
      } catch {}
      setMessages(prev => [...prev, { role: 'assistant', content: parsed.message, action: parsed.action }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Connection issue — try again in a moment." }])
    }
    setLoading(false)
  }

  const SUGGESTIONS = [
    "How do I create an agent?",
    "Connect to Telegram",
    "Send a broadcast message",
    "Track my performance",
  ]

  return (
    <>
      <style>{`
        @keyframes guideSlide { from { opacity:0; transform:translateY(8px) scale(0.97); } to { opacity:1; transform:none; } }
        @keyframes guidePulse { 0%,100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.5); } 50% { box-shadow: 0 0 0 8px rgba(139,92,246,0); } }
        .guide-enter { animation: guideSlide 0.2s ease forwards; }
        .guide-pulse { animation: guidePulse 2.5s ease-in-out infinite; }
        .guide-msg-user { background: linear-gradient(135deg,#7c3aed,#6d28d9); color:#fff; border-radius:14px 14px 3px 14px; }
        .guide-msg-ai { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); color:#c4d0f5; border-radius:14px 14px 14px 3px; }
        .guide-chip:hover { background:rgba(139,92,246,0.15)!important; border-color:rgba(139,92,246,0.4)!important; }
        .guide-action:hover { opacity:0.85; }
      `}</style>

      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={!open && pulse ? 'guide-pulse' : ''}
        title="Platform Guide — Ask me anything"
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 12px', borderRadius: 9,
          background: open ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.1)',
          border: `1px solid rgba(139,92,246,${open ? '0.4' : '0.25'})`,
          color: '#a78bfa', cursor: 'pointer', transition: 'all 0.15s', fontSize: 12, fontWeight: 700,
        }}>
        <Bot size={14} />
        <span className="hidden sm:inline">Guide</span>
        {!open && pulse && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10d9a0', flexShrink: 0 }} />
        )}
      </button>

      {/* Floating panel */}
      {open && (
        <div className="guide-enter" style={{
          position: 'fixed', bottom: 20, right: 20, width: 'min(380px, calc(100vw - 32px))',
          maxHeight: 'min(520px, calc(100vh - 100px))',
          background: 'rgba(8,8,14,0.97)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.08)',
          zIndex: 9990, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(139,92,246,0.05)', flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={15} className="text-white" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#f0f4ff' }}>Platform Guide</div>
              <div style={{ fontSize: 10, color: '#10d9a0', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10d9a0', display: 'inline-block' }} />
                AI-powered navigation assistant
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#4a5580', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#c4d0f5')} onMouseLeave={e => (e.currentTarget.style.color = '#4a5580')}>
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, scrollbarWidth: 'none' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
                {m.role === 'assistant' && (
                  <div style={{ width: 24, height: 24, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Sparkles size={11} className="text-white" />
                  </div>
                )}
                <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className={m.role === 'user' ? 'guide-msg-user' : 'guide-msg-ai'}
                    style={{ padding: '9px 13px', fontSize: 13, lineHeight: 1.55 }}>
                    {m.content}
                  </div>
                  {m.action && (
                    <button className="guide-action"
                      onClick={() => { navigate(m.action!.path); setOpen(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, alignSelf: 'flex-start', transition: 'opacity 0.15s' }}>
                      {m.action.label} <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={11} className="text-white" />
                </div>
                <div className="guide-msg-ai" style={{ padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', animation: 'guidePulse 1.2s ease-in-out infinite', animationDelay: i*0.2+'s' }} />
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions — only on first message */}
            {messages.length === 1 && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)} className="guide-chip"
                    style={{ padding: '8px 12px', borderRadius: 9, textAlign: 'left', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.18)', color: '#8b9cc8', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, flexShrink: 0 }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="What are you trying to do?"
              style={{ flex: 1, padding: '9px 13px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#f0f4ff', fontSize: 13, outline: 'none' }}
              onFocus={e => (e.target.style.borderColor = 'rgba(139,92,246,0.4)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading}
              style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: input.trim() && !loading ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'rgba(255,255,255,0.05)', color: input.trim() && !loading ? '#fff' : '#4a5580', cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export { GUIDE_SYSTEM }
