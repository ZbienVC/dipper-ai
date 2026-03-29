import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { Users2, Plus, Play, Eye, Bot, CheckCircle2, XCircle, Clock, Loader2, ChevronRight } from 'lucide-react'

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
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20">
      <Loader2 size={11} className="animate-spin" /> Running
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/20">
      <Clock size={11} /> Pending
    </span>
  )
}

interface Agent { id: string; name: string; emoji: string; description?: string }
interface Team {
  id: string; name: string; description?: string;
  orchestrator_agent_id: string; member_agent_ids: string[];
  orchestrator?: Agent; members?: Agent[]; lastTask?: { status: string; created_at: string } | null;
  created_at: string; updated_at: string;
}

// ─── New Team Modal ───────────────────────────────────────────────────────────

function NewTeamModal({ agents, onClose, onCreated }: {
  agents: Agent[]; onClose: () => void; onCreated: (team: Team) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [orchestratorId, setOrchestratorId] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleMember = (id: string) => {
    setMemberIds(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
  }

  const handleCreate = async () => {
    if (!name.trim()) { setError('Team name is required'); return }
    if (!orchestratorId) { setError('Select an orchestrator agent'); return }
    if (memberIds.length === 0) { setError('Add at least one member agent'); return }
    setSaving(true); setError('')
    const token = getToken()
    const allMemberIds = Array.from(new Set([orchestratorId, ...memberIds]))
    try {
      const r = await fetch('/api/teams', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, orchestrator_agent_id: orchestratorId, member_agent_ids: allMemberIds }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Failed to create team') }
      const team = await r.json()
      onCreated(team)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-5 border-b border-[#1e1e2e] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">New Agent Team</h2>
            <p className="text-xs text-slate-500 mt-0.5">Form a team of agents that collaborate on tasks</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Team Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Research & Writing Team"
              className="w-full px-3 py-2.5 text-sm bg-white/5 border border-[#1e1e2e] rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Description <span className="text-slate-600">(optional)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="What does this team do?"
              className="w-full px-3 py-2.5 text-sm bg-white/5 border border-[#1e1e2e] rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Orchestrator Agent *</label>
            <p className="text-xs text-slate-600 mb-2">The orchestrator plans and delegates tasks to the team.</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {agents.length === 0 && <p className="text-xs text-slate-600 py-2">No agents yet. <a href="/dashboard/agents/new" className="text-violet-400 hover:underline">Create one first.</a></p>}
              {agents.map(a => (
                <button key={a.id} onClick={() => setOrchestratorId(a.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left border ${
                    orchestratorId === a.id ? 'bg-violet-600/20 border-violet-500/40 text-violet-300' : 'bg-white/3 border-[#1e1e2e] text-slate-300 hover:bg-white/5'
                  }`}>
                  <span className="text-lg">{a.emoji || '🤖'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{a.name}</div>
                    {a.description && <div className="text-xs text-slate-500 truncate">{a.description}</div>}
                  </div>
                  {orchestratorId === a.id && <CheckCircle2 size={14} className="text-violet-400 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Member Agents *</label>
            <p className="text-xs text-slate-600 mb-2">Select agents that will carry out subtasks. The orchestrator is automatically included.</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {agents.map(a => (
                <button key={a.id} onClick={() => toggleMember(a.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left border ${
                    memberIds.includes(a.id) ? 'bg-teal-600/15 border-teal-500/30 text-teal-300' : 'bg-white/3 border-[#1e1e2e] text-slate-300 hover:bg-white/5'
                  }`}>
                  <span className="text-lg">{a.emoji || '🤖'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{a.name}</div>
                    {a.description && <div className="text-xs text-slate-500 truncate">{a.description}</div>}
                  </div>
                  {memberIds.includes(a.id) && <CheckCircle2 size={14} className="text-teal-400 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#1e1e2e] flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-xl transition-colors">Cancel</button>
          <button onClick={handleCreate} disabled={saving}
            className="gradient-btn flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create Team
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Run Task Modal ────────────────────────────────────────────────────────────

function RunTaskModal({ team, onClose, onStarted }: {
  team: Team; onClose: () => void; onStarted: () => void
}) {
  const navigate = useNavigate()
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
      const r = await fetch(`/api/teams/${team.id}/tasks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), instructions: instructions.trim() }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Failed to start task') }
      const task = await r.json()
      onStarted()
      navigate(`/dashboard/teams/${team.id}?task=${task.id}`)
    } catch (e: any) {
      setError(e.message)
      setRunning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-5 border-b border-[#1e1e2e]">
          <h2 className="text-lg font-bold text-white">Run Task — {team.name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">The orchestrator will delegate this to the team</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Task Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Write a market analysis"
              className="w-full px-3 py-2.5 text-sm bg-white/5 border border-[#1e1e2e] rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Instructions *</label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={4}
              placeholder="Describe what you want the team to accomplish in detail..."
              className="w-full px-3 py-2.5 text-sm bg-white/5 border border-[#1e1e2e] rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600 resize-none" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#1e1e2e] flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-xl transition-colors">Cancel</button>
          <button onClick={handleRun} disabled={running}
            className="gradient-btn flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-60">
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Run Task
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Team Card ────────────────────────────────────────────────────────────────

function TeamCard({ team, onView, onRunTask }: { team: Team; onView: () => void; onRunTask: () => void }) {
  const memberSlice = (team.members || []).slice(0, 4)
  const extra = (team.members || []).length - 4

  return (
    <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-5 hover:border-violet-500/30 transition-all group flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Users2 size={18} className="text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-white truncate group-hover:text-violet-300 transition-colors">{team.name}</h3>
          {team.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{team.description}</p>}
        </div>
      </div>

      {/* Orchestrator */}
      {team.orchestrator && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-600 font-medium">Orchestrator:</span>
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 font-semibold">
            <span>{team.orchestrator.emoji || '🤖'}</span> {team.orchestrator.name}
          </span>
        </div>
      )}

      {/* Members */}
      <div>
        <p className="text-xs text-slate-600 mb-2 font-medium">{(team.members || []).length} member{(team.members || []).length !== 1 ? 's' : ''}</p>
        <div className="flex flex-wrap gap-1.5">
          {memberSlice.map((m: any) => (
            <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 border border-[#1e1e2e] text-xs text-slate-300">
              <span>{m.emoji || '🤖'}</span> {m.name}
            </span>
          ))}
          {extra > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-white/5 border border-[#1e1e2e] text-xs text-slate-500">
              +{extra} more
            </span>
          )}
        </div>
      </div>

      {/* Last task */}
      <div className="flex items-center gap-2 text-xs text-slate-600">
        {team.lastTask ? (
          <>
            <span>Last task:</span>
            <StatusBadge status={team.lastTask.status} />
            <span className="ml-auto text-slate-600">{timeAgo(team.lastTask.created_at)}</span>
          </>
        ) : (
          <span className="text-slate-600">No tasks yet</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        <button onClick={onView}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/8 text-slate-300 hover:text-white border border-[#1e1e2e] transition-all">
          <Eye size={12} /> View
        </button>
        <button onClick={onRunTask}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold gradient-btn transition-all">
          <Play size={12} /> Run Task
        </button>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TeamCardSkeleton() {
  return (
    <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-5 space-y-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 bg-white/5 rounded w-2/3" />
          <div className="h-3 bg-white/5 rounded w-1/2" />
        </div>
      </div>
      <div className="h-3 bg-white/5 rounded w-1/3" />
      <div className="flex gap-1.5">
        <div className="h-5 bg-white/5 rounded-lg w-20" />
        <div className="h-5 bg-white/5 rounded-lg w-16" />
      </div>
      <div className="h-3 bg-white/5 rounded w-24 mt-auto" />
      <div className="flex gap-2">
        <div className="flex-1 h-8 bg-white/5 rounded-xl" />
        <div className="flex-1 h-8 bg-white/5 rounded-xl" />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Teams() {
  const navigate = useNavigate()
  const [teams, setTeams] = useState<Team[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewTeam, setShowNewTeam] = useState(false)
  const [runTaskFor, setRunTaskFor] = useState<Team | null>(null)

  const load = useCallback(() => {
    const token = getToken()
    if (!token) { setLoading(false); return }
    Promise.all([
      fetch('/api/teams', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
      fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
    ]).then(([teamsData, agentsData]) => {
      if (Array.isArray(teamsData)) setTeams(teamsData)
      if (Array.isArray(agentsData)) setAgents(agentsData)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <DashboardLayout title="Agent Teams">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Agent Teams</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Form teams of agents that collaborate on complex tasks</p>
        </div>
        <button onClick={() => setShowNewTeam(true)}
          className="gradient-btn flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm w-full sm:w-auto justify-center">
          <Plus size={15} /> New Team
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <TeamCardSkeleton key={i} />)}
        </div>
      ) : teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
            <Users2 size={28} className="text-violet-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No teams yet</h3>
          <p className="text-slate-500 text-sm mb-6 max-w-sm">
            Create your first agent team to enable multi-agent collaboration on complex tasks.
          </p>
          {agents.length === 0 && (
            <p className="text-slate-600 text-xs mb-4">
              You need at least one agent first. <button onClick={() => navigate('/dashboard/agents/new')} className="text-violet-400 hover:underline">Create an agent →</button>
            </p>
          )}
          <button onClick={() => setShowNewTeam(true)} disabled={agents.length === 0}
            className="gradient-btn flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50">
            <Plus size={15} /> Create Your First Team
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {teams.map(team => (
            <TeamCard key={team.id} team={team}
              onView={() => navigate(`/dashboard/teams/${team.id}`)}
              onRunTask={() => setRunTaskFor(team)} />
          ))}
        </div>
      )}

      {/* Quick link to detail */}
      {teams.length > 0 && (
        <div className="mt-6 flex items-center gap-2 text-xs text-slate-600">
          <Bot size={12} />
          <span>{teams.length} team{teams.length !== 1 ? 's' : ''} · {teams.reduce((acc, t) => acc + (t.members?.length || 0), 0)} total agent slots</span>
          <ChevronRight size={12} className="ml-auto" />
        </div>
      )}

      {/* Modals */}
      {showNewTeam && (
        <NewTeamModal agents={agents} onClose={() => setShowNewTeam(false)} onCreated={team => {
          setTeams(prev => [team, ...prev])
          setShowNewTeam(false)
          navigate(`/dashboard/teams/${team.id}`)
        }} />
      )}
      {runTaskFor && (
        <RunTaskModal team={runTaskFor} onClose={() => setRunTaskFor(null)} onStarted={() => setRunTaskFor(null)} />
      )}
    </DashboardLayout>
  )
}
