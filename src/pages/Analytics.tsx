import { useState, useMemo } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { MessageSquare, TrendingUp, Clock, Activity, Smile, Zap } from 'lucide-react'

const RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days'] as const
type Range = typeof RANGES[number]

// ── Mock data generators ──────────────────────────────────────────────────────

function generateDailyMessages(days: number) {
  const data = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const value = Math.floor(Math.random() * 120) + 20 + (days - i) * 2
    data.push({ label, value })
  }
  return data
}

const AGENT_DATA = [
  { name: 'Support Bot 🎧', messages: 847, color: 'bg-violet-500' },
  { name: 'Lead Gen 🎯', messages: 623, color: 'bg-blue-500' },
  { name: 'Sales Bot 💼', messages: 412, color: 'bg-green-500' },
  { name: 'Discord Bot 🛡️', messages: 298, color: 'bg-indigo-500' },
  { name: 'Booking Bot 📅', messages: 156, color: 'bg-amber-500' },
]

const RESPONSE_DIST = [
  { label: '< 1s', pct: 18 },
  { label: '1–2s', pct: 42 },
  { label: '2–3s', pct: 24 },
  { label: '3–5s', pct: 11 },
  { label: '> 5s', pct: 5 },
]

const CHANNEL_DIST = [
  { label: 'Telegram', pct: 38, color: 'bg-sky-500' },
  { label: 'SMS', pct: 27, color: 'bg-green-500' },
  { label: 'Discord', pct: 19, color: 'bg-indigo-500' },
  { label: 'Web', pct: 12, color: 'bg-violet-500' },
  { label: 'Twitter/X', pct: 4, color: 'bg-slate-400' },
]

// Peak hours mock — 7 days x 24 hours
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAYS_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HEATMAP_DATA = DAYS_LABELS.map(day =>
  HOURS.map(hour => {
    const base = (hour >= 9 && hour <= 17) ? 60 : (hour >= 18 && hour <= 22) ? 40 : 5
    const weekdayBoost = (day === 'Sat' || day === 'Sun') ? 0.6 : 1
    return Math.max(0, Math.floor((base + Math.random() * 30) * weekdayBoost))
  })
)

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

  // Show every N-th label
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
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * 100
          const y = 100 - ((d.value - min) / range) * 85 - 7
          return (
            <circle key={i} cx={x} cy={y} r="1.2" fill="#7c3aed" className="opacity-0 hover:opacity-100 transition-opacity" />
          )
        })}
      </svg>
      {/* X-axis labels */}
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

function Heatmap() {
  const maxVal = Math.max(...HEATMAP_DATA.flat())

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
        {/* Hour labels */}
        <div className="flex gap-px mb-1 ml-8">
          {HOURS.filter(h => h % 3 === 0).map(h => (
            <div key={h} className="flex-1 text-[9px] text-slate-600 text-center" style={{ flexBasis: `${(3 / 24) * 100}%` }}>
              {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
            </div>
          ))}
        </div>
        {HEATMAP_DATA.map((dayData, di) => (
          <div key={di} className="flex items-center gap-px mb-0.5">
            <span className="text-[9px] text-slate-600 w-7 text-right pr-1 flex-shrink-0">{DAYS_LABELS[di]}</span>
            {dayData.map((val, hi) => (
              <div
                key={hi}
                className={`flex-1 h-4 rounded-sm ${getColor(val)} transition-colors`}
                title={`${DAYS_LABELS[di]} ${hi}:00 — ${val} msgs`}
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

  const days = range === 'Last 7 days' ? 7 : range === 'Last 30 days' ? 30 : 90
  const dailyData = useMemo(() => generateDailyMessages(days), [days])
  const totalMessages = dailyData.reduce((s, d) => s + d.value, 0)
  const avgPerDay = Math.round(totalMessages / days)
  const satisfaction = 94.2
  const avgResponseMs = 1340

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

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Messages', value: totalMessages.toLocaleString(), icon: MessageSquare, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', sub: `+12% vs prev period` },
          { label: 'Avg / Day', value: avgPerDay.toLocaleString(), icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', sub: 'Messages per day' },
          { label: 'Avg Response Time', value: `${(avgResponseMs / 1000).toFixed(1)}s`, icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', sub: 'Across all agents' },
          { label: 'Satisfaction', value: `${satisfaction}%`, icon: Smile, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', sub: 'Based on feedback' },
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
          <BarChart data={AGENT_DATA} />
        </div>

        {/* Response time distribution */}
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Response Time Distribution</h2>
          <div className="space-y-3">
            {RESPONSE_DIST.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-12 flex-shrink-0">{d.label}</span>
                <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-teal-500 transition-all duration-700"
                    style={{ width: `${d.pct}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-white w-8 text-right flex-shrink-0">{d.pct}%</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 rounded-lg px-3 py-2">
            <Zap size={12} className="text-teal-400" />
            <span className="text-xs text-teal-300">73% of responses delivered in under 2 seconds</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Channel breakdown */}
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Integration Breakdown</h2>
          <div className="space-y-3">
            {CHANNEL_DIST.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-20 flex-shrink-0">{c.label}</span>
                <div className="flex-1 bg-white/5 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full ${c.color} transition-all duration-700`}
                    style={{ width: `${c.pct}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-white w-8 text-right flex-shrink-0">{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Satisfaction score */}
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">User Satisfaction</h2>
          <div className="flex items-center gap-6">
            {/* Ring */}
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke="#f59e0b"
                  strokeWidth="3"
                  strokeDasharray={`${satisfaction} ${100 - satisfaction}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-white">{satisfaction}%</span>
                <span className="text-[9px] text-slate-500">CSAT</span>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              {[
                { label: '😊 Positive', pct: 72, color: 'bg-green-500' },
                { label: '😐 Neutral', pct: 22, color: 'bg-amber-500' },
                { label: '😞 Negative', pct: 6, color: 'bg-red-500' },
              ].map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-24 flex-shrink-0">{r.label}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-1.5 rounded-full ${r.color}`} style={{ width: `${r.pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 w-8 text-right">{r.pct}%</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-4">Based on 1,247 feedback responses this period.</p>
        </div>
      </div>

      {/* Peak hours heatmap */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Peak Activity Heatmap</h2>
        <Heatmap />
        <p className="text-xs text-slate-600 mt-3">Hover over cells to see message counts. Darker = more activity.</p>
      </div>
    </DashboardLayout>
  )
}
