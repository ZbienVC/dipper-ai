import { useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { MessageSquare, TrendingUp, Clock, Activity } from 'lucide-react'

const RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days'] as const
type Range = typeof RANGES[number]

const barData: Record<Range, { day: string; value: number }[]> = {
  'Last 7 days': [
    { day: 'Mon', value: 142 },
    { day: 'Tue', value: 189 },
    { day: 'Wed', value: 223 },
    { day: 'Thu', value: 176 },
    { day: 'Fri', value: 258 },
    { day: 'Sat', value: 134 },
    { day: 'Sun', value: 125 },
  ],
  'Last 30 days': [
    { day: 'W1', value: 820 },
    { day: 'W2', value: 1045 },
    { day: 'W3', value: 934 },
    { day: 'W4', value: 1247 },
  ],
  'Last 90 days': [
    { day: 'Jan', value: 2800 },
    { day: 'Feb', value: 3400 },
    { day: 'Mar', value: 3900 },
  ],
}

const topAgents = [
  { name: 'Support Pro', emoji: '🎧', messages: 412, responseRate: '96%', avgLatency: '1.1s' },
  { name: 'The Closer', emoji: '💼', messages: 289, responseRate: '93%', avgLatency: '1.4s' },
  { name: 'Community Bob', emoji: '🌐', messages: 146, responseRate: '91%', avgLatency: '1.8s' },
]

const channelBreakdown = [
  { channel: 'SMS', pct: 45, color: 'bg-blue-500' },
  { channel: 'Web Chat', pct: 30, color: 'bg-violet-500' },
  { channel: 'Telegram', pct: 20, color: 'bg-sky-500' },
  { channel: 'Discord', pct: 5, color: 'bg-indigo-500' },
]

export default function Analytics() {
  const [range, setRange] = useState<Range>('Last 7 days')
  const bars = barData[range]
  const maxVal = Math.max(...bars.map(b => b.value))
  const chartHeight = 160

  return (
    <DashboardLayout title="Analytics">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Track your agents' performance across all channels.</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                range === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {[
          { label: 'Total Messages', value: '1,247', icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50', change: '+8% vs last period' },
          { label: 'Response Rate', value: '94%', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', change: '+2% vs last period' },
          { label: 'Avg Response Time', value: '1.2s', icon: Clock, color: 'text-violet-600', bg: 'bg-violet-50', change: '-0.3s improvement' },
          { label: 'Active Conversations', value: '23', icon: Activity, color: 'text-orange-500', bg: 'bg-orange-50', change: 'Right now' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center mb-4`}>
              <stat.icon size={20} className={stat.color} />
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{stat.value}</p>
            <p className="text-sm font-medium text-gray-500 mt-1">{stat.label}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Messages Over Time</h2>
          <div className="flex items-end gap-3 h-48">
            {bars.map(bar => {
              const barH = Math.round((bar.value / maxVal) * chartHeight)
              return (
                <div key={bar.day} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">{bar.value}</span>
                  <div
                    className="w-full rounded-t-lg transition-all duration-500"
                    style={{
                      height: `${barH}px`,
                      background: 'linear-gradient(180deg, #7C3AED, #2563EB)',
                      minHeight: '4px',
                    }}
                  />
                  <span className="text-xs text-gray-400 font-medium">{bar.day}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Channel Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Channel Breakdown</h2>
          <div className="space-y-4">
            {channelBreakdown.map(ch => (
              <div key={ch.channel}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-semibold text-gray-700">{ch.channel}</span>
                  <span className="text-sm font-bold text-gray-900">{ch.pct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className={`${ch.color} h-2.5 rounded-full transition-all duration-700`}
                    style={{ width: `${ch.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {channelBreakdown.map(ch => (
              <span key={ch.channel} className={`text-xs font-semibold px-3 py-1.5 rounded-full text-white ${ch.color}`}>
                {ch.channel} {ch.pct}%
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Top Agents Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Top Agents</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Agent</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Messages Sent</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Response Rate</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">Avg Latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {topAgents.map((agent, i) => (
              <tr key={agent.name} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{agent.emoji}</span>
                    <span className="font-semibold text-gray-900 text-sm">{agent.name}</span>
                    {i === 0 && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">Top</span>}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-gray-900">{agent.messages.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className="text-sm font-semibold text-green-600">{agent.responseRate}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{agent.avgLatency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  )
}
