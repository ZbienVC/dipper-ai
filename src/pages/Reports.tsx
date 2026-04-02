import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import {
  FileText, Download, Mail, Calendar, Users2, MessageSquare,
  TrendingUp, Clock, Bot, CheckCircle2, Loader2, BarChart2, Send
} from 'lucide-react'

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

interface Team {
  id: string
  name: string
}

interface ReportData {
  team: { id: string; name: string }
  period: { from: string; to: string }
  totalMessages: number
  activeAgents: number
  totalAgents: number
  avgResponseTimeMs: number
  topQuestions: { question: string; count: number }[]
  leadsCapture: number
  agentUptime: number
  messagesByDay: { date: string; count: number }[]
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: any; color: string }) {
  return (
    <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={16} />
        </div>
        <span className="text-xs font-semibold text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-slate-600 mt-1">{sub}</div>}
    </div>
  )
}

export default function Reports() {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState('')
  const [teamsLoading, setTeamsLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) return
    fetch('/api/teams', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setTeams(data)
          if (data.length > 0) setSelectedTeam(data[0].id)
        }
      })
      .catch(() => {})
      .finally(() => setTeamsLoading(false))
  }, [])

  const generateReport = async () => {
    if (!selectedTeam) { setError('Select a client first'); return }
    setLoading(true)
    setError('')
    setEmailSent(false)
    const token = getToken()
    try {
      const r = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: selectedTeam, from: dateFrom, to: dateTo }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Failed to generate report') }
      const data = await r.json()
      setReport(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const emailReport = async () => {
    if (!report) return
    setEmailLoading(true)
    const token = getToken()
    try {
      await fetch('/api/reports/email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: selectedTeam, from: dateFrom, to: dateTo }),
      })
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 4000)
    } catch {}
    finally { setEmailLoading(false) }
  }

  const downloadPDF = () => {
    if (!report) return
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Report - ${report.team.name}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; color: #1a1a2e; padding: 0 20px; }
    h1 { color: #7c3aed; margin-bottom: 4px; }
    .sub { color: #666; margin-bottom: 32px; font-size: 14px; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
    .stat-label { font-size: 12px; color: #888; margin-bottom: 4px; }
    .stat-value { font-size: 28px; font-weight: 700; color: #111; }
    h2 { margin-top: 32px; font-size: 16px; color: #7c3aed; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    td, th { padding: 8px 12px; border: 1px solid #e5e7eb; font-size: 13px; text-align: left; }
    th { background: #f9f9ff; font-weight: 600; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>Client Report — ${report.team.name}</h1>
  <div class="sub">Period: ${report.period.from} to ${report.period.to}</div>
  <div class="stats">
    <div class="stat"><div class="stat-label">Total Messages</div><div class="stat-value">${report.totalMessages.toLocaleString()}</div></div>
    <div class="stat"><div class="stat-label">Active Agents</div><div class="stat-value">${report.activeAgents}/${report.totalAgents}</div></div>
    <div class="stat"><div class="stat-label">Avg Response Time</div><div class="stat-value">${formatMs(report.avgResponseTimeMs)}</div></div>
    <div class="stat"><div class="stat-label">Leads Captured</div><div class="stat-value">${report.leadsCapture}</div></div>
    <div class="stat"><div class="stat-label">Agent Uptime</div><div class="stat-value">${report.agentUptime}%</div></div>
  </div>
  ${report.topQuestions.length > 0 ? `
  <h2>Top Questions</h2>
  <table><tr><th>Question</th><th>Count</th></tr>
  ${report.topQuestions.map(q => `<tr><td>${q.question}</td><td>${q.count}</td></tr>`).join('')}
  </table>` : ''}
  <p style="margin-top:40px;font-size:12px;color:#999;">Generated by DipperAI Agency Platform</p>
</body>
</html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${report.team.name.replace(/\s+/g, '-').toLowerCase()}-${dateFrom}-to-${dateTo}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DashboardLayout title="Client Reports">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2"><FileText size={20} className="text-violet-400" /> Client Reports</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Generate performance reports for your clients and share them directly.</p>
      </div>

      {/* Config panel */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          {/* Client selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Client (Team)</label>
            {teamsLoading ? (
              <div className="h-10 bg-white/5 rounded-xl animate-pulse" />
            ) : teams.length === 0 ? (
              <div className="px-3 py-2.5 text-sm bg-white/5 border border-[#1e1e2e] rounded-xl text-slate-500">
                No clients yet — <a href="/dashboard/teams" className="text-violet-400 hover:underline">create a team first</a>
              </div>
            ) : (
              <select
                value={selectedTeam}
                onChange={e => setSelectedTeam(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-white/5 border border-[#1e1e2e] rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white"
              >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
          {/* Date range */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-white/5 border border-[#1e1e2e] rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-white/5 border border-[#1e1e2e] rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white" />
          </div>
        </div>
        {error && <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
        <button
          onClick={generateReport}
          disabled={loading || teams.length === 0}
          className="gradient-btn flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <BarChart2 size={15} />}
          Generate Report
        </button>
      </div>

      {/* Report output */}
      {report && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users2 size={18} className="text-violet-400" /> {report.team.name}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <Calendar size={11} /> {report.period.from} — {report.period.to}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={emailReport}
                disabled={emailLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-[#1e1e2e] text-slate-300 hover:bg-white/5 transition-all disabled:opacity-60"
              >
                {emailLoading ? <Loader2 size={13} className="animate-spin" /> : emailSent ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Mail size={13} />}
                {emailSent ? 'Sent!' : 'Email to Client'}
              </button>
              <button
                onClick={downloadPDF}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold gradient-btn"
              >
                <Download size={13} /> Download
              </button>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard label="Messages" value={report.totalMessages.toLocaleString()} icon={MessageSquare} color="bg-violet-500/10 text-violet-400" />
            <StatCard label="Active Agents" value={`${report.activeAgents}/${report.totalAgents}`} icon={Bot} color="bg-teal-500/10 text-teal-400" />
            <StatCard label="Avg Response" value={formatMs(report.avgResponseTimeMs)} icon={Clock} color="bg-blue-500/10 text-blue-400" />
            <StatCard label="Leads Captured" value={String(report.leadsCapture)} icon={Send} color="bg-amber-500/10 text-amber-400" />
            <StatCard label="Agent Uptime" value={`${report.agentUptime}%`} icon={TrendingUp} color="bg-emerald-500/10 text-emerald-400" />
          </div>

          {/* Top questions */}
          {report.topQuestions.length > 0 && (
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <MessageSquare size={14} className="text-violet-400" /> Top Questions
              </h3>
              <div className="space-y-2">
                {report.topQuestions.map((q, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <span className="flex-1 text-sm text-slate-300 truncate">{q.question}</span>
                    <span className="text-xs text-slate-500 flex-shrink-0">{q.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message volume chart (simple bar) */}
          {report.messagesByDay.length > 0 && (
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <BarChart2 size={14} className="text-violet-400" /> Message Volume
              </h3>
              <div className="flex items-end gap-1 h-24">
                {(() => {
                  const max = Math.max(...report.messagesByDay.map(d => d.count), 1)
                  return report.messagesByDay.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-violet-500/40 hover:bg-violet-500/60 transition-colors"
                        style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
                        title={`${d.date}: ${d.count} msgs`}
                      />
                    </div>
                  ))
                })()}
              </div>
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>{report.messagesByDay[0]?.date}</span>
                <span>{report.messagesByDay[report.messagesByDay.length - 1]?.date}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {!report && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
            <FileText size={28} className="text-violet-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No Report Yet</h3>
          <p className="text-slate-500 text-sm max-w-sm">Select a client and date range, then click Generate Report to see performance data.</p>
        </div>
      )}
    </DashboardLayout>
  )
}
