import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Login from '../pages/Login';
import { FaShieldAlt, FaUserTie } from 'react-icons/fa';

const OWNER_EMAILS = ['rajdugane00@gmail.com', 'rajdugane685@gmail.com'];

/** Requires authentication only */
export function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Login portal="student" />;
  return children;
}

/** Super Admin only */
export function AdminRoute({ children }) {
  const { user, isAdmin, isCoordinator, signOut } = useAuth();
  if (!user) return <Login portal="admin" />;
  
  const isOwner = OWNER_EMAILS.includes(user.email?.toLowerCase());
  if (!isAdmin && !isOwner) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-3xl p-8 text-center text-white shadow-2xl">
          <div className="w-16 h-16 bg-red-900/40 text-red-400 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-red-800/60">
            <FaShieldAlt />
          </div>
          <h2 className="text-2xl font-extrabold mb-2">Admin Portal Restricted</h2>
          <p className="text-gray-400 text-sm mb-6">
            Signed in as <span className="text-gray-200 font-bold">{user.email}</span>. This account does not have Super Administrator privileges.
          </p>
          <div className="space-y-3">
            <a
              href="/dashboard"
              className="block w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition"
            >
              Go to Student Dashboard →
            </a>
            {isCoordinator && (
              <a
                href="/coordinator"
                className="block w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition"
              >
                Go to Coordinator Portal →
              </a>
            )}
            <button
              onClick={async () => { await signOut(); window.location.href = '/admin'; }}
              className="w-full py-2.5 bg-gray-800 text-gray-300 font-semibold rounded-xl hover:bg-gray-700 transition text-xs"
            >
              Sign In with Authorized Admin Account
            </button>
          </div>
        </div>
      </div>
    );
  }
  return children;
}

/**
 * Coordinator OR Admin.
 */
export function CoordinatorRoute({ children }) {
  const { user, isAdmin, isCoordinator, signOut } = useAuth();
  if (!user) return <Login portal="coordinator" />;
  
  const isOwner = OWNER_EMAILS.includes(user.email?.toLowerCase());
  if (!isCoordinator && !isAdmin && !isOwner) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-3xl p-8 text-center text-white shadow-2xl">
          <div className="w-16 h-16 bg-purple-900/40 text-purple-400 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-purple-800/60">
            <FaUserTie />
          </div>
          <h2 className="text-2xl font-extrabold mb-2">Coordinator Access Restricted</h2>
          <p className="text-gray-400 text-sm mb-6">
            Signed in as <span className="text-gray-200 font-bold">{user.email}</span>. This account has not been appointed as a Subject Coordinator.
          </p>
          <div className="space-y-3">
            <a
              href="/dashboard"
              className="block w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition"
            >
              Go to Student Dashboard →
            </a>
            <button
              onClick={async () => { await signOut(); window.location.href = '/coordinator'; }}
              className="w-full py-2.5 bg-gray-800 text-gray-300 font-semibold rounded-xl hover:bg-gray-700 transition text-xs"
            >
              Sign In as Appointed Coordinator
            </button>
          </div>
        </div>
      </div>
    );
  }
  return children;
}
