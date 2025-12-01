import React, { useState, useEffect, useMemo } from 'react';
import { getDb } from '../../lib/firebaseClient';
import {
  Clock,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Filter,
  Search,
  Settings,
  Plus,
  Edit,
  Trash2,
  Save,
  X
} from 'lucide-react';
import { useToast } from '../../components/ui/useToast';

export default function OTApprovalPage() {
  const { addToast } = useToast();
  const [otRequests, setOtRequests] = useState([]);
  const [employees, setEmployees] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approverNote, setApproverNote] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [showReasonManager, setShowReasonManager] = useState(false);
  const [otReasons, setOtReasons] = useState([]);
  const [newReason, setNewReason] = useState('');
  const [editingReason, setEditingReason] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { database, ref, onValue } = await getDb();

      // Load OT requests
      const otRef = ref(database, 'otRequests');
      onValue(otRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const requests = Object.entries(data)
            .map(([id, value]) => ({ id, ...value }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setOtRequests(requests);
        } else {
          setOtRequests([]);
        }
      });

      // Load employees
      const employeesRef = ref(database, 'employees');
      onValue(employeesRef, (snapshot) => {
        const data = snapshot.val() || {};
        setEmployees(data);
      });

      // Load OT reasons
      const reasonsRef = ref(database, 'otReasons');
      onValue(reasonsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const reasonsList = Object.entries(data)
            .map(([id, value]) => ({ id, ...value }))
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          setOtReasons(reasonsList);
        } else {
          // Default reasons if none exist
          setOtReasons([]);
        }
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      addToast({ type: 'error', message: 'Lỗi khi tải dữ liệu' });
      setLoading(false);
    }
  };

  // Get unique employees
  const uniqueEmployees = useMemo(() => {
    const employeeMap = new Map();
    otRequests.forEach(req => {
      if (req.employeeId && !employeeMap.has(req.employeeId)) {
        employeeMap.set(req.employeeId, {
          id: req.employeeId,
          name: req.employeeName
        });
      }
    });
    return Array.from(employeeMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [otRequests]);

  // Quick filter handler
  const handleQuickFilter = (type) => {
    const now = new Date();
    let from, to;

    switch (type) {
      case 'today':
        from = to = now.toISOString().split('T')[0];
        break;
      case 'thisWeek':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        from = startOfWeek.toISOString().split('T')[0];
        to = now.toISOString().split('T')[0];
        break;
      case 'thisMonth':
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
      case 'lastMonth':
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        break;
      case 'thisYear':
        from = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        to = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
        break;
      default:
        from = to = '';
    }

    setDateFrom(from);
    setDateTo(to);
    setQuickFilter(type);
  };

  const filteredRequests = useMemo(() => {
    let filtered = otRequests;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(req => req.status === filterStatus);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(req =>
        req.employeeName?.toLowerCase().includes(term) ||
        req.employeeId?.toLowerCase().includes(term) ||
        req.reason?.toLowerCase().includes(term)
      );
    }

    // Filter by employee
    if (filterEmployee) {
      filtered = filtered.filter(req => req.employeeId === filterEmployee);
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(req => req.date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter(req => req.date <= dateTo);
    }

    return filtered;
  }, [otRequests, filterStatus, searchTerm, filterEmployee, dateFrom, dateTo]);

  const statistics = useMemo(() => {
    const total = otRequests.length;
    const pending = otRequests.filter(r => r.status === 'pending').length;
    const approved = otRequests.filter(r => r.status === 'approved').length;
    const rejected = otRequests.filter(r => r.status === 'rejected').length;
    const totalHours = otRequests
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + (parseFloat(r.hours) || 0), 0);

    return { total, pending, approved, rejected, totalHours };
  }, [otRequests]);

  const handleApprove = async (requestId) => {
    try {
      const { database, ref, update } = await getDb();
      const otRef = ref(database, `otRequests/${requestId}`);

      await update(otRef, {
        status: 'approved',
        approverNote: approverNote || 'Đã duyệt',
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      addToast({ type: 'success', message: 'Đã duyệt đăng ký OT' });
      setSelectedRequest(null);
      setApproverNote('');
    } catch (error) {
      console.error('Error approving:', error);
      addToast({ type: 'error', message: 'Lỗi khi duyệt OT' });
    }
  };

  const handleReject = async (requestId) => {
    if (!approverNote.trim()) {
      addToast({ type: 'error', message: 'Vui lòng nhập lý do từ chối' });
      return;
    }

    try {
      const { database, ref, update } = await getDb();
      const otRef = ref(database, `otRequests/${requestId}`);

      await update(otRef, {
        status: 'rejected',
        approverNote,
        rejectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      addToast({ type: 'success', message: 'Đã từ chối đăng ký OT' });
      setSelectedRequest(null);
      setApproverNote('');
    } catch (error) {
      console.error('Error rejecting:', error);
      addToast({ type: 'error', message: 'Lỗi khi từ chối OT' });
    }
  };

  // OT Reason Management
  const handleAddReason = async () => {
    if (!newReason.trim()) {
      addToast({ type: 'error', message: 'Please enter a reason' });
      return;
    }

    try {
      const { database, ref, push } = await getDb();
      const reasonsRef = ref(database, 'otReasons');

      await push(reasonsRef, {
        name: newReason.trim(),
        order: otReasons.length,
        active: true,
        createdAt: new Date().toISOString()
      });

      setNewReason('');
      addToast({ type: 'success', message: 'Reason added successfully' });
    } catch (error) {
      console.error('Error adding reason:', error);
      addToast({ type: 'error', message: 'Error adding reason' });
    }
  };

  const handleUpdateReason = async (reasonId, updates) => {
    try {
      const { database, ref, update } = await getDb();
      await update(ref(database, `otReasons/${reasonId}`), updates);
      addToast({ type: 'success', message: 'Reason updated successfully' });
      setEditingReason(null);
    } catch (error) {
      console.error('Error updating reason:', error);
      addToast({ type: 'error', message: 'Error updating reason' });
    }
  };

  const handleDeleteReason = async (reasonId) => {
    if (!confirm('Are you sure you want to delete this reason?')) return;

    try {
      const { database, ref, remove } = await getDb();
      await remove(ref(database, `otReasons/${reasonId}`));
      addToast({ type: 'success', message: 'Reason deleted successfully' });
    } catch (error) {
      console.error('Error deleting reason:', error);
      addToast({ type: 'error', message: 'Error deleting reason' });
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending', icon: AlertCircle },
      approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved', icon: CheckCircle },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected', icon: XCircle }
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${badge.bg} ${badge.text}`}>
        <Icon size={16} />
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-['Poppins']">
      {/* Header */}
      <div className="bg-surface/40 backdrop-blur-md rounded-xl shadow-lg p-6 border-l-4 border-primary border-y border-r border-white/10">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">OT Management</h1>
            <p className="text-text-muted">Approve and manage overtime requests</p>
          </div>
          <button
            onClick={() => setShowReasonManager(!showReasonManager)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition shadow-lg"
          >
            <Settings size={18} />
            Manage Reasons
          </button>
        </div>
      </div>

      {/* OT Reason Manager Modal */}
      {showReasonManager && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-surface border border-white/10 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Manage OT Reasons</h2>
                <button
                  onClick={() => setShowReasonManager(false)}
                  className="text-text-muted hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Add New Reason */}
              <div className="mb-6 p-4 bg-surface-bright rounded-lg border border-border-highlight">
                <h3 className="text-sm font-semibold text-white mb-3">Add New Reason</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    placeholder="Enter new OT reason..."
                    className="flex-1 px-3 py-2 bg-background border border-border-highlight rounded-md text-white focus:ring-2 focus:ring-primary/50 outline-none"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddReason()}
                  />
                  <button
                    onClick={handleAddReason}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/80 transition-colors"
                  >
                    <Plus size={18} />
                    Add
                  </button>
                </div>
              </div>

              {/* Reasons List */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-text-muted mb-3">
                  Current Reasons ({otReasons.length})
                </h3>
                {otReasons.length === 0 ? (
                  <p className="text-text-muted text-center py-8">No reasons configured yet</p>
                ) : (
                  otReasons.map((reason, index) => (
                    <div key={reason.id} className="flex items-center gap-2 p-3 bg-white/5 rounded-lg hover:bg-white/10 border border-white/5 transition-colors">
                      <span className="w-8 h-8 flex items-center justify-center bg-primary/20 text-primary rounded-full text-sm font-bold">
                        {index + 1}
                      </span>

                      {editingReason === reason.id ? (
                        <>
                          <input
                            type="text"
                            defaultValue={reason.name}
                            onBlur={(e) => {
                              if (e.target.value.trim() && e.target.value !== reason.name) {
                                handleUpdateReason(reason.id, { name: e.target.value.trim() });
                              } else {
                                setEditingReason(null);
                              }
                            }}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.target.blur();
                              }
                            }}
                            className="flex-1 px-3 py-1 bg-background border border-primary rounded-md text-white focus:ring-2 focus:ring-primary/50 outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => setEditingReason(null)}
                            className="p-2 text-text-muted hover:text-white"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 font-medium text-white">{reason.name}</span>
                          <button
                            onClick={() => setEditingReason(reason.id)}
                            className="p-2 text-primary hover:text-primary/80"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteReason(reason.id)}
                            className="p-2 text-red-400 hover:text-red-300"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowReasonManager(false)}
                  className="px-4 py-2 bg-white/10 text-white rounded-md hover:bg-white/20 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-surface-bright rounded-xl shadow-lg p-4 border border-border-highlight">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">Total Requests</p>
              <p className="text-2xl font-bold text-white">{statistics.total}</p>
            </div>
            <FileText size={32} className="text-white/20" />
          </div>
        </div>

        <div className="bg-surface-bright rounded-xl shadow-lg p-4 border border-border-highlight">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">Pending</p>
              <p className="text-2xl font-bold text-yellow-400">{statistics.pending}</p>
            </div>
            <AlertCircle size={32} className="text-yellow-400/30" />
          </div>
        </div>

        <div className="bg-surface-bright rounded-xl shadow-lg p-4 border border-border-highlight">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">Approved</p>
              <p className="text-2xl font-bold text-green-400">{statistics.approved}</p>
            </div>
            <CheckCircle size={32} className="text-green-400/30" />
          </div>
        </div>

        <div className="bg-surface-bright rounded-xl shadow-lg p-4 border border-border-highlight">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">Rejected</p>
              <p className="text-2xl font-bold text-red-400">{statistics.rejected}</p>
            </div>
            <XCircle size={32} className="text-red-400/30" />
          </div>
        </div>

        <div className="bg-surface-bright rounded-xl shadow-lg p-4 border border-border-highlight">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">Total OT Hours</p>
              <p className="text-2xl font-bold text-primary">{statistics.totalHours.toFixed(1)}h</p>
            </div>
            <Clock size={32} className="text-primary/30" />
          </div>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="bg-surface/40 backdrop-blur-md rounded-xl shadow-lg p-4 border border-white/10">
        <h3 className="text-sm font-semibold text-white mb-3">Quick Filters</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'today', label: 'Today' },
            { value: 'thisWeek', label: 'This Week' },
            { value: 'thisMonth', label: 'This Month' },
            { value: 'lastMonth', label: 'Last Month' },
            { value: 'thisYear', label: 'This Year' }
          ].map(filter => (
            <button
              key={filter.value}
              onClick={() => handleQuickFilter(filter.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${quickFilter === filter.value
                ? 'bg-primary text-white shadow-lg'
                : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
                }`}
            >
              {filter.label}
            </button>
          ))}
          <button
            onClick={() => {
              setDateFrom('');
              setDateTo('');
              setQuickFilter('');
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-text-muted hover:bg-white/10 hover:text-white transition-colors"
          >
            Clear Date
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-surface/40 backdrop-blur-md rounded-xl shadow-lg p-4 border border-white/10">
        <h3 className="text-sm font-semibold text-white mb-3">Advanced Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              <Calendar size={16} className="inline mr-1" />
              From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setQuickFilter('');
              }}
              className="w-full px-3 py-2 bg-background border border-white/10 rounded-md text-white focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              <Calendar size={16} className="inline mr-1" />
              To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setQuickFilter('');
              }}
              className="w-full px-3 py-2 bg-background border border-white/10 rounded-md text-white focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              <User size={16} className="inline mr-1" />
              Employee ({uniqueEmployees.length})
            </label>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-white/10 rounded-md text-white focus:ring-2 focus:ring-primary/50 outline-none"
            >
              <option value="">All Employees</option>
              {uniqueEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              <Filter size={16} className="inline mr-1" />
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-white/10 rounded-md text-white focus:ring-2 focus:ring-primary/50 outline-none"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              <Search size={16} className="inline mr-1" />
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Name, ID, reason..."
              className="w-full px-3 py-2 bg-background border border-white/10 rounded-md text-white focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              setFilterStatus('all');
              setSearchTerm('');
              setFilterEmployee('');
              setDateFrom('');
              setDateTo('');
              setQuickFilter('');
            }}
            className="px-4 py-2 text-sm bg-white/10 text-white rounded-md hover:bg-white/20 transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      </div>

      {/* OT Requests Table */}
      <div className="bg-surface/40 backdrop-blur-md rounded-xl shadow-lg overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-surface-bright">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  OT Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Hours
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-transparent">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-text-muted">
                    No OT requests found
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User size={16} className="text-text-muted mr-2" />
                        <div>
                          <div className="text-sm font-medium text-white">{request.employeeName}</div>
                          <div className="text-sm text-text-muted">{request.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-white">
                        <Calendar size={14} className="mr-1 text-text-muted" />
                        {new Date(request.date).toLocaleDateString('vi-VN')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {request.startTime} - {request.endTime}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-primary">{request.hours}h</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-white">{request.reason}</div>
                      {request.description && (
                        <div className="text-xs text-text-muted mt-1">{request.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(request.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {request.status === 'pending' ? (
                        <button
                          onClick={() => {
                            setSelectedRequest(request);
                            setApproverNote('');
                          }}
                          className="text-primary hover:text-primary/80 font-medium transition-colors"
                        >
                          Process
                        </button>
                      ) : (
                        <span className="text-text-muted">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-surface border border-white/10 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Process OT Request</h2>

              <div className="space-y-4 mb-6 text-white">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-text-muted">Employee</p>
                    <p className="font-medium">{selectedRequest.employeeName}</p>
                    <p className="text-sm text-text-muted">{selectedRequest.employeeId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted">OT Date</p>
                    <p className="font-medium">{new Date(selectedRequest.date).toLocaleDateString('vi-VN')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-text-muted">Time</p>
                    <p className="font-medium">{selectedRequest.startTime} - {selectedRequest.endTime}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted">OT Hours</p>
                    <p className="font-medium text-primary text-lg">{selectedRequest.hours}h</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-text-muted">Reason</p>
                  <p className="font-medium">{selectedRequest.reason}</p>
                </div>

                {selectedRequest.description && (
                  <div>
                    <p className="text-sm text-text-muted">Detailed Description</p>
                    <p className="text-white/80">{selectedRequest.description}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-text-muted mb-2">
                    Manager's Note
                  </label>
                  <textarea
                    value={approverNote}
                    onChange={(e) => setApproverNote(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-white"
                    rows="3"
                    placeholder="Enter note (required if rejecting)..."
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleApprove(selectedRequest.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition shadow-lg"
                >
                  <CheckCircle size={18} />
                  Approve
                </button>
                <button
                  onClick={() => handleReject(selectedRequest.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition shadow-lg"
                >
                  <XCircle size={18} />
                  Reject
                </button>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
