import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Send, Plus, Clock, Trash2, CheckCircle, AlertCircle, Loader2, Radio, Users, MessageSquare, Calendar } from 'lucide-react'

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

type Broadcast = {
  id: string
  agent_id: string
  agent_name: string
  channel: string
  message: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
  scheduled_at?: string
  sent_at?: string
  audience_size: number
  sent_count: number
  failed_count: number
  created_at: string
}

type Agent = { id: string; name: string; emoji?: string }

const CHANNEL_OPTIONS = [
  { value: 'telegram', label: 'Telegram', color: 'text-blue-400' },
  { value: 'sms', label: 'SMS', color: 'text-green-400' },
  { value: 'discord', label: 'Discord', color: 'text-indigo-400' },
  { value: 'all', label: 'All Channels', color: 'text-violet-400' },
]

function StatusBadge({ status }: { status: Broadcast['status'] }) {
  const map: Record<string, { label: string; className: string; Icon: any }> = {
    draft:     { label: 'Draft',     className: 'bg-slate-500/20 text-slate-400 border-slate-500/30',   Icon: Clock },
    scheduled: { label: 'Scheduled', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', Icon: Calendar },
    sending:   { label: 'Sending',   className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',      Icon: Loader2 },
    sent:      { label: 'Sent',      className: 'bg-green-500/20 text-green-400 border-green-500/30',    Icon: CheckCircle },
    failed:    { label: 'Failed',    className: 'bg-red-500/20 text-red-400 border-red-500/30',          Icon: AlertCircle },
  }
  const { label, className, Icon } = map[status] || map.draft
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${className}`}>
      <Icon size={11} className={status === 'sending' ? 'animate-spin' : ''} />
      {label}
    </span>
  )
}

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ agent_id: '', channel: 'telegram', message: '', scheduled_at: '' })

  const token = getToken()

  const load = () => {
    if (!token) { setLoading(false); return }
    Promise.all([
      fetch('/api/broadcasts', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
      fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
    ]).then(([bData, aData]) => {
      if (Array.isArray(bData)) setBroadcasts(bData)
      if (Array.isArray(aData)) setAgents(aData)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.message.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setShowForm(false)
        setForm({ agent_id: '', channel: 'telegram', message: '', scheduled_at: '' })
        load()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleSend = async (id: string) => {
    await fetch(`/api/broadcasts/${id}/send`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    load()
    // Refresh after simulated send
    setTimeout(load, 2000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this broadcast?')) return
    await fetch(`/api/broadcasts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    load()
  }

  return (
    <DashboardLayout title="Broadcasts">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Broadcasts</h1>
          <p className="text-sm text-slate-500 mt-0.5">Send bulk messages to your entire audience at once.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="gradient-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
        >
          <Plus size={15} /> New Broadcast
        </button>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Radio size={16} className="text-violet-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Create Broadcast</h2>
                <p className="text-xs text-slate-500">Compose and schedule your message</p>
              </div>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Channel</label>
                <div className="grid grid-cols-4 gap-2">
                  {CHANNEL_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, channel: opt.value }))}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                        form.channel === opt.value
                          ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                          : 'border-[#1e1e2e] bg-white/3 text-slate-400 hover:bg-white/5'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Agent (optional)</label>
                <select
                  value={form.agent_id}
                  onChange={e => setForm(f => ({ ...f, agent_id: e.target.value }))}
                  className="w-full bg-white/5 border border-[#1e1e2e] rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                >
                  <option value="">All Agents</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Message</label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  rows={4}
                  placeholder="Write your broadcast message..."
                  required
                  className="w-full bg-white/5 border border-[#1e1e2e] rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none placeholder-slate-600"
                />
                <p className="text-xs text-slate-600 mt-1">{form.message.length} characters</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Schedule (optional)</label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                  className="w-full bg-white/5 border border-[#1e1e2e] rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#1e1e2e] text-slate-400 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 gradient-btn py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {form.scheduled_at ? 'Schedule' : 'Save Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Broadcasts', value: broadcasts.length, icon: Radio, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
          { label: 'Messages Sent', value: broadcasts.reduce((s, b) => s + b.sent_count, 0).toLocaleString(), icon: Send, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          { label: 'Total Audience', value: broadcasts.reduce((s, b) => s + b.audience_size, 0).toLocaleString(), icon: Users, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
        ].map(m => (
          <div key={m.label} className={`bg-[#111118] rounded-xl p-5 border ${m.border}`}>
            <div className={`w-9 h-9 rounded-lg ${m.bg} flex items-center justify-center mb-3`}>
              <m.icon size={16} className={m.color} />
            </div>
            <p className="text-2xl font-bold text-white">{loading ? '—' : m.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Broadcasts List */}
      <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e1e2e]">
          <h2 className="text-sm font-semibold text-white">All Broadcasts</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-3">
              <Radio size={22} className="text-violet-400" />
            </div>
            <p className="text-slate-400 text-sm font-semibold mb-1">No broadcasts yet</p>
            <p className="text-slate-600 text-xs mb-4">Create your first broadcast to reach your entire audience.</p>
            <button onClick={() => setShowForm(true)} className="gradient-btn px-4 py-2 rounded-xl text-xs font-semibold">
              <Plus size={12} className="inline mr-1" /> Create Broadcast
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#1e1e2e]">
            {broadcasts.map(b => (
              <div key={b.id} className="px-5 py-4 hover:bg-white/2 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <StatusBadge status={b.status} />
                      <span className="text-xs text-slate-500 capitalize">{b.channel}</span>
                      <span className="text-xs text-slate-600">·</span>
                      <span className="text-xs text-slate-500">{b.agent_name || 'All Agents'}</span>
                    </div>
                    <p className="text-sm text-slate-300 truncate">{b.message}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-600">
                      <span className="flex items-center gap-1"><Users size={10} /> {b.audience_size} audience</span>
                      {b.sent_count > 0 && <span className="flex items-center gap-1 text-green-400"><CheckCircle size={10} /> {b.sent_count} sent</span>}
                      {b.failed_count > 0 && <span className="flex items-center gap-1 text-red-400"><AlertCircle size={10} /> {b.failed_count} failed</span>}
                      <span className="flex items-center gap-1"><Clock size={10} /> {new Date(b.created_at).toLocaleDateString()}</span>
                      {b.scheduled_at && <span className="flex items-center gap-1 text-yellow-400"><Calendar size={10} /> {new Date(b.scheduled_at).toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(b.status === 'draft' || b.status === 'scheduled') && (
                      <button
                        onClick={() => handleSend(b.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold gradient-btn"
                      >
                        <Send size={11} /> Send Now
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}