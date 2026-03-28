import DashboardLayout from '../components/DashboardLayout'
import { Check, Zap, ShieldCheck } from 'lucide-react'

function getUser() {
  try {
    const raw = localStorage.getItem('dipperai_user')
    if (raw) return JSON.parse(raw) as { email: string; name: string; role?: string; plan?: string }
  } catch {}
  return { email: '', name: 'User' }
}

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    current: true,
    features: ['1 AI Agent', '100 messages/mo', '1 team member', 'SMS & Telegram', 'Community support'],
    cta: 'Current Plan',
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/mo',
    current: false,
    popular: true,
    features: ['10 AI Agents', '10,000 messages/mo', '5 team members', 'All channels', 'Priority support', 'Analytics dashboard', 'Custom commands'],
    cta: 'Upgrade to Pro',
  },
  {
    name: 'Business',
    price: '$149',
    period: '/mo',
    current: false,
    features: ['Unlimited agents', 'Unlimited messages', 'Unlimited team members', 'All channels', 'Dedicated support', 'Advanced analytics', 'White-label option', 'API access'],
    cta: 'Upgrade to Business',
  },
]

const usageData = [
  { label: 'Agents', used: 1, limit: 1, color: 'bg-amber-500' },
  { label: 'Messages', used: 47, limit: 100, color: 'bg-violet-500' },
  { label: 'Team Members', used: 1, limit: 1, color: 'bg-amber-500' },
]

export default function Billing() {
  const user = getUser()
  const isAdmin = user.role === 'admin'

  if (isAdmin) {
    return (
      <DashboardLayout title="Billing">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-white">Billing</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Manage your plan and usage.</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={22} className="text-amber-400" />
          </div>
          <div>
            <p className="text-base font-bold text-white">Admin Account — All Features Unlocked</p>
            <p className="text-slate-500 mt-0.5 text-sm">You have unlimited access to all agents, messages, channels, and features.</p>
          </div>
        </div>
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 mb-6">
          <h2 className="font-semibold text-white text-sm mb-4">Usage</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {['Agents', 'Messages', 'Team Members'].map(u => (
              <div key={u}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-semibold text-slate-300">{u}</span>
                  <span className="font-bold text-amber-400">∞ Unlimited</span>
                </div>
                <div className="w-full rounded-full h-1.5 bg-amber-500/30">
                  <div className="h-1.5 w-full rounded-full bg-amber-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden">
          <div className="p-5 border-b border-[#1e1e2e]"><h2 className="text-sm font-semibold text-white">Billing History</h2></div>
          <div className="p-16 text-center">
            <p className="font-semibold text-slate-500 text-sm">Admin accounts are not billed.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Billing">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Billing</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Manage your plan and usage.</p>
      </div>

      {/* Current Plan Card */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Zap size={18} className="text-violet-400" />
            </div>
            <div>
              <p className="font-bold text-white">Free Plan</p>
              <p className="text-xs text-slate-500">Current plan</p>
            </div>
          </div>
          <button className="gradient-btn px-4 py-2 rounded-xl font-semibold text-sm">Upgrade Plan</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {usageData.map(u => {
            const pct = Math.round((u.used / u.limit) * 100)
            return (
              <div key={u.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-semibold text-slate-300">{u.label}</span>
                  <span className={`font-bold ${pct >= 100 ? 'text-red-400' : pct >= 80 ? 'text-amber-400' : 'text-white'}`}>{u.used}/{u.limit}</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5">
                  <div className={`${pct >= 100 ? 'bg-red-500' : u.color} h-1.5 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                {pct >= 100 && <p className="text-xs text-red-400 mt-1">Limit reached — upgrade to continue</p>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {PLANS.map(plan => (
          <div key={plan.name} className={`bg-[#111118] rounded-xl border p-5 flex flex-col relative ${
            plan.popular ? 'border-violet-500/40' : 'border-[#1e1e2e]'
          }`}>
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="gradient-btn text-xs font-bold px-3 py-1 rounded-full">Most Popular</span>
              </div>
            )}
            <div className="mb-4">
              <h3 className="font-bold text-white">{plan.name}</h3>
              <div className="flex items-baseline gap-0.5 mt-1">
                <span className="text-2xl font-bold text-white">{plan.price}</span>
                <span className="text-slate-500 text-sm">{plan.period}</span>
              </div>
            </div>
            <ul className="space-y-2 flex-1 mb-5">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-400">
                  <Check size={13} className="text-green-400 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button disabled={plan.current}
              className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${
                plan.current ? 'bg-white/5 text-slate-500 cursor-not-allowed border border-[#1e1e2e]' : 'gradient-btn'
              }`}>
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Billing History */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-[#1e1e2e]"><h2 className="text-sm font-semibold text-white">Billing History</h2></div>
        <div className="p-16 text-center">
          <p className="font-semibold text-slate-500 text-sm">No invoices yet. Upgrade to see billing history.</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
