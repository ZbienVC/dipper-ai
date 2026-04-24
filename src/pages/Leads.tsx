import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import {
  Users, Search, Plus, X, ChevronDown, MessageSquare, Clock,
  DollarSign, Tag, Mail, Phone, Trash2, Edit3, Check, BarChart2,
  List, Columns, ArrowUpDown, AlertCircle, Hash, Download
} from 'lucide-react'

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

function timeAgo(iso: string) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const STAGES = [
  { key: 'new', label: 'New', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', dot: 'bg-blue-400' },
  { key: 'contacted', label: 'Contacted', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', dot: 'bg-yellow-400' },
  { key: 'qualified', label: 'Qualified', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30', dot: 'bg-violet-400' },
  { key: 'proposal', label: 'Proposal', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', dot: 'bg-orange-400' },
  { key: 'closed_won', label: 'Won', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  { key: 'closed_lost', label: 'Lost', color: 'bg-red-500/20 text-red-400 border-red-500/30', dot: 'bg-red-400' },
]

function stageInfo(stage: string) {
  return STAGES.find(s => s.key === stage) || STAGES[0]
}

function channelColor(channel: string) {
  const map: Record<string, string> = {
    telegram: 'bg-sky-500/20 text-sky-400',
    sms: 'bg-green-500/20 text-green-400',
    discord: 'bg-indigo-500/20 text-indigo-400',
    web: 'bg-slate-500/20 text-slate-400',
    twitter: 'bg-blue-400/20 text-blue-300',
  }
  return map[channel?.toLowerCase()] || 'bg-slate-500/20 text-slate-400'
}

interface Lead {
  id: string
  user_id: string
  agent_id: string
  agent_name: string
  identifier: string
  channel: string
  display_name?: string
  email?: string
  phone?: string
  stage: string
  tags: string[]
  notes: string
  message_count: number
  last_contact: string
  first_contact: string
  value?: number
  memory_summary?: string
  created_at: string
  updated_at: string
}

interface LeadStats {
  total: number
  byStage: Record<string, number>
  totalValue: number
  newThisWeek: number
}

interface LeadDetailData extends Lead {
  agent?: { id: string; name: string; emoji?: string }
  memory?: {
    facts: { name?: string; preferences?: string[]; past_issues?: string[]; custom: Record<string, string> }
    summary?: string
    message_count: number
  }
}

// ─── Lead Card (Pipeline) ─────────────────────────────────────────────────────
function LeadCard({ lead, onSelect, onStageChange }: {
  lead: Lead
  onSelect: (l: Lead) => void
  onStageChange: (id: string, stage: string) => void
}) {
  const [open, setOpen] = useState(false)
  const si = stageInfo(lead.stage)

  return (
    <div className="bg-[#0d0d15] border border-[#1e1e2e] rounded-xl p-3.5 hover:border-violet-500/30 transition-all group">
      <div className="flex items-start gap-2 mb-2 cursor-pointer" onClick={() => onSelect(lead)}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {lead.display_name || <span className="text-slate-500 font-mono text-xs">{lead.identifier}</span>}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${channelColor(lead.channel)}`}>
              {lead.channel}
            </span>
            <span className="text-[10px] text-slate-600 truncate">{lead.agent_name}</span>
          </div>
        </div>
        {lead.value ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 flex-shrink-0">
            ${lead.value.toLocaleString()}
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-600 mb-2.5">
        <span className="flex items-center gap-1">
          <MessageSquare size={9} />
          {lead.message_count}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={9} />
          {timeAgo(lead.last_contact)}
        </span>
      </div>

      {/* Stage dropdown */}
      <div className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          className={`w-full flex items-center justify-between px-2 py-1 rounded-lg text-[10px] font-semibold border ${si.color} transition-colors`}
        >
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${si.dot}`} />
            {si.label}
          </span>
          <ChevronDown size={10} className={open ? 'rotate-180' : ''} />
        </button>
        {open && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#16161f] border border-[#1e1e2e] rounded-xl shadow-xl z-20 overflow-hidden">
            {STAGES.map(s => (
              <button
                key={s.key}
                onClick={() => { onStageChange(lead.id, s.key); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-[10px] font-semibold flex items-center gap-2 hover:bg-white/5 transition-colors ${lead.stage === s.key ? 'text-white' : 'text-slate-400'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {s.label}
                {lead.stage === s.key && <Check size={9} className="ml-auto text-violet-400" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-white/5 rounded ${className}`} />
}

// ─── Lead Detail Drawer ───────────────────────────────────────────────────────
function LeadDrawer({ leadId, onClose, onDeleted, onUpdated }: {
  leadId: string | null
  onClose: () => void
  onDeleted: (id: string) => void
  onUpdated: (lead: Lead) => void
}) {
  const [lead, setLead] = useState<LeadDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'overview' | 'notes' | 'history'>('overview')
  const [editing, setEditing] = useState(false)
  const [editFields, setEditFields] = useState({ display_name: '', email: '', phone: '', value: '' })
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [stageOpen, setStageOpen] = useState(false)

  useEffect(() => {
    if (!leadId) return
    setLoading(true)
    setLead(null)
    setTab('overview')
    setEditing(false)
    setConfirmDelete(false)
    const token = getToken()
    fetch(`/api/leads/${leadId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setLead(d))
      .finally(() => setLoading(false))
  }, [leadId])

  async function patch(fields: Partial<Lead>) {
    if (!lead) return
    const token = getToken()
    setSaving(true)
    try {
      const r = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      const updated = await r.json()
      setLead(prev => prev ? { ...prev, ...updated } : prev)
      onUpdated(updated)
    } finally {
      setSaving(false)
    }
  }

  async function addNote() {
    if (!lead || !newNote.trim()) return
    setAddingNote(true)
    const token = getToken()
    try {
      const r = await fetch(`/api/leads/${lead.id}/note`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote.trim() }),
      })
      const updated = await r.json()
      setLead(prev => prev ? { ...prev, ...updated } : prev)
      onUpdated(updated)
      setNewNote('')
    } finally {
      setAddingNote(false)
    }
  }

  async function deleteLead() {
    if (!lead) return
    const token = getToken()
    await fetch(`/api/leads/${lead.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    onDeleted(lead.id)
    onClose()
  }

  function addTag() {
    if (!lead || !newTag.trim()) return
    const t = newTag.trim().toLowerCase()
    if (!lead.tags.includes(t)) patch({ tags: [...lead.tags, t] })
    setNewTag('')
  }

  function removeTag(t: string) {
    if (!lead) return
    patch({ tags: lead.tags.filter(x => x !== t) })
  }

  function saveEdit() {
    if (!lead) return
    const fields: any = {}
    if (editFields.display_name !== lead.display_name) fields.display_name = editFields.display_name || undefined
    if (editFields.email !== (lead.email || '')) fields.email = editFields.email || undefined
    if (editFields.phone !== (lead.phone || '')) fields.phone = editFields.phone || undefined
    const v = parseFloat(editFields.value)
    if (!isNaN(v) && v !== lead.value) fields.value = v
    else if (editFields.value === '' && lead.value !== undefined) fields.value = undefined
    if (Object.keys(fields).length) patch(fields)
    setEditing(false)
  }

  if (!leadId) return null

  const si = lead ? stageInfo(lead.stage) : null

  const noteLines = lead?.notes
    ? lead.notes.split('\n').filter(Boolean).reverse()
    : []

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-lg bg-[#0d0d15] border-l border-[#1e1e2e] flex flex-col h-full overflow-hidden animate-slide-in-right">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1e1e2e] flex items-start gap-3 flex-shrink-0">
          {loading ? (
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          ) : lead ? (
            <div className="flex-1 min-w-0">
              {editing ? (
                <input
                  value={editFields.display_name}
                  onChange={e => setEditFields(p => ({ ...p, display_name: e.target.value }))}
                  placeholder="Display name"
                  className="w-full text-white font-bold bg-white/5 border border-violet-500/50 rounded-lg px-2 py-1 text-base mb-1 focus:outline-none"
                />
              ) : (
                <h2 className="text-base font-bold text-white truncate">
                  {lead.display_name || <span className="font-mono text-sm text-slate-400">{lead.identifier}</span>}
                </h2>
              )}
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${channelColor(lead.channel)}`}>
                  {lead.channel}
                </span>
                {/* Stage selector */}
                <div className="relative">
                  <button
                    onClick={() => setStageOpen(v => !v)}
                    className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${si?.color}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${si?.dot}`} />
                    {si?.label}
                    <ChevronDown size={9} />
                  </button>
                  {stageOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-[#16161f] border border-[#1e1e2e] rounded-xl shadow-xl z-20 overflow-hidden min-w-[140px]">
                      {STAGES.map(s => (
                        <button
                          key={s.key}
                          onClick={() => { patch({ stage: s.key as Lead['stage'] }); setStageOpen(false) }}
                          className={`w-full text-left px-3 py-2 text-[10px] font-semibold flex items-center gap-2 hover:bg-white/5 transition-colors ${lead.stage === s.key ? 'text-white' : 'text-slate-400'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                          {lead.stage === s.key && <Check size={9} className="ml-auto text-violet-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {lead && !editing && (
              <button
                onClick={() => { setEditing(true); setEditFields({ display_name: lead.display_name || '', email: lead.email || '', phone: lead.phone || '', value: lead.value?.toString() || '' }) }}
                className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors"
              >
                <Edit3 size={14} />
              </button>
            )}
            {editing && (
              <button onClick={saveEdit} disabled={saving}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors">
                {saving ? '...' : 'Save'}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 flex gap-1 border-b border-[#1e1e2e] flex-shrink-0">
          {(['overview', 'notes', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-xs font-semibold capitalize transition-colors border-b-2 -mb-px ${
                tab === t ? 'text-violet-300 border-violet-500' : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {t === 'history' ? 'Conv. History' : t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-3">
              {[0,1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !lead ? (
            <p className="text-slate-500 text-sm text-center py-10">Failed to load lead.</p>
          ) : tab === 'overview' ? (
            <div className="space-y-4">
              {/* Contact info */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact Info</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Hash size={13} className="text-slate-600 flex-shrink-0" />
                    <span className="text-slate-400 font-mono text-xs">{lead.identifier}</span>
                  </div>
                  {editing ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Mail size={13} className="text-slate-600 flex-shrink-0" />
                        <input value={editFields.email} onChange={e => setEditFields(p => ({ ...p, email: e.target.value }))}
                          placeholder="Email" className="flex-1 bg-white/5 border border-[#1e1e2e] rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-violet-500/50" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={13} className="text-slate-600 flex-shrink-0" />
                        <input value={editFields.phone} onChange={e => setEditFields(p => ({ ...p, phone: e.target.value }))}
                          placeholder="Phone" className="flex-1 bg-white/5 border border-[#1e1e2e] rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-violet-500/50" />
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign size={13} className="text-slate-600 flex-shrink-0" />
                        <input value={editFields.value} onChange={e => setEditFields(p => ({ ...p, value: e.target.value }))}
                          placeholder="Deal value ($)" type="number" className="flex-1 bg-white/5 border border-[#1e1e2e] rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-violet-500/50" />
                      </div>
                    </>
                  ) : (
                    <>
                      {lead.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail size={13} className="text-slate-600 flex-shrink-0" />
                          <span className="text-slate-300 text-xs">{lead.email}</span>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone size={13} className="text-slate-600 flex-shrink-0" />
                          <span className="text-slate-300 text-xs">{lead.phone}</span>
                        </div>
                      )}
                      {lead.value !== undefined && (
                        <div className="flex items-center gap-2 text-sm">
                          <DollarSign size={13} className="text-slate-600 flex-shrink-0" />
                          <span className="text-emerald-400 text-xs font-semibold">${lead.value.toLocaleString()}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Agent & timing */}
              <div className="space-y-2 text-xs text-slate-400">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agent</p>
                <p className="text-slate-300">{lead.agent?.emoji || ''} {lead.agent_name}</p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-white/3 rounded-lg p-2.5">
                    <p className="text-[10px] text-slate-600">First contact</p>
                    <p className="text-slate-300 mt-0.5">{new Date(lead.first_contact).toLocaleDateString()}</p>
                  </div>
                  <div className="bg-white/3 rounded-lg p-2.5">
                    <p className="text-[10px] text-slate-600">Last contact</p>
                    <p className="text-slate-300 mt-0.5">{timeAgo(lead.last_contact)}</p>
                  </div>
                  <div className="bg-white/3 rounded-lg p-2.5">
                    <p className="text-[10px] text-slate-600">Messages</p>
                    <p className="text-slate-300 mt-0.5">{lead.message_count}</p>
                  </div>
                  <div className="bg-white/3 rounded-lg p-2.5">
                    <p className="text-[10px] text-slate-600">Channel</p>
                    <p className="text-slate-300 mt-0.5 capitalize">{lead.channel}</p>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags.map(t => (
                    <span key={t} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20">
                      {t}
                      <button onClick={() => removeTag(t)} className="hover:text-red-400 transition-colors"><X size={9} /></button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      value={newTag}
                      onChange={e => setNewTag(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addTag()}
                      placeholder="Add tag..."
                      className="text-[10px] bg-white/5 border border-[#1e1e2e] rounded-full px-2 py-0.5 text-slate-400 focus:outline-none focus:border-violet-500/50 w-20"
                    />
                    <button onClick={addTag} className="p-0.5 text-violet-400 hover:text-violet-300 transition-colors">
                      <Plus size={11} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Delete */}
              <div className="pt-4 border-t border-[#1e1e2e]">
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-red-400 flex-1">Delete this lead?</p>
                    <button onClick={deleteLead} className="px-3 py-1 text-xs font-semibold rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors">
                      Delete
                    </button>
                    <button onClick={() => setConfirmDelete(false)} className="px-3 py-1 text-xs font-semibold rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs font-semibold text-red-400/70 hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                    Delete Lead
                  </button>
                )}
              </div>
            </div>
          ) : tab === 'notes' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={3}
                  className="w-full bg-white/5 border border-[#1e1e2e] rounded-xl px-3 py-2.5 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-violet-500/50 resize-none"
                />
                <button
                  onClick={addNote}
                  disabled={addingNote || !newNote.trim()}
                  className="gradient-btn px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {addingNote ? 'Saving...' : 'Add Note'}
                </button>
              </div>

              <div className="space-y-2 mt-4">
                {noteLines.length === 0 ? (
                  <p className="text-slate-600 text-xs text-center py-6">No notes yet. Add one above.</p>
                ) : noteLines.map((line, i) => (
                  <div key={i} className="bg-white/3 border border-[#1e1e2e] rounded-xl p-3">
                    <p className="text-xs text-slate-300 whitespace-pre-wrap">{line}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Conversation History tab
            <div className="space-y-4">
              {lead.memory_summary ? (
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3.5">
                  <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-1.5">AI Summary</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{lead.memory_summary}</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/3 rounded-xl p-3">
                  <AlertCircle size={13} />
                  No summary yet. Generated after 20 messages.
                </div>
              )}

              {lead.memory && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Extracted Facts</p>
                  {lead.memory.facts.name && (
                    <div className="flex items-center gap-2">
                      <Tag size={12} className="text-slate-600" />
                      <span className="text-[10px] font-semibold text-slate-500">Name:</span>
                      <span className="text-xs text-slate-300">{lead.memory.facts.name}</span>
                    </div>
                  )}
                  {lead.memory.facts.preferences?.length ? (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 mb-1.5">Preferences</p>
                      <div className="flex flex-wrap gap-1">
                        {lead.memory.facts.preferences.map((p, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">{p}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {lead.memory.facts.past_issues?.length ? (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 mb-1.5">Past Issues</p>
                      <div className="flex flex-wrap gap-1">
                        {lead.memory.facts.past_issues.map((p, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">{p}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {Object.keys(lead.memory.facts.custom || {}).length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 mb-1.5">Custom Facts</p>
                      <div className="space-y-1">
                        {Object.entries(lead.memory.facts.custom).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2 text-xs">
                            <span className="text-slate-500 font-semibold">{k}:</span>
                            <span className="text-slate-300">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Leads Page ──────────────────────────────────────────────────────────
export default function Leads() {
  const navigate = useNavigate()
  const [view, setView] = useState<'pipeline' | 'list' | 'stats'>('pipeline')
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<LeadStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'last_contact' | 'message_count' | 'value'>('last_contact')
  const [stageFilter, setStageFilter] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const load = useCallback(async () => {
    const token = getToken()
    if (!token) return
    setLoading(true)
    try {
      const [leadsRes, statsRes] = await Promise.all([
        fetch('/api/leads?limit=200', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch('/api/leads/stats', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      ])
      setLeads(leadsRes.leads || [])
      setStats(statsRes)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleStageChange(id: string, stage: string) {
    const token = getToken()
    fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    }).then(r => r.json()).then(updated => {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updated } : l))
    })
  }

  function handleDeleted(id: string) {
    setLeads(prev => prev.filter(l => l.id !== id))
    setStats(prev => prev ? { ...prev, total: prev.total - 1 } : prev)
  }

  function handleUpdated(updated: Lead) {
    setLeads(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l))
  }

  const filteredLeads = leads.filter(l => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      l.display_name?.toLowerCase().includes(q) ||
      l.identifier.toLowerCase().includes(q) ||
      l.notes.toLowerCase().includes(q) ||
      l.tags.some(t => t.toLowerCase().includes(q)) ||
      l.agent_name.toLowerCase().includes(q)
    )
  })

  // ─── Pipeline View ──────────────────────────────────────────────────────────
  const PipelineView = () => (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {STAGES.map(stage => {
          const stageLeads = filteredLeads.filter(l => l.stage === stage.key)
          return (
            <div key={stage.key} className="w-64 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                <span className="text-xs font-bold text-slate-300">{stage.label}</span>
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/5 text-slate-500">
                  {stageLeads.length}
                </span>
              </div>
              <div className="space-y-2">
                {loading ? (
                  [0,1,2].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
                ) : stageLeads.length === 0 ? (
                  <div className="border border-dashed border-[#1e1e2e] rounded-xl p-4 text-center text-[10px] text-slate-600">
                    No leads
                  </div>
                ) : stageLeads.map(l => (
                  <LeadCard key={l.id} lead={l} onSelect={l => setSelectedId(l.id)} onStageChange={handleStageChange} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ─── List View ──────────────────────────────────────────────────────────────
  const ListViewComponent = () => {
    const sorted = [...filteredLeads].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'last_contact') cmp = a.last_contact.localeCompare(b.last_contact)
      else if (sortBy === 'message_count') cmp = a.message_count - b.message_count
      else if (sortBy === 'value') cmp = (a.value || 0) - (b.value || 0)
      return sortDir === 'desc' ? -cmp : cmp
    })

    function toggleSort(col: typeof sortBy) {
      if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
      else { setSortBy(col); setSortDir('desc') }
    }

    return (
      <div className="space-y-2">
        {loading ? (
          [0,1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
        ) : sorted.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Header */}
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              <div className="col-span-3">Name</div>
              <div className="col-span-2">Channel / Agent</div>
              <div className="col-span-2">Stage</div>
              <div className="col-span-2">
                <button onClick={() => toggleSort('last_contact')} className="flex items-center gap-1 hover:text-slate-400 transition-colors">
                  Last Contact <ArrowUpDown size={9} />
                </button>
              </div>
              <div className="col-span-1">
                <button onClick={() => toggleSort('message_count')} className="flex items-center gap-1 hover:text-slate-400 transition-colors">
                  Msgs <ArrowUpDown size={9} />
                </button>
              </div>
              <div className="col-span-2">
                <button onClick={() => toggleSort('value')} className="flex items-center gap-1 hover:text-slate-400 transition-colors">
                  Value <ArrowUpDown size={9} />
                </button>
              </div>
            </div>
            {sorted.map(l => {
              const si = stageInfo(l.stage)
              return (
                <div
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  className="bg-[#111118] border border-[#1e1e2e] rounded-xl px-4 py-3 cursor-pointer hover:border-violet-500/30 hover:bg-violet-500/5 transition-all grid grid-cols-1 md:grid-cols-12 gap-2 items-center"
                >
                  <div className="md:col-span-3">
                    <p className="text-sm font-semibold text-white truncate">
                      {l.display_name || <span className="font-mono text-xs text-slate-400">{l.identifier}</span>}
                    </p>
                    {l.tags.length > 0 && (
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {l.tags.slice(0, 2).map(t => (
                          <span key={t} className="text-[9px] px-1.5 py-0 rounded-full bg-violet-500/15 text-violet-400">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2 flex flex-wrap gap-1">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${channelColor(l.channel)}`}>{l.channel}</span>
                    <span className="text-[10px] text-slate-500 truncate max-w-[100px]">{l.agent_name}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${si.color} flex items-center gap-1 w-fit`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${si.dot}`} />
                      {si.label}
                    </span>
                  </div>
                  <div className="md:col-span-2 text-xs text-slate-500">{timeAgo(l.last_contact)}</div>
                  <div className="md:col-span-1 text-xs text-slate-500 flex items-center gap-1">
                    <MessageSquare size={10} />{l.message_count}
                  </div>
                  <div className="md:col-span-2">
                    {l.value ? (
                      <span className="text-xs font-semibold text-emerald-400">${l.value.toLocaleString()}</span>
                    ) : (
                      <span className="text-xs text-slate-700">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    )
  }

  // ─── Stats View ─────────────────────────────────────────────────────────────
  const StatsView = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0,1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      )
    }
    if (!stats) return null

    const maxStageCount = Math.max(...Object.values(stats.byStage), 1)
    const conversionRate = stats.total > 0
      ? Math.round(((stats.byStage.qualified || 0) + (stats.byStage.proposal || 0) + (stats.byStage.closed_won || 0)) / stats.total * 100)
      : 0

    // Most active agent
    const agentMap: Record<string, number> = {}
    for (const l of leads) agentMap[l.agent_name] = (agentMap[l.agent_name] || 0) + 1
    const mostActiveAgent = Object.entries(agentMap).sort((a, b) => b[1] - a[1])[0]

    return (
      <div className="space-y-5">
        {/* Top stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Leads', value: stats.total, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
            { label: 'Pipeline Value', value: `$${stats.totalValue.toLocaleString()}`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
            { label: 'New This Week', value: stats.newThisWeek, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
            { label: 'Conversion Rate', value: `${conversionRate}%`, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
          ].map(m => (
            <div key={m.label} className={`bg-[#111118] rounded-xl p-4 border ${m.border}`}>
              <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Stage breakdown */}
        <div className="bg-[#111118] rounded-xl p-5 border border-[#1e1e2e]">
          <h3 className="text-sm font-semibold text-white mb-4">Pipeline Breakdown</h3>
          <div className="space-y-3">
            {STAGES.map(s => {
              const count = stats.byStage[s.key] || 0
              const pct = maxStageCount > 0 ? (count / maxStageCount) * 100 : 0
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <div className="w-20 text-right text-xs font-semibold text-slate-400 flex-shrink-0">{s.label}</div>
                  <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${s.dot.replace('bg-', 'bg-').replace('-400', '-500')}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-8 text-xs text-slate-500 font-semibold">{count}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Most active agent */}
        {mostActiveAgent && (
          <div className="bg-[#111118] rounded-xl p-5 border border-[#1e1e2e]">
            <h3 className="text-sm font-semibold text-white mb-2">Most Active Agent</h3>
            <p className="text-xl font-bold text-violet-400">{mostActiveAgent[0]}</p>
            <p className="text-xs text-slate-500 mt-0.5">{mostActiveAgent[1]} leads generated</p>
          </div>
        )}
      </div>
    )
  }

  function EmptyState() {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
          <Users size={24} className="text-violet-400" />
        </div>
        <p className="text-slate-300 font-semibold mb-1">No leads yet</p>
        <p className="text-slate-600 text-sm max-w-xs mx-auto">
          Leads are automatically created when users message your agents.
        </p>
      </div>
    )
  }

  return (
    <DashboardLayout title="Leads CRM">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Leads CRM</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {stats ? `${stats.total} leads across all agents` : 'Loading...'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/leads/export?format=csv"
              onClick={e => { const t = getToken(); if (!t) return; e.preventDefault(); fetch('/api/leads/export?format=csv', { headers: { Authorization: `Bearer ${t}` } }).then(r => r.blob()).then(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'leads.csv'; a.click() }) }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-[#1e1e2e] text-slate-400 hover:bg-white/5 hover:text-white transition-all"
            >
              <Download size={14} /> Export CSV
            </a>
            <button
              onClick={() => navigate('/dashboard/agents')}
              className="gradient-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            >
              <Plus size={14} />
              New Agent
            </button>
          </div>
        </div>

        {/* Quick filter tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {([{key: '', label: 'All'}, ...STAGES.map(s => ({key: s.key, label: s.label}))]).map(tab => {
            const count = tab.key === '' ? leads.length : leads.filter(l => l.stage === tab.key).length
            return (
              <button
                key={tab.key}
                onClick={() => setStageFilter(tab.key)}
                className={stageFilter === tab.key ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border gradient-btn border-transparent' : 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border bg-white/5 border-[#1e1e2e] text-slate-400 hover:text-slate-200 hover:border-violet-500/30'}
              >
                {tab.label}
                {count > 0 && <span className={stageFilter === tab.key ? 'px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20' : 'px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10'}>{count}</span>}
              </button>
            )
          })}
        </div>

        {/* View tabs + search */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-[#111118] border border-[#1e1e2e] rounded-xl p-1 gap-1">
            {([['pipeline', Columns], ['list', List], ['stats', BarChart2]] as const).map(([v, Icon]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  view === v ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <Icon size={13} />
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {view !== 'stats' && (
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search leads..."
                className="w-full pl-8 pr-4 py-2 text-sm bg-[#111118] border border-[#1e1e2e] rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-slate-300 placeholder-slate-600"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        {!loading && leads.length === 0 && view !== 'stats' ? (
          <EmptyState />
        ) : view === 'pipeline' ? (
          <PipelineView />
        ) : view === 'list' ? (
          <ListViewComponent />
        ) : (
          <StatsView />
        )}
      </div>

      {/* Lead Detail Drawer */}
      {selectedId && (
        <LeadDrawer
          leadId={selectedId}
          onClose={() => setSelectedId(null)}
          onDeleted={handleDeleted}
          onUpdated={handleUpdated}
        />
      )}
    </DashboardLayout>
  )
}
