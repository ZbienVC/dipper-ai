import { useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Check, X, Edit3, Clock, MessageSquare } from 'lucide-react'

interface Approval {
  id: string
  agentName: string
  messagePreview: string
  channel: string
  timestamp: string
  status: 'pending' | 'approved' | 'rejected'
  rejectionReason?: string
}

const INITIAL_APPROVALS: Approval[] = [
  { id: '1', agentName: 'Support Pro', messagePreview: 'Hi! I noticed your account has been inactive. I wanted to reach out and see if there\'s anything I can help you with today.', channel: 'SMS', timestamp: '2 min ago', status: 'pending' },
  { id: '2', agentName: 'The Closer', messagePreview: 'Hey! Just following up on our earlier conversation. I think you\'d be a great fit for our Pro plan. Want to jump on a quick call?', channel: 'Telegram', timestamp: '18 min ago', status: 'pending' },
  { id: '3', agentName: 'Community Bob', messagePreview: 'We\'ve just launched a new feature — AI-powered analytics. Drop a comment if you\'re excited to try it!', channel: 'Discord', timestamp: '45 min ago', status: 'pending' },
]

const HISTORY_APPROVALS: Approval[] = [
  { id: '4', agentName: 'Support Pro', messagePreview: 'Thank you for contacting us! Your refund has been processed and should appear within 3-5 business days.', channel: 'SMS', timestamp: 'Yesterday, 3:42 PM', status: 'approved' },
  { id: '5', agentName: 'The Closer', messagePreview: 'Hey! Ready to 10x your revenue? Sign up now for 80% OFF — limited time only!!!', channel: 'SMS', timestamp: 'Yesterday, 1:15 PM', status: 'rejected', rejectionReason: 'Too aggressive / spammy tone' },
]

const channelColors: Record<string, string> = {
  SMS: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Telegram: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  Discord: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  X: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
}

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
    setRejectModal(null); setRejectReason('')
  }

  const displayItems = activeTab === 'pending' ? pending : history

  return (
    <DashboardLayout title="Approvals">
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">Approvals</h1>
            {pending.length > 0 && (
              <span className="bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold px-2 py-0.5 rounded-full">{pending.length} pending</span>
            )}
          </div>
          <p className="text-slate-500 mt-0.5 text-sm">Review and approve messages before your agents send them.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111118] border border-[#1e1e2e] rounded-xl p-1 mb-5 w-fit">
        {(['pending', 'history'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all capitalize ${
              activeTab === tab ? 'gradient-btn' : 'text-slate-500 hover:text-slate-200'
            }`}>
            {tab}
            {tab === 'pending' && pending.length > 0 && (
              <span className="ml-1.5 bg-red-500/20 text-red-400 text-xs font-bold px-1.5 py-0.5 rounded-full">{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      {displayItems.length === 0 ? (
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
            {activeTab === 'pending' ? <Check size={24} className="text-green-400" /> : <MessageSquare size={24} className="text-slate-500" />}
          </div>
          <h3 className="text-base font-bold text-white mb-2">{activeTab === 'pending' ? 'All caught up!' : 'No history yet'}</h3>
          <p className="text-slate-500 text-sm">{activeTab === 'pending' ? 'No pending approvals right now.' : 'Approved and rejected messages will appear here.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayItems.map(item => (
            <div key={item.id} className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 hover:border-violet-500/20 transition-colors">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={16} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className="font-semibold text-white text-sm">{item.agentName}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${channelColors[item.channel] || 'bg-white/5 text-slate-400 border-[#1e1e2e]'}`}>{item.channel}</span>
                    <span className="flex items-center gap-1 text-xs text-slate-600"><Clock size={10} /> {item.timestamp}</span>
                    {item.status === 'approved' && (
                      <span className="flex items-center gap-1 text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">
                        <Check size={10} /> Approved
                      </span>
                    )}
                    {item.status === 'rejected' && (
                      <span className="flex items-center gap-1 text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                        <X size={10} /> Rejected
                      </span>
                    )}
                  </div>
                  <div className="bg-white/5 border border-[#1e1e2e] rounded-xl px-4 py-3 text-sm text-slate-300 leading-relaxed">
                    "{item.messagePreview}"
                  </div>
                  {item.rejectionReason && (
                    <p className="text-xs text-red-400 mt-2 italic">Reason: {item.rejectionReason}</p>
                  )}
                </div>
                {item.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleApprove(item.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/20 hover:bg-green-500/30 transition-colors">
                      <Check size={12} /> Approve
                    </button>
                    <button onClick={() => { setRejectModal(item.id); setRejectReason('') }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                      <X size={12} /> Reject
                    </button>
                    <button className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#1e1e2e] text-slate-400 hover:bg-white/5 transition-colors">
                      <Edit3 size={12} /> Edit
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-bold text-white mb-2">Reject Message</h2>
            <p className="text-sm text-slate-500 mb-4">Optionally explain why this message was rejected.</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)..." rows={3}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-red-500/50 text-white text-sm resize-none" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectModal(null)} className="flex-1 py-2.5 rounded-xl border border-[#1e1e2e] text-slate-400 text-sm font-semibold hover:bg-white/5">Cancel</button>
              <button onClick={() => handleRejectConfirm(rejectModal)} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600">Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
