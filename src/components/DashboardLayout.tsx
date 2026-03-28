import { ReactNode, useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Bot, LayoutTemplate, Plug, CheckSquare,
  BarChart2, CreditCard, Settings, Bell, Search,
  LogOut, ChevronDown, Menu, X, User, Zap, Activity
} from 'lucide-react'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Bot, label: 'My Agents', path: '/dashboard/agents' },
  { icon: LayoutTemplate, label: 'Templates', path: '/dashboard/templates' },
  { icon: Plug, label: 'Integrations', path: '/dashboard/integrations' },
  { icon: CheckSquare, label: 'Approvals', path: '/dashboard/approvals' },
  { icon: Activity, label: 'Activity', path: '/dashboard/activity' },
  { icon: BarChart2, label: 'Analytics', path: '/dashboard/analytics' },
  { icon: CreditCard, label: 'Billing', path: '/dashboard/billing' },
  { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
]

interface Props {
  children: ReactNode
  title?: string
}

interface AppUser { email: string; name: string; role?: string; plan?: string }

function getUser(): AppUser {
  try {
    const raw = localStorage.getItem('dipperai_user')
    if (raw) return JSON.parse(raw) as AppUser
  } catch {}
  return { email: '', name: '' }
}

export default function DashboardLayout({ children, title }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const user = getUser()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('dipperai_user')
    navigate('/login')
  }

  const initials = user.name ? user.name.charAt(0).toUpperCase() : 'U'

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#1e1e2e]">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">DipperAI</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ icon: Icon, label, path, badge }) => {
          const active = location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path))
          return (
            <Link
              key={`${path}-${label}`}
              to={path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <Icon size={16} className={active ? 'text-violet-400' : ''} />
              <span>{label}</span>
              {badge && (
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${active ? 'bg-violet-500/30 text-violet-300' : 'bg-red-500/20 text-red-400'}`}>
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-[#1e1e2e]" ref={dropdownRef}>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                {user.role === 'admin' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 bg-amber-500/20 text-amber-400 border border-amber-500/20">ADMIN</span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate">
                {user.role === 'admin' ? 'All Features Unlocked' : (user.plan ? `${user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} Plan` : 'Free Plan')}
              </p>
            </div>
            <ChevronDown size={13} className={`text-slate-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#16161f] rounded-xl border border-[#1e1e2e] shadow-xl overflow-hidden z-50">
              <Link
                to="/dashboard/settings"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 transition-colors"
              >
                <User size={14} />
                Profile Settings
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#0a0a0f] overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-[#0d0d15] border-r border-[#1e1e2e] flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-60 bg-[#0d0d15] h-full shadow-xl z-10 border-r border-[#1e1e2e]">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300">
              <X size={20} />
            </button>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-[#0d0d15] border-b border-[#1e1e2e] px-6 h-14 flex items-center gap-4 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-slate-500 hover:text-slate-300">
            <Menu size={20} />
          </button>
          {title && <h1 className="text-base font-semibold text-white hidden md:block">{title}</h1>}
          <div className="flex-1 max-w-xs">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-8 pr-4 py-1.5 text-sm bg-white/5 border border-[#1e1e2e] rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-slate-300 placeholder-slate-600 transition-all"
              />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="relative p-2 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors">
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-violet-500" />
            </button>
            <button className="flex items-center gap-2 hover:bg-white/5 rounded-lg px-2 py-1.5 transition-colors">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                {initials}
              </div>
              <ChevronDown size={12} className="text-slate-500" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

