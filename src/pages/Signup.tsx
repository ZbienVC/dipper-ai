import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle, Loader2, Zap } from 'lucide-react'

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password) return
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')

    try {
      const username = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'user'
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      })
      const data = await res.json()
      if (res.ok && data.token) {
        localStorage.setItem('dipperai_user', JSON.stringify({ ...data.user, name, token: data.token }))
        navigate('/onboarding')
      } else {
        setError(data.error || 'Could not create account. Please try again.')
      }
    } catch {
      setError('Unable to reach server. Please try again.')
    }

    setLoading(false)
  }

  const perks = ['1 free agent to start', 'No credit card required', 'Launch in under 5 minutes']
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
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-slate-500 mt-1.5 text-sm">Start building AI agents for free</p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-5">
          {perks.map(p => (
            <div key={p} className="flex items-center gap-1.5 text-xs text-slate-500">
              <CheckCircle size={12} className="text-green-400" />
              {p}
            </div>
          ))}
        </div>

        <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-xl border border-red-500/20">{error}</div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Full Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Jane Smith" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters"
                  className={`${inputClass} pr-12`} />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading || !name || !email || !password}
              className="gradient-btn w-full py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={15} className="animate-spin" /> Creating account...</> : 'Create Free Account'}
            </button>
          </form>

          <p className="text-center text-slate-600 text-xs mt-4">
            By signing up, you agree to our{' '}
            <a href="#" className="underline hover:text-slate-400">Terms</a> and{' '}
            <a href="#" className="underline hover:text-slate-400">Privacy Policy</a>
          </p>
        </div>

        <p className="text-center text-slate-500 mt-5 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-violet-400 font-semibold hover:text-violet-300">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
