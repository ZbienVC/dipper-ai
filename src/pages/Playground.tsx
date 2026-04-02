import { useState, useRef, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Send, Bot, User, RefreshCw, MessageSquare, Smartphone, Hash, Monitor } from 'lucide-react'

const CHANNEL_STYLES = [
  { id: 'sms', label: 'SMS', icon: Smartphone, bg: 'bg-green-500/10', border: 'border-green-500/20', accent: 'bg-green-500', text: 'text-green-400', bubble: 'bg-green-600/20 border border-green-500/20 text-green-100', userBubble: 'bg-white/10 text-white' },
  { id: 'telegram', label: 'Telegram', icon: Hash, bg: 'bg-sky-500/10', border: 'border-sky-500/20', accent: 'bg-sky-500', text: 'text-sky-400', bubble: 'bg-sky-600/20 border border-sky-500/20 text-sky-100', userBubble: 'bg-white/10 text-white' },
  { id: 'discord', label: 'Discord', icon: Hash, bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', accent: 'bg-indigo-500', text: 'text-indigo-400', bubble: 'bg-indigo-600/20 border border-indigo-500/20 text-indigo-100', userBubble: 'bg-white/10 text-white' },
  { id: 'web', label: 'Web Chat', icon: Monitor, bg: 'bg-violet-500/10', border: 'border-violet-500/20', accent: 'bg-violet-500', text: 'text-violet-400', bubble: 'bg-violet-600/20 border border-violet-500/20 text-violet-100', userBubble: 'bg-white/10 text-white' },
]

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface Agent {
  id: string
  name: string
  emoji?: string
  system_prompt?: string
  model?: string
}

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function TypingIndicator({ accent }: { accent: string }) {
  return (
    <div className="flex items-end gap-2">
      <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
        <Bot size={13} className="text-slate-400" />
      </div>
      <div className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-bl-sm bg-white/5 border border-white/10">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${accent} animate-bounce`}
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

export default function Playground() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [selectedChannel, setSelectedChannel] = useState(CHANNEL_STYLES[0])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const token = getToken()
    if (!token) { setAgentsLoading(false); return }
    fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((data: Agent[]) => {
        setAgents(data)
        if (data.length > 0) setSelectedAgent(data[0])
      })
      .catch(() => {})
      .finally(() => setAgentsLoading(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  function clearChat() {
    setMessages([])
  }

  async function sendMessage() {
    if (!input.trim() || loading || !selectedAgent) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setIsTyping(true)

    try {
      const token = getToken()

      const res = await fetch('/api/playground/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          message: userMsg.content,
          channel: selectedChannel.id,
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      setIsTyping(false)

      setIsTyping(false)

      setIsTyping(false)
      if (res.ok) {
        const data = await res.json()
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.reply || data.message || 'No response.',
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, botMsg])
      } else {
        const errData = await res.json().catch(() => ({}))
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Could not reach agent — check your API connection. ${errData.error || ''}`.trim(),
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, botMsg])
      }
    } catch {
      setIsTyping(false)
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Could not reach agent — check your API connection.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, botMsg])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const channelStyle = selectedChannel

  return (
    <DashboardLayout title="Playground">
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Agent Playground</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Test your agents in real-time before deploying.</p>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Config Panel */}
        <div className="w-64 flex-shrink-0 space-y-4">
          {/* Agent Selector */}
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Agent</p>
            {agentsLoading ? (
              <div className="h-8 bg-white/5 rounded-lg animate-pulse" />
            ) : agents.length === 0 ? (
              <p className="text-xs text-slate-600">No agents yet. Create one first.</p>
            ) : (
              <div className="space-y-1.5">
                {agents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => { setSelectedAgent(agent); clearChat() }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedAgent?.id === agent.id
                        ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <span className="text-base">{agent.emoji || '🤖'}</span>
                    <span className="truncate">{agent.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Channel Selector */}
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Simulate Channel</p>
            <div className="space-y-1.5">
              {CHANNEL_STYLES.map(ch => {
                const Icon = ch.icon
                return (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChannel(ch)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedChannel.id === ch.id
                        ? `${ch.bg} ${ch.text} border ${ch.border}`
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Icon size={14} />
                    {ch.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Info */}
          {selectedAgent && (
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Active Agent</p>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{selectedAgent.emoji || '🤖'}</span>
                <span className="text-sm font-semibold text-white">{selectedAgent.name}</span>
              </div>
              {selectedAgent.model && (
                <p className="text-xs text-slate-600">
                  Model: <span className="text-slate-400">{selectedAgent.model}</span>
                </p>
              )}
              <div className={`mt-3 flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg w-fit ${channelStyle.bg} ${channelStyle.text}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${channelStyle.accent}`} />
                {channelStyle.label} mode
              </div>
            </div>
          )}
        </div>

        {/* Chat Window */}
        <div className="flex-1 flex flex-col bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden">
          {/* Chat Header */}
          <div className={`px-4 py-3 border-b border-[#1e1e2e] flex items-center justify-between ${channelStyle.bg}`}>
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl ${channelStyle.bg} border ${channelStyle.border} flex items-center justify-center`}>
                {selectedAgent ? (
                  <span className="text-sm">{selectedAgent.emoji || '🤖'}</span>
                ) : (
                  <Bot size={15} className={channelStyle.text} />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{selectedAgent?.name || 'Select an agent'}</p>
                <p className={`text-[10px] font-medium ${channelStyle.text}`}>
                  {channelStyle.label} simulation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Online
              </div>
              <button
                onClick={clearChat}
                className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors"
                title="Clear chat"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !isTyping && (
              <div className="flex flex-col items-center justify-center h-full text-center py-10">
                <div className={`w-14 h-14 rounded-2xl ${channelStyle.bg} border ${channelStyle.border} flex items-center justify-center mb-4`}>
                  <MessageSquare size={24} className={channelStyle.text} />
                </div>
                <p className="text-white font-semibold mb-1">
                  {selectedAgent ? `Chat with ${selectedAgent.name}` : 'Select an agent to start'}
                </p>
                <p className="text-slate-600 text-sm max-w-xs">
                  {selectedAgent
                    ? `Type a message to test your agent in ${channelStyle.label} mode.`
                    : 'Choose an agent from the left panel to begin testing.'}
                </p>
                {selectedAgent && (
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {['Hello, what can you do?', 'Tell me more about your features', 'How do I get started?'].map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => { setInput(suggestion); inputRef.current?.focus() }}
                        className="text-xs px-3 py-1.5 rounded-xl bg-white/5 border border-[#1e1e2e] text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user'
                    ? 'bg-violet-600/30 border border-violet-500/30'
                    : 'bg-white/10 border border-white/10'
                }`}>
                  {msg.role === 'user'
                    ? <User size={13} className="text-violet-300" />
                    : <Bot size={13} className="text-slate-400" />}
                </div>
                <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? `${channelStyle.userBubble} rounded-br-sm`
                      : `${channelStyle.bubble} rounded-bl-sm`
                  }`}>
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-slate-600 px-1">{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            ))}

            {isTyping && <TypingIndicator accent={channelStyle.accent} />}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[#1e1e2e]">
            <div className={`flex items-end gap-2 bg-white/5 border rounded-xl px-3 py-2 transition-colors focus-within:border-violet-500/50 ${channelStyle.border}`}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedAgent ? `Message ${selectedAgent.name}... (Enter to send)` : 'Select an agent first...'}
                disabled={!selectedAgent || loading}
                rows={1}
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none resize-none max-h-32 disabled:opacity-50"
                style={{ lineHeight: '1.5' }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading || !selectedAgent}
                className={`p-2 rounded-lg transition-all flex-shrink-0 ${
                  input.trim() && !loading && selectedAgent
                    ? `${channelStyle.accent} text-white hover:opacity-80`
                    : 'bg-white/5 text-slate-600 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5 text-center">
              Enter ↵ to send · Shift+Enter for new line · Simulating {channelStyle.label} channel
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
