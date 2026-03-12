import { useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Check, X, Edit3, Clock, MessageSquare } from 'lucide-react'

interface Approval {
  id: string
  agentName: string
  agentEmoji: string
  messagePreview: string
  channel: string
  channelColor: string
  timestamp: string
  status: 'pending' | 'approved' | 'rejected'
  rejectionReason?: string
}

const INITIAL_APPROVALS: Approval[] = [
  {
    id: '1',
    agentName: 'Support Pro',
    agentEmoji: '🎧',
    messagePreview: 'Hi! I noticed your account has been inactive. I wanted to reach out and see if there\'s anything I can help you with today. Our team is available 24/7!',
    channel: 'SMS',
    channelColor: 'bg-blue-100 text-blue-700',
    timestamp: '2 min ago',
    status: 'pending',
  },
  {
    id: '2',
    agentName: 'The Closer',
    agentEmoji: '💼',
    messagePreview: 'Hey! Just following up on our earlier conversation. I think you\'d be a great fit for our Pro plan. Want to jump on a quick 15-min call this week?',
    channel: 'Telegram',
    channelColor: 'bg-sky-100 text-sky-700',
    timestamp: '18 min ago',
    status: 'pending',
  },
  {
    id: '3',
    agentName: 'Community Bob',
    agentEmoji: '🌐',
    messagePreview: '📢 Hey community! We\'ve just launched a new feature — AI-powered analytics. Drop a 🔥 in the chat if you\'re excited to try it!',
    channel: 'Discord',
    channelColor: 'bg-indigo-100 text-indigo-700',
    timestamp: '45 min ago',
    status: 'pending',
  },
]

const HISTORY_APPROVALS: Approval[] = [
  {
    id: '4',
    agentName: 'Support Pro',
    agentEmoji: '🎧',
    messagePreview: 'Thank you for contacting us! Your refund has been processed and should appear within 3-5 business days.',
    channel: 'SMS',
    channelColor: 'bg-blue-100 text-blue-700',
    timestamp: 'Yesterday, 3:42 PM',
    status: 'approved',
  },
  {
    id: '5',
    agentName: 'The Closer',
    agentEmoji: '💼',
    messagePreview: 'Hey! Ready to 10x your revenue? Sign up now for 80% OFF — limited time only!!!',
    channel: 'SMS',
    channelColor: 'bg-blue-100 text-blue-700',
    timestamp: 'Yesterday, 1:15 PM',
    status: 'rejected',
    rejectionReason: 'Too aggressive / spammy tone',
  },
]

export default function Approvals() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')
  const [pending, setPending] = useState<Approval[]>(INITIAL_APPROVALS)
  const [history, setHistory] = useState<Approval[]>(HISTORY_APPROVALS)
  const [rejectModal, setRejectModal] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const handleApprove = (id: string) => {
    const item = pending.find(a => a.id === id)
    if (!item) return
    setPending(prev => prev.filter(a => a.id !== id))
    setHistory(prev => [{ ...item, status: 'approved', timestamp: 'Just now' }, ...prev])
  }

  const handleRejectConfirm = (id: string) => {
    const item = pending.find(a => a.id === id)
    if (!item) return
    setPending(prev => prev.filter(a => a.id !== id))
    setHistory(prev => [{ ...item, status: 'rejected', timestamp: 'Just now', rejectionReason: rejectReason || 'No reason given' }, ...prev])
    setRejectModal(null)
    setRejectReason('')
  }

  const displayItems = activeTab === 'pending' ? pending : history

  return (
    <DashboardLayout title="Approvals">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-gray-900">Approvals</h1>
            {pending.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {pending.length} pending
              </span>
            )}
          </div>
          <p className="text-gray-500 mt-1">Review and approve messages before your agents send them.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {(['pending', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
            {tab === 'pending' && pending.length > 0 && (
              <span className="ml-2 bg-red-100 text-red-600 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {displayItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="text-5xl mb-4">{activeTab === 'pending' ? '✅' : '📋'}</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {activeTab === 'pending' ? 'All caught up!' : 'No history yet'}
          </h3>
          <p className="text-gray-500 text-sm">
            {activeTab === 'pending' ? 'No pending approvals right now.' : 'Approved and rejected messages will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayItems.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-xl flex-shrink-0">
                  {item.agentEmoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <span className="font-bold text-gray-900 text-sm">{item.agentName}</span>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${item.channelColor}`}>
                      {item.channel}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={11} /> {item.timestamp}
                    </span>
                    {item.status === 'approved' && (
                      <span className="flex items-center gap-1 text-xs font-semibold bg-green-50 text-green-600 px-2.5 py-0.5 rounded-full">
                        <Check size={11} /> Approved
                      </span>
                    )}
                    {item.status === 'rejected' && (
                      <span className="flex items-center gap-1 text-xs font-semibold bg-red-50 text-red-600 px-2.5 py-0.5 rounded-full">
                        <X size={11} /> Rejected
                      </span>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed flex items-start gap-2">
                    <MessageSquare size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <p>"{item.messagePreview}"</p>
                  </div>
                  {item.rejectionReason && (
                    <p className="text-xs text-red-500 mt-2 italic">Reason: {item.rejectionReason}</p>
                  )}
                </div>
                {item.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-green-500 text-white hover:bg-green-600 transition-colors"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      onClick={() => { setRejectModal(item.id); setRejectReason('') }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      <X size={14} /> Reject
                    </button>
                    <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                      <Edit3 size={14} /> Edit
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Reject Message</h2>
            <p className="text-sm text-gray-500 mb-4">Optionally explain why this message was rejected.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-gray-900 text-sm resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRejectConfirm(rejectModal)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
