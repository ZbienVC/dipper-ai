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
    price: '$29',
    period: '/mo',
    current: false,
    popular: true,
    features: ['10 AI Agents', '10,000 messages/mo', '5 team members', 'All channels', 'Priority support', 'Analytics dashboard', 'Custom commands'],
    cta: 'Upgrade to Pro',
  },
  {
    name: 'Business',
    price: '$99',
    period: '/mo',
    current: false,
    features: ['Unlimited agents', 'Unlimited messages', 'Unlimited team members', 'All channels', 'Dedicated support', 'Advanced analytics', 'White-label option', 'API access'],
    cta: 'Upgrade to Business',
  },
]

const usageData = [
  { label: 'Agents', used: 1, limit: 1, color: 'bg-orange-400' },
  { label: 'Messages', used: 47, limit: 100, color: 'bg-blue-500' },
  { label: 'Team Members', used: 1, limit: 1, color: 'bg-orange-400' },
]

export default function Billing() {
  const user = getUser()
  const isAdmin = user.role === 'admin'

  if (isAdmin) {
    return (
      <DashboardLayout title="Billing">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">Billing</h1>
          <p className="text-gray-500 mt-1">Manage your plan and usage.</p>
        </div>

        {/* Admin Banner */}
        <div className="rounded-2xl p-8 mb-8 flex items-center gap-5" style={{ background: 'linear-gradient(135deg, #F59E0B22, #D9770611)', border: '2px solid #F59E0B' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
            <ShieldCheck size={26} className="text-white" />
          </div>
          <div>
            <p className="text-xl font-extrabold text-gray-900">Admin Account — All Features Unlocked</p>
            <p className="text-gray-500 mt-1 text-sm">You have unlimited access to all agents, messages, channels, and features.</p>
          </div>
        </div>

        {/* Unlimited Usage */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <h2 className="font-bold text-gray-900 text-lg mb-5">Usage</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { label: 'Agents', value: '∞ Unlimited' },
              { label: 'Messages', value: '∞ Unlimited' },
              { label: 'Team Members', value: '∞ Unlimited' },
            ].map(u => (
              <div key={u.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-semibold text-gray-700">{u.label}</span>
                  <span className="font-bold" style={{ color: '#D97706' }}>{u.value}</span>
                </div>
                <div className="w-full rounded-full h-2.5" style={{ background: 'linear-gradient(90deg, #F59E0B, #D97706)' }} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Billing History</h2>
          </div>
          <div className="p-16 text-center">
            <div className="text-5xl mb-4">🧾</div>
            <h3 className="font-bold text-gray-700 mb-1">Admin accounts are not billed</h3>
            <p className="text-gray-400 text-sm">No invoices for admin accounts.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Billing">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Billing</h1>
        <p className="text-gray-500 mt-1">Manage your plan and usage.</p>
      </div>

      {/* Current Plan Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Zap size={22} className="text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">Free Plan</p>
              <p className="text-sm text-gray-500">Current plan</p>
            </div>
          </div>
          <button className="gradient-btn px-5 py-2.5 rounded-xl font-semibold text-sm">
            Upgrade Plan
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {usageData.map(u => {
            const pct = Math.round((u.used / u.limit) * 100)
            return (
              <div key={u.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-semibold text-gray-700">{u.label}</span>
                  <span className={`font-bold ${pct >= 100 ? 'text-red-500' : pct >= 80 ? 'text-orange-500' : 'text-gray-900'}`}>
                    {u.used}/{u.limit}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className={`${pct >= 100 ? 'bg-red-400' : u.color} h-2.5 rounded-full transition-all`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                {pct >= 100 && <p className="text-xs text-red-500 mt-1 font-medium">Limit reached — upgrade to continue</p>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {PLANS.map(plan => (
          <div
            key={plan.name}
            className={`bg-white rounded-2xl border shadow-sm p-6 flex flex-col relative ${
              plan.popular ? 'border-blue-300 shadow-blue-100 shadow-md' : 'border-gray-100'
            } ${plan.current ? 'opacity-80' : ''}`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="gradient-btn text-xs font-bold px-3 py-1 rounded-full shadow-sm">Most Popular</span>
              </div>
            )}
            <div className="mb-4">
              <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
              <div className="flex items-baseline gap-0.5 mt-1">
                <span className="text-3xl font-extrabold text-gray-900">{plan.price}</span>
                <span className="text-gray-500 text-sm">{plan.period}</span>
              </div>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <Check size={14} className="text-green-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              disabled={plan.current}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                plan.current
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'gradient-btn hover:-translate-y-0.5'
              }`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Billing History */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Billing History</h2>
        </div>
        <div className="p-16 text-center">
          <div className="text-5xl mb-4">🧾</div>
          <h3 className="font-bold text-gray-700 mb-1">No invoices yet</h3>
          <p className="text-gray-400 text-sm">Your billing history will appear here once you upgrade.</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
