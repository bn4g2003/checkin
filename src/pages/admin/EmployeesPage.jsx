import React, { useEffect, useState, useMemo } from 'react';
import { useToast } from '../../components/ui/useToast.js';
import { getDb } from '../../lib/firebaseClient.js';
import { Plus, Search, X, UserPlus, Users, Edit } from 'lucide-react';

// ==== MODAL giữ nguyên ====
const EmployeeModal = ({ isOpen, onClose, onSave, employee, saving }) => {
  const [form, setForm] = useState({});
  const isEditing = useMemo(() => !!employee, [employee]);

  useEffect(() => {
    if (isOpen) {
      setForm(employee || {
        employeeId: '', fullName: '', department: '', team: '', position: '', branch: '',
        birthday: '', phone: '', email: '', startDate: '', endDate: '', baseSalary: '',
        salaryPercentage: 100, cvURL: '', active: true
      });
    }
  }, [isOpen, employee]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onSave(form, isEditing);
  };

  const renderField = (label, name, type = 'text', placeholder = '', required = false) => (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1">{label}{required && ' *'}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={form[name] || ''}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        disabled={name === 'employeeId' && isEditing}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">{isEditing ? 'Edit Employee' : 'Add New Employee'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSave} className="flex-grow overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderField('Employee ID', 'employeeId', 'text', 'e.g. NV001', true)}
            {renderField('Full Name', 'fullName', 'text', '', true)}
            {renderField('Date of Birth', 'birthday', 'date')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderField('Email', 'email', 'email', 'email@company.com')}
            {renderField('Phone Number', 'phone', 'tel')}
            {renderField('CV Link', 'cvURL', 'url', 'https://...')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderField('Department', 'department')}
            {renderField('Team', 'team')}
            {renderField('Position', 'position')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderField('Branch', 'branch')}
            {renderField('Start Date', 'startDate', 'date')}
            {renderField('End Date', 'endDate', 'date')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderField('Base Salary (VND)', 'baseSalary', 'number', '15000000')}
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
    if (!search) return employees;
    const s = search.toLowerCase();
    return employees.filter(e =>
      e.fullName?.toLowerCase().includes(s) ||
      e.id?.toLowerCase().includes(s) ||
      e.email?.toLowerCase().includes(s) ||
      e.department?.toLowerCase().includes(s)
    );
  }, [search, employees]);

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
    setSaving(true);
    try {
      const { database, ref, set } = await getDb();
      const employeeId = formData.employeeId.toUpperCase();
      const targetRef = ref(database, `employees/${employeeId}`);
      
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
        salaryPercentage: parseInt(formData.salaryPercentage) || 100,
        cvURL: formData.cvURL || null,
        active: formData.active,
        ...(isEditing ? {} : { createdAt: new Date().toISOString() })
      };
      
      await set(targetRef, employeeData);
      addToast({ type: 'success', message: isEditing ? 'Update successful!' : 'Employee added successfully!' });
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
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg shadow-sm hover:bg-red-700 transition-colors duration-200"
          >
            <UserPlus size={18} />
            <span className="hidden sm:inline">Add New</span>
          </button>
        </div>
      </div>

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
      />
    </div>
  );
}
