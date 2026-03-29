import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import {
  Users2, Play, Edit3, ChevronLeft, CheckCircle2, XCircle,
  Clock, Loader2, Bot, Zap, ArrowRight, RefreshCw, ListChecks,
  MessageSquare, Crown, Settings2, Plus, Trash2, ChevronDown, ChevronUp
} from 'lucide-react'

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'success') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
      <CheckCircle2 size={11} /> Success
    </span>
  )
  if (status === 'error') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
      <XCircle size={11} /> Error
    </span>
  )
  if (status === 'running') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 animate-pulse">
      <Loader2 size={11} className="animate-spin" /> Running
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/20">
      <Clock size={11} /> Pending
    </span>
  )
}

interface Agent { id: string; name: string; emoji: string; description?: string; model?: string; provider?: string }
interface Team {
  id: string; name: string; description?: string;
  orchestrator_agent_id: string; member_agent_ids: string[];
  orchestrator?: Agent; members?: Agent[]; lastTasks?: any[];
  created_at: string; updated_at: string;
}
interface TaskLog {
  id: string; task_id: string; agent_id: string;
  role: 'orchestrator' | 'specialist';
  action: 'plan' | 'delegate' | 'work' | 'handoff' | 'summary' | 'error';
  content: string; created_at: string;
  agent?: Agent;
}
interface TeamTask {
  id: string; team_id: string; title: string; instructions: string;
  status: 'pending' | 'running' | 'success' | 'error';
  orchestrator_plan?: string; result_summary?: string; error_message?: string;
  created_at: string; updated_at: string;
  logs?: TaskLog[];
}

// ─── Action icon mapping ──────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; icon: any; color: string }> = {
  plan: { label: 'Planned', icon: ListChecks, color: 'text-violet-400' },
  delegate: { label: 'Delegated', icon: ArrowRight, color: 'text-blue-400' },
  work: { label: 'Worked', icon: Zap, color: 'text-amber-400' },
  handoff: { label: 'Handed off', icon: CheckCircle2, color: 'text-teal-400' },
  summary: { label: 'Summary', icon: MessageSquare, color: 'text-emerald-400' },
  error: { label: 'Error', icon: XCircle, color: 'text-red-400' },
}

// ─── Task Detail ──────────────────────────────────────────────────────────────

function TaskDetailPanel({ task, onRerun }: { task: TeamTask; onRerun: () => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [rerunning, setRerunning] = useState(false)

  const toggleExpand = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  let plan: { agent_id: string; agent_name: string; objective: string }[] = []
  try { if (task.orchestrator_plan) plan = JSON.parse(task.orchestrator_plan) } catch {}

  const handleRerun = async () => {
    setRerunning(true)
    await onRerun()
    setRerunning(false)
  }

  return (
    <div className="space-y-4">
      {/* Status + meta */}
      <div className="flex items-center gap-3 flex-wrap">
        <StatusBadge status={task.status} />
        <span className="text-xs text-slate-500">{formatDate(task.created_at)}</span>
        {task.status !== 'running' && (
          <button onClick={handleRerun} disabled={rerunning}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/8 border border-[#1e1e2e] text-slate-300 hover:text-white transition-all disabled:opacity-60">
            {rerunning ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Re-run
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-white/3 border border-[#1e1e2e] rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-500 mb-1.5">Instructions</p>
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{task.instructions}</p>
      </div>

      {/* Orchestrator plan */}
      {plan.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Orchestration Plan</p>
          <div className="space-y-2">
            {plan.map((step, i) => (
              <div key={i} className="flex items-start gap-3 bg-violet-500/5 border border-violet-500/15 rounded-xl px-4 py-3">
                <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-violet-400">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-violet-300">{step.agent_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{step.objective}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result summary */}
      {task.result_summary && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
            <CheckCircle2 size={12} /> Final Summary
          </p>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{task.result_summary}</p>
        </div>
      )}

      {/* Error */}
      {task.error_message && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1.5">
            <XCircle size={12} /> Error
          </p>
          <p className="text-sm text-red-300 font-mono text-xs">{task.error_message}</p>
        </div>
      )}

      {/* Running indicator */}
      {task.status === 'running' && (
        <div className="flex items-center gap-3 bg-violet-500/5 border border-violet-500/20 rounded-xl p-4">
          <Loader2 size={16} className="text-violet-400 animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-violet-300">Task is running...</p>
            <p className="text-xs text-slate-500 mt-0.5">Agents are collaborating. Refresh to see updates.</p>
          </div>
        </div>
      )}

      {/* Logs timeline */}
      {(task.logs || []).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Coordination Log</p>
          <div className="space-y-2">
            {(task.logs || []).map((log, i) => {
              const meta = ACTION_META[log.action] || { label: log.action, icon: Zap, color: 'text-slate-400' }
              const Icon = meta.icon
              const isExpanded = expanded[log.id] !== false // default open for summary/plan, collapsed for long work
              const isLong = log.content.length > 300
              const shouldCollapse = isLong && log.action === 'work'
              const showFull = !shouldCollapse || expanded[log.id]

              return (
                <div key={log.id} className="flex gap-3">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      log.role === 'orchestrator' ? 'bg-violet-500/20 border border-violet-500/30' : 'bg-slate-700/50 border border-slate-600/30'
                    }`}>
                      {log.agent?.emoji ? (
                        <span className="text-sm">{log.agent.emoji}</span>
                      ) : (
                        <Bot size={12} className={log.role === 'orchestrator' ? 'text-violet-400' : 'text-slate-400'} />
                      )}
                    </div>
                    {i < (task.logs || []).length - 1 && (
                      <div className="w-px flex-1 bg-[#1e1e2e] min-h-[16px] my-1" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-2">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-bold text-white">{log.agent?.name || log.agent_id.slice(0, 8)}</span>
                      <span className={`inline-flex items-center gap-1 text-xs ${meta.color} font-medium`}>
                        <Icon size={11} /> {meta.label}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        log.role === 'orchestrator' ? 'bg-violet-500/10 text-violet-400' : 'bg-slate-600/20 text-slate-400'
                      }`}>
                        {log.role}
                      </span>
                      <span className="text-[10px] text-slate-600 ml-auto">{timeAgo(log.created_at)}</span>
                    </div>
                    <div className="bg-white/3 border border-[#1e1e2e] rounded-xl px-3 py-2.5">
                      <p className={`text-xs text-slate-300 leading-relaxed whitespace-pre-wrap ${!showFull ? 'line-clamp-4' : ''}`}>
                        {log.content}
                      </p>
                      {shouldCollapse && (
                        <button onClick={() => toggleExpand(log.id)}
                          className="mt-1.5 text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                          {expanded[log.id] ? <><ChevronUp size={11} /> Show less</> : <><ChevronDown size={11} /> Show more</>}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Run Task Modal ────────────────────────────────────────────────────────────

function RunTaskModal({ teamId, teamName, onClose, onStarted }: {
  teamId: string; teamName: string; onClose: () => void; onStarted: (taskId: string) => void
}) {
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const handleRun = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    if (!instructions.trim()) { setError('Instructions are required'); return }
    setRunning(true); setError('')
    const token = getToken()
    try {
      const r = await fetch(`/api/teams/${teamId}/tasks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), instructions: instructions.trim() }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Failed to start task') }
      const task = await r.json()
      onStarted(task.id)
    } catch (e: any) {
      setError(e.message)
      setRunning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-5 border-b border-[#1e1e2e]">
          <h2 className="text-lg font-bold text-white">Run Task — {teamName}</h2>
          <p className="text-xs text-slate-500 mt-0.5">The orchestrator will plan and delegate to team members</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Task Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Write a market analysis report"
              className="w-full px-3 py-2.5 text-sm bg-white/5 border border-[#1e1e2e] rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Instructions *</label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={5}
              placeholder="Describe exactly what you want the team to accomplish. Be specific — the orchestrator will break this into subtasks for each agent."
              className="w-full px-3 py-2.5 text-sm bg-white/5 border border-[#1e1e2e] rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600 resize-none" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#1e1e2e] flex gap-3 justify-end flex-wrap">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-xl transition-colors">Cancel</button>
          <button onClick={handleRun} disabled={running}
            className="gradient-btn flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-60 w-full sm:w-auto justify-center">
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Run Task
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ team, agents, onUpdated, onDeleted }: {
  team: Team; agents: Agent[]; onUpdated: (t: Team) => void; onDeleted: () => void
}) {
  const [name, setName] = useState(team.name)
  const [description, setDescription] = useState(team.description || '')
  const [orchestratorId, setOrchestratorId] = useState(team.orchestrator_agent_id)
  const [memberIds, setMemberIds] = useState<string[]>(team.member_agent_ids)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const toggleMember = (id: string) => setMemberIds(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true); setError(''); setSuccess(false)
    const token = getToken()
    const allMemberIds = Array.from(new Set([orchestratorId, ...memberIds]))
    try {
      const r = await fetch(`/api/teams/${team.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, orchestrator_agent_id: orchestratorId, member_agent_ids: allMemberIds }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Save failed') }
      const updated = await r.json()
      onUpdated(updated)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    const token = getToken()
    try {
      await fetch(`/api/teams/${team.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      onDeleted()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-400">Settings saved!</div>}

      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Team Name *</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full px-3 py-2.5 text-sm bg-white/5 border border-[#1e1e2e] rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
          className="w-full px-3 py-2.5 text-sm bg-white/5 border border-[#1e1e2e] rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600 resize-none" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Orchestrator Agent</label>
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {agents.map(a => (
            <button key={a.id} onClick={() => setOrchestratorId(a.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all text-left border ${
                orchestratorId === a.id ? 'bg-violet-600/20 border-violet-500/40 text-violet-300' : 'bg-white/3 border-[#1e1e2e] text-slate-300 hover:bg-white/5'
              }`}>
              <span>{a.emoji || '🤖'}</span>
              <span className="font-semibold">{a.name}</span>
              {orchestratorId === a.id && <Crown size={12} className="text-violet-400 ml-auto" />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Member Agents</label>
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {agents.map(a => (
            <button key={a.id} onClick={() => toggleMember(a.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all text-left border ${
                memberIds.includes(a.id) ? 'bg-teal-600/15 border-teal-500/30 text-teal-300' : 'bg-white/3 border-[#1e1e2e] text-slate-300 hover:bg-white/5'
              }`}>
              <span>{a.emoji || '🤖'}</span>
              <span className="font-semibold">{a.name}</span>
              {memberIds.includes(a.id) && <CheckCircle2 size={12} className="text-teal-400 ml-auto" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <button onClick={handleSave} disabled={saving}
          className="gradient-btn flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Edit3 size={14} />}
          Save Changes
        </button>
      </div>

      <div className="pt-4 border-t border-[#1e1e2e]">
        <p className="text-xs font-semibold text-red-400 mb-2">Danger Zone</p>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all">
            <Trash2 size={14} /> Delete Team
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-xs text-red-400">Are you sure? This cannot be undone.</p>
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-60">
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Yes, Delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeamDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [team, setTeam] = useState<Team | null>(null)
  const [tasks, setTasks] = useState<TeamTask[]>([])
  const [selectedTask, setSelectedTask] = useState<TeamTask | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'tasks' | 'settings'>('overview')
  const [showRunTask, setShowRunTask] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadTeam = useCallback(async () => {
    const token = getToken()
    if (!token || !id) return
    const [teamRes, tasksRes, agentsRes] = await Promise.all([
      fetch(`/api/teams/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/team-tasks?team_id=${id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
    ])
    if (teamRes) setTeam(teamRes)
    if (Array.isArray(tasksRes)) setTasks(tasksRes)
    if (Array.isArray(agentsRes)) setAgents(agentsRes)
    setLoading(false)
  }, [id])

  const loadSelectedTask = useCallback(async (taskId: string) => {
    const token = getToken()
    if (!token) return
    const r = await fetch(`/api/team-tasks/${taskId}`, { headers: { Authorization: `Bearer ${token}` } })
    if (r.ok) {
      const data = await r.json()
      setSelectedTask(data)
      // update task in list too
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: data.status, result_summary: data.result_summary, error_message: data.error_message } : t))
    }
  }, [])

  useEffect(() => {
    loadTeam()
  }, [loadTeam])

  // Auto-select task from URL param
  useEffect(() => {
    const taskId = searchParams.get('task')
    if (taskId && tasks.length > 0) {
      loadSelectedTask(taskId)
      setTab('tasks')
    }
  }, [searchParams, tasks.length, loadSelectedTask])

  // Poll running tasks
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    const hasRunning = selectedTask?.status === 'running' || tasks.some(t => t.status === 'running')
    if (hasRunning) {
      pollingRef.current = setInterval(() => {
        if (selectedTask?.status === 'running') loadSelectedTask(selectedTask.id)
        else loadTeam()
      }, 3000)
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [selectedTask, tasks, loadSelectedTask, loadTeam])

  const handleRerun = async () => {
    if (!selectedTask) return
    const token = getToken()
    const r = await fetch(`/api/team-tasks/${selectedTask.id}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (r.ok) {
      const updated = await r.json()
      setSelectedTask({ ...updated, logs: [] })
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
    }
  }

  const handleTaskStarted = (taskId: string) => {
    setShowRunTask(false)
    setTab('tasks')
    setSearchParams({ task: taskId })
    loadSelectedTask(taskId)
    loadTeam()
  }

  if (loading) return (
    <DashboardLayout title="Team">
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-white/5 rounded-xl w-48" />
        <div className="h-24 bg-white/5 rounded-2xl" />
        <div className="h-64 bg-white/5 rounded-2xl" />
      </div>
    </DashboardLayout>
  )

  if (!team) return (
    <DashboardLayout title="Team">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <XCircle size={32} className="text-red-400 mb-3" />
        <h3 className="text-lg font-bold text-white mb-2">Team not found</h3>
        <button onClick={() => navigate('/dashboard/teams')} className="text-violet-400 hover:underline text-sm">
          ← Back to Teams
        </button>
      </div>
    </DashboardLayout>
  )

  const runningCount = tasks.filter(t => t.status === 'running').length
  const successCount = tasks.filter(t => t.status === 'success').length
  const errorCount = tasks.filter(t => t.status === 'error').length
  const recentThree = tasks.slice(0, 3)

  return (
    <DashboardLayout title={team.name}>
      {/* Back */}
      <button onClick={() => navigate('/dashboard/teams')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 mb-4 transition-colors">
        <ChevronLeft size={14} /> Teams
      </button>

      {/* Team header */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-5 mb-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Users2 size={22} className="text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">{team.name}</h1>
            {team.description && <p className="text-sm text-slate-500 mt-0.5">{team.description}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              {team.orchestrator && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs font-semibold text-violet-300">
                  <Crown size={10} /> {team.orchestrator.emoji || '🤖'} {team.orchestrator.name}
                </span>
              )}
              {(team.members || []).filter(m => m.id !== team.orchestrator_agent_id).map((m: any) => (
                <span key={m.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-[#1e1e2e] text-xs text-slate-300">
                  {m.emoji || '🤖'} {m.name}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={() => { setTab('settings') }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/8 border border-[#1e1e2e] text-slate-300 hover:text-white transition-all">
              <Settings2 size={13} /> Settings
            </button>
            <button onClick={() => setShowRunTask(true)}
              className="gradient-btn flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold flex-1 sm:flex-none justify-center">
              <Play size={13} /> Run Task
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-[#111118] border border-[#1e1e2e] rounded-xl p-1 w-fit">
        {(['overview', 'tasks', 'settings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all ${
              tab === t ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}>
            {t === 'tasks' ? `Tasks${tasks.length > 0 ? ` (${tasks.length})` : ''}` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Tasks', value: tasks.length, color: 'text-slate-300' },
              { label: 'Running', value: runningCount, color: 'text-violet-400' },
              { label: 'Successful', value: successCount, color: 'text-emerald-400' },
              { label: 'Errors', value: errorCount, color: 'text-red-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-slate-600 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Recent tasks */}
          {recentThree.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Recent Tasks</h3>
              <div className="space-y-2">
                {recentThree.map(task => (
                  <button key={task.id} onClick={() => { setTab('tasks'); loadSelectedTask(task.id) }}
                    className="w-full flex items-center gap-3 bg-[#111118] border border-[#1e1e2e] hover:border-violet-500/30 rounded-xl px-4 py-3 text-left transition-all group">
                    <StatusBadge status={task.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors truncate">{task.title}</p>
                      <p className="text-xs text-slate-500 truncate">{task.instructions.slice(0, 80)}</p>
                    </div>
                    <span className="text-xs text-slate-600 flex-shrink-0">{timeAgo(task.created_at)}</span>
                    <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-[#111118] border border-[#1e1e2e] rounded-2xl">
              <Zap size={24} className="text-slate-600 mb-3" />
              <p className="text-sm font-semibold text-slate-400 mb-1">No tasks yet</p>
              <p className="text-xs text-slate-600 mb-4">Run your first task to see team coordination in action</p>
              <button onClick={() => setShowRunTask(true)} className="gradient-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold">
                <Play size={13} /> Run First Task
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tasks */}
      {tab === 'tasks' && (
        <div className="flex gap-5 flex-col lg:flex-row">
          {/* Task list */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">All Tasks</h3>
              <button onClick={() => setShowRunTask(true)}
                className="gradient-btn flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold">
                <Plus size={12} /> New
              </button>
            </div>
            {tasks.length === 0 ? (
              <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-4 text-center">
                <p className="text-xs text-slate-600">No tasks yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => (
                  <button key={task.id} onClick={() => { loadSelectedTask(task.id); setSearchParams({ task: task.id }) }}
                    className={`w-full flex items-start gap-3 rounded-xl px-3 py-3 text-left transition-all border ${
                      selectedTask?.id === task.id
                        ? 'bg-violet-600/15 border-violet-500/30'
                        : 'bg-[#111118] border-[#1e1e2e] hover:border-violet-500/20'
                    }`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{task.title}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">{timeAgo(task.created_at)}</p>
                    </div>
                    <StatusBadge status={task.status} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Task detail */}
          <div className="flex-1 min-w-0">
            {selectedTask ? (
              <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-5">
                <h3 className="text-base font-bold text-white mb-4">{selectedTask.title}</h3>
                <TaskDetailPanel task={selectedTask} onRerun={handleRerun} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-[#111118] border border-[#1e1e2e] rounded-2xl">
                <ListChecks size={24} className="text-slate-600 mb-3" />
                <p className="text-sm text-slate-600">Select a task to view details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings */}
      {tab === 'settings' && (
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-5">
          <h3 className="text-base font-bold text-white mb-5">Team Settings</h3>
          <SettingsTab team={team} agents={agents}
            onUpdated={updated => setTeam(prev => prev ? { ...prev, ...updated } : prev)}
            onDeleted={() => navigate('/dashboard/teams')} />
        </div>
      )}

      {/* Run Task Modal */}
      {showRunTask && (
        <RunTaskModal teamId={team.id} teamName={team.name}
          onClose={() => setShowRunTask(false)}
          onStarted={handleTaskStarted} />
      )}
    </DashboardLayout>
  )
}
