import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Zap, CheckCircle } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setSent(true)
    } catch (e: any) {
      setError(e.message)
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
          <h1 className="text-2xl font-bold text-white">Forgot password?</h1>
          <p className="text-slate-500 mt-1.5 text-sm">Enter your email and we'll send a reset link</p>
        </div>

        <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-7">
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle size={40} className="text-green-400 mx-auto mb-4" />
              <div className="font-bold text-white mb-2">Check your inbox</div>
              <div className="text-slate-500 text-sm">If that email exists, a reset link is on its way. Check spam if you don't see it.</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-xl border border-red-500/20">{error}</div>}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" className={inputClass} />
              </div>
              <button type="submit" disabled={loading} className="w-full gradient-btn py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center mt-6 text-sm text-slate-500">
          Remember it? <Link to="/login" className="text-violet-400 hover:text-violet-300">Back to login</Link>
        </p>
      </div>
    </div>
  )
}