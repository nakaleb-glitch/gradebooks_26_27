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
import GradebookViewer from './pages/admin/GradebookViewer'
import WeeklyPlans from './pages/WeeklyPlans'
import ClassDetail from './pages/ClassDetail'
import UserSettings from './pages/UserSettings'
import BehaviorReport from './pages/BehaviorReport'
import StudentClassDetail from './pages/StudentClassDetail'
import StudentGradebookLookup from './pages/admin/StudentGradebookLookup'
import ResourceBookings from './pages/admin/ResourceBookings'
import TeacherSchedules from './pages/admin/TeacherSchedules'
import TeacherSchedule from './pages/TeacherSchedule'

const ProtectedRoute = ({ children, adminOnly = false, allowedRoles = null }) => {
  const { user, loading, effectiveRole } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
  if (!user) return <Navigate to="/login" />
  if (adminOnly && effectiveRole !== 'admin') return <Navigate to="/dashboard" />
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to="/dashboard" />
  }
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><UserSettings /></ProtectedRoute>} />
      <Route path="/class/:classId" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ClassDetail /></ProtectedRoute>} />
      <Route path="/student/class/:classId" element={<ProtectedRoute allowedRoles={['student']}><StudentClassDetail /></ProtectedRoute>} />
      <Route path="/teacher/behavior-report" element={<ProtectedRoute allowedRoles={['teacher']}><BehaviorReport /></ProtectedRoute>} />
      <Route path="/admin/students" element={<ProtectedRoute adminOnly><Students /></ProtectedRoute>} />
      <Route path="/admin/classes" element={<ProtectedRoute adminOnly><Classes /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
      <Route path="/admin/resources" element={<ProtectedRoute adminOnly><Resources /></ProtectedRoute>} />
      <Route path="/admin/events-deadlines" element={<ProtectedRoute adminOnly><EventsDeadlines /></ProtectedRoute>} />
      <Route path="/admin/behavior-management" element={<ProtectedRoute adminOnly><BehaviorManagement /></ProtectedRoute>} />
      <Route path="/admin/gradebooks" element={<ProtectedRoute adminOnly><GradebookViewer /></ProtectedRoute>} />
      <Route path="/admin/student-gradebook-lookup" element={<ProtectedRoute adminOnly><StudentGradebookLookup /></ProtectedRoute>} />
      <Route path="/admin/resource-bookings" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ResourceBookings /></ProtectedRoute>} />
      <Route path="/admin/teacher-schedules" element={<ProtectedRoute adminOnly><TeacherSchedules /></ProtectedRoute>} />
      <Route path="/teacher-schedule" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><TeacherSchedule /></ProtectedRoute>} />
      <Route path="/weekly-plans" element={<ProtectedRoute><WeeklyPlans /></ProtectedRoute>} />
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