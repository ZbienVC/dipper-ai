import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { Check, ChevronRight, ChevronLeft, Rocket, Bot, Zap, Brain, Sparkles, Star, MessageSquare, Phone, Hash, Twitter, Globe, X } from 'lucide-react'

const STEPS = ['Start', 'Identity', 'Model', 'Knowledge', 'Channels', 'Launch']

const TEMPLATES = [
  { id: 'customer-support', name: 'Customer Support', emoji: '🎧', desc: 'Handle FAQs & tickets 24/7', systemPrompt: 'You are a professional and empathetic customer support agent. You resolve issues quickly, acknowledge frustration with patience, and always aim to leave the customer satisfied.' },
  { id: 'sales-bot', name: 'Sales Agent', emoji: '💼', desc: 'Qualify leads & close deals', systemPrompt: 'You are a skilled sales agent. You ask thoughtful discovery questions, listen actively, and understand the prospect\'s real needs before presenting solutions.' },
  { id: 'community-manager', name: 'Community Manager', emoji: '🌐', desc: 'Engage your community', systemPrompt: 'You are an engaging community manager. You welcome new members, answer questions, and keep conversations lively and positive.' },
  { id: 'appointment-bot', name: 'Appointment Bot', emoji: '📅', desc: 'Book & manage appointments', systemPrompt: 'You are an appointment booking assistant. You help schedule, reschedule, and confirm appointments efficiently and clearly.' },
  { id: 'lead-capture', name: 'Lead Capture', emoji: '🎯', desc: 'Capture & qualify leads', systemPrompt: 'You are a lead qualification specialist. You engage visitors, understand their needs, and capture contact info for follow-up.' },
  { id: 'personal-assistant', name: 'Personal Assistant', emoji: '✨', desc: 'Your AI personal assistant', systemPrompt: 'You are a highly capable personal assistant. You help with scheduling, research, writing, and organizing information. You are concise and proactive.' },
  { id: 'ecommerce', name: 'E-commerce Bot', emoji: '🛒', desc: 'Product & order support', systemPrompt: 'You are an e-commerce support specialist. You help customers find products, track orders, handle returns, and answer product questions accurately.' },
  { id: 'research-agent', name: 'Research Agent', emoji: '🔬', desc: 'Deep research & fact-finding' },
  { id: 'sales-outreach', name: 'Sales Outreach', emoji: '💰', desc: 'Lead outreach & deal closing' },
  { id: 'content-creator', name: 'Content Creator', emoji: '✍️', desc: 'Posts, scripts & campaigns' },
  { id: 'community-builder', name: 'Community Manager', emoji: '🌐', desc: 'Engage & grow community' },
  { id: 'builder-assistant', name: 'Builder / Dev', emoji: '⚙️', desc: 'Code help & architecture' },
  { id: 'crypto-advisor', name: 'Crypto Advisor', emoji: '🔷', desc: 'Web3 & market intelligence' },
  { id: 'personal-assistant', name: 'Personal Assistant', emoji: '🧠', desc: 'Research, emails & tasks' },
  { id: 'creative-director', name: 'Creative Director', emoji: '🎨', desc: 'Brand, visuals & campaigns' },
  { id: 'custom', name: 'Custom Agent', emoji: '🤖', desc: 'Start from scratch', systemPrompt: '' },
]

const TONES = [
  { id: 'professional', label: 'Professional', desc: 'Formal & business-ready' },
  { id: 'friendly', label: 'Friendly', desc: 'Warm & approachable' },
  { id: 'casual', label: 'Casual', desc: 'Relaxed & conversational' },
  { id: 'technical', label: 'Technical', desc: 'Precise & detailed' },
  { id: 'empathetic', label: 'Empathetic', desc: 'Caring & understanding' },
]

const AVATARS = ['🤖', '🧠', '⚡', '🎯', '💼', '🌟', '🎧', '🛡️', '🔥', '💡', '🦾', '🎩']

const MODELS = [
  {
    id: 'claude-sonnet-4-5',
    provider: 'anthropic',
    icon: '🧠',
    name: 'Claude 3.5 Sonnet',
    tagline: 'Best for: Complex reasoning, nuanced conversations, writing',
    speed: 3,
    cost: 3,
    badge: 'RECOMMENDED',
    badgeColor: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  },
  {
    id: 'claude-haiku-4-5',
    provider: 'anthropic',
    icon: '⚡',
    name: 'Claude 3 Haiku',
    tagline: 'Best for: Fast replies, simple Q&A, high-volume SMS bots',
    speed: 5,
    cost: 1,
    badge: 'FASTEST & CHEAPEST',
    badgeColor: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    icon: '🤖',
    name: 'GPT-4o',
    tagline: 'Best for: Code, data analysis, structured outputs',
    speed: 3,
    cost: 4,
    badge: null,
    badgeColor: '',
  },
  {
    id: 'gemini-1.5-flash',
    provider: 'google',
    icon: '✨',
    name: 'Gemini 1.5 Flash',
    tagline: 'Best for: Multimodal, Google ecosystem, fast responses',
    speed: 4,
    cost: 2,
    badge: null,
    badgeColor: '',
  },
]

const CHANNELS = [
  { id: 'sms', name: 'SMS', icon: Phone, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  { id: 'telegram', name: 'Telegram', icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { id: 'discord', name: 'Discord', icon: Hash, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  { id: 'twitter', name: 'X / Twitter', icon: Twitter, color: 'text-slate-300', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  { id: 'web', name: 'Web Chat', icon: Globe, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
]

function Dots({ filled, total, color }: { filled: number; total: number; color: string }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`w-2 h-2 rounded-full ${i < filled ? color : 'bg-white/10'}`} />
      ))}
    </span>
  )
}

interface WizardState {
  startMode: 'scratch' | 'template' | ''
  selectedTemplate: string
  name: string
  purpose: string
  tone: string
  avatar: string
  model: string
  provider: string
  systemPrompt: string
  knowledgeText: string
  alwaysOn: boolean
  longTermMemory: boolean
  enabledChannels: string[]
}

const defaultState: WizardState = {
  startMode: '',
  selectedTemplate: '',
  name: '',
  purpose: '',
  tone: 'friendly',
  avatar: '🤖',
  model: 'claude-sonnet-4-5',
  provider: 'anthropic',
  systemPrompt: '',
  knowledgeText: '',
  alwaysOn: false,
  longTermMemory: false,
  enabledChannels: [],
}

export default function NewAgent() {
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(() => {
    const tpl = (location.state as any)?.template
    if (tpl) {
      return {
        ...defaultState,
        startMode: 'template',
        selectedTemplate: tpl.id,
        name: tpl.name || '',
        systemPrompt: tpl.systemPrompt || '',
        tone: tpl.tone?.toLowerCase() || 'friendly',
        avatar: tpl.emoji || '🤖',
      }
    }
    return defaultState
  })
  const [launched, setLaunched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [connectedChannels, setConnectedChannels] = useState<string[]>([])
  useEffect(() => {
    const token = localStorage.getItem('token') || (() => { try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null } })()
    if (!token) return
    fetch('/api/integrations', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then((integrations: any[]) => {
        const connected = integrations.filter(i => i.connected).map((i: any) => i.type)
        setConnectedChannels(connected)
      })
      .catch(() => {})
  }, [])

  const update = (patch: Partial<WizardState>) => setState(prev => ({ ...prev, ...patch }))

  const handleLaunch = async () => {
    setSaving(true)
    try {
      const userRaw = localStorage.getItem('dipperai_user')
      const user = userRaw ? JSON.parse(userRaw) : null
      const token = user?.token

      const systemPrompt = state.systemPrompt || `You are ${state.name || 'an AI assistant'}. ${state.purpose ? state.purpose + ' ' : ''}Be ${state.tone}.`

      if (!token) {
        setSaving(false)
        setLaunched(true)
        setTimeout(() => navigate('/dashboard/agents'), 1500)
        return
      }
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: state.name || 'My Agent',
          description: state.purpose,
          systemPrompt,
          model: state.model,
          provider: state.provider,
          emoji: state.avatar,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Server error ${res.status}`)
      }
    } catch (e: any) {
      setSaving(false)
      alert('Failed to create agent: ' + (e?.message || 'Unknown error'))
      return
    }
    setSaving(false)
    setLaunched(true)
    setTimeout(() => navigate('/dashboard/agents'), 1500)
  }

  const canNext = () => {
    if (step === 0) return state.startMode !== ''
    if (step === 1) return state.name.trim() !== ''
    return true
  }

  const inputClass = "w-full px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600 text-sm transition-all"
  const textareaClass = `${inputClass} resize-none`

  // Step 1: Choose starting point
  const renderStep0 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => update({ startMode: 'scratch', selectedTemplate: '', systemPrompt: '' })}
          className={`p-6 rounded-2xl border-2 text-left transition-all group ${state.startMode === 'scratch' ? 'border-violet-500 bg-violet-500/10' : 'border-[#1e1e2e] bg-white/5 hover:border-violet-500/40 hover:bg-violet-500/5'}`}
        >
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
            <Sparkles size={22} className="text-violet-400" />
          </div>
          <h3 className="font-bold text-white text-base mb-1.5">Start from scratch</h3>
          <p className="text-sm text-slate-500 leading-relaxed">Full control. Define your agent's purpose, personality, and behavior from the ground up.</p>
          {state.startMode === 'scratch' && <p className="text-xs font-bold text-violet-400 mt-3 flex items-center gap-1"><Check size={12} /> Selected</p>}
        </button>
        <button
          onClick={() => update({ startMode: 'template' })}
          className={`p-6 rounded-2xl border-2 text-left transition-all ${state.startMode === 'template' ? 'border-violet-500 bg-violet-500/10' : 'border-[#1e1e2e] bg-white/5 hover:border-violet-500/40 hover:bg-violet-500/5'}`}
        >
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
            <Star size={22} className="text-amber-400" />
          </div>
          <h3 className="font-bold text-white text-base mb-1.5">Use a template</h3>
          <p className="text-sm text-slate-500 leading-relaxed">Get started fast with a pre-built agent. Customize anything after launch.</p>
          {state.startMode === 'template' && <p className="text-xs font-bold text-violet-400 mt-3 flex items-center gap-1"><Check size={12} /> Selected</p>}
        </button>
      </div>

      {state.startMode === 'template' && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Choose a template</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TEMPLATES.map(t => (
              <button key={t.id} onClick={() => update({ selectedTemplate: t.id, systemPrompt: t.systemPrompt, name: t.id === 'custom' ? '' : state.name || t.name, avatar: t.emoji })}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${state.selectedTemplate === t.id ? 'border-violet-500 bg-violet-500/10' : 'border-[#1e1e2e] bg-white/5 hover:border-violet-500/30'}`}>
                <span className="text-2xl">{t.emoji}</span>
                <span className="font-semibold text-white text-xs">{t.name}</span>
                <span className="text-xs text-slate-600 leading-tight">{t.desc}</span>
                {state.selectedTemplate === t.id && <Check size={12} className="text-violet-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // Step 2: Identity
  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Agent Name <span className="text-red-400">*</span></label>
        <input value={state.name} onChange={e => update({ name: e.target.value })}
          placeholder="e.g. SupportBot, Sales AI, Aria" className={`${inputClass} text-lg font-semibold`} />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">What does this agent do?</label>
        <input value={state.purpose} onChange={e => update({ purpose: e.target.value })}
          placeholder="e.g. Answers customer support questions for my Shopify store"
          className={inputClass} />
        <p className="text-xs text-slate-600 mt-1.5">One sentence. This helps shape the agent's focus.</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-3">Tone</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TONES.map(t => (
            <button key={t.id} onClick={() => update({ tone: t.id })}
              className={`p-3 rounded-xl border-2 text-left transition-all ${state.tone === t.id ? 'border-violet-500 bg-violet-500/10' : 'border-[#1e1e2e] bg-white/5 hover:border-violet-500/30'}`}>
              <p className="font-semibold text-white text-sm">{t.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
              {state.tone === t.id && <Check size={11} className="text-violet-400 mt-1" />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-3">Avatar</label>
        <div className="flex flex-wrap gap-2">
          {AVATARS.map(em => (
            <button key={em} onClick={() => update({ avatar: em })}
              className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center border-2 transition-all ${state.avatar === em ? 'border-violet-500 bg-violet-500/20' : 'border-[#1e1e2e] bg-white/5 hover:border-violet-500/30'}`}>
              {em}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  // Step 3: Model
  const renderStep2 = () => (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Choose the AI brain behind your agent. You can change this anytime.</p>
      {MODELS.map(m => (
        <button key={m.id} onClick={() => update({ model: m.id, provider: m.provider })}
          className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${state.model === m.id ? 'border-violet-500 bg-violet-500/10' : 'border-[#1e1e2e] bg-white/5 hover:border-violet-500/30'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <span className="text-2xl mt-0.5">{m.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-bold text-white text-base">{m.name}</span>
                  {m.badge && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${m.badgeColor}`}>{m.badge}</span>
                  )}
                </div>
                <p className="text-sm text-slate-400 mb-3">{m.tagline}</p>
                <div className="flex items-center gap-5 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span>Speed</span>
                    <Dots filled={m.speed} total={5} color="bg-teal-400" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Cost</span>
                    <Dots filled={m.cost} total={5} color="bg-amber-400" />
                  </div>
                </div>
              </div>
            </div>
            {state.model === m.id && (
              <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
                <Check size={13} className="text-white" />
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  )

  // Step 4: Knowledge & Behavior
  const renderStep3 = () => (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold text-slate-300">System Prompt</label>
          <span className="text-xs text-slate-600">{state.systemPrompt.length} chars</span>
        </div>
        <textarea value={state.systemPrompt} onChange={e => update({ systemPrompt: e.target.value })}
          placeholder={`You are ${state.name || 'an AI assistant'}${state.purpose ? ` that ${state.purpose.toLowerCase()}` : ''}. Be helpful, clear, and ${state.tone}.`}
          rows={5} className={textareaClass} />
        <p className="text-xs text-slate-600 mt-1.5">This is the core instruction your agent follows in every conversation.</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Knowledge Base</label>
        <textarea value={state.knowledgeText} onChange={e => update({ knowledgeText: e.target.value })}
          placeholder="Paste FAQs, product info, policies, or anything your agent should know...&#10;&#10;Q: What are your hours?&#10;A: We're open Mon-Fri 9am-5pm EST"
          rows={6} className={textareaClass} />
        <p className="text-xs text-slate-600 mt-1.5">{state.knowledgeText.length} characters · This is appended to the system prompt as reference material.</p>
      </div>

      <div className="space-y-3">
        <div onClick={() => update({ alwaysOn: !state.alwaysOn })}
          className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${state.alwaysOn ? 'border-violet-500 bg-violet-500/10' : 'border-[#1e1e2e] bg-white/5 hover:border-violet-500/30'}`}>
          <div className="flex items-start gap-3">
            <Zap size={18} className={state.alwaysOn ? 'text-violet-400 mt-0.5' : 'text-slate-500 mt-0.5'} />
            <div>
              <p className="font-semibold text-white text-sm">Always-on mode</p>
              <p className="text-xs text-slate-500 mt-0.5">Agent stays active 24/7, remembers all users, sends scheduled messages</p>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-all flex items-center px-0.5 flex-shrink-0 ${state.alwaysOn ? 'bg-violet-600' : 'bg-white/10'}`}>
            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${state.alwaysOn ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
        </div>

        <div onClick={() => update({ longTermMemory: !state.longTermMemory })}
          className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${state.longTermMemory ? 'border-violet-500 bg-violet-500/10' : 'border-[#1e1e2e] bg-white/5 hover:border-violet-500/30'}`}>
          <div className="flex items-start gap-3">
            <Brain size={18} className={state.longTermMemory ? 'text-violet-400 mt-0.5' : 'text-slate-500 mt-0.5'} />
            <div>
              <p className="font-semibold text-white text-sm">Long-term memory</p>
              <p className="text-xs text-slate-500 mt-0.5">Agent remembers users across conversations forever</p>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-all flex items-center px-0.5 flex-shrink-0 ${state.longTermMemory ? 'bg-violet-600' : 'bg-white/10'}`}>
            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${state.longTermMemory ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
        </div>
      </div>
    </div>
  )

  // Step 5: Channels
  const renderStep4 = () => (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Choose where to deploy your agent. You can add or remove channels anytime.</p>
      <div className="space-y-3">
        {CHANNELS.map(ch => {
          const Icon = ch.icon
          const connected = connectedChannels.includes(ch.id)
          const selected = state.enabledChannels.includes(ch.id)
          return (
            <div key={ch.id}
              onClick={() => update({ enabledChannels: selected ? state.enabledChannels.filter(c => c !== ch.id) : [...state.enabledChannels, ch.id] })}
              className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selected ? 'border-violet-500 bg-violet-500/10' : 'border-[#1e1e2e] bg-white/5 hover:border-violet-500/30'}`}>
              <div className={`w-11 h-11 rounded-xl ${ch.bg} border ${ch.border} flex items-center justify-center flex-shrink-0`}>
                <Icon size={18} className={ch.color} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white text-sm">{ch.name}</p>
                <p className={`text-xs mt-0.5 ${connected ? 'text-green-400' : 'text-slate-500'}`}>
                  {connected ? '✓ Connected' : 'Setup required'}
                </p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selected ? 'bg-violet-500 border-violet-500' : 'border-slate-600'}`}>
                {selected && <Check size={11} className="text-white" />}
              </div>
            </div>
          )
        })}
      </div>
      <button onClick={() => update({ enabledChannels: [] })} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
        Skip for now - add channels after launch
      </button>
    </div>
  )

  // Step 6: Review & Launch
  const renderStep5 = () => {
    if (launched) {
      return (
        <div className="text-center py-12">
          <div className="w-24 h-24 rounded-3xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-5 text-4xl">
            {state.avatar}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Agent Launched! 🚀</h2>
          <p className="text-slate-400 mb-2"><span className="text-violet-400 font-semibold">{state.name || 'Your agent'}</span> is now live.</p>
          <p className="text-slate-600 text-sm">Redirecting to agents...</p>
          <div className="mt-5 flex justify-center gap-1.5">
            {[0, 150, 300].map(d => (
              <div key={d} className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        </div>
      )
    }
    const selectedModel = MODELS.find(m => m.id === state.model)
    const selectedTemplate = TEMPLATES.find(t => t.id === state.selectedTemplate)
    return (
      <div className="space-y-5">
        {/* Agent preview card */}
        <div className="bg-gradient-to-br from-violet-600/20 via-violet-500/10 to-transparent border border-violet-500/20 rounded-2xl p-6 text-center">
          <div className="text-5xl mb-3">{state.avatar}</div>
          <h2 className="text-xl font-bold text-white mb-1">{state.name || 'Unnamed Agent'}</h2>
          {state.purpose && <p className="text-slate-400 text-sm">{state.purpose}</p>}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Tone', value: TONES.find(t => t.id === state.tone)?.label || state.tone },
            { label: 'Model', value: selectedModel?.name || state.model },
            { label: 'Template', value: selectedTemplate?.name || (state.startMode === 'scratch' ? 'Custom' : 'None') },
            { label: 'Channels', value: state.enabledChannels.length ? state.enabledChannels.map(c => CHANNELS.find(ch => ch.id === c)?.name || c).join(', ') : 'None' },
            { label: 'Always-on', value: state.alwaysOn ? 'Enabled' : 'Off' },
            { label: 'Memory', value: state.longTermMemory ? 'Enabled' : 'Off' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/5 border border-[#1e1e2e] rounded-xl p-3.5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-sm text-slate-200 font-medium truncate">{value}</p>
            </div>
          ))}
        </div>

        {!state.name && (
          <p className="text-amber-400 text-xs flex items-center gap-1.5">⚠ No name set - go back to Step 2 to name your agent.</p>
        )}

        <button onClick={handleLaunch} disabled={saving}
          className="w-full gradient-btn py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-lg">
          {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Rocket size={22} />}
          {saving ? 'Launching...' : 'Launch Agent 🚀'}
        </button>
      </div>
    )
  }

  const stepContent = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5]
  const stepTitles = [
    'Choose a starting point',
    'Name & identity',
    'Choose your AI model',
    'Knowledge & behavior',
    'Choose channels',
    'Review & launch',
  ]
  const stepDescs = [
    'Build from scratch or jump-start with a template.',
    'Give your agent a name, purpose, and personality.',
    'Pick the AI brain that powers your agent.',
    'Tell your agent what to know and how to behave.',
    'Where should your agent be deployed?',
    'Everything looks good? Launch your agent.',
  ]

  const progressPct = (step / (STEPS.length - 1)) * 100

  return (
    <DashboardLayout title="New Agent">
      <div className="max-w-2xl mx-auto">
        <div className="mb-7">
          <h1 className="text-xl font-bold text-white mb-1">Create New Agent</h1>
          <p className="text-slate-500 text-sm">Follow the steps to build and launch your AI agent.</p>
        </div>

        {/* Step progress */}
        <div className="mb-7">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((s, i) => (
              <button key={s} onClick={() => i <= step && setStep(i)} disabled={i > step}
                className={`flex flex-col items-center gap-1.5 ${i <= step ? 'cursor-pointer' : 'cursor-default'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < step ? 'bg-green-500 text-white' : i === step ? 'gradient-btn' : 'bg-white/10 text-slate-600'
                }`}>
                  {i < step ? <Check size={13} /> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-violet-400' : i < step ? 'text-green-400' : 'text-slate-600'}`}>{s}</span>
              </button>
            ))}
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-violet-500 to-violet-400" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Step card */}
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6 mb-4">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">{stepTitles[step]}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{stepDescs[step]}</p>
          </div>
          {stepContent[step]()}
        </div>

        {/* Navigation */}
        {!launched && (
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#1e1e2e] text-slate-400 font-semibold text-sm hover:bg-white/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft size={16} /> Back
            </button>
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
                className="flex items-center gap-2 gradient-btn px-6 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                Continue <ChevronRight size={16} />
              </button>
            ) : null}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}