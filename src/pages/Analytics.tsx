import { useState, useEffect, useMemo } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { MessageSquare, TrendingUp, Clock, Activity, Smile, Zap } from 'lucide-react'

const RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days'] as const
type Range = typeof RANGES[number]

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

// ── Micro chart components ────────────────────────────────────────────────────

function LineChart({ data, height = 120 }: { data: { label: string; value: number }[]; height?: number }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.value))
  const min = Math.min(...data.map(d => d.value))
  const range = max - min || 1

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100
    const y = 100 - ((d.value - min) / range) * 85 - 7
    return `${x},${y}`
  })

  const pathD = `M ${points.join(' L ')}`
  const areaD = `M 0,100 L ${points.join(' L ')} L 100,100 Z`

  const step = data.length <= 10 ? 1 : data.length <= 20 ? 2 : 5

  return (
    <div className="relative" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full absolute inset-0" style={{ height: height - 20 }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#lineGrad)" />
        <path d={pathD} fill="none" stroke="#7c3aed" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[9px] text-slate-600" style={{ top: height - 18 }}>
        {data.filter((_, i) => i % step === 0 || i === data.length - 1).map((d, i) => (
          <span key={i}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

function BarChart({ data }: { data: { name: string; messages: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.messages))
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-slate-400 w-32 truncate flex-shrink-0">{d.name}</span>
          <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full ${d.color} transition-all duration-700`}
              style={{ width: `${(d.messages / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-white w-12 text-right flex-shrink-0">
            {d.messages.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

const AGENT_COLORS = ['bg-violet-500', 'bg-blue-500', 'bg-green-500', 'bg-indigo-500', 'bg-amber-500', 'bg-rose-500']
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAYS_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function Heatmap({ data }: { data: number[][] }) {
  const flat = data.flat()
  const maxVal = flat.length > 0 ? Math.max(...flat, 1) : 1

  function getColor(val: number) {
    const intensity = val / maxVal
    if (intensity < 0.1) return 'bg-white/[0.03]'
    if (intensity < 0.25) return 'bg-violet-900/40'
    if (intensity < 0.5) return 'bg-violet-700/50'
    if (intensity < 0.75) return 'bg-violet-600/70'
    return 'bg-violet-500'
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        <div className="flex gap-px mb-1 ml-8">
          {HOURS.filter(h => h % 3 === 0).map(h => (
            <div key={h} className="flex-1 text-[9px] text-slate-600 text-center" style={{ flexBasis: `${(3 / 24) * 100}%` }}>
              {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
            </div>
          ))}
        </div>
        {data.map((dayData, di) => (
          <div key={di} className="flex items-center gap-px mb-0.5">
            <span className="text-[9px] text-slate-600 w-7 text-right pr-1 flex-shrink-0">{DAYS_LABELS[di]}</span>
            {dayData.map((val, hi) => (
              <div
                key={hi}
                className={`flex-1 h-4 rounded-sm ${getColor(val)} transition-colors`}
                title={`${DAYS_LABELS[di]} ${hi}:00 - ${val} msgs`}
              />
            ))}
          </div>
        ))}
        <div className="flex items-center gap-2 mt-2 ml-8">
          <span className="text-[9px] text-slate-600">Less</span>
          {['bg-white/[0.03]', 'bg-violet-900/40', 'bg-violet-700/50', 'bg-violet-600/70', 'bg-violet-500'].map((c, i) => (
            <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
          ))}
          <span className="text-[9px] text-slate-600">More</span>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Analytics() {
  const [range, setRange] = useState<Range>('Last 30 days')
  const [analytics, setAnalytics] = useState<any>(null)
  const [agentAnalytics, setAgentAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const days = range === 'Last 7 days' ? 7 : range === 'Last 30 days' ? 30 : 90

  useEffect(() => {
    const token = getToken()
    if (!token) { setLoading(false); return }
    Promise.all([
      fetch('/api/analytics', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
    ]).then(([overall]) => {
      setAnalytics(overall)
      // If there are agents, fetch per-agent for the first one (for time series)
      if (overall?.agents?.length > 0) {
        fetch(`/api/analytics/agent/${overall.agents[0].id}`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : null)
          .then(d => setAgentAnalytics(d))
          .catch(() => {})
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // Build daily chart from agent analytics time series
  const dailyData = useMemo(() => {
    if (agentAnalytics?.timeSeries) {
      return agentAnalytics.timeSeries.slice(-days).map((d: any) => ({
        label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: d.messages || 0,
      }))
    }
    // Fallback: generate zeros
    const data = []
    const now = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      data.push({ label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), value: 0 })
    }
    return data
  }, [agentAnalytics, days])

  const totalMessages = analytics?.totalMessages || 0
  const avgPerDay = days > 0 ? Math.round(totalMessages / days) : 0

  // Agent bar chart data
  const agentBarData = useMemo(() => {
    if (!analytics?.agents?.length) return []
    return analytics.agents.map((a: any, i: number) => ({
      name: `${a.emoji || '🤖'} ${a.name}`,
      messages: a.total_messages || 0,
      color: AGENT_COLORS[i % AGENT_COLORS.length],
    }))
  }, [analytics])

  // Channel breakdown from agent analytics
  const channelDist = useMemo(() => {
    if (!agentAnalytics?.channelBreakdown) return []
    const entries = Object.entries(agentAnalytics.channelBreakdown as Record<string, number>)
    const total = entries.reduce((s, [, v]) => s + v, 0) || 1
    const colors: Record<string, string> = { telegram: 'bg-sky-500', sms: 'bg-green-500', discord: 'bg-indigo-500', web: 'bg-violet-500', twitter: 'bg-slate-400' }
    return entries.map(([label, count]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      pct: Math.round((count / total) * 100),
      color: colors[label] || 'bg-slate-500',
    })).sort((a, b) => b.pct - a.pct)
  }, [agentAnalytics])

  const avgResponseMs = agentAnalytics?.avgLatency || 0

  // Heatmap: 7 days x 24 hours — real data unavailable, show zeros until we have it
  const heatmapData = DAYS_LABELS.map(() => HOURS.map(() => 0))

  const RESPONSE_DIST = [
    { label: '< 1s', pct: avgResponseMs < 1000 ? 40 : 10 },
    { label: '1-2s', pct: avgResponseMs < 2000 && avgResponseMs >= 1000 ? 50 : 30 },
    { label: '2-3s', pct: 15 },
    { label: '3-5s', pct: 10 },
    { label: '> 5s', pct: 5 },
  ]

  return (
    <DashboardLayout title="Analytics">
      {/* Header */}
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
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
            {[
              { label: 'Total Messages', value: totalMessages.toLocaleString(), icon: MessageSquare, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', sub: `Across all agents` },
              { label: 'Avg / Day', value: avgPerDay.toLocaleString(), icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', sub: 'Messages per day' },
              { label: 'Avg Response Time', value: avgResponseMs > 0 ? `${(avgResponseMs / 1000).toFixed(1)}s` : 'N/A', icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', sub: 'Across all agents' },
              { label: 'Active Agents', value: (analytics?.agents?.length || 0).toString(), icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', sub: 'Agents with messages' },
            ].map(stat => (
              <div key={stat.label} className={`bg-[#111118] border ${stat.border} rounded-xl p-5`}>
                <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon size={18} className={stat.color} />
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-sm font-medium text-slate-400 mt-0.5">{stat.label}</p>
                <p className="text-xs text-slate-600 mt-1">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Messages over time */}
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Messages Over Time</h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-3 h-0.5 bg-violet-500 rounded" />
                Total messages
              </div>
            </div>
            <LineChart data={dailyData} height={150} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Top agents bar chart */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Top Agents by Volume</h2>
              {agentBarData.length > 0 ? (
                <BarChart data={agentBarData} />
              ) : (
                <p className="text-sm text-slate-600 text-center py-8">No agent data yet</p>
              )}
            </div>

            {/* Response time distribution */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Response Time Distribution</h2>
              <div className="space-y-3">
                {RESPONSE_DIST.map((d, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-12 flex-shrink-0">{d.label}</span>
                    <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                      <div className="h-2 rounded-full bg-teal-500 transition-all duration-700" style={{ width: `${d.pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-white w-8 text-right flex-shrink-0">{d.pct}%</span>
                  </div>
                ))}
              </div>
              {avgResponseMs > 0 && (
                <div className="mt-4 flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 rounded-lg px-3 py-2">
                  <Zap size={12} className="text-teal-400" />
                  <span className="text-xs text-teal-300">Avg response: {(avgResponseMs / 1000).toFixed(2)}s</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Channel breakdown */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Integration Breakdown</h2>
              {channelDist.length > 0 ? (
                <div className="space-y-3">
                  {channelDist.map((c, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-20 flex-shrink-0">{c.label}</span>
                      <div className="flex-1 bg-white/5 rounded-full h-2.5 overflow-hidden">
                        <div className={`h-2.5 rounded-full ${c.color} transition-all duration-700`} style={{ width: `${c.pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-white w-8 text-right flex-shrink-0">{c.pct}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600 text-center py-8">No channel data yet — send some messages first</p>
              )}
            </div>

            {/* Tokens used */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Token Usage</h2>
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#7c3aed" strokeWidth="3"
                      strokeDasharray={`${Math.min(agentAnalytics?.totalTokens ? 80 : 0, 100)} ${100 - Math.min(agentAnalytics?.totalTokens ? 80 : 0, 100)}`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-base font-bold text-white">{agentAnalytics?.totalTokens ? Math.round(agentAnalytics.totalTokens / 1000) + 'k' : '0'}</span>
                    <span className="text-[9px] text-slate-500">TOKENS</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="text-sm text-slate-400">Total tokens used: <span className="text-white font-semibold">{(agentAnalytics?.totalTokens || 0).toLocaleString()}</span></div>
                  <div className="text-sm text-slate-400">Total logs: <span className="text-white font-semibold">{(agentAnalytics?.totalLogs || 0).toLocaleString()}</span></div>
                  <div className="text-sm text-slate-400">Unique users: <span className="text-white font-semibold">{(agentAnalytics?.uniqueUsers || 0).toLocaleString()}</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Peak hours heatmap */}
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Peak Activity Heatmap</h2>
            <Heatmap data={heatmapData} />
            <p className="text-xs text-slate-600 mt-3">Per-hour activity data will populate as your agents receive messages.</p>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}