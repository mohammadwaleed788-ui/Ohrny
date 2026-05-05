import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

export function ProtectedRoute({ children }) {
  const { isAuthenticated, bootstrapping } = useAuth()

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-sm text-neutral-400">
        Loading session…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}
