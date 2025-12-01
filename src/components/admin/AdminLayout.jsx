import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, Wifi, Users, DollarSign, Clock } from 'lucide-react';

const linkBase = 'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200';
const linkActive = 'bg-primary/10 text-primary shadow-[0_0_15px_rgba(83,202,253,0.3)]';
const linkInactive = 'text-text-muted hover:bg-white/5 hover:text-white';

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
    <div className="flex min-h-screen font-sans text-text-main">
      {/* Sidebar */}
      <aside className="w-72 bg-background/30 backdrop-blur-xl border-r border-white/10 flex flex-col fixed h-full left-0 top-0 z-50 shadow-2xl">
        <div className="p-8 flex items-center gap-3">
          <img src="/logo-kama.png" alt="Logo" className="h-12 w-auto" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Admin</h1>
        </div>

        <nav className="flex-1 px-4 space-y-2">
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

        <div className="p-4 mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-text-muted bg-white/5 hover:bg-danger/10 hover:text-danger transition-all duration-200"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-72 p-6 lg:p-8 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
