import { useState, useEffect } from 'react'
import { Shield, Users, Bot, MessageSquare, TrendingUp, Circle, LogOut, ChevronDown } from 'lucide-react'

interface AdminStats {
  totalUsers: number
  totalAgents: number
  messagesToday: number
  messagesThisMonth: number
  planBreakdown: { free: number; pro: number; business: number }
  recentUsers: Array<{
    id: string; email: string; plan: string; agentCount: number
    messages_today: number; created_at: string
  }>
  apiKeyStatus: { anthropic: boolean; openai: boolean; gemini: boolean }
}

interface AdminUser {
  id: string; email: string; username: string; plan: string
  agentCount: number; messages_today: number; created_at: string
}

const ADMIN_TOKEN_KEY = 'dipperai_admin'

export default function Admin() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ADMIN_TOKEN_KEY))
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [changingPlan, setChangingPlan] = useState<string | null>(null)

  const adminHeaders = { 'Content-Type': 'application/json', 'X-Admin-Token': token || '' }

  async function loadData() {
    if (!token) return
    setLoading(true)
    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: adminHeaders }),
        fetch('/api/admin/users', { headers: adminHeaders }),
      ])
      if (statsRes.status === 401) { logout(); return }
      if (statsRes.ok) setStats(await statsRes.json())
      if (usersRes.ok) setUsers(await usersRes.json())
    } catch {}
    setLoading(false)
  }

  useEffect(() => { if (token) loadData() }, [token])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (data.token) {
        localStorage.setItem(ADMIN_TOKEN_KEY, data.token)
        setToken(data.token)
      } else {
        setLoginError(data.error || 'Invalid password')
      }
    } catch {
      setLoginError('Connection error')
    }
    setLoginLoading(false)
  }

  function logout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    setToken(null)
    setStats(null)
    setUsers([])
  }

  async function changePlan(userId: string, plan: string) {
    setChangingPlan(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH', headers: adminHeaders,
        body: JSON.stringify({ plan }),
      })
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan } : u))
        if (stats) {
          const updatedUser = users.find(u => u.id === userId)
          if (updatedUser) {
            const newBreakdown = { ...stats.planBreakdown }
            const oldPlan = updatedUser.plan as keyof typeof newBreakdown
            const newPlan = plan as keyof typeof newBreakdown
            if (oldPlan in newBreakdown) newBreakdown[oldPlan]--
            if (newPlan in newBreakdown) newBreakdown[newPlan]++
            setStats({ ...stats, planBreakdown: newBreakdown })
          }
        }
      }
    } catch {}
    setChangingPlan(null)
  }

  const planColor = (plan: string) => {
    if (plan === 'business') return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    if (plan === 'pro') return 'text-violet-400 bg-violet-500/10 border-violet-500/20'
    return 'text-slate-400 bg-slate-500/10 border-slate-500/20'
  }

  // Login screen
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
              <Shield size={26} className="text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
            <p className="text-slate-500 text-sm mt-1">DipperAI Owner Access</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Admin Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600 text-sm"
                autoFocus
              />
            </div>
            {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading || !password}
              className="w-full py-3 rounded-xl font-semibold text-sm gradient-btn disabled:opacity-50"
            >
              {loginLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-[#1e1e2e] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Shield size={16} className="text-violet-400" />
          </div>
          <span className="font-bold text-white">DipperAI Admin</span>
        </div>
        <button onClick={logout} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
          <LogOut size={14} />
          Logout
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading && !stats ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
                { label: 'Total Agents', value: stats?.totalAgents ?? 0, icon: Bot, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                { label: 'Messages Today', value: stats?.messagesToday ?? 0, icon: MessageSquare, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
                { label: 'This Month', value: (stats?.messagesThisMonth ?? 0).toLocaleString(), icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
              ].map(s => (
                <div key={s.label} className={`bg-[#111118] rounded-xl p-5 border ${s.border}`}>
                  <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                    <s.icon size={16} className={s.color} />
                  </div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Plan Breakdown */}
              <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
                <h2 className="font-semibold text-white text-sm mb-4">Plan Breakdown</h2>
                <div className="space-y-3">
                  {stats && Object.entries(stats.planBreakdown).map(([plan, count]) => (
                    <div key={plan} className="flex items-center justify-between">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full border capitalize ${planColor(plan)}`}>{plan}</span>
                      <span className="font-bold text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* API Key Status */}
              <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
                <h2 className="font-semibold text-white text-sm mb-4">API Key Health</h2>
                <div className="space-y-3">
                  {stats && Object.entries(stats.apiKeyStatus).map(([provider, ok]) => (
                    <div key={provider} className="flex items-center justify-between">
                      <span className="text-sm text-slate-300 capitalize">{provider}</span>
                      <div className="flex items-center gap-2">
                        <Circle size={8} className={ok ? 'fill-green-400 text-green-400' : 'fill-red-400 text-red-400'} />
                        <span className={`text-xs font-semibold ${ok ? 'text-green-400' : 'text-red-400'}`}>{ok ? 'Connected' : 'Not set'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Users */}
              <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
                <h2 className="font-semibold text-white text-sm mb-4">Recent Users</h2>
                <div className="space-y-2">
                  {stats?.recentUsers.slice(0, 5).map(u => (
                    <div key={u.id} className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-300 truncate">{u.email}</p>
                        <p className="text-xs text-slate-600">{u.agentCount} agents</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize flex-shrink-0 ml-2 ${planColor(u.plan)}`}>{u.plan}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden">
              <div className="p-5 border-b border-[#1e1e2e] flex items-center justify-between">
                <h2 className="font-semibold text-white text-sm">All Users ({users.length})</h2>
                <button onClick={loadData} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">Refresh</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1e1e2e]">
                      {['Email', 'Plan', 'Agents', 'Msgs Today', 'Joined', 'Actions'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-slate-500 px-5 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className="border-b border-[#1e1e2e] hover:bg-white/2 transition-colors">
                        <td className="px-5 py-3 text-sm text-slate-300 max-w-[200px] truncate">{user.email}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${planColor(user.plan)}`}>{user.plan}</span>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-400">{user.agentCount}</td>
                        <td className="px-5 py-3 text-sm text-slate-400">{user.messages_today}</td>
                        <td className="px-5 py-3 text-sm text-slate-500">{new Date(user.created_at).toLocaleDateString()}</td>
                        <td className="px-5 py-3">
                          <div className="relative inline-block">
                            <select
                              value={user.plan}
                              disabled={changingPlan === user.id}
                              onChange={e => changePlan(user.id, e.target.value)}
                              className="text-xs bg-white/5 border border-[#1e1e2e] text-slate-300 rounded-lg px-2 py-1 pr-6 focus:outline-none focus:ring-1 focus:ring-violet-500/50 appearance-none cursor-pointer disabled:opacity-50"
                            >
                              <option value="free">Free</option>
                              <option value="pro">Pro</option>
                              <option value="business">Business</option>
                            </select>
                            <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-slate-500 text-sm">No users yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
