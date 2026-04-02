import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import {
  MessageSquare, Send, Terminal, Plug, Bot, AlertCircle, Zap, Clock,
  Activity, CheckCircle, ChevronDown, ChevronRight, RefreshCw, Trash2, Download
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
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

const EVENT_ICONS: Record<string, any> = {
  message_received: MessageSquare,
  message_sent: Send,
  command_executed: Terminal,
  integration_connected: Plug,
  integration_disconnected: Plug,
  agent_created: Bot,
  agent_updated: Bot,
  error: AlertCircle,
  automation_triggered: Zap,
  scheduled_sent: Clock,
}

const CHANNEL_COLORS: Record<string, string> = {
  telegram: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  sms: 'bg-green-500/15 text-green-400 border-green-500/20',
  web: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
  discord: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  twitter: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  system: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
}

type ActivityLog = {
  id: string; user_id: string; agent_id: string; agent_name: string;
  event_type: string; channel: string; summary: string; details?: string;
  model_used?: string; tokens_used?: number; latency_ms?: number;
  status: 'success' | 'error'; error_message?: string; created_at: string;
}

type Stats = {
  totalMessages: number; messagesToday: number; messagesThisWeek: number;
  avgResponseTimeMs: number; successRate: number;
  topChannels: { channel: string; count: number }[]; activeAgents: number;
}

function SkeletonCard() {
  return (
    <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 animate-pulse">
      <div className="h-3 w-24 bg-white/5 rounded mb-3" />
      <div className="h-7 w-16 bg-white/5 rounded mb-1" />
      <div className="h-2.5 w-20 bg-white/5 rounded" />
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-4 p-4 border-b border-[#1e1e2e] animate-pulse">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-48 bg-white/5 rounded" />
        <div className="h-2.5 w-64 bg-white/5 rounded" />
      </div>
      <div className="h-3 w-16 bg-white/5 rounded mt-1" />
    </div>
  )
}

function LogEntry({ log }: { log: ActivityLog }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = EVENT_ICONS[log.event_type] || Activity
  const channelClass = CHANNEL_COLORS[log.channel] || CHANNEL_COLORS.system

  return (
    <div className={`group border-b border-[#1e1e2e] transition-colors hover:bg-white/[0.02] ${expanded ? 'bg-white/[0.02]' : ''}`}>
      <div className="flex items-start gap-4 p-4">
        {/* Icon */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
          log.status === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-violet-500/10 text-violet-400'
        }`}>
          <Icon size={14} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-white">{log.agent_name || 'System'}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${channelClass}`}>
              {log.channel.toUpperCase()}
            </span>
            {log.model_used && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-[#1e1e2e]">
                {log.model_used.split('-').slice(0, 2).join('-')}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-300 leading-snug">{log.summary}</p>

          {/* Meta */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {log.tokens_used != null && log.tokens_used > 0 && (
              <span className="text-xs text-slate-600">{log.tokens_used.toLocaleString()} tokens</span>
            )}
            {log.latency_ms != null && log.latency_ms > 0 && (
              <span className="text-xs text-slate-600">{log.latency_ms}ms</span>
            )}
            {log.error_message && (
              <span className="text-xs text-red-500 truncate max-w-xs">{log.error_message}</span>
            )}
            {log.details && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="text-xs text-violet-500 hover:text-violet-400 flex items-center gap-0.5 transition-colors"
              >
                {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                {expanded ? 'hide' : 'details'}
              </button>
            )}
          </div>

          {expanded && log.details && (
            <div className="mt-2 p-3 bg-black/30 rounded-lg border border-[#1e1e2e]">
              <p className="text-xs text-slate-400 font-mono leading-relaxed">{log.details}</p>
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-slate-600">{timeAgo(log.created_at)}</span>
        </div>
      </div>
    </div>
  )
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [agents, setAgents] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [filterAgent, setFilterAgent] = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  const LIMIT = 20

  const fetchLogs = useCallback(async (off = 0, append = false) => {
    const token = getToken()
    if (!token) return
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) })
    if (filterAgent) params.set('agentId', filterAgent)
    if (filterChannel) params.set('channel', filterChannel)
    if (filterStatus) params.set('status', filterStatus)
    const res = await fetch(`/api/activity?${params}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const data = await res.json()
    setLogs(prev => append ? [...prev, ...data.logs] : data.logs)
    setTotal(data.total)
  }, [filterAgent, filterChannel, filterStatus])

  const fetchStats = useCallback(async () => {
    const token = getToken()
    if (!token) return
    const res = await fetch('/api/activity/stats', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setStats(await res.json())
  }, [])

  const fetchAgents = useCallback(async () => {
    const token = getToken()
    if (!token) return
    const res = await fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setAgents(await res.json())
  }, [])

  useEffect(() => {
    setLoading(true)
    setStatsLoading(true)
    Promise.all([
      fetchLogs(0).finally(() => setLoading(false)),
      fetchStats().finally(() => setStatsLoading(false)),
      fetchAgents(),
    ])
    setOffset(0)
  }, [fetchLogs, fetchStats, fetchAgents, lastRefresh])

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => setLastRefresh(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const handleLoadMore = async () => {
    const newOffset = offset + LIMIT
    setLoadingMore(true)
    await fetchLogs(newOffset, true)
    setOffset(newOffset)
    setLoadingMore(false)
  }

  const handleClearLogs = async () => {
    const token = getToken()
    if (!token) return
    await fetch('/api/activity', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setLogs([])
    setTotal(0)
    setStats(s => s ? { ...s, totalMessages: 0, messagesToday: 0, messagesThisWeek: 0 } : null)
    setConfirmClear(false)
  }

  const statCards = [
    {
      label: 'Total Messages',
      value: stats?.totalMessages?.toLocaleString() ?? '—',
      sub: 'All time',
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
    },
    {
      label: 'Messages Today',
      value: stats?.messagesToday?.toLocaleString() ?? '—',
      sub: 'Last 24 hours',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      label: 'Avg Response Time',
      value: stats?.avgResponseTimeMs ? `${stats.avgResponseTimeMs}ms` : '—',
      sub: 'Per message',
      color: 'text-teal-400',
      bg: 'bg-teal-500/10',
      border: 'border-teal-500/20',
    },
    {
      label: 'Success Rate',
      value: stats != null ? `${stats.successRate}%` : '—',
      sub: 'All events',
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
    },
  ]

  return (
    <DashboardLayout title="Activity">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {statsLoading
          ? [0, 1, 2, 3].map(i => <SkeletonCard key={i} />)
          : statCards.map(s => (
            <div key={s.label} className={`bg-[#111118] rounded-xl p-5 border ${s.border} hover:border-violet-500/30 transition-colors`}>
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center mb-4`}>
                <Activity size={18} className={s.color} />
              </div>
              <p className="text-2xl font-bold text-white mb-0.5">{s.value}</p>
              <p className="text-sm font-medium text-slate-400">{s.label}</p>
              <p className="text-xs text-slate-600 mt-1">{s.sub}</p>
            </div>
          ))
        }
      </div>

      {/* Filter Bar */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-4 mb-4 flex items-center gap-3 flex-wrap">
        <select
          value={filterAgent}
          onChange={e => { setFilterAgent(e.target.value); setOffset(0) }}
          className="bg-white/5 border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer"
        >
          <option value="">All Agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
        </select>

        <select
          value={filterChannel}
          onChange={e => { setFilterChannel(e.target.value); setOffset(0) }}
          className="bg-white/5 border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer"
        >
          <option value="">All Channels</option>
          {['web', 'telegram', 'sms', 'discord', 'twitter', 'system'].map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setOffset(0) }}
          className="bg-white/5 border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer"
        >
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setLastRefresh(Date.now())}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-[#1e1e2e] transition-colors"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
          <div className="ml-auto flex items-center gap-2">
          <a
            href={`/api/activity/export?format=csv`}
            onClick={e => { const t = getToken(); if (!t) return; e.preventDefault(); const url = '/api/activity/export?format=csv'; fetch(url, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.blob()).then(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'activity.csv'; a.click() }) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[#1e1e2e] text-slate-400 hover:bg-white/5 hover:text-white transition-all"
          >
            <Download size={13} /> Export CSV
          </a>
          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors"
            >
              <Trash2 size={13} />
              Clear Logs
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Are you sure?</span>
              <button onClick={handleClearLogs} className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors">Yes, clear</button>
              <button onClick={() => setConfirmClear(false)} className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:bg-white/5 transition-colors">Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* Activity Feed */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2e]">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-slate-500" />
            <span className="text-sm font-semibold text-white">Live Feed</span>
            {total > 0 && <span className="text-xs text-slate-500">{total.toLocaleString()} events</span>}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Auto-refresh every 30s
          </div>
        </div>

        {loading ? (
          <div>
            {[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
              <Activity size={24} className="text-violet-400" />
            </div>
            <p className="text-white font-semibold mb-1">No activity yet</p>
            <p className="text-slate-500 text-sm text-center max-w-xs">
              Your agents will show up here once they start working.{' '}
              <Link to="/dashboard/agents/new" className="text-violet-400 hover:text-violet-300 transition-colors">Create an agent</Link> to get started.
            </p>
          </div>
        ) : (
          <>
            {logs.map(log => <LogEntry key={log.id} log={log} />)}
            {offset + LIMIT < total && (
              <div className="flex justify-center p-4 border-t border-[#1e1e2e]">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-violet-400 border border-violet-500/20 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                  Load more ({total - (offset + LIMIT)} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
