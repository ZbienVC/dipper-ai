import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { X, Check, Loader2, Plug, AlertCircle, ExternalLink } from 'lucide-react'

interface IntegrationRecord {
  id: string
  type: string
  connected: boolean
  bot_info?: string
  agent_id?: string
  created_at: string
}

const INTEGRATION_META: Record<string, {
  name: string
  description: string
  icon: string
  instructions: string
  fields: { key: string; label: string; placeholder: string; type?: string }[]
}> = {
  telegram: {
    name: 'Telegram',
    description: 'Deploy your agents as Telegram bots. Reach your audience where they already are.',
    icon: '✈️',
    instructions: '1. Open Telegram and search for @BotFather\n2. Send /newbot and follow the prompts\n3. Copy the bot token provided\n4. Paste it below',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: '123456789:ABCDefgh...', type: 'password' },
    ],
  },
  discord: {
    name: 'Discord',
    description: 'Add your agent to any Discord server. Moderate, answer, and engage your community.',
    icon: '🎮',
    instructions: '1. Go to discord.com/developers/applications\n2. Create New Application, go to Bot section\n3. Copy the Bot Token\n4. Enable Message Content Intent under Privileged Gateway Intents\n5. Get your Server ID by right-clicking your server (enable Developer Mode first)\n6. Paste below',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: 'Your Discord Bot Token', type: 'password' },
      { key: 'guildId', label: 'Server ID', placeholder: 'Discord Server (Guild) ID' },
      { key: 'channelId', label: 'Channel ID', placeholder: 'Default Channel ID (optional)' },
    ],
  },
  sms: {
    name: 'SMS / Twilio',
    description: 'Send and receive SMS messages via Twilio. Connect your agents to any phone number.',
    icon: '📱',
    instructions: '1. Sign up at twilio.com\n2. Get a phone number from the console\n3. Find your Account SID and Auth Token on the dashboard\n4. Paste below',
    fields: [
      { key: 'accountSid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'authToken', label: 'Auth Token', placeholder: 'Your Twilio Auth Token', type: 'password' },
      { key: 'phoneNumber', label: 'Phone Number', placeholder: '+15550001234' },
    ],
  },
  twitter: {
    name: 'X / Twitter',
    description: 'Auto-respond to mentions, DMs, and threads. Keep your X presence always active.',
    icon: '🐦',
    instructions: '1. Go to developer.twitter.com\n2. Create a project and app\n3. Generate API Key and Access Token with Read+Write permissions\n4. Paste below',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'Your X API Key' },
      { key: 'apiSecret', label: 'API Secret', placeholder: 'Your X API Secret', type: 'password' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'Access Token' },
      { key: 'accessTokenSecret', label: 'Access Token Secret', placeholder: 'Access Token Secret', type: 'password' },
    ],
  },
}

type ModalStep = 'instructions' | 'form' | 'connecting' | 'success' | 'error'

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

export default function Integrations() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<IntegrationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState<string | null>(null)
  const [step, setStep] = useState<ModalStep>('instructions')
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [resultInfo, setResultInfo] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([])
  const [assignMap, setAssignMap] = useState<Record<string, string>>({})

  const fetchIntegrations = () => {
    const token = getToken()
    if (!token) { setLoading(false); return }
    fetch('/api/integrations', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setRecords(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  const fetchAgents = () => {
    const token = getToken()
    if (!token) return
    fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(d => setAgents(d.map((a: any) => ({ id: a.id, name: a.name }))))
      .catch(() => {})
  }

  useEffect(() => {
    // Pre-populate assignMap from loaded records
    const map: Record<string, string> = {}
    records.forEach(r => { if (r.agent_id) map[r.type] = r.agent_id })
    setAssignMap(map)
  }, [records])

  const handleAssign = async (type: string, agentId: string) => {
    setAssignMap(prev => ({ ...prev, [type]: agentId }))
    const token = getToken()
    if (!token) return
    await fetch(`/api/integrations/${type}/assign`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agentId || null }),
    }).catch(() => {})
  }

  const openModal = (type: string) => {
    setActiveType(type)
    setStep('instructions')
    setFormValues({})
    setResultInfo('')
    setErrorMsg('')
  }

  const handleConnect = async () => {
    if (!activeType) return
    setStep('connecting')
    const token = getToken()
    const body: Record<string, string> = { ...formValues }
    if (assignMap[activeType]) body.agentId = assignMap[activeType]
    try {
      const r = await fetch(`/api/integrations/${activeType}/connect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok) { setErrorMsg(data.error || 'Connection failed'); setStep('error'); return }
      setResultInfo(data.bot_info || '')
      setStep('success')
      fetchIntegrations()
    } catch (e: any) {
      setErrorMsg(e?.message || 'Connection failed')
      setStep('error')
    }
  }

  const handleDisconnect = async (type: string) => {
    const token = getToken()
    await fetch(`/api/integrations/${type}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    fetchIntegrations()
  }

  const getRecord = (type: string) => records.find(r => r.type === type)

  const types = ['telegram', 'discord', 'sms', 'twitter'] as const
  const meta = activeType ? INTEGRATION_META[activeType] : null

  return (
    <DashboardLayout title="Integrations">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Integrations</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Connect your agents to the platforms your audience uses.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 size={16} className="animate-spin" /> Loading...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4">
          {types.map(type => {
            const m = INTEGRATION_META[type]
            const rec = getRecord(type)
            return (
              <div key={type} className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 flex flex-col gap-4 hover:border-violet-500/20 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 text-lg">
                    {m.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{m.name}</h3>
                    {rec?.connected ? (
                      <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full w-fit">
                        <Check size={10} /> Connected{rec.bot_info ? ` · @${rec.bot_info}` : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600">Not Connected</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed flex-1">{m.description}</p>

                {rec?.connected && agents.length > 0 && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Assign to Agent</label>
                    <select
                      value={assignMap[type] || ''}
                      onChange={e => handleAssign(type, e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-[#1e1e2e] text-white text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    >
                      <option value="">Select an agent...</option>
                      {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}

                <div className="flex gap-2">
                  {rec?.connected ? (
                    <button onClick={() => handleDisconnect(type)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">
                      Disconnect
                    </button>
                  ) : (
                    <button onClick={() => openModal(type)} className="flex-1 py-2 rounded-xl text-xs font-semibold gradient-btn">
                      Connect
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Step Modal */}
      {activeType && meta && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>{meta.icon}</span> Connect {meta.name}
              </h2>
              <button onClick={() => setActiveType(null)} className="text-slate-500 hover:text-slate-300 p-1"><X size={18} /></button>
            </div>

            {step === 'instructions' && (
              <>
                <div className="bg-white/5 border border-[#1e1e2e] rounded-xl p-4 mb-5">
                  <p className="text-xs text-slate-300 font-semibold mb-2 flex items-center gap-1.5"><ExternalLink size={12} /> Setup Instructions</p>
                  <pre className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed font-sans">{meta.instructions}</pre>
                </div>
                <button onClick={() => setStep('form')} className="w-full py-2.5 rounded-xl gradient-btn text-sm font-semibold">
                  Next: Enter Credentials →
                </button>
              </>
            )}

            {step === 'form' && (
              <>
                <div className="space-y-4 mb-5">
                  {meta.fields.map(field => (
                    <div key={field.key}>
                      <label className="block text-sm font-semibold text-slate-300 mb-1.5">{field.label}</label>
                      <input
                        type={field.type || 'text'}
                        placeholder={field.placeholder}
                        value={formValues[field.key] || ''}
                        onChange={e => setFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white text-sm"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep('instructions')} className="flex-1 py-2.5 rounded-xl border border-[#1e1e2e] text-slate-400 text-sm font-semibold hover:bg-white/5">← Back</button>
                  <button onClick={handleConnect} className="flex-1 py-2.5 rounded-xl gradient-btn text-sm font-semibold">Connect</button>
                </div>
              </>
            )}

            {step === 'connecting' && (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 size={32} className="animate-spin text-violet-400" />
                <p className="text-slate-400 text-sm">Connecting to {meta.name}...</p>
              </div>
            )}

            {step === 'success' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <Check size={28} className="text-green-400" />
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-base mb-1">Connected!</p>
                  {resultInfo && <p className="text-slate-400 text-sm">@{resultInfo}</p>}
                </div>
                <button onClick={() => setActiveType(null)} className="mt-2 py-2.5 px-8 rounded-xl gradient-btn text-sm font-semibold">Done</button>
              </div>
            )}

            {step === 'error' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertCircle size={28} className="text-red-400" />
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-base mb-1">Connection Failed</p>
                  <p className="text-slate-400 text-sm">{errorMsg}</p>
                </div>
                <div className="flex gap-3 mt-2">
                  <button onClick={() => setStep('form')} className="py-2.5 px-6 rounded-xl border border-[#1e1e2e] text-slate-400 text-sm font-semibold hover:bg-white/5">Try Again</button>
                  <button onClick={() => setActiveType(null)} className="py-2.5 px-6 rounded-xl gradient-btn text-sm font-semibold">Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
