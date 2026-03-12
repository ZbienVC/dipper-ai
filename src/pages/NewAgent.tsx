import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { Plus, X, Upload, Check, ChevronRight, ChevronLeft, Rocket } from 'lucide-react'

const STEPS = ['Create', 'Personality', 'Style', 'Knowledge', 'Commands', 'Integrations', 'Launch']

const AVATAR_COLORS = [
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-teal-400 to-emerald-500',
  'from-orange-400 to-red-500',
  'from-pink-400 to-rose-500',
  'from-yellow-400 to-orange-500',
]

const STARTER_TEMPLATES = [
  { icon: '🎧', name: 'Customer Support', desc: 'Handle queries 24/7' },
  { icon: '💼', name: 'Sales Agent', desc: 'Qualify and close leads' },
  { icon: '🌐', name: 'Community Manager', desc: 'Engage your community' },
  { icon: '📅', name: 'Appointment Bot', desc: 'Book appointments' },
  { icon: '🎯', name: 'Lead Capture', desc: 'Capture & qualify leads' },
  { icon: '🤖', name: 'Custom Agent', desc: 'Start from scratch' },
]

const COMM_STYLES = ['Professional', 'Casual & Friendly', 'Formal', 'Witty & Humorous', 'Empathetic', 'Direct & Concise']
const TONES = ['Friendly', 'Professional', 'Assertive', 'Playful', 'Empathetic', 'Witty']
const MODELS = [
  { id: 'gpt4o', name: 'GPT-4o', badge: 'OpenAI', desc: 'Best overall performance', color: 'bg-green-50 border-green-200' },
  { id: 'claude35', name: 'Claude 3.5 Sonnet', badge: 'Anthropic', desc: 'Superior reasoning', color: 'bg-orange-50 border-orange-200' },
  { id: 'gemini15', name: 'Gemini 1.5 Pro', badge: 'Google', desc: 'Multimodal & fast', color: 'bg-blue-50 border-blue-200' },
]

const INTEGRATIONS_LIST = [
  { id: 'sms', icon: '📱', name: 'SMS', desc: 'Send & receive text messages', color: 'bg-green-50' },
  { id: 'telegram', icon: '✈️', name: 'Telegram', desc: 'Connect to Telegram bots & groups', color: 'bg-sky-50' },
  { id: 'x', icon: '𝕏', name: 'X / Twitter', desc: 'Post, reply, and engage on X', color: 'bg-gray-50' },
  { id: 'discord', icon: '🎮', name: 'Discord', desc: 'Manage Discord servers & channels', color: 'bg-indigo-50' },
]

interface WizardState {
  // Step 1
  name: string
  avatarColor: string
  selectedTemplate: string
  // Step 2
  bio: string
  lore: string
  adjectives: string[]
  topics: string[]
  examplePosts: string
  commStyle: string
  forbiddenWords: string
  // Step 3
  tone: string
  toneInspiration: string
  creativity: number
  model: string
  // Step 4
  uploadedFiles: string[]
  knowledgeUrl: string
  // Step 5
  commands: Array<{ name: string; desc: string }>
  // Step 6
  enabledIntegrations: string[]
}

const defaultState: WizardState = {
  name: '',
  avatarColor: AVATAR_COLORS[0],
  selectedTemplate: '',
  bio: '',
  lore: '',
  adjectives: ['Helpful', 'Professional'],
  topics: ['Customer service', 'Product info'],
  examplePosts: '',
  commStyle: 'Professional',
  forbiddenWords: '',
  tone: 'Friendly',
  toneInspiration: '',
  creativity: 65,
  model: 'claude35',
  uploadedFiles: [],
  knowledgeUrl: '',
  commands: [{ name: '/help', desc: 'Show available commands' }],
  enabledIntegrations: [],
}

export default function NewAgent() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(defaultState)
  const [newTag, setNewTag] = useState('')
  const [newTopic, setNewTopic] = useState('')
  const [newCmd, setNewCmd] = useState({ name: '', desc: '' })
  const [launched, setLaunched] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const update = (patch: Partial<WizardState>) => setState(prev => ({ ...prev, ...patch }))

  const addTag = (key: 'adjectives' | 'topics', val: string) => {
    if (!val.trim()) return
    update({ [key]: [...state[key], val.trim()] })
  }
  const removeTag = (key: 'adjectives' | 'topics', i: number) => {
    update({ [key]: state[key].filter((_, idx) => idx !== i) })
  }

  const handleLaunch = () => {
    setLaunched(true)
    setTimeout(() => navigate('/dashboard'), 3000)
  }

  const progressPct = ((step) / (STEPS.length - 1)) * 100

  // ─── Step renderers ───────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-8">
      {/* Name + Avatar */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Agent Name</label>
        <input
          value={state.name}
          onChange={e => update({ name: e.target.value })}
          placeholder="e.g. SupportBot Pro"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 transition-all max-w-md"
        />
      </div>

      {/* Avatar color */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">Avatar Color</label>
        <div className="flex items-center gap-3 flex-wrap">
          {AVATAR_COLORS.map(color => (
            <button
              key={color}
              onClick={() => update({ avatarColor: color })}
              className={`w-10 h-10 rounded-full bg-gradient-to-br ${color} transition-all ${state.avatarColor === color ? 'ring-4 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'}`}
            />
          ))}
          {/* Preview */}
          {state.name && (
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${state.avatarColor} flex items-center justify-center text-white text-2xl font-bold ml-4`}>
              {state.name[0]?.toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Template selection */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">Start with a template (optional)</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STARTER_TEMPLATES.map(t => (
            <button
              key={t.name}
              onClick={() => update({ selectedTemplate: t.name })}
              className={`flex flex-col items-start gap-1 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                state.selectedTemplate === t.name
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <span className="text-2xl">{t.icon}</span>
              <span className="font-semibold text-gray-900 text-sm">{t.name}</span>
              <span className="text-xs text-gray-500">{t.desc}</span>
              {state.selectedTemplate === t.name && (
                <span className="text-xs font-bold text-blue-600">✓ Selected</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Bio</label>
        <textarea
          value={state.bio}
          onChange={e => update({ bio: e.target.value })}
          placeholder="A brief description of your agent's purpose and role..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 resize-none transition-all"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Lore / Background</label>
        <textarea
          value={state.lore}
          onChange={e => update({ lore: e.target.value })}
          placeholder="Background story or deep context for your agent..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 resize-none transition-all"
        />
      </div>

      {/* Adjectives tags */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Personality Adjectives</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {state.adjectives.map((adj, i) => (
            <span key={i} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1 rounded-full">
              {adj}
              <button onClick={() => removeTag('adjectives', i)} className="hover:text-blue-900 ml-1"><X size={12} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { addTag('adjectives', newTag); setNewTag('') } }}
            placeholder="Add adjective + Enter"
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 max-w-xs"
          />
          <button onClick={() => { addTag('adjectives', newTag); setNewTag('') }} className="gradient-btn px-4 py-2 rounded-xl text-sm font-semibold">
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Topics tags */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Topics</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {state.topics.map((topic, i) => (
            <span key={i} className="flex items-center gap-1 bg-violet-50 text-violet-700 text-sm font-medium px-3 py-1 rounded-full">
              {topic}
              <button onClick={() => removeTag('topics', i)} className="hover:text-violet-900 ml-1"><X size={12} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newTopic}
            onChange={e => setNewTopic(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { addTag('topics', newTopic); setNewTopic('') } }}
            placeholder="Add topic + Enter"
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 max-w-xs"
          />
          <button onClick={() => { addTag('topics', newTopic); setNewTopic('') }} className="gradient-btn px-4 py-2 rounded-xl text-sm font-semibold">
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Example Posts / Messages</label>
        <textarea
          value={state.examplePosts}
          onChange={e => update({ examplePosts: e.target.value })}
          placeholder="Paste example messages that match your desired tone..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 resize-none transition-all"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Communication Style</label>
          <select
            value={state.commStyle}
            onChange={e => update({ commStyle: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white transition-all"
          >
            {COMM_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Forbidden Words / Topics</label>
          <input
            value={state.forbiddenWords}
            onChange={e => update({ forbiddenWords: e.target.value })}
            placeholder="e.g. competitor, refund, lawsuit"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 transition-all"
          />
        </div>
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-8">
      {/* Tone */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">Response Tone</label>
        <div className="flex flex-wrap gap-2">
          {TONES.map(t => (
            <button
              key={t}
              onClick={() => update({ tone: t })}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                state.tone === t
                  ? 'text-white border-transparent'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
              style={state.tone === t ? { background: 'linear-gradient(90deg, #2563EB, #7C3AED)', borderColor: 'transparent' } : {}}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Inspiration */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Tone Inspiration</label>
        <input
          value={state.toneInspiration}
          onChange={e => update({ toneInspiration: e.target.value })}
          placeholder="e.g. 'Think of a friendly Zappos support rep...'"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 transition-all max-w-lg"
        />
      </div>

      {/* Creativity slider */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-semibold text-gray-700">Creativity / Temperature</label>
          <span className="text-lg font-bold" style={{ background: 'linear-gradient(90deg, #2563EB, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {state.creativity}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Precise</span>
          <input
            type="range"
            min={0}
            max={100}
            value={state.creativity}
            onChange={e => update({ creativity: Number(e.target.value) })}
            className="flex-1 accent-blue-600"
          />
          <span className="text-xs text-gray-400">Creative</span>
        </div>
      </div>

      {/* Model selection */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">AI Model</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {MODELS.map(m => (
            <button
              key={m.id}
              onClick={() => update({ model: m.id })}
              className={`p-5 rounded-2xl border-2 text-left transition-all hover:shadow-md ${
                state.model === m.id
                  ? 'border-blue-500 bg-blue-50'
                  : `border-gray-100 ${m.color}`
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="font-bold text-gray-900 text-sm">{m.name}</span>
                {state.model === m.id && <Check size={16} className="text-blue-600 flex-shrink-0" />}
              </div>
              <span className="text-xs font-semibold text-gray-500 block mb-1">{m.badge}</span>
              <span className="text-xs text-gray-500">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6">
      {/* Drag drop */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">Upload Knowledge Files</label>
        <div
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
          }`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => {
            e.preventDefault()
            setIsDragging(false)
            const files = Array.from(e.dataTransfer.files).map(f => f.name)
            update({ uploadedFiles: [...state.uploadedFiles, ...files] })
          }}
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.multiple = true
            input.onchange = (e: Event) => {
              const target = e.target as HTMLInputElement
              if (target.files) {
                const files = Array.from(target.files).map(f => f.name)
                update({ uploadedFiles: [...state.uploadedFiles, ...files] })
              }
            }
            input.click()
          }}
        >
          <Upload size={32} className={`mx-auto mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-300'}`} />
          <p className="font-semibold text-gray-600 mb-1">Drop files here or click to browse</p>
          <p className="text-sm text-gray-400">PDF, TXT, DOCX, CSV — max 50MB each</p>
        </div>

        {state.uploadedFiles.length > 0 && (
          <div className="mt-3 space-y-2">
            {state.uploadedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
                <Check size={14} className="text-green-600 flex-shrink-0" />
                <span className="text-sm text-gray-700 flex-1">{f}</span>
                <button onClick={() => update({ uploadedFiles: state.uploadedFiles.filter((_, idx) => idx !== i) })} className="text-gray-400 hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* URL input */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Or add a URL to scrape</label>
        <div className="flex gap-3 max-w-lg">
          <input
            value={state.knowledgeUrl}
            onChange={e => update({ knowledgeUrl: e.target.value })}
            placeholder="https://yoursite.com/docs"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 transition-all"
          />
          <button
            onClick={() => {
              if (state.knowledgeUrl) {
                update({ uploadedFiles: [...state.uploadedFiles, state.knowledgeUrl], knowledgeUrl: '' })
              }
            }}
            className="gradient-btn px-5 py-3 rounded-xl font-semibold text-sm"
          >
            Add
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        💡 <strong>Tip:</strong> Upload your FAQ, product docs, pricing page, or any text your agent should know about.
      </div>
    </div>
  )

  const renderStep5 = () => (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">Commands let users trigger specific behaviors from your agent.</p>

      <div className="space-y-3">
        {state.commands.map((cmd, i) => (
          <div key={i} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="flex-1">
              <span className="font-mono font-bold text-blue-600 text-sm">{cmd.name}</span>
              <span className="text-gray-500 text-sm ml-3">{cmd.desc}</span>
            </div>
            <button onClick={() => update({ commands: state.commands.filter((_, idx) => idx !== i) })} className="text-gray-300 hover:text-red-400 transition-colors">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Add command */}
      <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New Command</h3>
        <div className="flex gap-3 flex-wrap">
          <input
            value={newCmd.name}
            onChange={e => setNewCmd(p => ({ ...p, name: e.target.value }))}
            placeholder="/command"
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono w-36"
          />
          <input
            value={newCmd.desc}
            onChange={e => setNewCmd(p => ({ ...p, desc: e.target.value }))}
            placeholder="What this command does"
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48"
          />
          <button
            onClick={() => {
              if (newCmd.name && newCmd.desc) {
                update({ commands: [...state.commands, { ...newCmd }] })
                setNewCmd({ name: '', desc: '' })
              }
            }}
            className="gradient-btn px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5"
          >
            <Plus size={15} /> Add Command
          </button>
        </div>
      </div>
    </div>
  )

  const renderStep6 = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 mb-2">Toggle the channels where your agent should be active.</p>
      {INTEGRATIONS_LIST.map(int => {
        const enabled = state.enabledIntegrations.includes(int.id)
        return (
          <div
            key={int.id}
            onClick={() => update({
              enabledIntegrations: enabled
                ? state.enabledIntegrations.filter(i => i !== int.id)
                : [...state.enabledIntegrations, int.id]
            })}
            className={`flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all hover:shadow-md ${
              enabled ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-200'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl ${int.color} flex items-center justify-center text-2xl flex-shrink-0`}>
              {int.icon}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900">{int.name}</h3>
              <p className="text-sm text-gray-500">{int.desc}</p>
            </div>
            <div className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${enabled ? '' : 'bg-gray-200'}`}
              style={enabled ? { background: 'linear-gradient(90deg, #2563EB, #7C3AED)' } : {}}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
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
          <div className="text-8xl mb-6 animate-bounce">🚀</div>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Agent Launched!</h2>
          <p className="text-gray-500 text-lg mb-4">
            <strong className="gradient-text">{state.name || 'Your agent'}</strong> is now live and ready to work.
          </p>
          <p className="text-gray-400 text-sm">Redirecting to dashboard...</p>
          <div className="mt-6 flex justify-center gap-3">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )
    }

    const selectedModel = MODELS.find(m => m.id === state.model)
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${state.avatarColor} flex items-center justify-center text-white text-4xl font-extrabold mx-auto mb-4 shadow-xl`}>
            {(state.name || 'A')[0].toUpperCase()}
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900">{state.name || 'Unnamed Agent'}</h2>
          {state.selectedTemplate && (
            <p className="text-gray-500 text-sm mt-1">Template: {state.selectedTemplate}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Personality</h3>
            <div className="space-y-1 text-sm text-gray-700">
              <p><span className="font-medium">Style:</span> {state.commStyle}</p>
              <p><span className="font-medium">Tone:</span> {state.tone}</p>
              <p><span className="font-medium">Creativity:</span> {state.creativity}/100</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Model</h3>
            <p className="text-sm font-semibold text-gray-900">{selectedModel?.name}</p>
            <p className="text-xs text-gray-500">{selectedModel?.badge}</p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Knowledge</h3>
            <p className="text-sm text-gray-700">{state.uploadedFiles.length} file(s) uploaded</p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Integrations</h3>
            <p className="text-sm text-gray-700">
              {state.enabledIntegrations.length
                ? state.enabledIntegrations.map(i => INTEGRATIONS_LIST.find(x => x.id === i)?.name).join(', ')
                : 'None selected'}
            </p>
          </div>
        </div>

        <button
          onClick={handleLaunch}
          className="w-full gradient-btn py-5 rounded-2xl font-extrabold text-xl flex items-center justify-center gap-3 shadow-xl shadow-blue-200 hover:shadow-2xl transition-all hover:scale-[1.01]"
        >
          <Rocket size={24} /> Launch Agent 🚀
        </button>
      </div>
    )
  }

  const stepContent = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7]

  return (
    <DashboardLayout title="New Agent">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create New Agent</h1>
          <p className="text-gray-500">Follow the steps below to build and launch your AI agent.</p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((s, i) => (
              <button
                key={s}
                onClick={() => i <= step && setStep(i)}
                className={`flex flex-col items-center gap-1 transition-all ${i <= step ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < step ? 'bg-green-500 text-white' :
                  i === step ? 'text-white shadow-lg' :
                  'bg-gray-200 text-gray-500'
                }`}
                  style={i === step ? { background: 'linear-gradient(135deg, #2563EB, #7C3AED)' } : {}}>
                  {i < step ? <Check size={14} /> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-blue-600' : i < step ? 'text-green-600' : 'text-gray-400'}`}>
                  {s}
                </span>
              </button>
            ))}
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #2563EB, #7C3AED)' }}
            />
          </div>
        </div>

        {/* Step card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{STEPS[step]}</h2>
          {stepContent[step]()}
        </div>

        {/* Navigation */}
        {!launched && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} /> Back
            </button>
            {step < STEPS.length - 1 && (
              <button
                onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
                className="flex items-center gap-2 gradient-btn px-6 py-2.5 rounded-xl font-semibold"
              >
                Next <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
