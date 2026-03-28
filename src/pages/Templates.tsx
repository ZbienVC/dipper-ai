import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { ArrowRight, Bot } from 'lucide-react'

const categories = ['All', 'Business', 'Support', 'Marketing', 'Community', 'Personal']

const templates = [
  { name: 'Customer Support Bot', category: 'Support', desc: 'Resolve tickets instantly with context-aware AI responses. Handles FAQs, escalations, and follow-ups.', channels: ['SMS', 'Telegram'], color: 'from-violet-500 to-purple-600' },
  { name: 'Sales Follow-up Agent', category: 'Business', desc: 'Never lose a lead — automatic follow-up sequences across channels with personalized outreach.', channels: ['SMS', 'Email'], color: 'from-blue-500 to-indigo-600' },
  { name: 'SMS Outreach Agent', category: 'Marketing', desc: 'Automated SMS campaigns with personalized follow-ups and smart response handling.', channels: ['SMS'], color: 'from-green-500 to-emerald-600' },
  { name: 'Telegram Community Manager', category: 'Community', desc: 'Moderate groups, answer questions, and engage members 24/7 with intelligent auto-responses.', channels: ['Telegram'], color: 'from-sky-500 to-cyan-600' },
  { name: 'Discord Moderator', category: 'Community', desc: 'Keep your server clean and engaging with intelligent moderation and automated welcome flows.', channels: ['Discord'], color: 'from-indigo-500 to-violet-600' },
  { name: 'Appointment Assistant', category: 'Business', desc: 'Book, reschedule, and remind clients automatically. Integrates with your calendar.', channels: ['SMS', 'Telegram'], color: 'from-teal-500 to-emerald-600' },
  { name: 'Lead Qualifier', category: 'Marketing', desc: 'Qualify and capture leads automatically before they bounce. Score leads and route to CRM.', channels: ['SMS', 'Discord'], color: 'from-orange-500 to-red-600' },
  { name: 'X/Twitter Engagement Bot', category: 'Marketing', desc: 'Auto-engage with mentions, DMs, and target audience content to grow your social presence.', channels: ['X'], color: 'from-slate-500 to-slate-700' },
  { name: 'Onboarding Concierge', category: 'Support', desc: 'Guide new users through your product with personalized onboarding sequences and tips.', channels: ['SMS', 'Telegram'], color: 'from-pink-500 to-rose-600' },
  { name: 'Weekly Report Agent', category: 'Business', desc: 'Automatically compile and send weekly performance summaries to your team.', channels: ['Telegram', 'Email'], color: 'from-blue-400 to-cyan-600' },
  { name: 'Event Promoter', category: 'Community', desc: 'Promote events, manage RSVPs, and send reminders across all channels automatically.', channels: ['SMS', 'Discord', 'Telegram'], color: 'from-yellow-500 to-orange-600' },
  { name: 'Personal Daily Assistant', category: 'Personal', desc: 'Your personal AI assistant that sends daily briefings, reminders, and motivational nudges.', channels: ['SMS', 'Telegram'], color: 'from-violet-400 to-pink-600' },
]

export default function Templates() {
  const [activeCategory, setActiveCategory] = useState('All')
  const navigate = useNavigate()

  const filtered = activeCategory === 'All' ? templates : templates.filter(t => t.category === activeCategory)

  return (
    <DashboardLayout title="Templates">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white mb-1">Template Library</h1>
        <p className="text-slate-500 text-sm">Start with a proven template and customize it in minutes.</p>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeCategory === cat ? 'gradient-btn' : 'bg-white/5 text-slate-400 border border-[#1e1e2e] hover:border-violet-500/30 hover:text-slate-200'
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(t => (
          <div key={t.name} className="bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden hover:border-violet-500/30 hover:bg-violet-500/[0.02] transition-all group">
            <div className={`h-1 bg-gradient-to-r ${t.color}`} />
            <div className="p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Bot size={18} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white text-sm leading-tight mb-1">{t.name}</h3>
                  <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">{t.category}</span>
                </div>
              </div>
              <p className="text-slate-500 text-xs leading-relaxed mb-3">{t.desc}</p>
              <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                {t.channels.map(c => (
                  <span key={c} className="text-xs bg-white/5 text-slate-400 border border-[#1e1e2e] px-2 py-0.5 rounded-full">{c}</span>
                ))}
              </div>
              <button onClick={() => navigate('/dashboard/agents/new')}
                className="w-full gradient-btn py-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5">
                Use Template <ArrowRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  )
}
