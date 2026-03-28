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

  const tryApiSignup = async (emailVal: string, nameVal: string, passVal: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal, username: nameVal.toLowerCase().replace(/\s+/g, '_') || 'user', password: passVal }),
      })
      const data = await res.json()
      if (res.ok && data.token) {
        localStorage.setItem('dipperai_user', JSON.stringify({ ...data.user, name: nameVal, token: data.token }))
        navigate('/dashboard')
        return true
      } else if (data.error) {
        setError(data.error)
        return true // handled
      }
    } catch {}
    return false
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const ok = await tryApiSignup(email, name, password)
    if (!ok) {
      // Fallback mock
      localStorage.setItem('dipperai_user', JSON.stringify({ email, name: name || email.split('@')[0] }))
      navigate('/dashboard')
    }
    setLoading(false)
  }

  const handleGoogle = () => {
    setLoading(true)
    setTimeout(() => {
      localStorage.setItem('dipperai_user', JSON.stringify({ email: 'zach@example.com', name: 'Zach' }))
      navigate('/dashboard')
    }, 500)
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

        {/* Perks */}
        <div className="flex flex-wrap justify-center gap-3 mb-5">
          {perks.map(p => (
            <div key={p} className="flex items-center gap-1.5 text-xs text-slate-500">
              <CheckCircle size={12} className="text-green-400" />
              {p}
            </div>
          ))}
        </div>

        <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-7">
          <button onClick={handleGoogle} disabled={loading}
            className="w-full flex items-center justify-center gap-3 border border-[#1e1e2e] rounded-xl py-2.5 px-4 text-slate-300 font-medium hover:bg-white/5 transition-colors mb-5 disabled:opacity-60 text-sm">
            {loading ? <Loader2 size={16} className="animate-spin" /> : (
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
                <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
                <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
                <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
              </svg>
            )}
            Sign up with Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[#1e1e2e]" />
            <span className="text-slate-600 text-xs">or</span>
            <div className="flex-1 h-px bg-[#1e1e2e]" />
          </div>

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
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Min. 8 characters"
                  className={`${inputClass} pr-12`} />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="gradient-btn w-full py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={15} className="animate-spin" /> Creating account...</> : 'Create Free Account'}
            </button>
          </form>

          <p className="text-center text-slate-600 text-xs mt-4">
            By signing up, you agree to our <a href="#" className="underline hover:text-slate-400">Terms</a> and <a href="#" className="underline hover:text-slate-400">Privacy Policy</a>
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
