import { useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { MessageSquare, TrendingUp, Clock, Activity, Bot } from 'lucide-react'

const RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days'] as const
type Range = typeof RANGES[number]

const barData: Record<Range, { day: string; value: number }[]> = {
  'Last 7 days': [
    { day: 'Mon', value: 142 }, { day: 'Tue', value: 189 }, { day: 'Wed', value: 223 },
    { day: 'Thu', value: 176 }, { day: 'Fri', value: 258 }, { day: 'Sat', value: 134 }, { day: 'Sun', value: 125 },
  ],
  'Last 30 days': [
    { day: 'W1', value: 820 }, { day: 'W2', value: 1045 }, { day: 'W3', value: 934 }, { day: 'W4', value: 1247 },
  ],
  'Last 90 days': [
    { day: 'Jan', value: 2800 }, { day: 'Feb', value: 3400 }, { day: 'Mar', value: 3900 },
  ],
}

const topAgents = [
  { name: 'Support Pro', messages: 412, responseRate: '96%', avgLatency: '1.1s' },
  { name: 'The Closer', messages: 289, responseRate: '93%', avgLatency: '1.4s' },
  { name: 'Community Bob', messages: 146, responseRate: '91%', avgLatency: '1.8s' },
]

const channelBreakdown = [
  { channel: 'SMS', pct: 45, color: 'bg-violet-500' },
  { channel: 'Web Chat', pct: 30, color: 'bg-blue-500' },
  { channel: 'Telegram', pct: 20, color: 'bg-sky-500' },
  { channel: 'Discord', pct: 5, color: 'bg-indigo-500' },
]

export default function Analytics() {
  const [range, setRange] = useState<Range>('Last 7 days')
  const bars = barData[range]
  const maxVal = Math.max(...bars.map(b => b.value))

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

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Messages', value: '1,247', icon: MessageSquare, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', change: '+8% vs last period' },
          { label: 'Response Rate', value: '94%', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', change: '+2% vs last period' },
          { label: 'Avg Response Time', value: '1.2s', icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', change: '-0.3s improvement' },
          { label: 'Active Conversations', value: '23', icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', change: 'Right now' },
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-5">Messages Over Time</h2>
          <div className="flex items-end gap-2 h-40">
            {bars.map(bar => {
              const barH = Math.round((bar.value / maxVal) * 120)
              return (
                <div key={bar.day} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-xs text-slate-600 font-medium">{bar.value}</span>
                  <div className="w-full rounded-t-lg transition-all duration-500 bg-violet-500/70 hover:bg-violet-500 cursor-pointer" style={{ height: `${barH}px`, minHeight: '4px' }} />
                  <span className="text-xs text-slate-500">{bar.day}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Channel Breakdown */}
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-5">Channel Breakdown</h2>
          <div className="space-y-4">
            {channelBreakdown.map(ch => (
              <div key={ch.channel}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-semibold text-slate-300">{ch.channel}</span>
                  <span className="text-sm font-bold text-white">{ch.pct}%</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2">
                  <div className={`${ch.color} h-2 rounded-full transition-all duration-700`} style={{ width: `${ch.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Agents Table */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-[#1e1e2e]">
          <h2 className="text-sm font-semibold text-white">Top Agents</h2>
        </div>
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              {['Agent', 'Messages Sent', 'Response Rate', 'Avg Latency'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-slate-500 px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e2e]">
            {topAgents.map((agent, i) => (
              <tr key={agent.name} className="hover:bg-white/5 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                      <Bot size={14} className="text-violet-400" />
                    </div>
                    <span className="font-semibold text-white text-sm">{agent.name}</span>
                    {i === 0 && <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">Top</span>}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-sm font-semibold text-white">{agent.messages.toLocaleString()}</td>
                <td className="px-5 py-3.5"><span className="text-sm font-semibold text-green-400">{agent.responseRate}</span></td>
                <td className="px-5 py-3.5 text-sm text-slate-400">{agent.avgLatency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  )
}
