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

// Map các tên chi nhánh về vùng miền chuẩn của Việt Nam
const VIETNAM_REGION_MAP = {
  // Miền Bắc
  'Hà Nội': 'Northern Vietnam',
  'Ha Noi': 'Northern Vietnam',
  'Hanoi': 'Northern Vietnam',
  'HN': 'Northern Vietnam',
  'Hải Phòng': 'Northern Vietnam',
  'Hai Phong': 'Northern Vietnam',
  'Haiphong': 'Northern Vietnam',
  'HP': 'Northern Vietnam',
  'Quảng Ninh': 'Northern Vietnam',
  'Quang Ninh': 'Northern Vietnam',
  'Hải Dương': 'Northern Vietnam',
  'Hai Duong': 'Northern Vietnam',
  'Bắc Ninh': 'Northern Vietnam',
  'Bac Ninh': 'Northern Vietnam',
  'Thái Nguyên': 'Northern Vietnam',
  'Thai Nguyen': 'Northern Vietnam',
  'Vĩnh Phúc': 'Northern Vietnam',
  'Vinh Phuc': 'Northern Vietnam',
  'Nam Định': 'Northern Vietnam',
  'Nam Dinh': 'Northern Vietnam',
  'Ninh Bình': 'Northern Vietnam',
  'Ninh Binh': 'Northern Vietnam',

  // Miền Trung
  'Đà Nẵng': 'Central Vietnam',
  'Da Nang': 'Central Vietnam',
  'Danang': 'Central Vietnam',
  'DN': 'Central Vietnam',
  'Huế': 'Central Vietnam',
  'Hue': 'Central Vietnam',
  'Thừa Thiên Huế': 'Central Vietnam',
  'Thua Thien Hue': 'Central Vietnam',
  'Quảng Nam': 'Central Vietnam',
  'Quang Nam': 'Central Vietnam',
  'Quảng Ngãi': 'Central Vietnam',
  'Quang Ngai': 'Central Vietnam',
  'Bình Định': 'Central Vietnam',
  'Binh Dinh': 'Central Vietnam',
  'Phú Yên': 'Central Vietnam',
  'Phu Yen': 'Central Vietnam',
  'Khánh Hòa': 'Central Vietnam',
  'Khanh Hoa': 'Central Vietnam',
  'Nha Trang': 'Central Vietnam',
  'Nghệ An': 'Central Vietnam',
  'Nghe An': 'Central Vietnam',
  'Hà Tĩnh': 'Central Vietnam',
  'Ha Tinh': 'Central Vietnam',
  'Quảng Bình': 'Central Vietnam',
  'Quang Binh': 'Central Vietnam',
  'Quảng Trị': 'Central Vietnam',
  'Quang Tri': 'Central Vietnam',

  // Miền Nam
  'Hồ Chí Minh': 'Southern Vietnam',
  'Ho Chi Minh': 'Southern Vietnam',
  'HCMC': 'Southern Vietnam',
  'HCM': 'Southern Vietnam',
  'Sài Gòn': 'Southern Vietnam',
  'Saigon': 'Southern Vietnam',
  'SG': 'Southern Vietnam',
  'Cần Thơ': 'Southern Vietnam',
  'Can Tho': 'Southern Vietnam',
  'CT': 'Southern Vietnam',
  'Đồng Nai': 'Southern Vietnam',
  'Dong Nai': 'Southern Vietnam',
  'Bình Dương': 'Southern Vietnam',
  'Binh Duong': 'Southern Vietnam',
  'Vũng Tàu': 'Southern Vietnam',
  'Vung Tau': 'Southern Vietnam',
  'Bà Rịa - Vũng Tàu': 'Southern Vietnam',
  'Ba Ria - Vung Tau': 'Southern Vietnam',
  'Long An': 'Southern Vietnam',
  'Tiền Giang': 'Southern Vietnam',
  'Tien Giang': 'Southern Vietnam',
  'Bến Tre': 'Southern Vietnam',
  'Ben Tre': 'Southern Vietnam',
  'Vĩnh Long': 'Southern Vietnam',
  'Vinh Long': 'Southern Vietnam',
  'An Giang': 'Southern Vietnam',
  'Kiên Giang': 'Southern Vietnam',
  'Kien Giang': 'Southern Vietnam',
  'Sóc Trăng': 'Southern Vietnam',
  'Soc Trang': 'Southern Vietnam',
  'Bạc Liêu': 'Southern Vietnam',
  'Bac Lieu': 'Southern Vietnam',
  'Cà Mau': 'Southern Vietnam',
  'Ca Mau': 'Southern Vietnam',
  'Đắk Lắk': 'Southern Vietnam',
  'Dak Lak': 'Southern Vietnam',
  'Lâm Đồng': 'Southern Vietnam',
  'Lam Dong': 'Southern Vietnam',
  'Đà Lạt': 'Southern Vietnam',
  'Da Lat': 'Southern Vietnam',
  'Dalat': 'Southern Vietnam'
};

// Các từ khóa chung cho Việt Nam (không chỉ rõ vùng miền)
const VIETNAM_GENERAL_KEYWORDS = [
  'việt nam', 'vietnam', 'viet nam', 'vn', 'việtnam', 'vietnamese'
];

// Hàm chuẩn hóa tên chi nhánh
const normalizeRegion = (branch) => {
  if (!branch) return 'Other';

  const branchTrimmed = branch.trim();
  const branchLower = branchTrimmed.toLowerCase();

  // Kiểm tra trong map (chính xác)
  if (VIETNAM_REGION_MAP[branchTrimmed]) {
    return VIETNAM_REGION_MAP[branchTrimmed];
  }

  // Kiểm tra trong map (không phân biệt hoa thường)
  for (const [key, value] of Object.entries(VIETNAM_REGION_MAP)) {
    if (key.toLowerCase() === branchLower) {
      return value;
    }
  }

  // Kiểm tra các từ khóa chung "Việt Nam" (không chỉ rõ vùng)
  for (const keyword of VIETNAM_GENERAL_KEYWORDS) {
    if (branchLower === keyword || branchLower.includes(keyword)) {
      return 'Vietnam (Unspecified)';
    }
  }

  // Nếu không tìm thấy, trả về "Other"
  return 'Other';
};

export default function DashboardPage() {
  const [employees, setEmployees] = useState([]);
  const [workRecords, setWorkRecords] = useState({});
  const [checkins, setCheckins] = useState([]);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    branch: '',
    department: '',
    team: '',
    position: ''
  });
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [expandedSeniority, setExpandedSeniority] = useState({
    under1Month: false,
    month1to3: false,
    month3to6: false,
    month6to12: false,
    over12Months: false
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

        // Fetch salary payments (mock data structure - adjust based on your actual database)
        const salaryPaymentsRef = ref(database, 'salaryPayments');
        onValue(salaryPaymentsRef, (snapshot) => {
          const data = snapshot.val();
          const paymentList = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];
          setSalaryPayments(paymentList);
        });

        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Get date range from date pickers
  const getDateRange = useMemo(() => {
    return {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    };
  }, [startDate, endDate]);

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

    // Đếm nhân viên Việt Nam (tất cả các vùng miền + không xác định vùng)
    const vietnamEmployees = filteredEmployees.filter(emp => {
      const region = normalizeRegion(emp.branch);
      return region === 'Northern Vietnam' ||
        region === 'Central Vietnam' ||
        region === 'Southern Vietnam' ||
        region === 'Vietnam (Unspecified)';
    }).length;
    const otherBranches = totalEmployees - vietnamEmployees;

    // Calculate cash flow in time range
    const { startDate, endDate } = getDateRange;
    const filteredPayments = salaryPayments.filter(payment => {
      const paymentDate = new Date(payment.date || payment.timestamp);
      return paymentDate >= startDate && paymentDate <= endDate;
    });

    const totalUSD = filteredPayments
      .filter(p => p.currency === 'USD')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const totalVND = filteredPayments
      .filter(p => p.currency === 'VND')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      vietnamEmployees,
      otherBranches,
      totalUSD,
      totalVND
    };
  }, [filteredEmployees, salaryPayments, getDateRange]);

  // Performance rankings
  const performanceRankings = useMemo(() => {
    const { startDate, endDate } = getDateRange;

    // Calculate on-time performance based on workRecords within time range
    const onTimePerformance = filteredEmployees.map(emp => {
      const employeeRecords = [];

      // Collect work records for this employee within time range
      Object.entries(workRecords).forEach(([date, dayRecords]) => {
        const recordDate = new Date(date);
        if (recordDate >= startDate && recordDate <= endDate && dayRecords[emp.id]) {
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

    // Calculate total hours worked within time range
    const mostHardworking = filteredEmployees.map(emp => {
      const employeeRecords = [];

      Object.entries(workRecords).forEach(([date, dayRecords]) => {
        const recordDate = new Date(date);
        if (recordDate >= startDate && recordDate <= endDate && dayRecords[emp.id]) {
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

    // Calculate overtime within time range
    const overtimeRanking = filteredEmployees.map(emp => {
      const employeeRecords = [];

      Object.entries(workRecords).forEach(([date, dayRecords]) => {
        const recordDate = new Date(date);
        if (recordDate >= startDate && recordDate <= endDate && dayRecords[emp.id]) {
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
  }, [filteredEmployees, workRecords, getDateRange]);

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
    const { startDate, endDate } = getDateRange;

    // Cash flow data for USD
    const cashFlowUSD = {};
    const cashFlowVND = {};

    salaryPayments.forEach(payment => {
      const paymentDate = new Date(payment.date || payment.timestamp);
      if (paymentDate >= startDate && paymentDate <= endDate) {
        const dateStr = paymentDate.toISOString().split('T')[0];

        if (payment.currency === 'USD') {
          cashFlowUSD[dateStr] = (cashFlowUSD[dateStr] || 0) + (payment.amount || 0);
        } else if (payment.currency === 'VND') {
          cashFlowVND[dateStr] = (cashFlowVND[dateStr] || 0) + (payment.amount || 0);
        }
      }
    });

    // Generate date array for the range
    const dates = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sample dates based on date range to avoid too many data points
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    let sampledDates = dates;
    if (daysDiff > 365) {
      sampledDates = dates.filter((_, index) => index % 30 === 0); // Every month
    } else if (daysDiff > 90) {
      sampledDates = dates.filter((_, index) => index % 7 === 0); // Every week
    } else if (daysDiff > 30) {
      sampledDates = dates.filter((_, index) => index % 3 === 0); // Every 3 days
    }

    const cashFlowUSDData = sampledDates.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      return {
        date: date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' }),
        amount: cashFlowUSD[dateStr] || 0
      };
    });

    const cashFlowVNDData = sampledDates.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      return {
        date: date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' }),
        amount: cashFlowVND[dateStr] || 0
      };
    });

    // Attendance rate over time
    const attendanceData = sampledDates.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      const dayWorkRecords = workRecords[dateStr] || {};
      const presentCount = Object.keys(dayWorkRecords).length;
      const totalActive = filteredEmployees.filter(emp => emp.active !== false).length;
      const attendanceRate = totalActive > 0 ? (presentCount / totalActive) * 100 : 0;

      return {
        date: date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' }),
        rate: attendanceRate,
        present: presentCount
      };
    });

    // Late arrivals trend
    const lateArrivalsData = sampledDates.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      const dayWorkRecords = workRecords[dateStr] || {};
      const lateCount = Object.values(dayWorkRecords).filter(record => record.late).length;
      const totalPresent = Object.keys(dayWorkRecords).length;

      return {
        date: date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' }),
        late: lateCount,
        onTime: totalPresent - lateCount
      };
    });

    return {
      cashFlowUSDData,
      cashFlowVNDData,
      attendanceData,
      lateArrivalsData
    };
  }, [filteredEmployees, salaryPayments, workRecords, getDateRange]);

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
          <p className="text-gray-600">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen">
      <div className="max-w-full mx-auto space-y-6">
        {/* Header */}
        <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border-l-4 border-primary">
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-text-muted">Overview and HR statistics</p>
        </div>

        {/* Filters */}
        <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/5">
          <h2 className="text-lg font-semibold text-primary mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Branch</label>
              <select
                value={filters.branch}
                onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">All</option>
                {filterOptions.branches.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Department</label>
              <select
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">All</option>
                {filterOptions.departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Team</label>
              <select
                value={filters.team}
                onChange={(e) => setFilters({ ...filters, team: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">All</option>
                {filterOptions.teams.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Position</label>
              <select
                value={filters.position}
                onChange={(e) => setFilters({ ...filters, position: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">All</option>
                {filterOptions.positions.map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/5">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-primary/10">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-text-muted">Total Employees</p>
                <p className="text-2xl font-bold text-white">{statistics.totalEmployees}</p>
                <p className="text-xs text-green-400 mt-1">
                  {statistics.activeEmployees} active
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/5">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-primary/10">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-text-muted">Vietnamese Employees</p>
                <p className="text-2xl font-bold text-white">{statistics.vietnamEmployees}</p>
                <p className="text-xs text-text-muted mt-1">
                  {statistics.otherBranches} from other branches
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/5">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-500/10">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-text-muted">Cash Flow (USD)</p>
                <p className="text-2xl font-bold text-green-400">${statistics.totalUSD.toLocaleString()}</p>
                <p className="text-xs text-text-muted mt-1">
                  Selected period
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/5">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-500/10">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-text-muted">Cash Flow (VND)</p>
                <p className="text-2xl font-bold text-blue-400">{(statistics.totalVND / 1000000).toFixed(1)}M</p>
                <p className="text-xs text-text-muted mt-1">
                  Selected period
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cash Flow Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cash Flow USD */}
          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/5">
            <h3 className="text-lg font-semibold text-primary mb-4">Cash Flow - USD</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData.cashFlowUSDData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="date" stroke="#B0A8D9" />
                  <YAxis stroke="#B0A8D9" />
                  <Tooltip
                    formatter={(value) => `$${value.toLocaleString()}`}
                    contentStyle={{ backgroundColor: '#3D2C8D', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2} name="USD Amount" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cash Flow VND */}
          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/5">
            <h3 className="text-lg font-semibold text-primary mb-4">Cash Flow - VND</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData.cashFlowVNDData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="date" stroke="#B0A8D9" />
                  <YAxis stroke="#B0A8D9" />
                  <Tooltip
                    formatter={(value) => `${(value / 1000000).toFixed(1)}M VND`}
                    contentStyle={{ backgroundColor: '#3D2C8D', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="amount" stroke="#3B82F6" strokeWidth={2} name="VND Amount" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Attendance and Late Arrivals Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Rate Chart */}
          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/5">
            <h3 className="text-lg font-semibold text-primary mb-4">Attendance Rate Over Time</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData.attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="date" stroke="#B0A8D9" />
                  <YAxis stroke="#B0A8D9" />
                  <Tooltip contentStyle={{ backgroundColor: '#3D2C8D', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                  <Legend />
                  <Line type="monotone" dataKey="rate" stroke="#DC2626" strokeWidth={2} name="Attendance Rate (%)" dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="present" stroke="#10B981" strokeWidth={2} name="Present Count" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Late Arrivals Trend */}
          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/5">
            <h3 className="text-lg font-semibold text-primary mb-4">Late Arrivals vs On-Time</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.lateArrivalsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="date" stroke="#B0A8D9" />
                  <YAxis stroke="#B0A8D9" />
                  <Tooltip contentStyle={{ backgroundColor: '#3D2C8D', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="onTime" stackId="a" fill="#10B981" name="On Time" />
                  <Bar dataKey="late" stackId="a" fill="#EF4444" name="Late" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Performance Rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 5 On Time */}
          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/5">
            <h3 className="text-lg font-semibold text-white mb-4">Top 5 Punctual Employees</h3>
            <div className="space-y-3">
              {performanceRankings.top5OnTime.map((emp, index) => (
                <div key={emp.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                      index === 1 ? 'bg-gray-500/20 text-gray-400' :
                        index === 2 ? 'bg-orange-500/20 text-orange-500' :
                          'bg-blue-500/20 text-blue-500'
                      }`}>
                      {index + 1}
                    </div>
                    <div className="ml-3">
                      <p className="font-medium text-white">{emp.fullName}</p>
                      <p className="text-sm text-text-muted">{emp.position} - {emp.department}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-400">{emp.onTimeRate.toFixed(1)}%</p>
                    <p className="text-xs text-text-muted">{emp.totalRecords} days</p>
                  </div>
                </div>
              ))}
              {performanceRankings.top5OnTime.length === 0 && (
                <p className="text-text-muted text-center py-4">No data</p>
              )}
            </div>
          </div>

          {/* Most Hardworking */}
          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/5">
            <h3 className="text-lg font-semibold text-white mb-4">Top Most Hardworking Employees</h3>
            <div className="space-y-3">
              {performanceRankings.mostHardworking.slice(0, 5).map((emp, index) => (
                <div key={emp.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="ml-3">
                      <p className="font-medium text-white">{emp.fullName}</p>
                      <p className="text-sm text-text-muted">{emp.position} - {emp.department}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-400">{emp.totalHours.toFixed(1)}h</p>
                    <p className="text-xs text-text-muted">average {emp.avgHoursPerDay.toFixed(1)}h/day</p>
                  </div>
                </div>
              ))}
              {performanceRankings.mostHardworking.length === 0 && (
                <p className="text-text-muted text-center py-4">No data</p>
              )}
            </div>
          </div>

          {/* All On Time Performance */}
          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/5">
            <h3 className="text-lg font-semibold text-white mb-4">All Punctual Employees</h3>
            <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {performanceRankings.allOnTime.map((emp, index) => (
                <div key={emp.id} className="flex items-center justify-between p-2 border-b border-white/5 hover:bg-white/5 rounded-lg transition-colors">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-text-muted w-6">{index + 1}.</span>
                    <p className="font-medium text-white ml-2">{emp.fullName}</p>
                  </div>
                  <p className="font-bold text-green-400">{emp.onTimeRate.toFixed(1)}%</p>
                </div>
              ))}
              {performanceRankings.allOnTime.length === 0 && (
                <p className="text-text-muted text-center py-4">No data</p>
              )}
            </div>
          </div>

          {/* All Hardworking Employees */}
          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/5">
            <h3 className="text-lg font-semibold text-white mb-4">All Hardworking Employees</h3>
            <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {performanceRankings.mostHardworking.map((emp, index) => (
                <div key={emp.id} className="flex items-center justify-between p-2 border-b border-white/5 hover:bg-white/5 rounded-lg transition-colors">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-text-muted w-6">{index + 1}.</span>
                    <p className="font-medium text-white ml-2">{emp.fullName}</p>
                  </div>
                  <p className="font-bold text-blue-400">{emp.totalHours.toFixed(1)}h</p>
                </div>
              ))}
              {performanceRankings.mostHardworking.length === 0 && (
                <p className="text-text-muted text-center py-4">No data</p>
              )}
            </div>
          </div>
        </div>

        {/* Birthday and Seniority */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Birthday This Month */}
          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/5">
            <h3 className="text-lg font-semibold text-white mb-4">Birthdays this month</h3>
            {
              birthdayAndSeniority.birthdayThisMonth.length > 0 ? (
                <div className="space-y-3">
                  {birthdayAndSeniority.birthdayThisMonth.map((employee, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-500">
                            {employee.name.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-white">{employee.name}</p>
                          <p className="text-xs text-text-muted">{employee.position} - {employee.branch}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                          🎂 Birthday
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-text-muted text-center py-4">
                  No employees have birthdays this month
                </div>
              )
            }
          </div>

          {/* Seniority Statistics */}
          <div className="bg-surface/40 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-white/5">
            <h3 className="text-lg font-semibold text-white mb-4">Seniority Statistics</h3>
            <div className="space-y-4">
              {/* Under 1 month */}
              <div>
                <div
                  className="flex items-center justify-between p-3 bg-red-500/10 rounded-xl cursor-pointer hover:bg-red-500/20 transition-colors border border-red-500/10"
                  onClick={() => setExpandedSeniority({ ...expandedSeniority, under1Month: !expandedSeniority.under1Month })}
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-red-500">🆕</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-white">Under 1 month</p>
                      <p className="text-xs text-text-muted">New employees</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-red-500">{birthdayAndSeniority.seniorityGroups.under1Month.length}</span>
                    <svg className={`w-5 h-5 text-text-muted transition-transform ${expandedSeniority.under1Month ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {expandedSeniority.under1Month && birthdayAndSeniority.seniorityGroups.under1Month.length > 0 && (
                  <div className="mt-2 ml-4 space-y-1">
                    {birthdayAndSeniority.seniorityGroups.under1Month.map((emp, idx) => (
                      <div key={idx} className="text-sm text-text-muted py-1 px-3 bg-white/5 rounded">
                        {emp.fullName || emp.name} - {emp.position}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 1-3 months */}
              <div>
                <div
                  className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-xl cursor-pointer hover:bg-yellow-500/20 transition-colors border border-yellow-500/10"
                  onClick={() => setExpandedSeniority({ ...expandedSeniority, month1to3: !expandedSeniority.month1to3 })}
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-yellow-500">📈</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-white">1-3 months</p>
                      <p className="text-xs text-text-muted">Adapting</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-yellow-500">{birthdayAndSeniority.seniorityGroups.month1to3.length}</span>
                    <svg className={`w-5 h-5 text-text-muted transition-transform ${expandedSeniority.month1to3 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {expandedSeniority.month1to3 && birthdayAndSeniority.seniorityGroups.month1to3.length > 0 && (
                  <div className="mt-2 ml-4 space-y-1">
                    {birthdayAndSeniority.seniorityGroups.month1to3.map((emp, idx) => (
                      <div key={idx} className="text-sm text-text-muted py-1 px-3 bg-white/5 rounded">
                        {emp.fullName || emp.name} - {emp.position}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3-6 months */}
              <div>
                <div
                  className="flex items-center justify-between p-3 bg-blue-500/10 rounded-xl cursor-pointer hover:bg-blue-500/20 transition-colors border border-blue-500/10"
                  onClick={() => setExpandedSeniority({ ...expandedSeniority, month3to6: !expandedSeniority.month3to6 })}
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-500">⭐</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-white">3-6 months</p>
                      <p className="text-xs text-text-muted">Stable</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-blue-500">{birthdayAndSeniority.seniorityGroups.month3to6.length}</span>
                    <svg className={`w-5 h-5 text-text-muted transition-transform ${expandedSeniority.month3to6 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {expandedSeniority.month3to6 && birthdayAndSeniority.seniorityGroups.month3to6.length > 0 && (
                  <div className="mt-2 ml-4 space-y-1">
                    {birthdayAndSeniority.seniorityGroups.month3to6.map((emp, idx) => (
                      <div key={idx} className="text-sm text-text-muted py-1 px-3 bg-white/5 rounded">
                        {emp.fullName || emp.name} - {emp.position}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 6-12 months */}
              <div>
                <div
                  className="flex items-center justify-between p-3 bg-green-500/10 rounded-xl cursor-pointer hover:bg-green-500/20 transition-colors border border-green-500/10"
                  onClick={() => setExpandedSeniority({ ...expandedSeniority, month6to12: !expandedSeniority.month6to12 })}
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-green-500">💎</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-white">6-12 months</p>
                      <p className="text-xs text-text-muted">Core employees</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-green-500">{birthdayAndSeniority.seniorityGroups.month6to12.length}</span>
                    <svg className={`w-5 h-5 text-text-muted transition-transform ${expandedSeniority.month6to12 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {expandedSeniority.month6to12 && birthdayAndSeniority.seniorityGroups.month6to12.length > 0 && (
                  <div className="mt-2 ml-4 space-y-1">
                    {birthdayAndSeniority.seniorityGroups.month6to12.map((emp, idx) => (
                      <div key={idx} className="text-sm text-text-muted py-1 px-3 bg-white/5 rounded">
                        {emp.fullName || emp.name} - {emp.position}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Over 1 year */}
              <div>
                <div
                  className="flex items-center justify-between p-3 bg-purple-500/10 rounded-xl cursor-pointer hover:bg-purple-500/20 transition-colors border border-purple-500/10"
                  onClick={() => setExpandedSeniority({ ...expandedSeniority, over12Months: !expandedSeniority.over12Months })}
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-purple-500">👑</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-white">Over 1 year</p>
                      <p className="text-xs text-text-muted">Key employees</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-purple-500">{birthdayAndSeniority.seniorityGroups.over12Months.length}</span>
                    <svg className={`w-5 h-5 text-text-muted transition-transform ${expandedSeniority.over12Months ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {expandedSeniority.over12Months && birthdayAndSeniority.seniorityGroups.over12Months.length > 0 && (
                  <div className="mt-2 ml-4 space-y-1">
                    {birthdayAndSeniority.seniorityGroups.over12Months.map((emp, idx) => (
                      <div key={idx} className="text-sm text-text-muted py-1 px-3 bg-white/5 rounded">
                        {emp.fullName || emp.name} - {emp.position}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}