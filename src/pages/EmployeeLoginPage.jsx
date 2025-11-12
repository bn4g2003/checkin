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
      const { database, ref, get } = await getDb();
      const employeesRef = ref(database, `employees/${employeeId.toUpperCase()}`);
      const snapshot = await get(employeesRef);

      if (snapshot.exists()) {
        const employeeData = snapshot.val();
        
        // Kiểm tra password
        const storedPassword = employeeData.password || '123456'; // Mặc định là 123456 nếu chưa có
        if (storedPassword === password) {
          if (employeeData.active !== false) {
            localStorage.setItem('employeeSessionId', employeeId.toUpperCase());
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
        addToast({ type: 'error', message: 'Employee ID not found.' });
      }
    } catch (error) {
      console.error('Login error:', error);
      addToast({ type: 'error', message: 'An error occurred during login. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-xl shadow-lg p-6 space-y-5">
        <h1 className="text-2xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600">Employee Login</h1>
        <div>
          <label className="text-sm font-medium text-gray-700 flex items-center mb-1"><User size={16} className="mr-1"/>Employee ID</label>
          <input
            type="text"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g., NV001"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 flex items-center mb-1"><Lock size={16} className="mr-1"/>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            placeholder="Enter your password"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
