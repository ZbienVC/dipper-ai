import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { Plus, X, Upload, Check, ChevronRight, ChevronLeft, Rocket, Bot } from 'lucide-react'

const STEPS = ['Create', 'Personality', 'Style', 'Knowledge', 'Commands', 'Integrations', 'Launch']

const STARTER_TEMPLATES = [
  { name: 'Customer Support', desc: 'Handle queries 24/7', systemPrompt: 'You are a professional customer support agent. You are patient, empathetic, and genuinely want to solve problems.' },
  { name: 'Sales Agent', desc: 'Qualify and close leads', systemPrompt: 'You are a world-class sales agent. You understand value, ask great questions, and guide conversations toward decisions.' },
  { name: 'Community Manager', desc: 'Engage your community', systemPrompt: 'You are an engaging community manager. You welcome new members, answer questions, and keep conversations lively.' },
  { name: 'Appointment Bot', desc: 'Book appointments', systemPrompt: 'You are an appointment booking assistant. You help schedule, reschedule, and confirm appointments efficiently.' },
  { name: 'Lead Capture', desc: 'Capture & qualify leads', systemPrompt: 'You are a lead qualification specialist. You engage visitors, understand their needs, and capture contact info for follow-up.' },
  { name: 'Custom Agent', desc: 'Start from scratch', systemPrompt: '' },
]

const COMM_STYLES = ['Professional', 'Casual & Friendly', 'Formal', 'Witty & Humorous', 'Empathetic', 'Direct & Concise']
const TONES = ['Friendly', 'Professional', 'Assertive', 'Playful', 'Empathetic', 'Witty']
const MODELS = [
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', badge: 'Anthropic', desc: 'Fast & cheap', speed: '⚡ Fast', cost: '$' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', badge: 'Anthropic', desc: 'Superior reasoning', speed: '🧠 Smart', cost: '$$' },
  { id: 'gpt-4o', name: 'GPT-4o', badge: 'OpenAI', desc: 'Multimodal powerhouse', speed: '🚀 Powerful', cost: '$$$' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', badge: 'Google', desc: 'Long context, fast', speed: '⚡ Fast', cost: '$' },
]

const INTEGRATIONS_LIST = [
  { id: 'sms', name: 'SMS', desc: 'Send & receive text messages' },
  { id: 'telegram', name: 'Telegram', desc: 'Connect to Telegram bots & groups' },
  { id: 'x', name: 'X / Twitter', desc: 'Post, reply, and engage on X' },
  { id: 'discord', name: 'Discord', desc: 'Manage Discord servers & channels' },
]

interface WizardState {
  name: string
  selectedTemplate: string
  systemPrompt: string
  bio: string
  adjectives: string[]
  topics: string[]
  commStyle: string
  forbiddenWords: string
  tone: string
  creativity: number
  maxResponseLength: number
  responseFormat: string
  model: string
  provider: string
  uploadedFiles: string[]
  knowledgeText: string
  knowledgeUrl: string
  commands: Array<{ name: string; desc: string }>
  enabledIntegrations: string[]
}

const defaultState: WizardState = {
  name: '',
  selectedTemplate: '',
  systemPrompt: '',
  bio: '',
  adjectives: ['Helpful', 'Professional'],
  topics: ['Customer service', 'Product info'],
  commStyle: 'Professional',
  forbiddenWords: '',
  tone: 'Friendly',
  creativity: 65,
  maxResponseLength: 300,
  responseFormat: 'conversational',
  model: 'claude-3-5-haiku-20241022',
  provider: 'anthropic',
  uploadedFiles: [],
  knowledgeText: '',
  knowledgeUrl: '',
  commands: [{ name: '/help', desc: 'Show available commands' }],
  enabledIntegrations: [],
}

export default function NewAgent() {
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(() => {
    // Pre-fill from template passed via router state (from Agents onboarding)
    const tpl = (location.state as any)?.template
    if (tpl) {
      return {
        ...defaultState,
        selectedTemplate: tpl.id,
        name: tpl.name,
        systemPrompt: tpl.systemPrompt,
        adjectives: tpl.adjectives || defaultState.adjectives,
        tone: tpl.tone || defaultState.tone,
        commStyle: tpl.commStyle || defaultState.commStyle,
      }
    }
    return defaultState
  })
  const [newTag, setNewTag] = useState('')
  const [newTopic, setNewTopic] = useState('')
  const [newCmd, setNewCmd] = useState({ name: '', desc: '' })
  const [launched, setLaunched] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [saving, setSaving] = useState(false)

  const update = (patch: Partial<WizardState>) => setState(prev => ({ ...prev, ...patch }))

  const addTag = (key: 'adjectives' | 'topics', val: string) => {
    if (!val.trim()) return
    update({ [key]: [...state[key], val.trim()] })
  }
  const removeTag = (key: 'adjectives' | 'topics', i: number) => {
    update({ [key]: state[key].filter((_, idx) => idx !== i) })
  }

  const handleLaunch = async () => {
    setSaving(true)
    try {
      const userRaw = localStorage.getItem('dipperai_user')
      const user = userRaw ? JSON.parse(userRaw) : null
      const token = user?.token

      const systemPrompt = state.systemPrompt || state.bio
        ? `${state.systemPrompt || ''}\n\nYou are ${state.name}. ${state.bio}\n\nPersonality: ${state.adjectives.join(', ')}\nTopics: ${state.topics.join(', ')}\nTone: ${state.tone}\nCommunication style: ${state.commStyle}${state.forbiddenWords ? `\nNever use: ${state.forbiddenWords}` : ''}`
        : `You are \, an AI assistant. Be ${state.tone.toLowerCase()} and ${state.commStyle.toLowerCase()}.`

      if (!token) {
        // not logged in — still show launched screen, just no agent saved
        setSaving(false)
        setLaunched(true)
        setTimeout(() => navigate('/dashboard/agents'), 1500)
        return
      }
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: state.name || 'My Agent', description: state.bio, systemPrompt, model: state.model, provider: state.provider }),
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

  const progressPct = ((step) / (STEPS.length - 1)) * 100

  const inputClass = "w-full px-4 py-2.5 rounded-xl bg-white/5 border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600 text-sm transition-all"
  const textareaClass = `${inputClass} resize-none`

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Agent Name</label>
        <input value={state.name} onChange={e => update({ name: e.target.value })} placeholder="e.g. SupportBot Pro" className={`${inputClass} max-w-md`} />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-3">Start with a template <span className="text-slate-600 font-normal">(optional)</span></label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STARTER_TEMPLATES.map(t => (
            <button key={t.name} onClick={() => update({ selectedTemplate: t.name, systemPrompt: t.systemPrompt })}
              className={`flex flex-col items-start gap-1 p-4 rounded-xl border-2 text-left transition-all ${
                state.selectedTemplate === t.name ? 'border-violet-500 bg-violet-500/10' : 'border-[#1e1e2e] bg-white/5 hover:border-violet-500/30'
              }`}>
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-1">
                <Bot size={14} className="text-violet-400" />
              </div>
              <span className="font-semibold text-white text-sm">{t.name}</span>
              <span className="text-xs text-slate-500">{t.desc}</span>
              {state.selectedTemplate === t.name && <span className="text-xs font-bold text-violet-400 flex items-center gap-1"><Check size={10} /> Selected</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Bio</label>
        <textarea value={state.bio} onChange={e => update({ bio: e.target.value })} placeholder="A brief description of your agent's purpose..." rows={3} className={textareaClass} />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Personality Traits</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {state.adjectives.map((adj, i) => (
            <span key={i} className="flex items-center gap-1 bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium px-3 py-1 rounded-full">
              {adj}
              <button onClick={() => removeTag('adjectives', i)} className="hover:text-white ml-0.5"><X size={10} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { addTag('adjectives', newTag); setNewTag('') } }}
            placeholder="Add trait + Enter" className={`${inputClass} max-w-xs`} />
          <button onClick={() => { addTag('adjectives', newTag); setNewTag('') }} className="gradient-btn px-3 py-2 rounded-xl text-sm font-semibold"><Plus size={14} /></button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Topics / Specializations</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {state.topics.map((topic, i) => (
            <span key={i} className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium px-3 py-1 rounded-full">
              {topic}
              <button onClick={() => removeTag('topics', i)} className="hover:text-white ml-0.5"><X size={10} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newTopic} onChange={e => setNewTopic(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { addTag('topics', newTopic); setNewTopic('') } }}
            placeholder="Add topic + Enter" className={`${inputClass} max-w-xs`} />
          <button onClick={() => { addTag('topics', newTopic); setNewTopic('') }} className="gradient-btn px-3 py-2 rounded-xl text-sm font-semibold"><Plus size={14} /></button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Communication Style</label>
          <select value={state.commStyle} onChange={e => update({ commStyle: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-[#0d0d15] border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white text-sm">
            {COMM_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Forbidden Words</label>
          <input value={state.forbiddenWords} onChange={e => update({ forbiddenWords: e.target.value })} placeholder="e.g. competitor, refund" className={inputClass} />
        </div>
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-3">Response Tone</label>
        <div className="flex flex-wrap gap-2">
          {TONES.map(t => (
            <button key={t} onClick={() => update({ tone: t })}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                state.tone === t ? 'gradient-btn border-transparent' : 'bg-white/5 text-slate-400 border-[#1e1e2e] hover:border-violet-500/30 hover:text-slate-200'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-semibold text-slate-300">Creativity / Temperature</label>
          <span className="text-sm font-bold text-violet-400">{state.creativity}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600">Precise</span>
          <input type="range" min={0} max={100} value={state.creativity} onChange={e => update({ creativity: Number(e.target.value) })} className="flex-1 accent-violet-500" />
          <span className="text-xs text-slate-600">Creative</span>
        </div>
      </div>
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-semibold text-slate-300">Max Response Length</label>
          <span className="text-sm font-bold text-violet-400">{state.maxResponseLength} chars</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600">Short</span>
          <input type="range" min={50} max={2000} step={50} value={state.maxResponseLength} onChange={e => update({ maxResponseLength: Number(e.target.value) })} className="flex-1 accent-violet-500" />
          <span className="text-xs text-slate-600">Long</span>
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Response Format</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'conversational', label: 'Conversational', desc: 'Natural chat style' },
            { id: 'bullet_points', label: 'Bullet Points', desc: 'Lists and structure' },
            { id: 'structured', label: 'Structured', desc: 'Formal with sections' },
          ].map(f => (
            <button key={f.id} onClick={() => update({ responseFormat: f.id })}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                state.responseFormat === f.id ? 'border-violet-500 bg-violet-500/10' : 'border-[#1e1e2e] bg-white/5 hover:border-violet-500/30'
              }`}>
              <p className="font-semibold text-white text-xs mb-0.5">{f.label}</p>
              <p className="text-xs text-slate-500">{f.desc}</p>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-3">AI Model</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODELS.map(m => (
            <button key={m.id} onClick={() => update({ model: m.id, provider: m.badge.toLowerCase() })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                state.model === m.id ? 'border-violet-500 bg-violet-500/10' : 'border-[#1e1e2e] bg-white/5 hover:border-violet-500/30'
              }`}>
              <div className="flex items-start justify-between mb-1">
                <span className="font-bold text-white text-sm">{m.name}</span>
                {state.model === m.id && <Check size={14} className="text-violet-400 flex-shrink-0" />}
              </div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">{m.badge}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{m.speed}</span>
                <span className="text-xs text-violet-400 font-bold">{m.cost}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-5">
      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
          isDragging ? 'border-violet-500 bg-violet-500/10' : 'border-[#1e1e2e] hover:border-violet-500/30'
        }`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault(); setIsDragging(false)
          const files = Array.from(e.dataTransfer.files).map(f => f.name)
          update({ uploadedFiles: [...state.uploadedFiles, ...files] })
        }}
        onClick={() => {
          const input = document.createElement('input'); input.type = 'file'; input.multiple = true
          input.onchange = (e: Event) => {
            const target = e.target as HTMLInputElement
            if (target.files) update({ uploadedFiles: [...state.uploadedFiles, ...Array.from(target.files).map(f => f.name)] })
          }
          input.click()
        }}
      >
        <Upload size={28} className={`mx-auto mb-2 ${isDragging ? 'text-violet-400' : 'text-slate-600'}`} />
        <p className="font-semibold text-slate-300 mb-1 text-sm">Drop files here or click to browse</p>
        <p className="text-xs text-slate-600">PDF, TXT, DOCX, CSV</p>
      </div>
      {state.uploadedFiles.length > 0 && (
        <div className="space-y-2">
          {state.uploadedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2">
              <Check size={13} className="text-green-400 flex-shrink-0" />
              <span className="text-sm text-slate-300 flex-1">{f}</span>
              <button onClick={() => update({ uploadedFiles: state.uploadedFiles.filter((_, idx) => idx !== i) })} className="text-slate-600 hover:text-red-400">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Or add a URL to scrape</label>
        <div className="flex gap-3 max-w-lg">
          <input value={state.knowledgeUrl} onChange={e => update({ knowledgeUrl: e.target.value })} placeholder="https://yoursite.com/docs" className={inputClass} />
          <button onClick={() => { if (state.knowledgeUrl) { update({ uploadedFiles: [...state.uploadedFiles, state.knowledgeUrl], knowledgeUrl: '' }) } }}
            className="gradient-btn px-4 py-2 rounded-xl font-semibold text-sm flex-shrink-0">Add</button>
        </div>
      </div>
      <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 text-sm text-violet-300">
        Upload your FAQ, product docs, or any text your agent should know about.
      </div>
    </div>
  )

  const renderStep5 = () => (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">Commands let users trigger specific behaviors from your agent.</p>
      <div className="space-y-2">
        {state.commands.map((cmd, i) => (
          <div key={i} className="flex items-center gap-3 bg-white/5 border border-[#1e1e2e] rounded-xl p-3.5">
            <span className="font-mono font-bold text-violet-400 text-sm">{cmd.name}</span>
            <span className="text-slate-500 text-sm flex-1">{cmd.desc}</span>
            <button onClick={() => update({ commands: state.commands.filter((_, idx) => idx !== i) })} className="text-slate-600 hover:text-red-400">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="bg-[#0d0d15] border border-[#1e1e2e] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Add New Command</h3>
        <div className="flex gap-3 flex-wrap">
          <input value={newCmd.name} onChange={e => setNewCmd(p => ({ ...p, name: e.target.value }))} placeholder="/command"
            className={`${inputClass} font-mono w-36`} />
          <input value={newCmd.desc} onChange={e => setNewCmd(p => ({ ...p, desc: e.target.value }))} placeholder="What this command does"
            className={`${inputClass} flex-1 min-w-40`} />
          <button onClick={() => {
            if (newCmd.name && newCmd.desc) { update({ commands: [...state.commands, { ...newCmd }] }); setNewCmd({ name: '', desc: '' }) }
          }} className="gradient-btn px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0 flex items-center gap-1.5">
            <Plus size={13} /> Add
          </button>
        </div>
      </div>
    </div>
  )

  const renderStep6 = () => (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 mb-2">Toggle the channels where your agent should be active.</p>
      {INTEGRATIONS_LIST.map(int => {
        const enabled = state.enabledIntegrations.includes(int.id)
        return (
          <div key={int.id} onClick={() => update({ enabledIntegrations: enabled ? state.enabledIntegrations.filter(i => i !== int.id) : [...state.enabledIntegrations, int.id] })}
            className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              enabled ? 'border-violet-500 bg-violet-500/10' : 'border-[#1e1e2e] bg-white/5 hover:border-violet-500/30'
            }`}>
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-[#1e1e2e] flex items-center justify-center flex-shrink-0">
              <Plug size={16} className={enabled ? 'text-violet-400' : 'text-slate-500'} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white text-sm">{int.name}</h3>
              <p className="text-xs text-slate-500">{int.desc}</p>
            </div>
            <div className={`w-10 h-5 rounded-full transition-all flex items-center px-0.5 ${enabled ? 'bg-violet-600' : 'bg-white/10'}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderStep7 = () => {
    if (launched) {
      return (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-5">
            <Rocket size={36} className="text-violet-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Agent Launched!</h2>
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
    return (
      <div className="space-y-5">
        <div className="text-center mb-4">
          <div className="w-20 h-20 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-3">
            <Bot size={32} className="text-violet-400" />
          </div>
          <h2 className="text-xl font-bold text-white">{state.name || 'Unnamed Agent'}</h2>
          {state.selectedTemplate && <p className="text-slate-500 text-sm mt-1">{state.selectedTemplate}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Tone', value: state.tone },
            { label: 'Style', value: state.commStyle },
            { label: 'Model', value: MODELS.find(m => m.id === state.model)?.name || state.model },
            { label: 'Channels', value: state.enabledIntegrations.length ? state.enabledIntegrations.join(', ') : 'None' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/5 border border-[#1e1e2e] rounded-xl p-3.5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-sm text-slate-200 font-medium">{value}</p>
            </div>
          ))}
        </div>
        <button onClick={handleLaunch} disabled={saving}
          className="w-full gradient-btn py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Rocket size={20} />}
          {saving ? 'Launching...' : 'Launch Agent'}
        </button>
        {!state.name && (
          <p className="text-amber-400 text-xs text-center mt-2">⚠ No name set — go back to Step 1 to name your agent, or it will launch as "My Agent"</p>
        )}
      </div>
    )
  }

  // Need Plug import
  const Plug = ({ size, className }: { size: number; className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8H6a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2z"/>
    </svg>
  )

  const stepContent = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7]

  return (
    <DashboardLayout title="New Agent">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white mb-1">Create New Agent</h1>
          <p className="text-slate-500 text-sm">Follow the steps to build and launch your AI agent.</p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((s, i) => (
              <button key={s} onClick={() => i <= step && setStep(i)} className={`flex flex-col items-center gap-1 ${i <= step ? 'cursor-pointer' : 'cursor-default'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < step ? 'bg-green-500 text-white' :
                  i === step ? 'gradient-btn' :
                  'bg-white/10 text-slate-600'
                }`}>
                  {i < step ? <Check size={12} /> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-violet-400' : i < step ? 'text-green-400' : 'text-slate-600'}`}>{s}</span>
              </button>
            ))}
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500 bg-violet-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Step card */}
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-6 mb-4">
          <h2 className="text-base font-bold text-white mb-5">{STEPS[step]}</h2>
          {stepContent[step]()}
        </div>

        {/* Navigation */}
        {!launched && (
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#1e1e2e] text-slate-400 font-semibold text-sm hover:bg-white/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft size={16} /> Back
            </button>
            {step < STEPS.length - 1 && (
              <button onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
                className="flex items-center gap-2 gradient-btn px-5 py-2 rounded-xl font-semibold text-sm">
                Next <ChevronRight size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}



