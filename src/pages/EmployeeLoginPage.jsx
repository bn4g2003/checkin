import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDb } from '../lib/firebaseClient';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../components/ui/useToast';

export default function EmployeeLoginPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { database, ref, get } = await getDb();

      let employeeData = null;
      let foundId = null;

      // Tìm nhân viên theo email (tìm thủ công để tránh lỗi index)
      const employeesRef = ref(database, 'employees');
      const snapshot = await get(employeesRef);

      if (snapshot.exists()) {
        const allEmployees = snapshot.val();
        const searchEmail = email.toLowerCase().trim();
        
        for (const [id, emp] of Object.entries(allEmployees)) {
          if (emp.email && emp.email.toLowerCase() === searchEmail) {
            foundId = id;
            employeeData = emp;
            break;
          }
        }
      }

      if (employeeData) {
        // Kiểm tra password
        const storedPassword = employeeData.password || '123456';
        if (storedPassword === password) {
          if (employeeData.active !== false) {
            localStorage.setItem('employeeSessionId', foundId);
            localStorage.setItem('employeeSessionName', employeeData.fullName);
            addToast({ type: 'success', message: `Xin chào, ${employeeData.fullName}!` });
            navigate('/');
          } else {
            addToast({ type: 'error', message: 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ HR.' });
          }
        } else {
          addToast({ type: 'error', message: 'Mật khẩu không đúng.' });
        }
      } else {
        addToast({ type: 'error', message: 'Email không tồn tại trong hệ thống.' });
      }
    } catch (error) {
      console.error('Login error:', error);
      addToast({ type: 'error', message: 'Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.' });
    } finally {
      setLoading(false);
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
            <h1 className="text-3xl font-bold text-white mb-2">Employee Portal</h1>
            <p className="text-text-muted text-sm">Sign in to access your account</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text-muted flex items-center mb-2">
                <Mail size={18} className="mr-2 text-primary" />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 focus:border-transparent transition outline-none placeholder-white/20"
                placeholder="Nhập email của bạn"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-text-muted flex items-center mb-2">
                <Lock size={18} className="mr-2 text-primary" />
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 focus:border-transparent transition outline-none placeholder-white/20"
                  placeholder="Nhập mật khẩu"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-primary hover:bg-primary/80 text-white font-bold shadow-lg shadow-primary/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          Cần hỗ trợ? Liên hệ bộ phận HR
        </p>
      </div>
    </div>
  );
}
