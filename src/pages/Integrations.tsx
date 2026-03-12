import { useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { X, Check, Loader2 } from 'lucide-react'

interface Integration {
  id: string
  name: string
  description: string
  icon: string
  iconBg: string
  connected: boolean
  comingSoon?: boolean
}

const INTEGRATIONS: Integration[] = [
  { id: 'sms', name: 'SMS / Twilio', description: 'Send and receive SMS messages via Twilio. Connect your agents to any phone number.', icon: '📱', iconBg: 'bg-red-50', connected: false },
  { id: 'telegram', name: 'Telegram', description: 'Deploy your agents as Telegram bots. Reach your audience where they already are.', icon: '✈️', iconBg: 'bg-blue-50', connected: true },
  { id: 'twitter', name: 'X / Twitter', description: 'Auto-respond to mentions, DMs, and threads. Keep your X presence always active.', icon: '𝕏', iconBg: 'bg-gray-100', connected: false },
  { id: 'discord', name: 'Discord', description: 'Add your agent to any Discord server. Moderate, answer, and engage your community.', icon: '🎮', iconBg: 'bg-indigo-50', connected: false },
  { id: 'whatsapp', name: 'WhatsApp', description: 'Connect to WhatsApp Business API and scale your messaging.', icon: '💬', iconBg: 'bg-green-50', connected: false, comingSoon: true },
  { id: 'slack', name: 'Slack', description: 'Bring AI agents into your team workspace. Automate internal workflows.', icon: '#', iconBg: 'bg-yellow-50', connected: false, comingSoon: true },
]

interface ModalConfig {
  integrationId: string
  fields: { key: string; label: string; placeholder: string; type?: string }[]
}

const MODALS: Record<string, ModalConfig> = {
  sms: {
    integrationId: 'sms',
    fields: [
      { key: 'accountSid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'authToken', label: 'Auth Token', placeholder: 'Your Twilio Auth Token', type: 'password' },
      { key: 'phoneNumber', label: 'Phone Number', placeholder: '+1 (555) 000-0000' },
    ],
  },
  telegram: {
    integrationId: 'telegram',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: '123456789:ABCDefgh...', type: 'password' },
    ],
  },
  twitter: {
    integrationId: 'twitter',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'Your X API Key' },
      { key: 'apiSecret', label: 'API Secret', placeholder: 'Your X API Secret', type: 'password' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'Access Token' },
    ],
  },
  discord: {
    integrationId: 'discord',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: 'Your Discord Bot Token', type: 'password' },
      { key: 'guildId', label: 'Server ID', placeholder: 'Discord Server (Guild) ID' },
    ],
  },
}

export default function Integrations() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS)
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const handleConnect = (id: string) => {
    if (MODALS[id]) {
      setActiveModal(id)
      setFormValues({})
      setSavedMsg('')
    }
  }

  const handleDisconnect = (id: string) => {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, connected: false } : i))
  }

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setSavedMsg('Connected successfully!')
      setIntegrations(prev => prev.map(i => i.id === activeModal ? { ...i, connected: true } : i))
      setTimeout(() => {
        setActiveModal(null)
        setSavedMsg('')
      }, 1000)
    }, 800)
  }

  const modal = activeModal ? MODALS[activeModal] : null

  return (
    <DashboardLayout title="Integrations">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Integrations</h1>
        <p className="text-gray-500 mt-1">Connect your agents to the platforms your audience uses.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {integrations.map(integration => (
          <div key={integration.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl ${integration.iconBg} flex items-center justify-center text-2xl`}>
                  {integration.icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{integration.name}</h3>
                  {integration.comingSoon ? (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Coming Soon</span>
                  ) : integration.connected ? (
                    <span className="flex items-center gap-1 text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">
                      <Check size={11} /> Connected
                    </span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Not Connected</span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-500 leading-relaxed flex-1">{integration.description}</p>

            <div>
              {integration.comingSoon ? (
                <button disabled className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed">
                  Coming Soon
                </button>
              ) : integration.connected ? (
                <button
                  onClick={() => handleDisconnect(integration.id)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => handleConnect(integration.id)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold gradient-btn transition-all"
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">
                Connect {integrations.find(i => i.id === activeModal)?.name}
              </h2>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {modal.fields.map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{field.label}</label>
                  <input
                    type={field.type || 'text'}
                    placeholder={field.placeholder}
                    value={formValues[field.key] || ''}
                    onChange={e => setFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm transition-all"
                  />
                </div>
              ))}
            </div>

            {savedMsg && (
              <div className="mt-4 flex items-center gap-2 text-green-600 text-sm font-medium">
                <Check size={16} /> {savedMsg}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setActiveModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl gradient-btn text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : 'Save & Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
