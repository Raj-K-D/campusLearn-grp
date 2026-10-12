import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const OWNER_EMAILS = ['rajdugane00@gmail.com', 'rajdugane685@gmail.com'];

/** Requires authentication only */
export function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/** Super Admin only */
export function AdminRoute({ children }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin && !OWNER_EMAILS.includes(user.email)) return <Navigate to="/dashboard" replace />;
  return children;
}

/**
 * Coordinator OR Admin.
 */
export function CoordinatorRoute({ children }) {
  const { user, isAdmin, isCoordinator } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isCoordinator && !isAdmin && !OWNER_EMAILS.includes(user.email)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
