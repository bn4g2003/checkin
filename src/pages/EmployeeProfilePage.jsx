import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDb } from '../lib/firebaseClient';
import {
  User,
  DollarSign,
  Clock,
  Calendar,
  Award,
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
  const [showCalendar, setShowCalendar] = useState(false);
  const [showOTCalendar, setShowOTCalendar] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedOTMonth, setSelectedOTMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filters, setFilters] = useState({
    month: new Date().toISOString().slice(0, 7),
    type: 'all' // all, ontime, late, absent
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [otRequests, setOtRequests] = useState([]);

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

      // Load OT requests
      const otRequestsRef = ref(database, 'otRequests');
      onValue(otRequestsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const requests = Object.entries(data)
            .map(([id, value]) => ({ id, ...value }))
            .filter(req => req.employeeId === employeeId && req.status === 'approved')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setOtRequests(requests);
        }
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      addToast({ type: 'error', message: 'Error loading data' });
      setLoading(false);
    }
  };

  // Calculate statistics based on filters
  const statistics = useMemo(() => {
    if (!employee) return null;

    const employeeRecords = [];
    const monthlyRecords = {};

    Object.entries(workRecords).forEach(([date, dayRecords]) => {
      if (dayRecords[employee.id]) {
        const record = { ...dayRecords[employee.id], date };
        employeeRecords.push(record);

        // Group by month
        const month = date.slice(0, 7);
        if (!monthlyRecords[month]) monthlyRecords[month] = [];
        monthlyRecords[month].push(record);
      }
    });

    // Filter by selected month
    const filteredRecords = filters.month
      ? (monthlyRecords[filters.month] || [])
      : employeeRecords;

    const totalDays = filteredRecords.length;
    const totalHours = filteredRecords.reduce((sum, record) => sum + (record.totalHours || 0), 0);
    const avgHoursPerDay = totalDays > 0 ? totalHours / totalDays : 0;
    const onTimeRecords = filteredRecords.filter(record => !record.late).length;
    const lateRecords = filteredRecords.filter(record => record.late).length;
    const onTimeRate = totalDays > 0 ? (onTimeRecords / totalDays) * 100 : 0;

    // Calculate late hours
    const totalLateMinutes = filteredRecords.reduce((sum, record) => {
      return sum + (record.lateMinutes || 0);
    }, 0);
    const totalLateHours = totalLateMinutes / 60;

    // Calculate OT from approved OT requests for the selected month
    const monthOTRequests = otRequests.filter(req => {
      if (!req.date) return false;
      const reqMonth = req.date.slice(0, 7);
      return reqMonth === filters.month;
    });

    const totalOvertime = monthOTRequests.reduce((sum, req) => {
      return sum + (parseFloat(req.hours) || 0);
    }, 0);

    const otSessions = monthOTRequests.length;

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
      onTimeRecords,
      lateRecords,
      totalLateHours,
      totalOvertime,
      otSessions,
      baseSalary,
      baseSalaryUSD,
      salaryPercentage,
      actualSalary,
      actualSalaryUSD,
      monthlyRecords,
      allRecords: employeeRecords,
      monthOTRequests
    };
  }, [employee, workRecords, filters.month, otRequests]);

  // Generate calendar data for selected month
  const calendarData = useMemo(() => {
    if (!employee || !statistics) return [];

    const [year, month] = selectedMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

    const calendar = [];
    const monthRecords = statistics.monthlyRecords[selectedMonth] || [];
    const recordsByDate = {};

    monthRecords.forEach(record => {
      recordsByDate[record.date] = record;
    });

    // Add empty cells for days before month starts
    for (let i = 0; i < startDayOfWeek; i++) {
      calendar.push({ day: null, status: null });
    }

    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const record = recordsByDate[dateStr];

      let status = 'absent'; // red - no record
      if (record) {
        status = record.late ? 'late' : 'ontime'; // yellow if late, green if on time
      }

      calendar.push({ day, date: dateStr, status, record });
    }

    return calendar;
  }, [employee, statistics, selectedMonth]);

  // Generate OT calendar data from approved OT requests
  const otCalendarData = useMemo(() => {
    if (!employee) return [];

    const [year, month] = selectedOTMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const calendar = [];

    // Get OT requests for selected month
    const monthOTRequests = otRequests.filter(req => {
      if (!req.date) return false;
      const reqMonth = req.date.slice(0, 7);
      return reqMonth === selectedOTMonth;
    });

    const otByDate = {};
    monthOTRequests.forEach(req => {
      if (!otByDate[req.date]) {
        otByDate[req.date] = 0;
      }
      otByDate[req.date] += parseFloat(req.hours) || 0;
    });

    // Add empty cells
    for (let i = 0; i < startDayOfWeek; i++) {
      calendar.push({ day: null, otHours: 0 });
    }

    // Add days with OT hours
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const otHours = otByDate[dateStr] || 0;

      calendar.push({ day, date: dateStr, otHours });
    }

    return calendar;
  }, [employee, otRequests, selectedOTMonth]);

  // Filter checkins based on selected month
  const filteredCheckins = useMemo(() => {
    if (!filters.month) return checkins;

    return checkins.filter(checkin => {
      if (!checkin.timestamp) return false;
      const checkinMonth = checkin.timestamp.slice(0, 7);
      return checkinMonth === filters.month;
    });
  }, [checkins, filters.month]);

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
      birthday: employee.birthday || '',
      address: employee.address || '',
      avatarURL: employee.avatarURL || ''
    });
    setAvatarPreview(employee.avatarURL || null);
    setIsEditing(true);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    try {
      const { database, ref, update } = await getDb();
      const employeeRef = ref(database, `employees/${employee.id}`);

      const updateData = {
        phone: editForm.phone || null,
        email: editForm.email || null,
        birthday: editForm.birthday || null,
        address: editForm.address || null
      };

      // If avatar was changed, save it as base64
      if (avatarFile && avatarPreview) {
        updateData.avatarURL = avatarPreview;
      }

      await update(employeeRef, updateData);

      setEmployee({ ...employee, ...updateData });
      setIsEditing(false);
      setAvatarFile(null);
      addToast({ type: 'success', message: 'Information updated successfully!' });
    } catch (error) {
      console.error('Error updating:', error);
      addToast({ type: 'error', message: 'Error updating information' });
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-muted">Employee not found</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <EmployeeNavbar />
      <div className="min-h-screen p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/10">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {isEditing ? (
                    <div className="relative">
                      <div className="w-20 h-20 bg-background/50 rounded-full flex items-center justify-center overflow-hidden border border-white/10">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <User size={40} className="text-primary" />
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1 cursor-pointer hover:bg-primary/80 transition-colors">
                        <Edit size={14} />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="w-20 h-20 bg-background/50 rounded-full flex items-center justify-center overflow-hidden border border-white/10">
                      {employee.avatarURL ? (
                        <img src={employee.avatarURL} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User size={40} className="text-primary" />
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">{employee.fullName}</h1>
                  <p className="text-text-muted">ID: {employee.id}</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-2 ${employee.active !== false ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                    {employee.active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              {!isEditing ? (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition shadow-lg shadow-primary/20"
                >
                  <Edit size={18} />
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-lg shadow-green-600/20"
                  >
                    <Save size={18} />
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
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
            <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/10">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Briefcase size={20} className="text-primary" />
                Work Information
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Building size={16} className="text-text-muted" />
                  <span className="text-text-muted">Department:</span>
                  <span className="font-medium text-white">{employee.department || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award size={16} className="text-text-muted" />
                  <span className="text-text-muted">Position:</span>
                  <span className="font-medium text-white">{employee.position || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-text-muted" />
                  <span className="text-text-muted">Branch:</span>
                  <span className="font-medium text-white">{employee.branch || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User size={16} className="text-text-muted" />
                  <span className="text-text-muted">Team:</span>
                  <span className="font-medium text-white">{employee.team || '-'}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/10">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <User size={20} className="text-primary" />
                Personal Information
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-text-muted" />
                  <span className="text-text-muted min-w-[120px]">Date of Birth:</span>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editForm.birthday || ''}
                      onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                      className="px-3 py-1 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                  ) : (
                    <span className="font-medium text-white">{formatDate(employee.birthday)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-text-muted" />
                  <span className="text-text-muted min-w-[120px]">Email:</span>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editForm.email || ''}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="flex-1 px-3 py-1 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none placeholder-white/20"
                      placeholder="email@example.com"
                    />
                  ) : (
                    <span className="font-medium text-white">{employee.email || '-'}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={16} className="text-text-muted" />
                  <span className="text-text-muted min-w-[120px]">Phone:</span>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editForm.phone || ''}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="flex-1 px-3 py-1 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none placeholder-white/20"
                      placeholder="0123456789"
                    />
                  ) : (
                    <span className="font-medium text-white">{employee.phone || '-'}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-text-muted" />
                  <span className="text-text-muted min-w-[120px]">Start Date:</span>
                  <span className="font-medium text-white">{formatDate(employee.startDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-text-muted" />
                  <span className="text-text-muted min-w-[120px]">Address:</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.address || ''}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      className="flex-1 px-3 py-1 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none placeholder-white/20"
                      placeholder="123 Street, City"
                    />
                  ) : (
                    <span className="font-medium text-white">{employee.address || '-'}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Salary Info */}
          <div className="bg-gradient-to-r from-green-600/80 to-emerald-600/80 backdrop-blur-md rounded-2xl shadow-lg p-6 text-white border border-white/10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <DollarSign size={24} />
              Salary Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-black/20 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-sm opacity-90">Base Salary</p>
                <p className="text-2xl font-bold">
                  {statistics.baseSalary > 0
                    ? formatCurrency(statistics.baseSalary, 'VND')
                    : formatCurrency(statistics.baseSalaryUSD, 'USD')}
                </p>
              </div>
              <div className="bg-black/20 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-sm opacity-90">Salary Percentage</p>
                <p className="text-2xl font-bold">{statistics.salaryPercentage}%</p>
              </div>
              <div className="bg-black/20 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-sm opacity-90">Actual Salary</p>
                <p className="text-2xl font-bold">
                  {statistics.actualSalary > 0
                    ? formatCurrency(statistics.actualSalary, 'VND')
                    : formatCurrency(statistics.actualSalaryUSD, 'USD')}
                </p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-4 border border-white/10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Month</label>
                <input
                  type="month"
                  value={filters.month}
                  onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                  className="w-full px-3 py-2 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Filter Type</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  className="w-full px-3 py-2 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none"
                >
                  <option value="all" className="bg-surface text-white">All Days</option>
                  <option value="ontime" className="bg-surface text-white">On Time Only</option>
                  <option value="late" className="bg-surface text-white">Late Only</option>
                  <option value="absent" className="bg-surface text-white">Absent Only</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setFilters({ month: new Date().toISOString().slice(0, 7), type: 'all' })}
                  className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Work Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button
              onClick={() => {
                setSelectedMonth(filters.month);
                setShowCalendar(!showCalendar);
              }}
              className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 hover:bg-surface/60 transition cursor-pointer border border-white/10 text-left group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted">Total Days</p>
                  <p className="text-3xl font-bold text-indigo-400 group-hover:text-indigo-300 transition-colors">{statistics.totalDays}</p>
                  <p className="text-xs text-text-muted mt-1">Click to view calendar</p>
                </div>
                <Calendar size={40} className="text-indigo-400/50 group-hover:text-indigo-400 transition-colors" />
              </div>
            </button>

            <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted">Total Hours</p>
                  <p className="text-3xl font-bold text-blue-400">{statistics.totalHours.toFixed(1)}h</p>
                </div>
                <Clock size={40} className="text-blue-400/50" />
              </div>
            </div>

            <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted">Late Sessions</p>
                  <p className="text-3xl font-bold text-yellow-400">{statistics.lateRecords}</p>
                  <p className="text-xs text-text-muted mt-1">{statistics.totalLateHours.toFixed(1)}h total</p>
                </div>
                <Clock size={40} className="text-yellow-400/50" />
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedOTMonth(filters.month);
                setShowOTCalendar(!showOTCalendar);
              }}
              className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 hover:bg-surface/60 transition cursor-pointer border border-white/10 text-left group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted">Total OT</p>
                  <p className="text-3xl font-bold text-orange-400 group-hover:text-orange-300 transition-colors">{statistics.totalOvertime.toFixed(1)}h</p>
                  <p className="text-xs text-text-muted mt-1">{statistics.otSessions} sessions - Click to view</p>
                </div>
                <Award size={40} className="text-orange-400/50 group-hover:text-orange-400 transition-colors" />
              </div>
            </button>
          </div>



          {/* Attendance Calendar Modal */}
          {showCalendar && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">Attendance Calendar</h2>
                    <button onClick={() => setShowCalendar(false)} className="text-text-muted hover:text-white transition">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="mb-4">
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="px-3 py-2 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none w-full"
                    />
                  </div>

                  <div className="flex gap-3 mb-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-green-500 rounded"></div>
                      <span className="text-text-muted">On Time</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                      <span className="text-text-muted">Late</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-red-500 rounded"></div>
                      <span className="text-text-muted">Absent</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                      <div key={i} className="text-center font-semibold text-text-muted text-xs py-1">
                        {day}
                      </div>
                    ))}
                    {calendarData.map((cell, index) => (
                      <div
                        key={index}
                        className={`aspect-square flex items-center justify-center rounded text-xs font-medium ${!cell.day
                          ? 'bg-transparent'
                          : cell.status === 'ontime'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-pointer hover:bg-green-500/30'
                            : cell.status === 'late'
                              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 cursor-pointer hover:bg-yellow-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30 cursor-pointer hover:bg-red-500/30'
                          }`}
                        title={cell.record ? `${cell.date}: ${cell.record.totalHours}h worked` : cell.day ? `${cell.date}: Absent` : ''}
                      >
                        {cell.day}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl">
                      <p className="text-lg font-bold text-green-400">{statistics.onTimeRecords}</p>
                      <p className="text-text-muted">On Time</p>
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl">
                      <p className="text-lg font-bold text-yellow-400">{statistics.lateRecords}</p>
                      <p className="text-text-muted">Late</p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                      <p className="text-lg font-bold text-red-400">
                        {calendarData.filter(c => c.status === 'absent').length}
                      </p>
                      <p className="text-text-muted">Absent</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* OT Calendar Modal */}
          {showOTCalendar && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">Overtime Calendar</h2>
                    <button onClick={() => setShowOTCalendar(false)} className="text-text-muted hover:text-white transition">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="mb-4">
                    <input
                      type="month"
                      value={selectedOTMonth}
                      onChange={(e) => setSelectedOTMonth(e.target.value)}
                      className="px-3 py-2 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none w-full"
                    />
                  </div>

                  <div className="flex gap-3 mb-4 text-xs flex-wrap">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-white/10 rounded border border-white/10"></div>
                      <span className="text-text-muted">No OT</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-orange-500/40 rounded border border-orange-500/50"></div>
                      <span className="text-text-muted">1-2h OT</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-orange-500/70 rounded border border-orange-500/80"></div>
                      <span className="text-text-muted">2-4h OT</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-orange-500 rounded border border-orange-600"></div>
                      <span className="text-text-muted">4h+ OT</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                      <div key={i} className="text-center font-semibold text-text-muted text-xs py-1">
                        {day}
                      </div>
                    ))}
                    {otCalendarData.map((cell, index) => {
                      let bgColor = 'bg-transparent';
                      let textColor = 'text-text-muted';
                      let borderColor = 'border-transparent';

                      if (cell.day) {
                        if (cell.otHours === 0) {
                          bgColor = 'bg-white/5';
                          borderColor = 'border-white/10';
                        }
                        else if (cell.otHours <= 2) {
                          bgColor = 'bg-orange-500/40';
                          textColor = 'text-white';
                          borderColor = 'border-orange-500/50';
                        }
                        else if (cell.otHours <= 4) {
                          bgColor = 'bg-orange-500/70';
                          textColor = 'text-white';
                          borderColor = 'border-orange-500/80';
                        }
                        else {
                          bgColor = 'bg-orange-500';
                          textColor = 'text-white';
                          borderColor = 'border-orange-600';
                        }
                      }

                      return (
                        <div
                          key={index}
                          className={`aspect-square flex items-center justify-center rounded text-xs font-medium cursor-pointer hover:opacity-80 border ${bgColor} ${textColor} ${borderColor}`}
                          title={cell.day ? `${cell.date}: ${cell.otHours.toFixed(1)}h OT` : ''}
                        >
                          {cell.day}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl text-center">
                    <p className="text-2xl font-bold text-orange-400">{statistics.totalOvertime.toFixed(1)}h</p>
                    <p className="text-sm text-text-muted">Total OT This Month</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Check-ins */}
          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4">Check-in History (Filtered by Month)</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Hours Worked</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Late Hours</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">WiFi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredCheckins.slice(0, 20).map((checkin) => {
                    const dateStr = checkin.timestamp?.slice(0, 10);
                    const workRecord = dateStr && workRecords[dateStr] ? workRecords[dateStr][employee.id] : null;

                    return (
                      <tr key={checkin.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-sm text-white">{dateStr || '-'}</td>
                        <td className="px-4 py-3 text-sm text-white">{checkin.timestamp ? new Date(checkin.timestamp).toLocaleTimeString('vi-VN') : '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${checkin.type === 'in' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            }`}>
                            {checkin.type === 'in' ? 'Check In' : 'Check Out'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-white">
                          {workRecord ? `${workRecord.totalHours || 0}h` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {workRecord && workRecord.late ? (
                            <span className="text-red-400 font-medium">
                              {workRecord.lateMinutes ? `${workRecord.lateMinutes}min` : 'Late'}
                            </span>
                          ) : (
                            <span className="text-green-400">On Time</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-muted max-w-xs truncate">
                          {checkin.location?.address || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs ${checkin.wifi?.verified ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                            {checkin.wifi?.ssid || 'Unknown'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCheckins.length === 0 && (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-text-muted">
                        No check-in history for selected month
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-text-muted mt-4">
              Showing {filteredCheckins.length} check-ins for {filters.month}
            </p>
          </div>
        </div >
      </div >
    </>
  );
}
