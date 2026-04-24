import DashboardLayout from '../components/DashboardLayout'
import { useState, useEffect } from 'react'
import { Check, Zap, ExternalLink, Loader2, AlertTriangle } from 'lucide-react'

function getStoredUser() {
  try {
    const raw = localStorage.getItem('dipperai_user')
    if (raw) return JSON.parse(raw) as { email: string; name: string; plan?: string; token?: string }
  } catch {}
  return { email: '', name: 'User', token: undefined }
}

const PLAN_DEFS = [
  {
    key: 'free',
    name: 'Starter',
    price: '$0',
    period: '/mo',
    features: [
      '1 AI Agent',
      '500 messages/month',
      '2 integrations',
      'Claude Haiku only',
      'Community support',
    ],
    cta: 'Current Plan',
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$29',
    period: '/mo',
    popular: true,
    features: [
      '5 AI Agents',
      '5,000 messages/month',
      'All integrations',
      'All AI models',
      'Long-term memory',
      'Always-on agents',
      'Email support',
    ],
    cta: 'Upgrade to Pro',
  },
  {
    key: 'business',
    name: 'Business',
    price: '$79',
    period: '/mo',
    features: [
      'Unlimited agents',
      '25,000 messages/month',
      'All integrations & models',
      'Custom branding',
      'Team members (up to 5)',
      'API access',
      'Priority support',
    ],
    cta: 'Upgrade to Business',
  },
]

type UsageData = {
  plan: string
  currentMonth: string
  planPrice?: number
  usage: {
    messages: { used: number; limit: number }
    agents: { used: number; limit: number }
    integrations: { used: number; limit: number }
  }
}

export default function Billing() {
  const storedUser = getStoredUser()
  const [billingUsage, setBillingUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [billingConfigured, setBillingConfigured] = useState<boolean | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  const token = storedUser.token

  useEffect(() => {
    if (window.location.search.includes('success=true')) {
      setSuccessMsg('🎉 Subscription activated! Your plan will update shortly.')
    }
  }, [])

  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch('/api/billing/usage', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setBillingUsage(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  const currentPlan = billingUsage?.plan || storedUser.plan || 'free'
  const isOnPaidPlan = currentPlan !== 'free'

  async function handleUpgrade(planKey: string) {
    if (!token) return
    setUpgradeLoading(planKey)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planKey }),
      })
      const data = await res.json()
      if (data.demo) {
        setBillingConfigured(false)
        setUpgradeLoading(null)
        return
      }
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || 'Checkout failed')
      }
    } catch {
      alert('Connection error')
    }
    setUpgradeLoading(null)
  }

  async function handlePortal() {
    if (!token) return
    setPortalLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank')
      } else if (data.demo) {
        setBillingConfigured(false)
      } else {
        alert(data.error || 'Could not open portal')
      }
    } catch {
      alert('Connection error')
    }
    setPortalLoading(false)
  }

  const PLANS = PLAN_DEFS.map(p => ({ ...p, current: p.key === currentPlan }))

  // Usage meters from billing/usage endpoint
  const usageMeters = billingUsage ? [
    {
      label: 'Messages',
      used: billingUsage.usage.messages.used,
      limit: billingUsage.usage.messages.limit,
      color: 'bg-violet-500',
    },
    {
      label: 'Agents',
      used: billingUsage.usage.agents.used,
      limit: billingUsage.usage.agents.limit,
      color: 'bg-blue-500',
    },
    {
      label: 'Integrations',
      used: billingUsage.usage.integrations.used,
      limit: billingUsage.usage.integrations.limit === 999 ? 999 : billingUsage.usage.integrations.limit,
      color: 'bg-emerald-500',
    },
  ] : []

  return (
    <DashboardLayout title="Billing">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Billing</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Manage your plan and usage.</p>
      </div>

      {successMsg && (
        <div className="mb-5 bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-green-400 text-sm font-semibold">
          {successMsg}
        </div>
      )}

      {billingConfigured === false && (
        <div className="mb-5 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-amber-400 text-sm">
          <strong>Billing not configured.</strong> Set up STRIPE_SECRET_KEY and price IDs to enable real payments.
        </div>
      )}

      {/* Current Plan + Usage */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Zap size={18} className="text-violet-400" />
            </div>
            <div>
              <p className="font-bold text-white capitalize">{currentPlan === 'free' ? 'Starter' : currentPlan} Plan</p>
              <p className="text-xs text-slate-500">
                {billingUsage?.currentMonth ? `Usage for ${billingUsage.currentMonth}` : 'Current plan'}
              </p>
            </div>
          </div>
          {isOnPaidPlan && (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors border border-violet-500/30 px-4 py-2 rounded-xl disabled:opacity-50"
            >
              {portalLoading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
              Manage Subscription
            </button>
          )}
        </div>

        {/* Usage meters */}
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 size={14} className="animate-spin" /> Loading usage...
          </div>
        ) : usageMeters.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {usageMeters.map(u => {
              const isUnlimited = u.limit === 999
              const pct = isUnlimited ? 0 : Math.round((u.used / u.limit) * 100)
              return (
                <div key={u.label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-semibold text-slate-300">{u.label}</span>
                    <span className={`font-bold ${pct >= 100 ? 'text-red-400' : pct >= 80 ? 'text-amber-400' : 'text-white'}`}>
                      {u.used}{isUnlimited ? '' : `/${u.limit}`}
                      {isUnlimited && <span className="text-slate-500 text-xs ml-1">unlimited</span>}
                    </span>
                  </div>
                  {!isUnlimited && (
                    <div className="w-full bg-white/5 rounded-full h-1.5">
                      <div
                        className={`${pct >= 100 ? 'bg-red-500' : u.color} h-1.5 rounded-full transition-all`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  )}
                  {pct >= 80 && pct < 100 && (
                    <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                      <AlertTriangle size={10} /> {pct}% used — consider upgrading
                    </p>
                  )}
                  {pct >= 100 && (
                    <p className="text-xs text-red-400 mt-1">Limit reached — upgrade to continue</p>
                  )}
                </div>
              )
            })}
          </div>
        ) : null}

        {/* Upgrade CTA if on free and near limits */}
        {!isOnPaidPlan && billingUsage && billingUsage.usage.messages.limit > 0 && (
          (() => {
            const msgPct = Math.round((billingUsage.usage.messages.used / billingUsage.usage.messages.limit) * 100)
            if (msgPct >= 80) return (
              <div className="mt-4 bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 flex items-center justify-between gap-3">
                <p className="text-sm text-violet-300">You've used <strong>{msgPct}%</strong> of your monthly messages. Upgrade to Pro for 10× more.</p>
                <button
                  onClick={() => handleUpgrade('pro')}
                  disabled={upgradeLoading === 'pro'}
                  className="gradient-btn px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5"
                >
                  {upgradeLoading === 'pro' ? <Loader2 size={12} className="animate-spin" /> : null}
                  Upgrade to Pro
                </button>
              </div>
            )
            return null
          })()
        )}
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {PLANS.map(plan => (
          <div key={plan.name} className={`bg-[#111118] rounded-xl border p-5 flex flex-col relative ${
            plan.popular ? 'border-violet-500/40' : 'border-[#1e1e2e]'
          } ${plan.current ? 'ring-1 ring-violet-500/30' : ''}`}>
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="gradient-btn text-xs font-bold px-3 py-1 rounded-full">Most Popular</span>
              </div>
            )}
            {plan.current && (
              <div className="absolute top-3 right-3">
                <div className="flex items-center gap-1 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
                  <Check size={10} className="text-green-400" />
                  <span className="text-green-400 text-xs font-semibold">Active</span>
                </div>
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

            {plan.current ? (
              <button disabled className="w-full py-2.5 rounded-xl font-semibold text-sm bg-white/5 text-slate-500 cursor-not-allowed border border-[#1e1e2e]">
                Current Plan
              </button>
            ) : plan.key === 'free' ? (
              <button disabled className="w-full py-2.5 rounded-xl font-semibold text-sm bg-white/5 text-slate-500 cursor-not-allowed border border-[#1e1e2e]">
                Downgrade
              </button>
            ) : billingConfigured === false ? (
              <button disabled className="w-full py-2.5 rounded-xl font-semibold text-sm bg-white/5 text-slate-500 cursor-not-allowed border border-[#1e1e2e]">
                Coming Soon
              </button>
            ) : (
              <button
                onClick={() => handleUpgrade(plan.key)}
                disabled={upgradeLoading === plan.key}
                className="w-full py-2.5 rounded-xl font-semibold text-sm gradient-btn flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {upgradeLoading === plan.key ? <Loader2 size={14} className="animate-spin" /> : null}
                {plan.cta}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Billing History */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-[#1e1e2e]">
          <h2 className="text-sm font-semibold text-white">Billing History</h2>
        </div>
        <div className="p-16 text-center">
          {isOnPaidPlan ? (
            <div>
              <p className="font-semibold text-slate-400 text-sm mb-3">View invoices and billing history in the customer portal.</p>
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="gradient-btn px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 mx-auto"
              >
                {portalLoading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                Open Billing Portal
              </button>
            </div>
          ) : (
            <p className="font-semibold text-slate-500 text-sm">No invoices yet. Upgrade to see billing history.</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
