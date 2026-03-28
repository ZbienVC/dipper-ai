import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import {
  MessageSquare, BarChart2, Settings, BookOpen, Terminal,
  Plug, User, Activity, Edit3, Save, Circle, Send, Bot,
  Upload, Link2, FileText, Plus, X, Check, ToggleLeft, ToggleRight
} from 'lucide-react'

const MOCK_AGENTS: Record<string, {
  id: string, name: string, status: string, template: string, model: string,
  messages: number, uptime: string, accuracy: string, channels: string[],
  bio: string, tone: string, commStyle: string,
}> = {
  '1': {
    id: '1', name: 'SupportBot Pro', status: 'active', template: 'Customer Support Bot',
    model: 'Claude 3.5 Haiku', messages: 412, uptime: '99.8%', accuracy: '94%',
    channels: ['SMS', 'Telegram'],
    bio: 'I handle customer support inquiries with speed and precision.',
    tone: 'Friendly', commStyle: 'Professional',
  },
  '2': {
    id: '2', name: 'Sales Ninja', status: 'active', template: 'Sales Follow-up Agent',
    model: 'GPT-4o', messages: 289, uptime: '99.5%', accuracy: '91%',
    channels: ['SMS', 'X'],
    bio: 'I turn cold leads warm and warm leads hot.',
    tone: 'Assertive', commStyle: 'Casual & Friendly',
  },
  '3': {
    id: '3', name: 'Community Max', status: 'paused', template: 'Telegram Community Manager',
    model: 'Gemini 1.5 Pro', messages: 146, uptime: '97.2%', accuracy: '89%',
    channels: ['Telegram', 'Discord'],
    bio: 'I keep communities engaged, moderated, and growing.',
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

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const inputClass = "w-full px-4 py-2.5 rounded-xl bg-white/5 border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600 text-sm transition-all"

export default function AgentDetail() {
  const { id = '1' } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [agentData, setAgentData] = useState<any>(null)
  const agent = agentData || MOCK_AGENTS[id] || MOCK_AGENTS['1']

  useEffect(() => {
    const token = (() => { try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null } })()
    if (!token) return
    fetch(`/api/agents/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setAgentData({ id: d.id, name: d.name, status: d.is_active ? 'active' : 'paused', template: d.description, model: d.model, messages: d.total_messages, uptime: 'N/A', accuracy: 'N/A', channels: [], bio: d.system_prompt, tone: 'Friendly', commStyle: 'Professional' }))
      .catch(() => {})
  }, [id])

  const initialTab = searchParams.get('tab') || 'overview'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [editBio, setEditBio] = useState('')
  const [editTone, setEditTone] = useState('')
  const [editCommStyle, setEditCommStyle] = useState('')
  const [saved, setSaved] = useState(false)
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash')
  const [editAdjectives, setEditAdjectives] = useState('Helpful, Professional, Concise')
  const [editTopics, setEditTopics] = useState('')
  const [editForbiddenWords, setEditForbiddenWords] = useState('')
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [inputText, setInputText] = useState('')
  const [thinking, setThinking] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [urlInput, setUrlInput] = useState('')
  const [knowledgeDragOver, setKnowledgeDragOver] = useState(false)
  const [commands, setCommands] = useState<Command[]>([
    { trigger: '/help', response: 'Lists all available features and commands.' },
    { trigger: '/pricing', response: 'Shows current pricing plans.' },
  ])
  const [showAddCommand, setShowAddCommand] = useState(false)
  const [newTrigger, setNewTrigger] = useState('')
  const [newResponse, setNewResponse] = useState('')
  const [integrationToggles, setIntegrationToggles] = useState<Record<string, boolean>>({ sms: false, telegram: true, twitter: false, discord: false })

  useEffect(() => {
    if (agent) {
      setEditBio(agent.bio || '')
      setEditTone(agent.tone || 'Friendly')
      setEditCommStyle(agent.commStyle || 'Professional')
      setMessages([{ role: 'agent', text: `Hey! I'm ${agent.name}. How can I help you today?`, ts: getTime() }])
      setEditTopics(agent.template || '')
    }
  }, [agent.name])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking])
  useEffect(() => { const tab = searchParams.get('tab'); if (tab) setActiveTab(tab) }, [searchParams])

  const sendMessage = async () => {
    if (!inputText.trim() || thinking) return
    const userMsg: ChatMsg = { role: 'user', text: inputText.trim(), ts: getTime() }
    const currentInput = inputText.trim()

    // Check if we have a real agent with auth token
    const token = (() => { try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null } })()

    setMessages(prev => [...prev, userMsg])
    setInputText('')
    setThinking(true)
    try {
      let reply: string
      if (token && agentData) {
        const res = await fetch(`/api/agents/${id}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: currentInput }),
        })
        const data = await res.json()
        reply = data.content || data.error || 'Something went wrong.'
      } else {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: id, message: currentInput,
            conversationHistory: messages, agentName: agent.name,
            personality: { bio: editBio, adjectives: editAdjectives.split(',').map(s => s.trim()).filter(Boolean), communicationStyle: editCommStyle, topics: editTopics.split(',').map(s => s.trim()).filter(Boolean), forbiddenWords: editForbiddenWords || undefined },
            model: selectedModel,
          }),
        })
        const data = await res.json()
        reply = data.reply || data.error || 'Something went wrong.'
      }
      setMessages(prev => [...prev, { role: 'agent', text: reply, ts: getTime() }])
    } catch {
      setMessages(prev => [...prev, { role: 'agent', text: 'Sorry, I had trouble responding. Try again.', ts: getTime() }])
    }
    setThinking(false)
  }

  const handleSavePersonality = async () => {
    const token = (() => { try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null } })()
    if (token && agentData) {
      await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ systemPrompt: editBio }),
      }).catch(() => {})
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const renderOverview = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Messages', value: (agent.messages || 0).toLocaleString(), color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
          { label: 'Uptime', value: agent.uptime || 'N/A', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
          { label: 'Accuracy', value: agent.accuracy || 'N/A', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          { label: 'Channels', value: String(agent.channels?.length || 0), color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
        ].map(s => (
          <div key={s.label} className={`bg-[#111118] rounded-xl p-4 border ${s.border}`}>
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
              <Activity size={16} className={s.color} />
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-5">
        <h3 className="font-semibold text-white mb-3 text-sm">Recent Activity</h3>
        <div className="space-y-3">
          {[
            { text: 'Handled 12 customer inquiries', time: '2 min ago', dot: 'bg-violet-500' },
            { text: 'Auto-escalated 1 ticket', time: '18 min ago', dot: 'bg-amber-500' },
            { text: 'Sent daily summary report', time: '1 hr ago', dot: 'bg-blue-500' },
            { text: 'Processed 47 messages via Telegram', time: '2 hrs ago', dot: 'bg-teal-500' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${item.dot}`} />
              <div>
                <p className="text-sm text-slate-300">{item.text}</p>
                <p className="text-xs text-slate-600">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderChat = () => (
    <div className="flex flex-col h-[580px] bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1e1e2e] flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Bot size={14} className="text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">{agent.name}</p>
          <p className="text-xs text-green-400 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Online
          </p>
        </div>
        <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
          className="text-xs bg-white/5 border border-[#1e1e2e] text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500/50">
          <option value="gemini-1.5-flash">Gemini Flash</option>
          <option value="gemini-1.5-pro">Gemini Pro</option>
          <option value="claude-3-5-haiku-20241022">Claude Haiku</option>
          <option value="gpt-4o-mini">GPT-4o Mini</option>
        </select>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0a0a0f]">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'agent' && (
              <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mb-1">
                <Bot size={12} className="text-violet-400" />
              </div>
            )}
            <div className={`max-w-sm flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                msg.role === 'user' ? 'text-white rounded-br-sm bg-violet-600' : 'bg-[#16161f] text-slate-200 border border-[#1e1e2e] rounded-bl-sm'
              }`}>
                {msg.text}
              </div>
              <span className="text-xs text-slate-600 px-1">{msg.ts}</span>
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 mb-1">
                <User size={12} className="text-slate-400" />
              </div>
            )}
          </div>
        ))}
        {thinking && (
          <div className="flex items-end gap-2 justify-start">
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
              <Bot size={12} className="text-violet-400" />
            </div>
            <div className="bg-[#16161f] border border-[#1e1e2e] rounded-xl rounded-bl-sm px-4 py-2.5">
              <div className="flex gap-1 items-center">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="px-4 py-3 border-t border-[#1e1e2e] bg-[#111118]">
        <div className="flex gap-2 items-center">
          <input value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder={`Message ${agent.name}...`} disabled={thinking}
            className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-[#1e1e2e] text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-slate-200 placeholder-slate-600 transition-all disabled:opacity-50" />
          <button onClick={sendMessage} disabled={!inputText.trim() || thinking}
            className="gradient-btn w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40">
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )

  const renderPersonality = () => (
    <div className="space-y-5 bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">System Prompt / Bio</label>
        <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={4}
          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white text-sm resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Tone</label>
          <select value={editTone} onChange={e => setEditTone(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-[#0d0d15] border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white text-sm">
            {['Friendly', 'Professional', 'Assertive', 'Playful', 'Empathetic', 'Witty'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Communication Style</label>
          <select value={editCommStyle} onChange={e => setEditCommStyle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-[#0d0d15] border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white text-sm">
            {['Professional', 'Casual & Friendly', 'Formal', 'Witty & Humorous', 'Empathetic', 'Direct & Concise'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Personality Traits <span className="text-slate-600 font-normal">(comma-separated)</span></label>
        <input type="text" value={editAdjectives} onChange={e => setEditAdjectives(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">AI Model</label>
        <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-[#0d0d15] border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white text-sm">
          <optgroup label="Google Gemini">
            <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
          </optgroup>
          <optgroup label="Anthropic">
            <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
            <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
          </optgroup>
          <optgroup label="OpenAI">
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
          </optgroup>
        </select>
      </div>
      <button onClick={handleSavePersonality}
        className={`flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm transition-all ${saved ? 'bg-green-500 text-white' : 'gradient-btn'}`}>
        {saved ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save Changes</>}
      </button>
    </div>
  )

  const renderKnowledge = () => (
    <div className="space-y-4">
      <div onDragOver={e => { e.preventDefault(); setKnowledgeDragOver(true) }} onDragLeave={() => setKnowledgeDragOver(false)}
        onDrop={e => { e.preventDefault(); setKnowledgeDragOver(false) }}
        className={`bg-[#111118] border-2 border-dashed rounded-xl p-10 text-center transition-all ${knowledgeDragOver ? 'border-violet-500 bg-violet-500/10' : 'border-[#1e1e2e]'}`}>
        <Upload size={28} className={`mx-auto mb-2 ${knowledgeDragOver ? 'text-violet-400' : 'text-slate-600'}`} />
        <p className="font-semibold text-slate-300 text-sm mb-1">Drag & drop files here</p>
        <p className="text-xs text-slate-600 mb-3">PDF, DOCX, TXT, CSV</p>
        <button className="gradient-btn px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 mx-auto">
          <Upload size={13} /> Browse Files
        </button>
      </div>
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-4">
        <h3 className="font-semibold text-white mb-3 text-sm flex items-center gap-2"><Link2 size={14} /> Add URL</h3>
        <div className="flex gap-3">
          <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://your-website.com/docs" className={inputClass} />
          <button className="gradient-btn px-4 py-2 rounded-xl font-semibold text-xs flex-shrink-0">Scrape</button>
        </div>
      </div>
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-4">
        <h3 className="font-semibold text-white mb-3 text-sm flex items-center gap-2"><FileText size={14} /> Knowledge Sources</h3>
        <div className="flex items-center justify-between p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/20 border border-red-500/20 flex items-center justify-center text-red-400 font-bold text-xs">PDF</div>
            <div>
              <p className="font-semibold text-white text-sm">Product FAQ.pdf</p>
              <p className="text-xs text-slate-500">12 pages · 248 KB</p>
            </div>
          </div>
          <button className="text-slate-600 hover:text-red-400 transition-colors p-1.5"><X size={14} /></button>
        </div>
      </div>
    </div>
  )

  const renderCommands = () => (
    <div className="space-y-3">
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#1e1e2e]">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2"><Terminal size={14} /> Custom Commands</h3>
          <button onClick={() => setShowAddCommand(v => !v)}
            className="gradient-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold">
            <Plus size={12} /> Add Command
          </button>
        </div>
        {showAddCommand && (
          <div className="p-4 bg-violet-500/5 border-b border-[#1e1e2e] space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Trigger</label>
                <input type="text" value={newTrigger} onChange={e => setNewTrigger(e.target.value)} placeholder="/command"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#1e1e2e] text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Response</label>
                <input type="text" value={newResponse} onChange={e => setNewResponse(e.target.value)} placeholder="Agent reply..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#1e1e2e] text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { if (newTrigger && newResponse) { setCommands(prev => [...prev, { trigger: newTrigger, response: newResponse }]); setNewTrigger(''); setNewResponse(''); setShowAddCommand(false) } }}
                className="gradient-btn px-3 py-1.5 rounded-lg text-xs font-semibold">Save</button>
              <button onClick={() => setShowAddCommand(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1e1e2e] text-slate-400 hover:bg-white/5">Cancel</button>
            </div>
          </div>
        )}
        <div className="divide-y divide-[#1e1e2e]">
          {commands.map((cmd, i) => (
            <div key={i} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-1 rounded-lg">{cmd.trigger}</span>
                <span className="text-sm text-slate-500">→ {cmd.response}</span>
              </div>
              <button onClick={() => setCommands(prev => prev.filter((_, j) => j !== i))}
                className="text-slate-600 hover:text-red-400 transition-colors p-1"><X size={13} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderAgentIntegrations = () => (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Enable or disable integrations for this agent.</p>
      {[
        { id: 'sms', name: 'SMS / Twilio', desc: 'Send and receive SMS messages' },
        { id: 'telegram', name: 'Telegram', desc: 'Deploy as a Telegram bot' },
        { id: 'twitter', name: 'X / Twitter', desc: 'Auto-respond to mentions and DMs' },
        { id: 'discord', name: 'Discord', desc: 'Engage your Discord community' },
      ].map(intg => (
        <div key={intg.id} className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-[#1e1e2e] flex items-center justify-center">
              <Plug size={16} className={integrationToggles[intg.id] ? 'text-violet-400' : 'text-slate-600'} />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">{intg.name}</p>
              <p className="text-xs text-slate-500">{intg.desc}</p>
            </div>
          </div>
          <button onClick={() => setIntegrationToggles(prev => ({ ...prev, [intg.id]: !prev[intg.id] }))}
            className={`transition-colors ${integrationToggles[intg.id] ? 'text-violet-400' : 'text-slate-600'}`}>
            {integrationToggles[intg.id] ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
          </button>
        </div>
      ))}
    </div>
  )

  const renderEmptyTab = (tab: string) => (
    <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
        {tab === 'analytics' ? <BarChart2 size={24} className="text-violet-400" /> : <Settings size={24} className="text-violet-400" />}
      </div>
      <h3 className="text-base font-bold text-white mb-2">{tab === 'analytics' ? 'Analytics Coming Soon' : 'Settings'}</h3>
      <p className="text-slate-500 text-sm max-w-xs mx-auto">{tab === 'analytics' ? 'Detailed analytics will be available here soon.' : 'Advanced agent settings will appear here.'}</p>
    </div>
  )

  const tabContent: Record<string, () => JSX.Element> = {
    overview: renderOverview, chat: renderChat, personality: renderPersonality, knowledge: renderKnowledge,
    commands: renderCommands, integrations: renderAgentIntegrations,
    analytics: () => renderEmptyTab('analytics'), settings: () => renderEmptyTab('settings'),
  }

  return (
    <DashboardLayout>
      {/* Agent Header */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 mb-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Bot size={24} className="text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-white">{agent.name}</h1>
              <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                agent.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
              }`}>
                <Circle size={5} className={agent.status === 'active' ? 'fill-green-400' : 'fill-slate-400'} />
                {agent.status === 'active' ? 'Active' : 'Paused'}
              </span>
            </div>
            <p className="text-slate-500 text-sm mb-2">{agent.template || 'Custom Agent'} · {agent.model}</p>
            <div className="flex items-center gap-4 flex-wrap text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><MessageSquare size={13} className="text-violet-400" /> {(agent.messages || 0).toLocaleString()} messages</span>
              <span className="flex items-center gap-1.5"><Activity size={13} className="text-green-400" /> {agent.uptime || 'N/A'} uptime</span>
              {(agent.channels || []).map((c: string) => (
                <span key={c} className="bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs font-semibold px-2 py-0.5 rounded-full">{c}</span>
              ))}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setActiveTab('chat')} className="gradient-btn px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-1.5">
              <MessageSquare size={14} /> Chat
            </button>
            <button onClick={() => setActiveTab('personality')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#1e1e2e] text-slate-400 font-semibold text-sm hover:bg-white/5 transition-all">
              <Edit3 size={14} /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#111118] border border-[#1e1e2e] rounded-xl p-1.5 mb-5 overflow-x-auto flex-nowrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === id ? 'gradient-btn' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
            }`}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {(tabContent[activeTab] || tabContent['overview'])()}
    </DashboardLayout>
  )
}
