// Clean router-based App entry replacing previous monolithic component
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/admin/AdminLayout.jsx';
import { ToastProvider } from './components/ui/ToastProvider.jsx';

// Lazy loaded pages (to be created in ./pages & ./pages/admin)
const CheckinPage = lazy(() => import('./pages/CheckinPage.jsx'));
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage.jsx'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage.jsx'));
const EmployeesPage = lazy(() => import('./pages/admin/EmployeesPage.jsx'));
const WifiCheckinsPage = lazy(() => import('./pages/admin/WifiCheckinsPage.jsx'));
const OTRegistrationPage = lazy(() => import('./pages/OTRegistrationPage.jsx'));
const OTApprovalPage = lazy(() => import('./pages/admin/OTApprovalPage.jsx'));
const SalaryPage = lazy(() => import('./pages/admin/SalaryPage.jsx'));

function ProtectedRoute({ children }) {
  const isLoggedIn = typeof window !== 'undefined' && localStorage.getItem('adminSession') === 'true';
  return isLoggedIn ? children : <Navigate to="/admin" replace />;
}

export default function AppRouter() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="p-6 text-center">Đang tải...</div>}>
          <Routes>
          <Route path="/" element={<CheckinPage />} />
          <Route path="/ot-registration" element={<OTRegistrationPage />} />
          <Route path="/admin" element={<AdminLoginPage />} />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <DashboardPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/employees"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <EmployeesPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/wifi-checkins"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <WifiCheckinsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ot-approval"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <OTApprovalPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/salary"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <SalaryPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}