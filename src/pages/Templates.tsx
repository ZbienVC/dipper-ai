import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { ArrowRight } from 'lucide-react'

const categories = ['All', 'Business', 'Support', 'Marketing', 'Community', 'Personal']

const templates = [
  {
    emoji: '🎧',
    name: 'Customer Support Bot',
    category: 'Support',
    desc: 'Resolve tickets instantly with context-aware AI responses. Handles FAQs, escalations, and follow-ups automatically.',
    channels: ['SMS', 'Telegram'],
    color: 'from-violet-500 to-purple-600',
  },
  {
    emoji: '💼',
    name: 'Sales Follow-up Agent',
    category: 'Business',
    desc: 'Never lose a lead — automatic follow-up sequences across channels with personalized outreach.',
    channels: ['SMS', 'Email'],
    color: 'from-blue-500 to-indigo-600',
  },
  {
    emoji: '📱',
    name: 'SMS Outreach Agent',
    category: 'Marketing',
    desc: 'Automated SMS campaigns with personalized follow-ups and smart response handling.',
    channels: ['SMS'],
    color: 'from-green-400 to-emerald-500',
  },
  {
    emoji: '✈️',
    name: 'Telegram Community Manager',
    category: 'Community',
    desc: 'Moderate groups, answer questions, and engage members 24/7 with intelligent auto-responses.',
    channels: ['Telegram'],
    color: 'from-sky-400 to-cyan-500',
  },
  {
    emoji: '🛡️',
    name: 'Discord Moderator',
    category: 'Community',
    desc: 'Keep your server clean and engaging with intelligent moderation and automated welcome flows.',
    channels: ['Discord'],
    color: 'from-indigo-500 to-violet-600',
  },
  {
    emoji: '📅',
    name: 'Appointment Assistant',
    category: 'Business',
    desc: 'Book, reschedule, and remind clients of appointments automatically. Integrates with your calendar.',
    channels: ['SMS', 'Telegram'],
    color: 'from-teal-400 to-emerald-500',
  },
  {
    emoji: '🎯',
    name: 'Lead Qualifier',
    category: 'Marketing',
    desc: 'Qualify and capture leads automatically before they bounce. Score leads and route them to your CRM.',
    channels: ['SMS', 'Discord'],
    color: 'from-orange-400 to-red-500',
  },
  {
    emoji: '🌐',
    name: 'X/Twitter Engagement Bot',
    category: 'Marketing',
    desc: 'Auto-engage with mentions, DMs, and target audience content to grow your social presence.',
    channels: ['X'],
    color: 'from-gray-600 to-gray-800',
  },
  {
    emoji: '🤝',
    name: 'Onboarding Concierge',
    category: 'Support',
    desc: 'Guide new users through your product with personalized onboarding sequences and tips.',
    channels: ['SMS', 'Telegram'],
    color: 'from-pink-400 to-rose-500',
  },
  {
    emoji: '📊',
    name: 'Weekly Report Agent',
    category: 'Business',
    desc: 'Automatically compile and send weekly performance summaries to your team and stakeholders.',
    channels: ['Telegram', 'Email'],
    color: 'from-blue-400 to-cyan-500',
  },
  {
    emoji: '🎉',
    name: 'Event Promoter',
    category: 'Community',
    desc: 'Promote events, manage RSVPs, and send reminders across all your channels automatically.',
    channels: ['SMS', 'Discord', 'Telegram'],
    color: 'from-yellow-400 to-orange-500',
  },
  {
    emoji: '🧘',
    name: 'Personal Daily Assistant',
    category: 'Personal',
    desc: 'Your personal AI assistant that sends daily briefings, reminders, and motivational nudges.',
    channels: ['SMS', 'Telegram'],
    color: 'from-violet-400 to-pink-500',
  },
]

export default function Templates() {
  const [activeCategory, setActiveCategory] = useState('All')
  const navigate = useNavigate()

  const filtered = activeCategory === 'All'
    ? templates
    : templates.filter(t => t.category === activeCategory)

  return (
    <DashboardLayout title="Templates">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Template Library</h1>
        <p className="text-gray-500">Start with a proven template and customize it in minutes.</p>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 flex-wrap mb-8">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeCategory === cat
                ? 'text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
            style={activeCategory === cat ? { background: 'linear-gradient(90deg, #2563EB, #7C3AED)' } : {}}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map(t => (
          <div
            key={t.name}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 overflow-hidden group"
          >
            <div className={`h-1.5 bg-gradient-to-r ${t.color}`} />
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${t.color} flex items-center justify-center text-2xl flex-shrink-0`}>
                  {t.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-base leading-tight mb-1">{t.name}</h3>
                  <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
                    {t.category}
                  </span>
                </div>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">{t.desc}</p>
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                {t.channels.map(c => (
                  <span key={c} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{c}</span>
                ))}
              </div>
              <button
                onClick={() => navigate('/dashboard/agents/new')}
                className="w-full gradient-btn py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 group-hover:opacity-95 transition-all"
              >
                Use Template <ArrowRight size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  )
}
