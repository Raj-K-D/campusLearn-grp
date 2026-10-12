import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="text-8xl font-extrabold text-gray-200 mb-4">404</div>
        <div className="text-5xl mb-6">🤔</div>
        <h1 className="text-2xl font-extrabold text-gray-800 mb-3">Page Not Found</h1>
        <p className="text-gray-500 mb-8 max-w-sm mx-auto">
          Looks like this page got lost in the library. Let's get you back on track.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition"
        >
          🏠 Back to Home
        </Link>
      </motion.div>
    </div>
  );
}
