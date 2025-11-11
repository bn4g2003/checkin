import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { getDb } from '../../lib/firebaseClient';
import { Briefcase, Calendar, Clock, Coffee, DollarSign, TrendingUp, User, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

// --- Components ---

const StatCard = ({ icon, label, value, color }) => (
  <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-4">
    <div className={`rounded-full p-3 ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xl font-semibold text-gray-800">{value}</p>
    </div>
  </div>
);

const SalaryTable = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow-sm">
        <Calendar size={48} className="mx-auto text-gray-300" />
        <h3 className="mt-4 text-lg font-medium text-gray-700">Không có dữ liệu lương</h3>
        <p className="mt-1 text-sm text-gray-500">Chưa có bản ghi công việc nào cho tháng đã chọn.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-600 flex items-center gap-2"><User size={16} />Nhân viên</th>
            <th scope="col" className="py-3.5 px-4 text-right text-sm font-semibold text-gray-600">Lương cơ bản</th>
            <th scope="col" className="py-3.5 px-4 text-center text-sm font-semibold text-gray-600">Ngày công</th>
            <th scope="col" className="py-3.5 px-4 text-right text-sm font-semibold text-gray-600">Lương theo ngày</th>
            <th scope="col" className="py-3.5 px-4 text-center text-sm font-semibold text-gray-600">Giờ OT</th>
            <th scope="col" className="py-3.5 px-4 text-right text-sm font-semibold text-gray-600">Lương OT</th>
            <th scope="col" className="py-3.5 px-4 text-center text-sm font-semibold text-gray-600">Ngày CN</th>
            <th scope="col" className="py-3.5 px-4 text-right text-sm font-semibold text-gray-600">Lương CN</th>
            <th scope="col" className="py-3.5 px-4 text-right text-sm font-semibold text-red-600">Tổng lương</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((emp) => (
            <tr key={emp.id} className="hover:bg-gray-50 transition-colors duration-150">
              <td className="whitespace-nowrap py-4 px-4 text-sm">
                <div className="font-medium text-gray-900">{emp.fullName || '—'}</div>
                <div className="text-gray-500">{emp.id}</div>
              </td>
              <td className="whitespace-nowrap py-4 px-4 text-right text-sm text-gray-600">{emp.baseSalary?.toLocaleString() || 0}</td>
              <td className="whitespace-nowrap py-4 px-4 text-center text-sm text-gray-600">{emp.workDays}</td>
              <td className="whitespace-nowrap py-4 px-4 text-right text-sm text-gray-600">{emp.baseSalaryCalculated.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              <td className="whitespace-nowrap py-4 px-4 text-center text-sm text-gray-600">{emp.otHours}</td>
              <td className="whitespace-nowrap py-4 px-4 text-right text-sm text-gray-600">{emp.otSalary.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              <td className="whitespace-nowrap py-4 px-4 text-center text-sm text-gray-600">{emp.sundayWorkDays}</td>
              <td className="whitespace-nowrap py-4 px-4 text-right text-sm text-gray-600">{emp.sundaySalary.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              <td className="whitespace-nowrap py-4 px-4 text-right text-sm font-bold text-red-600">{emp.totalSalary.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-4 animate-pulse">
          <div className="rounded-full bg-gray-200 h-12 w-12"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
    <div className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
      <div className="h-10 bg-gray-200 rounded w-full mb-4"></div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-12 bg-gray-200 rounded w-full mb-2"></div>
      ))}
    </div>
  </div>
);


// --- Main Page Component ---

const SalaryPage = () => {
  const [employees, setEmployees] = useState([]);
  const [workRecords, setWorkRecords] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { database, ref, get } = await getDb();
        const employeesSnapshot = await get(ref(database, 'employees'));
        const workRecordsSnapshot = await get(ref(database, 'workRecords'));

        if (employeesSnapshot.exists()) {
          setEmployees(Object.entries(employeesSnapshot.val()).map(([id, data]) => ({ id, ...data })));
        }
        if (workRecordsSnapshot.exists()) {
          setWorkRecords(workRecordsSnapshot.val());
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };

  const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

  const salaryData = useMemo(() => {
    if (!employees.length || !Object.keys(workRecords).length) return [];

    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = getDaysInMonth(year, month);

    return employees.map((employee) => {
      const baseSalary = Number(employee.baseSalary) || 0;
      const dailyRate = daysInMonth > 0 ? baseSalary / daysInMonth : 0;
      const hourlyRate = dailyRate / 8;

      let workDays = 0;
      let otHours = 0;
      let sundayWorkDays = 0;

      for (const date in workRecords) {
        if (date.startsWith(selectedMonth)) {
          const record = workRecords[date]?.[employee.id];
          if (record) {
            workDays++;
            if (new Date(date).getDay() === 0) sundayWorkDays++;
            otHours += Number(record.otHours || 0);
          }
        }
      }

      const baseSalaryCalculated = dailyRate * workDays;
      const otSalary = otHours * hourlyRate * 1.25;
      const sundaySalary = sundayWorkDays * dailyRate * 1.5;
      const totalSalary = baseSalaryCalculated + otSalary + sundaySalary;

      return {
        ...employee,
        workDays,
        otHours,
        sundayWorkDays,
        baseSalaryCalculated,
        otSalary,
        sundaySalary,
        totalSalary,
      };
    });
  }, [employees, workRecords, selectedMonth]);

  const summaryStats = useMemo(() => {
    const totalEmployees = salaryData.length;
    const totalSalary = salaryData.reduce((sum, emp) => sum + emp.totalSalary, 0);
    const totalWorkDays = salaryData.reduce((sum, emp) => sum + emp.workDays, 0);
    const totalOtHours = salaryData.reduce((sum, emp) => sum + emp.otHours, 0);

    return {
      totalEmployees,
      totalSalary,
      totalWorkDays,
      totalOtHours,
    };
  }, [salaryData]);

  const handleExport = () => {
    const dataToExport = salaryData.map(emp => ({
      'Mã NV': emp.id,
      'Họ và tên': emp.fullName || '—',
      'Lương cơ bản': emp.baseSalary || 0,
      'Ngày công': emp.workDays,
      'Lương theo ngày': emp.baseSalaryCalculated,
      'Giờ OT': emp.otHours,
      'Lương OT': emp.otSalary,
      'Ngày CN': emp.sundayWorkDays,
      'Lương CN': emp.sundaySalary,
      'Tổng lương': emp.totalSalary,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bảng lương');

    // Auto-size columns
    const cols = Object.keys(dataToExport[0] || {});
    const colWidths = cols.map(col => ({
      wch: Math.max(...dataToExport.map(row => row[col]?.toString().length || 10), col.length + 2)
    }));
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `BangLuong_${selectedMonth}.xlsx`);
  };


  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Bảng lương</h1>
          <p className="text-gray-500 mt-1">Tổng quan lương nhân viên cho tháng đã chọn.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg shadow-sm border border-gray-200">
            <label htmlFor="month" className="text-sm font-medium text-gray-600 pl-2">Tháng:</label>
            <input
              type="month"
              id="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              className="p-2 border-none rounded-md focus:ring-2 focus:ring-red-500 outline-none bg-transparent"
            />
          </div>
          <button
            onClick={handleExport}
            disabled={salaryData.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <Download size={18} />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard icon={<DollarSign size={24} className="text-green-600" />} label="Tổng lương chi trả" value={summaryStats.totalSalary.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' ₫'} color="bg-green-100" />
        <StatCard icon={<Briefcase size={24} className="text-blue-600" />} label="Tổng ngày công" value={summaryStats.totalWorkDays} color="bg-blue-100" />
        <StatCard icon={<Clock size={24} className="text-orange-600" />} label="Tổng giờ OT" value={summaryStats.totalOtHours} color="bg-orange-100" />
        <StatCard icon={<TrendingUp size={24} className="text-purple-600" />} label="Lương trung bình" value={(summaryStats.totalEmployees > 0 ? (summaryStats.totalSalary / summaryStats.totalEmployees) : 0).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' ₫'} color="bg-purple-100" />
      </div>

      {/* Salary Table */}
      <SalaryTable data={salaryData} />
    </div>
  );
};

export default SalaryPage;
