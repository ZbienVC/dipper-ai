import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Check, X, Edit3, Clock, MessageSquare } from 'lucide-react'

interface Approval {
  id: string
  agent_id: string
  agentName: string
  messagePreview: string
  full_message: string
  channel: string
  recipient?: string
  timestamp: string
  status: 'pending' | 'approved' | 'rejected'
  rejectionReason?: string
  created_at: number
}

const channelColors: Record<string, string> = {
  SMS: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Telegram: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  Discord: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  X: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
}

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

function formatTime(ts: number) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(ts).toLocaleDateString()
}

function mapApproval(a: any): Approval {
  return {
    id: a.id,
    agent_id: a.agent_id,
    agentName: a.agent_name,
    messagePreview: a.message_preview,
    full_message: a.full_message,
    channel: a.channel?.charAt(0).toUpperCase() + a.channel?.slice(1) || 'Unknown',
    recipient: a.recipient,
    timestamp: formatTime(a.created_at),
    status: a.status,
    rejectionReason: a.rejection_reason,
    created_at: a.created_at,
  }
}

export default function Approvals() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectModal, setRejectModal] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const fetchApprovals = async () => {
    const token = getToken()
    if (!token) { setLoading(false); return }
    try {
      const res = await fetch('/api/approvals', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setApprovals(data.map(mapApproval))
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchApprovals() }, [])

  const pending = approvals.filter(a => a.status === 'pending')
  const history = approvals.filter(a => a.status !== 'pending')

  const handleApprove = async (id: string) => {
    const token = getToken()
    if (!token) return
    await fetch(`/api/approvals/${id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    fetchApprovals()
  }

  const handleRejectConfirm = async (id: string) => {
    const token = getToken()
    if (!token) return
    await fetch(`/api/approvals/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: rejectReason || 'No reason given' }),
    })
    setRejectModal(null); setRejectReason('')
    fetchApprovals()
  }

  const handleDelete = async (id: string) => {
    const token = getToken()
    if (!token) return
    await fetch(`/api/approvals/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    fetchApprovals()
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

      {loading ? (
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-16 text-center">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading approvals...</p>
        </div>
      ) : displayItems.length === 0 ? (
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
                    <button onClick={() => handleDelete(item.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#1e1e2e] text-slate-400 hover:bg-white/5 transition-colors">
                      <Edit3 size={12} /> Delete
                    </button>
                  </div>
                )}
                {item.status !== 'pending' && (
                  <button onClick={() => handleDelete(item.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#1e1e2e] text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0">
                    <X size={12} /> Remove
                  </button>
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