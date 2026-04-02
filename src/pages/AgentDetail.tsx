import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import {
  MessageSquare, BarChart2, Settings, BookOpen, Terminal,
  Plug, User, Activity, Edit3, Save, Circle, Send, Bot,
  Upload, Link2, FileText, Plus, X, Check, Loader2, Globe, Copy, ExternalLink, ToggleLeft, ToggleRight,
  Users, Trash2, ChevronRight, Search, Database, AlertCircle, RefreshCw
} from 'lucide-react'

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'personality', label: 'Personality', icon: User },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { id: 'commands', label: 'Commands', icon: Terminal },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'deploy', label: 'Deploy', icon: Globe },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'settings', label: 'Settings', icon: Settings },
]

interface ChatMsg { role: 'user' | 'agent'; text: string; ts: string }
interface Command { trigger: string; response: string; description?: string }

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

const inputClass = "w-full px-4 py-2.5 rounded-xl bg-white/5 border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600 text-sm transition-all"

export default function AgentDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [agent, setAgent] = useState<any>(null)
  const [agentLoading, setAgentLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const token = getToken()
    if (!token) { setNotFound(true); setAgentLoading(false); return }
    fetch(`/api/agents/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) { setNotFound(true); }
        else setAgent(d)
      })
      .catch(() => setNotFound(true))
      .finally(() => setAgentLoading(false))
  }, [id])

  const initialTab = searchParams.get('tab') || 'overview'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [editBio, setEditBio] = useState('')
  const [editTone, setEditTone] = useState('Friendly')
  const [editCommStyle, setEditCommStyle] = useState('Professional')
  const [saved, setSaved] = useState(false)
  const [selectedModel, setSelectedModel] = useState('claude-haiku-4-5')
  const [editAdjectives, setEditAdjectives] = useState('')
  const [editTopics, setEditTopics] = useState('')
  const [editForbiddenWords, setEditForbiddenWords] = useState('')
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [inputText, setInputText] = useState('')
  const [thinking, setThinking] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [urlInput, setUrlInput] = useState('')
  const [knowledgeDragOver, setKnowledgeDragOver] = useState(false)
  const [commands, setCommands] = useState<Command[]>([])
  const [showAddCommand, setShowAddCommand] = useState(false)
  const [newTrigger, setNewTrigger] = useState('')
  const [newResponse, setNewResponse] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [integrationRecords, setIntegrationRecords] = useState<{ type: string; connected: boolean; bot_info?: string; agent_id?: string }[]>([])
  const [usageStats, setUsageStats] = useState<{ messagesUsedToday: number; messagesLimitToday: number; allowedModels: string[] } | null>(null)
  const [embedEnabled, setEmbedEnabled] = useState(false)
  const [embedToggling, setEmbedToggling] = useState(false)
  const [copiedKey, setCopiedKey] = useState('')

  // Analytics/metrics state
  const [metrics, setMetrics] = useState<any[]>([])
  const [metricsLoading, setMetricsLoading] = useState(false)

  // Always-on state
  const [alwaysOn, setAlwaysOn] = useState(false)
  const [alwaysOnToggling, setAlwaysOnToggling] = useState(false)

  // Settings tab state
  const [settingsName, setSettingsName] = useState('')
  const [settingsDesc, setSettingsDesc] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [agentDeleteConfirm, setAgentDeleteConfirm] = useState(false)

  // Memory/users state
  const [memories, setMemories] = useState<any[]>([])
  const [memoriesTotal, setMemoriesTotal] = useState(0)
  const [memoriesLoading, setMemoriesLoading] = useState(false)
  const [selectedMemory, setSelectedMemory] = useState<any>(null)
  const [memoryDetail, setMemoryDetail] = useState<any>(null)
  const [memoryDetailLoading, setMemoryDetailLoading] = useState(false)
  const [clearAllConfirm, setClearAllConfirm] = useState(false)
  const [deleteMemConfirm, setDeleteMemConfirm] = useState<string | null>(null)

  // Knowledge base state
  const [knowledgeSources, setKnowledgeSources] = useState<any[]>([])
  const [knowledgeTotalChars, setKnowledgeTotalChars] = useState(0)
  const [knowledgeLoading, setKnowledgeLoading] = useState(false)
  const [showAddKnowledge, setShowAddKnowledge] = useState(false)
  const [knowledgeTab, setKnowledgeTab] = useState<'text' | 'url' | 'faq'>('text')
  const [kbName, setKbName] = useState('')
  const [kbTextContent, setKbTextContent] = useState('')
  const [kbUrl, setKbUrl] = useState('')
  const [kbFaqs, setKbFaqs] = useState<{ question: string; answer: string }[]>([{ question: '', answer: '' }])
  const [kbAdding, setKbAdding] = useState(false)
  const [kbAddError, setKbAddError] = useState('')
  const [kbDeleteConfirm, setKbDeleteConfirm] = useState<string | null>(null)
  const [kbSearchSource, setKbSearchSource] = useState<any>(null)
  const [kbSearchQuery, setKbSearchQuery] = useState('')
  const [kbSearchResults, setKbSearchResults] = useState<any[]>([])
  const [kbSearching, setKbSearching] = useState(false)

  // New capabilities state
  const [capToolsEnabled, setCapToolsEnabled] = useState<string[]>([])
  const [capAutoTranslate, setCapAutoTranslate] = useState(false)
  const [capFollowupEnabled, setCapFollowupEnabled] = useState(false)
  const [capFollowupDelayHours, setCapFollowupDelayHours] = useState(24)
  const [capFollowupMessage, setCapFollowupMessage] = useState('')
  const [capEscalateOnNeg, setCapEscalateOnNeg] = useState(false)
  const [capEscalationNotify, setCapEscalationNotify] = useState('inapp')
  const [capSaving, setCapSaving] = useState(false)
  const [capSaved, setCapSaved] = useState(false)

  useEffect(() => {
    const token = getToken()
    if (!token) return
    fetch('/api/integrations', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((d: any[]) => setIntegrationRecords(d))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const token = getToken()
    if (!token) return
    fetch('/api/usage', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then((d: any) => d && setUsageStats(d))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (agent) {
      setEditBio(agent.system_prompt || '')
      setEditTone('Friendly')
      setEditCommStyle('Professional')
      setSelectedModel(agent.model || 'claude-haiku-4-5')
      setEditTopics(agent.description || '')
      setMessages([{ role: 'agent', text: `Hey! I'm ${agent.name}. How can I help you today?`, ts: getTime() }])
      setEmbedEnabled(!!agent.deployed_embed_enabled)
      setAlwaysOn(!!agent.always_on)
      setSettingsName(agent.name || '')
      setSettingsDesc(agent.description || '')
      // New capabilities
      setCapToolsEnabled(agent.tools_enabled || [])
      setCapAutoTranslate(!!agent.auto_translate)
      setCapFollowupEnabled(!!agent.followup_enabled)
      setCapFollowupDelayHours(agent.followup_delay_hours || 24)
      setCapFollowupMessage(agent.followup_message || '')
      setCapEscalateOnNeg(!!agent.escalate_on_negative)
      setCapEscalationNotify(agent.escalation_notify || 'inapp')
    }
  }, [agent?.id])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking])
  useEffect(() => { const tab = searchParams.get('tab'); if (tab) setActiveTab(tab) }, [searchParams])

  // Load knowledge sources when knowledge tab is activated
  const loadKnowledge = useCallback(() => {
    if (!agent) return
    const token = getToken()
    if (!token) return
    setKnowledgeLoading(true)
    fetch(`/api/agents/${agent.id}/knowledge`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { sources: [], totalChars: 0 })
      .then((d: any) => { setKnowledgeSources(d.sources || []); setKnowledgeTotalChars(d.totalChars || 0) })
      .catch(() => {})
      .finally(() => setKnowledgeLoading(false))
  }, [agent?.id])

  useEffect(() => {
    if (activeTab === 'knowledge' && agent) loadKnowledge()
  }, [activeTab, agent?.id])

  // Poll for processing knowledge sources
  useEffect(() => {
    const hasProcessing = knowledgeSources.some(s => s.status === 'processing')
    if (!hasProcessing) return
    const interval = setInterval(loadKnowledge, 2000)
    return () => clearInterval(interval)
  }, [knowledgeSources, loadKnowledge])

  // Load memories when users tab is activated
  useEffect(() => {
    if (activeTab === 'users' && agent) {
      const token = getToken()
      if (!token) return
      setMemoriesLoading(true)
      fetch(`/api/agents/${agent.id}/memories?limit=50&offset=0`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { memories: [], total: 0 })
        .then((d: any) => { setMemories(d.memories || []); setMemoriesTotal(d.total || 0) })
        .catch(() => {})
        .finally(() => setMemoriesLoading(false))
    }
  }, [activeTab, agent?.id])

  // Load metrics when analytics tab is activated
  useEffect(() => {
    if (activeTab === 'analytics' && agent) {
      const token = getToken()
      if (!token) return
      setMetricsLoading(true)
      fetch(`/api/agents/${agent.id}/intelligence/metrics`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : [])
        .then((d: any[]) => setMetrics(Array.isArray(d) ? d : []))
        .catch(() => setMetrics([]))
        .finally(() => setMetricsLoading(false))
    }
  }, [activeTab, agent?.id])

  const toggleAlwaysOn = async () => {
    const token = getToken()
    if (!token || !agent) return
    setAlwaysOnToggling(true)
    try {
      const res = await fetch(`/api/agents/${id}/always-on`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ always_on: !alwaysOn }),
      })
      if (res.ok) {
        const updated = await res.json()
        setAlwaysOn(!!updated.always_on)
        setAgent((prev: any) => ({ ...prev, always_on: updated.always_on }))
      }
    } catch {}
    setAlwaysOnToggling(false)
  }

  const handleSaveSettings = async () => {
    const token = getToken()
    if (!token || !agent) return
    setSettingsSaving(true)
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: settingsName.trim(), description: settingsDesc.trim() }),
      })
      if (res.ok) {
        const updated = await res.json()
        setAgent(updated)
        setSettingsSaved(true)
        setTimeout(() => setSettingsSaved(false), 2000)
      }
    } catch {}
    setSettingsSaving(false)
  }

  const handleSaveCapabilities = async () => {
    const token = getToken()
    if (!token || !agent) return
    setCapSaving(true)
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tools_enabled: capToolsEnabled,
          auto_translate: capAutoTranslate,
          followup_enabled: capFollowupEnabled,
          followup_delay_hours: capFollowupDelayHours,
          followup_message: capFollowupMessage,
          escalate_on_negative: capEscalateOnNeg,
          escalation_notify: capEscalationNotify,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setAgent(updated)
        setCapSaved(true)
        setTimeout(() => setCapSaved(false), 2000)
      }
    } catch {}
    setCapSaving(false)
  }

  const handleDeleteAgent = async () => {
    const token = getToken()
    if (!token) return
    await fetch(`/api/agents/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    navigate('/dashboard/agents')
  }

  const sendMessage = async () => {
    if (!inputText.trim() || thinking || !agent) return
    const userMsg: ChatMsg = { role: 'user', text: inputText.trim(), ts: getTime() }
    const currentInput = inputText.trim()
    const token = getToken()
    setMessages(prev => [...prev, userMsg])
    setInputText('')
    setThinking(true)
    try {
      let reply: string
      if (token) {
        const res = await fetch(`/api/agents/${id}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: currentInput, model: selectedModel }),
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
            personality: { bio: editBio, adjectives: editAdjectives.split(',').map((s: string) => s.trim()).filter(Boolean), communicationStyle: editCommStyle },
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
    const token = getToken()
    if (token && agent) {
      await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ systemPrompt: editBio, model: selectedModel }),
      }).catch(() => {})
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const renderOverview = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Messages', value: (agent?.total_messages || 0).toLocaleString(), color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
          { label: 'Model', value: agent?.model || 'N/A', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          { label: 'Status', value: agent?.is_active ? 'Active' : 'Paused', color: agent?.is_active ? 'text-green-400' : 'text-slate-400', bg: agent?.is_active ? 'bg-green-500/10' : 'bg-slate-500/10', border: agent?.is_active ? 'border-green-500/20' : 'border-slate-500/20' },
        ].map(s => (
          <div key={s.label} className={`bg-[#111118] rounded-xl p-4 border ${s.border}`}>
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
              <Activity size={16} className={s.color} />
            </div>
            <p className={`text-lg font-bold ${s.color} truncate`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Deploy Checklist */}
      <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-5">
        <h3 className="font-semibold text-white mb-3 text-sm">Deploy Checklist</h3>
        <div className="space-y-2">
          {[
            { label: 'System prompt configured', done: !!(agent?.system_prompt && agent.system_prompt.length > 10) },
            { label: 'AI model selected', done: !!(agent?.model) },
            { label: 'Channel connected', done: integrationRecords.some(r => r.connected && (r.agent_id === id || !r.agent_id)) },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-green-500/20 border border-green-500/30' : 'bg-slate-800 border border-slate-700'}`}>
                {item.done ? <Check size={11} className="text-green-400" /> : <X size={11} className="text-slate-600" />}
              </div>
              <span className={`text-sm ${item.done ? 'text-slate-300' : 'text-slate-500'}`}>{item.label}</span>
            </div>
          ))}
        </div>
        {!integrationRecords.some(r => r.connected) && (
          <button onClick={() => navigate('/dashboard/integrations')}
            className="mt-4 gradient-btn px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5">
            <Plug size={12} /> Connect a Channel
          </button>
        )}
      </div>
    </div>
  )

  const renderChat = () => (
    <div className="space-y-3">
      {memoriesTotal > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-500/10 border border-violet-500/20 rounded-xl text-sm text-violet-300">
          <span>💾</span>
          <span>Memory active — this agent remembers past interactions</span>
        </div>
      )}
    <div className="flex flex-col h-[580px] bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1e1e2e] flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-sm">
          {agent?.emoji || <Bot size={14} className="text-violet-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">{agent?.name}</p>
          <p className="text-xs text-green-400 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Online
          </p>
        </div>
        <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
          className="text-xs bg-white/5 border border-[#1e1e2e] text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500/50">
          {[
            { value: 'claude-haiku-4-5', label: 'Claude Haiku' },
            { value: 'claude-sonnet-4-5', label: 'Claude Sonnet' },
            { value: 'claude-opus-4-5', label: 'Claude Opus' },
            { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
            { value: 'gpt-4o', label: 'GPT-4o' },
            { value: 'gemini-1.5-flash', label: 'Gemini Flash' },
            { value: 'gemini-1.5-pro', label: 'Gemini Pro' },
          ].map(m => {
            const allowed = !usageStats || usageStats.allowedModels.includes(m.value)
            return (
              <option key={m.value} value={m.value}>
                {allowed ? m.label : `🔒 ${m.label}`}
              </option>
            )
          })}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0a0a0f]">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'agent' && (
              <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mb-1 text-sm">
                {agent?.emoji || <Bot size={12} className="text-violet-400" />}
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
            placeholder={`Message ${agent?.name || 'agent'}...`} disabled={thinking}
            className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-[#1e1e2e] text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-slate-200 placeholder-slate-600 transition-all disabled:opacity-50" />
          <button onClick={sendMessage} disabled={!inputText.trim() || thinking}
            className="gradient-btn w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40">
            <Send size={14} />
          </button>
        </div>
        {usageStats && (
          <p className="text-xs text-slate-600 mt-2 text-right">
            {usageStats.messagesUsedToday}/{usageStats.messagesLimitToday} messages today
          </p>
        )}
      </div>
    </div>
    </div>
  )

  const renderPersonality = () => (
    <div className="space-y-5 bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">System Prompt</label>
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
        <input type="text" value={editAdjectives} onChange={e => setEditAdjectives(e.target.value)} className={inputClass} placeholder="Helpful, Professional, Concise" />
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
            <option value="claude-haiku-4-5">Claude 3.5 Haiku</option>
            <option value="claude-sonnet-4-5">Claude 3.5 Sonnet</option>
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

  const renderKnowledge = () => {
    const CHAR_LIMIT = 50000
    const usagePct = Math.min((knowledgeTotalChars / CHAR_LIMIT) * 100, 100)
    const fmtNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

    const handleAddKnowledge = async () => {
      setKbAddError('')
      if (!kbName.trim()) { setKbAddError('Name is required'); return }
      let content = ''
      let type: 'text' | 'url' | 'faq' = knowledgeTab
      if (knowledgeTab === 'text') {
        if (!kbTextContent.trim()) { setKbAddError('Content is required'); return }
        content = kbTextContent.trim()
      } else if (knowledgeTab === 'url') {
        if (!kbUrl.trim()) { setKbAddError('URL is required'); return }
        content = kbUrl.trim()
      } else {
        const validFaqs = kbFaqs.filter(f => f.question.trim() && f.answer.trim())
        if (validFaqs.length === 0) { setKbAddError('Add at least one Q&A pair'); return }
        content = validFaqs.map(f => `Q: ${f.question.trim()}\nA: ${f.answer.trim()}`).join('\n\n')
        type = 'faq'
      }
      const token = getToken()
      if (!token) return
      setKbAdding(true)
      try {
        const r = await fetch(`/api/agents/${id}/knowledge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: kbName.trim(), type, content }),
        })
        const data = await r.json()
        if (!r.ok) { setKbAddError(data.error || 'Failed to add source'); return }
        setShowAddKnowledge(false)
        setKbName(''); setKbTextContent(''); setKbUrl('')
        setKbFaqs([{ question: '', answer: '' }])
        loadKnowledge()
      } catch {
        setKbAddError('Network error')
      } finally {
        setKbAdding(false)
      }
    }

    const handleDelete = async (sourceId: string) => {
      const token = getToken()
      if (!token) return
      await fetch(`/api/agents/${id}/knowledge/${sourceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setKbDeleteConfirm(null)
      loadKnowledge()
    }

    const handleSearch = async () => {
      if (!kbSearchQuery.trim() || !kbSearchSource) return
      const token = getToken()
      if (!token) return
      setKbSearching(true)
      try {
        const r = await fetch(`/api/agents/${id}/knowledge/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ query: kbSearchQuery }),
        })
        const data = await r.json()
        setKbSearchResults(data.results || [])
      } catch {
        setKbSearchResults([])
      } finally {
        setKbSearching(false)
      }
    }

    const typeBadge = (type: string) => {
      const map: Record<string, { label: string; cls: string }> = {
        text: { label: 'Text', cls: 'bg-blue-500/20 text-blue-400' },
        url: { label: 'URL', cls: 'bg-emerald-500/20 text-emerald-400' },
        faq: { label: 'FAQ', cls: 'bg-violet-500/20 text-violet-400' },
      }
      const t = map[type] || { label: type, cls: 'bg-slate-500/20 text-slate-400' }
      return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${t.cls}`}>{t.label}</span>
    }

    const statusBadge = (status: string) => {
      if (status === 'ready') return <span className="flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> Ready</span>
      if (status === 'processing') return <span className="flex items-center gap-1 text-xs text-amber-400"><Loader2 size={12} className="animate-spin" /> Processing</span>
      return <span className="flex items-center gap-1 text-xs text-red-400"><AlertCircle size={12} /> Error</span>
    }

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Database size={18} className="text-violet-400" /> Knowledge Base</h2>
            <p className="text-xs text-slate-500 mt-0.5">Give your agent specific knowledge to answer questions accurately.</p>
          </div>
          <button onClick={() => { setShowAddKnowledge(true); setKbAddError('') }}
            className="gradient-btn flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm">
            <Plus size={14} /> Add Source
          </button>
        </div>

        {/* Stats bar */}
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-5">
              <div><span className="text-slate-500">Sources</span> <span className="font-bold text-white ml-1">{knowledgeSources.length}</span></div>
              <div><span className="text-slate-500">Characters</span> <span className="font-bold text-white ml-1">{fmtNum(knowledgeTotalChars)} / {fmtNum(CHAR_LIMIT)}</span></div>
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-semibold ${knowledgeSources.some(s => s.status === 'ready') ? 'text-emerald-400' : 'text-slate-500'}`}>
              <div className={`w-2 h-2 rounded-full ${knowledgeSources.some(s => s.status === 'ready') ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              Knowledge {knowledgeSources.some(s => s.status === 'ready') ? 'Enabled' : 'Inactive'}
            </div>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${usagePct > 90 ? 'bg-red-500' : usagePct > 70 ? 'bg-amber-500' : 'bg-violet-500'}`}
              style={{ width: `${usagePct}%` }} />
          </div>
          <p className="text-xs text-slate-600">{CHAR_LIMIT - knowledgeTotalChars > 0 ? `${fmtNum(CHAR_LIMIT - knowledgeTotalChars)} characters remaining` : 'Limit reached'}</p>
        </div>

        {/* Source list */}
        {knowledgeLoading && knowledgeSources.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-violet-400" />
          </div>
        ) : knowledgeSources.length === 0 ? (
          <div className="bg-[#111118] border border-dashed border-[#1e1e2e] rounded-xl p-12 text-center">
            <BookOpen size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="font-semibold text-slate-400 mb-1">No knowledge sources yet</p>
            <p className="text-sm text-slate-600">Add documents, URLs, or FAQs to make your agent smarter.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {knowledgeSources.map(source => (
              <div key={source.id} className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm truncate">{source.name}</span>
                      {typeBadge(source.type)}
                      {statusBadge(source.status)}
                    </div>
                    {source.status === 'error' && source.error_message && (
                      <p className="text-xs text-red-400 mt-1">{source.error_message}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600">
                      <span>{fmtNum(source.char_count)} chars</span>
                      <span>·</span>
                      <span>{source.chunk_count} chunks</span>
                      <span>·</span>
                      <span>{new Date(source.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {source.status === 'ready' && (
                      <button onClick={() => { setKbSearchSource(source); setKbSearchQuery(''); setKbSearchResults([]) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1e1e2e] text-slate-400 hover:bg-white/5 hover:text-white transition-all">
                        <Search size={12} /> Test
                      </button>
                    )}
                    {kbDeleteConfirm === source.id ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleDelete(source.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all">
                          Confirm
                        </button>
                        <button onClick={() => setKbDeleteConfirm(null)}
                          className="px-2 py-1.5 rounded-lg text-xs border border-[#1e1e2e] text-slate-500 hover:bg-white/5 transition-all">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setKbDeleteConfirm(source.id)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Source Modal */}
        {showAddKnowledge && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowAddKnowledge(false) }}>
            <div className="bg-[#0d0d16] border border-[#1e1e2e] rounded-2xl w-full max-w-lg shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-[#1e1e2e]">
                <h3 className="font-bold text-white text-base flex items-center gap-2"><BookOpen size={16} className="text-violet-400" /> Add Knowledge Source</h3>
                <button onClick={() => setShowAddKnowledge(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
              </div>

              {/* Type tabs */}
              <div className="flex gap-1 p-4 pb-0">
                {(['text', 'url', 'faq'] as const).map(t => (
                  <button key={t} onClick={() => setKnowledgeTab(t)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${knowledgeTab === t ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
                    {t === 'text' ? '📝 Paste Text' : t === 'url' ? '🔗 Add URL' : '❓ FAQ Builder'}
                  </button>
                ))}
              </div>

              <div className="p-5 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Source Name</label>
                  <input value={kbName} onChange={e => setKbName(e.target.value)} placeholder="e.g. Product Documentation"
                    className={inputClass} />
                </div>

                {/* Text tab */}
                {knowledgeTab === 'text' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Content</label>
                    <textarea value={kbTextContent} onChange={e => setKbTextContent(e.target.value)}
                      placeholder="Paste any text content here — documentation, FAQs, product info, policies..."
                      rows={8} className={`${inputClass} resize-none leading-relaxed`} />
                    <p className="text-xs text-slate-600 mt-1">{kbTextContent.length.toLocaleString()} characters</p>
                  </div>
                )}

                {/* URL tab */}
                {knowledgeTab === 'url' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">URL to fetch</label>
                    <input value={kbUrl} onChange={e => setKbUrl(e.target.value)}
                      placeholder="https://example.com/docs/page" type="url" className={inputClass} />
                    <p className="text-xs text-slate-600 mt-1.5">The page will be fetched and indexed automatically. Some pages may block scraping.</p>
                  </div>
                )}

                {/* FAQ tab */}
                {knowledgeTab === 'faq' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-400">Questions & Answers</label>
                    {kbFaqs.map((faq, i) => (
                      <div key={i} className="bg-white/3 border border-[#1e1e2e] rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500">#{i + 1}</span>
                          {kbFaqs.length > 1 && (
                            <button onClick={() => setKbFaqs(prev => prev.filter((_, idx) => idx !== i))}
                              className="text-slate-600 hover:text-red-400 transition-colors"><X size={12} /></button>
                          )}
                        </div>
                        <input value={faq.question} onChange={e => setKbFaqs(prev => prev.map((f, idx) => idx === i ? { ...f, question: e.target.value } : f))}
                          placeholder="Question" className={inputClass} />
                        <textarea value={faq.answer} onChange={e => setKbFaqs(prev => prev.map((f, idx) => idx === i ? { ...f, answer: e.target.value } : f))}
                          placeholder="Answer" rows={2} className={`${inputClass} resize-none`} />
                      </div>
                    ))}
                    <button onClick={() => setKbFaqs(prev => [...prev, { question: '', answer: '' }])}
                      className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors">
                      <Plus size={12} /> Add Row
                    </button>
                  </div>
                )}

                {kbAddError && (
                  <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                    <AlertCircle size={14} /> {kbAddError}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button onClick={handleAddKnowledge} disabled={kbAdding}
                    className="flex-1 gradient-btn py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                    {kbAdding ? <><Loader2 size={14} className="animate-spin" /> {knowledgeTab === 'url' ? 'Fetching...' : 'Adding...'}</> : <><Check size={14} /> Add to Knowledge Base</>}
                  </button>
                  <button onClick={() => setShowAddKnowledge(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#1e1e2e] text-slate-400 hover:bg-white/5 transition-all">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Test Search Modal */}
        {kbSearchSource && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) { setKbSearchSource(null); setKbSearchResults([]) } }}>
            <div className="bg-[#0d0d16] border border-[#1e1e2e] rounded-2xl w-full max-w-lg shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-[#1e1e2e]">
                <h3 className="font-bold text-white text-base flex items-center gap-2"><Search size={16} className="text-violet-400" /> Test Knowledge Search</h3>
                <button onClick={() => { setKbSearchSource(null); setKbSearchResults([]) }} className="text-slate-500 hover:text-white"><X size={18} /></button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-500">Type a query to see which chunks would be retrieved for the AI context.</p>
                <div className="flex gap-2">
                  <input value={kbSearchQuery} onChange={e => setKbSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Type a question..." className={`${inputClass} flex-1`} />
                  <button onClick={handleSearch} disabled={kbSearching || !kbSearchQuery.trim()}
                    className="gradient-btn px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-1.5 disabled:opacity-50">
                    {kbSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  </button>
                </div>
                {kbSearchResults.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-400">Top {kbSearchResults.length} matching chunks:</p>
                    {kbSearchResults.map((result, i) => (
                      <div key={i} className="bg-white/5 border border-[#1e1e2e] rounded-xl p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-violet-400">Match #{i + 1}</span>
                          <span className="text-xs text-slate-500">Score: {result.score}</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{result.text}</p>
                      </div>
                    ))}
                  </div>
                )}
                {kbSearchResults.length === 0 && kbSearchQuery && !kbSearching && (
                  <p className="text-xs text-slate-600 text-center py-4">No matching chunks found. Try different keywords.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

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
            <p className="text-xs text-slate-500">Commands let users type a keyword to trigger a specific response. For example, type <code className="text-violet-400 bg-violet-500/10 px-1 rounded">/hours</code> → agent replies with your hours.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Trigger word</label>
                <input type="text" value={newTrigger} onChange={e => setNewTrigger(e.target.value)} placeholder="/hours"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#1e1e2e] text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Agent reply</label>
                <input type="text" value={newResponse} onChange={e => setNewResponse(e.target.value)} placeholder="We're open 9-5 Mon-Fri"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#1e1e2e] text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Description <span className="text-slate-600 font-normal">(shown in /help list)</span></label>
              <input type="text" value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Shows our business hours"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#1e1e2e] text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => {
                if (!newTrigger.trim() || !newResponse.trim()) return
                setCommands(prev => [...prev, { trigger: newTrigger.trim(), response: newResponse.trim(), description: newDescription.trim() }])
                setNewTrigger(''); setNewResponse(''); setNewDescription(''); setShowAddCommand(false)
              }} className="gradient-btn px-4 py-2 rounded-lg text-xs font-semibold">
                Save Command
              </button>
              <button onClick={() => setShowAddCommand(false)} className="px-3 py-2 rounded-lg text-xs font-semibold border border-[#1e1e2e] text-slate-400 hover:bg-white/5">Cancel</button>
            </div>
          </div>
        )}
        <div className="divide-y divide-[#1e1e2e]">
          {commands.length === 0 ? (
            <div className="p-8 text-center">
              <Terminal size={20} className="text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-600">No commands yet. Add your first command.</p>
            </div>
          ) : commands.map((cmd, i) => (
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

  const renderAgentIntegrations = () => {
    const intgList = [
      { id: 'telegram', name: 'Telegram', desc: 'Deploy as a Telegram bot', icon: '✈️' },
      { id: 'discord', name: 'Discord', desc: 'Engage your Discord community', icon: '🎮' },
      { id: 'sms', name: 'SMS / Twilio', desc: 'Send and receive SMS messages', icon: '📱' },
      { id: 'twitter', name: 'X / Twitter', desc: 'Auto-respond to mentions and DMs', icon: '🐦' },
    ]
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm text-slate-500">Channels connected to your account.</p>
          <button onClick={() => navigate('/dashboard/integrations')} className="text-xs text-violet-400 hover:text-violet-300 underline underline-offset-2 flex items-center gap-1">
            <Plug size={11} /> Manage Integrations
          </button>
        </div>
        {intgList.map(intg => {
          const rec = integrationRecords.find(r => r.type === intg.id)
          return (
            <div key={intg.id} className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-[#1e1e2e] flex items-center justify-center text-base">
                  {intg.icon}
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{intg.name}</p>
                  <p className="text-xs text-slate-500">{rec?.connected ? (rec.bot_info ? `@${rec.bot_info}` : 'Connected') : intg.desc}</p>
                </div>
              </div>
              {rec?.connected ? (
                <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-1 rounded-full">
                  <Check size={10} /> Live
                </span>
              ) : (
                <button onClick={() => navigate('/dashboard/integrations')} className="text-xs text-violet-400 hover:text-violet-300 px-2 py-1 border border-violet-500/20 rounded-lg hover:bg-violet-500/10 transition-colors">
                  Connect
                </button>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const copySnippet = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(''), 2000)
    }).catch(() => {})
  }

  const toggleEmbed = async () => {
    const token = getToken()
    if (!token || !agent) return
    setEmbedToggling(true)
    try {
      const res = await fetch(`/api/agents/${id}/embed`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ deployed_embed_enabled: !embedEnabled }),
      })
      if (res.ok) {
        const updated = await res.json()
        setEmbedEnabled(!!updated.deployed_embed_enabled)
        setAgent(updated)
      }
    } catch {}
    setEmbedToggling(false)
  }

  const renderDeploy = () => {
    const origin = window.location.origin
    const embedToken = agent?.embed_token || ''
    const scriptSnippet = `<script src="${origin}/embed.js" data-token="${embedToken}"><\/script>`
    const iframeSnippet = `<iframe src="${origin}/embed/${embedToken}" width="400" height="600" frameborder="0"><\/iframe>`
    const previewUrl = `/embed/${embedToken}`

    return (
      <div className="space-y-4">
        {/* Website Chat Widget */}
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-violet-400" />
              <h3 className="font-semibold text-white text-sm">Website Chat Widget</h3>
            </div>
            <button
              onClick={toggleEmbed}
              disabled={embedToggling}
              className="flex items-center gap-2 text-sm transition-colors"
            >
              {embedToggling ? (
                <Loader2 size={18} className="animate-spin text-violet-400" />
              ) : embedEnabled ? (
                <ToggleRight size={22} className="text-violet-400" />
              ) : (
                <ToggleLeft size={22} className="text-slate-500" />
              )}
              <span className={embedEnabled ? 'text-violet-400 font-medium' : 'text-slate-500'}>
                {embedEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Embed a floating chat widget on any website. Toggle to enable/disable public access.
          </p>

          {!embedEnabled && (
            <div className="text-center py-6 text-slate-600 text-sm">
              Enable the widget above to see embed snippets and preview.
            </div>
          )}

          {embedEnabled && (
            <div className="space-y-4">
              {/* Script snippet */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Floating Button (recommended)</p>
                  <button
                    onClick={() => copySnippet(scriptSnippet, 'script')}
                    className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    {copiedKey === 'script' ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy</>}
                  </button>
                </div>
                <pre className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-3 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                  {scriptSnippet}
                </pre>
              </div>

              {/* iFrame snippet */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Inline iFrame (alternative)</p>
                  <button
                    onClick={() => copySnippet(iframeSnippet, 'iframe')}
                    className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    {copiedKey === 'iframe' ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy</>}
                  </button>
                </div>
                <pre className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-3 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                  {iframeSnippet}
                </pre>
              </div>

              {/* Preview link */}
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                <ExternalLink size={12} /> Open preview in new tab
              </a>

              {/* Live preview */}
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Live Preview</p>
                <div className="rounded-xl overflow-hidden border border-[#1e1e2e]" style={{ height: '420px' }}>
                  <iframe
                    src={previewUrl}
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    title="Chat Widget Preview"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Memory/Users helpers ──────────────────────────────────────────────────
  const maskIdentifier = (id: string) => {
    if (!id || id.length <= 3) return '***'
    return id.slice(0, 3) + '***'
  }

  const channelBadgeClass = (ch: string) => {
    if (ch === 'telegram') return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    if (ch === 'sms') return 'bg-green-500/10 text-green-400 border-green-500/20'
    return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  const loadMemoryDetail = (memId: string) => {
    const token = getToken()
    if (!token || !agent) return
    setMemoryDetailLoading(true)
    setSelectedMemory(memId)
    fetch(`/api/agents/${agent.id}/memories/${memId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setMemoryDetail(d))
      .catch(() => {})
      .finally(() => setMemoryDetailLoading(false))
  }

  const deleteMemory = (memId: string) => {
    const token = getToken()
    if (!token || !agent) return
    fetch(`/api/agents/${agent.id}/memories/${memId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        setMemories(prev => prev.filter(m => m.id !== memId))
        setMemoriesTotal(prev => prev - 1)
        setSelectedMemory(null)
        setMemoryDetail(null)
        setDeleteMemConfirm(null)
      })
      .catch(() => {})
  }

  const clearAllMemories = () => {
    const token = getToken()
    if (!token || !agent) return
    fetch(`/api/agents/${agent.id}/memories`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        setMemories([])
        setMemoriesTotal(0)
        setSelectedMemory(null)
        setMemoryDetail(null)
        setClearAllConfirm(false)
      })
      .catch(() => {})
  }

  const renderUsers = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">User Memory</h2>
          <p className="text-xs text-slate-500 mt-0.5">{memoriesTotal} user{memoriesTotal !== 1 ? 's' : ''} remembered</p>
        </div>
        {memoriesTotal > 0 && (
          <button onClick={() => setClearAllConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-all">
            <Trash2 size={12} /> Clear All
          </button>
        )}
      </div>

      {clearAllConfirm && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-red-300">Delete ALL user memories for this agent? This cannot be undone.</p>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setClearAllConfirm(false)} className="px-3 py-1.5 rounded-lg border border-[#1e1e2e] text-slate-400 hover:bg-white/5 text-xs font-semibold">Cancel</button>
            <button onClick={clearAllMemories} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600">Delete All</button>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        {/* User list */}
        <div className={`bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden flex-1 min-w-0 ${selectedMemory ? 'hidden sm:block sm:max-w-sm' : 'w-full'}`}>
          {memoriesLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin text-violet-400" /></div>
          ) : memories.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-3">
                <Users size={20} className="text-violet-400" />
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">No users yet</h3>
              <p className="text-xs text-slate-500">Start a conversation on any channel to build user memory.</p>
            </div>
          ) : (
            <div>
              {memories.map((mem) => (
                <div key={mem.id} onClick={() => loadMemoryDetail(mem.id)}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-[#1e1e2e] cursor-pointer hover:bg-white/5 transition-all ${selectedMemory === mem.id ? 'bg-violet-500/10' : ''}`}>
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <User size={14} className="text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white truncate">{mem.name || maskIdentifier(mem.user_identifier)}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${channelBadgeClass(mem.channel)} capitalize`}>{mem.channel}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-500">{mem.message_count} msg{mem.message_count !== 1 ? 's' : ''}</span>
                      <span className="text-xs text-slate-600">{relativeTime(mem.last_seen)}</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedMemory && (
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl flex-1 min-w-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2e]">
              <h3 className="font-semibold text-white text-sm">User Details</h3>
              <button onClick={() => { setSelectedMemory(null); setMemoryDetail(null) }}
                className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-slate-500 hover:text-white">
                <X size={14} />
              </button>
            </div>
            {memoryDetailLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin text-violet-400" /></div>
            ) : memoryDetail ? (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Identifier</p>
                    <p className="text-sm font-semibold text-white">{maskIdentifier(memoryDetail.user_identifier)}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Channel</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${channelBadgeClass(memoryDetail.channel)} capitalize`}>{memoryDetail.channel}</span>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Messages</p>
                    <p className="text-sm font-semibold text-white">{memoryDetail.message_count}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Last seen</p>
                    <p className="text-sm font-semibold text-white">{relativeTime(memoryDetail.last_seen)}</p>
                  </div>
                </div>

                {/* Facts */}
                <div className="bg-white/5 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Extracted Facts</h4>
                  {memoryDetail.facts?.name && (
                    <div><span className="text-xs text-slate-500">Name: </span><span className="text-sm text-white">{memoryDetail.facts.name}</span></div>
                  )}
                  {memoryDetail.facts?.preferences?.length > 0 && (
                    <div><span className="text-xs text-slate-500">Preferences: </span><span className="text-sm text-white">{memoryDetail.facts.preferences.join(', ')}</span></div>
                  )}
                  {memoryDetail.facts?.past_issues?.length > 0 && (
                    <div><span className="text-xs text-slate-500">Past issues: </span><span className="text-sm text-white">{memoryDetail.facts.past_issues.join(', ')}</span></div>
                  )}
                  {Object.entries(memoryDetail.facts?.custom || {}).map(([k, v]) => (
                    <div key={k}><span className="text-xs text-slate-500">{k}: </span><span className="text-sm text-white">{String(v)}</span></div>
                  ))}
                  {!memoryDetail.facts?.name && !memoryDetail.facts?.preferences?.length && !memoryDetail.facts?.past_issues?.length && Object.keys(memoryDetail.facts?.custom || {}).length === 0 && (
                    <p className="text-xs text-slate-600">No facts extracted yet (needs 5+ messages).</p>
                  )}
                </div>

                {/* Summary */}
                {memoryDetail.summary && (
                  <div className="bg-white/5 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Summary</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">{memoryDetail.summary}</p>
                  </div>
                )}

                {/* Dates */}
                <div className="text-xs text-slate-600 space-y-1">
                  <p>First seen: {new Date(memoryDetail.first_seen).toLocaleDateString()}</p>
                  <p>Last seen: {new Date(memoryDetail.last_seen).toLocaleDateString()}</p>
                </div>

                {/* Delete */}
                {deleteMemConfirm === memoryDetail.id ? (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-red-300">Delete this user's memory?</p>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteMemConfirm(null)} className="px-2 py-1 rounded border border-[#1e1e2e] text-slate-400 text-xs">Cancel</button>
                      <button onClick={() => deleteMemory(memoryDetail.id)} className="px-2 py-1 rounded bg-red-500 text-white text-xs">Delete</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setDeleteMemConfirm(memoryDetail.id)}
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
                    <Trash2 size={12} /> Delete memory
                  </button>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )

  const renderAnalytics = () => {
    const totalMessages = metrics.reduce((s, m) => s + (m.messages_sent || 0), 0)
    const avgResponse = metrics.length > 0
      ? Math.round(metrics.reduce((s, m) => s + (m.avg_response_ms || 0), 0) / metrics.filter(m => m.avg_response_ms > 0).length || 0)
      : 0
    const avgSatisfaction = metrics.length > 0
      ? (metrics.reduce((s, m) => s + (m.satisfaction_score || 0), 0) / metrics.filter(m => m.satisfaction_score > 0).length || 0).toFixed(1)
      : '—'
    const maxMessages = Math.max(...metrics.map(m => m.messages_sent || 0), 1)

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2"><BarChart2 size={16} className="text-violet-400" /> Analytics</h2>
          <p className="text-xs text-slate-500 mt-0.5">Last 30 days of activity</p>
        </div>

        {metricsLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-violet-400" /></div>
        ) : metrics.length === 0 ? (
          <div className="bg-[#111118] border border-dashed border-[#1e1e2e] rounded-xl p-16 text-center">
            <BarChart2 size={28} className="text-slate-700 mx-auto mb-3" />
            <p className="font-semibold text-slate-400 mb-1">No data yet</p>
            <p className="text-sm text-slate-600">Start chatting with your agent to see metrics here.</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Messages', value: totalMessages.toLocaleString(), color: 'text-violet-400', border: 'border-violet-500/20', bg: 'bg-violet-500/10' },
                { label: 'Avg Response', value: avgResponse > 0 ? `${(avgResponse / 1000).toFixed(1)}s` : '—', color: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/10' },
                { label: 'Satisfaction', value: avgSatisfaction, color: 'text-green-400', border: 'border-green-500/20', bg: 'bg-green-500/10' },
              ].map(stat => (
                <div key={stat.label} className={`bg-[#111118] border ${stat.border} rounded-xl p-4`}>
                  <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                    <Activity size={14} className={stat.color} />
                  </div>
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Bar chart */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Daily Messages</h3>
              <div className="flex items-end gap-1 h-32">
                {[...metrics].reverse().slice(0, 30).map((m, i) => {
                  const height = Math.max((m.messages_sent / maxMessages) * 100, m.messages_sent > 0 ? 8 : 2)
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div
                        className="w-full rounded-t-sm bg-violet-500/50 hover:bg-violet-500 transition-colors"
                        style={{ height: `${height}%` }}
                        title={`${m.date}: ${m.messages_sent} messages`}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-slate-600">
                <span>{metrics.length > 0 ? [...metrics].reverse()[metrics.length - 1]?.date?.slice(5) : ''}</span>
                <span>Today</span>
              </div>
            </div>

            {/* Daily table */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e2e]">
                    <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Date</th>
                    <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Messages</th>
                    <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Avg Response</th>
                    <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Satisfaction</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.slice(0, 10).map((m, i) => (
                    <tr key={i} className="border-b border-[#1e1e2e] last:border-0 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-white font-mono text-xs">{m.date}</td>
                      <td className="px-4 py-3 text-right text-violet-400 font-semibold">{m.messages_sent}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{m.avg_response_ms > 0 ? `${(m.avg_response_ms / 1000).toFixed(1)}s` : '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{m.satisfaction_score > 0 ? m.satisfaction_score.toFixed(1) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    )
  }

  const renderSettings = () => {
    const BUILT_IN_TOOLS = [
      { name: 'get_current_time', label: 'Current Time', desc: 'Agent knows the current date/time and can share it.' },
      { name: 'calculate', label: 'Calculator', desc: 'Agent can perform math calculations on request.' },
      { name: 'search_knowledge_base', label: 'Knowledge Search', desc: 'Agent explicitly searches its knowledge base mid-conversation.' },
      { name: 'create_lead', label: 'Lead Capture', desc: 'Agent saves user contact info (name/email/phone) to your CRM automatically.' },
      { name: 'send_notification', label: 'Owner Notifications', desc: 'Agent flags important messages to you via the Activity feed.' },
    ]
    const toggleTool = (name: string) => {
      setCapToolsEnabled(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name])
    }
    return (
    <div className="space-y-5">
      {/* Always-On */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <RefreshCw size={14} className="text-violet-400" /> Always-On Mode
            </h3>
            <p className="text-xs text-slate-500 mt-1">When enabled, the agent runs a periodic heartbeat to stay active and process queued messages automatically.</p>
          </div>
          <button onClick={toggleAlwaysOn} disabled={alwaysOnToggling}
            className="ml-4 flex items-center gap-2 text-sm transition-colors flex-shrink-0">
            {alwaysOnToggling ? (
              <Loader2 size={22} className="animate-spin text-violet-400" />
            ) : alwaysOn ? (
              <ToggleRight size={28} className="text-violet-400" />
            ) : (
              <ToggleLeft size={28} className="text-slate-500" />
            )}
            <span className={alwaysOn ? 'text-violet-400 font-semibold text-sm' : 'text-slate-500 text-sm'}>
              {alwaysOn ? 'On' : 'Off'}
            </span>
          </button>
        </div>
      </div>

      {/* Basic info */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-white text-sm flex items-center gap-2"><Settings size={14} className="text-violet-400" /> Agent Info</h3>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Name</label>
          <input value={settingsName} onChange={e => setSettingsName(e.target.value)} className={inputClass} placeholder="Agent name" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Description</label>
          <input value={settingsDesc} onChange={e => setSettingsDesc(e.target.value)} className={inputClass} placeholder="Short description" />
        </div>
        <button onClick={handleSaveSettings} disabled={settingsSaving}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm transition-all ${settingsSaved ? 'bg-green-500 text-white' : 'gradient-btn'}`}>
          {settingsSaving ? <Loader2 size={14} className="animate-spin" /> : settingsSaved ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save Changes</>}
        </button>
      </div>

      {/* ── New Capabilities ─────────────────────────────────────────── */}

      {/* Tools */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-white text-sm flex items-center gap-2">
          <Settings size={14} className="text-violet-400" /> Agent Tools
        </h3>
        <p className="text-xs text-slate-500">Enable built-in tools your agent can use during conversations.</p>
        <div className="space-y-3">
          {BUILT_IN_TOOLS.map(tool => (
            <div key={tool.name} className="flex items-start gap-3">
              <button onClick={() => toggleTool(tool.name)}
                className={`mt-0.5 flex-shrink-0 w-10 h-5 rounded-full transition-colors ${capToolsEnabled.includes(tool.name) ? 'bg-violet-500' : 'bg-white/10'} relative`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${capToolsEnabled.includes(tool.name) ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <div>
                <span className="text-sm text-white font-medium">{tool.label}</span>
                <p className="text-xs text-slate-500 mt-0.5">{tool.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <Globe size={14} className="text-violet-400" /> Auto-Translate
            </h3>
            <p className="text-xs text-slate-500 mt-1">Agent detects user language and responds in the same language automatically.</p>
          </div>
          <button onClick={() => setCapAutoTranslate(v => !v)} className="ml-4 flex-shrink-0">
            {capAutoTranslate ? <ToggleRight size={28} className="text-violet-400" /> : <ToggleLeft size={28} className="text-slate-500" />}
          </button>
        </div>
      </div>

      {/* Proactive Follow-up */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <MessageSquare size={14} className="text-violet-400" /> Proactive Follow-up
            </h3>
            <p className="text-xs text-slate-500 mt-1">Automatically follow up with users who haven't responded.</p>
          </div>
          <button onClick={() => setCapFollowupEnabled(v => !v)} className="ml-4 flex-shrink-0">
            {capFollowupEnabled ? <ToggleRight size={28} className="text-violet-400" /> : <ToggleLeft size={28} className="text-slate-500" />}
          </button>
        </div>
        {capFollowupEnabled && (
          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Follow-up after</label>
              <select value={capFollowupDelayHours} onChange={e => setCapFollowupDelayHours(Number(e.target.value))}
                className={inputClass + ' cursor-pointer'}>
                <option value={1}>1 hour</option>
                <option value={6}>6 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Follow-up message</label>
              <textarea value={capFollowupMessage} onChange={e => setCapFollowupMessage(e.target.value)} rows={2}
                className={inputClass} placeholder="Hey! Just checking in — is there anything else I can help you with?" />
            </div>
          </div>
        )}
      </div>

      {/* Escalation */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-400" /> Escalation on Negative Sentiment
            </h3>
            <p className="text-xs text-slate-500 mt-1">Flag angry, frustrated, or urgent messages in the Activity feed for your review.</p>
          </div>
          <button onClick={() => setCapEscalateOnNeg(v => !v)} className="ml-4 flex-shrink-0">
            {capEscalateOnNeg ? <ToggleRight size={28} className="text-amber-400" /> : <ToggleLeft size={28} className="text-slate-500" />}
          </button>
        </div>
        {capEscalateOnNeg && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Notify via</label>
            <select value={capEscalationNotify} onChange={e => setCapEscalationNotify(e.target.value)}
              className={inputClass + ' cursor-pointer'}>
              <option value="inapp">In-app only (Activity feed)</option>
              <option value="telegram">Telegram + In-app</option>
            </select>
          </div>
        )}
      </div>

      {/* Save capabilities */}
      <div className="flex justify-end">
        <button onClick={handleSaveCapabilities} disabled={capSaving}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm transition-all ${capSaved ? 'bg-green-500 text-white' : 'gradient-btn'}`}>
          {capSaving ? <Loader2 size={14} className="animate-spin" /> : capSaved ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save Capabilities</>}
        </button>
      </div>

      {/* Danger zone */}
      <div className="bg-[#111118] border border-red-500/20 rounded-xl p-5">
        <h3 className="font-semibold text-red-400 text-sm mb-1 flex items-center gap-2"><AlertCircle size={14} /> Danger Zone</h3>
        <p className="text-xs text-slate-500 mb-4">Permanently delete this agent and all its data. This cannot be undone.</p>
        {agentDeleteConfirm ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-red-300 flex-1">Are you absolutely sure?</p>
            <button onClick={() => setAgentDeleteConfirm(false)} className="px-3 py-1.5 rounded-lg border border-[#1e1e2e] text-slate-400 text-xs font-semibold hover:bg-white/5">Cancel</button>
            <button onClick={handleDeleteAgent} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600">Delete Agent</button>
          </div>
        ) : (
          <button onClick={() => setAgentDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 text-sm font-semibold transition-all">
            <Trash2 size={14} /> Delete Agent
          </button>
        )}
      </div>
    </div>
    )
  }

  const renderEmptyTab = (tab: string) => (
    <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
        {tab === 'analytics' ? <BarChart2 size={24} className="text-violet-400" /> : <Settings size={24} className="text-violet-400" />}
      </div>
      <h3 className="text-base font-bold text-white mb-2">{tab === 'analytics' ? 'Analytics Coming Soon' : 'Settings'}</h3>
      <p className="text-slate-500 text-sm max-w-xs mx-auto">{tab === 'analytics' ? 'Detailed per-agent analytics will be available here soon.' : 'Advanced agent settings will appear here.'}</p>
    </div>
  )

  const tabContent: Record<string, () => JSX.Element> = {
    overview: renderOverview, chat: renderChat, users: renderUsers, personality: renderPersonality, knowledge: renderKnowledge,
    commands: renderCommands, integrations: renderAgentIntegrations,
    deploy: renderDeploy,
    analytics: renderAnalytics, settings: renderSettings,
  }

  if (agentLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 size={28} className="animate-spin text-violet-400" />
        </div>
      </DashboardLayout>
    )
  }

  if (notFound || !agent) {
    return (
      <DashboardLayout>
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-16 text-center">
          <Bot size={32} className="text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-2">Agent not found</h3>
          <p className="text-slate-500 text-sm mb-5">This agent doesn't exist or you don't have access.</p>
          <button onClick={() => navigate('/dashboard/agents')} className="gradient-btn px-5 py-2 rounded-xl font-semibold text-sm">
            Back to Agents
          </button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {/* Agent Header */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 mb-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 text-2xl">
            {agent.emoji || '🤖'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-white">{agent.name}</h1>
              <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                agent.is_active ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
              }`}>
                <Circle size={5} className={agent.is_active ? 'fill-green-400' : 'fill-slate-400'} />
                {agent.is_active ? 'Active' : 'Paused'}
              </span>
            </div>
            <p className="text-slate-500 text-sm mb-2">{agent.description || 'Custom Agent'} · {agent.model}</p>
            <div className="flex items-center gap-4 flex-wrap text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><MessageSquare size={13} className="text-violet-400" /> {(agent.total_messages || 0).toLocaleString()} messages</span>
              <button onClick={toggleAlwaysOn} disabled={alwaysOnToggling}
                title="Always-On Mode"
                className="flex items-center gap-1 text-xs transition-colors hover:opacity-80">
                {alwaysOnToggling ? <Loader2 size={14} className="animate-spin text-violet-400" /> :
                  alwaysOn ? <ToggleRight size={18} className="text-violet-400" /> : <ToggleLeft size={18} className="text-slate-500" />}
                <span className={alwaysOn ? 'text-violet-400' : 'text-slate-500'}>Always-On</span>
              </button>
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
        {TABS.map(({ id: tabId, label, icon: Icon }) => (
          <button key={tabId} onClick={() => setActiveTab(tabId)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tabId ? 'gradient-btn' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
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


