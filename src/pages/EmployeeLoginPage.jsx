import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDb } from '../lib/firebaseClient';
import { User, Lock } from 'lucide-react';
import { useToast } from '../components/ui/useToast';

export default function EmployeeLoginPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { database, ref, get, query, orderByChild, equalTo } = await getDb();

      let employeeData = null;
      let foundId = null;

      // Check if input is email
      const isEmail = employeeId.includes('@');

      if (isEmail) {
        const employeesRef = ref(database, 'employees');
        const emailQuery = query(employeesRef, orderByChild('email'), equalTo(employeeId));
        const snapshot = await get(emailQuery);

        if (snapshot.exists()) {
          const data = snapshot.val();
          foundId = Object.keys(data)[0]; // Get the first match
          employeeData = data[foundId];
        }
      } else {
        // Assume it's Employee ID
        const targetId = employeeId.toUpperCase();
        const employeesRef = ref(database, `employees/${targetId}`);
        const snapshot = await get(employeesRef);

        if (snapshot.exists()) {
          employeeData = snapshot.val();
          foundId = targetId;
        }
      }

      if (employeeData) {
        // Kiểm tra password
        const storedPassword = employeeData.password || '123456'; // Mặc định là 123456 nếu chưa có
        if (storedPassword === password) {
          if (employeeData.active !== false) {
            localStorage.setItem('employeeSessionId', foundId);
            localStorage.setItem('employeeSessionName', employeeData.fullName);
            addToast({ type: 'success', message: `Welcome, ${employeeData.fullName}!` });
            navigate('/'); // Redirect to CheckinPage
          } else {
            addToast({ type: 'error', message: 'Your account is inactive. Please contact HR.' });
          }
        } else {
          addToast({ type: 'error', message: 'Invalid password.' });
        }
      } else {
        addToast({ type: 'error', message: isEmail ? 'Email not found.' : 'Employee ID not found.' });
      }
    } catch (error) {
      console.error('Login error:', error);
      addToast({ type: 'error', message: 'An error occurred during login. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <img src="/logo-kama.png" alt="Logo" className="h-32 w-auto" />
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Employee Portal</h1>
            <p className="text-gray-500 text-sm">Sign in to access your account</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center mb-2">
                <User size={18} className="mr-2 text-indigo-600" />
                Employee ID or Email
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                placeholder="Enter ID (e.g. NV001) or Email"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center mb-2">
                <Lock size={18} className="mr-2 text-indigo-600" />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Need help? Contact your HR department
        </p>
      </div>
    </div>
  );
}
