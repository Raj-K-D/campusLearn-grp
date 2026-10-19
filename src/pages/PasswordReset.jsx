import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowLeft, FaLock } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../util/supabase';

export default function PasswordReset() {
  const { user, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setReady(Boolean(data?.session));
      setChecked(true);
    }).catch((sessionError) => {
      if (active) {
        setError(sessionError.message || 'Could not verify the reset link.');
        setChecked(true);
      }
    });
    return () => { active = false; };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (password.length < 8) {
      setError('Your password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) throw updateError;
      setSuccess('Your password has been updated. You can now sign in with your new password.');
      setPassword('');
      setConfirmPassword('');
    } catch (updateError) {
      setError(updateError.message || 'Could not update your password. Request a new reset link and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-950 to-indigo-950 text-white flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-3xl border border-gray-800 bg-gray-900/95 p-7 sm:p-9 shadow-2xl shadow-indigo-950/50">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-8">
          <FaArrowLeft /> Back to sign in
        </Link>
        <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center mb-5">
          <FaLock />
        </div>
        <h1 className="text-2xl font-extrabold mb-2">Set a new password</h1>
        <p className="text-sm text-gray-400 mb-6">
          {user?.email ? `Choose a new password for ${user.email}.` : 'Use the secure link sent to your email to set a new password.'}
        </p>

        {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-sm p-3 mb-5">{error}</p>}
        {success && <p role="status" className="rounded-xl border border-green-500/20 bg-green-500/10 text-green-300 text-sm p-3 mb-5">{success}</p>}

        {ready ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-semibold text-gray-300">
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none focus:border-indigo-500"
              />
            </label>
            <label className="block text-sm font-semibold text-gray-300">
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none focus:border-indigo-500"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? 'Updating password…' : 'Update password'}
            </button>
          </form>
        ) : (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
            {!checked ? 'Checking your secure reset link…' : error || 'This reset link is invalid or has expired.'}
            {checked && <p className="mt-2 text-amber-100/80">Return to sign in to request a new reset link.</p>}
          </div>
        )}

        {success && <Link to="/login" className="mt-5 inline-flex font-bold text-indigo-300 hover:text-white">Go to sign in</Link>}
      </section>
    </main>
  );
}
