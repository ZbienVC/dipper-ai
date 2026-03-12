import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { Bot, MessageSquare, CheckSquare, Plug, Plus, LayoutTemplate, Upload, Zap, Activity, Circle, Edit3 } from 'lucide-react'

const metrics = [
  { label: 'Active Agents', value: '3', change: '+1 this week', icon: Bot, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Messages Today', value: '847', change: '+12% vs yesterday', icon: MessageSquare, color: 'text-violet-600', bg: 'bg-violet-50' },
  { label: 'Pending Approvals', value: '3', change: '2 require attention', icon: CheckSquare, color: 'text-orange-500', bg: 'bg-orange-50' },
  { label: 'Connected Integrations', value: '4', change: 'Telegram, SMS, Discord, X', icon: Plug, color: 'text-teal-600', bg: 'bg-teal-50' },
]

const mockAgents = [
  { id: '1', name: 'Support Pro', emoji: '🎧', status: 'active', messages: 412, template: 'Customer Support Bot', channels: ['SMS', 'Telegram'] },
  { id: '2', name: 'The Closer', emoji: '💼', status: 'active', messages: 289, template: 'Sales Follow-up Agent', channels: ['SMS', 'X'] },
  { id: '3', name: 'Community Bob', emoji: '🌐', status: 'paused', messages: 146, template: 'Telegram Community Manager', channels: ['Telegram', 'Discord'] },
]

const activity = [
  { text: 'Support Pro responded to 12 messages', time: '2 min ago', color: 'bg-blue-500' },
  { text: 'The Closer booked 2 sales calls', time: '15 min ago', color: 'bg-violet-500' },
  { text: '3 new messages pending approval', time: '34 min ago', color: 'bg-orange-400' },
  { text: 'Community Bob sent daily digest', time: '1 hr ago', color: 'bg-teal-500' },
  { text: 'New integration connected: Discord', time: '3 hrs ago', color: 'bg-green-500' },
]

const quickActions = [
  { label: 'Create Agent', icon: Plus, path: '/dashboard/agents/new', gradient: true },
  { label: 'Install Template', icon: LayoutTemplate, path: '/dashboard/templates', gradient: false },
  { label: 'Connect Integration', icon: Plug, path: '/dashboard/integrations', gradient: false },
  { label: 'Upload Knowledge', icon: Upload, path: '/dashboard/knowledge', gradient: false },
]

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <DashboardLayout title="Dashboard">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {metrics.map(m => (
          <div key={m.label} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-11 h-11 rounded-xl ${m.bg} flex items-center justify-center`}>
                <m.icon size={22} className={m.color} />
              </div>
              <Zap size={14} className="text-gray-300" />
            </div>
            <p className="text-3xl font-extrabold text-gray-900 mb-1">{m.value}</p>
            <p className="text-sm font-medium text-gray-500">{m.label}</p>
            <p className="text-xs text-gray-400 mt-1">{m.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickActions.map(a => (
                <Link
                  key={a.label}
                  to={a.path}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                    a.gradient
                      ? 'gradient-btn shadow-md shadow-blue-200'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-100'
                  }`}
                >
                  <a.icon size={20} />
                  {a.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Agents Grid */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Your Agents</h2>
              <button
                onClick={() => navigate('/dashboard/agents/new')}
                className="gradient-btn text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5"
              >
                <Plus size={15} />
                New Agent
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mockAgents.map(agent => (
                <div
                  key={agent.id}
                  className="group border border-gray-100 rounded-2xl p-5 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => navigate(`/dashboard/agents/${agent.id}`)}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-2xl flex-shrink-0">
                      {agent.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-base truncate">{agent.name}</h3>
                      </div>
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
                    <div className="flex gap-1.5">
                      {agent.channels.map(c => (
                        <span key={c} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{c}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <MessageSquare size={12} />
                      <span>{agent.messages}</span>
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => navigate(`/dashboard/agents/${agent.id}?tab=chat`)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold gradient-btn transition-all"
                    >
                      <MessageSquare size={13} /> Chat
                    </button>
                    <button
                      onClick={() => navigate(`/dashboard/agents/${agent.id}?tab=personality`)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                  </div>
                </div>
              ))}

              {/* Empty slot */}
              <button
                onClick={() => navigate('/dashboard/agents/new')}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 hover:border-blue-300 hover:bg-blue-50/30 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                  <Plus size={20} className="text-gray-400 group-hover:text-blue-500" />
                </div>
                <span className="text-sm font-medium text-gray-400 group-hover:text-blue-500 transition-colors">Create New Agent</span>
              </button>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-5">
            <Activity size={18} className="text-gray-700" />
            <h2 className="text-lg font-bold text-gray-900">Activity Feed</h2>
          </div>
          <div className="space-y-4">
            {activity.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${item.color}`} />
                <div>
                  <p className="text-sm text-gray-700 leading-snug">{item.text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-5 w-full text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors">
            View all activity →
          </button>
        </div>
      </div>
    </DashboardLayout>
  )
}
