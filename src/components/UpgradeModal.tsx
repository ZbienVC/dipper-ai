import { X, Zap, Check } from 'lucide-react'

interface UpgradeModalProps {
  feature: string
  onClose: () => void
  onUpgrade: (plan: 'pro' | 'business') => void
}

const PRO_BENEFITS = [
  '5 AI Agents',
  '5,000 messages/month',
  'All integrations & channels',
  'All AI models (Claude Sonnet, GPT-4o Mini)',
  'Long-term memory',
  'Always-on agents',
  'Email support',
]

const BUSINESS_BENEFITS = [
  'Unlimited agents',
  '25,000 messages/month',
  'Custom branding / white-label embed',
  'Team members (up to 5)',
  'API access',
  'Priority support',
]

export default function UpgradeModal({ feature, onClose, onUpgrade }: UpgradeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0f0f17] border border-[#1e1e2e] rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[#1e1e2e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Zap size={18} className="text-violet-400" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Upgrade to unlock this</h2>
              <p className="text-xs text-slate-500 mt-0.5">{feature} requires a paid plan</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Plans */}
        <div className="p-6 grid grid-cols-2 gap-3">
          {/* Pro */}
          <div className="bg-[#111118] border border-violet-500/30 rounded-xl p-4 flex flex-col">
            <div className="mb-3">
              <div className="text-xs font-bold text-violet-400 uppercase tracking-wide mb-1">Pro</div>
              <div className="text-2xl font-bold text-white">$29<span className="text-slate-500 text-sm font-normal">/mo</span></div>
            </div>
            <ul className="space-y-1.5 flex-1 mb-4">
              {PRO_BENEFITS.slice(0, 5).map(b => (
                <li key={b} className="flex items-start gap-1.5 text-xs text-slate-400">
                  <Check size={11} className="text-green-400 flex-shrink-0 mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>
            <button
              onClick={() => onUpgrade('pro')}
              className="w-full gradient-btn py-2 rounded-xl text-xs font-semibold"
            >
              Get Pro
            </button>
          </div>

          {/* Business */}
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-4 flex flex-col">
            <div className="mb-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Business</div>
              <div className="text-2xl font-bold text-white">$79<span className="text-slate-500 text-sm font-normal">/mo</span></div>
            </div>
            <ul className="space-y-1.5 flex-1 mb-4">
              {BUSINESS_BENEFITS.slice(0, 5).map(b => (
                <li key={b} className="flex items-start gap-1.5 text-xs text-slate-400">
                  <Check size={11} className="text-green-400 flex-shrink-0 mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>
            <button
              onClick={() => onUpgrade('business')}
              className="w-full border border-[#2e2e3e] py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors"
            >
              Get Business
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 text-center">
          <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
