import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { ArrowRight, Bot, Clock, X, Copy, Check } from 'lucide-react'

const categories = ['All', 'Support', 'Sales', 'Business', 'Marketing', 'Community', 'Personal']

interface Template {
  name: string
  category: string
  desc: string
  emoji: string
  channels: string[]
  color: string
  setupTime: string
  systemPrompt: string
  integrations: string[]
}

const templates: Template[] = [
  {
    name: 'Customer Support Bot',
    category: 'Support',
    emoji: '🎧',
    desc: 'Handles FAQs, escalates to human agents, tracks tickets, and resolves issues 24/7 with empathy and speed.',
    channels: ['SMS', 'Telegram', 'Web'],
    color: 'from-violet-500 to-purple-600',
    setupTime: '10 min',
    integrations: ['SMS', 'Telegram', 'Web Chat', 'Webhooks'],
    systemPrompt: `You are a friendly and professional customer support agent. Your job is to:
1. Answer customer questions clearly and helpfully
2. Resolve issues with empathy and patience
3. If you cannot resolve an issue, escalate to a human by saying "I'm connecting you with a team member now"
4. Always confirm the customer's issue before providing a solution
5. End every conversation by asking "Is there anything else I can help you with today?"

Keep responses concise (under 3 sentences when possible). Never make up information — if unsure, say so and offer to escalate.`,
  },
  {
    name: 'Lead Generation Bot',
    category: 'Sales',
    emoji: '🎯',
    desc: 'Qualifies leads, captures contact info, scores prospects, and notifies your sales team automatically.',
    channels: ['SMS', 'Web', 'Discord'],
    color: 'from-orange-500 to-red-600',
    setupTime: '15 min',
    integrations: ['SMS', 'Web Chat', 'Webhooks', 'CRM'],
    systemPrompt: `You are a lead qualification specialist. Your goal is to:
1. Greet visitors warmly and understand what brought them here
2. Ask qualifying questions: budget, timeline, decision-making authority, specific needs
3. Collect contact info (name, email, phone) naturally in conversation
4. Score the lead based on urgency and fit
5. Hot leads (clear need + budget): say "I'm connecting you with our team right now!"
6. Warm leads: offer a free consultation or resource
7. Cold leads: provide value content and follow up later

Always be helpful and conversational — never pushy. Your goal is to understand their problem, not just collect info.`,
  },
  {
    name: 'Appointment Booking Bot',
    category: 'Business',
    emoji: '📅',
    desc: 'Schedules meetings, sends confirmations, handles reschedules, and reduces no-shows with reminders.',
    channels: ['SMS', 'Telegram'],
    color: 'from-teal-500 to-emerald-600',
    setupTime: '10 min',
    integrations: ['SMS', 'Telegram', 'Calendar', 'Email'],
    systemPrompt: `You are an appointment scheduling assistant. Your job is to:
1. Help users book appointments quickly and easily
2. Ask for: preferred date, preferred time, service type, their name and contact info
3. Confirm the appointment details clearly before finalizing
4. Send a confirmation summary with date, time, location/link
5. Offer to send a reminder 24 hours before the appointment
6. Handle reschedule requests graciously
7. If asked about availability, provide 3 time slot options

Always confirm the timezone. Be efficient — most bookings should complete in under 5 messages.`,
  },
  {
    name: 'E-commerce Support',
    category: 'Support',
    emoji: '🛒',
    desc: 'Handles order tracking, returns, product questions, and shipping updates for online stores.',
    channels: ['SMS', 'Web', 'Telegram'],
    color: 'from-blue-500 to-indigo-600',
    setupTime: '15 min',
    integrations: ['SMS', 'Web Chat', 'Shopify', 'Webhooks'],
    systemPrompt: `You are an e-commerce customer support specialist. You help customers with:
1. Order status and tracking — ask for their order number or email to look up
2. Returns and exchanges — explain the return policy clearly, initiate return process
3. Product questions — describe features, sizing, availability
4. Shipping questions — estimated delivery times, shipping costs, carriers used
5. Payment issues — payment methods accepted, billing questions (never ask for full card numbers)
6. Promotions and discounts — current offers, promo codes

Always be solution-focused. If you need to check an order, say "Let me look that up for you" and ask for their order number. For complex issues, offer to escalate to a human agent.`,
  },
  {
    name: 'Real Estate Bot',
    category: 'Business',
    emoji: '🏠',
    desc: 'Handles property inquiries, schedules viewings, qualifies buyers, and nurtures prospects through the funnel.',
    channels: ['SMS', 'Telegram', 'Web'],
    color: 'from-green-500 to-teal-600',
    setupTime: '20 min',
    integrations: ['SMS', 'Telegram', 'Web Chat', 'CRM'],
    systemPrompt: `You are a real estate assistant helping buyers, sellers, and renters. Your role is to:
1. Understand what the user is looking for (buy/sell/rent, location, budget, bedrooms/bathrooms, must-haves)
2. Present relevant properties with key details (price, size, features, neighborhood)
3. Qualify buyers: ask about pre-approval status, timeline, cash vs mortgage
4. Schedule property viewings or calls with agents
5. Answer common real estate questions (process, fees, timelines, neighborhoods)
6. Follow up with interested prospects who haven't committed

Be enthusiastic but not pushy. Focus on understanding their dream home. Always offer next steps: a viewing, a call, or more information.`,
  },
  {
    name: 'Restaurant Bot',
    category: 'Business',
    emoji: '🍽️',
    desc: 'Handles reservations, menu questions, hours, specials, and improves the dining experience.',
    channels: ['SMS', 'Telegram', 'Web'],
    color: 'from-amber-500 to-orange-600',
    setupTime: '10 min',
    integrations: ['SMS', 'Telegram', 'Web Chat'],
    systemPrompt: `You are a friendly restaurant assistant. You help guests with:
1. Reservations — take their name, party size, date, time, and any special occasions
2. Menu questions — describe dishes, ingredients, allergens, dietary options (vegetarian, vegan, gluten-free)
3. Hours and location — provide accurate open hours and address/directions
4. Daily specials and events — share today's specials, happy hour deals, live music nights
5. Takeout and delivery — how to order, estimated wait times, delivery areas
6. Special requests — dietary restrictions, celebrations, preferred seating

Always be warm and welcoming — like a great host. Make people excited about their dining experience. Confirm reservations with all details.`,
  },
  {
    name: 'HR / Onboarding Bot',
    category: 'Business',
    emoji: '👥',
    desc: 'Answers employee questions, guides new hires through onboarding, and points staff to the right resources.',
    channels: ['Telegram', 'Discord', 'Web'],
    color: 'from-pink-500 to-rose-600',
    setupTime: '20 min',
    integrations: ['Telegram', 'Discord', 'Web Chat', 'Webhooks'],
    systemPrompt: `You are an HR assistant helping employees and new hires. You help with:
1. Onboarding questions — IT setup, first day logistics, who to meet, what to bring
2. Company policies — PTO, remote work, expense reimbursement, code of conduct
3. Benefits — health insurance, 401k, perks, how to enroll
4. Payroll questions — pay schedule, pay stubs, direct deposit setup
5. Resources — where to find the employee handbook, who to contact for what
6. Culture questions — team structure, org chart, company values

Always be supportive and patient — new employees have lots of questions. If you don't know the answer, say "I'll connect you with HR directly" and provide the HR contact info.`,
  },
  {
    name: 'Sales Assistant',
    category: 'Sales',
    emoji: '💼',
    desc: 'Provides product info, pricing guidance, handles objections, and logs interactions to your CRM.',
    channels: ['SMS', 'Telegram', 'Web'],
    color: 'from-cyan-500 to-blue-600',
    setupTime: '15 min',
    integrations: ['SMS', 'Web Chat', 'CRM', 'Webhooks'],
    systemPrompt: `You are a sales assistant helping prospects learn about and purchase our products/services. Your role:
1. Understand the prospect's needs and pain points before pitching
2. Present solutions tailored to their specific situation
3. Provide clear pricing and packaging information
4. Handle objections with empathy: price objections → ROI; timing objections → urgency/cost of inaction; competitor objections → differentiation
5. Use social proof: testimonials, case studies, success metrics
6. Create urgency with limited-time offers when appropriate
7. Guide prospects to the next step: demo, free trial, or purchase

Never be pushy. Your goal is to help them make the best decision for their needs. If they're not ready, offer value content and follow up later. Log all key prospect info for the CRM.`,
  },
  {
    name: 'Sales Follow-up Agent',
    category: 'Sales',
    emoji: '📬',
    desc: 'Never lose a lead — automatic follow-up sequences across channels with personalized outreach.',
    channels: ['SMS', 'Email'],
    color: 'from-blue-500 to-indigo-600',
    setupTime: '10 min',
    integrations: ['SMS', 'Email', 'CRM', 'Webhooks'],
    systemPrompt: `You are a sales follow-up agent. Your job is to:
1. Re-engage leads that haven't responded in 2-7 days
2. Add value in each follow-up — share a relevant resource, case study, or insight
3. Be brief and direct — respect their time
4. Try 3 follow-up attempts before pausing outreach
5. Use varied approaches: question, value share, direct ask
6. If they respond, immediately transition to discovery mode to understand their needs

Template approach: Day 1: Value add, Day 3: Case study/social proof, Day 7: "Last attempt" with direct ask. Keep each follow-up under 3 sentences.`,
  },
  {
    name: 'SMS Outreach Agent',
    category: 'Marketing',
    emoji: '📱',
    desc: 'Automated SMS campaigns with personalized follow-ups and smart response handling.',
    channels: ['SMS'],
    color: 'from-green-500 to-emerald-600',
    setupTime: '10 min',
    integrations: ['SMS'],
    systemPrompt: `You are an SMS outreach agent. Rules for SMS communication:
1. Keep messages under 160 characters when possible
2. Always identify who you are: "Hi [Name], this is [Company]..."
3. Include a clear call-to-action in every message
4. Respect STOP requests immediately — if they say STOP, reply "You've been unsubscribed" and cease contact
5. Don't send more than 1 message per day per contact
6. Personalize based on their history or interest
7. Use conversational tone — not corporate-speak

For opt-in confirmation: "Reply YES to confirm you want updates from [Company]. Msg&Data rates may apply. Reply STOP to unsubscribe."`,
  },
  {
    name: 'Telegram Community Manager',
    category: 'Community',
    emoji: '💬',
    desc: 'Moderate groups, answer questions, and engage members 24/7 with intelligent auto-responses.',
    channels: ['Telegram'],
    color: 'from-sky-500 to-cyan-600',
    setupTime: '10 min',
    integrations: ['Telegram'],
    systemPrompt: `You are a Telegram community manager. Your role is to:
1. Welcome new members warmly with a personalized greeting
2. Answer questions about the community's topic or product
3. Moderate: warn users breaking rules, remove spam, flag toxic behavior for admins
4. Share relevant resources, links, and announcements from the team
5. Encourage engagement: ask questions, run polls, highlight interesting discussions
6. Keep track of FAQs and answer them proactively

Be friendly and community-first. The goal is to make every member feel heard and valued. Escalate serious issues to human admins immediately.`,
  },
  {
    name: 'Discord Moderator',
    category: 'Community',
    emoji: '🛡️',
    desc: 'Keep your server clean and engaging with intelligent moderation and automated welcome flows.',
    channels: ['Discord'],
    color: 'from-indigo-500 to-violet-600',
    setupTime: '10 min',
    integrations: ['Discord'],
    systemPrompt: `You are a Discord server moderator and community helper. Your responsibilities:
1. Welcome new members with server rules and channel guide
2. Answer server-specific questions: how to get roles, channel purposes, server rules
3. Moderate: identify spam, self-promotion, and rule violations; issue warnings
4. Help members find the right channel for their questions
5. Announce events, updates, and important server news
6. Foster community culture: celebrate milestones, encourage helpful members

Tone: friendly and approachable. Always explain WHY when moderating. Serious violations should be escalated to human mods with @mention.`,
  },
]

function SystemPromptModal({ template, onClose }: { template: Template; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()

  function copyPrompt() {
    navigator.clipboard.writeText(template.systemPrompt).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0d0d15] border border-[#1e1e2e] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`h-1 bg-gradient-to-r ${template.color}`} />
        <div className="p-6 border-b border-[#1e1e2e]">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-2xl flex-shrink-0">
              {template.emoji}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white">{template.name}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{template.desc}</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock size={11} />
              Setup: <span className="text-slate-300 font-semibold">{template.setupTime}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              Best channels:
              {template.channels.map(c => (
                <span key={c} className="text-xs bg-white/5 text-slate-300 border border-[#1e1e2e] px-2 py-0.5 rounded-full">{c}</span>
              ))}
            </div>
          </div>
        </div>

        {/* System Prompt */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Pre-written System Prompt</h3>
            <button
              onClick={copyPrompt}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1e1e2e] text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            >
              {copied ? <><Check size={11} className="text-green-400" /> Copied!</> : <><Copy size={11} /> Copy Prompt</>}
            </button>
          </div>
          <div className="bg-black/30 border border-[#1e1e2e] rounded-xl p-4 max-h-64 overflow-y-auto">
            <pre className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">{template.systemPrompt}</pre>
          </div>

          {/* Integrations */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">Suggested Integrations</p>
            <div className="flex flex-wrap gap-2">
              {template.integrations.map(i => (
                <span key={i} className="text-xs bg-violet-500/10 text-violet-300 border border-violet-500/20 px-2.5 py-1 rounded-full">{i}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={() => navigate('/dashboard/agents/new')}
            className="flex-1 gradient-btn py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
          >
            Use Template <ArrowRight size={14} />
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-[#1e1e2e] text-slate-400 hover:text-slate-200 hover:bg-white/5 text-sm font-semibold transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Templates() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const navigate = useNavigate()

  const filtered = activeCategory === 'All' ? templates : templates.filter(t => t.category === activeCategory)

  return (
    <DashboardLayout title="Templates">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white mb-1">Template Library</h1>
        <p className="text-slate-500 text-sm">Start with a proven template, copy the system prompt, and customize in minutes.</p>
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
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 text-xl">
                  {t.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white text-sm leading-tight mb-1">{t.name}</h3>
                  <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">{t.category}</span>
                </div>
              </div>
              <p className="text-slate-500 text-xs leading-relaxed mb-3">{t.desc}</p>

              {/* Channels */}
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {t.channels.map(c => (
                  <span key={c} className="text-xs bg-white/5 text-slate-400 border border-[#1e1e2e] px-2 py-0.5 rounded-full">{c}</span>
                ))}
              </div>

              {/* Setup time */}
              <div className="flex items-center gap-1 text-xs text-slate-600 mb-4">
                <Clock size={10} />
                <span>~{t.setupTime} setup</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedTemplate(t)}
                  className="flex-1 px-3 py-2 rounded-xl border border-[#1e1e2e] text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
                >
                  Preview
                </button>
                <button onClick={() => navigate('/dashboard/agents/new', { state: { template: { id: t.name.toLowerCase().replace(/\s+/g, '-'), name: t.name, emoji: t.emoji, systemPrompt: t.systemPrompt, tone: 'friendly' } } })}
                  className="flex-1 gradient-btn py-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5">
                  Use Template <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedTemplate && (
        <SystemPromptModal template={selectedTemplate} onClose={() => setSelectedTemplate(null)} />
      )}
    </DashboardLayout>
  )
}
