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
  Search
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

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      addToast({ type: 'error', message: 'Lỗi khi tải dữ liệu' });
      setLoading(false);
    }
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

    return filtered;
  }, [otRequests, filterStatus, searchTerm]);

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

  const getStatusBadge = (status) => {
    const badges = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Chờ duyệt', icon: AlertCircle },
      approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Đã duyệt', icon: CheckCircle },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Từ chối', icon: XCircle }
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-600">
        <h1 className="text-3xl font-bold text-red-800 mb-2">Quản lý OT</h1>
        <p className="text-gray-600">Duyệt và quản lý đăng ký làm thêm giờ</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng đăng ký</p>
              <p className="text-2xl font-bold text-gray-800">{statistics.total}</p>
            </div>
            <FileText size={32} className="text-gray-300" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Chờ duyệt</p>
              <p className="text-2xl font-bold text-yellow-600">{statistics.pending}</p>
            </div>
            <AlertCircle size={32} className="text-yellow-300" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Đã duyệt</p>
              <p className="text-2xl font-bold text-green-600">{statistics.approved}</p>
            </div>
            <CheckCircle size={32} className="text-green-300" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Từ chối</p>
              <p className="text-2xl font-bold text-red-600">{statistics.rejected}</p>
            </div>
            <XCircle size={32} className="text-red-300" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng giờ OT</p>
              <p className="text-2xl font-bold text-indigo-600">{statistics.totalHours.toFixed(1)}h</p>
            </div>
            <Clock size={32} className="text-indigo-300" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter size={16} className="inline mr-1" />
              Trạng thái
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
            >
              <option value="all">Tất cả</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Từ chối</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search size={16} className="inline mr-1" />
              Tìm kiếm
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên, ID, lý do..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
      </div>

      {/* OT Requests Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nhân viên
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ngày OT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thời gian
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Số giờ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lý do
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    Không có đăng ký OT nào
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User size={16} className="text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{request.employeeName}</div>
                          <div className="text-sm text-gray-500">{request.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar size={14} className="mr-1" />
                        {new Date(request.date).toLocaleDateString('vi-VN')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.startTime} - {request.endTime}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-indigo-600">{request.hours}h</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{request.reason}</div>
                      {request.description && (
                        <div className="text-xs text-gray-500 mt-1">{request.description}</div>
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
                          className="text-indigo-600 hover:text-indigo-900 font-medium"
                        >
                          Xử lý
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Xử lý đăng ký OT</h2>

              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Nhân viên</p>
                    <p className="font-medium">{selectedRequest.employeeName}</p>
                    <p className="text-sm text-gray-500">{selectedRequest.employeeId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Ngày OT</p>
                    <p className="font-medium">{new Date(selectedRequest.date).toLocaleDateString('vi-VN')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Thời gian</p>
                    <p className="font-medium">{selectedRequest.startTime} - {selectedRequest.endTime}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Số giờ OT</p>
                    <p className="font-medium text-indigo-600 text-lg">{selectedRequest.hours}h</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Lý do</p>
                  <p className="font-medium">{selectedRequest.reason}</p>
                </div>

                {selectedRequest.description && (
                  <div>
                    <p className="text-sm text-gray-600">Mô tả chi tiết</p>
                    <p className="text-gray-700">{selectedRequest.description}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ghi chú của quản lý
                  </label>
                  <textarea
                    value={approverNote}
                    onChange={(e) => setApproverNote(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    rows="3"
                    placeholder="Nhập ghi chú (bắt buộc nếu từ chối)..."
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleApprove(selectedRequest.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                >
                  <CheckCircle size={18} />
                  Duyệt
                </button>
                <button
                  onClick={() => handleReject(selectedRequest.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                >
                  <XCircle size={18} />
                  Từ chối
                </button>
                <button
                  onClick={() => {
                    setSelectedRequest(null);
                    setApproverNote('');
                  }}
                  className="px-4 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
