import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Send, Loader2 } from 'lucide-react'

interface Message {
  role: 'user' | 'agent'
  text: string
  ts: string
}

interface AgentInfo {
  name: string
  description: string
  emoji: string
}

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const SESSION_KEY = (token: string) => `dipperai_conv_${token}`

export default function EmbedChat() {
  const { token = '' } = useParams<{ token: string }>()
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [thinking, setThinking] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Restore conversation ID from session storage
    const savedConvId = sessionStorage.getItem(SESSION_KEY(token))
    if (savedConvId) setConversationId(savedConvId)

    fetch(`/api/embed/${token}/info`)
      .then(r => {
        if (!r.ok) throw new Error('not_found')
        return r.json()
      })
      .then((d: AgentInfo) => {
        setAgentInfo(d)
        setMessages([{
          role: 'agent',
          text: `Hi! I'm ${d.name}. How can I help you today?`,
          ts: getTime()
        }])
      })
      .catch(() => setError('This chat widget is not available.'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  const sendMessage = async () => {
    if (!inputText.trim() || thinking || !agentInfo) return
    const text = inputText.trim()
    setMessages(prev => [...prev, { role: 'user', text, ts: getTime() }])
    setInputText('')
    setThinking(true)

    try {
      const res = await fetch(`/api/embed/${token}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId }),
      })
      const data = await res.json()
      const newConvId = data.conversationId || conversationId
      if (newConvId) {
        setConversationId(newConvId)
        sessionStorage.setItem(SESSION_KEY(token), newConvId)
      }
      setMessages(prev => [...prev, {
        role: 'agent',
        text: data.content || data.error || 'Something went wrong.',
        ts: getTime()
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'agent',
        text: 'Sorry, something went wrong. Please try again.',
        ts: getTime()
      }])
    }
    setThinking(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const avatarLetter = agentInfo?.name?.[0]?.toUpperCase() || '?'

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="embed-root">
        <div className="embed-loading">
          <Loader2 size={28} className="animate-spin text-violet-400" />
          <p>Loading chat...</p>
        </div>
        <EmbedStyles />
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !agentInfo) {
    return (
      <div className="embed-root">
        <div className="embed-loading">
          <div className="embed-error-icon">💬</div>
          <p className="embed-error-title">Chat unavailable</p>
          <p className="embed-error-sub">{error || 'This widget is not available.'}</p>
        </div>
        <EmbedStyles />
      </div>
    )
  }

  // ── Chat UI ───────────────────────────────────────────────────────────────
  return (
    <div className="embed-root">
      {/* Header */}
      <div className="embed-header">
        <div className="embed-avatar">{avatarLetter}</div>
        <div className="embed-header-info">
          <p className="embed-agent-name">{agentInfo.name}</p>
          <p className="embed-agent-status">
            <span className="embed-status-dot" />
            Online
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="embed-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`embed-msg-row ${msg.role === 'user' ? 'embed-msg-row--user' : ''}`}>
            {msg.role === 'agent' && (
              <div className="embed-bubble-avatar">{avatarLetter}</div>
            )}
            <div className={`embed-bubble ${msg.role === 'user' ? 'embed-bubble--user' : 'embed-bubble--agent'}`}>
              <p>{msg.text}</p>
              <span className="embed-ts">{msg.ts}</span>
            </div>
          </div>
        ))}
        {thinking && (
          <div className="embed-msg-row">
            <div className="embed-bubble-avatar">{avatarLetter}</div>
            <div className="embed-bubble embed-bubble--agent embed-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="embed-input-bar">
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message..."
          className="embed-input"
          disabled={thinking}
        />
        <button
          onClick={sendMessage}
          disabled={!inputText.trim() || thinking}
          className="embed-send-btn"
        >
          {thinking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>

      {/* Footer */}
      <div className="embed-footer">
        <a href="https://dipperai.com" target="_blank" rel="noopener noreferrer">
          Powered by DipperAI
        </a>
      </div>

      <EmbedStyles />
    </div>
  )
}

function EmbedStyles() {
  return (
    <style>{`
      * { box-sizing: border-box; margin: 0; padding: 0; }

      .embed-root {
        display: flex;
        flex-direction: column;
        height: 100vh;
        width: 100%;
        background: #0a0a0f;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #e2e8f0;
        overflow: hidden;
      }

      /* Header */
      .embed-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 16px;
        background: #111118;
        border-bottom: 1px solid #1e1e2e;
        flex-shrink: 0;
      }
      .embed-avatar {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: linear-gradient(135deg, #7c3aed, #4f46e5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 15px;
        color: white;
        flex-shrink: 0;
      }
      .embed-header-info { flex: 1; min-width: 0; }
      .embed-agent-name { font-weight: 700; font-size: 14px; color: #fff; }
      .embed-agent-status {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        color: #64748b;
        margin-top: 1px;
      }
      .embed-status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #22c55e;
      }

      /* Messages */
      .embed-messages {
        flex: 1;
        overflow-y: auto;
        padding: 14px 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        scrollbar-width: thin;
        scrollbar-color: #1e1e2e transparent;
      }
      .embed-messages::-webkit-scrollbar { width: 4px; }
      .embed-messages::-webkit-scrollbar-track { background: transparent; }
      .embed-messages::-webkit-scrollbar-thumb { background: #1e1e2e; border-radius: 4px; }

      .embed-msg-row {
        display: flex;
        align-items: flex-end;
        gap: 7px;
        max-width: 100%;
      }
      .embed-msg-row--user { flex-direction: row-reverse; }

      .embed-bubble-avatar {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: linear-gradient(135deg, #7c3aed, #4f46e5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 11px;
        color: white;
        flex-shrink: 0;
        margin-bottom: 2px;
      }

      .embed-bubble {
        max-width: 72%;
        padding: 9px 12px;
        border-radius: 16px;
        font-size: 13px;
        line-height: 1.5;
        position: relative;
        word-break: break-word;
      }
      .embed-bubble--agent {
        background: #111118;
        border: 1px solid #1e1e2e;
        border-bottom-left-radius: 4px;
        color: #cbd5e1;
      }
      .embed-bubble--user {
        background: linear-gradient(135deg, #7c3aed, #6d28d9);
        border-bottom-right-radius: 4px;
        color: #fff;
      }
      .embed-ts {
        display: block;
        font-size: 10px;
        color: rgba(255,255,255,0.35);
        margin-top: 4px;
        text-align: right;
      }
      .embed-bubble--agent .embed-ts { text-align: left; }

      /* Typing indicator */
      .embed-typing {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 12px 14px;
        min-width: 52px;
      }
      .embed-typing span {
        display: block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #7c3aed;
        animation: bounce 1.2s ease-in-out infinite;
      }
      .embed-typing span:nth-child(2) { animation-delay: 0.2s; }
      .embed-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes bounce {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-5px); opacity: 1; }
      }

      /* Input */
      .embed-input-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: #111118;
        border-top: 1px solid #1e1e2e;
        flex-shrink: 0;
      }
      .embed-input {
        flex: 1;
        background: rgba(255,255,255,0.05);
        border: 1px solid #1e1e2e;
        border-radius: 20px;
        padding: 9px 14px;
        font-size: 13px;
        color: #e2e8f0;
        outline: none;
        transition: border-color 0.15s;
      }
      .embed-input::placeholder { color: #475569; }
      .embed-input:focus { border-color: rgba(124,58,237,0.5); }
      .embed-input:disabled { opacity: 0.6; }
      .embed-send-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, #7c3aed, #6d28d9);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        transition: opacity 0.15s, transform 0.1s;
        flex-shrink: 0;
      }
      .embed-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .embed-send-btn:not(:disabled):hover { opacity: 0.9; transform: scale(1.05); }

      /* Footer */
      .embed-footer {
        text-align: center;
        padding: 6px;
        flex-shrink: 0;
      }
      .embed-footer a {
        font-size: 10px;
        color: #334155;
        text-decoration: none;
        transition: color 0.15s;
      }
      .embed-footer a:hover { color: #7c3aed; }

      /* Loading / error */
      .embed-loading {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        color: #64748b;
        font-size: 13px;
      }
      .embed-error-icon { font-size: 32px; }
      .embed-error-title { font-size: 15px; font-weight: 700; color: #94a3b8; }
      .embed-error-sub { font-size: 12px; color: #475569; text-align: center; max-width: 220px; }
    `}</style>
  )
}
