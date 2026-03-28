import { useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { X, Check, Loader2, Plug } from 'lucide-react'

interface Integration {
  id: string
  name: string
  description: string
  connected: boolean
  comingSoon?: boolean
}

const INTEGRATIONS: Integration[] = [
  { id: 'sms', name: 'SMS / Twilio', description: 'Send and receive SMS messages via Twilio. Connect your agents to any phone number.', connected: false },
  { id: 'telegram', name: 'Telegram', description: 'Deploy your agents as Telegram bots. Reach your audience where they already are.', connected: true },
  { id: 'twitter', name: 'X / Twitter', description: 'Auto-respond to mentions, DMs, and threads. Keep your X presence always active.', connected: false },
  { id: 'discord', name: 'Discord', description: 'Add your agent to any Discord server. Moderate, answer, and engage your community.', connected: false },
  { id: 'whatsapp', name: 'WhatsApp', description: 'Connect to WhatsApp Business API and scale your messaging.', connected: false, comingSoon: true },
  { id: 'slack', name: 'Slack', description: 'Bring AI agents into your team workspace. Automate internal workflows.', connected: false, comingSoon: true },
]

const MODALS: Record<string, { fields: { key: string; label: string; placeholder: string; type?: string }[] }> = {
  sms: { fields: [
    { key: 'accountSid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
    { key: 'authToken', label: 'Auth Token', placeholder: 'Your Twilio Auth Token', type: 'password' },
    { key: 'phoneNumber', label: 'Phone Number', placeholder: '+1 (555) 000-0000' },
  ]},
  telegram: { fields: [{ key: 'botToken', label: 'Bot Token', placeholder: '123456789:ABCDefgh...', type: 'password' }]},
  twitter: { fields: [
    { key: 'apiKey', label: 'API Key', placeholder: 'Your X API Key' },
    { key: 'apiSecret', label: 'API Secret', placeholder: 'Your X API Secret', type: 'password' },
    { key: 'accessToken', label: 'Access Token', placeholder: 'Access Token' },
  ]},
  discord: { fields: [
    { key: 'botToken', label: 'Bot Token', placeholder: 'Your Discord Bot Token', type: 'password' },
    { key: 'guildId', label: 'Server ID', placeholder: 'Discord Server (Guild) ID' },
  ]},
}

export default function Integrations() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS)
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const handleConnect = (id: string) => {
    if (MODALS[id]) { setActiveModal(id); setFormValues({}); setSavedMsg('') }
  }

  const handleDisconnect = (id: string) => {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, connected: false } : i))
  }

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false); setSavedMsg('Connected successfully!')
      setIntegrations(prev => prev.map(i => i.id === activeModal ? { ...i, connected: true } : i))
      setTimeout(() => { setActiveModal(null); setSavedMsg('') }, 1000)
    }, 800)
  }

  const modal = activeModal ? MODALS[activeModal] : null

  return (
    <DashboardLayout title="Integrations">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Integrations</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Connect your agents to the platforms your audience uses.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {integrations.map(integration => (
          <div key={integration.id} className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 flex flex-col gap-4 hover:border-violet-500/20 transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Plug size={16} className={integration.connected ? 'text-violet-400' : 'text-slate-600'} />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">{integration.name}</h3>
                {integration.comingSoon ? (
                  <span className="text-xs bg-white/5 text-slate-500 border border-[#1e1e2e] px-2 py-0.5 rounded-full">Coming Soon</span>
                ) : integration.connected ? (
                  <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full w-fit">
                    <Check size={10} /> Connected
                  </span>
                ) : (
                  <span className="text-xs text-slate-600">Not Connected</span>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed flex-1">{integration.description}</p>
            <div>
              {integration.comingSoon ? (
                <button disabled className="w-full py-2 rounded-xl text-xs font-semibold bg-white/5 text-slate-600 border border-[#1e1e2e] cursor-not-allowed">Coming Soon</button>
              ) : integration.connected ? (
                <button onClick={() => handleDisconnect(integration.id)}
                  className="w-full py-2 rounded-xl text-xs font-semibold border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">
                  Disconnect
                </button>
              ) : (
                <button onClick={() => handleConnect(integration.id)} className="w-full py-2 rounded-xl text-xs font-semibold gradient-btn">Connect</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white">Connect {integrations.find(i => i.id === activeModal)?.name}</h2>
              <button onClick={() => setActiveModal(null)} className="text-slate-500 hover:text-slate-300 p-1"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              {modal.fields.map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">{field.label}</label>
                  <input type={field.type || 'text'} placeholder={field.placeholder} value={formValues[field.key] || ''}
                    onChange={e => setFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white text-sm" />
                </div>
              ))}
            </div>
            {savedMsg && (
              <div className="mt-3 flex items-center gap-2 text-green-400 text-sm font-medium"><Check size={14} /> {savedMsg}</div>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setActiveModal(null)} className="flex-1 py-2.5 rounded-xl border border-[#1e1e2e] text-slate-400 text-sm font-semibold hover:bg-white/5">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl gradient-btn text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save & Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
