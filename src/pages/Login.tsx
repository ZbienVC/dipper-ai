import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Zap } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (res.ok && data.token) {
        localStorage.setItem('dipperai_user', JSON.stringify({ ...data.user, token: data.token }))
        navigate('/dashboard')
      } else {
        setError(data.error || 'Invalid email or password')
      }
    } catch {
      setError('Unable to reach server. Please try again.')
    }

    setLoading(false)
  }

  const inputClass = "w-full px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600 text-sm transition-all"

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
              <Zap size={18} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">DipperAI</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-slate-500 mt-1.5 text-sm">Sign in to your account</p>
        </div>

        <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-xl border border-red-500/20">{error}</div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="Your password"
                  className={`${inputClass} pr-12`} />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading || !email || !password}
              className="gradient-btn w-full py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={15} className="animate-spin" /> Signing in...</> : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 mt-5 text-sm">
          Don't have an account?{' '}
          <Link to="/signup" className="text-violet-400 font-semibold hover:text-violet-300">Sign up free</Link>
        </p>
      </div>
    </div>
  )
}
