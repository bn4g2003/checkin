import React, { useState } from 'react';
import { Lock, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.username === 'admin' && form.password === 'admin123') {
      localStorage.setItem('adminSession', 'true');
      navigate('/admin/dashboard');
    } else {
      setError('Error: Invalid username or password.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 p-4">
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <img src="/logo-kama.png" alt="Logo" className="h-32 w-auto" />
          </div>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Portal</h1>
            <p className="text-gray-500 text-sm">Management Dashboard Access</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center mb-2">
                <User size={18} className="mr-2 text-red-600"/>
                Username
              </label>
              <input 
                name="username" 
                value={form.username} 
                onChange={handleChange} 
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition" 
                placeholder="admin" 
                required
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center mb-2">
                <Lock size={18} className="mr-2 text-red-600"/>
                Password
              </label>
              <input 
                type="password" 
                name="password" 
                value={form.password} 
                onChange={handleChange} 
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition" 
                placeholder="admin123" 
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="w-full py-3 rounded-lg bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Sign In
          </button>
        </form>
        
        <p className="text-center text-sm text-gray-500 mt-6">
          Authorized personnel only
        </p>
      </div>
    </div>
  );
}
