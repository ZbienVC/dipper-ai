import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { Plus, Search, MessageSquare, Circle, Edit3, Bot, Headphones, TrendingUp, User, Sparkles, ArrowRight } from 'lucide-react'

interface Agent {
  id: string
  name: string
  status: string
  messages: number
  template?: string
  channels: string[]
  description?: string
}

type Filter = 'All' | 'Active' | 'Paused' | 'Draft'
const FILTERS: Filter[] = ['All', 'Active', 'Paused', 'Draft']

const AGENT_TEMPLATES = [
  {
    id: 'customer-support',
    name: 'Customer Support Bot',
    desc: 'Handles FAQs, resolves tickets, and escalates issues 24/7 with patience and accuracy.',
    icon: Headphones,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    systemPrompt: 'You are a professional and empathetic customer support agent. You resolve issues quickly, acknowledge frustration with patience, and always aim to leave the customer satisfied. Escalate complex issues gracefully.',
    adjectives: ['Helpful', 'Patient', 'Professional'],
    tone: 'Empathetic',
    commStyle: 'Professional',
  },
  {
    id: 'sales-bot',
    name: 'Sales Agent',
    desc: 'Qualifies leads, handles objections, and guides prospects toward a decision without being pushy.',
    icon: TrendingUp,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
    systemPrompt: 'You are a skilled sales agent. You ask thoughtful discovery questions, listen actively, and understand the prospect\'s real needs before presenting solutions. You handle objections with empathy and close conversations with clear next steps.',
    adjectives: ['Persuasive', 'Confident', 'Empathetic'],
    tone: 'Assertive',
    commStyle: 'Professional',
  },
  {
    id: 'personal-assistant',
    name: 'Personal Assistant',
    desc: 'Manages tasks, answers questions, drafts content, and keeps your day on track.',
    icon: User,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    systemPrompt: 'You are a highly capable personal assistant. You help with scheduling, research, writing, and organizing information. You are concise, proactive, and always one step ahead. You anticipate needs and deliver results quickly.',
    adjectives: ['Organized', 'Proactive', 'Detail-oriented'],
    tone: 'Friendly',
    commStyle: 'Casual & Friendly',
  },
]

export default function Agents() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('All')
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = (() => {
      try {
        const u = JSON.parse(localStorage.getItem('dipperai_user') || '{}')
        return u.token
      } catch { return null }
    })()
    if (!token) {
      setLoading(false)
      return
    }
    fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAgents(data.map((a: any) => ({
          id: a.id, name: a.name, status: a.is_active ? 'active' : 'paused',
          messages: a.total_messages || 0, channels: [], description: a.description,
        })))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = agents.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || (a.template || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'All' || a.status.toLowerCase() === filter.toLowerCase()
    return matchSearch && matchFilter
  })

  return (
    <DashboardLayout title="My Agents">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">My Agents</h1>
          <p className="text-slate-500 mt-0.5 text-sm">{agents.length} agents in your workspace</p>
        </div>
        <button
          onClick={() => navigate('/dashboard/agents/new')}
          className="gradient-btn flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm"
        >
          <Plus size={15} /> New Agent
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white/5 border border-[#1e1e2e] rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-slate-300 placeholder-slate-600 transition-all"
          />
        </div>
        <div className="flex gap-1 bg-[#111118] border border-[#1e1e2e] rounded-xl p-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 && search ? (
        <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <Bot size={28} className="text-violet-400" />
          </div>
          <h3 className="text-base font-bold text-white mb-2">No agents found</h3>
          <p className="text-slate-500 text-sm mb-5">No agents match "{search}"</p>
          <button
            onClick={() => navigate('/dashboard/agents/new')}
            className="gradient-btn px-5 py-2 rounded-xl font-semibold text-sm inline-flex items-center gap-2"
          >
            <Plus size={14} /> Create Agent
          </button>
        </div>
      ) : filtered.length === 0 && agents.length === 0 ? (
        /* ── ONBOARDING EMPTY STATE ── */
        <div className="space-y-6">
          {/* Hero banner */}
          <div className="bg-gradient-to-br from-violet-600/20 via-violet-500/10 to-transparent border border-violet-500/20 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={30} className="text-violet-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Build your first AI agent</h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
              Choose a template below to get started in seconds — or build from scratch. Your agent will be live and ready to chat in minutes.
            </p>
          </div>

          {/* Template cards */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Start with a template</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {AGENT_TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => navigate('/dashboard/agents/new', { state: { template: tpl } })}
                  className="group text-left bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 hover:border-violet-500/40 hover:bg-violet-500/[0.04] transition-all"
                >
                  <div className={`w-11 h-11 rounded-xl ${tpl.bg} border ${tpl.border} flex items-center justify-center mb-4`}>
                    <tpl.icon size={20} className={tpl.color} />
                  </div>
                  <h3 className="font-bold text-white text-sm mb-1">{tpl.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">{tpl.desc}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 group-hover:text-violet-300 transition-colors">
                    Use template <ArrowRight size={12} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom / blank */}
          <button
            onClick={() => navigate('/dashboard/agents/new')}
            className="w-full border border-dashed border-[#1e1e2e] rounded-xl p-4 flex items-center justify-center gap-2 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group"
          >
            <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-violet-500/10 flex items-center justify-center transition-colors">
              <Plus size={16} className="text-slate-600 group-hover:text-violet-400" />
            </div>
            <span className="text-sm font-semibold text-slate-600 group-hover:text-violet-400 transition-colors">Start from scratch</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(agent => (
            <div
              key={agent.id}
              className="group bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 hover:border-violet-500/30 hover:bg-violet-500/[0.03] transition-all cursor-pointer"
              onClick={() => navigate(`/dashboard/agents/${agent.id}`)}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Bot size={18} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-sm truncate">{agent.name}</h3>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{agent.template || agent.description || 'Custom Agent'}</p>
                </div>
                <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  agent.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                }`}>
                  <Circle size={5} className={agent.status === 'active' ? 'fill-green-400' : 'fill-slate-400'} />
                  {agent.status}
                </span>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-1.5 flex-wrap">
                  {(agent.channels || []).map(c => (
                    <span key={c} className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full">{c}</span>
                  ))}
                  {(!agent.channels || agent.channels.length === 0) && (
                    <span className="text-xs text-slate-600">No channels</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-600">
                  <MessageSquare size={11} />
                  <span>{agent.messages}</span>
                </div>
              </div>

              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => navigate(`/dashboard/agents/${agent.id}?tab=chat`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold gradient-btn"
                >
                  <MessageSquare size={12} /> Chat
                </button>
                <button
                  onClick={() => navigate(`/dashboard/agents/${agent.id}?tab=personality`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border border-[#1e1e2e] text-slate-400 hover:bg-white/5"
                >
                  <Edit3 size={12} /> Edit
                </button>
              </div>
            </div>
          ))}

          {/* Create new */}
          <button
            onClick={() => navigate('/dashboard/agents/new')}
            className="border border-dashed border-[#1e1e2e] rounded-xl p-5 flex flex-col items-center justify-center gap-2 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group min-h-[160px]"
          >
            <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-violet-500/10 flex items-center justify-center transition-colors">
              <Plus size={20} className="text-slate-600 group-hover:text-violet-400" />
            </div>
            <span className="text-xs font-semibold text-slate-600 group-hover:text-violet-400 transition-colors">Create New Agent</span>
          </button>
        </div>
      )}
    </DashboardLayout>
  )
}
