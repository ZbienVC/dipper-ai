import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { Save, Plus, EyeOff, Trash2, AlertTriangle, Copy, Check } from 'lucide-react'

type Tab = 'profile' | 'workspace' | 'notifications' | 'apikeys' | 'danger'
const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'apikeys', label: 'API Keys' },
  { id: 'danger', label: 'Danger Zone' },
]

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

function getUser() {
  try {
    const raw = localStorage.getItem('dipperai_user')
    if (raw) return JSON.parse(raw) as { email: string; name: string }
  } catch {}
  return { email: 'zach@example.com', name: 'Zach' }
}

interface ApiKey { id: string; name: string; key: string; created: string }

const inputClass = "w-full px-4 py-2.5 rounded-xl bg-white/5 border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600 text-sm transition-all"

export default function Settings() {
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) || 'profile'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  const user = getUser()
  const [profileName, setProfileName] = useState(user.name)
  const [profileEmail, setProfileEmail] = useState(user.email)
  const [profileSaved, setProfileSaved] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('My Workspace')
  const [workspaceSaved, setWorkspaceSaved] = useState(false)
  const [notifications, setNotifications] = useState({ newMessage: true, approvalNeeded: true, weeklyReport: false })
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [showNewKeyForm, setShowNewKeyForm] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  useEffect(() => {
    const token = getToken()
    if (!token) return
    fetch('/api/settings/api-keys', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((keys: ApiKey[]) => setApiKeys(keys))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const tab = searchParams.get('tab') as Tab
    if (tab && TABS.find(t => t.id === tab)) setActiveTab(tab)
  }, [searchParams])

  const saveProfile = () => {
    setProfileSaved(true)
    localStorage.setItem('dipperai_user', JSON.stringify({ email: profileEmail, name: profileName }))
    setTimeout(() => setProfileSaved(false), 2000)
  }

  const saveWorkspace = () => { setWorkspaceSaved(true); setTimeout(() => setWorkspaceSaved(false), 2000) }

  const generateKey = async () => {
    if (!newKeyName.trim()) return
    const token = getToken()
    if (!token) return
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })
      if (res.ok) {
        const key = await res.json()
        setApiKeys(prev => [...prev, { id: key.id, name: key.name, key: key.key, created: new Date(key.created_at).toLocaleDateString() }])
        setNewKeyName(''); setShowNewKeyForm(false)
      }
    } catch {}
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key).catch(() => {})
    setCopied(key); setTimeout(() => setCopied(null), 2000)
  }

  return (
    <DashboardLayout title="Settings">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Manage your account, workspace, and preferences.</p>
      </div>

      <div className="flex gap-1 bg-[#111118] border border-[#1e1e2e] rounded-xl p-1 mb-5 overflow-x-auto flex-nowrap w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.id ? 'gradient-btn' : tab.id === 'danger' ? 'text-red-400 hover:text-red-300' : 'text-slate-500 hover:text-slate-200'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile */}
      {activeTab === 'profile' && (
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 max-w-lg space-y-4">
          <h2 className="font-semibold text-white text-sm">Profile</h2>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Full Name</label>
            <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email</label>
            <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Avatar</label>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold bg-violet-600">
                {profileName.charAt(0).toUpperCase()}
              </div>
              <button className="px-3 py-1.5 border border-[#1e1e2e] rounded-xl text-xs font-semibold text-slate-400 hover:bg-white/5 transition-colors">Upload Photo</button>
            </div>
          </div>
          <button onClick={saveProfile}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm transition-all ${profileSaved ? 'bg-green-500 text-white' : 'gradient-btn'}`}>
            {profileSaved ? <><Check size={13} /> Saved!</> : <><Save size={13} /> Save Changes</>}
          </button>
        </div>
      )}

      {/* Workspace */}
      {activeTab === 'workspace' && (
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 max-w-lg space-y-4">
          <h2 className="font-semibold text-white text-sm">Workspace</h2>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Workspace Name</label>
            <input type="text" value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Slug <span className="text-slate-600">(read-only)</span></label>
            <input type="text" value="my-workspace" readOnly className={`${inputClass} opacity-50 cursor-not-allowed`} />
          </div>
          <button onClick={saveWorkspace}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm transition-all ${workspaceSaved ? 'bg-green-500 text-white' : 'gradient-btn'}`}>
            {workspaceSaved ? <><Check size={13} /> Saved!</> : <><Save size={13} /> Save Changes</>}
          </button>
        </div>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5 max-w-lg space-y-1">
          <h2 className="font-semibold text-white text-sm mb-3">Email Notifications</h2>
          {[
            { key: 'newMessage' as const, label: 'New message received', desc: 'Get notified when your agents receive a new message' },
            { key: 'approvalNeeded' as const, label: 'Approval needed', desc: 'Get notified when a message requires your approval' },
            { key: 'weeklyReport' as const, label: 'Weekly report', desc: 'Receive a weekly summary of your agents\' performance' },
          ].map(item => (
            <div key={item.key} className="flex items-start justify-between gap-4 py-4 border-b border-[#1e1e2e] last:border-0">
              <div>
                <p className="font-semibold text-white text-sm">{item.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
              <button onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${notifications[item.key] ? 'bg-violet-600' : 'bg-white/10'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${notifications[item.key] ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* API Keys */}
      {activeTab === 'apikeys' && (
        <div className="space-y-3">
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white text-sm">API Keys</h2>
              <button onClick={() => setShowNewKeyForm(true)} className="gradient-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold">
                <Plus size={12} /> Create Key
              </button>
            </div>
            {showNewKeyForm && (
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 mb-3 flex items-center gap-3">
                <input type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name (e.g. Production)"
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white text-sm" />
                <button onClick={generateKey} className="gradient-btn px-3 py-2 rounded-lg text-xs font-semibold">Generate</button>
                <button onClick={() => setShowNewKeyForm(false)} className="text-slate-600 hover:text-slate-400"><EyeOff size={14} /></button>
              </div>
            )}
            {apiKeys.length === 0 && !showNewKeyForm ? (
              <p className="text-slate-600 text-xs text-center py-8">No API keys yet. Create one to get started.</p>
            ) : (
              <div className="space-y-2">
                {apiKeys.map(k => (
                  <div key={k.id} className="flex items-center gap-3 bg-white/5 border border-[#1e1e2e] rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm">{k.name}</p>
                      <p className="text-xs text-slate-600 font-mono mt-0.5 truncate">{k.key.slice(0, 20)}••••</p>
                      <p className="text-xs text-slate-600 mt-0.5">Created {k.created}</p>
                    </div>
                    <button onClick={() => copyKey(k.key)} className="text-slate-500 hover:text-violet-400 transition-colors p-1.5">
                      {copied === k.key ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    </button>
                    <button onClick={async () => {
                      const token = getToken();
                      if (!token) return;
                      await fetch(`/api/settings/api-keys/${k.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                      setApiKeys(prev => prev.filter(ak => ak.id !== k.id));
                    }} className="text-slate-600 hover:text-red-400 transition-colors p-1.5">
                      <Trash2 size={13} />
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
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 max-w-lg">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-red-400" />
            <h2 className="font-bold text-red-400 text-sm">Danger Zone</h2>
          </div>
          <p className="text-sm text-slate-400 mb-5">Deleting your workspace is permanent and cannot be undone. All agents, integrations, and data will be lost.</p>
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-red-400">
              Type <span className="font-mono bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded text-red-300">delete my workspace</span> to confirm:
            </label>
            <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="delete my workspace"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-red-500/20 focus:outline-none focus:ring-1 focus:ring-red-500/50 text-white text-sm" />
            <button disabled={deleteConfirm !== 'delete my workspace'}
              className="flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Trash2 size={14} /> Delete Workspace
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
