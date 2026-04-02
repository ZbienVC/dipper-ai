import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { Plus, Search, MessageSquare, Circle, Edit3, Bot, Headphones, TrendingUp, User, Sparkles, ArrowRight, LayoutGrid, List, Trash2, Pause, Play, Zap } from 'lucide-react'
import UpgradeModal from '../components/UpgradeModal'

interface Agent {
  id: string
  name: string
  status: 'active' | 'paused'
  model: string
  channels: string[]
  description?: string
  emoji?: string
  total_messages: number
  messages_today?: number
  last_active?: string
  always_on?: boolean
}

type SortOption = 'most_active' | 'recently_created' | 'alphabetical'
type FilterStatus = 'All' | 'Active' | 'Paused'
type ViewMode = 'grid' | 'list'

const AGENT_TEMPLATES = [
  {
    id: 'customer-support',
    name: 'Customer Support Bot',
    desc: 'Handles FAQs, resolves tickets, and escalates issues 24/7.',
    emoji: '🎧',
    color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20',
    systemPrompt: 'You are a professional and empathetic customer support agent.',
    tone: 'Empathetic',
    commStyle: 'Professional',
  },
  {
    id: 'sales-bot',
    name: 'Sales Agent',
    desc: 'Qualifies leads, handles objections, guides prospects toward a decision.',
    emoji: '💼',
    color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20',
    systemPrompt: 'You are a skilled sales agent. Ask thoughtful discovery questions.',
    tone: 'Assertive',
    commStyle: 'Professional',
  },
  {
    id: 'personal-assistant',
    name: 'Personal Assistant',
    desc: 'Manages tasks, answers questions, drafts content, keeps your day on track.',
    emoji: '✨',
    color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20',
    systemPrompt: 'You are a highly capable personal assistant.',
    tone: 'Friendly',
    commStyle: 'Casual & Friendly',
  },
]

function modelBadge(model: string) {
  if (!model) return null
  const m = model.toLowerCase()
  if (m.includes('claude')) return { label: 'Claude', cls: 'bg-violet-500/20 text-violet-400 border-violet-500/30' }
  if (m.includes('gpt')) return { label: 'GPT-4', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
  if (m.includes('gemini')) return { label: 'Gemini', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
  return { label: model.split('-')[0], cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }
}

function timeAgo(iso?: string) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function Agents() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All')
  const [sort, setSort] = useState<SortOption>('most_active')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const getToken = () => {
    try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
  }

  useEffect(() => {
    const token = getToken()
    if (!token) { setLoading(false); return }
    fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAgents(data.map((a: any) => ({
          id: a.id, name: a.name, status: a.is_active ? 'active' : 'paused',
          model: a.model || '', channels: a.channels || [],
          description: a.description, emoji: a.emoji,
          total_messages: a.total_messages || 0,
          messages_today: a.messages_today || 0,
          last_active: a.last_active,
          always_on: !!a.always_on,
        })))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (agentId: string) => {
    const token = getToken()
    if (!token) return
    await fetch(`/api/agents/${agentId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    setAgents(prev => prev.filter(a => a.id !== agentId))
    setDeleteConfirm(null)
  }

  const handleTogglePause = async (agent: Agent) => {
    const token = getToken()
    if (!token) return
    const newStatus = agent.status === 'active' ? false : true
    await fetch(`/api/agents/${agent.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isActive: newStatus }),
    }).catch(() => {})
    setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: newStatus ? 'active' : 'paused' } : a))
  }

  let filtered = agents.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || (a.description || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'All' || a.status === filterStatus.toLowerCase()
    return matchSearch && matchStatus
  })

  if (sort === 'most_active') filtered = [...filtered].sort((a, b) => b.total_messages - a.total_messages)
  else if (sort === 'alphabetical') filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name))

  const activeCount = agents.filter(a => a.status === 'active').length

  return (
    <DashboardLayout title="My Agents">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">My Agents</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            {activeCount} active · {agents.length} total
          </p>
        </div>
        <button onClick={() => navigate('/dashboard/agents/new')}
          className="gradient-btn flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm">
          <Plus size={15} /> New Agent
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white/5 border border-[#1e1e2e] rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-slate-300 placeholder-slate-600 transition-all" />
        </div>
        {/* Status filter */}
        <div className="flex gap-1 bg-[#111118] border border-[#1e1e2e] rounded-xl p-1">
          {(['All', 'Active', 'Paused'] as FilterStatus[]).map(f => (
            <button key={f} onClick={() => setFilterStatus(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterStatus === f ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              {f}
            </button>
          ))}
        </div>
        {/* Sort */}
        <select value={sort} onChange={e => setSort(e.target.value as SortOption)}
          className="px-3 py-2 text-xs bg-[#111118] border border-[#1e1e2e] rounded-xl text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50">
          <option value="most_active">Most Active</option>
          <option value="recently_created">Recently Created</option>
          <option value="alphabetical">Alphabetical</option>
        </select>
        {/* View toggle */}
        <div className="flex gap-1 bg-[#111118] border border-[#1e1e2e] rounded-xl p-1">
          <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-white'}`}>
            <LayoutGrid size={14} />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-white'}`}>
            <List size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : agents.length === 0 ? (
        /* Empty state */
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-violet-600/20 via-violet-500/10 to-transparent border border-violet-500/20 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={30} className="text-violet-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Build your first AI agent</h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
              Choose a template to get started in seconds — or build from scratch. Your agent will be live and ready in minutes.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Start with a template</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {AGENT_TEMPLATES.map(tpl => (
                <button key={tpl.id} onClick={() => navigate('/dashboard/agents/new', { state: { template: tpl } })}
                  className="group text-left bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 hover:border-violet-500/40 hover:bg-violet-500/[0.04] transition-all">
                  <div className="text-3xl mb-3">{tpl.emoji}</div>
                  <h3 className="font-bold text-white text-sm mb-1">{tpl.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">{tpl.desc}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 group-hover:text-violet-300 transition-colors">
                    Use template <ArrowRight size={12} />
                  </span>
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => navigate('/dashboard/agents/new')}
            className="w-full border border-dashed border-[#1e1e2e] rounded-xl p-4 flex items-center justify-center gap-2 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group">
            <Plus size={16} className="text-slate-600 group-hover:text-violet-400 transition-colors" />
            <span className="text-sm font-semibold text-slate-600 group-hover:text-violet-400 transition-colors">Start from scratch</span>
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-12 text-center">
          <Bot size={28} className="text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-2">No agents found</h3>
          <p className="text-slate-500 text-sm mb-5">Try adjusting your search or filters.</p>
          <button onClick={() => { setSearch(''); setFilterStatus('All') }}
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors">Clear filters</button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(agent => {
            const badge = modelBadge(agent.model)
            return (
              <div key={agent.id}
                className={`group bg-[#111118] border rounded-xl p-5 hover:border-violet-500/30 hover:bg-violet-500/[0.03] transition-all cursor-pointer relative ${agent.always_on ? 'border-violet-500/30 shadow-[0_0_20px_rgba(139,92,246,0.08)]' : 'border-[#1e1e2e]'}`}
                onClick={() => navigate(`/dashboard/agents/${agent.id}`)}>
                {/* Always-on glow indicator */}
                {agent.always_on && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                    <Zap size={10} className="fill-violet-400" /> Always-on
                  </div>
                )}

                <div className="flex items-start gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 text-xl">
                    {agent.emoji || <Bot size={18} className="text-violet-400" />}
                  </div>
                  <div className="flex-1 min-w-0 pr-16">
                    <h3 className="font-semibold text-white text-sm truncate mb-1">{agent.name}</h3>
                    <p className="text-xs text-slate-500 truncate">{agent.description || 'Custom Agent'}</p>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${agent.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                    <Circle size={5} className={agent.status === 'active' ? 'fill-green-400' : 'fill-slate-400'} />
                    {agent.status === 'active' ? 'Active' : 'Paused'}
                  </span>
                  {badge && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
                  )}
                  {(agent.channels || []).map(c => (
                    <span key={c} className="text-xs bg-white/5 text-slate-500 border border-[#1e1e2e] px-2 py-0.5 rounded-full capitalize">{c}</span>
                  ))}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                  <span className="flex items-center gap-1"><MessageSquare size={11} /> {(agent.messages_today || 0)} today</span>
                  <span>{agent.total_messages.toLocaleString()} total</span>
                  <span>Last: {timeAgo(agent.last_active)}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => navigate(`/dashboard/agents/${agent.id}?tab=chat`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold gradient-btn">
                    <MessageSquare size={12} /> Chat
                  </button>
                  <button onClick={() => navigate(`/dashboard/agents/${agent.id}?tab=personality`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border border-[#1e1e2e] text-slate-400 hover:bg-white/5">
                    <Edit3 size={12} /> Edit
                  </button>
                  <button onClick={() => handleTogglePause(agent)}
                    className="p-1.5 rounded-lg border border-[#1e1e2e] text-slate-500 hover:bg-white/5 hover:text-white transition-all">
                    {agent.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                  </button>
                  {deleteConfirm === agent.id ? (
                    <button onClick={() => handleDelete(agent.id)}
                      className="p-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all text-xs font-semibold px-2">
                      Confirm
                    </button>
                  ) : (
                    <button onClick={() => setDeleteConfirm(agent.id)}
                      className="p-1.5 rounded-lg border border-[#1e1e2e] text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {/* Create new card */}
          <button onClick={() => navigate('/dashboard/agents/new')}
            className="border border-dashed border-[#1e1e2e] rounded-xl p-5 flex flex-col items-center justify-center gap-2 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group min-h-[200px]">
            <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-violet-500/10 flex items-center justify-center transition-colors">
              <Plus size={20} className="text-slate-600 group-hover:text-violet-400" />
            </div>
            <span className="text-xs font-semibold text-slate-600 group-hover:text-violet-400 transition-colors">Create New Agent</span>
          </button>
        </div>
      ) : (
        /* List view */
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 border-b border-[#1e1e2e] text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <span>Agent</span><span></span><span>Model</span><span>Messages</span><span>Last Active</span><span>Actions</span>
          </div>
          {filtered.map(agent => {
            const badge = modelBadge(agent.model)
            return (
              <div key={agent.id} className="flex items-center gap-4 px-4 py-3.5 border-b border-[#1e1e2e] hover:bg-white/5 transition-all cursor-pointer"
                onClick={() => navigate(`/dashboard/agents/${agent.id}`)}>
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 text-lg">
                  {agent.emoji || <Bot size={16} className="text-violet-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm truncate">{agent.name}</span>
                    <span className={`flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${agent.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                      <Circle size={4} className={agent.status === 'active' ? 'fill-green-400' : 'fill-slate-400'} />
                      {agent.status === 'active' ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{agent.description || 'Custom Agent'}</p>
                </div>
                {badge && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${badge.cls}`}>{badge.label}</span>}
                <span className="text-sm text-slate-300 font-medium flex-shrink-0 w-24 text-right">{agent.total_messages.toLocaleString()}</span>
                <span className="text-xs text-slate-500 flex-shrink-0 w-20 text-right">{timeAgo(agent.last_active)}</span>
                <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => navigate(`/dashboard/agents/${agent.id}?tab=chat`)} className="p-1.5 rounded-lg gradient-btn"><MessageSquare size={13} /></button>
                  <button onClick={() => navigate(`/dashboard/agents/${agent.id}`)} className="p-1.5 rounded-lg border border-[#1e1e2e] text-slate-400 hover:bg-white/5"><Edit3 size={13} /></button>
                  <button onClick={() => handleTogglePause(agent)} className="p-1.5 rounded-lg border border-[#1e1e2e] text-slate-400 hover:bg-white/5">
                    {agent.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </DashboardLayout>
  )
}