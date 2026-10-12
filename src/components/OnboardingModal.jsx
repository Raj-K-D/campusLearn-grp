import { useState } from 'react';
import { motion } from 'framer-motion';
import { FaGraduationCap, FaCheck, FaUser } from 'react-icons/fa';

export const PROFILE_KEY = 'campuslearn_profile';

const BRANCH_OPTIONS = [
  { id: 'CS', name: 'Computer Science & Engineering (CSE)' },
  { id: 'IT', name: 'Information Technology (IT)' },
  { id: 'AI', name: 'AI & Machine Learning (AIML)' },
  { id: 'ENTC', name: 'Electronics & Telecomm (ENTC)' },
  { id: 'MECH', name: 'Mechanical Engineering' },
  { id: 'CIVIL', name: 'Civil Engineering' },
];

export default function OnboardingModal({ user, onComplete }) {
  const [profile, setProfile] = useState({
    name: user?.user_metadata?.full_name || '',
    rollNo: '',
    branch: 'CS',
    semester: '4',
  });
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!profile.name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!profile.rollNo.trim()) {
      setError('Please enter your roll number.');
      return;
    }

    const final = {
      ...profile,
      name: profile.name.trim(),
      rollNo: profile.rollNo.trim().toUpperCase(),
      branchId: profile.branch.toLowerCase(), // back-compat
      completedAt: new Date().toISOString(),
    };

    localStorage.setItem(PROFILE_KEY, JSON.stringify(final));
    onComplete(final);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden text-gray-800"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <FaGraduationCap className="text-3xl" />
            <div>
              <h2 className="text-lg font-extrabold">Academic Setup</h2>
              <p className="text-indigo-100 text-xs">Set up your profile to view your subjects.</p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-semibold border border-red-100">
              ⚠️ {error}
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Full Name</label>
            <div className="relative">
              <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                required
                type="text"
                value={profile.name}
                onChange={e => setProfile({ ...profile, name: e.target.value })}
                placeholder="e.g. Raj Kumar"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-gray-50 focus:bg-white"
              />
            </div>
          </div>

          {/* Roll Number */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Roll Number / Student ID</label>
            <input
              required
              type="text"
              value={profile.rollNo}
              onChange={e => setProfile({ ...profile, rollNo: e.target.value })}
              placeholder="e.g. 23CSE0042"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-gray-50 focus:bg-white"
            />
          </div>

          {/* Branch & Semester Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Branch</label>
              <select
                value={profile.branch}
                onChange={e => setProfile({ ...profile, branch: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-gray-50"
              >
                {BRANCH_OPTIONS.map(b => (
                  <option key={b.id} value={b.id}>{b.id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Semester</label>
              <select
                value={profile.semester}
                onChange={e => setProfile({ ...profile, semester: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-gray-50"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                  <option key={s} value={String(s)}>Sem {s}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 rounded-xl transition-all shadow-lg shadow-indigo-150 flex justify-center items-center gap-2"
          >
            <FaCheck /> Setup Complete, Let's Go!
          </button>
        </form>
      </motion.div>
    </div>
  );
}
