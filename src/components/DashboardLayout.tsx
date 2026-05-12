import PlatformGuide from './PlatformGuide'
import { ReactNode, useState, useRef, useEffect } from 'react'
import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Bot, LayoutTemplate, Plug, CheckSquare,
  BarChart2, CreditCard, Settings, Bell, Search,
  LogOut, ChevronDown, Menu, X, User, Zap, Activity, Users2, Users, FlaskConical, Radio, FileText,
  Command, Film, ChevronRight, Sparkles, ArrowRight, CheckCircle2, Circle
} from 'lucide-react'

// ─── Nav Structure ─────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Get Started',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', tooltip: 'Overview of your agents and activity' },
      { icon: Bot, label: 'My Agents', path: '/dashboard/agents', tooltip: 'Create and manage your AI agents', highlight: true },
      { icon: LayoutTemplate, label: 'Templates', path: '/dashboard/templates', tooltip: 'Start from a pre-built agent template' },
      { icon: FlaskConical, label: 'Playground', path: '/dashboard/playground', tooltip: 'Test your agents in a sandbox environment' },
    ],
  },
  {
    label: 'Grow',
    items: [
      { icon: Users, label: 'Leads', path: '/dashboard/leads', tooltip: 'Manage contacts captured by your agents' },
      { icon: Radio, label: 'Broadcasts', path: '/dashboard/broadcasts', tooltip: 'Send bulk messages to your audience', badge: 'NEW' },
      { icon: Users2, label: 'Community Hub', path: '/dashboard/community', tooltip: 'Manage Telegram bots, communities & sticker packs', badge: 'NEW' },
      { icon: Users2, label: 'Teams', path: '/dashboard/teams', tooltip: 'Collaborate with team members' },
    ],
  },
  {
    label: 'Configure',
    items: [
      { icon: Plug, label: 'Integrations', path: '/dashboard/integrations', tooltip: 'Connect Telegram, SMS, Discord and more' },
      { icon: Zap, label: 'Automations', path: '/dashboard/automations', tooltip: 'Set up rules that trigger your agent automatically' },
      { icon: CheckSquare, label: 'Approvals', path: '/dashboard/approvals', tooltip: 'Review and approve agent responses before sending' },
      { icon: Activity, label: 'Activity', path: '/dashboard/activity', tooltip: 'See a live log of everything happening' },
      { icon: Film, label: 'Media Editor', path: '/dashboard/media', tooltip: 'Edit videos, images and create stickers with AI', badge: 'NEW' },
      { icon: Sparkles, label: 'Sticker Studio', path: '/dashboard/sticker-studio', tooltip: 'Create Telegram sticker packs with AI', badge: 'NEW' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { icon: BarChart2, label: 'Analytics', path: '/dashboard/analytics', tooltip: 'Track message volume and agent performance' },
      { icon: FileText, label: 'Reports', path: '/dashboard/reports', tooltip: 'Export detailed reports on your agents' },
    ],
  },
  {
    label: 'Account',
    items: [
      { icon: CreditCard, label: 'Billing', path: '/dashboard/billing', tooltip: 'Manage your plan and subscription' },
      { icon: Settings, label: 'Settings', path: '/dashboard/settings', tooltip: 'Account preferences and security' },
    ],
  },
]

// Onboarding checklist steps
const ONBOARDING_STEPS = [
  { id: 'create_agent', label: 'Create your first agent', path: '/dashboard/agents/new' },
  { id: 'connect_channel', label: 'Connect a channel', path: '/dashboard/integrations' },
  { id: 'test_playground', label: 'Test in Playground', path: '/dashboard/playground' },
]

interface Props { children: ReactNode; title?: string }
interface AppUser { email: string; name: string; role?: string; plan?: string }

function getUser(): AppUser {
  try {
    const raw = localStorage.getItem('dipperai_user')
    if (raw) return JSON.parse(raw) as AppUser
  } catch {}
  return { email: '', name: '' }
}

// ─── Onboarding Checklist ──────────────────────────────────────────────────────
function OnboardingChecklist({ agentCount }: { agentCount: number }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('dipperai_onboarding_done') === '1' } catch { return false }
  })
  const [expanded, setExpanded] = useState(true)

  const completed = {
    create_agent: agentCount > 0,
    connect_channel: false,
    test_playground: false,
  } as Record<string, boolean>

  const doneCount = Object.values(completed).filter(Boolean).length
  const allDone = doneCount === ONBOARDING_STEPS.length

  if (dismissed || allDone) return null

  return (
    <div style={{ margin: '0 12px 8px', borderRadius: 12, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', overflow: 'hidden' }}>
      <button onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={13} style={{ color: '#a78bfa' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.05em' }}>SETUP GUIDE</span>
          <span style={{ fontSize: 10, background: 'rgba(139,92,246,0.2)', color: '#a78bfa', padding: '1px 6px', borderRadius: 100, fontWeight: 700 }}>{doneCount}/{ONBOARDING_STEPS.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChevronDown size={12} style={{ color: '#6b7db3', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
      </button>
      {expanded && (
        <div style={{ padding: '0 12px 10px' }}>
          {ONBOARDING_STEPS.map(step => (
            <Link key={step.id} to={step.path}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', textDecoration: 'none', opacity: completed[step.id] ? 0.5 : 1 }}>
              {completed[step.id]
                ? <CheckCircle2 size={14} style={{ color: '#10d9a0', flexShrink: 0 }} />
                : <Circle size={14} style={{ color: 'rgba(139,92,246,0.4)', flexShrink: 0 }} />}
              <span style={{ fontSize: 12, color: completed[step.id] ? '#4a5580' : '#c4d0f5', textDecoration: completed[step.id] ? 'line-through' : 'none' }}>
                {step.label}
              </span>
              {!completed[step.id] && <ArrowRight size={10} style={{ color: '#4a5580', marginLeft: 'auto' }} />}
            </Link>
          ))}
          <button onClick={() => { localStorage.setItem('dipperai_onboarding_done', '1'); setDismissed(true); }}
            style={{ marginTop: 6, fontSize: 10, color: '#4a5580', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Tooltip ───────────────────────────────────────────────────────────────────
function Tooltip({ text }: { text: string }) {
  return (
    <div style={{
      position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)',
      marginLeft: 12, background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)',
      color: '#c4d0f5', fontSize: 11, padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)', zIndex: 9999, pointerEvents: 'none',
      fontWeight: 500, lineHeight: 1.4,
    }}>
      {text}
      <div style={{ position: 'absolute', right: '100%', top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderRight: '4px solid #1e1e2e' }} />
    </div>
  )
}

// ─── Nav Item ──────────────────────────────────────────────────────────────────
function NavItem({ item, active, collapsed }: { item: any; active: boolean; collapsed: boolean }) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link to={item.path}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 9,
        textDecoration: 'none', position: 'relative', transition: 'all 0.15s ease',
        background: active ? 'rgba(139,92,246,0.15)' : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        marginBottom: 1,
      }}>
      {active && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, background: 'linear-gradient(to bottom, #8b5cf6, #6d28d9)', borderRadius: '0 3px 3px 0' }} />}
      <item.icon size={15} style={{ color: active ? '#a78bfa' : hovered ? '#c4d0f5' : '#6b7db3', flexShrink: 0, transition: 'color 0.15s' }} />
      {!collapsed && (
        <>
          <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: active ? '#e2d9f3' : hovered ? '#c4d0f5' : '#8b9cc8', flex: 1, letterSpacing: '-0.01em', transition: 'color 0.15s' }}>
            {item.label}
          </span>
          {item.badge && (
            <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 100, background: item.badge === 'NEW' ? 'rgba(139,92,246,0.2)' : 'rgba(16,217,160,0.15)', color: item.badge === 'NEW' ? '#a78bfa' : '#10d9a0', letterSpacing: '0.06em' }}>
              {item.badge}
            </span>
          )}
          {item.highlight && !active && (
            <Sparkles size={11} style={{ color: '#a78bfa', opacity: 0.6 }} />
          )}
        </>
      )}
      {/* Tooltip on hover (only show when not active and sidebar not collapsed to save space) */}
      {hovered && collapsed && <Tooltip text={item.label} />}
      {hovered && !collapsed && item.tooltip && (
        <div style={{
          position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)',
          marginLeft: 8, background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.06)',
          color: '#6b7db3', fontSize: 11, padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap',
          zIndex: 9999, pointerEvents: 'none', maxWidth: 200, lineHeight: 1.4,
        }}>
          {item.tooltip}
        </div>
      )}
    </Link>
  )
}

// ─── Command Palette ───────────────────────────────────────────────────────────
function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const allItems = NAV_GROUPS.flatMap(g => g.items)

  useEffect(() => {
    if (open) { setQuery(''); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!open) return null

  const filtered = query
    ? allItems.filter(i => i.label.toLowerCase().includes(query.toLowerCase()) || i.tooltip?.toLowerCase().includes(query.toLowerCase()))
    : allItems

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: 520, background: '#0f0f17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Search size={16} style={{ color: '#6b7db3', flexShrink: 0 }} />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search pages and features..." style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#f0f4ff', fontSize: 14 }} />
          <kbd style={{ fontSize: 10, color: '#4a5580', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>ESC</kbd>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: 8 }}>
          {filtered.map(item => (
            <button key={item.path} onClick={() => { navigate(item.path); onClose(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <item.icon size={15} style={{ color: '#6b7db3' }} />
              <div>
                <div style={{ fontSize: 13, color: '#c4d0f5', fontWeight: 500 }}>{item.label}</div>
                {item.tooltip && <div style={{ fontSize: 11, color: '#4a5580', marginTop: 1 }}>{item.tooltip}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Layout ───────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const user = getUser()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [agentCount] = useState(0)
  const [configExpanded, setConfigExpanded] = useState(false)

  // Auto-expand Configure section if current path is in it
  const configPaths = ['/dashboard/integrations', '/dashboard/automations', '/dashboard/approvals', '/dashboard/activity', '/dashboard/media']
  const inConfig = configPaths.some(p => location.pathname.startsWith(p))

  useEffect(() => {
    if (inConfig) setConfigExpanded(true)
  }, [location.pathname])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('dipperai_user')
    navigate('/login')
  }

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname.startsWith(path)
  }

  const planBadge = user.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : 'Free'
  const planColor = user.plan === 'admin' || user.plan === 'business' ? '#10d9a0' : user.plan === 'pro' ? '#a78bfa' : '#4a5580'

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <Link to="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={16} className="text-white" />
          </div>
          {!collapsed && <span style={{ fontWeight: 800, fontSize: 15, color: '#f0f4ff', letterSpacing: '-0.02em' }}>DipperAI</span>}
        </Link>
        <button onClick={() => setCollapsed(c => !c)}
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7, padding: '4px 6px', color: '#6b7db3', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          {collapsed ? <ChevronRight size={13} /> : <Menu size={13} />}
        </button>
      </div>

      {/* Search / Command */}
      {!collapsed && (
        <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>
          <button onClick={() => setCmdOpen(true)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#4a5580', cursor: 'pointer', fontSize: 12 }}>
            <Search size={12} />
            <span style={{ flex: 1, textAlign: 'left' }}>Search...</span>
            <kbd style={{ fontSize: 9, background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4, color: '#2a3255' }}>⌘K</kbd>
          </button>
        </div>
      )}

      {/* Onboarding */}
      {!collapsed && <OnboardingChecklist agentCount={agentCount} />}

      {/* Nav Groups */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px', scrollbarWidth: 'none' }}>
        {NAV_GROUPS.map((group, gi) => {
          // Configure group is collapsible
          const isConfigGroup = group.label === 'Configure'
          const isExpanded = isConfigGroup ? configExpanded : true

          return (
            <div key={group.label} style={{ marginBottom: 4 }}>
              {!collapsed && (
                <button
                  onClick={() => isConfigGroup && setConfigExpanded(e => !e)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', padding: '8px 10px 4px', background: 'none', border: 'none', cursor: isConfigGroup ? 'pointer' : 'default' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#2a3255', letterSpacing: '0.1em', textTransform: 'uppercase', flex: 1, textAlign: 'left' }}>
                    {group.label}
                  </span>
                  {isConfigGroup && (
                    <ChevronDown size={10} style={{ color: '#2a3255', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  )}
                </button>
              )}
              {(isExpanded || !isConfigGroup) && group.items.map(item => (
                <NavItem key={item.path} item={item} active={isActive(item.path)} collapsed={collapsed} />
              ))}
              {gi < NAV_GROUPS.length - 1 && !collapsed && (
                <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 10px 2px' }} />
              )}
            </div>
          )
        })}
      </nav>

      {/* User profile */}
      <div style={{ padding: '8px 12px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        {!collapsed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#fff' }}>
              {(user.name || user.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#c4d0f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name || user.email?.split('@')[0] || 'User'}
              </div>
              <div style={{ fontSize: 10, color: planColor, fontWeight: 700 }}>{planBadge}</div>
            </div>
            <button onClick={handleLogout} title="Sign out"
              style={{ background: 'none', border: 'none', color: '#4a5580', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#c4d0f5')}
              onMouseLeave={e => (e.currentTarget.style.color = '#4a5580')}>
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button onClick={handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, background: 'none', border: 'none', color: '#4a5580', cursor: 'pointer' }}>
            <LogOut size={14} />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0f', overflow: 'hidden' }}>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* Desktop sidebar */}
      <aside style={{
        width: collapsed ? 56 : 220, flexShrink: 0, background: '#0d0d14',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }} className="hidden md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }} className="md:hidden">
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setMobileOpen(false)} />
          <aside style={{ position: 'relative', width: 240, background: '#0d0d14', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
            <div style={{ position: 'absolute', top: 12, right: 12 }}>
              <button onClick={() => setMobileOpen(false)} style={{ background: 'none', border: 'none', color: '#6b7db3', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0, background: '#0a0a0f' }}>
          <button onClick={() => setMobileOpen(true)} className="md:hidden" style={{ background: 'none', border: 'none', color: '#6b7db3', cursor: 'pointer', display: 'flex' }}>
            <Menu size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Breadcrumb hint */}
            <span style={{ fontSize: 13, color: '#4a5580', fontWeight: 500 }}>
              {NAV_GROUPS.flatMap(g => g.items).find(i => isActive(i.path))?.label || 'Dashboard'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setCmdOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#6b7db3', cursor: 'pointer', fontSize: 12 }}
              className="hidden md:flex">
              <Command size={12} />
              <span>Search</span>
              <kbd style={{ fontSize: 9, background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: 3, color: '#2a3255' }}>⌘K</kbd>
            </button>
            <PlatformGuide />
            <Link to="/dashboard/agents/new"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 700, boxShadow: '0 2px 12px rgba(124,58,237,0.3)', whiteSpace: 'nowrap' }}>
              <Sparkles size={12} />
              New Agent
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
