import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ReactNode, lazy, Suspense } from 'react'

// Eagerly load auth/landing pages for fast initial render
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'

// Lazy-load dashboard pages for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Agents = lazy(() => import('./pages/Agents'))
const NewAgent = lazy(() => import('./pages/NewAgent'))
const AgentDetail = lazy(() => import('./pages/AgentDetail'))
const Templates = lazy(() => import('./pages/Templates'))
const Integrations = lazy(() => import('./pages/Integrations'))
const Approvals = lazy(() => import('./pages/Approvals'))
const Analytics = lazy(() => import('./pages/Analytics'))
const ActivityPage = lazy(() => import('./pages/Activity'))
const Automations = lazy(() => import('./pages/Automations'))
const Settings = lazy(() => import('./pages/Settings'))
const Billing = lazy(() => import('./pages/Billing'))
const Admin = lazy(() => import('./pages/Admin'))
const EmbedChat = lazy(() => import('./pages/EmbedChat'))
const Teams = lazy(() => import('./pages/Teams'))
const TeamDetail = lazy(() => import('./pages/TeamDetail'))
const Leads = lazy(() => import('./pages/Leads'))
const Playground = lazy(() => import('./pages/Playground'))
const Broadcasts = lazy(() => import('./pages/Broadcasts'))
const Reports = lazy(() => import('./pages/Reports'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const ConversationSearch = lazy(() => import('./pages/ConversationSearch'))

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  )
}

function PrivateRoute({ children }: { children: ReactNode }) {
  try {
    const raw = localStorage.getItem('dipperai_user')
    if (!raw) return <Navigate to="/login" replace />
    const user = JSON.parse(raw)
    if (!user?.token) return <Navigate to="/login" replace />
  } catch {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected dashboard routes */}
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/dashboard/agents" element={<PrivateRoute><Agents /></PrivateRoute>} />
          <Route path="/dashboard/agents/new" element={<PrivateRoute><NewAgent /></PrivateRoute>} />
          <Route path="/dashboard/agents/:id" element={<PrivateRoute><AgentDetail /></PrivateRoute>} />
          <Route path="/dashboard/templates" element={<PrivateRoute><Templates /></PrivateRoute>} />
          <Route path="/dashboard/integrations" element={<PrivateRoute><Integrations /></PrivateRoute>} />
          <Route path="/dashboard/approvals" element={<PrivateRoute><Approvals /></PrivateRoute>} />
          <Route path="/dashboard/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
          <Route path="/dashboard/activity" element={<PrivateRoute><ActivityPage /></PrivateRoute>} />
          <Route path="/dashboard/automations" element={<PrivateRoute><Automations /></PrivateRoute>} />
          <Route path="/dashboard/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="/dashboard/billing" element={<PrivateRoute><Billing /></PrivateRoute>} />
          <Route path="/dashboard/teams" element={<PrivateRoute><Teams /></PrivateRoute>} />
          <Route path="/dashboard/teams/:id" element={<PrivateRoute><TeamDetail /></PrivateRoute>} />
          <Route path="/dashboard/leads" element={<PrivateRoute><Leads /></PrivateRoute>} />
          <Route path="/dashboard/playground" element={<PrivateRoute><Playground /></PrivateRoute>} />
          <Route path="/dashboard/broadcasts" element={<PrivateRoute><Broadcasts /></PrivateRoute>} />
          <Route path="/dashboard/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
          <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />
          <Route path="/dashboard/search" element={<PrivateRoute><ConversationSearch /></PrivateRoute>} />

          <Route path="/admin" element={<Admin />} />

          {/* Public embed chat — no auth required */}
          <Route path="/embed/:token" element={<EmbedChat />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
