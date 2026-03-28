import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { MessageSquare, TrendingUp, Clock, Activity, Bot } from 'lucide-react'

const RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days'] as const
type Range = typeof RANGES[number]

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

export default function Analytics() {
  const [range, setRange] = useState<Range>('Last 7 days')
  const [analytics, setAnalytics] = useState<{ agents: any[]; totalMessages: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) { setLoading(false); return }
    fetch('/api/analytics', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setAnalytics(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const hasData = analytics && analytics.agents.length > 0

  return (
    <DashboardLayout title="Analytics">
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Analytics</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Track your agents' performance across all channels.</p>
        </div>
        <div className="flex gap-1 bg-[#111118] border border-[#1e1e2e] rounded-xl p-1">
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                range === r ? 'gradient-btn' : 'text-slate-500 hover:text-slate-200'
              }`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : !hasData ? (
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <Activity size={24} className="text-violet-400" />
          </div>
          <h3 className="text-base font-bold text-white mb-2">No data yet</h3>
          <p className="text-slate-500 text-sm max-w-xs mx-auto">
            Analytics will appear here once your agents start receiving and responding to messages.
          </p>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
            {[
              { label: 'Total Messages', value: (analytics?.totalMessages || 0).toLocaleString(), icon: MessageSquare, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', change: 'All time' },
              { label: 'Active Agents', value: String(analytics?.agents.length || 0), icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', change: 'Sending messages' },
              { label: 'Avg Messages / Agent', value: analytics && analytics.agents.length > 0 ? Math.round((analytics.totalMessages || 0) / analytics.agents.length).toLocaleString() : '0', icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', change: 'Per agent' },
              { label: 'Top Agent Messages', value: analytics?.agents.length > 0 ? Math.max(...analytics.agents.map((a: any) => a.total_messages || 0)).toLocaleString() : '0', icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', change: 'Single agent record' },
            ].map(stat => (
              <div key={stat.label} className={`bg-[#111118] border ${stat.border} rounded-xl p-5`}>
                <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon size={18} className={stat.color} />
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-sm font-medium text-slate-400 mt-0.5">{stat.label}</p>
                <p className="text-xs text-slate-600 mt-1">{stat.change}</p>
              </div>
            ))}
          </div>

          {/* Top Agents Table */}
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden">
            <div className="p-5 border-b border-[#1e1e2e]">
              <h2 className="text-sm font-semibold text-white">Agent Performance</h2>
            </div>
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  {['Agent', 'Total Messages'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2e]">
                {(analytics?.agents || [])
                  .sort((a: any, b: any) => (b.total_messages || 0) - (a.total_messages || 0))
                  .map((agent: any, i: number) => (
                  <tr key={agent.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-sm">
                          {agent.emoji || <Bot size={14} className="text-violet-400" />}
                        </div>
                        <span className="font-semibold text-white text-sm">{agent.name}</span>
                        {i === 0 && <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">Top</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-white">{(agent.total_messages || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
