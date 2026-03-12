import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import {
  MessageSquare, BarChart2, Settings, BookOpen, Terminal,
  Plug, User, Activity, Edit3, Save, Circle, Send, Bot,
  Upload, Link2, FileText, Plus, X, Check, ToggleLeft, ToggleRight
} from 'lucide-react'

const MOCK_AGENTS: Record<string, {
  id: string, name: string, emoji: string, avatarColor: string,
  status: string, template: string, model: string,
  messages: number, uptime: string, accuracy: string,
  channels: string[], bio: string, tone: string, commStyle: string,
}> = {
  '1': {
    id: '1', name: 'SupportBot Pro', emoji: '🎧',
    avatarColor: 'from-blue-500 to-indigo-600',
    status: 'active', template: 'Customer Support Bot',
    model: 'Claude 3.5 Sonnet', messages: 412,
    uptime: '99.8%', accuracy: '94%',
    channels: ['SMS', 'Telegram'],
    bio: 'I handle customer support inquiries with speed and precision. I know our product inside-out and always escalate when needed.',
    tone: 'Friendly', commStyle: 'Professional',
  },
  '2': {
    id: '2', name: 'Sales Ninja', emoji: '💼',
    avatarColor: 'from-violet-500 to-purple-600',
    status: 'active', template: 'Sales Follow-up Agent',
    model: 'GPT-4o', messages: 289,
    uptime: '99.5%', accuracy: '91%',
    channels: ['SMS', 'X'],
    bio: 'I turn cold leads warm and warm leads hot. My goal is to move every prospect forward in the pipeline.',
    tone: 'Assertive', commStyle: 'Casual & Friendly',
  },
  '3': {
    id: '3', name: 'Community Max', emoji: '🌐',
    avatarColor: 'from-teal-400 to-emerald-500',
    status: 'paused', template: 'Telegram Community Manager',
    model: 'Gemini 1.5 Pro', messages: 146,
    uptime: '97.2%', accuracy: '89%',
    channels: ['Telegram', 'Discord'],
    bio: 'I keep communities engaged, moderated, and growing. I post updates, answer questions, and welcome new members.',
    tone: 'Playful', commStyle: 'Casual & Friendly',
  },
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'personality', label: 'Personality', icon: User },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { id: 'commands', label: 'Commands', icon: Terminal },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'settings', label: 'Settings', icon: Settings },
]

interface ChatMsg { role: 'user' | 'agent'; text: string; ts: string }
interface Command { trigger: string; response: string }

const MOCK_RESPONSES = [
  "I understand your concern! Let me look into that for you right away. 🔍",
  "Great question! Based on what I know, here's the best answer I can give you...",
  "I've got you covered! Our team usually handles this within 24 hours.",
  "That's something I can help with! Could you give me a bit more context?",
  "Absolutely! Here's what I recommend based on your situation...",
  "Thanks for reaching out! I'll make sure to get you the right information.",
  "I see what you're asking — let me pull up the relevant details for you.",
]

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function AgentDetail() {
  const { id = '1' } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const agent = MOCK_AGENTS[id] || MOCK_AGENTS['1']

  const initialTab = searchParams.get('tab') || 'overview'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [editBio, setEditBio] = useState(agent.bio)
  const [editTone, setEditTone] = useState(agent.tone)
  const [editCommStyle, setEditCommStyle] = useState(agent.commStyle)
  const [saved, setSaved] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'agent', text: `Hey! I'm ${agent.name}. How can I help you today? 👋`, ts: '10:30 AM' },
    { role: 'user', text: 'Can you tell me about your capabilities?', ts: '10:31 AM' },
    { role: 'agent', text: `Great question! I'm specialized in ${agent.template}. I can handle inquiries, provide information, and escalate complex issues to the right team. What would you like help with?`, ts: '10:31 AM' },
  ])
  const [inputText, setInputText] = useState('')
  const [thinking, setThinking] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Knowledge state
  const [urlInput, setUrlInput] = useState('')
  const [knowledgeDragOver, setKnowledgeDragOver] = useState(false)

  // Commands state
  const [commands, setCommands] = useState<Command[]>([
    { trigger: '/help', response: 'Lists all available features and commands for this agent.' },
    { trigger: '/pricing', response: 'Shows current pricing plans and feature comparisons.' },
  ])
  const [showAddCommand, setShowAddCommand] = useState(false)
  const [newTrigger, setNewTrigger] = useState('')
  const [newResponse, setNewResponse] = useState('')

  // Integrations state
  const [integrationToggles, setIntegrationToggles] = useState<Record<string, boolean>>({
    sms: agent.channels.includes('SMS'),
    telegram: agent.channels.includes('Telegram'),
    twitter: agent.channels.includes('X'),
    discord: agent.channels.includes('Discord'),
  })

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  // Sync tab from searchParams
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) setActiveTab(tab)
  }, [searchParams])

  const sendMessage = () => {
    if (!inputText.trim() || thinking) return
    const userMsg: ChatMsg = { role: 'user', text: inputText.trim(), ts: getTime() }
    setMessages(prev => [...prev, userMsg])
    setInputText('')
    setThinking(true)
    setTimeout(() => {
      const resp = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]
      setMessages(prev => [...prev, { role: 'agent', text: resp, ts: getTime() }])
      setThinking(false)
    }, 1500)
  }

  const handleSavePersonality = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleAddCommand = () => {
    if (!newTrigger || !newResponse) return
    setCommands(prev => [...prev, { trigger: newTrigger, response: newResponse }])
    setNewTrigger('')
    setNewResponse('')
    setShowAddCommand(false)
  }

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Messages', value: agent.messages.toLocaleString(), color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Uptime', value: agent.uptime, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Accuracy', value: agent.accuracy, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Channels', value: String(agent.channels.length), color: 'text-teal-600', bg: 'bg-teal-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
              <Activity size={18} className={s.color} />
            </div>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {[
            { text: 'Handled 12 customer inquiries', time: '2 min ago', dot: 'bg-blue-500' },
            { text: 'Auto-escalated 1 ticket to human support', time: '18 min ago', dot: 'bg-orange-400' },
            { text: 'Sent daily summary report', time: '1 hr ago', dot: 'bg-violet-500' },
            { text: 'Processed 47 messages via Telegram', time: '2 hrs ago', dot: 'bg-teal-500' },
            { text: 'Updated knowledge base', time: '5 hrs ago', dot: 'bg-green-500' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${item.dot}`} />
              <div>
                <p className="text-sm text-gray-700">{item.text}</p>
                <p className="text-xs text-gray-400">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderChat = () => (
    <div className="flex flex-col h-[600px] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${agent.avatarColor} flex items-center justify-center text-white font-bold text-sm`}>
          {agent.emoji}
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm">{agent.name}</p>
          <p className="text-xs text-green-500 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Online
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'agent' && (
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${agent.avatarColor} flex items-center justify-center flex-shrink-0 mb-1`}>
                <Bot size={14} className="text-white" />
              </div>
            )}
            <div className={`max-w-sm ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user' ? 'text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm shadow-sm'
              }`} style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #2563EB, #7C3AED)' } : {}}>
                {msg.text}
              </div>
              <span className="text-xs text-gray-400 px-1">{msg.ts}</span>
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0 mb-1">
                <User size={14} className="text-gray-500" />
              </div>
            )}
          </div>
        ))}
        {thinking && (
          <div className="flex items-end gap-2 justify-start">
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${agent.avatarColor} flex items-center justify-center flex-shrink-0`}>
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-5 py-3 shadow-sm">
              <div className="flex gap-1.5 items-center">
                <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="px-4 py-4 border-t border-gray-100 bg-white">
        <div className="flex gap-3 items-center">
          <input
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder={`Message ${agent.name}...`}
            disabled={thinking}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:bg-gray-50"
          />
          <button
            onClick={sendMessage}
            disabled={!inputText.trim() || thinking}
            className="gradient-btn w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )

  const renderPersonality = () => (
    <div className="space-y-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Bio</label>
        <textarea
          value={editBio}
          onChange={e => setEditBio(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 resize-none transition-all"
        />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Tone</label>
          <select value={editTone} onChange={e => setEditTone(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900">
            {['Friendly', 'Professional', 'Assertive', 'Playful', 'Empathetic', 'Witty'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Communication Style</label>
          <select value={editCommStyle} onChange={e => setEditCommStyle(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900">
            {['Professional', 'Casual & Friendly', 'Formal', 'Witty & Humorous', 'Empathetic', 'Direct & Concise'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <button onClick={handleSavePersonality}
        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${saved ? 'bg-green-500 text-white' : 'gradient-btn'}`}>
        {saved ? <><Check size={16} /> Saved!</> : <><Save size={16} /> Save Changes</>}
      </button>
    </div>
  )

  const renderKnowledge = () => (
    <div className="space-y-5">
      {/* Upload Area */}
      <div
        onDragOver={e => { e.preventDefault(); setKnowledgeDragOver(true) }}
        onDragLeave={() => setKnowledgeDragOver(false)}
        onDrop={e => { e.preventDefault(); setKnowledgeDragOver(false) }}
        className={`bg-white rounded-2xl border-2 border-dashed p-10 text-center transition-all ${knowledgeDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}
      >
        <Upload size={36} className={`mx-auto mb-3 ${knowledgeDragOver ? 'text-blue-500' : 'text-gray-300'}`} />
        <p className="font-semibold text-gray-700 mb-1">Drag & drop files here</p>
        <p className="text-sm text-gray-400 mb-4">PDF, DOCX, TXT, CSV — up to 50MB</p>
        <button className="gradient-btn px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 mx-auto">
          <Upload size={15} /> Browse Files
        </button>
      </div>

      {/* URL Input */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Link2 size={16} /> Add URL</h3>
        <div className="flex gap-3">
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://your-website.com/docs"
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button className="gradient-btn px-5 py-2.5 rounded-xl font-semibold text-sm">
            Scrape
          </button>
        </div>
      </div>

      {/* Uploaded Files */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><FileText size={16} /> Knowledge Sources</h3>
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs">PDF</div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Product FAQ.pdf</p>
              <p className="text-xs text-gray-500">12 pages · 248 KB · Added 2 days ago</p>
            </div>
          </div>
          <button className="text-gray-400 hover:text-red-500 transition-colors p-1.5">
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  )

  const renderCommands = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><Terminal size={16} /> Custom Commands</h3>
          <button
            onClick={() => setShowAddCommand(v => !v)}
            className="gradient-btn flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
          >
            <Plus size={14} /> Add Command
          </button>
        </div>

        {showAddCommand && (
          <div className="p-5 bg-blue-50 border-b border-blue-100 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Trigger</label>
                <input
                  type="text"
                  value={newTrigger}
                  onChange={e => setNewTrigger(e.target.value)}
                  placeholder="/command"
                  className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Response</label>
                <input
                  type="text"
                  value={newResponse}
                  onChange={e => setNewResponse(e.target.value)}
                  placeholder="What the agent replies..."
                  className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddCommand} className="gradient-btn px-4 py-2 rounded-lg text-sm font-semibold">
                Save Command
              </button>
              <button onClick={() => setShowAddCommand(false)} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-50">
          {commands.map((cmd, i) => (
            <div key={i} className="flex items-start justify-between p-5 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-3">
                <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">{cmd.trigger}</span>
                <span className="text-sm text-gray-600 mt-1">→ {cmd.response}</span>
              </div>
              <button
                onClick={() => setCommands(prev => prev.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-500 transition-colors p-1 flex-shrink-0"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderAgentIntegrations = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Enable or disable integrations for this specific agent.</p>
      {[
        { id: 'sms', name: 'SMS / Twilio', icon: '📱', desc: 'Send and receive SMS messages', color: 'bg-red-50' },
        { id: 'telegram', name: 'Telegram', icon: '✈️', desc: 'Deploy as a Telegram bot', color: 'bg-blue-50' },
        { id: 'twitter', name: 'X / Twitter', icon: '𝕏', desc: 'Auto-respond to mentions and DMs', color: 'bg-gray-100' },
        { id: 'discord', name: 'Discord', icon: '🎮', desc: 'Engage your Discord community', color: 'bg-indigo-50' },
      ].map(intg => (
        <div key={intg.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${intg.color} flex items-center justify-center text-2xl`}>
              {intg.icon}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">{intg.name}</p>
              <p className="text-xs text-gray-500">{intg.desc}</p>
            </div>
          </div>
          <button
            onClick={() => setIntegrationToggles(prev => ({ ...prev, [intg.id]: !prev[intg.id] }))}
            className={`transition-colors ${integrationToggles[intg.id] ? 'text-blue-600' : 'text-gray-300'}`}
          >
            {integrationToggles[intg.id]
              ? <ToggleRight size={36} />
              : <ToggleLeft size={36} />
            }
          </button>
        </div>
      ))}
    </div>
  )

  const renderEmptyTab = (tab: string) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
      <div className="text-5xl mb-4">
        {tab === 'analytics' ? '📊' : '⚙️'}
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        {tab === 'analytics' ? 'Analytics Coming Soon' : 'Settings'}
      </h3>
      <p className="text-gray-500 text-sm max-w-xs mx-auto mb-6">
        {tab === 'analytics' ? 'Detailed analytics and reporting will be available here.' : 'Configure advanced agent settings here.'}
      </p>
      <button onClick={() => navigate('/dashboard/agents/new')} className="gradient-btn px-6 py-2.5 rounded-xl font-semibold text-sm">
        Configure in Wizard
      </button>
    </div>
  )

  const tabContent: Record<string, () => JSX.Element> = {
    overview: renderOverview,
    chat: renderChat,
    personality: renderPersonality,
    knowledge: renderKnowledge,
    commands: renderCommands,
    integrations: renderAgentIntegrations,
    analytics: () => renderEmptyTab('analytics'),
    settings: () => renderEmptyTab('settings'),
  }

  return (
    <DashboardLayout>
      {/* Agent Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${agent.avatarColor} flex items-center justify-center text-4xl flex-shrink-0 shadow-lg`}>
            {agent.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-2xl font-extrabold text-gray-900">{agent.name}</h1>
              <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${
                agent.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
              }`}>
                <Circle size={6} className={agent.status === 'active' ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400'} />
                {agent.status === 'active' ? 'Active' : 'Paused'}
              </span>
            </div>
            <p className="text-gray-500 text-sm mb-3">{agent.template} · {agent.model}</p>
            <div className="flex items-center gap-6 flex-wrap text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><MessageSquare size={14} className="text-blue-500" /> {agent.messages} messages</span>
              <span className="flex items-center gap-1.5"><Activity size={14} className="text-green-500" /> {agent.uptime} uptime</span>
              <div className="flex gap-2">
                {agent.channels.map(c => (
                  <span key={c} className="bg-blue-50 text-blue-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">{c}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button onClick={() => setActiveTab('chat')}
              className="gradient-btn px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2">
              <MessageSquare size={15} /> Chat
            </button>
            <button onClick={() => setActiveTab('personality')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all">
              <Edit3 size={15} /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 mb-6 overflow-x-auto flex-nowrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === id ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            style={activeTab === id ? { background: 'linear-gradient(90deg, #2563EB, #7C3AED)' } : {}}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {(tabContent[activeTab] || tabContent['overview'])()}
    </DashboardLayout>
  )
}
