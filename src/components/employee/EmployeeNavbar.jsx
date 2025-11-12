import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, User, LogOut, Clock } from 'lucide-react';

export default function EmployeeNavbar() {
  const location = useLocation();
  const employeeName = localStorage.getItem('employeeSessionName') || 'Employee';

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-indigo-600">Employee Portal</h1>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isActive('/') 
                  ? 'bg-indigo-100 text-indigo-700 font-semibold' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Home size={18} />
              <span className="hidden sm:inline">Check-in</span>
            </Link>

            <Link
              to="/employee-profile"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isActive('/employee-profile') 
                  ? 'bg-indigo-100 text-indigo-700 font-semibold' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <User size={18} />
              <span className="hidden sm:inline">Profile</span>
            </Link>

            <Link
              to="/ot-registration"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isActive('/ot-registration') 
                  ? 'bg-indigo-100 text-indigo-700 font-semibold' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Clock size={18} />
              <span className="hidden sm:inline">OT</span>
            </Link>

            {/* User Info */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
              <User size={16} className="text-gray-500" />
              <span className="text-sm text-gray-700">{employeeName}</span>
            </div>

            <Link
              to="/employee-logout"
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
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
