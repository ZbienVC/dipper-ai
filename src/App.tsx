import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ReactNode } from 'react'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Agents from './pages/Agents'
import NewAgent from './pages/NewAgent'
import AgentDetail from './pages/AgentDetail'
import Templates from './pages/Templates'
import Integrations from './pages/Integrations'
import Approvals from './pages/Approvals'
import Analytics from './pages/Analytics'
import ActivityPage from './pages/Activity'
import Settings from './pages/Settings'
import Billing from './pages/Billing'
import Admin from './pages/Admin'

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
        <Route path="/dashboard/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/dashboard/billing" element={<PrivateRoute><Billing /></PrivateRoute>} />

        <Route path="/admin" element={<Admin />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
