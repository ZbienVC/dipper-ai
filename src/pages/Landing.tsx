import { Link } from 'react-router-dom'
import {
  ArrowRight, Zap, Bot, Shield, Globe, Check, MessageSquare,
  BarChart2, Plug, Users, TrendingUp, ChevronRight, Star
} from 'lucide-react'

const features = [
  {
    icon: Bot,
    title: 'AI Agents That Work For You',
    desc: 'Deploy purpose-built AI agents that handle conversations across every channel. From customer support to sales outreach — fully automated.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  {
    icon: Plug,
    title: 'Connect Every Channel',
    desc: 'SMS, Telegram, Discord, X/Twitter, and WhatsApp. One agent, every platform. Meet your audience wherever they are.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    icon: BarChart2,
    title: 'Real-Time Analytics',
    desc: 'Track message volume, response rates, and agent performance in a unified dashboard. Know what\'s working instantly.',
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
  },
  {
    icon: Shield,
    title: 'Human-in-the-Loop',
    desc: 'Approval workflows ensure your agents say exactly what you want. Review, edit, or approve messages before they send.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
]

const steps = [
  { num: '01', title: 'Create Your Agent', desc: 'Name it, choose a template or start from scratch. Set up personality, tone, and behavior in minutes.' },
  { num: '02', title: 'Define Its Knowledge', desc: 'Upload docs, paste URLs, or write instructions. Your agent learns exactly what you need it to know.' },
  { num: '03', title: 'Connect Channels', desc: 'Link SMS, Telegram, Discord, or embed on your site. One-click deployment to any platform.' },
  { num: '04', title: 'Launch & Monitor', desc: 'Go live instantly. Monitor conversations, performance, and iterate from your dashboard.' },
]

const templates = [
  { name: 'Customer Support Bot', category: 'Support', desc: 'Handle tickets 24/7 with context-aware responses.' },
  { name: 'Sales Follow-up Agent', category: 'Sales', desc: 'Never lose a lead with automated outreach sequences.' },
  { name: 'Telegram Community Manager', category: 'Community', desc: 'Moderate and engage your community around the clock.' },
  { name: 'SMS Outreach Agent', category: 'Marketing', desc: 'Personalized SMS campaigns that actually convert.' },
  { name: 'Discord Moderator', category: 'Community', desc: 'Intelligent moderation and welcome flows.' },
  { name: 'Lead Qualifier', category: 'Sales', desc: 'Qualify prospects automatically before they bounce.' },
]

const stats = [
  { value: '10,000+', label: 'Agents Deployed' },
  { value: '50M+', label: 'Messages Sent' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '< 1.2s', label: 'Avg Response Time' },
]

const pricing = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: ['1 AI Agent', '100 messages/month', 'Basic templates', 'SMS & Telegram', 'Community support'],
    cta: 'Get Started Free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    features: ['10 AI Agents', '10,000 messages/month', 'All templates', 'All channels', 'Priority support', 'Advanced analytics', 'Custom commands'],
    cta: 'Start Pro Trial',
    highlight: true,
  },
  {
    name: 'Business',
    price: '$149',
    period: '/month',
    features: ['Unlimited Agents', 'Unlimited messages', 'Custom templates', 'Dedicated support', 'Team workspace', 'API access', 'White-label'],
    cta: 'Contact Sales',
    highlight: false,
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-400">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-[#1e1e2e]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
              <Zap size={14} className="text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">DipperAI</span>
          </div>
          <div className="hidden md:flex items-center gap-7">
            <a href="#features" className="text-slate-400 hover:text-white text-sm font-medium transition-colors">Features</a>
            <a href="#templates" className="text-slate-400 hover:text-white text-sm font-medium transition-colors">Templates</a>
            <a href="#pricing" className="text-slate-400 hover:text-white text-sm font-medium transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-slate-400 hover:text-white text-sm font-medium px-3 py-2 transition-colors">Sign In</Link>
            <Link to="/signup" className="gradient-btn text-sm font-semibold px-4 py-2 rounded-xl">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-20 px-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-20" style={{ background: 'radial-gradient(ellipse, #7c3aed 0%, transparent 70%)' }} />
        
        <div className="max-w-5xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold px-4 py-2 rounded-full mb-8">
            <Zap size={12} />
            No coding required — launch in minutes
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.05]">
            <span className="gradient-text">Build AI Agents</span>
            <br />
            <span className="text-white">in Minutes</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Deploy AI agents that handle SMS, Telegram, Discord, and social conversations automatically.
            No engineers needed.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link to="/signup" className="gradient-btn font-bold px-8 py-3.5 rounded-xl text-base flex items-center gap-2">
              Get Started Free <ArrowRight size={16} />
            </Link>
            <Link to="/signup" className="flex items-center gap-2 text-slate-300 font-semibold px-8 py-3.5 rounded-xl border border-[#1e1e2e] hover:bg-white/5 transition-colors text-sm">
              View Demo <ChevronRight size={16} />
            </Link>
          </div>
          <p className="text-xs text-slate-600 mt-5">Free forever · No credit card required</p>

          {/* Hero visual — terminal */}
          <div className="mt-16 relative max-w-2xl mx-auto">
            <div className="absolute inset-0 rounded-2xl opacity-30" style={{ background: 'radial-gradient(ellipse at center, #7c3aed 0%, transparent 70%)', filter: 'blur(40px)' }} />
            <div className="relative bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6 shadow-2xl text-left">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="text-slate-600 text-xs ml-2 font-mono">DipperAI Agent Console</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Bot size={14} className="text-violet-400" />
                  </div>
                  <div className="bg-[#16161f] border border-[#1e1e2e] rounded-2xl rounded-tl-sm px-4 py-3 text-slate-200 text-sm max-w-sm">
                    Hey! I noticed you left items in your cart. Can I help you complete your order?
                  </div>
                </div>
                <div className="flex items-start gap-3 justify-end">
                  <div className="bg-violet-600 rounded-2xl rounded-tr-sm px-4 py-3 text-white text-sm max-w-xs">
                    Yeah, I had a question about shipping times
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Users size={14} className="text-slate-400" />
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Bot size={14} className="text-violet-400" />
                  </div>
                  <div className="bg-[#16161f] border border-[#1e1e2e] rounded-2xl rounded-tl-sm px-4 py-3 text-slate-200 text-sm max-w-sm">
                    Standard shipping is 3-5 days. Express is 1-2 days. Your order qualifies for <span className="text-violet-400 font-semibold">free express shipping</span> today!
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-11">
                  {[0, 150, 300].map(d => (
                    <div key={d} className="w-2 h-2 rounded-full bg-violet-500/60 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                  <span className="text-slate-600 text-xs">Agent is typing...</span>
                </div>
              </div>
            </div>
          </div>

          {/* Social proof */}
          <div className="mt-10 flex flex-wrap justify-center gap-6 items-center">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Shield size={14} className="text-green-400" />
              <span>SOC 2 Compliant</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Star size={14} className="text-amber-400" />
              <span>4.9/5 from 500+ reviews</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Globe size={14} className="text-violet-400" />
              <span>10,000+ agents deployed</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 border-y border-[#1e1e2e]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-white mb-1">{s.value}</p>
              <p className="text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-white mb-4">Everything you need to automate</h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">DipperAI gives you the tools to build, deploy, and scale AI agents across every channel your customers use.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map(f => (
              <div key={f.title} className={`bg-[#111118] border ${f.border} rounded-2xl p-7 hover:border-opacity-60 transition-colors`}>
                <div className={`w-12 h-12 rounded-xl ${f.bg} border ${f.border} flex items-center justify-center mb-5`}>
                  <f.icon size={22} className={f.color} />
                </div>
                <h3 className="text-lg font-bold text-white mb-3">{f.title}</h3>
                <p className="text-slate-500 leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 bg-[#0d0d15] border-y border-[#1e1e2e]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-white mb-4">How it works</h2>
            <p className="text-lg text-slate-500">Four simple steps to your first AI agent</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={step.num} className="relative">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-2xl gradient-btn flex items-center justify-center font-bold text-lg mx-auto mb-4">
                    {i + 1}
                  </div>
                  <div className="text-xs font-bold text-violet-400 tracking-wider mb-2">{step.num}</div>
                  <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates */}
      <section id="templates" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-white mb-4">Ready-to-deploy templates</h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">Start with a proven template and customize it in minutes.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(t => (
              <div key={t.name} className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-5 hover:border-violet-500/30 hover:bg-violet-500/[0.02] transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <Bot size={18} className="text-violet-400" />
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">{t.category}</span>
                </div>
                <h3 className="font-bold text-white text-sm mb-1">{t.name}</h3>
                <p className="text-slate-500 text-xs leading-relaxed mb-4">{t.desc}</p>
                <Link to="/signup" className="text-violet-400 hover:text-violet-300 text-xs font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                  Use Template <ArrowRight size={12} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-20 px-6 bg-[#0d0d15] border-y border-[#1e1e2e]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold text-white mb-4">Connect every channel</h2>
          <p className="text-slate-500 mb-10 text-sm">Meet your customers where they are — on every platform.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {['SMS', 'Telegram', 'Discord', 'X / Twitter', 'WhatsApp'].map(channel => (
              <div key={channel} className="flex items-center gap-2.5 px-5 py-3 bg-[#111118] border border-[#1e1e2e] rounded-xl font-semibold text-sm text-slate-300 hover:border-violet-500/30 transition-colors">
                <Plug size={15} className="text-violet-400" />
                <span>{channel}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-white mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-slate-500">Start free. Scale as you grow. No surprises.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {pricing.map(plan => (
              <div key={plan.name} className={`rounded-2xl p-7 relative flex flex-col ${
                plan.highlight
                  ? 'bg-violet-600/20 border border-violet-500/40'
                  : 'bg-[#111118] border border-[#1e1e2e]'
              }`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="gradient-btn text-xs font-bold px-3 py-1 rounded-full">MOST POPULAR</span>
                  </div>
                )}
                <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                  <span className="text-sm text-slate-500">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5">
                      <Check size={14} className={plan.highlight ? 'text-violet-300' : 'text-green-400'} />
                      <span className={`text-sm ${plan.highlight ? 'text-violet-100' : 'text-slate-400'}`}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signup"
                  className={`block text-center font-semibold py-2.5 px-6 rounded-xl transition-all text-sm ${
                    plan.highlight ? 'bg-white text-violet-700 hover:bg-violet-50' : 'gradient-btn'
                  }`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20 px-6 bg-[#0d0d15] border-t border-[#1e1e2e]">
        <div className="max-w-3xl mx-auto bg-violet-600/10 border border-violet-500/20 rounded-3xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl gradient-btn flex items-center justify-center mx-auto mb-5">
            <TrendingUp size={24} className="text-white" />
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-4">Ready to deploy your first agent?</h2>
          <p className="text-slate-400 mb-8">Join thousands of businesses automating conversations with DipperAI.</p>
          <Link to="/signup" className="gradient-btn inline-flex items-center gap-2 font-bold px-8 py-3.5 rounded-xl text-base">
            Start Building for Free <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1e1e2e] py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                <Zap size={12} className="text-white" />
              </div>
              <span className="text-base font-bold text-white">DipperAI</span>
              <span className="text-slate-600 text-sm ml-1">Build AI Agents in Minutes</span>
            </div>
            <div className="flex items-center gap-5 text-sm text-slate-600">
              <a href="#" className="hover:text-slate-400 transition-colors">Privacy</a>
              <a href="#" className="hover:text-slate-400 transition-colors">Terms</a>
              <a href="#" className="hover:text-slate-400 transition-colors">Docs</a>
              <a href="#" className="hover:text-slate-400 transition-colors">Status</a>
            </div>
            <p className="text-sm text-slate-600">© 2025 DipperAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
