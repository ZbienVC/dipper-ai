import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { Bot, MessageSquare, CheckSquare, Plug, Plus, LayoutTemplate, Zap, Activity, Circle, Edit3 } from 'lucide-react'

const metrics = [
  { label: 'Active Agents', value: '3', change: '+1 this week', icon: Bot, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  { label: 'Messages Today', value: '847', change: '+12% vs yesterday', icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { label: 'Pending Approvals', value: '3', change: '2 require attention', icon: CheckSquare, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { label: 'Integrations', value: '4', change: 'Telegram, SMS, Discord, X', icon: Plug, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
]

const mockAgents = [
  { id: '1', name: 'Support Pro', status: 'active', messages: 412, template: 'Customer Support Bot', channels: ['SMS', 'Telegram'] },
  { id: '2', name: 'The Closer', status: 'active', messages: 289, template: 'Sales Follow-up Agent', channels: ['SMS', 'X'] },
  { id: '3', name: 'Community Bob', status: 'paused', messages: 146, template: 'Telegram Community Manager', channels: ['Telegram', 'Discord'] },
]

const activity = [
  { text: 'Support Pro responded to 12 messages', time: '2 min ago', color: 'bg-violet-500' },
  { text: 'The Closer booked 2 sales calls', time: '15 min ago', color: 'bg-blue-500' },
  { text: '3 new messages pending approval', time: '34 min ago', color: 'bg-amber-500' },
  { text: 'Community Bob sent daily digest', time: '1 hr ago', color: 'bg-teal-500' },
  { text: 'New integration connected: Discord', time: '3 hrs ago', color: 'bg-green-500' },
]

const quickActions = [
  { label: 'Create Agent', icon: Plus, path: '/dashboard/agents/new', primary: true },
  { label: 'Templates', icon: LayoutTemplate, path: '/dashboard/templates', primary: false },
  { label: 'Integrations', icon: Plug, path: '/dashboard/integrations', primary: false },
  { label: 'Analytics', icon: Activity, path: '/dashboard/analytics', primary: false },
]

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <DashboardLayout title="Dashboard">
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
            <p className="text-2xl font-bold text-white mb-0.5">{m.value}</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mockAgents.map(agent => (
                <div
                  key={agent.id}
                  className="group border border-[#1e1e2e] rounded-xl p-4 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all cursor-pointer"
                  onClick={() => navigate(`/dashboard/agents/${agent.id}`)}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                      <Bot size={18} className="text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-sm truncate">{agent.name}</h3>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{agent.template}</p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      agent.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    }`}>
                      <Circle size={5} className={agent.status === 'active' ? 'fill-green-400' : 'fill-slate-400'} />
                      {agent.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex gap-1.5">
                      {agent.channels.map(c => (
                        <span key={c} className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full">{c}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
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
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-[#111118] rounded-xl p-5 border border-[#1e1e2e] h-fit">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={15} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-white">Activity Feed</h2>
          </div>
          <div className="space-y-3.5">
            {activity.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${item.color}`} />
                <div>
                  <p className="text-xs text-slate-300 leading-snug">{item.text}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-4 w-full text-xs text-violet-400 font-medium hover:text-violet-300 transition-colors text-left">
            View all activity
          </button>
        </div>
      </div>
    </DashboardLayout>
  )
}
