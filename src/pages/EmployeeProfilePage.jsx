import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDb } from '../lib/firebaseClient';
import {
  User,
  DollarSign,
  Clock,
  Calendar,
  Award,
  TrendingUp,
  LogOut,
  MapPin,
  Briefcase,
  Mail,
  Phone,
  Building,
  Edit,
  Save,
  X
} from 'lucide-react';
import { useToast } from '../components/ui/useToast';
import EmployeeNavbar from '../components/employee/EmployeeNavbar';

export default function EmployeeProfilePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [employee, setEmployee] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [workRecords, setWorkRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    const employeeId = localStorage.getItem('employeeSessionId');
    if (!employeeId) {
      addToast({ type: 'error', message: 'Please login first' });
      navigate('/employee-login');
      return;
    }

    loadEmployeeData(employeeId);
  }, [navigate, addToast]);

  const loadEmployeeData = async (employeeId) => {
    try {
      const { database, ref, get, onValue } = await getDb();

      // Load employee info
      const employeeRef = ref(database, `employees/${employeeId}`);
      const employeeSnapshot = await get(employeeRef);
      
      if (employeeSnapshot.exists()) {
        setEmployee({ id: employeeId, ...employeeSnapshot.val() });
      }

      // Load checkins
      const checkinsRef = ref(database, 'checkins');
      onValue(checkinsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const employeeCheckins = Object.entries(data)
            .map(([id, value]) => ({ id, ...value }))
            .filter(c => c.employeeId === employeeId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setCheckins(employeeCheckins);
        }
      });

      // Load work records
      const workRecordsRef = ref(database, 'workRecords');
      onValue(workRecordsRef, (snapshot) => {
        const data = snapshot.val() || {};
        setWorkRecords(data);
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      addToast({ type: 'error', message: 'Error loading data' });
      setLoading(false);
    }
  };

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!employee) return null;

    const employeeRecords = [];
    Object.values(workRecords).forEach(dayRecords => {
      if (dayRecords[employee.id]) {
        employeeRecords.push(dayRecords[employee.id]);
      }
    });

    const totalDays = employeeRecords.length;
    const totalHours = employeeRecords.reduce((sum, record) => sum + (record.totalHours || 0), 0);
    const avgHoursPerDay = totalDays > 0 ? totalHours / totalDays : 0;
    const onTimeRecords = employeeRecords.filter(record => !record.late).length;
    const onTimeRate = totalDays > 0 ? (onTimeRecords / totalDays) * 100 : 0;
    const totalOvertime = employeeRecords.reduce((sum, record) => {
      return sum + Math.max(0, (record.totalHours || 0) - 8);
    }, 0);

    // Calculate salary
    const baseSalary = employee.baseSalary || 0;
    const baseSalaryUSD = employee.baseSalaryUSD || 0;
    const salaryPercentage = employee.salaryPercentage || 100;
    const actualSalary = baseSalary * (salaryPercentage / 100);
    const actualSalaryUSD = baseSalaryUSD * (salaryPercentage / 100);

    return {
      totalDays,
      totalHours,
      avgHoursPerDay,
      onTimeRate,
      totalOvertime,
      baseSalary,
      baseSalaryUSD,
      salaryPercentage,
      actualSalary,
      actualSalaryUSD
    };
  }, [employee, workRecords]);

  const handleLogout = () => {
    localStorage.removeItem('employeeSessionId');
    localStorage.removeItem('employeeSessionName');
    addToast({ type: 'success', message: 'Logged out successfully' });
    navigate('/employee-login');
  };

  const handleEdit = () => {
    setEditForm({
      phone: employee.phone || '',
      email: employee.email || '',
      birthday: employee.birthday || ''
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    try {
      const { database, ref, update } = await getDb();
      const employeeRef = ref(database, `employees/${employee.id}`);
      
      await update(employeeRef, {
        phone: editForm.phone || null,
        email: editForm.email || null,
        birthday: editForm.birthday || null
      });

      setEmployee({ ...employee, ...editForm });
      setIsEditing(false);
      addToast({ type: 'success', message: 'Cập nhật thông tin thành công!' });
    } catch (error) {
      console.error('Error updating:', error);
      addToast({ type: 'error', message: 'Lỗi khi cập nhật thông tin' });
    }
  };

  const formatCurrency = (amount, currency = 'VND') => {
    if (currency === 'VND') {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('vi-VN');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <p className="text-gray-600">Employee not found</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <EmployeeNavbar />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center">
                  <User size={40} className="text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">{employee.fullName}</h1>
                  <p className="text-gray-600">ID: {employee.id}</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-2 ${
                    employee.active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {employee.active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              {!isEditing ? (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition"
                >
                  <Edit size={18} />
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                  >
                    <Save size={18} />
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                  >
                    <X size={18} />
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

        {/* Personal Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Briefcase size={20} className="text-indigo-600" />
              Work Information
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Building size={16} className="text-gray-500" />
                <span className="text-gray-600">Department:</span>
                <span className="font-medium">{employee.department || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Award size={16} className="text-gray-500" />
                <span className="text-gray-600">Position:</span>
                <span className="font-medium">{employee.position || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-gray-500" />
                <span className="text-gray-600">Branch:</span>
                <span className="font-medium">{employee.branch || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <User size={16} className="text-gray-500" />
                <span className="text-gray-600">Team:</span>
                <span className="font-medium">{employee.team || '-'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <User size={20} className="text-indigo-600" />
              Personal Information
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-gray-500" />
                <span className="text-gray-600 min-w-[120px]">Date of Birth:</span>
                {isEditing ? (
                  <input
                    type="date"
                    value={editForm.birthday || ''}
                    onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                    className="px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <span className="font-medium">{formatDate(employee.birthday)}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-gray-500" />
                <span className="text-gray-600 min-w-[120px]">Email:</span>
                {isEditing ? (
                  <input
                    type="email"
                    value={editForm.email || ''}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="flex-1 px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                    placeholder="email@example.com"
                  />
                ) : (
                  <span className="font-medium">{employee.email || '-'}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-gray-500" />
                <span className="text-gray-600 min-w-[120px]">Phone:</span>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editForm.phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="flex-1 px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                    placeholder="0123456789"
                  />
                ) : (
                  <span className="font-medium">{employee.phone || '-'}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-gray-500" />
                <span className="text-gray-600 min-w-[120px]">Start Date:</span>
                <span className="font-medium">{formatDate(employee.startDate)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Salary Info */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg shadow-md p-6 text-white">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <DollarSign size={24} />
            Salary Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/20 rounded-lg p-4">
              <p className="text-sm opacity-90">Base Salary</p>
              <p className="text-2xl font-bold">
                {statistics.baseSalary > 0 
                  ? formatCurrency(statistics.baseSalary, 'VND')
                  : formatCurrency(statistics.baseSalaryUSD, 'USD')}
              </p>
            </div>
            <div className="bg-white/20 rounded-lg p-4">
              <p className="text-sm opacity-90">Salary Percentage</p>
              <p className="text-2xl font-bold">{statistics.salaryPercentage}%</p>
            </div>
            <div className="bg-white/20 rounded-lg p-4">
              <p className="text-sm opacity-90">Actual Salary</p>
              <p className="text-2xl font-bold">
                {statistics.actualSalary > 0
                  ? formatCurrency(statistics.actualSalary, 'VND')
                  : formatCurrency(statistics.actualSalaryUSD, 'USD')}
              </p>
            </div>
          </div>
        </div>

        {/* Work Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Days</p>
                <p className="text-3xl font-bold text-indigo-600">{statistics.totalDays}</p>
              </div>
              <Calendar size={40} className="text-indigo-200" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Hours</p>
                <p className="text-3xl font-bold text-blue-600">{statistics.totalHours.toFixed(1)}h</p>
              </div>
              <Clock size={40} className="text-blue-200" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">On-Time Rate</p>
                <p className="text-3xl font-bold text-green-600">{statistics.onTimeRate.toFixed(1)}%</p>
              </div>
              <TrendingUp size={40} className="text-green-200" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total OT</p>
                <p className="text-3xl font-bold text-orange-600">{statistics.totalOvertime.toFixed(1)}h</p>
              </div>
              <Award size={40} className="text-orange-200" />
            </div>
          </div>
        </div>

        {/* Recent Check-ins */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Check-in History</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">WiFi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {checkins.slice(0, 10).map((checkin) => (
                  <tr key={checkin.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{formatDateTime(checkin.timestamp)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        checkin.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {checkin.type === 'in' ? 'Check In' : 'Check Out'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {checkin.location?.address || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        checkin.wifi?.verified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {checkin.wifi?.ssid || 'Unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
                {checkins.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                      No check-in history yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
