import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDb } from '../lib/firebaseClient';
import { Clock, Calendar, FileText, Send, CheckCircle, XCircle, AlertCircle, Filter } from 'lucide-react';
import { useToast } from '../components/ui/useToast';
import EmployeeNavbar from '../components/employee/EmployeeNavbar';

export default function OTRegistrationPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [otRequests, setOtRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [otReasons, setOtReasons] = useState([]);
  const [filters, setFilters] = useState({
    month: new Date().toISOString().slice(0, 7),
    status: 'all' // all, pending, approved, rejected
  });

  const [form, setForm] = useState({
    date: '',
    startTime: '',
    endTime: '',
    reason: '',
    description: ''
  });

  useEffect(() => {
    const storedId = localStorage.getItem('employeeSessionId');
    const storedName = localStorage.getItem('employeeSessionName');

    if (!storedId) {
      addToast({ type: 'error', message: 'Vui lòng đăng nhập' });
      navigate('/employee-login');
      return;
    }

    setEmployeeId(storedId);
    setEmployeeName(storedName || '');
    loadOTRequests(storedId);
    loadOTReasons();
  }, [navigate, addToast]);

  const loadOTReasons = async () => {
    try {
      const { database, ref, onValue } = await getDb();
      const reasonsRef = ref(database, 'otReasons');

      onValue(reasonsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const reasonsList = Object.entries(data)
            .map(([id, value]) => ({ id, ...value }))
            .filter(r => r.active !== false)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          setOtReasons(reasonsList);
        } else {
          // Default reasons if none configured
          setOtReasons([
            { id: 'default1', name: 'Urgent Project' },
            { id: 'default2', name: 'Tight Deadline' },
            { id: 'default3', name: 'Team Support' },
            { id: 'default4', name: 'Backlog Work' },
            { id: 'default5', name: 'Other' }
          ]);
        }
      });
    } catch (error) {
      console.error('Error loading OT reasons:', error);
      // Use default reasons on error
      setOtReasons([
        { id: 'default1', name: 'Urgent Project' },
        { id: 'default2', name: 'Tight Deadline' },
        { id: 'default3', name: 'Team Support' },
        { id: 'default4', name: 'Backlog Work' },
        { id: 'default5', name: 'Other' }
      ]);
    }
  };

  const loadOTRequests = async (empId) => {
    try {
      const { database, ref, onValue } = await getDb();
      const otRef = ref(database, 'otRequests');

      onValue(otRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const requests = Object.entries(data)
            .map(([id, value]) => ({ id, ...value }))
            .filter(req => req.employeeId === empId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setOtRequests(requests);
        } else {
          setOtRequests([]);
        }
      });
    } catch (error) {
      console.error('Error loading OT requests:', error);
      addToast({ type: 'error', message: 'Lỗi khi tải danh sách OT' });
    }
  };

  const calculateHours = () => {
    if (!form.startTime || !form.endTime) return 0;

    const [startHour, startMin] = form.startTime.split(':').map(Number);
    const [endHour, endMin] = form.endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const diffMinutes = endMinutes - startMinutes;
    return (diffMinutes / 60).toFixed(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.date || !form.startTime || !form.endTime || !form.reason) {
      addToast({ type: 'error', message: 'Vui lòng điền đầy đủ thông tin' });
      return;
    }

    const hours = parseFloat(calculateHours());
    if (hours <= 0) {
      addToast({ type: 'error', message: 'Thời gian kết thúc phải sau thời gian bắt đầu' });
      return;
    }

    setLoading(true);
    try {
      const { database, ref, push } = await getDb();
      const otRef = ref(database, 'otRequests');

      const otRequest = {
        employeeId,
        employeeName,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        hours,
        reason: form.reason,
        description: form.description || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await push(otRef, otRequest);

      addToast({ type: 'success', message: 'Đăng ký OT thành công!' });

      // Reset form
      setForm({
        date: '',
        startTime: '',
        endTime: '',
        reason: '',
        description: ''
      });
    } catch (error) {
      console.error('Error submitting OT:', error);
      addToast({ type: 'error', message: 'Lỗi khi đăng ký OT' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
      approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' }
    };

    const badge = badges[status] || badges.pending;
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getStatusIcon = (status) => {
    if (status === 'approved') return <CheckCircle size={20} className="text-green-500" />;
    if (status === 'rejected') return <XCircle size={20} className="text-red-500" />;
    return <AlertCircle size={20} className="text-yellow-500" />;
  };

  // Filter and calculate statistics
  const filteredRequests = useMemo(() => {
    let filtered = otRequests;

    // Filter by month
    if (filters.month) {
      filtered = filtered.filter(req => {
        if (!req.date) return false;
        const reqMonth = req.date.slice(0, 7);
        return reqMonth === filters.month;
      });
    }

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(req => req.status === filters.status);
    }

    return filtered;
  }, [otRequests, filters]);

  const statistics = useMemo(() => {
    const totalSessions = filteredRequests.length;
    const totalHours = filteredRequests.reduce((sum, req) => sum + (parseFloat(req.hours) || 0), 0);
    const approved = filteredRequests.filter(req => req.status === 'approved').length;
    const pending = filteredRequests.filter(req => req.status === 'pending').length;
    const rejected = filteredRequests.filter(req => req.status === 'rejected').length;

    return {
      totalSessions,
      totalHours,
      approved,
      pending,
      rejected
    };
  }, [filteredRequests]);

  return (
    <>
      <EmployeeNavbar />
      <div className="min-h-screen p-4 font-['Poppins']">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-surface/40 backdrop-blur-md rounded-xl shadow-lg p-6 border border-white/10">
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Clock className="text-primary" />
              Overtime (OT) Registration
            </h1>
            <p className="text-text-muted mt-2">Employee: {employeeName} ({employeeId})</p>
          </div>

          {/* Filters */}
          <div className="bg-surface/40 backdrop-blur-md rounded-xl shadow-lg overflow-hidden border border-white/10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  <Calendar size={16} className="inline mr-1" />
                  Month
                </label>
                <input
                  type="month"
                  value={filters.month}
                  onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  <Filter size={16} className="inline mr-1" />
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setFilters({ month: new Date().toISOString().slice(0, 7), status: 'all' })}
                  className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-surface-bright/40 backdrop-blur-md rounded-xl shadow-lg p-4 border border-border-highlight">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted">Total Sessions</p>
                  <p className="text-2xl font-bold text-primary">{statistics.totalSessions}</p>
                </div>
                <FileText size={32} className="text-primary/30" />
              </div>
            </div>
            <div className="bg-surface-bright/40 backdrop-blur-md rounded-xl shadow-lg p-4 border border-border-highlight">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted">Total OT Hours</p>
                  <p className="text-2xl font-bold text-orange-400">{statistics.totalHours.toFixed(1)}h</p>
                </div>
                <Clock size={32} className="text-orange-400/30" />
              </div>
            </div>
            <div className="bg-surface-bright/40 backdrop-blur-md rounded-xl shadow-lg p-4 border border-border-highlight">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted">Approved</p>
                  <p className="text-2xl font-bold text-green-400">{statistics.approved}</p>
                </div>
                <CheckCircle size={32} className="text-green-400/30" />
              </div>
            </div>
            <div className="bg-surface-bright/40 backdrop-blur-md rounded-xl shadow-lg p-4 border border-border-highlight">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted">Pending</p>
                  <p className="text-2xl font-bold text-yellow-400">{statistics.pending}</p>
                </div>
                <AlertCircle size={32} className="text-yellow-400/30" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Registration Form */}
            <div className="bg-surface/40 backdrop-blur-md rounded-xl shadow-lg p-6 border border-white/10">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Send className="text-primary" />
                New OT Registration
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-2">
                    <Calendar size={16} className="inline mr-1" />
                    OT Date *
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">
                      <Clock size={16} className="inline mr-1" />
                      Start Time *
                    </label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">
                      <Clock size={16} className="inline mr-1" />
                      End Time *
                    </label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none"
                      required
                    />
                  </div>
                </div>

                {form.startTime && form.endTime && (
                  <div className="bg-primary/10 p-3 rounded-lg border border-primary/20">
                    <p className="text-sm text-primary">
                      Total OT Hours: <span className="font-bold text-lg">{calculateHours()}h</span>
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-text-muted mb-2">
                    <FileText size={16} className="inline mr-1" />
                    Reason *
                  </label>
                  <select
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none"
                    required
                  >
                    <option value="">-- Select Reason --</option>
                    {otReasons.map((reason) => (
                      <option key={reason.id} value={reason.name}>
                        {reason.name}
                      </option>
                    ))}
                  </select>
                  {otReasons.length === 0 && (
                    <p className="text-xs text-text-muted mt-1">Loading reasons...</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-muted mb-2">
                    Detailed Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none"
                    rows="3"
                    placeholder="Describe the work that requires OT..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/80 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg font-medium"
                >
                  <Send size={18} />
                  {loading ? 'Submitting...' : 'Submit Registration'}
                </button>
              </form>
            </div>

            {/* OT Requests History */}
            <div className="bg-surface/40 backdrop-blur-md rounded-xl shadow-lg p-6 border border-white/10">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <FileText className="text-primary" />
                OT Registration History
              </h2>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredRequests.length === 0 ? (
                  <div className="text-center py-8 text-text-muted">
                    <AlertCircle size={48} className="mx-auto mb-2 text-white/20" />
                    <p>No OT registrations found</p>
                  </div>
                ) : (
                  filteredRequests.map((request) => (
                    <div key={request.id} className="border border-white/10 rounded-xl p-4 hover:bg-white/5 transition bg-background/50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(request.status)}
                          <span className="font-semibold text-white">
                            {new Date(request.date).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>

                      <div className="space-y-1 text-sm text-text-muted">
                        <p>
                          <Clock size={14} className="inline mr-1" />
                          Time: {request.startTime} - {request.endTime} ({request.hours}h)
                        </p>
                        <p>
                          <FileText size={14} className="inline mr-1" />
                          Reason: {request.reason}
                        </p>
                        {request.description && (
                          <p className="text-white/60 italic">"{request.description}"</p>
                        )}
                        {request.approverNote && (
                          <div className="mt-2 p-2 bg-white/5 rounded border border-white/10">
                            <p className="text-xs text-text-muted">Manager's Note:</p>
                            <p className="text-sm text-white">{request.approverNote}</p>
                          </div>
                        )}
                        <p className="text-xs text-white/30 mt-2">
                          Registered at: {new Date(request.createdAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
