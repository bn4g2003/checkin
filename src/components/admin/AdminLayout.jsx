import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, Wifi, Users, DollarSign, Clock } from 'lucide-react';

const linkBase = 'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200';
const linkActive = 'bg-red-100 text-red-700 shadow-inner';
const linkInactive = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';

export default function AdminLayout({ children }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    try {
      localStorage.removeItem('adminSession');
    } catch {
      // ignore
    }
    navigate('/admin');
  };

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200/80 flex flex-col fixed h-full left-0 top-0">
        <div className="p-6 border-b border-gray-200/80">
          <h1 className="text-2xl font-bold text-red-600 tracking-tight">Admin</h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/admin/salary"
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
          >
            <DollarSign size={20} />
            <span>Salary</span>
          </NavLink>

          <NavLink
            to="/admin/wifi-checkins"
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
          >
            <Wifi size={20} />
            <span>WiFi & Check-ins</span>
          </NavLink>

          <NavLink
            to="/admin/employees"
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
          >
            <Users size={20} />
            <span>Employees</span>
          </NavLink>

          <NavLink
            to="/admin/ot-approval"
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
          >
            <Clock size={20} />
            <span>OT Management</span>
          </NavLink>
        </nav>

        <div className="p-4 mt-auto border-t border-gray-200/80">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-red-100 hover:text-red-700 transition-all duration-200"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 p-6 lg:p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
