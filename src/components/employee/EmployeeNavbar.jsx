import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, User, LogOut, Clock } from 'lucide-react';

export default function EmployeeNavbar() {
  const location = useLocation();
  const employeeName = localStorage.getItem('employeeSessionName') || 'Employee';

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-surface/40 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-primary">Employee Portal</h1>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive('/')
                  ? 'bg-primary/20 text-primary font-semibold'
                  : 'text-text-muted hover:bg-white/10 hover:text-white'
                }`}
            >
              <Home size={18} />
              <span className="hidden sm:inline">Check-in</span>
            </Link>

            <Link
              to="/employee-profile"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive('/employee-profile')
                  ? 'bg-primary/20 text-primary font-semibold'
                  : 'text-text-muted hover:bg-white/10 hover:text-white'
                }`}
            >
              <User size={18} />
              <span className="hidden sm:inline">Profile</span>
            </Link>

            <Link
              to="/ot-registration"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive('/ot-registration')
                  ? 'bg-primary/20 text-primary font-semibold'
                  : 'text-text-muted hover:bg-white/10 hover:text-white'
                }`}
            >
              <Clock size={18} />
              <span className="hidden sm:inline">OT</span>
            </Link>

            {/* User Info */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
              <User size={16} className="text-text-muted" />
              <span className="text-sm text-white">{employeeName}</span>
            </div>

            <Link
              to="/employee-logout"
              className="flex items-center gap-2 px-4 py-2 bg-red-500/80 text-white rounded-lg hover:bg-red-600/80 transition-colors backdrop-blur-sm"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
