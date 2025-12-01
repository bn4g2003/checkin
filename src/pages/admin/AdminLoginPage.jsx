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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-2xl p-8 space-y-6 border border-white/10">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <img src="/logo-kama.png" alt="Logo" className="h-32 w-auto" />
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Admin Portal</h1>
            <p className="text-text-muted text-sm">Management Dashboard Access</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text-muted flex items-center mb-2">
                <User size={18} className="mr-2 text-primary" />
                Username
              </label>
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 focus:border-transparent transition outline-none placeholder-white/20"
                placeholder="admin"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-text-muted flex items-center mb-2">
                <Lock size={18} className="mr-2 text-primary" />
                Password
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 focus:border-transparent transition outline-none placeholder-white/20"
                placeholder="admin123"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-primary hover:bg-primary/80 text-white font-bold shadow-lg shadow-primary/20 transition-all duration-200"
          >
            Sign In
          </button>
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          Authorized personnel only
        </p>
      </div>
    </div>
  );
}
