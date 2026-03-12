import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { Save, Plus, Eye, EyeOff, Trash2, AlertTriangle, Copy, Check } from 'lucide-react'

type Tab = 'profile' | 'workspace' | 'notifications' | 'apikeys' | 'danger'
const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'apikeys', label: 'API Keys' },
  { id: 'danger', label: 'Danger Zone' },
]

function getUser() {
  try {
    const raw = localStorage.getItem('dipperai_user')
    if (raw) return JSON.parse(raw) as { email: string; name: string }
  } catch {}
  return { email: 'zach@example.com', name: 'Zach' }
}

interface ApiKey {
  id: string
  name: string
  key: string
  created: string
  revealed?: boolean
}

export default function Settings() {
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) || 'profile'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  const user = getUser()
  const [profileName, setProfileName] = useState(user.name)
  const [profileEmail, setProfileEmail] = useState(user.email)
  const [profileSaved, setProfileSaved] = useState(false)

  const [workspaceName, setWorkspaceName] = useState('Zach\'s Workspace')
  const [workspaceSaved, setWorkspaceSaved] = useState(false)

  const [notifications, setNotifications] = useState({
    newMessage: true,
    approvalNeeded: true,
    weeklyReport: false,
  })

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [showNewKeyForm, setShowNewKeyForm] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState('')

  useEffect(() => {
    const tab = searchParams.get('tab') as Tab
    if (tab && TABS.find(t => t.id === tab)) setActiveTab(tab)
  }, [searchParams])

  const saveProfile = () => {
    setProfileSaved(true)
    localStorage.setItem('dipperai_user', JSON.stringify({ email: profileEmail, name: profileName }))
    setTimeout(() => setProfileSaved(false), 2000)
  }

  const saveWorkspace = () => {
    setWorkspaceSaved(true)
    setTimeout(() => setWorkspaceSaved(false), 2000)
  }

  const generateKey = () => {
    if (!newKeyName.trim()) return
    const key = 'dip_sk_' + Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('')
    setApiKeys(prev => [...prev, {
      id: Date.now().toString(),
      name: newKeyName,
      key,
      created: new Date().toLocaleDateString(),
      revealed: true,
    }])
    setNewKeyName('')
    setShowNewKeyForm(false)
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <DashboardLayout title="Settings">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account, workspace, and preferences.</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto flex-nowrap w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            } ${tab.id === 'danger' ? 'text-red-500 hover:text-red-600' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-lg space-y-5">
          <h2 className="font-bold text-gray-900 text-lg">Profile</h2>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
            <input
              type="text"
              value={profileName}
              onChange={e => setProfileName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={profileEmail}
              onChange={e => setProfileEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Avatar</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold" style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
                {profileName.charAt(0).toUpperCase()}
              </div>
              <button className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Upload Photo
              </button>
            </div>
          </div>
          <button
            onClick={saveProfile}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${profileSaved ? 'bg-green-500 text-white' : 'gradient-btn'}`}
          >
            {profileSaved ? <><Check size={15} /> Saved!</> : <><Save size={15} /> Save Changes</>}
          </button>
        </div>
      )}

      {/* Workspace */}
      {activeTab === 'workspace' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-lg space-y-5">
          <h2 className="font-bold text-gray-900 text-lg">Workspace</h2>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Workspace Name</label>
            <input
              type="text"
              value={workspaceName}
              onChange={e => setWorkspaceName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Slug <span className="text-gray-400 font-normal">(read-only)</span></label>
            <input
              type="text"
              value="zachs-workspace"
              readOnly
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl">
                🏢
              </div>
              <button className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Upload Logo
              </button>
            </div>
          </div>
          <button
            onClick={saveWorkspace}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${workspaceSaved ? 'bg-green-500 text-white' : 'gradient-btn'}`}
          >
            {workspaceSaved ? <><Check size={15} /> Saved!</> : <><Save size={15} /> Save Changes</>}
          </button>
        </div>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-lg space-y-5">
          <h2 className="font-bold text-gray-900 text-lg">Email Notifications</h2>
          {[
            { key: 'newMessage' as const, label: 'New message received', desc: 'Get notified when your agents receive a new message' },
            { key: 'approvalNeeded' as const, label: 'Approval needed', desc: 'Get notified when a message requires your approval' },
            { key: 'weeklyReport' as const, label: 'Weekly report', desc: 'Receive a weekly summary of your agents\' performance' },
          ].map(item => (
            <div key={item.key} className="flex items-start justify-between gap-4 py-4 border-b border-gray-50 last:border-0">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </div>
              <button
                onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${notifications[item.key] ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${notifications[item.key] ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* API Keys */}
      {activeTab === 'apikeys' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 text-lg">API Keys</h2>
              <button
                onClick={() => setShowNewKeyForm(true)}
                className="gradient-btn flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
              >
                <Plus size={15} /> Create API Key
              </button>
            </div>

            {showNewKeyForm && (
              <div className="bg-blue-50 rounded-xl p-4 mb-4 flex items-center gap-3">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="Key name (e.g. Production)"
                  className="flex-1 px-3 py-2 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                />
                <button onClick={generateKey} className="gradient-btn px-4 py-2 rounded-lg text-sm font-semibold">
                  Generate
                </button>
                <button onClick={() => setShowNewKeyForm(false)} className="text-gray-400 hover:text-gray-600">
                  <EyeOff size={16} />
                </button>
              </div>
            )}

            {apiKeys.length === 0 && !showNewKeyForm ? (
              <p className="text-gray-400 text-sm text-center py-8">No API keys yet. Create one to get started.</p>
            ) : (
              <div className="space-y-3">
                {apiKeys.map(k => (
                  <div key={k.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{k.name}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">
                        {k.revealed ? k.key : k.key.slice(0, 12) + '••••••••••••••••••••'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">Created {k.created}</p>
                    </div>
                    <button onClick={() => copyKey(k.key)} className="text-gray-400 hover:text-blue-600 transition-colors p-1.5">
                      {copied === k.key ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                    </button>
                    <button
                      onClick={() => setApiKeys(prev => prev.filter(ak => ak.id !== k.id))}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1.5"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Danger Zone */}
      {activeTab === 'danger' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 max-w-lg">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={20} className="text-red-600" />
            <h2 className="font-bold text-red-900 text-lg">Danger Zone</h2>
          </div>
          <p className="text-sm text-red-700 mb-6">
            Deleting your workspace is permanent and cannot be undone. All agents, integrations, and data will be lost.
          </p>
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-red-800">
              Type <span className="font-mono bg-red-100 px-1.5 py-0.5 rounded">delete my workspace</span> to confirm:
            </label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="delete my workspace"
              className="w-full px-4 py-3 rounded-xl border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-gray-900 text-sm bg-white"
            />
            <button
              disabled={deleteConfirm !== 'delete my workspace'}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={15} /> Delete Workspace
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
