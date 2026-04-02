import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { X, Check, Loader2, Plug, AlertCircle, ExternalLink, Copy, Zap, Clock } from 'lucide-react'

interface IntegrationRecord {
  id: string
  type: string
  connected: boolean
  bot_info?: string
  agent_id?: string
  created_at: string
  last_activity?: string
  error?: string
}

const INTEGRATION_META: Record<string, {
  name: string
  description: string
  icon: string
  instructions: string
  webhookPath: string
  fields: { key: string; label: string; placeholder: string; type?: string }[]
}> = {
  telegram: {
    name: 'Telegram',
    description: 'Deploy your agents as Telegram bots. Reach your audience where they already are.',
    icon: '✈️',
    instructions: '1. Open Telegram and search for @BotFather\n2. Send /newbot and follow the prompts to create your bot\n3. BotFather will give you a Bot Token — copy it\n4. Paste the token below and click Connect\n5. DipperAI will automatically set up the webhook for you',
    webhookPath: '/webhooks/telegram',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: '123456789:ABCDefgh...', type: 'password' },
    ],
  },
  discord: {
    name: 'Discord',
    description: 'Add your agent to any Discord server. Moderate, answer, and engage your community.',
    icon: '🎮',
    instructions: '1. Go to discord.com/developers/applications\n2. Create New Application, then go to the Bot section\n3. Click "Reset Token" and copy your Bot Token\n4. Under Privileged Gateway Intents, enable "Message Content Intent"\n5. Right-click your server (enable Developer Mode first) to copy your Server ID\n6. Paste credentials below and click Connect',
    webhookPath: '/webhooks/discord',
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
    instructions: '1. Sign up at twilio.com and verify your account\n2. Purchase a phone number from the Twilio console\n3. Copy your Account SID and Auth Token from the dashboard\n4. Enter your Twilio phone number below\n5. After connecting, copy the Webhook URL and paste it in Twilio → Phone Numbers → Messaging',
    webhookPath: '/webhooks/sms',
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
    instructions: '1. Go to developer.twitter.com and sign in\n2. Create a new Project and App\n3. Under "Keys and Tokens", generate API Key + Secret and Access Token + Secret\n4. Set Read+Write permissions on your app\n5. Paste all four credentials below',
    webhookPath: '/webhooks/twitter',
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

function getBaseUrl() {
  return window.location.origin
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
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null)
  const [testingType, setTestingType] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, 'ok' | 'fail' | null>>({})

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

  useEffect(() => { fetchIntegrations(); fetchAgents() }, [])

  useEffect(() => {
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

  const handleTestConnection = async (type: string) => {
    setTestingType(type)
    const token = getToken()
    try {
      const r = await fetch(`/api/integrations/${type}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      setTestResult(prev => ({ ...prev, [type]: r.ok ? 'ok' : 'fail' }))
    } catch {
      setTestResult(prev => ({ ...prev, [type]: 'fail' }))
    } finally {
      setTestingType(null)
      setTimeout(() => setTestResult(prev => ({ ...prev, [type]: null })), 3000)
    }
  }

  const copyWebhookUrl = (type: string) => {
    const meta = INTEGRATION_META[type]
    const url = `${getBaseUrl()}${meta.webhookPath}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedWebhook(type)
      setTimeout(() => setCopiedWebhook(null), 2000)
    })
  }

  const openModal = (type: string) => {
    if (!getToken()) { alert('Please log in first'); return }
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
            const webhookUrl = `${getBaseUrl()}${m.webhookPath}`
            const tr = testResult[type]

            return (
              <div key={type} className={`bg-[#111118] border rounded-xl p-5 flex flex-col gap-4 transition-colors ${
                rec?.error ? 'border-red-500/30' : rec?.connected ? 'border-green-500/20 hover:border-green-500/30' : 'border-[#1e1e2e] hover:border-violet-500/20'
              }`}>
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 text-lg ${
                    rec?.error ? 'bg-red-500/10 border-red-500/20' : rec?.connected ? 'bg-green-500/10 border-green-500/20' : 'bg-violet-500/10 border-violet-500/20'
                  }`}>
                    {m.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-sm">{m.name}</h3>
                    {rec?.error ? (
                      <span className="flex items-center gap-1 text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full w-fit mt-0.5">
                        <AlertCircle size={10} /> Error — reconnect needed
                      </span>
                    ) : rec?.connected ? (
                      <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full w-fit mt-0.5">
                        <Check size={10} /> Connected{rec.bot_info ? ` · @${rec.bot_info}` : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600 mt-0.5 block">Not Connected</span>
                    )}
                    {rec?.last_activity && (
                      <span className="flex items-center gap-1 text-xs text-slate-600 mt-1">
                        <Clock size={9} /> Last active {timeAgo(rec.last_activity)}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed flex-1">{m.description}</p>

                {/* Webhook URL */}
                {rec?.connected && (
                  <div className="bg-white/3 border border-[#1e1e2e] rounded-xl p-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500 mb-0.5 font-semibold">Webhook URL</p>
                      <p className="text-xs text-slate-400 font-mono truncate">{webhookUrl}</p>
                    </div>
                    <button onClick={() => copyWebhookUrl(type)}
                      className={`flex-shrink-0 p-1.5 rounded-lg border transition-colors ${copiedWebhook === type ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/5 border-[#1e1e2e] text-slate-500 hover:text-slate-300'}`}
                      title="Copy webhook URL">
                      {copiedWebhook === type ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                )}

                {/* Assign to Agent */}
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

                {/* Actions */}
                <div className="flex gap-2">
                  {rec?.connected ? (
                    <>
                      <button
                        onClick={() => handleTestConnection(type)}
                        disabled={testingType === type}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 ${
                          tr === 'ok' ? 'border-green-500/30 text-green-400 bg-green-500/10' :
                          tr === 'fail' ? 'border-red-500/30 text-red-400 bg-red-500/10' :
                          'border-violet-500/20 text-violet-400 hover:bg-violet-500/10'
                        }`}
                      >
                        {testingType === type ? (
                          <><Loader2 size={11} className="animate-spin" /> Testing...</>
                        ) : tr === 'ok' ? (
                          <><Check size={11} /> Test OK</>
                        ) : tr === 'fail' ? (
                          <><AlertCircle size={11} /> Test Failed</>
                        ) : (
                          <><Zap size={11} /> Test</>
                        )}
                      </button>
                      <button onClick={() => handleDisconnect(type)}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">
                        Disconnect
                      </button>
                    </>
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
                <div className="bg-white/5 border border-[#1e1e2e] rounded-xl p-4 mb-4">
                  <p className="text-xs text-slate-300 font-semibold mb-2 flex items-center gap-1.5"><ExternalLink size={12} /> Setup Instructions</p>
                  <pre className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed font-sans">{meta.instructions}</pre>
                </div>
                {/* Webhook URL preview in modal */}
                <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-3 mb-4 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-violet-400 font-semibold mb-0.5">Your Webhook URL</p>
                    <p className="text-xs text-slate-400 font-mono truncate">{getBaseUrl()}{meta.webhookPath}</p>
                  </div>
                  <button onClick={() => copyWebhookUrl(activeType!)} className="flex-shrink-0 p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-colors">
                    {copiedWebhook === activeType ? <Check size={12} /> : <Copy size={12} />}
                  </button>
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