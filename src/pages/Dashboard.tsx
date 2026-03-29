import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Bot, MessageSquare, CheckSquare, Plug, Plus, LayoutTemplate, Zap, Activity, Circle, Edit3, ArrowRight, Send, Clock, Users2, Users } from 'lucide-react'

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const quickActions = [
  { label: 'Create Agent', icon: Plus, path: '/dashboard/agents/new', primary: true },
  { label: 'Templates', icon: LayoutTemplate, path: '/dashboard/templates', primary: false },
  { label: 'Integrations', icon: Plug, path: '/dashboard/integrations', primary: false },
  { label: 'Activity', icon: Activity, path: '/dashboard/activity', primary: false },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<any[]>([])
  const [analytics, setAnalytics] = useState<{ totalMessages: number } | null>(null)
  const [integrationCount, setIntegrationCount] = useState(0)
  const [usage, setUsage] = useState<{ plan: string; messagesUsedToday: number; messagesLimitToday: number } | null>(null)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [leadStats, setLeadStats] = useState<{ total: number; byStage: Record<string, number>; totalValue: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) { setLoading(false); return }
    Promise.all([
      fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
      fetch('/api/analytics', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null),
      fetch('/api/integrations', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
      fetch('/api/usage', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/activity?limit=5', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : { logs: [] }).catch(() => ({ logs: [] })),
      fetch('/api/teams', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/leads/stats', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([agentData, analyticsData, integrationData, usageData, activityData, teamsData, leadsStatsData]) => {
      if (Array.isArray(agentData)) setAgents(agentData)
      if (analyticsData) setAnalytics(analyticsData)
      if (Array.isArray(integrationData)) setIntegrationCount(integrationData.filter((i: any) => i.connected).length)
      if (usageData) setUsage(usageData)
      if (activityData?.logs) setRecentActivity(activityData.logs)
      if (Array.isArray(teamsData)) setTeams(teamsData)
      if (leadsStatsData) setLeadStats(leadsStatsData)
    }).finally(() => setLoading(false))
  }, [])

  const activeAgents = agents.filter(a => a.is_active !== false)
  const totalMessages = analytics?.totalMessages ?? 0

  const metrics = [
    { label: 'Active Agents', value: String(activeAgents.length), change: activeAgents.length === 0 ? 'No agents yet' : `${activeAgents.length} running`, icon: Bot, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
    { label: 'Total Messages', value: totalMessages.toLocaleString(), change: totalMessages === 0 ? 'No messages yet' : 'All time', icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { label: 'Pending Approvals', value: '0', change: 'Nothing pending', icon: CheckSquare, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    { label: 'Integrations', value: String(integrationCount), change: integrationCount === 0 ? 'None connected yet' : `${integrationCount} active`, icon: Plug, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
  ]

  return (
    <DashboardLayout title="Dashboard">
      {/* Free plan banner */}
      {!loading && usage?.plan === 'free' && (
        <div className="mb-5 bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold text-white">You're on the Free plan</p>
            <p className="text-xs text-slate-400 mt-0.5">Upgrade to unlock more agents, messages, and premium AI models.</p>
          </div>
          <Link to="/dashboard/billing" className="gradient-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0">
            Upgrade <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Usage bar */}
      {!loading && usage && (
        <div className="mb-5 bg-[#111118] border border-[#1e1e2e] rounded-xl p-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-semibold">Messages today</span>
            <span className="text-slate-300 font-bold">{usage.messagesUsedToday} / {usage.messagesLimitToday}</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                usage.messagesUsedToday / usage.messagesLimitToday >= 1 ? 'bg-red-500' :
                usage.messagesUsedToday / usage.messagesLimitToday >= 0.8 ? 'bg-amber-500' : 'bg-violet-500'
              }`}
              style={{ width: `${Math.min((usage.messagesUsedToday / usage.messagesLimitToday) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {metrics.map(m => (
          <div key={m.label} className={`bg-[#111118] rounded-xl p-5 border ${m.border} hover:border-violet-500/30 transition-colors`}>
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-lg ${m.bg} flex items-center justify-center`}>
                <m.icon size={18} className={m.color} />
              </div>
              <Zap size={12} className="text-slate-700" />
            </div>
            <p className="text-2xl font-bold text-white mb-0.5">{loading ? '—' : m.value}</p>
            <p className="text-sm font-medium text-slate-400">{m.label}</p>
            <p className="text-xs text-slate-600 mt-1">{m.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Quick Actions */}
          <div className="bg-[#111118] rounded-xl p-5 border border-[#1e1e2e]">
            <h2 className="text-sm font-semibold text-white mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {quickActions.map(a => (
                <Link
                  key={a.label}
                  to={a.path}
                  className={`flex flex-col items-center gap-2 p-3.5 rounded-xl text-xs font-semibold transition-all ${
                    a.primary
                      ? 'gradient-btn'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-[#1e1e2e] hover:border-violet-500/20'
                  }`}
                >
                  <a.icon size={18} />
                  {a.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Agents Grid */}
          <div className="bg-[#111118] rounded-xl p-5 border border-[#1e1e2e]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Your Agents</h2>
              <button
                onClick={() => navigate('/dashboard/agents/new')}
                className="gradient-btn text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"
              >
                <Plus size={13} />
                New Agent
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : activeAgents.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-3">
                  <Bot size={22} className="text-violet-400" />
                </div>
                <p className="text-slate-400 text-sm font-semibold mb-1">No agents yet</p>
                <p className="text-slate-600 text-xs mb-4">Create your first agent to get started.</p>
                <button onClick={() => navigate('/dashboard/agents/new')} className="gradient-btn px-4 py-2 rounded-xl text-xs font-semibold">
                  <Plus size={12} className="inline mr-1" />Create Agent
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeAgents.map((agent: any) => (
                  <div
                    key={agent.id}
                    className="group border border-[#1e1e2e] rounded-xl p-4 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all cursor-pointer"
                    onClick={() => navigate(`/dashboard/agents/${agent.id}`)}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 text-base">
                        {agent.emoji || <Bot size={18} className="text-violet-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white text-sm truncate">{agent.name}</h3>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{agent.description || 'Custom Agent'}</p>
                      </div>
                      <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        agent.is_active ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}>
                        <Circle size={5} className={agent.is_active ? 'fill-green-400' : 'fill-slate-400'} />
                        {agent.is_active ? 'active' : 'paused'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <MessageSquare size={11} />
                        <span>{(agent.total_messages || 0).toLocaleString()} messages</span>
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

                {/* Empty slot */}
                <button
                  onClick={() => navigate('/dashboard/agents/new')}
                  className="border border-dashed border-[#1e1e2e] rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group min-h-[140px]"
                >
                  <div className="w-9 h-9 rounded-full bg-white/5 group-hover:bg-violet-500/10 flex items-center justify-center transition-colors">
                    <Plus size={18} className="text-slate-600 group-hover:text-violet-400" />
                  </div>
                  <span className="text-xs font-medium text-slate-600 group-hover:text-violet-400 transition-colors">Create New Agent</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-[#111118] rounded-xl p-5 border border-[#1e1e2e] h-fit">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={15} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
          </div>
          {loading ? (
            <div className="space-y-3.5">
              {[0,1,2].map(i => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-white/10" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-40 bg-white/5 rounded" />
                    <div className="h-2 w-24 bg-white/5 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-600 text-xs">No activity yet.</p>
              <p className="text-slate-700 text-xs mt-1">Create an agent to see activity here.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {recentActivity.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${log.status === 'error' ? 'bg-red-500' : 'bg-violet-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 leading-snug truncate">
                      <span className="font-semibold text-white">{log.agent_name || 'System'}</span>
                      {' — '}{log.summary}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">{timeAgo(log.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button className="mt-4 w-full text-xs text-violet-400 font-medium hover:text-violet-300 transition-colors text-left"
            onClick={() => navigate('/dashboard/activity')}>
            View all activity →
          </button>
        </div>
      </div>

      {/* Active Teams Widget */}
      <div className="mt-5 bg-[#111118] rounded-xl p-5 border border-[#1e1e2e]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users2 size={15} className="text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Agent Teams</h2>
          </div>
          <Link to="/dashboard/teams" className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors">
            View all →
          </Link>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-slate-600 text-xs mb-3">No teams yet. Form a team of agents to tackle complex tasks together.</p>
            <Link to="/dashboard/teams" className="gradient-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold">
              <Plus size={12} /> Create Team
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {teams.slice(0, 3).map((team: any) => (
              <Link key={team.id} to={`/dashboard/teams/${team.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-[#1e1e2e] hover:border-violet-500/30 hover:bg-violet-500/5 transition-all group">
                <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Users2 size={14} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors truncate">{team.name}</p>
                  <p className="text-xs text-slate-600">{(team.members || []).length} members</p>
                </div>
                {team.lastTask && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                    team.lastTask.status === 'success' ? 'bg-emerald-500/15 text-emerald-400' :
                    team.lastTask.status === 'error' ? 'bg-red-500/15 text-red-400' :
                    team.lastTask.status === 'running' ? 'bg-violet-500/15 text-violet-400' :
                    'bg-slate-500/15 text-slate-400'
                  }`}>{team.lastTask.status}</span>
                )}
              </Link>
            ))}
            {teams.length > 3 && (
              <Link to="/dashboard/teams" className="block text-center text-xs text-violet-400 hover:text-violet-300 pt-2 transition-colors">
                +{teams.length - 3} more teams →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Pipeline Widget */}
      <div className="mt-5 bg-[#111118] rounded-xl p-5 border border-[#1e1e2e]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Pipeline</h2>
          </div>
          <Link to="/dashboard/leads" className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors">
            View CRM →
          </Link>
        </div>
        {loading ? (
          <div className="flex gap-2 flex-wrap">
            {[0,1,2,3,4,5].map(i => <div key={i} className="h-7 w-20 animate-pulse bg-white/5 rounded-full" />)}
          </div>
        ) : !leadStats || leadStats.total === 0 ? (
          <div className="text-center py-4">
            <p className="text-slate-600 text-xs mb-2">No leads yet. Leads auto-create when users message your agents.</p>
            <Link to="/dashboard/leads" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
              Open CRM →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'new', label: 'New', color: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
                { key: 'contacted', label: 'Contacted', color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
                { key: 'qualified', label: 'Qualified', color: 'bg-violet-500/20 text-violet-400 border border-violet-500/30' },
                { key: 'proposal', label: 'Proposal', color: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
                { key: 'closed_won', label: 'Won', color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
                { key: 'closed_lost', label: 'Lost', color: 'bg-red-500/20 text-red-400 border border-red-500/30' },
              ].map(s => (
                <span key={s.key} className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.color}`}>
                  {s.label} {leadStats.byStage[s.key] || 0}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>{leadStats.total} total leads</span>
              {leadStats.totalValue > 0 && (
                <span className="text-emerald-400 font-semibold">${leadStats.totalValue.toLocaleString()} pipeline value</span>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
