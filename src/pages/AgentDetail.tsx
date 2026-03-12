import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import {
  LayoutDashboard, MessageSquare, User, BookOpen, Terminal, Plug,
  Cpu, Brain, BarChart2, Settings, Circle, Send, Bot
} from 'lucide-react'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'personality', label: 'Personality', icon: User },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { id: 'commands', label: 'Commands', icon: Terminal },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'automation', label: 'Automation', icon: Cpu },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const MOCK_AGENTS: Record<string, { name: string; emoji: string; status: string; model: string; messages: number; conversations: number }> = {
  '1': { name: 'Support Pro', emoji: '🎧', status: 'active', model: 'Claude 3.5 Sonnet', messages: 412, conversations: 87 },
  '2': { name: 'The Closer', emoji: '💼', status: 'active', model: 'GPT-4o', messages: 289, conversations: 52 },
  '3': { name: 'Community Bob', emoji: '🌐', status: 'paused', model: 'Gemini 1.5 Pro', messages: 146, conversations: 31 },
  'new-agent': { name: 'New Agent', emoji: '✨', status: 'active', model: 'Claude 3.5 Sonnet', messages: 0, conversations: 0 },
}

const MOCK_RESPONSES = [
  "I'm here to help! Could you tell me more about the issue you're experiencing?",
  "Great question! Based on my knowledge, I can tell you that our support team is available 24/7 to assist you.",
  "I understand your concern. Let me look into that for you right away.",
  "Thanks for reaching out! I've noted your request and will follow up shortly.",
  "That's a common question! Here's what I recommend: start by checking your account settings, then refresh the page.",
]

interface Message {
  role: 'user' | 'agent'
  text: string
  time: string
}

function ChatTab({ agentName }: { agentName: string }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'agent', text: `Hi! I'm ${agentName}. How can I help you today?`, time: 'now' }
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  const send = () => {
    if (!input.trim() || thinking) return
    const userMsg: Message = { role: 'user', text: input.trim(), time: 'now' }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setThinking(true)
    setTimeout(() => {
      const response = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]
      setMessages(prev => [...prev, { role: 'agent', text: response, time: 'now' }])
      setThinking(false)
    }, 1500)
  }

  return (
    <div className="flex flex-col h-[520px]">
      <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-slate-50 rounded-2xl border border-gray-100 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'agent' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
                <Bot size={14} />
              </div>
            )}
            <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'text-white rounded-br-sm'
                : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100 shadow-sm'
            }`} style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #2563EB, #7C3AED)' } : {}}>
              {msg.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex items-end gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
              <Bot size={14} />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
              <span className="text-xs text-gray-500 mr-1">Thinking</span>
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          disabled={thinking}
          placeholder="Type a message..."
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder-gray-400 disabled:opacity-60"
        />
        <button
          onClick={send}
          disabled={!input.trim() || thinking}
          className="gradient-btn px-5 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
        >
          <Send size={16} />
          Send
        </button>
      </div>
    </div>
  )
}

function PersonalityTab() {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label>
        <textarea rows={3} defaultValue="I am a helpful customer support agent, ready to assist users with any questions or issues they encounter."
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Personality Traits</label>
          <input defaultValue="helpful, empathetic, concise, professional"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Tone</label>
          <select defaultValue="friendly" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900">
            <option>Professional</option>
            <option>Friendly & Casual</option>
            <option>Formal</option>
          </select>
        </div>
      </div>
      <button className="gradient-btn px-6 py-2.5 rounded-xl font-semibold text-sm">Save Changes</button>
    </div>
  )
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Settings size={28} className="text-gray-300" />
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">{label}</h3>
      <p className="text-gray-400 text-sm max-w-xs">This section is coming soon. Configure {label.toLowerCase()} for your agent here.</p>
    </div>
  )
}

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState('overview')
  const agent = MOCK_AGENTS[id || '1'] || MOCK_AGENTS['1']

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Agent Header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-3xl flex-shrink-0">
              {agent.emoji}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{agent.name}</h1>
                <span className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full ${
                  agent.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  <Circle size={7} className={agent.status === 'active' ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400'} />
                  {agent.status === 'active' ? 'Active' : 'Paused'}
                </span>
              </div>
              <p className="text-gray-500 text-sm">Powered by {agent.model}</p>
            </div>
            <div className="flex gap-2">
              <button className="border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                {agent.status === 'active' ? 'Pause' : 'Resume'}
              </button>
              <button className="gradient-btn px-4 py-2 rounded-xl text-sm font-semibold">
                Edit Agent
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 overflow-x-auto">
            <div className="flex gap-0 min-w-max px-4">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                  }`}
                >
                  <tab.icon size={15} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Total Messages', value: agent.messages.toLocaleString(), icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Conversations', value: agent.conversations.toString(), icon: User, color: 'text-violet-600', bg: 'bg-violet-50' },
                    { label: 'Avg Response', value: '1.2s', icon: Circle, color: 'text-teal-600', bg: 'bg-teal-50' },
                    { label: 'Satisfaction', value: '94%', icon: BarChart2, color: 'text-green-600', bg: 'bg-green-50' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-slate-50 rounded-2xl p-4 border border-gray-100">
                      <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                        <stat.icon size={18} className={stat.color} />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 rounded-2xl p-5 border border-gray-100">
                  <h3 className="font-semibold text-gray-700 mb-3 text-sm">Recent Activity</h3>
                  <div className="space-y-3">
                    {['Responded to customer inquiry about billing', 'Handled refund request successfully', 'Escalated complex issue to human agent', 'Sent follow-up to 5 pending tickets'].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                        <span className="text-sm text-gray-600">{item}</span>
                        <span className="text-xs text-gray-400 ml-auto">{(i + 1) * 12}m ago</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'chat' && <ChatTab agentName={agent.name} />}
            {activeTab === 'personality' && <PersonalityTab />}
            {activeTab === 'knowledge' && <EmptyTab label="Knowledge Base" />}
            {activeTab === 'commands' && <EmptyTab label="Commands" />}
            {activeTab === 'integrations' && <EmptyTab label="Integrations" />}
            {activeTab === 'automation' && <EmptyTab label="Automation" />}
            {activeTab === 'memory' && <EmptyTab label="Memory" />}
            {activeTab === 'analytics' && <EmptyTab label="Analytics" />}
            {activeTab === 'settings' && <EmptyTab label="Settings" />}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
