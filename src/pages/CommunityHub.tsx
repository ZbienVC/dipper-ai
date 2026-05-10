import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { Users, Send, Shield, Zap, BarChart2, Sticker, Plus, Bot, Settings, ChevronRight, Copy, Check, Loader2, ExternalLink, Hash } from 'lucide-react'

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

const BOT_TYPES = [
  { id: 'community-manager', icon: '🏘️', name: 'Community Manager', desc: 'Full Telegram community — verification, moderation, welcome flows', color: '#7c3aed' },
  { id: 'buy-bot', icon: '💰', name: 'Buy Alert Bot', desc: 'Real-time buy alerts for any token on any chain', color: '#10d9a0' },
]

const SETUP_STEPS = [
  { icon: '1️⃣', title: 'Open @BotFather', desc: 'Search @BotFather in Telegram', url: 'https://t.me/botfather' },
  { icon: '2️⃣', title: 'Create your bot', desc: 'Send /newbot → choose name → choose username (must end in "bot")', url: null },
  { icon: '3️⃣', title: 'Copy the token', desc: 'BotFather gives you a token like: 1234567890:AAFxxxxxxxx', url: null },
  { icon: '4️⃣', title: 'Paste it below', desc: 'Connect it to your agent and auto-configure everything', url: null },
]

interface Community {
  id: string
  name: string
  emoji: string
  model: string
  total_messages: number
  created_at: string
  template_id: string
}

export default function CommunityHub() {
  const navigate = useNavigate()
  const token = getToken()
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [selectedType, setSelectedType] = useState('community-manager')
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState<{bot_username: string; webhook_url: string} | null>(null)
  const [copiedStep, setCopiedStep] = useState<number | null>(null)
  const [stats, setStats] = useState<{members?: number; title?: string} | null>(null)
  const [puppet, setPuppet] = useState({ chatId: '', text: '', sending: false, sent: false })

  useEffect(() => {
    if (!token) return
    fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const comms = data.filter((a: Community) => ['community-manager', 'buy-bot'].includes(a.template_id))
        setCommunities(comms)
      })
      .finally(() => setLoading(false))
  }, [token])

  const connectBot = async () => {
    if (!botToken || !selectedType) return
    setConnecting(true)
    try {
      // Create the agent first
      const agentRes = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: selectedType === 'buy-bot' ? 'Buy Alert Bot' : 'Community Manager', emoji: selectedType === 'buy-bot' ? '💰' : '🏘️', templateId: selectedType, model: 'claude-sonnet-4-5' }),
      })
      const agent = await agentRes.json()
      if (!agent.id) { alert('Failed to create agent'); return }

      // Auto-register webhook
      const webhookRes = await fetch(`/api/integrations/telegram/auto-webhook/${agent.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ botToken }),
      })
      const webhookData = await webhookRes.json()
      if (webhookData.ok) {
        // Connect Telegram integration
        await fetch('/api/integrations/telegram/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ botToken, agentId: agent.id }),
        })
        setConnected(webhookData)
        setCommunities(prev => [...prev, agent])
        setShowSetup(false)
        navigate(`/dashboard/agents/${agent.id}?tab=chat`)
      } else {
        alert('Bot connection failed: ' + (webhookData.error || 'Unknown error'))
      }
    } catch (e) { alert('Error connecting bot') }
    setConnecting(false)
  }

  const sendPuppet = async (agentId: string) => {
    if (!puppet.chatId || !puppet.text) return
    setPuppet(p => ({ ...p, sending: true }))
    try {
      const r = await fetch(`/api/community/${agentId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chat_id: puppet.chatId, text: puppet.text }),
      })
      const d = await r.json()
      if (d.ok) setPuppet(p => ({ ...p, sent: true, text: '' }))
      else alert('Send failed: ' + d.error)
    } catch { alert('Error sending') }
    setPuppet(p => ({ ...p, sending: false }))
  }

  const copyStep = (i: number, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedStep(i)
    setTimeout(() => setCopiedStep(null), 2000)
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Telegram OS</p>
            <h1 className="text-2xl font-black text-white">Community Hub</h1>
            <p className="text-slate-500 text-sm mt-1">Manage bots, communities, sticker packs and buy alerts</p>
          </div>
          <button onClick={() => setShowSetup(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white gradient-btn">
            <Plus size={15} /> New Community Bot
          </button>
        </div>

        {/* Active Communities */}
        {communities.length > 0 && (
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Your Communities</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {communities.map(c => (
                <div key={c.id} className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-5 hover:border-violet-500/30 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-lg">{c.emoji}</div>
                      <div>
                        <div className="font-bold text-white">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.total_messages} messages</div>
                      </div>
                    </div>
                    <Link to={`/dashboard/agents/${c.id}?tab=chat`}
                      className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">
                      Open <ChevronRight size={12} />
                    </Link>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: <Send size={12}/>, label: 'Puppet', action: () => {} },
                      { icon: <Shield size={12}/>, label: 'Moderate', action: () => navigate(`/dashboard/agents/${c.id}?tab=chat`) },
                      { icon: <BarChart2 size={12}/>, label: 'Stats', action: () => navigate(`/dashboard/agents/${c.id}?tab=analytics`) },
                    ].map(btn => (
                      <button key={btn.label} onClick={btn.action}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-slate-400 bg-white/3 border border-white/6 hover:text-violet-400 hover:border-violet-500/25 transition-all">
                        {btn.icon}{btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && communities.length === 0 && (
          <div className="text-center py-20 bg-[#111118] border border-[#1e1e2e] rounded-2xl mb-8">
            <div className="text-4xl mb-4">🏘️</div>
            <div className="font-bold text-white text-lg mb-2">No communities yet</div>
            <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">Connect a Telegram bot and DipperAI will manage your entire community — verification, moderation, buy alerts, and more.</p>
            <button onClick={() => setShowSetup(true)} className="gradient-btn px-6 py-2.5 rounded-xl font-bold text-sm text-white">
              Set Up First Community Bot
            </button>
          </div>
        )}

        {/* Bot type cards */}
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Bot Types</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BOT_TYPES.map(bt => (
              <div key={bt.id} className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  <div className="text-2xl">{bt.icon}</div>
                  <div className="flex-1">
                    <div className="font-bold text-white mb-1">{bt.name}</div>
                    <div className="text-sm text-slate-500 mb-3">{bt.desc}</div>
                    <button onClick={() => { setSelectedType(bt.id); setShowSetup(true); }}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors">
                      Set Up →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BotFather guide */}
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <Bot size={18} className="text-violet-400" />
            <div>
              <div className="font-bold text-white">How to get a Telegram bot token</div>
              <div className="text-xs text-slate-500">Takes about 60 seconds via @BotFather</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {SETUP_STEPS.map((step, i) => (
              <div key={i} className="bg-white/3 border border-white/6 rounded-xl p-4">
                <div className="text-lg mb-2">{step.icon}</div>
                <div className="font-semibold text-white text-sm mb-1">{step.title}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{step.desc}</div>
                {step.url && (
                  <a href={step.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-violet-400 mt-2 hover:text-violet-300">
                    Open <ExternalLink size={10} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Setup modal */}
      {showSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f0f17] border border-[#1e1e2e] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-[#1e1e2e]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-white text-base">Connect Telegram Bot</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Get your token from @BotFather first</p>
                </div>
                <button onClick={() => setShowSetup(false)} className="text-slate-500 hover:text-white"><Hash size={18} /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Bot Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {BOT_TYPES.map(bt => (
                    <button key={bt.id} onClick={() => setSelectedType(bt.id)}
                      className={`p-3 rounded-xl border text-sm font-semibold text-left transition-all ${selectedType === bt.id ? 'border-violet-500/50 bg-violet-500/10 text-violet-300' : 'border-white/8 text-slate-400 hover:border-white/15'}`}>
                      <div>{bt.icon} {bt.name}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Bot Token (from @BotFather)</label>
                <input value={botToken} onChange={e => setBotToken(e.target.value)}
                  placeholder="1234567890:AAFxxxxxxxx"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-[#1e1e2e] text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
              </div>
              {connected && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                  <div className="font-bold text-green-400 text-sm mb-1">✅ Connected!</div>
                  <div className="text-xs text-slate-400">Bot: @{connected.bot_username}</div>
                  <div className="text-xs text-slate-400 break-all mt-1">Webhook: {connected.webhook_url}</div>
                </div>
              )}
              <button onClick={connectBot} disabled={!botToken || connecting}
                className="w-full gradient-btn py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40">
                {connecting ? <><Loader2 size={14} className="animate-spin" /> Connecting...</> : 'Connect & Configure Bot'}
              </button>
              <p className="text-center text-xs text-slate-500">
                Don't have a bot? <a href="https://t.me/botfather" target="_blank" rel="noreferrer" className="text-violet-400">Open @BotFather →</a>
              </p>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
