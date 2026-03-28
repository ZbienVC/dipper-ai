import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import {
  Zap, Plus, Play, Pause, Trash2, Edit2, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Clock, RefreshCw, Bot, Calendar, Loader2,
  AlertCircle, ToggleLeft, ToggleRight, X
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || ''

function getToken() {
  try {
    const raw = localStorage.getItem('dipperai_user')
    if (raw) return JSON.parse(raw).token
  } catch {}
  return null
}

function headers() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }
}

type Automation = {
  id: string
  user_id: string
  agent_id: string
  agent_name?: string
  name: string
  description?: string
  trigger_type: 'schedule' | 'manual'
  trigger_config: { cron?: string; timezone?: string; label?: string }
  action_type: 'send_message' | 'post_to_channel' | 'send_ai_response'
  action_config: {
    channel: 'telegram' | 'sms' | 'discord'
    recipient?: string
    message_template?: string
    ai_prompt?: string
    topic?: string
  }
  is_active: boolean
  run_count: number
  last_run_at?: string
  next_run_at?: string
  last_error?: string
  runs_today?: number
  created_at: string
  updated_at: string
}

type AutomationRun = {
  id: string
  automation_id: string
  status: 'success' | 'error' | 'skipped'
  output?: string
  error_message?: string
  started_at: string
  completed_at?: string
}

type Agent = { id: string; name: string; emoji: string }

const SCHEDULE_PRESETS = [
  { label: 'Every day at 9am', cron: '0 9 * * *' },
  { label: 'Every Monday at 9am', cron: '0 9 * * 1' },
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Every 30 minutes', cron: '*/30 * * * *' },
  { label: 'Custom', cron: '' },
]

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
]

function formatRelativeTime(iso?: string): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

function formatNextRun(iso?: string): string {
  if (!iso) return '—'
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return 'overdue'
  if (diff < 60000) return 'in <1 min'
  if (diff < 3600000) return `in ${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `in ${Math.floor(diff / 3600000)}h`
  return `in ${Math.floor(diff / 86400000)}d`
}

function actionLabel(a: Automation) {
  const typeMap: Record<string, string> = {
    send_message: 'Send message',
    send_ai_response: 'Send AI response',
    post_to_channel: 'Post to channel',
  }
  const channelMap: Record<string, string> = {
    telegram: 'Telegram',
    sms: 'SMS',
    discord: 'Discord',
  }
  return `${typeMap[a.action_type] || a.action_type} via ${channelMap[a.action_config.channel] || a.action_config.channel}`
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type ModalProps = {
  automation?: Automation | null
  agents: Agent[]
  onClose: () => void
  onSaved: () => void
}

function AutomationModal({ automation, agents, onClose, onSaved }: ModalProps) {
  const [name, setName] = useState(automation?.name || '')
  const [description, setDescription] = useState(automation?.description || '')
  const [agentId, setAgentId] = useState(automation?.agent_id || agents[0]?.id || '')
  const [triggerType, setTriggerType] = useState<'schedule' | 'manual'>(automation?.trigger_type || 'schedule')
  const [selectedPreset, setSelectedPreset] = useState(() => {
    const existing = automation?.trigger_config?.cron
    if (!existing) return 'Every day at 9am'
    const match = SCHEDULE_PRESETS.find(p => p.cron === existing && p.label !== 'Custom')
    return match?.label || 'Custom'
  })
  const [customCron, setCustomCron] = useState(
    automation?.trigger_config?.cron && !SCHEDULE_PRESETS.find(p => p.cron === automation.trigger_config?.cron && p.label !== 'Custom')
      ? automation.trigger_config.cron
      : ''
  )
  const [timezone, setTimezone] = useState(automation?.trigger_config?.timezone || 'America/New_York')
  const [actionType, setActionType] = useState<'send_message' | 'send_ai_response' | 'post_to_channel'>(
    automation?.action_type || 'send_ai_response'
  )
  const [channel, setChannel] = useState<'telegram' | 'sms' | 'discord'>(
    automation?.action_config?.channel || 'telegram'
  )
  const [recipient, setRecipient] = useState(automation?.action_config?.recipient || '')
  const [messageTemplate, setMessageTemplate] = useState(automation?.action_config?.message_template || '')
  const [aiPrompt, setAiPrompt] = useState(automation?.action_config?.ai_prompt || automation?.action_config?.topic || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const activeCron = selectedPreset === 'Custom' ? customCron : (SCHEDULE_PRESETS.find(p => p.label === selectedPreset)?.cron || '')

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    if (!agentId) { setError('Please select an agent'); return }
    if (triggerType === 'schedule' && !activeCron) { setError('Please enter a cron schedule'); return }
    setError('')
    setSaving(true)
    try {
      const presetLabel = selectedPreset !== 'Custom' ? selectedPreset : activeCron
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        agent_id: agentId,
        trigger_type: triggerType,
        trigger_config: triggerType === 'schedule'
          ? { cron: activeCron, timezone, label: presetLabel }
          : {},
        action_type: actionType,
        action_config: {
          channel,
          recipient: recipient.trim() || undefined,
          ...(actionType === 'send_message' ? { message_template: messageTemplate } : { ai_prompt: aiPrompt, topic: aiPrompt }),
        },
      }
      const url = automation ? `${API}/api/automations/${automation.id}` : `${API}/api/automations`
      const method = automation ? 'PATCH' : 'POST'
      const resp = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || 'Save failed')
      }
      onSaved()
    } catch (e: any) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-[#0d0d15] border border-[#1e1e2e] rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e2e]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
              <Zap size={14} className="text-violet-400" />
            </div>
            <h2 className="text-base font-semibold text-white">{automation ? 'Edit Automation' : 'New Automation'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Section 1 — Basics */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Basics</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Name <span className="text-red-400">*</span></label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Daily crypto summary"
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-[#1e1e2e] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Description</label>
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What does this automation do?"
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-[#1e1e2e] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Agent <span className="text-red-400">*</span></label>
                <select
                  value={agentId}
                  onChange={e => setAgentId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2 — Trigger */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Trigger</h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                {(['schedule', 'manual'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTriggerType(t)}
                    className={`flex-1 py-2 text-sm rounded-lg font-medium border transition-all ${
                      triggerType === t
                        ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                        : 'bg-white/5 border-[#1e1e2e] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t === 'schedule' ? '📅 Schedule' : '▶️ Manual'}
                  </button>
                ))}
              </div>

              {triggerType === 'schedule' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {SCHEDULE_PRESETS.map(p => (
                      <button
                        key={p.label}
                        onClick={() => setSelectedPreset(p.label)}
                        className={`px-3 py-2 text-xs rounded-lg border transition-all text-left ${
                          selectedPreset === p.label
                            ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                            : 'bg-white/5 border-[#1e1e2e] text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {selectedPreset === 'Custom' && (
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Cron expression</label>
                      <input
                        value={customCron}
                        onChange={e => setCustomCron(e.target.value)}
                        placeholder="0 9 * * * (minute hour dom month dow)"
                        className="w-full px-3 py-2 text-sm font-mono bg-white/5 border border-[#1e1e2e] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                      />
                      <p className="text-xs text-slate-500 mt-1">Format: minute hour day month weekday</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Timezone</label>
                    <select
                      value={timezone}
                      onChange={e => setTimezone(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    >
                      {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Section 3 — Action */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Action</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Action type</label>
                <select
                  value={actionType}
                  onChange={e => setActionType(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                >
                  <option value="send_message">Send a fixed message</option>
                  <option value="send_ai_response">Send AI-generated message</option>
                  <option value="post_to_channel">Post AI content to channel</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Channel</label>
                <div className="flex gap-2">
                  {(['telegram', 'sms', 'discord'] as const).map(ch => (
                    <button
                      key={ch}
                      onClick={() => setChannel(ch)}
                      className={`flex-1 py-2 text-xs rounded-lg font-medium border transition-all ${
                        channel === ch
                          ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                          : 'bg-white/5 border-[#1e1e2e] text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      {ch === 'telegram' ? '✈️' : ch === 'sms' ? '📱' : '💬'} {ch.charAt(0).toUpperCase() + ch.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  {channel === 'telegram' ? 'Chat ID' : channel === 'sms' ? 'Phone number' : 'Webhook URL or channel'}
                </label>
                <input
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  placeholder={channel === 'telegram' ? '-1001234567890' : channel === 'sms' ? '+15551234567' : 'Webhook URL'}
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-[#1e1e2e] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
              </div>

              {actionType === 'send_message' ? (
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Message template</label>
                  <textarea
                    value={messageTemplate}
                    onChange={e => setMessageTemplate(e.target.value)}
                    rows={4}
                    placeholder="Enter the message to send..."
                    className="w-full px-3 py-2 text-sm bg-white/5 border border-[#1e1e2e] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">What should the agent write about?</label>
                  <textarea
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    rows={4}
                    placeholder="e.g. Write a motivational message for startup founders. Keep it under 200 words."
                    className="w-full px-3 py-2 text-sm bg-white/5 border border-[#1e1e2e] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
                  />
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1e1e2e]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {saving ? 'Saving…' : automation ? 'Update Automation' : 'Create Automation'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Automation Card ──────────────────────────────────────────────────────────

type CardProps = {
  automation: Automation
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (a: Automation) => void
  onRun: (id: string) => void
  runningId: string | null
}

function AutomationCard({ automation: a, onToggle, onDelete, onEdit, onRun, runningId }: CardProps) {
  const [expanded, setExpanded] = useState(false)
  const [runs, setRuns] = useState<AutomationRun[]>([])
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function loadRuns() {
    if (runs.length > 0) { setExpanded(e => !e); return }
    setExpanded(true)
    setLoadingRuns(true)
    try {
      const resp = await fetch(`${API}/api/automations/${a.id}/runs`, { headers: headers() })
      if (resp.ok) setRuns(await resp.json())
    } catch {}
    setLoadingRuns(false)
  }

  async function handleDelete() {
    if (!confirm(`Delete "${a.name}"?`)) return
    setDeleting(true)
    onDelete(a.id)
  }

  const isRunning = runningId === a.id
  const channelIcon = a.action_config.channel === 'telegram' ? '✈️' : a.action_config.channel === 'sms' ? '📱' : '💬'
  const triggerLabel = a.trigger_type === 'schedule'
    ? (a.trigger_config.label || a.trigger_config.cron || 'Scheduled')
    : 'Manual'

  return (
    <div className={`bg-[#0d0d15] border rounded-xl transition-all ${a.last_error ? 'border-red-500/20' : 'border-[#1e1e2e]'}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Left: icon + toggle */}
          <div className="flex flex-col items-center gap-2 pt-0.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              a.is_active ? 'bg-violet-600/20 border-violet-500/20' : 'bg-white/5 border-[#1e1e2e]'
            }`}>
              <Zap size={15} className={a.is_active ? 'text-violet-400' : 'text-slate-500'} />
            </div>
          </div>

          {/* Middle: info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white leading-tight">{a.name}</h3>
                {a.description && <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>}
              </div>
              {/* Active toggle */}
              <button
                onClick={() => onToggle(a.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border transition-all ${
                  a.is_active
                    ? 'bg-green-500/10 border-green-500/20 text-green-400'
                    : 'bg-white/5 border-[#1e1e2e] text-slate-500'
                }`}
              >
                {a.is_active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                {a.is_active ? 'Active' : 'Paused'}
              </button>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Bot size={11} />
                <span>{a.agent_name}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar size={11} />
                <span>{triggerLabel}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>{channelIcon}</span>
                <span>{actionLabel(a)}</span>
              </div>
            </div>

            {/* Run stats */}
            <div className="flex flex-wrap items-center gap-4 mt-2.5">
              <div className="flex items-center gap-1.5 text-xs">
                {a.last_error
                  ? <XCircle size={11} className="text-red-400" />
                  : a.last_run_at ? <CheckCircle2 size={11} className="text-green-400" /> : <Clock size={11} className="text-slate-600" />
                }
                <span className="text-slate-500">
                  {a.last_run_at ? `Last: ${formatRelativeTime(a.last_run_at)}` : 'Never run'}
                </span>
              </div>
              {a.trigger_type === 'schedule' && a.next_run_at && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <RefreshCw size={11} />
                  <span>Next: {formatNextRun(a.next_run_at)}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>{a.run_count} runs total</span>
              </div>
            </div>

            {a.last_error && (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-red-400">
                <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
                <span className="truncate">{a.last_error}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onRun(a.id)}
              disabled={isRunning}
              title="Run now"
              className="p-1.5 text-slate-500 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors disabled:opacity-40"
            >
              {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            </button>
            <button
              onClick={() => onEdit(a)}
              title="Edit"
              className="p-1.5 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="Delete"
              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
            <button
              onClick={loadRuns}
              title="Run history"
              className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Run history */}
      {expanded && (
        <div className="border-t border-[#1e1e2e] px-4 py-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Run History</p>
          {loadingRuns ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
              <Loader2 size={12} className="animate-spin" /> Loading…
            </div>
          ) : runs.length === 0 ? (
            <p className="text-xs text-slate-600 py-1">No runs yet.</p>
          ) : (
            <div className="space-y-2">
              {runs.slice(0, 5).map(run => {
                const duration = run.completed_at
                  ? Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)
                  : null
                return (
                  <div key={run.id} className="flex items-start gap-2 text-xs">
                    {run.status === 'success'
                      ? <CheckCircle2 size={11} className="text-green-400 mt-0.5 flex-shrink-0" />
                      : <XCircle size={11} className="text-red-400 mt-0.5 flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-400">{new Date(run.started_at).toLocaleString()}</span>
                      {duration !== null && <span className="text-slate-600 ml-2">{duration}s</span>}
                      {run.output && (
                        <p className="text-slate-500 truncate mt-0.5">{run.output.slice(0, 100)}</p>
                      )}
                      {run.error_message && (
                        <p className="text-red-400 truncate mt-0.5">{run.error_message}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Automations() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [aResp, agResp] = await Promise.all([
        fetch(`${API}/api/automations`, { headers: headers() }),
        fetch(`${API}/api/agents`, { headers: headers() }),
      ])
      if (aResp.ok) setAutomations(await aResp.json())
      if (agResp.ok) {
        const agentsData = await agResp.json()
        setAgents(agentsData.agents || agentsData)
      }
    } catch (e: any) {
      setError('Failed to load automations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleToggle(id: string) {
    try {
      const resp = await fetch(`${API}/api/automations/${id}/toggle`, { method: 'PATCH', headers: headers() })
      if (resp.ok) {
        const updated = await resp.json()
        setAutomations(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a))
      }
    } catch {}
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`${API}/api/automations/${id}`, { method: 'DELETE', headers: headers() })
      setAutomations(prev => prev.filter(a => a.id !== id))
    } catch {}
  }

  async function handleRun(id: string) {
    setRunningId(id)
    try {
      await fetch(`${API}/api/automations/${id}/run`, { method: 'POST', headers: headers() })
      await load()
    } catch {}
    setRunningId(null)
  }

  function handleEdit(a: Automation) {
    setEditingAutomation(a)
    setModalOpen(true)
  }

  function handleNew() {
    setEditingAutomation(null)
    setModalOpen(true)
  }

  function handleModalClose() {
    setModalOpen(false)
    setEditingAutomation(null)
  }

  async function handleSaved() {
    setModalOpen(false)
    setEditingAutomation(null)
    await load()
  }

  const totalRuns = automations.reduce((s, a) => s + (a.runs_today || 0), 0)
  const activeCount = automations.filter(a => a.is_active).length

  return (
    <DashboardLayout title="Automations">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Automations</h1>
            <p className="text-sm text-slate-500 mt-0.5">Put your agents to work 24/7 — no human input required.</p>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors flex-shrink-0"
          >
            <Plus size={15} />
            New Automation
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: automations.length, icon: Zap, color: 'violet' },
            { label: 'Active', value: activeCount, icon: Play, color: 'green' },
            { label: 'Runs today', value: totalRuns, icon: RefreshCw, color: 'blue' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#0d0d15] border border-[#1e1e2e] rounded-xl p-4">
              <div className={`w-8 h-8 rounded-lg mb-3 flex items-center justify-center ${
                color === 'violet' ? 'bg-violet-600/20' : color === 'green' ? 'bg-green-500/20' : 'bg-blue-500/20'
              }`}>
                <Icon size={14} className={
                  color === 'violet' ? 'text-violet-400' : color === 'green' ? 'text-green-400' : 'text-blue-400'
                } />
              </div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading automations…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-400 py-8 justify-center">
            <AlertCircle size={16} /> {error}
          </div>
        ) : automations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center mb-4">
              <Zap size={24} className="text-violet-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">No automations yet</h3>
            <p className="text-sm text-slate-500 max-w-sm mb-6">
              Create your first automation to put your agents to work 24/7 — sending messages, generating content, and more.
            </p>
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors"
            >
              <Plus size={15} />
              Create your first automation
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {automations.map(a => (
              <AutomationCard
                key={a.id}
                automation={a}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onRun={handleRun}
                runningId={runningId}
              />
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <AutomationModal
          automation={editingAutomation}
          agents={agents}
          onClose={handleModalClose}
          onSaved={handleSaved}
        />
      )}
    </DashboardLayout>
  )
}
