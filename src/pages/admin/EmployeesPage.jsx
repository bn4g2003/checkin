import React, { useEffect, useState, useMemo } from 'react';
import { useToast } from '../../components/ui/useToast.js';
import { getDb } from '../../lib/firebaseClient.js';
import { Search, X, UserPlus, Edit, Lock, Filter, Trash2 } from 'lucide-react';

// ==== DANH SÁCH LỰA CHỌN NHANH ====
const QUICK_OPTIONS = {
  departments: ['Phát triển phần mềm', 'Kinh doanh', 'Nhân sự', 'Marketing', 'Kế toán', 'Hành chính'],
  branches: ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ'],
  positions: ['Intern', 'Probationary Employee', 'Official Employee'],
  teams: ['Frontend Team', 'Backend Team', 'Mobile Team', 'DevOps Team', 'QA Team', 'Sales Team'],
  employmentStatus: ['Nhân viên học việc', 'Nhân viên thử việc', 'Nhân viên chính thức'],
  countries: ['Vietnam', 'Cambodia', 'Malaysia', 'Myanmar', 'Thailand'],
  maritalStatus: ['Single', 'Married']
};

// ==== MODAL CẬP NHẬT ====
const EmployeeModal = ({ isOpen, onClose, onSave, employee, saving, existingIds, uniqueDepartments, uniqueBranches, uniquePositions, uniqueTeams, uniqueProjects }) => {
  const [form, setForm] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [currencyType, setCurrencyType] = useState('VND');
  const isEditing = useMemo(() => !!employee, [employee]);

  useEffect(() => {
    if (isOpen) {
      const defaultData = {
        employeeId: '', fullName: '', department: '', team: '', position: '', branch: '',
        project: '', address: '', employmentStatus: 'Nhân viên chính thức', country: 'Vietnam', maritalStatus: 'Độc thân', note: '',
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

  const renderField = (label, name, type = 'text', placeholder = '', required = false, options = null, allowCustom = false) => {
    // Nếu có options và cho phép custom (dùng datalist)
    if (options && allowCustom) {
      return (
        <div>
          <label className="block text-sm font-medium text-text-muted mb-1.5">{label}{required && ' *'}</label>
          <input
            type="text"
            list={`${name}-list`}
            placeholder={placeholder}
            value={form[name] || ''}
            onChange={(e) => setForm({ ...form, [name]: e.target.value })}
            className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
            required={required}
          />
          <datalist id={`${name}-list`}>
            {options.map(opt => <option key={opt} value={opt} />)}
          </datalist>
          {options.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">Select from list or enter new</p>
          )}
        </div>
      );
    }

    // Nếu có options nhưng không cho phép custom (dropdown cố định)
    if (options) {
      return (
        <div>
          <label className="block text-sm font-medium text-text-muted mb-1.5">{label}{required && ' *'}</label>
          <select
            value={form[name] || ''}
            onChange={(e) => setForm({ ...form, [name]: e.target.value })}
            className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
            required={required}
          >
            <option value="">-- Select {label} --</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      );
    }

    // Input thông thường
    return (
      <div>
        <label className="block text-sm font-medium text-text-muted mb-1.5">{label}{required && ' *'}</label>
        <input
          type={type}
          placeholder={placeholder}
          value={form[name] || ''}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
          disabled={name === 'employeeId' && isEditing}
          className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col text-text-main">
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <h2 className="text-xl font-bold">{isEditing ? 'Edit Employee' : 'Add New Employee'}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-white transition-colors"><X size={24} /></button>
        </div>
        <form onSubmit={handleSave} className="flex-grow overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Thông tin cơ bản */}
          <div className="border-b border-white/10 pb-6">
            <h3 className="text-base font-semibold text-primary mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1.5">Employee ID *</label>
                <input
                  type="text"
                  placeholder="e.g. NV001"
                  value={form.employeeId || ''}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                />
                {isEditing && <p className="text-xs text-amber-400 mt-1.5">⚠️ Changing ID will create a new employee</p>}
              </div>
              {renderField('Full Name', 'fullName', 'text', '', true)}
              {renderField('Date of Birth', 'birthday', 'date')}
              {renderField('Address', 'address', 'text')}
              {renderField('Country', 'country', 'text', 'Select', false, QUICK_OPTIONS.countries)}
              {renderField('Marital Status', 'maritalStatus', 'text', 'Select', false, QUICK_OPTIONS.maritalStatus)}
            </div>
          </div>

          {/* Liên hệ */}
          <div className="border-b border-white/10 pb-6">
            <h3 className="text-base font-semibold text-primary mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {renderField('Email', 'email', 'email', 'email@company.com')}
              {renderField('Phone Number', 'phone', 'tel')}
              {renderField('CV Link', 'cvURL', 'url', 'https://...')}
            </div>
          </div>

          {/* Phòng ban & Vị trí */}
          <div className="border-b border-white/10 pb-6">
            <h3 className="text-base font-semibold text-primary mb-4">Department & Position</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {renderField('Department', 'department', 'text', 'Select or enter new', false, uniqueDepartments.length > 0 ? uniqueDepartments : QUICK_OPTIONS.departments, true)}
              {renderField('Branch', 'branch', 'text', 'Select or enter new', false, uniqueBranches.length > 0 ? uniqueBranches : QUICK_OPTIONS.branches, true)}
              {renderField('Position', 'position', 'text', 'Select or enter new', false, uniquePositions.length > 0 ? uniquePositions : QUICK_OPTIONS.positions, true)}
              {renderField('Team', 'team', 'text', 'Select or enter new', false, uniqueTeams.length > 0 ? uniqueTeams : QUICK_OPTIONS.teams, true)}
              {renderField('Project', 'project', 'text', 'Select or enter new', false, uniqueProjects.length > 0 ? uniqueProjects : [], true)}
              {renderField('Employment Status', 'employmentStatus', 'text', 'Select', false, QUICK_OPTIONS.employmentStatus)}
            </div>
          </div>

          {/* Ngày làm việc */}
          <div className="border-b border-white/10 pb-6">
            <h3 className="text-base font-semibold text-primary mb-4">Employment Period</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {renderField('Start Date', 'startDate', 'date')}
              {renderField('End Date', 'endDate', 'date')}
            </div>
          </div>

          {/* Lương */}
          <div className="border-b border-white/10 pb-6">
            <h3 className="text-base font-semibold text-primary mb-4">Salary Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1.5">Currency Type</label>
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
                  className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
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
                <label className="block text-sm font-medium text-text-muted mb-1.5">Salary Percentage (%)</label>
                <input
                  type="number" min="0" max="100"
                  value={form.salaryPercentage || 100}
                  onChange={(e) => setForm({ ...form, salaryPercentage: e.target.value })}
                  className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Mật khẩu */}
          <div className="border-b border-white/10 pb-6">
            <h3 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
              <Lock size={16} />
              Login Password
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1.5">
                  Password {!isEditing && '(Optional)'}
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isEditing ? 'Leave blank to keep current' : 'Enter password'}
                  value={form.password || ''}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="px-4 py-2.5 text-sm text-text-muted border border-white/10 rounded-xl hover:bg-white/5 hover:text-white transition-all"
                >
                  {showPassword ? 'Hide' : 'Show'} password
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {isEditing
                ? 'Only enter a new password if you want to change it. Leave blank to keep the current password.'
                : 'Password will be saved directly to database. Default is "123456" if left blank.'}
            </p>
          </div>

          {/* Ghi chú */}
          <div className="border-b border-white/10 pb-6">
            <h3 className="text-base font-semibold text-primary mb-4">Note</h3>
            <textarea
              value={form.note || ''}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
              rows={3}
              placeholder="Enter any additional notes..."
            />
          </div>

          {/* Trạng thái */}
          <div className="flex items-center">
            <input
              id="active" type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-5 w-5 text-primary border-white/10 rounded focus:ring-primary bg-background"
            />
            <label htmlFor="active" className="ml-3 block text-sm text-text-main">Employee is active</label>
          </div>
        </form>
        <div className="p-6 border-t border-white/10 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-medium text-text-main bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all">Cancel</button>
          <button type="submit" onClick={handleSave} disabled={saving} className="px-6 py-2.5 text-sm font-bold text-background bg-primary rounded-full hover:bg-primary/90 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(83,202,253,0.5)]">
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
  const [filterProject, setFilterProject] = useState('');
  const [filters, setFilters] = useState({ position: '' });
  const [showFilters, setShowFilters] = useState(true);

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

    // Lọc theo project
    if (filterProject) {
      result = result.filter(e => e.project === filterProject);
    }

    // Lọc theo phòng ban
    if (filterDept) {
      result = result.filter(e => e.department === filterDept);
    }

    // Lọc theo chi nhánh
    if (filterBranch) {
      result = result.filter(e => e.branch === filterBranch);
    }

    // Lọc theo position
    if (filters.position) {
      result = result.filter(e => e.position === filters.position);
    }

    return result;
  }, [search, employees, filterDept, filterBranch, filterProject, filters.position]);

  // Lấy danh sách ID hiện có
  const existingIds = useMemo(() => employees.map(e => e.id), [employees]);

  // Lấy danh sách phòng ban và chi nhánh duy nhất
  const uniqueDepartments = useMemo(() => {
    let depts = employees.map(e => ({ name: e.department, project: e.project }));

    if (filterProject) {
      depts = depts.filter(d => d.project === filterProject);
    }

    return [...new Set(depts.map(d => d.name).filter(Boolean))].sort();
  }, [employees, filterProject]);

  const uniqueBranches = useMemo(() =>
    [...new Set(employees.map(e => e.branch).filter(Boolean))].sort(),
    [employees]
  );

  const uniquePositions = useMemo(() =>
    [...new Set(employees.map(e => e.position).filter(Boolean))].sort(),
    [employees]
  );

  const uniqueTeams = useMemo(() =>
    [...new Set(employees.map(e => e.team).filter(Boolean))].sort(),
    [employees]
  );

  const uniqueProjects = useMemo(() =>
    [...new Set(employees.map(e => e.project).filter(Boolean))].sort(),
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
        project: formData.project || null,
        address: formData.address || null,
        employmentStatus: formData.employmentStatus || 'Nhân viên chính thức',
        country: formData.country || 'Vietnam',
        maritalStatus: formData.maritalStatus || 'Độc thân',
        note: formData.note || null,
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

  const handleDelete = async (emp) => {
    if (!confirm(`Are you sure you want to delete employee "${emp.fullName}" (${emp.id})?\n\nThis action cannot be undone!`)) {
      return;
    }

    try {
      const { database, ref, remove } = await getDb();
      await remove(ref(database, `employees/${emp.id}`));
      addToast({ type: 'success', message: `Employee "${emp.fullName}" deleted successfully.` });
    } catch (error) {
      console.error('Delete error:', error);
      addToast({ type: 'error', message: 'Could not delete employee.' });
    }
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Employee Management</h1>
          <p className="text-text-muted mt-1">Add, edit, and manage employee information.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-grow">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-surface border border-white/10 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-primary/50 outline-none transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full shadow-lg transition-all duration-200 ${showFilters ? 'bg-primary text-background font-bold' : 'bg-surface text-text-main border border-white/10 hover:bg-white/5'
              }`}
          >
            <Filter size={18} />
            <span className="hidden sm:inline">Filter</span>
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-background font-bold rounded-full shadow-[0_0_15px_rgba(83,202,253,0.5)] hover:bg-primary/90 transition-all duration-200"
          >
            <UserPlus size={18} />
            <span className="hidden sm:inline">Add New</span>
          </button>
        </div>
      </div>

      {/* Bộ lọc nhanh */}
      {showFilters && (
        <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">
                Project ({uniqueProjects.length})
              </label>
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-primary/50 outline-none"
              >
                <option value="">All Projects</option>
                {uniqueProjects.map(proj => {
                  const count = employees.filter(e => e.project === proj).length;
                  return (
                    <option key={proj} value={proj}>{proj} ({count})</option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">
                Department ({uniqueDepartments.length})
              </label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-primary/50 outline-none"
              >
                <option value="">All Departments</option>
                {uniqueDepartments.map(dept => {
                  const count = employees.filter(e => e.department === dept && (!filterProject || e.project === filterProject)).length;
                  return (
                    <option key={dept} value={dept}>{dept} ({count})</option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">
                Branch/Country ({uniqueBranches.length})
              </label>
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-primary/50 outline-none"
              >
                <option value="">All Branches</option>
                {uniqueBranches.map(branch => {
                  const count = employees.filter(e => e.branch === branch).length;
                  return (
                    <option key={branch} value={branch}>{branch} ({count})</option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">
                Position ({uniquePositions.length})
              </label>
              <select
                value={filters.position || ''}
                onChange={(e) => setFilters({ ...filters, position: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-primary/50 outline-none"
              >
                <option value="">All Positions</option>
                {uniquePositions.map(pos => {
                  const count = employees.filter(e => e.position === pos).length;
                  return (
                    <option key={pos} value={pos}>{pos} ({count})</option>
                  );
                })}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilterDept('');
                  setFilterBranch('');
                  setFilterProject('');
                  setFilters({ position: '' });
                }}
                className="w-full px-4 py-2.5 text-sm font-medium text-text-main bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table hiển thị danh sách */}
      <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-text-main">
            <thead className="bg-white/5 text-text-muted uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4 text-left">Employee ID</th>
                <th className="px-6 py-4 text-left">Full Name</th>
                <th className="px-6 py-4 text-left">Department</th>
                <th className="px-6 py-4 text-left">Position</th>
                <th className="px-6 py-4 text-left">Email</th>
                <th className="px-6 py-4 text-left">Phone</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan="8" className="text-center py-8 text-text-muted">Loading data...</td></tr>
              ) : filteredEmployees.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-8 text-text-muted">No employees found</td></tr>
              ) : (
                filteredEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{emp.id}</td>
                    <td className="px-6 py-4 font-medium text-primary">{emp.fullName}</td>
                    <td className="px-6 py-4 text-gray-300">{emp.department || '-'}</td>
                    <td className="px-6 py-4 text-gray-300">{emp.position || '-'}</td>
                    <td className="px-6 py-4 text-gray-300">{emp.email || '-'}</td>
                    <td className="px-6 py-4 text-gray-300">{emp.phone || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${emp.active !== false ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {emp.active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenModal(emp)}
                          className="p-2 bg-white/10 text-white rounded-full hover:bg-primary hover:text-background transition-all"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(emp)}
                          className={`p-2 rounded-full transition-all ${emp.active !== false ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500 hover:text-black' : 'bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-black'}`}
                          title={emp.active !== false ? 'Deactivate' : 'Activate'}
                        >
                          {emp.active !== false ? <Lock size={16} /> : <UserPlus size={16} />}
                        </button>
                        <button
                          onClick={() => handleDelete(emp)}
                          className="p-2 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500 hover:text-white transition-all"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal thêm/sửa */}
      <EmployeeModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onSave={handleSave}
        employee={editingEmployee}
        saving={saving}
        existingIds={existingIds}
        uniqueDepartments={uniqueDepartments}
        uniqueBranches={uniqueBranches}
        uniquePositions={uniquePositions}
        uniqueTeams={uniqueTeams}
        uniqueProjects={uniqueProjects}
      />
    </div>
  );
}
