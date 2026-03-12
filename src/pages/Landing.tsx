import { Link } from 'react-router-dom'
import { MessageSquare, Zap, Users, TrendingUp, CheckCircle, ArrowRight, Star, Shield, Globe } from 'lucide-react'

const useCases = [
  { icon: '🎧', title: 'Customer Support', desc: 'Handle thousands of support tickets 24/7 with zero wait time.' },
  { icon: '📈', title: 'Sales Outreach', desc: 'Automate personalized outreach at scale across all channels.' },
  { icon: '🎯', title: 'Lead Capture', desc: 'Qualify and capture leads automatically before they bounce.' },
  { icon: '🌐', title: 'Community Management', desc: 'Moderate and engage your community around the clock.' },
]

const templates = [
  { icon: '📱', name: 'SMS Outreach Agent', desc: 'Automated SMS campaigns with personalized follow-ups and responses.', category: 'Sales', color: 'from-blue-500 to-indigo-600' },
  { icon: '💬', name: 'Telegram Community Manager', desc: 'Moderate groups, answer questions, and engage members 24/7.', category: 'Community', color: 'from-sky-400 to-cyan-500' },
  { icon: '🎧', name: 'Customer Support Bot', desc: 'Resolve tickets instantly with context-aware AI responses.', category: 'Support', color: 'from-violet-500 to-purple-600' },
  { icon: '📅', name: 'Appointment Assistant', desc: 'Book, reschedule, and remind clients of appointments automatically.', category: 'Scheduling', color: 'from-teal-400 to-emerald-500' },
  { icon: '💼', name: 'Sales Follow-up Agent', desc: 'Never lose a lead — automatic follow-up sequences across channels.', category: 'Sales', color: 'from-orange-400 to-red-500' },
  { icon: '🛡️', name: 'Discord Moderator', desc: 'Keep your server clean and engaging with intelligent moderation.', category: 'Community', color: 'from-indigo-500 to-violet-600' },
]

const steps = [
  { num: '01', title: 'Create Agent', desc: 'Name your agent, pick a template or start from scratch in seconds.' },
  { num: '02', title: 'Add Personality', desc: 'Define tone, style, knowledge base, and communication rules.' },
  { num: '03', title: 'Connect Channels', desc: 'Link SMS, Telegram, Discord, X, or embed on your website.' },
  { num: '04', title: 'Launch', desc: 'Go live instantly. Your agent starts working immediately.' },
]

const integrations = [
  { name: 'SMS', icon: '📱', color: 'bg-green-100 text-green-700' },
  { name: 'Telegram', icon: '✈️', color: 'bg-blue-100 text-blue-700' },
  { name: 'X / Twitter', icon: '𝕏', color: 'bg-gray-100 text-gray-700' },
  { name: 'Discord', icon: '🎮', color: 'bg-indigo-100 text-indigo-700' },
  { name: 'WhatsApp', icon: '💬', color: 'bg-emerald-100 text-emerald-700' },
]

const pricing = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: ['1 AI Agent', '100 messages/month', 'Basic templates', 'Email support'],
    cta: 'Get Started Free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    features: ['10 AI Agents', '10,000 messages/month', 'All templates', 'Priority support', 'Advanced analytics', 'Custom commands'],
    cta: 'Start Pro Trial',
    highlight: true,
  },
  {
    name: 'Business',
    price: '$99',
    period: '/month',
    features: ['Unlimited Agents', 'Unlimited messages', 'Custom templates', 'Dedicated support', 'Team workspace', 'API access', 'White-label'],
    cta: 'Contact Sales',
    highlight: false,
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg" style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }} />
            <span className="text-xl font-bold text-gray-900">DipperAI</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Features</a>
            <a href="#templates" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Templates</a>
            <a href="#pricing" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-gray-600 hover:text-gray-900 text-sm font-medium px-4 py-2 transition-colors">
              Sign In
            </Link>
            <Link to="/signup" className="gradient-btn text-sm font-semibold px-5 py-2 rounded-lg">
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-4 py-2 rounded-full mb-8 border border-blue-100">
            <Zap size={14} />
            <span>No coding required — launch in minutes</span>
          </div>
          <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
            <span className="gradient-text">Build AI Agents</span>
            <br />
            <span className="text-gray-900">in Minutes</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-500 max-w-3xl mx-auto mb-10 leading-relaxed">
            Deploy AI agents that handle SMS, Telegram, and social conversations automatically.
            No coding required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/signup" className="gradient-btn font-semibold px-8 py-4 rounded-xl text-lg flex items-center gap-2 shadow-lg shadow-blue-200">
              Get Started Free
              <ArrowRight size={18} />
            </Link>
            <button className="flex items-center gap-3 text-gray-700 font-semibold px-8 py-4 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-colors bg-white">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
                <span className="text-white text-sm">▶</span>
              </div>
              Watch Demo
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-6">Free forever · No credit card required</p>

          {/* Hero visual */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 rounded-3xl blur-3xl opacity-10" style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }} />
            <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 shadow-2xl text-left">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="text-slate-400 text-sm ml-2 font-mono">DipperAI Agent Console</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">A</div>
                  <div className="bg-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 text-slate-100 text-sm max-w-xs">
                    Hey! I noticed you left items in your cart. Can I help you complete your order? 🛒
                  </div>
                </div>
                <div className="flex items-start gap-3 justify-end">
                  <div className="bg-blue-600 rounded-2xl rounded-tr-sm px-4 py-3 text-white text-sm max-w-xs">
                    Yeah, I had a question about shipping times
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-slate-300 text-xs font-bold flex-shrink-0">U</div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">A</div>
                  <div className="bg-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 text-slate-100 text-sm max-w-sm">
                    Great question! Standard shipping is 3-5 days. Express 1-2 days. Your order qualifies for <span className="text-blue-400 font-semibold">free express shipping</span> today! Want me to apply that? 🚀
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 pl-11">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-slate-500 text-xs">Agent is typing...</span>
                </div>
              </div>
            </div>
          </div>

          {/* Social proof */}
          <div className="mt-10 flex flex-wrap justify-center gap-8 items-center">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Shield size={16} className="text-green-500" />
              <span>SOC 2 Compliant</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Star size={16} className="text-yellow-400" />
              <span>4.9/5 from 500+ reviews</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Globe size={16} className="text-blue-500" />
              <span>10,000+ agents deployed</span>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="features" className="py-20 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Built for Every Use Case</h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">From customer support to sales, DipperAI adapts to your business needs.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {useCases.map((uc) => (
              <div key={uc.title} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
                <div className="text-4xl mb-4">{uc.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{uc.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates */}
      <section id="templates" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Ready-to-Deploy Templates</h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">Start with a proven template and customize it to fit your brand in minutes.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 overflow-hidden group">
                <div className={`h-2 bg-gradient-to-r ${t.color}`} />
                <div className="p-6">
                  <div className="text-3xl mb-3">{t.icon}</div>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{t.name}</h3>
                  </div>
                  <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 mb-3">{t.category}</span>
                  <p className="text-gray-500 text-sm leading-relaxed mb-4">{t.desc}</p>
                  <Link to="/signup" className="text-blue-600 hover:text-blue-700 text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                    Use Template <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-lg text-gray-500">Four simple steps to your first AI agent</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <div key={step.num} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-full w-full h-0.5 bg-gradient-to-r from-blue-200 to-violet-200 z-0" style={{ width: 'calc(100% - 3rem)', left: 'calc(50% + 1.5rem)' }} />
                )}
                <div className="relative z-10 text-center">
                  <div className="w-12 h-12 rounded-2xl gradient-btn flex items-center justify-center text-white font-bold text-lg mx-auto mb-4 shadow-lg shadow-blue-200">
                    {i + 1}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Connect Every Channel</h2>
          <p className="text-lg text-gray-500 mb-10">Meet your customers where they are — on every platform.</p>
          <div className="flex flex-wrap justify-center gap-4">
            {integrations.map((int) => (
              <div key={int.name} className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-semibold text-base ${int.color} border border-gray-100 shadow-sm hover:shadow-md transition-shadow`}>
                <span className="text-2xl">{int.icon}</span>
                <span>{int.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-lg text-gray-500">Start free. Scale as you grow. No surprises.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricing.map((plan) => (
              <div key={plan.name} className={`rounded-2xl p-8 relative ${plan.highlight ? 'shadow-2xl shadow-blue-200 scale-105' : 'bg-white border border-gray-100 shadow-sm'}`}
                style={plan.highlight ? { background: 'linear-gradient(135deg, #2563EB, #7C3AED)', color: 'white' } : {}}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-orange-400 text-white text-xs font-bold px-3 py-1 rounded-full">MOST POPULAR</span>
                  </div>
                )}
                <h3 className={`text-xl font-bold mb-1 ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className={`text-5xl font-extrabold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>{plan.price}</span>
                  <span className={`text-sm ${plan.highlight ? 'text-blue-100' : 'text-gray-400'}`}>{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle size={16} className={plan.highlight ? 'text-blue-200' : 'text-green-500'} />
                      <span className={`text-sm ${plan.highlight ? 'text-blue-50' : 'text-gray-600'}`}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signup"
                  className={`block text-center font-semibold py-3 px-6 rounded-xl transition-all ${plan.highlight
                    ? 'bg-white text-blue-600 hover:bg-blue-50'
                    : 'gradient-btn'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto rounded-3xl p-12 text-center shadow-2xl shadow-blue-200" style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Deploy Your First Agent?</h2>
          <p className="text-blue-100 text-lg mb-8">Join thousands of businesses automating conversations with DipperAI.</p>
          <Link to="/signup" className="inline-flex items-center gap-2 bg-white text-blue-600 font-bold px-8 py-4 rounded-xl hover:bg-blue-50 transition-colors text-lg shadow-lg">
            Start Building for Free <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg" style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }} />
              <span className="text-lg font-bold text-gray-900">DipperAI</span>
              <span className="text-gray-400 text-sm ml-2">Build AI Agents in Minutes</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <a href="#" className="hover:text-gray-700 transition-colors">Privacy</a>
              <a href="#" className="hover:text-gray-700 transition-colors">Terms</a>
              <a href="#" className="hover:text-gray-700 transition-colors">Docs</a>
              <a href="#" className="hover:text-gray-700 transition-colors">Status</a>
            </div>
            <p className="text-sm text-gray-400">© 2025 DipperAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
