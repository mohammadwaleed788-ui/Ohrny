import { Navigate, Route, Routes } from 'react-router-dom'
import AdminApp from './Admin/AdminApp.jsx'
import OperatedProfilesApp from './Admin/operated-profiles/OperatedProfilesApp.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { ProtectedRoute } from './components/ProtectedRoute.jsx'
import { LoginPage } from './pages/LoginPage.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminApp />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/operated-profiles"
          element={
            <ProtectedRoute>
              <OperatedProfilesApp />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
