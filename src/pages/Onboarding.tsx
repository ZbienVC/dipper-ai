import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Headphones, TrendingUp, Users, Sparkles, ChevronRight, Check, Send, Copy, ExternalLink } from 'lucide-react'

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

const BOT_TYPES = [
  { id: 'customer-support', label: 'Customer Support Bot', icon: Headphones, desc: 'Answer FAQs, handle tickets 24/7', emoji: '🎧', systemPrompt: 'You are a friendly and professional customer support agent. Help users with their questions, resolve issues, and escalate when needed. Always be empathetic and solution-oriented.' },
  { id: 'lead-gen', label: 'Lead Generation Bot', icon: TrendingUp, desc: 'Capture and qualify leads automatically', emoji: '📈', systemPrompt: 'You are a lead generation specialist. Engage visitors, ask qualifying questions, capture contact info, and schedule demos or calls. Be persuasive but not pushy.' },
  { id: 'community', label: 'Community Manager', icon: Users, desc: 'Manage Discord/Telegram communities', emoji: '👥', systemPrompt: 'You are an enthusiastic community manager. Welcome new members, answer community questions, enforce rules kindly, and keep conversations engaging and on-topic.' },
  { id: 'sales', label: 'Sales Assistant', icon: TrendingUp, desc: 'Guide prospects toward a purchase', emoji: '💼', systemPrompt: 'You are an expert sales assistant. Understand customer needs, handle objections, highlight product benefits, and guide prospects toward making a confident buying decision.' },
  { id: 'custom', label: 'Something Else', icon: Sparkles, desc: 'Build a custom agent from scratch', emoji: '✨', systemPrompt: 'You are a helpful AI assistant. Be friendly, knowledgeable, and always aim to provide accurate and useful responses.' },
]

const TONES = ['Friendly', 'Professional', 'Casual', 'Formal', 'Enthusiastic', 'Empathetic']

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [selectedType, setSelectedType] = useState<typeof BOT_TYPES[0] | null>(null)
  const [agentName, setAgentName] = useState('')
  const [agentPurpose, setAgentPurpose] = useState('')
  const [agentTone, setAgentTone] = useState('Friendly')
  const [selectedChannel, setSelectedChannel] = useState<'telegram' | 'discord' | 'web' | null>(null)
  const [creating, setCreating] = useState(false)
  const [createdAgent, setCreatedAgent] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  // Redirect if user already has agents
  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login'); return }
    fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          navigate('/dashboard')
        }
      })
      .catch(() => {})
  }, [])

  const handleCreateAgent = async () => {
    if (!selectedType || !agentName.trim()) return
    const token = getToken()
    if (!token) return
    setCreating(true)
    setError('')
    try {
      const systemPrompt = `${selectedType.systemPrompt}\n\nTone: ${agentTone}${agentPurpose ? `\n\nAdditional context: ${agentPurpose}` : ''}`
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: agentName.trim(),
          description: selectedType.label,
          system_prompt: systemPrompt,
          model: 'claude-haiku-4-5',
          emoji: selectedType.emoji,
          template_id: selectedType.id,
        }),
      })
      if (!res.ok) throw new Error('Failed to create agent')
      const agent = await res.json()
      setCreatedAgent(agent)
      setStep(4)
    } catch (e: any) {
      setError('Failed to create agent. Please try again.')
    }
    setCreating(false)
  }

  const copyEmbedCode = () => {
    if (!createdAgent) return
    const code = `<script src="https://dipperai.com/embed.js" data-token="${createdAgent.embed_token}"></script>`
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const progressPercent = ((step - 1) / 3) * 100

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center">
          <Bot size={16} className="text-white" />
        </div>
        <span className="text-white font-bold text-lg">DipperAI</span>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-lg mb-6">
        <div className="flex justify-between text-xs text-slate-500 mb-2">
          <span>Step {step} of 4</span>
          <span>{Math.round(progressPercent)}% complete</span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-violet-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="w-full max-w-lg">
        {/* Step 1: Choose bot type */}
        {step === 1 && (
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-8">
            <h1 className="text-2xl font-bold text-white mb-2">Welcome to DipperAI 👋</h1>
            <p className="text-slate-400 mb-6">What would you like to build first?</p>
            <div className="space-y-3">
              {BOT_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                    selectedType?.id === type.id
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-[#1e1e2e] bg-white/3 hover:border-violet-500/40 hover:bg-violet-500/5'
                  }`}
                >
                  <span className="text-2xl flex-shrink-0">{type.emoji}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm">{type.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{type.desc}</p>
                  </div>
                  {selectedType?.id === type.id && (
                    <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => selectedType && setStep(2)}
              disabled={!selectedType}
              className="mt-6 w-full gradient-btn py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 2: Configure agent */}
        {step === 2 && (
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-8">
            <h1 className="text-2xl font-bold text-white mb-2">Let's build your agent</h1>
            <p className="text-slate-400 mb-6">Keep it simple — you can always refine it later.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Agent name *</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={e => setAgentName(e.target.value)}
                  placeholder={`e.g. "Luna Support Bot"`}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">What should it know about your business? <span className="text-slate-500 font-normal">(optional)</span></label>
                <textarea
                  value={agentPurpose}
                  onChange={e => setAgentPurpose(e.target.value)}
                  placeholder="e.g. We sell handmade candles online. Our return policy is 30 days. Common questions are about shipping time..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600 text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Tone</label>
                <div className="flex flex-wrap gap-2">
                  {TONES.map(tone => (
                    <button
                      key={tone}
                      onClick={() => setAgentTone(tone)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        agentTone === tone
                          ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                          : 'border-[#1e1e2e] text-slate-400 hover:border-violet-500/40'
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {error && <p className="mt-3 text-red-400 text-xs">{error}</p>}
            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(1)} className="px-4 py-3 rounded-xl border border-[#1e1e2e] text-slate-400 text-sm hover:bg-white/5 transition-all">
                Back
              </button>
              <button
                onClick={() => agentName.trim() && setStep(3)}
                disabled={!agentName.trim()}
                className="flex-1 gradient-btn py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Connect a channel */}
        {step === 3 && (
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-8">
            <h1 className="text-2xl font-bold text-white mb-2">Connect a channel</h1>
            <p className="text-slate-400 mb-6">Pick one to start — you can add more channels later.</p>
            <div className="space-y-3">
              {[
                { id: 'telegram', label: 'Telegram Bot', desc: 'Most popular · Connect via bot token', emoji: '✈️', popular: true },
                { id: 'web', label: 'Website Chat Widget', desc: 'Embed on any website with one line of code', emoji: '🌐', popular: false },
                { id: 'discord', label: 'Discord Server', desc: 'Add your agent to a Discord server', emoji: '🎮', popular: false },
              ].map(ch => (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannel(ch.id as any)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                    selectedChannel === ch.id
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-[#1e1e2e] bg-white/3 hover:border-violet-500/40 hover:bg-violet-500/5'
                  }`}
                >
                  <span className="text-2xl flex-shrink-0">{ch.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white text-sm">{ch.label}</p>
                      {ch.popular && <span className="text-[10px] bg-violet-500/20 text-violet-400 border border-violet-500/30 px-1.5 py-0.5 rounded font-bold">Popular</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{ch.desc}</p>
                  </div>
                  {selectedChannel === ch.id && (
                    <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
              <button
                onClick={() => setSelectedChannel('web')}
                className="w-full text-xs text-slate-500 hover:text-slate-400 transition-colors py-1"
              >
                Skip for now → Set up later
              </button>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(2)} className="px-4 py-3 rounded-xl border border-[#1e1e2e] text-slate-400 text-sm hover:bg-white/5 transition-all">
                Back
              </button>
              <button
                onClick={handleCreateAgent}
                disabled={creating}
                className="flex-1 gradient-btn py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {creating ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</>
                ) : (
                  <><Sparkles size={16} /> Create My Agent</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && createdAgent && (
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-500/15 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Your agent is ready! 🎉</h1>
            <p className="text-slate-400 mb-6">
              <span className="text-violet-300 font-semibold">{createdAgent.name}</span> has been created and is ready to deploy.
            </p>

            {selectedChannel === 'web' && (
              <div className="mb-6 text-left">
                <p className="text-sm font-semibold text-slate-300 mb-2">Embed on your website:</p>
                <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl p-3 font-mono text-xs text-slate-400 break-all">
                  {`<script src="https://dipperai.com/embed.js" data-token="${createdAgent.embed_token}"></script>`}
                </div>
                <button onClick={copyEmbedCode} className="mt-2 flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy embed code</>}
                </button>
              </div>
            )}

            {selectedChannel === 'telegram' && (
              <div className="mb-6 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-left">
                <p className="text-sm font-semibold text-blue-300 mb-1">Connect Telegram</p>
                <p className="text-xs text-slate-400">Go to your agent's <strong className="text-slate-300">Integrations</strong> tab and paste your Telegram Bot Token to go live.</p>
              </div>
            )}

            {selectedChannel === 'discord' && (
              <div className="mb-6 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-left">
                <p className="text-sm font-semibold text-indigo-300 mb-1">Connect Discord</p>
                <p className="text-xs text-slate-400">Go to your agent's <strong className="text-slate-300">Integrations</strong> tab and add your Discord Webhook URL.</p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate(`/dashboard/agents/${createdAgent.id}?tab=chat`)}
                className="gradient-btn py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Send size={15} /> Test Your Agent
              </button>
              <button
                onClick={() => navigate(`/dashboard/agents/${createdAgent.id}?tab=integrations`)}
                className="py-3 rounded-xl font-semibold text-sm border border-[#1e1e2e] text-slate-300 hover:bg-white/5 flex items-center justify-center gap-2 transition-all"
              >
                <ExternalLink size={15} /> Connect Channels
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="text-xs text-slate-500 hover:text-slate-400 transition-colors py-1"
              >
                Go to Dashboard →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
