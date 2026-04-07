import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Dashboard from './pages/Dashboard'
import Students from './pages/admin/Students'
import Classes from './pages/admin/Classes'
import Users from './pages/admin/Users'
import Resources from './pages/admin/Resources'
import EventsDeadlines from './pages/admin/EventsDeadlines'
import BehaviorManagement from './pages/admin/BehaviorManagement'
import ClassDetail from './pages/ClassDetail'
import UserSettings from './pages/UserSettings'
import BehaviorReport from './pages/BehaviorReport'

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
  if (!user) return <Navigate to="/login" />
  if (adminOnly && profile?.role !== 'admin') return <Navigate to="/dashboard" />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><UserSettings /></ProtectedRoute>} />
      <Route path="/class/:classId" element={<ProtectedRoute><ClassDetail /></ProtectedRoute>} />
      <Route path="/teacher/behavior-report" element={<ProtectedRoute><BehaviorReport /></ProtectedRoute>} />
      <Route path="/admin/students" element={<ProtectedRoute adminOnly><Students /></ProtectedRoute>} />
      <Route path="/admin/classes" element={<ProtectedRoute adminOnly><Classes /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
      <Route path="/admin/resources" element={<ProtectedRoute adminOnly><Resources /></ProtectedRoute>} />
      <Route path="/admin/events-deadlines" element={<ProtectedRoute adminOnly><EventsDeadlines /></ProtectedRoute>} />
      <Route path="/admin/behavior-management" element={<ProtectedRoute adminOnly><BehaviorManagement /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}