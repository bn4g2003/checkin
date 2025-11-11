import React, { useEffect, useState, useMemo } from 'react';
import { getDb } from '../../lib/firebaseClient.js';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer
} from 'recharts';

export default function DashboardPage() {
  const [employees, setEmployees] = useState([]);
  const [workRecords, setWorkRecords] = useState({});
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    branch: '',
    department: '',
    team: '',
    position: ''
  });

  // Fetch data from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { database, ref, onValue } = await getDb();
        
        // Fetch employees
        const employeesRef = ref(database, 'employees');
        onValue(employeesRef, (snapshot) => {
          const data = snapshot.val();
          const employeeList = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];
          setEmployees(employeeList);
        });

        // Fetch work records
        const workRecordsRef = ref(database, 'workRecords');
        onValue(workRecordsRef, (snapshot) => {
          const data = snapshot.val();
          setWorkRecords(data || {});
        });

        // Fetch checkins
        const checkinsRef = ref(database, 'checkins');
        onValue(checkinsRef, (snapshot) => {
          const data = snapshot.val();
          const checkinList = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];
          setCheckins(checkinList);
        });

        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter employees based on selected filters
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (filters.branch && emp.branch !== filters.branch) return false;
      if (filters.department && emp.department !== filters.department) return false;
      if (filters.team && emp.team !== filters.team) return false;
      if (filters.position && emp.position !== filters.position) return false;
      return true;
    });
  }, [employees, filters]);

  // Statistics calculations
  const statistics = useMemo(() => {
    const totalEmployees = filteredEmployees.length;
    const activeEmployees = filteredEmployees.filter(emp => emp.active !== false).length;
    const inactiveEmployees = totalEmployees - activeEmployees;
    const vietnamEmployees = filteredEmployees.filter(emp => emp.branch === 'Hà Nội' || emp.branch === 'Hồ Chí Minh').length;
    const otherBranches = totalEmployees - vietnamEmployees;

    // Calculate today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayCheckins = checkins.filter(checkin => checkin.timestamp.startsWith(today));
    const todayWorkRecords = workRecords[today] || {};
    const employeesCheckedInToday = Object.keys(todayWorkRecords).length;
    const lateEmployeesToday = Object.values(todayWorkRecords).filter(record => record.late).length;

    return { 
      totalEmployees, 
      activeEmployees,
      inactiveEmployees,
      vietnamEmployees, 
      otherBranches,
      employeesCheckedInToday,
      lateEmployeesToday,
      todayCheckins: todayCheckins.length
    };
  }, [filteredEmployees, checkins, workRecords]);

  // Performance rankings
  const performanceRankings = useMemo(() => {
    // Calculate on-time performance based on workRecords
    const onTimePerformance = filteredEmployees.map(emp => {
      const employeeRecords = [];
      
      // Collect all work records for this employee
      Object.values(workRecords).forEach(dayRecords => {
        if (dayRecords[emp.id]) {
          employeeRecords.push(dayRecords[emp.id]);
        }
      });
      
      const totalRecords = employeeRecords.length;
      const onTimeRecords = employeeRecords.filter(record => !record.late).length;
      const onTimeRate = totalRecords > 0 ? (onTimeRecords / totalRecords) * 100 : 0;
      
      return {
        ...emp,
        onTimeRate,
        totalRecords
      };
    }).filter(emp => emp.totalRecords > 0).sort((a, b) => b.onTimeRate - a.onTimeRate);

    // Calculate total hours worked
    const mostHardworking = filteredEmployees.map(emp => {
      const employeeRecords = [];
      
      Object.values(workRecords).forEach(dayRecords => {
        if (dayRecords[emp.id]) {
          employeeRecords.push(dayRecords[emp.id]);
        }
      });
      
      const totalHours = employeeRecords.reduce((sum, record) => sum + (record.totalHours || 0), 0);
      const totalDays = employeeRecords.length;
      const avgHoursPerDay = totalDays > 0 ? totalHours / totalDays : 0;
      
      return {
        ...emp,
        totalHours,
        avgHoursPerDay
      };
    }).filter(emp => emp.totalHours > 0).sort((a, b) => b.totalHours - a.totalHours);

    // Calculate overtime (hours beyond standard 8 hours)
    const overtimeRanking = filteredEmployees.map(emp => {
      const employeeRecords = [];
      
      Object.values(workRecords).forEach(dayRecords => {
        if (dayRecords[emp.id]) {
          employeeRecords.push(dayRecords[emp.id]);
        }
      });
      
      const totalOvertime = employeeRecords.reduce((sum, record) => {
        const overtime = Math.max(0, (record.totalHours || 0) - 8);
        return sum + overtime;
      }, 0);
      
      return {
        ...emp,
        totalOvertime
      };
    }).filter(emp => emp.totalOvertime > 0).sort((a, b) => b.totalOvertime - a.totalOvertime);

    return {
      top5OnTime: onTimePerformance.slice(0, 5),
      allOnTime: onTimePerformance,
      mostHardworking: mostHardworking.slice(0, 10),
      overtimeRanking: overtimeRanking.slice(0, 10)
    };
  }, [filteredEmployees, workRecords]);

  // Birthday and Seniority statistics
  const birthdayAndSeniority = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // Birthday feature - filter employees whose birthday is in the current month
    const birthdayThisMonth = filteredEmployees.filter(emp => {
      if (!emp.birthday) return false;
      const birthday = new Date(emp.birthday);
      return birthday.getMonth() === currentMonth;
    }).map(emp => ({
      name: emp.fullName || emp.name,
      position: emp.position,
      branch: emp.branch,
      birthday: emp.birthday
    }));
    
    // Seniority calculation based on startDate or createdAt field
    const seniorityGroups = {
      under1Month: [],
      month1to3: [],
      month3to6: [],
      month6to12: [],
      over12Months: []
    };
    
    filteredEmployees.forEach(emp => {
      const startDate = emp.startDate ? new Date(emp.startDate) : (emp.createdAt ? new Date(emp.createdAt) : null);
      if (!startDate) return;
      
      const monthsDiff = (currentYear - startDate.getFullYear()) * 12 + (currentMonth - startDate.getMonth());
      
      if (monthsDiff < 1) {
        seniorityGroups.under1Month.push(emp);
      } else if (monthsDiff < 3) {
        seniorityGroups.month1to3.push(emp);
      } else if (monthsDiff < 6) {
        seniorityGroups.month3to6.push(emp);
      } else if (monthsDiff < 12) {
        seniorityGroups.month6to12.push(emp);
      } else {
        seniorityGroups.over12Months.push(emp);
      }
    });
    
    return { birthdayThisMonth, seniorityGroups };
  }, [filteredEmployees]);

  // Chart data calculations
  const chartData = useMemo(() => {
    // Department distribution data
    const departmentData = {};
    filteredEmployees.forEach(emp => {
      if (emp.department) {
        departmentData[emp.department] = (departmentData[emp.department] || 0) + 1;
      }
    });
    const departmentChartData = Object.entries(departmentData).map(([name, value]) => ({
      name,
      value
    }));

    // Branch distribution data for pie chart
    const branchData = {};
    filteredEmployees.forEach(emp => {
      if (emp.branch) {
        branchData[emp.branch] = (branchData[emp.branch] || 0) + 1;
      }
    });
    const branchChartData = Object.entries(branchData).map(([name, value]) => ({
      name,
      value
    }));

    // Check-in trend data (last 7 days)
    const checkinTrendData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayCheckins = checkins.filter(checkin => checkin.timestamp.startsWith(dateStr)).length;
      const dayWorkRecords = Object.keys(workRecords[dateStr] || {}).length;
      
      checkinTrendData.push({
        date: date.toLocaleDateString('vi-VN', { weekday: 'short', month: 'short', day: 'numeric' }),
        checkins: dayCheckins,
        employees: dayWorkRecords
      });
    }

    // Top hardworking employees data
    const topHardworkingData = performanceRankings.mostHardworking.slice(0, 5).map(emp => ({
      name: emp.fullName || emp.name,
      hours: emp.totalHours
    }));

    return {
      departmentChartData,
      branchChartData,
      checkinTrendData,
      topHardworkingData
    };
  }, [filteredEmployees, checkins, workRecords, performanceRankings.mostHardworking]);

  // Get unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    return {
      branches: [...new Set(employees.map(emp => emp.branch).filter(Boolean))],
      departments: [...new Set(employees.map(emp => emp.department).filter(Boolean))],
      teams: [...new Set(employees.map(emp => emp.team).filter(Boolean))],
      positions: [...new Set(employees.map(emp => emp.position).filter(Boolean))]
    };
  }, [employees]);

  // Chart colors
  const COLORS = ['#F87171', '#FBBF24', '#60A5FA', '#EC4899', '#A78BFA', '#34D399', '#FB923C', '#93C5FD'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

    return (
    <div className="p-6">
      <div className="max-w-full mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-600">
          <h1 className="text-3xl font-bold text-red-800 mb-2">Bảng Điều Khiển</h1>
          <p className="text-gray-600">Tổng quan và thống kê nhân sự</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-4">Bộ lọc</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Chi nhánh</label>
              <select
                value={filters.branch}
                onChange={(e) => setFilters({...filters, branch: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Tất cả</option>
                {filterOptions.branches.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phòng ban</label>
              <select
                value={filters.department}
                onChange={(e) => setFilters({...filters, department: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Tất cả</option>
                {filterOptions.departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Team</label>
              <select
                value={filters.team}
                onChange={(e) => setFilters({...filters, team: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Tất cả</option>
                {filterOptions.teams.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vị trí</label>
              <select
                value={filters.position}
                onChange={(e) => setFilters({...filters, position: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Tất cả</option>
                {filterOptions.positions.map(position => (
                  <option key={position} value={position}>{position}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Tổng nhân sự</p>
                <p className="text-2xl font-bold text-red-800">{statistics.totalEmployees}</p>
                <p className="text-xs text-green-600 mt-1">
                  {statistics.activeEmployees} đang hoạt động
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Nhân sự Việt Nam</p>
                <p className="text-2xl font-bold text-red-800">{statistics.vietnamEmployees}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {statistics.otherBranches} nhân sự chi nhánh khác
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Đi làm hôm nay</p>
                <p className="text-2xl font-bold text-red-800">{statistics.employeesCheckedInToday}</p>
                <p className="text-xs text-red-600 mt-1">
                  {statistics.lateEmployeesToday} nhân sự đi trễ
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Check-in hôm nay</p>
                <p className="text-2xl font-bold text-red-800">{statistics.todayCheckins}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {statistics.todayCheckins > 0 ? 'Hoạt động' : 'Chưa có check-in'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Department Distribution Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-red-800 mb-4">Phân bố nhân sự theo Phòng ban</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.departmentChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#DC2626" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Branch Distribution Pie Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-red-800 mb-4">Phân bố nhân sự theo Chi nhánh</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.branchChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#DC2626"
                    dataKey="value"
                  >
                    {chartData.branchChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Check-in Trend Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-red-800 mb-4">Xu hướng Check-in 7 ngày gần đây</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.checkinTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="checkins" stroke="#B91C1C" name="Số lượt check-in" />
                <Line type="monotone" dataKey="employees" stroke="#10B981" name="Số nhân viên làm việc" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Hardworking Employees Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-red-800 mb-4">Top 5 Nhân viên làm việc nhiều nhất</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.topHardworkingData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={150} />
                <Tooltip />
                <Bar dataKey="hours" fill="#B91C1C" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance Rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 5 On Time */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Nhân sự đi làm đúng giờ</h3>
            <div className="space-y-3">
              {performanceRankings.top5OnTime.map((emp, index) => (
                <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-800' :
                      index === 1 ? 'bg-gray-100 text-gray-800' :
                      index === 2 ? 'bg-orange-100 text-orange-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="ml-3">
                      <p className="font-medium text-gray-900">{emp.fullName}</p>
                      <p className="text-sm text-gray-600">{emp.position} - {emp.department}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{emp.onTimeRate.toFixed(1)}%</p>
                    <p className="text-xs text-gray-500">{emp.totalRecords} ngày</p>
                  </div>
                </div>
              ))}
              {performanceRankings.top5OnTime.length === 0 && (
                <p className="text-gray-500 text-center py-4">Không có dữ liệu</p>
              )}
            </div>
          </div>

          {/* Most Hardworking */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Nhân sự chăm chỉ nhất</h3>
            <div className="space-y-3">
              {performanceRankings.mostHardworking.slice(0, 5).map((emp, index) => (
                <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="ml-3">
                      <p className="font-medium text-gray-900">{emp.fullName}</p>
                      <p className="text-sm text-gray-600">{emp.position} - {emp.department}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-600">{emp.totalHours.toFixed(1)}h</p>
                    <p className="text-xs text-gray-500">trung bình {emp.avgHoursPerDay.toFixed(1)}h/ngày</p>
                  </div>
                </div>
              ))}
              {performanceRankings.mostHardworking.length === 0 && (
                <p className="text-gray-500 text-center py-4">Không có dữ liệu</p>
              )}
            </div>
          </div>

          {/* Overtime Ranking */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top OT (Giờ tăng ca)</h3>
            <div className="space-y-3">
              {performanceRankings.overtimeRanking.slice(0, 5).map((emp, index) => (
                <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-red-100 text-red-800 flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="ml-3">
                      <p className="font-medium text-gray-900">{emp.fullName}</p>
                      <p className="text-sm text-gray-600">{emp.position} - {emp.department}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{emp.totalOvertime.toFixed(1)}h</p>
                    <p className="text-xs text-gray-500">tăng ca</p>
                  </div>
                </div>
              ))}
              {performanceRankings.overtimeRanking.length === 0 && (
                <p className="text-gray-500 text-center py-4">Không có dữ liệu</p>
              )}
            </div>
          </div>

          {/* All On Time Performance */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tất cả nhân sự đi làm đúng giờ</h3>
            <div className="max-h-64 overflow-y-auto">
              {performanceRankings.allOnTime.map((emp, index) => (
                <div key={emp.id} className="flex items-center justify-between p-2 border-b border-gray-100">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-600 w-6">{index + 1}.</span>
                    <p className="font-medium text-gray-900 ml-2">{emp.fullName}</p>
                  </div>
                  <p className="font-bold text-green-600">{emp.onTimeRate.toFixed(1)}%</p>
                </div>
              ))}
              {performanceRankings.allOnTime.length === 0 && (
                <p className="text-gray-500 text-center py-4">Không có dữ liệu</p>
              )}
            </div>
          </div>
        </div>

        {/* Birthday and Seniority */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Birthday This Month */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sinh nhật tháng này</h3>
            {birthdayAndSeniority.birthdayThisMonth.length > 0 ? (
              <div className="space-y-3">
                {birthdayAndSeniority.birthdayThisMonth.map((employee, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {employee.name.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{employee.name}</p>
                        <p className="text-xs text-gray-500">{employee.position} - {employee.branch}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        🎂 Sinh nhật
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">
                Không có nhân sự nào sinh nhật trong tháng này
              </div>
            )}
          </div>

          {/* Seniority Statistics */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Thống kê thâm niên</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-red-600">🆕</span>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Dưới 1 tháng</p>
                    <p className="text-xs text-gray-500">Nhân sự mới</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-red-600">{birthdayAndSeniority.seniorityGroups.under1Month.length}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-yellow-600">📈</span>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">1-3 tháng</p>
                    <p className="text-xs text-gray-500">Đang thích nghi</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-yellow-600">{birthdayAndSeniority.seniorityGroups.month1to3.length}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-blue-600">⭐</span>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">3-6 tháng</p>
                    <p className="text-xs text-gray-500">Đã ổn định</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-blue-600">{birthdayAndSeniority.seniorityGroups.month3to6.length}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-green-600">💎</span>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">6-12 tháng</p>
                    <p className="text-xs text-gray-500">Nhân sự cốt cán</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-green-600">{birthdayAndSeniority.seniorityGroups.month6to12.length}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-purple-600">👑</span>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Trên 1 năm</p>
                    <p className="text-xs text-gray-500">Nhân sự chủ chốt</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-purple-600">{birthdayAndSeniority.seniorityGroups.over12Months.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );}