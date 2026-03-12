import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { Plus, Search, MessageSquare, Circle, Edit3 } from 'lucide-react'

const ALL_AGENTS = [
  { id: '1', name: 'Support Pro', emoji: '🎧', status: 'active', messages: 412, template: 'Customer Support Bot', channels: ['SMS', 'Telegram'] },
  { id: '2', name: 'The Closer', emoji: '💼', status: 'active', messages: 289, template: 'Sales Follow-up Agent', channels: ['SMS', 'X'] },
  { id: '3', name: 'Community Bob', emoji: '🌐', status: 'paused', messages: 146, template: 'Telegram Community Manager', channels: ['Telegram', 'Discord'] },
]

type Filter = 'All' | 'Active' | 'Paused' | 'Draft'
const FILTERS: Filter[] = ['All', 'Active', 'Paused', 'Draft']

export default function Agents() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('All')

  const filtered = ALL_AGENTS.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.template.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'All' || a.status.toLowerCase() === filter.toLowerCase()
    return matchSearch && matchFilter
  })

  return (
    <DashboardLayout title="My Agents">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">My Agents</h1>
          <p className="text-gray-500 mt-1">{ALL_AGENTS.length} agents in your workspace</p>
        </div>
        <button
          onClick={() => navigate('/dashboard/agents/new')}
          className="gradient-btn flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm"
        >
          <Plus size={16} /> New Agent
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="text-5xl mb-4">🤖</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No agents found</h3>
          <p className="text-gray-500 text-sm mb-6">
            {search ? `No agents match "${search}"` : 'Create your first agent to get started.'}
          </p>
          <button
            onClick={() => navigate('/dashboard/agents/new')}
            className="gradient-btn px-6 py-2.5 rounded-xl font-semibold text-sm inline-flex items-center gap-2"
          >
            <Plus size={15} /> Create Agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(agent => (
            <div
              key={agent.id}
              className="group bg-white border border-gray-100 rounded-2xl p-5 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer"
              onClick={() => navigate(`/dashboard/agents/${agent.id}`)}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-2xl flex-shrink-0">
                  {agent.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-base truncate">{agent.name}</h3>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{agent.template}</p>
                </div>
                <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                  agent.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  <Circle size={6} className={agent.status === 'active' ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400'} />
                  {agent.status}
                </span>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-1.5 flex-wrap">
                  {agent.channels.map(c => (
                    <span key={c} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{c}</span>
                  ))}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <MessageSquare size={12} />
                  <span>{agent.messages}</span>
                </div>
              </div>

              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => navigate(`/dashboard/agents/${agent.id}?tab=chat`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold gradient-btn"
                >
                  <MessageSquare size={13} /> Chat
                </button>
                <button
                  onClick={() => navigate(`/dashboard/agents/${agent.id}?tab=personality`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  <Edit3 size={13} /> Edit
                </button>
              </div>
            </div>
          ))}

          {/* Create new */}
          <button
            onClick={() => navigate('/dashboard/agents/new')}
            className="border-2 border-dashed border-gray-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 hover:border-blue-300 hover:bg-blue-50/30 transition-all group min-h-[180px]"
          >
            <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
              <Plus size={22} className="text-gray-400 group-hover:text-blue-500" />
            </div>
            <span className="text-sm font-semibold text-gray-400 group-hover:text-blue-500 transition-colors">Create New Agent</span>
          </button>
        </div>
      )}
    </DashboardLayout>
  )
}
