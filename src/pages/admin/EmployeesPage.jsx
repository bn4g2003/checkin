import React, { useEffect, useState, useMemo } from 'react';
import { useToast } from '../../components/ui/useToast.js';
import { getDb } from '../../lib/firebaseClient.js';
import { Search, X, UserPlus, Edit, Lock, Filter } from 'lucide-react';

// ==== DANH SÁCH LỰA CHỌN NHANH ====
const QUICK_OPTIONS = {
  departments: ['Phát triển phần mềm', 'Kinh doanh', 'Nhân sự', 'Marketing', 'Kế toán', 'Hành chính'],
  branches: ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ'],
  positions: ['Intern', 'Junior', 'Senior', 'Team Lead', 'Manager', 'Director'],
  teams: ['Frontend Team', 'Backend Team', 'Mobile Team', 'DevOps Team', 'QA Team', 'Sales Team']
};

// ==== MODAL CẬP NHẬT ====
const EmployeeModal = ({ isOpen, onClose, onSave, employee, saving, existingIds }) => {
  const [form, setForm] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [currencyType, setCurrencyType] = useState('VND');
  const isEditing = useMemo(() => !!employee, [employee]);

  useEffect(() => {
    if (isOpen) {
      const defaultData = {
        employeeId: '', fullName: '', department: '', team: '', position: '', branch: '',
        birthday: '', phone: '', email: '', startDate: '', endDate: '', 
        baseSalary: '', baseSalaryUSD: '', salaryPercentage: 100, 
        cvURL: '', active: true, password: ''
      };
      
      if (employee) {
        // Khi chỉnh sửa, sử dụng ID hiện tại của nhân viên
        setForm({
          ...employee,
          employeeId: employee.id || employee.employeeId || ''
        });
      } else {
        // Khi tạo mới
        setForm(defaultData);
      }
      
      // Xác định loại tiền tệ dựa trên dữ liệu có sẵn
      const employeeData = employee || defaultData;
      if (employeeData.baseSalaryUSD) {
        setCurrencyType('USD');
      } else {
        setCurrencyType('VND');
      }
    }
  }, [isOpen, employee]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onSave(form, isEditing);
  };

  const renderField = (label, name, type = 'text', placeholder = '', required = false, options = null) => {
    if (options) {
      return (
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">{label}{required && ' *'}</label>
          <div className="relative">
            <input
              type="text"
              list={`${name}-list`}
              placeholder={placeholder}
              value={form[name] || ''}
              onChange={(e) => setForm({ ...form, [name]: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
            />
            <datalist id={`${name}-list`}>
              {options.map(opt => <option key={opt} value={opt} />)}
            </datalist>
          </div>
        </div>
      );
    }
    
    return (
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">{label}{required && ' *'}</label>
        <input
          type={type}
          placeholder={placeholder}
          value={form[name] || ''}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
          disabled={name === 'employeeId' && isEditing}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm disabled:bg-gray-100"
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">{isEditing ? 'Edit Employee' : 'Add New Employee'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSave} className="flex-grow overflow-y-auto p-6 space-y-6">
          {/* Thông tin cơ bản */}
          <div className="border-b pb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Thông tin cơ bản</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Employee ID *</label>
                <input
                  type="text"
                  placeholder="e.g. NV001"
                  value={form.employeeId || ''}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                />
                {isEditing && <p className="text-xs text-amber-600 mt-1">⚠️ Thay đổi ID sẽ tạo nhân viên mới</p>}
              </div>
              {renderField('Full Name', 'fullName', 'text', '', true)}
              {renderField('Date of Birth', 'birthday', 'date')}
            </div>
          </div>

          {/* Liên hệ */}
          <div className="border-b pb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Thông tin liên hệ</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderField('Email', 'email', 'email', 'email@company.com')}
              {renderField('Phone Number', 'phone', 'tel')}
              {renderField('CV Link', 'cvURL', 'url', 'https://...')}
            </div>
          </div>

          {/* Phòng ban & Vị trí */}
          <div className="border-b pb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Phòng ban & Vị trí</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderField('Department', 'department', 'text', 'Chọn hoặc nhập mới', false, QUICK_OPTIONS.departments)}
              {renderField('Branch', 'branch', 'text', 'Chọn hoặc nhập mới', false, QUICK_OPTIONS.branches)}
              {renderField('Position', 'position', 'text', 'Chọn hoặc nhập mới', false, QUICK_OPTIONS.positions)}
              {renderField('Team', 'team', 'text', 'Chọn hoặc nhập mới', false, QUICK_OPTIONS.teams)}
            </div>
          </div>

          {/* Ngày làm việc */}
          <div className="border-b pb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Thời gian làm việc</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderField('Start Date', 'startDate', 'date')}
              {renderField('End Date', 'endDate', 'date')}
            </div>
          </div>

          {/* Lương */}
          <div className="border-b pb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Thông tin lương</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Loại tiền tệ</label>
                <select
                  value={currencyType}
                  onChange={(e) => {
                    setCurrencyType(e.target.value);
                    if (e.target.value === 'VND') {
                      setForm({ ...form, baseSalaryUSD: '' });
                    } else {
                      setForm({ ...form, baseSalary: '' });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                >
                  <option value="VND">VND (₫)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
              
              {currencyType === 'VND' ? (
                renderField('Base Salary (VND)', 'baseSalary', 'number', '15000000')
              ) : (
                renderField('Base Salary (USD)', 'baseSalaryUSD', 'number', '1000')
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Salary Percentage (%)</label>
                <input
                  type="number" min="0" max="100"
                  value={form.salaryPercentage || 100}
                  onChange={(e) => setForm({ ...form, salaryPercentage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Mật khẩu */}
          <div className="border-b pb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Lock size={16} />
              Mật khẩu đăng nhập
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Password {!isEditing && '(Tùy chọn)'}
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isEditing ? 'Để trống nếu không đổi' : 'Nhập mật khẩu'}
                  value={form.password || ''}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  {showPassword ? 'Ẩn' : 'Hiện'} mật khẩu
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {isEditing 
                ? 'Chỉ nhập mật khẩu mới nếu muốn thay đổi. Để trống để giữ nguyên mật khẩu cũ.'
                : 'Mật khẩu sẽ được lưu trực tiếp vào database. Mặc định là "123456" nếu để trống.'}
            </p>
          </div>

          {/* Trạng thái */}
          <div className="flex items-center">
            <input
              id="active" type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
            />
            <label htmlFor="active" className="ml-2 block text-sm text-gray-900">Employee is active</label>
          </div>
        </form>
        <div className="p-4 border-t flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">Cancel</button>
          <button type="submit" onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 disabled:opacity-50">
            {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add Employee')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==== COMPONENT CHÍNH ====
export default function EmployeesPage() {
  const { addToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterDept, setFilterDept] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const unsub = getDb().then(({ database, ref, onValue }) => {
      const employeesRef = ref(database, 'employees');
      return onValue(employeesRef, (snapshot) => {
        const data = snapshot.val();
        const list = data ? Object.entries(data).map(([id, value]) => ({ id, ...value })) : [];
        list.sort((a, b) => a.fullName.localeCompare(b.fullName));
        setEmployees(list);
        setLoading(false);
      });
    }).catch(err => {
      addToast({ type: 'error', message: 'Could not load employee data.' });
      console.error(err);
      setLoading(false);
    });

    return () => { unsub.then(fn => fn && fn()); };
  }, [addToast]);

  const filteredEmployees = useMemo(() => {
    let result = employees;
    
    // Lọc theo search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(e =>
        e.fullName?.toLowerCase().includes(s) ||
        e.id?.toLowerCase().includes(s) ||
        e.email?.toLowerCase().includes(s) ||
        e.department?.toLowerCase().includes(s)
      );
    }
    
    // Lọc theo phòng ban
    if (filterDept) {
      result = result.filter(e => e.department === filterDept);
    }
    
    // Lọc theo chi nhánh
    if (filterBranch) {
      result = result.filter(e => e.branch === filterBranch);
    }
    
    return result;
  }, [search, employees, filterDept, filterBranch]);
  
  // Lấy danh sách ID hiện có
  const existingIds = useMemo(() => employees.map(e => e.id), [employees]);
  
  // Lấy danh sách phòng ban và chi nhánh duy nhất
  const uniqueDepartments = useMemo(() => 
    [...new Set(employees.map(e => e.department).filter(Boolean))].sort(),
    [employees]
  );
  
  const uniqueBranches = useMemo(() => 
    [...new Set(employees.map(e => e.branch).filter(Boolean))].sort(),
    [employees]
  );

  const handleOpenModal = (employee = null) => {
    setEditingEmployee(employee);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setEditingEmployee(null);
    setShowModal(false);
  };

  const handleSave = async (formData, isEditing) => {
    if (!formData.employeeId || !formData.fullName) {
      addToast({ type: 'error', message: 'Employee ID and Full Name are required.' });
      return;
    }
    
    // Kiểm tra ID mới có trùng không (khi tạo mới hoặc đổi ID)
    const newId = formData.employeeId.toUpperCase();
    const oldId = editingEmployee?.id;
    
    if (newId !== oldId && existingIds.includes(newId)) {
      addToast({ type: 'error', message: `Employee ID "${newId}" already exists!` });
      return;
    }
    
    setSaving(true);
    try {
      const { database, ref, set, remove } = await getDb();
      const targetRef = ref(database, `employees/${newId}`);
      
      const employeeData = {
        fullName: formData.fullName,
        department: formData.department || null,
        team: formData.team || null,
        position: formData.position || null,
        branch: formData.branch || null,
        birthday: formData.birthday || null,
        phone: formData.phone || null,
        email: formData.email || null,
        startDate: formData.startDate || new Date().toISOString().split('T')[0],
        endDate: formData.endDate || null,
        baseSalary: parseInt(formData.baseSalary) || 0,
        baseSalaryUSD: parseFloat(formData.baseSalaryUSD) || 0,
        salaryPercentage: parseInt(formData.salaryPercentage) || 100,
        cvURL: formData.cvURL || null,
        active: formData.active,
        ...(isEditing ? {} : { createdAt: new Date().toISOString() })
      };
      
      // Xử lý password - lưu trực tiếp không mã hóa
      if (formData.password && formData.password.trim()) {
        // Có nhập password mới - lưu trực tiếp
        employeeData.password = formData.password.trim();
      } else if (isEditing && editingEmployee?.password) {
        // Đang edit và không nhập password mới - giữ nguyên password cũ
        employeeData.password = editingEmployee.password;
      } else if (!isEditing) {
        // Tạo mới mà không có password - tạo password mặc định
        employeeData.password = '123456';
      }
      
      // Lưu nhân viên mới
      await set(targetRef, employeeData);
      
      // Nếu đổi ID, xóa bản ghi cũ
      if (isEditing && oldId && oldId !== newId) {
        const oldRef = ref(database, `employees/${oldId}`);
        await remove(oldRef);
        addToast({ type: 'success', message: `Employee ID changed from ${oldId} to ${newId}` });
      } else {
        addToast({ type: 'success', message: isEditing ? 'Update successful!' : 'Employee added successfully!' });
      }
      
      handleCloseModal();
    } catch (err) {
      addToast({ type: 'error', message: 'Error saving information.' });
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (emp) => {
    try {
      const { database, ref, update } = await getDb();
      const newStatus = emp.active === false;
      await update(ref(database, `employees/${emp.id}`), { active: newStatus });
      addToast({ type: 'success', message: `Employee ${newStatus ? 'activated' : 'deactivated'}.` });
    } catch {
      addToast({ type: 'error', message: 'Could not change status.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Employee Management</h1>
          <p className="text-gray-500 mt-1">Add, edit, and manage employee information.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-grow">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-sm transition-colors duration-200 ${
              showFilters ? 'bg-red-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter size={18} />
            <span className="hidden sm:inline">Filter</span>
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg shadow-sm hover:bg-red-700 transition-colors duration-200"
          >
            <UserPlus size={18} />
            <span className="hidden sm:inline">Add New</span>
          </button>
        </div>
      </div>

      {/* Bộ lọc nhanh */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phòng ban</label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Tất cả phòng ban</option>
                {uniqueDepartments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Chi nhánh</label>
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Tất cả chi nhánh</option>
                {uniqueBranches.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilterDept('');
                  setFilterBranch('');
                }}
                className="w-full px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table hiển thị danh sách */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full border border-gray-200 text-sm text-gray-700">
          <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-2 border">Employee ID</th>
              <th className="px-4 py-2 border">Full Name</th>
              <th className="px-4 py-2 border">Department</th>
              <th className="px-4 py-2 border">Position</th>
              <th className="px-4 py-2 border">Email</th>
              <th className="px-4 py-2 border">Phone</th>
              <th className="px-4 py-2 border">Status</th>
              <th className="px-4 py-2 border text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="text-center py-6">Loading data...</td></tr>
            ) : filteredEmployees.length === 0 ? (
              <tr><td colSpan="8" className="text-center py-6 text-gray-500">No employees found</td></tr>
            ) : (
              filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2 border">{emp.id}</td>
                  <td className="px-4 py-2 border font-medium">{emp.fullName}</td>
                  <td className="px-4 py-2 border">{emp.department || '-'}</td>
                  <td className="px-4 py-2 border">{emp.position || '-'}</td>
                  <td className="px-4 py-2 border">{emp.email || '-'}</td>
                  <td className="px-4 py-2 border">{emp.phone || '-'}</td>
                  <td className="px-4 py-2 border text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${emp.active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {emp.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2 border text-center">
                    <button
                      onClick={() => handleOpenModal(emp)}
                      className="px-2 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-800 mr-2"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(emp)}
                      className={`px-2 py-1 text-sm rounded ${emp.active !== false ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}
                    >
                      {emp.active !== false ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal thêm/sửa */}
      <EmployeeModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onSave={handleSave}
        employee={editingEmployee}
        saving={saving}
        existingIds={existingIds}
      />
    </div>
  );
}
