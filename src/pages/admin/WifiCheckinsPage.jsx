import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCcw, Wifi, Clock, Trash2, Edit3, Filter } from 'lucide-react';
import { getDb } from '../../lib/firebaseClient.js';
import { computeDailyRecords, computeMonthlySummary, parseTimeToMinutes } from '../../lib/workHours.js';
import { useToast } from '../../components/ui/useToast.js';

// Placeholder for combined WiFi + Checkins + Quản lý giờ làm việc tabs
// Tabs: WiFi | Lịch sử Check-in | Quản lý giờ làm việc
// Stats header: Check-ins hôm nay | WiFi đã cấu hình
export default function WifiCheckinsPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('wifi'); // 'wifi' | 'history' | 'workhours'
  const [wifis, setWifis] = useState([]); // {id,name,publicIP,localIP,createdAt}
  const [checkins, setCheckins] = useState([]);
  const [loadingWifi, setLoadingWifi] = useState(true);
  const [loadingCheckins, setLoadingCheckins] = useState(true);
  const [wifiForm, setWifiForm] = useState({ name: '', publicIP: '', localIP: '' });
  const [editingWifi, setEditingWifi] = useState(null);
  const [status, setStatus] = useState(null);
  const [filters, setFilters] = useState({ date: '', type: '', employee: '', team: '', dateFrom: '', dateTo: '' });
  const [debouncedEmployee, setDebouncedEmployee] = useState('');
  const [page, setPage] = useState(1);
  const [employees, setEmployees] = useState([]);
  const [quickFilter, setQuickFilter] = useState('');
  const [workSettings, setWorkSettings] = useState({
    standardCheckin: '09:00',
    standardCheckout: '18:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    standardHours: 8
  });

  // Auto-calculate standard hours when time settings change
  const calculateStandardHours = (checkin, checkout, lunchStart, lunchEnd) => {
    const checkinMin = parseTimeToMinutes(checkin);
    const checkoutMin = parseTimeToMinutes(checkout);
    const lunchStartMin = parseTimeToMinutes(lunchStart);
    const lunchEndMin = parseTimeToMinutes(lunchEnd);

    if (!checkinMin || !checkoutMin || !lunchStartMin || !lunchEndMin) return 8;

    const totalMinutes = checkoutMin - checkinMin;
    const lunchMinutes = lunchEndMin - lunchStartMin;
    const workMinutes = Math.max(0, totalMinutes - lunchMinutes);

    return +(workMinutes / 60).toFixed(1);
  };

  // Update standard hours whenever time settings change
  React.useEffect(() => {
    const calculatedHours = calculateStandardHours(
      workSettings.standardCheckin,
      workSettings.standardCheckout,
      workSettings.lunchStart,
      workSettings.lunchEnd
    );
    if (calculatedHours !== workSettings.standardHours) {
      setWorkSettings(prev => ({ ...prev, standardHours: calculatedHours }));
    }
  }, [workSettings.standardCheckin, workSettings.standardCheckout, workSettings.lunchStart, workSettings.lunchEnd, workSettings.standardHours]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [dailyRecords, setDailyRecords] = useState([]); // array for today
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [monthlyCache, setMonthlyCache] = useState({}); // { 'YYYY-MM': summaryArray }
  const historyPageSize = 10; // Dedicated page size for history to avoid conflicts
  const [modalPhoto, setModalPhoto] = useState(null); // modal photo state
  const [workHoursFilters, setWorkHoursFilters] = useState({ team: '', employee: '' });
  const [debouncedWorkEmployee, setDebouncedWorkEmployee] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  // Export history (filtered results) to XLSX
  const exportHistoryXLSX = async () => {
    try {
      // Use filtered list if available; fall back to all checkins
      const list = (typeof filteredHistory !== 'undefined' && Array.isArray(filteredHistory) && filteredHistory.length)
        ? filteredHistory
        : checkins;
      if (!list.length) {
        addToast({ type: 'error', message: 'No data to export' });
        return;
      }

      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('CheckinHistory');

      // Header
      const headers = ['Time', 'Employee ID', 'Full Name', 'Type', 'WiFi', 'Public IP', 'Local IP', 'Photo'];
      sheet.addRow(headers);
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF1F5' } }; });

      // Rows with images
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        const rowIndex = i + 2; // +2 because Excel is 1-indexed and we have header row

        sheet.addRow([
          c.timestamp ? new Date(c.timestamp).toLocaleString('en-US') : '',
          (c.employeeId || '').toUpperCase(),
          c.employeeName || '',
          c.type === 'in' ? 'Check-in' : (c.type === 'out' ? 'Check-out' : (c.type || '')),
          c.wifi?.ssid || '',
          c.wifi?.publicIP || '',
          c.wifi?.localIP || '',
          c.photoBase64 ? 'Yes' : 'No'
        ]);

        // Add image if exists
        if (c.photoBase64) {
          try {
            // Detect extension from data URL and embed directly as base64 (browser-safe)
            const match = c.photoBase64.match(/^data:image\/(png|jpeg|jpg);base64,/i);
            const ext = match ? (match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase()) : 'jpeg';
            const imageId = workbook.addImage({
              base64: c.photoBase64,
              extension: ext,
            });
            // Place image in column H
            sheet.addImage(imageId, {
              tl: { col: 7, row: rowIndex - 1 },
              ext: { width: 80, height: 60 },
            });
            sheet.getRow(rowIndex).height = 50;
          } catch (error) {
            console.warn(`Error adding image for row ${rowIndex}:`, error);
          }
        }
      }

      // Width & freeze
      const widths = [22, 10, 22, 10, 18, 16, 16, 15];
      widths.forEach((w, i) => sheet.getColumn(i + 1).width = w);
      sheet.views = [{ state: 'frozen', ySplit: 1 }];

      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `checkins_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast({ type: 'success', message: 'Excel (XLSX) exported with photos' });
    } catch (e) {
      console.error(e);
      addToast({ type: 'error', message: 'Error exporting XLSX' });
    }
  };

  const exportMonthlyXLSX = async () => {
    if (!monthlySummary.length) { addToast({ type: 'error', message: 'No monthly data to export' }); return; }
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('MonthlySummary');

      const headers = ['Employee ID', 'Full Name', 'Days', 'Total Hours', 'Late Count', 'Early Departure Count'];
      sheet.addRow(headers);
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF1F5' } }; });

      monthlySummary.forEach(m => {
        sheet.addRow([
          (m.employeeId || '').toUpperCase(),
          m.employeeName || '',
          m.days || 0,
          m.totalHours || 0,
          m.lateCount || 0,
          m.earlyDepartureCount || 0
        ]);
      });

      const widths = [12, 24, 10, 10, 12, 16];
      widths.forEach((w, i) => sheet.getColumn(i + 1).width = w);
      sheet.views = [{ state: 'frozen', ySplit: 1 }];

      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const monthKey = new Date().toISOString().slice(0, 7);
      a.download = `monthly_summary_${monthKey}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast({ type: 'success', message: 'Excel (XLSX) exported' });
    } catch (e) {
      console.error(e);
      addToast({ type: 'error', message: 'Error exporting XLSX' });
    }
  };

  // load data
  useEffect(() => {
    (async () => {
      try {
        const { database, ref, onValue } = await getDb();
        onValue(ref(database, 'companyWifis'), snap => {
          const data = snap.val();
          const list = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];
          list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setWifis(list);
          setLoadingWifi(false);
        });
        onValue(ref(database, 'checkins'), snap => {
          const data = snap.val();
          const list = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];
          list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setCheckins(list);
          setLoadingCheckins(false);
        });
        // load employees for team filter
        onValue(ref(database, 'employees'), snap => {
          const data = snap.val();
          const list = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];
          setEmployees(list);
        });
        // load work settings
        onValue(ref(database, 'workSettings/global'), snap => {
          const val = snap.val();
          if (val) setWorkSettings(prev => ({ ...prev, ...val }));
        });
      } catch {
        setStatus({ type: 'error', message: 'Could not load data.' });
      }
    })();
  }, []);

  // stats
  const todayStr = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => ({
    todayCheckins: checkins.filter(c => c.timestamp?.slice(0, 10) === todayStr).length,
    wifiCount: wifis.length
  }), [checkins, wifis, todayStr]);

  const refreshCurrentIPs = async () => {
    try {
      const publicIP = await fetch('https://api.ipify.org?format=json').then(r => r.json()).then(j => j.ip).catch(() => '');
      let localIP = '';
      try { localIP = await getLocalIP(); } catch { /* ignore */ }
      setWifiForm(f => ({ ...f, publicIP, localIP }));
    } catch { /* ignore */ }
  };

  const getLocalIP = () => new Promise((resolve, reject) => {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.createOffer().then(o => pc.setLocalDescription(o));
    pc.onicecandidate = (ice) => {
      if (ice && ice.candidate && ice.candidate.candidate) {
        const m = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(ice.candidate.candidate);
        if (m) { resolve(m[1]); pc.close(); }
      }
    };
    setTimeout(() => { pc.close(); reject(); }, 1500);
  });

  const submitWifi = async (e) => {
    e.preventDefault();
    if (!wifiForm.name) { setStatus({ type: 'error', message: 'Missing WiFi name' }); return; }
    try {
      const { database, ref, push, update } = await getDb();
      if (editingWifi) {
        await update(ref(database, `companyWifis/${editingWifi.id}`), {
          name: wifiForm.name,
          publicIP: wifiForm.publicIP || null,
          localIP: wifiForm.localIP || null
        });
        setStatus({ type: 'success', message: 'WiFi updated' });
      } else {
        const listRef = ref(database, 'companyWifis');
        const item = {
          name: wifiForm.name,
          publicIP: wifiForm.publicIP || null,
          localIP: wifiForm.localIP || null,
          createdAt: new Date().toISOString()
        };
        await push(listRef, item);
        setStatus({ type: 'success', message: 'WiFi added' });
      }
      setWifiForm({ name: '', publicIP: '', localIP: '' });
      setEditingWifi(null);
      setTimeout(() => setStatus(null), 2000);
    } catch {
      setStatus({ type: 'error', message: 'Error saving WiFi' });
      addToast({ type: 'error', message: 'Error saving WiFi' });
    }
  };

  const editWifi = (wifi) => {
    setEditingWifi(wifi);
    setWifiForm({ name: wifi.name, publicIP: wifi.publicIP || '', localIP: wifi.localIP || '' });
  };

  const deleteWifi = async (wifi) => {
    if (!confirm('Delete this WiFi?')) return;
    try {
      const { database, ref, remove } = await getDb();
      await remove(ref(database, `companyWifis/${wifi.id}`));
      setStatus({ type: 'success', message: 'Deleted' });
      addToast({ type: 'success', message: 'WiFi deleted successfully' });
      setTimeout(() => setStatus(null), 1500);
    } catch {
      setStatus({ type: 'error', message: 'Could not delete' });
      addToast({ type: 'error', message: 'Could not delete WiFi' });
    }
  };

  // Get unique teams from employees
  const uniqueTeams = useMemo(() => {
    const teams = employees.map(emp => emp.team).filter(Boolean);
    return [...new Set(teams)].sort();
  }, [employees]);

  // Create employee map for quick lookup
  const employeeMap = useMemo(() => {
    const map = {};
    employees.forEach(emp => {
      map[emp.id] = emp;
    });
    return map;
  }, [employees]);

  // Quick filter handler
  const handleQuickFilterHistory = (type) => {
    const now = new Date();
    let from, to;

    switch (type) {
      case 'today':
        from = to = now.toISOString().split('T')[0];
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        from = to = yesterday.toISOString().split('T')[0];
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

    setFilters({ ...filters, dateFrom: from, dateTo: to, date: '' });
    setQuickFilter(type);
    setPage(1);
  };

  // history filters + pagination
  const filteredHistory = useMemo(() => {
    let list = checkins;

    // Single date filter (legacy)
    if (filters.date) {
      const start = new Date(`${filters.date}T00:00:00`);
      const end = new Date(`${filters.date}T23:59:59.999`);
      list = list.filter(c => {
        if (!c.timestamp) return false;
        const ts = new Date(c.timestamp);
        return ts >= start && ts <= end;
      });
    }

    // Date range filter
    if (filters.dateFrom) {
      const start = new Date(`${filters.dateFrom}T00:00:00`);
      list = list.filter(c => {
        if (!c.timestamp) return false;
        const ts = new Date(c.timestamp);
        return ts >= start;
      });
    }
    if (filters.dateTo) {
      const end = new Date(`${filters.dateTo}T23:59:59.999`);
      list = list.filter(c => {
        if (!c.timestamp) return false;
        const ts = new Date(c.timestamp);
        return ts <= end;
      });
    }

    if (filters.type) list = list.filter(c => c.type === filters.type);
    if (debouncedEmployee) {
      const q = debouncedEmployee.toLowerCase();
      list = list.filter(c => c.employeeId?.toLowerCase().includes(q) || c.employeeName?.toLowerCase().includes(q));
    }
    // Filter by team
    if (filters.team) {
      list = list.filter(c => {
        const emp = employeeMap[c.employeeId];
        return emp && emp.team === filters.team;
      });
    }
    return list;
  }, [checkins, filters.date, filters.dateFrom, filters.dateTo, filters.type, debouncedEmployee, filters.team, employeeMap]);
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / historyPageSize));
  const pageHistory = filteredHistory.slice((page - 1) * historyPageSize, page * historyPageSize);
  console.log('DEBUG pagination:', {
    filteredHistoryLength: filteredHistory.length,
    historyPageSize,
    page,
    totalPages,
    pageHistoryLength: pageHistory.length
  });
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);

  // Pagination for other tables (10 per page)
  const commonPageSize = 10;
  // WiFi
  const [wifiPage, setWifiPage] = useState(1);
  const wifiTotalPages = Math.max(1, Math.ceil(wifis.length / commonPageSize));
  const wifiPageList = wifis.slice((wifiPage - 1) * commonPageSize, wifiPage * commonPageSize);
  useEffect(() => { if (wifiPage > wifiTotalPages) setWifiPage(1); }, [wifiTotalPages, wifiPage]);
  // Daily
  const [dailyPage, setDailyPage] = useState(1);
  // Monthly
  const [monthlyPage, setMonthlyPage] = useState(1);

  // debounce employee filter 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedEmployee(filters.employee), 300);
    return () => clearTimeout(t);
  }, [filters.employee]);

  // debounce work hours employee filter 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedWorkEmployee(workHoursFilters.employee), 300);
    return () => clearTimeout(t);
  }, [workHoursFilters.employee]);

  // Compute daily records for selected date when checkins change
  useEffect(() => {
    if (!checkins.length) { setDailyRecords([]); return; }
    const dateCheckins = checkins.filter(c => c.timestamp?.startsWith(selectedDate));
    const map = computeDailyRecords(dateCheckins, workSettings);
    const arr = Object.values(map);
    setDailyRecords(arr);
    // persist to Firebase workRecords/{date}/{employeeId}
    (async () => {
      try {
        const { database, ref, set } = await getDb();
        for (const r of arr) {
          await set(ref(database, `workRecords/${selectedDate}/${r.employeeId}`), r);
        }
      } catch { /* ignore persist errors for now */ }
    })();
  }, [checkins, workSettings, selectedDate]);

  // Compute monthly summary with cache
  useEffect(() => {
    if (!checkins.length) { setMonthlySummary([]); return; }
    const monthKey = new Date().toISOString().slice(0, 7);
    if (monthlyCache[monthKey]) { setMonthlySummary(monthlyCache[monthKey]); return; }
    const summary = computeMonthlySummary(checkins, workSettings, monthKey);
    setMonthlyCache(cache => ({ ...cache, [monthKey]: summary }));
    setMonthlySummary(summary);
  }, [checkins, workSettings, monthlyCache]);

  // Filter daily records
  const filteredDailyRecords = useMemo(() => {
    let list = dailyRecords;

    // Filter by team
    if (workHoursFilters.team) {
      list = list.filter(r => {
        const emp = employeeMap[r.employeeId];
        return emp && emp.team === workHoursFilters.team;
      });
    }

    // Filter by employee
    if (debouncedWorkEmployee) {
      const q = debouncedWorkEmployee.toLowerCase();
      list = list.filter(r =>
        r.employeeId?.toLowerCase().includes(q) ||
        r.employeeName?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [dailyRecords, workHoursFilters.team, debouncedWorkEmployee, employeeMap]);

  // Filter monthly summary
  const filteredMonthlySummary = useMemo(() => {
    let list = monthlySummary;

    // Filter by team
    if (workHoursFilters.team) {
      list = list.filter(r => {
        const emp = employeeMap[r.employeeId];
        return emp && emp.team === workHoursFilters.team;
      });
    }

    // Filter by employee
    if (debouncedWorkEmployee) {
      const q = debouncedWorkEmployee.toLowerCase();
      list = list.filter(r =>
        r.employeeId?.toLowerCase().includes(q) ||
        r.employeeName?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [monthlySummary, workHoursFilters.team, debouncedWorkEmployee, employeeMap]);

  // Calculate summary statistics for daily records
  const dailySummaryStats = useMemo(() => {
    const totalHours = filteredDailyRecords.reduce((sum, r) => sum + (parseFloat(r.totalHours) || 0), 0);
    const totalShortageHours = filteredDailyRecords.reduce((sum, r) => sum + (parseFloat(r.shortageHours) || 0), 0);
    const lateCount = filteredDailyRecords.filter(r => r.late).length;

    return {
      totalHours: totalHours.toFixed(1),
      totalLateHours: totalShortageHours.toFixed(1),
      lateCount,
      employeeCount: filteredDailyRecords.length
    };
  }, [filteredDailyRecords]);

  // Calculate summary statistics for monthly records
  const monthlySummaryStats = useMemo(() => {
    const totalHours = filteredMonthlySummary.reduce((sum, r) => sum + (parseFloat(r.totalHours) || 0), 0);
    const totalDays = filteredMonthlySummary.reduce((sum, r) => sum + (r.days || 0), 0);
    const totalLateCount = filteredMonthlySummary.reduce((sum, r) => sum + (r.lateCount || 0), 0);
    const totalEarlyCount = filteredMonthlySummary.reduce((sum, r) => sum + (r.earlyDepartureCount || 0), 0);

    return {
      totalHours: totalHours.toFixed(1),
      totalDays,
      totalLateCount,
      totalEarlyCount,
      employeeCount: filteredMonthlySummary.length
    };
  }, [filteredMonthlySummary]);

  // Pagination for filtered daily records
  const dailyTotalPages = Math.max(1, Math.ceil(filteredDailyRecords.length / commonPageSize));
  const dailyPageList = filteredDailyRecords.slice((dailyPage - 1) * commonPageSize, dailyPage * commonPageSize);
  useEffect(() => { if (dailyPage > dailyTotalPages) setDailyPage(1); }, [dailyTotalPages, dailyPage]);

  // Pagination for filtered monthly summary
  const monthlyTotalPages = Math.max(1, Math.ceil(filteredMonthlySummary.length / commonPageSize));
  const monthlyPageList = filteredMonthlySummary.slice((monthlyPage - 1) * commonPageSize, monthlyPage * commonPageSize);
  useEffect(() => { if (monthlyPage > monthlyTotalPages) setMonthlyPage(1); }, [monthlyTotalPages, monthlyPage]);

  const saveWorkSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const { database, ref, set } = await getDb();
      await set(ref(database, 'workSettings/global'), workSettings);
      setStatus({ type: 'success', message: 'Work hour settings saved' });
      addToast({ type: 'success', message: 'Work hour settings saved successfully' });
      setTimeout(() => setStatus(null), 2000);
    } catch {
      setStatus({ type: 'error', message: 'Could not save work hour settings' });
      addToast({ type: 'error', message: 'Error saving work hour settings' });
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface/40 backdrop-blur-md border border-white/5 shadow-lg rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Clock className="text-primary" />
              <div>
                <div className="text-sm text-text-muted">Check-ins today</div>
                <div className="text-2xl font-bold text-white">{stats.todayCheckins}</div>
              </div>
            </div>
            <button className="text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors">Refresh</button>
          </div>
          <div className="bg-surface/40 backdrop-blur-md border border-white/5 shadow-lg rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Wifi className="text-green-400" />
              <div>
                <div className="text-sm text-text-muted">Configured WiFi</div>
                <div className="text-2xl font-bold text-white">{stats.wifiCount}</div>
              </div>
            </div>
            <button className="text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 transition-colors">Refresh</button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-2">
          {[
            { id: 'wifi', label: 'Manage WiFi' },
            { id: 'history', label: 'Check-in History' },
            { id: 'workhours', label: 'Manage Work Hours' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === t.id ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'bg-surface border border-white/5 text-text-muted hover:bg-white/10 hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-surface/40 backdrop-blur-md border border-white/5 rounded-2xl shadow-lg p-6 min-h-[300px]">
          {activeTab === 'wifi' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-white">Manage WiFi</h2>
              <form onSubmit={submitWifi} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm bg-surface/30 backdrop-blur-md p-4 rounded-xl border border-white/10">
                <div>
                  <label className="block mb-1 font-medium text-text-muted">WiFi Name *</label>
                  <input value={wifiForm.name} onChange={e => setWifiForm({ ...wifiForm, name: e.target.value })} className="w-full px-3 py-2 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none" />
                </div>
                <div>
                  <label className="block mb-1 font-medium text-text-muted">Public IP</label>
                  <input value={wifiForm.publicIP} onChange={e => setWifiForm({ ...wifiForm, publicIP: e.target.value })} className="w-full px-3 py-2 bg-background/50 border border-white/10 rounded-lg text-white font-mono focus:ring-2 focus:ring-primary/50 outline-none" />
                </div>
                <div>
                  <label className="block mb-1 font-medium text-text-muted">Local IP</label>
                  <input value={wifiForm.localIP} onChange={e => setWifiForm({ ...wifiForm, localIP: e.target.value })} className="w-full px-3 py-2 bg-background/50 border border-white/10 rounded-lg text-white font-mono focus:ring-2 focus:ring-primary/50 outline-none" />
                </div>
                <div className="flex items-end gap-2">
                  <button type="button" onClick={refreshCurrentIPs} className="px-3 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 text-xs transition-colors">Get Current IP</button>
                  <button type="submit" className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 text-xs transition-colors">{editingWifi ? 'Save' : 'Add'}</button>
                  {editingWifi && <button type="button" onClick={() => { setEditingWifi(null); setWifiForm({ name: '', publicIP: '', localIP: '' }); }} className="px-3 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 text-xs transition-colors">Cancel</button>}
                </div>
              </form>
              {status && <div className={`text-sm px-3 py-2 rounded-lg ${status.type === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>{status.message}</div>}
              <div className="overflow-x-auto rounded-xl border border-white/10">
                {loadingWifi ? <div className="text-sm text-text-muted p-4">Loading...</div> : (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-white/5 text-left text-text-muted">
                        <th className="p-3 font-medium">Name</th>
                        <th className="p-3 font-medium">Public IP</th>
                        <th className="p-3 font-medium">Local IP</th>
                        <th className="p-3 font-medium">Created At</th>
                        <th className="p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {wifiPageList.map(w => (
                        <tr key={w.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 font-medium text-white">{w.name}</td>
                          <td className="p-3 font-mono text-xs text-text-muted">{w.publicIP || <span className='text-white/20'>—</span>}</td>
                          <td className="p-3 font-mono text-xs text-text-muted">{w.localIP || <span className='text-white/20'>—</span>}</td>
                          <td className="p-3 text-xs text-text-muted">{w.createdAt ? new Date(w.createdAt).toLocaleString('en-US') : '—'}</td>
                          <td className="p-3 space-x-2 text-xs">
                            <button onClick={() => editWifi(w)} className="text-primary hover:text-primary/80 hover:underline">Edit</button>
                            <button onClick={() => deleteWifi(w)} className="text-red-400 hover:text-red-300 hover:underline">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {!loadingWifi && (
                <div className="flex items-center justify-between mt-3 text-xs text-text-muted">
                  <span>Page {wifiPage} / {wifiTotalPages} (Total {wifis.length})</span>
                  <div className="space-x-2">
                    <button disabled={wifiPage === 1} onClick={() => setWifiPage(p => Math.max(1, p - 1))} className="px-2 py-1 border border-white/10 rounded hover:bg-white/5 disabled:opacity-40 transition-colors">Prev</button>
                    <button disabled={wifiPage === wifiTotalPages} onClick={() => setWifiPage(p => Math.min(wifiTotalPages, p + 1))} className="px-2 py-1 border border-white/10 rounded hover:bg-white/5 disabled:opacity-40 transition-colors">Next</button>
                  </div>
                </div>
              )}
            </div>
          )
          }
          {
            activeTab === 'history' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white">Check-in History</h2>

                {/* Quick Filters */}
                <div className="bg-surface/30 backdrop-blur-md p-3 rounded-xl border border-white/10">
                  <label className="block mb-2 text-xs font-semibold text-text-muted">Quick Filters</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'today', label: 'Today' },
                      { value: 'yesterday', label: 'Yesterday' },
                      { value: 'thisWeek', label: 'This Week' },
                      { value: 'thisMonth', label: 'This Month' },
                      { value: 'lastMonth', label: 'Last Month' },
                      { value: 'thisYear', label: 'This Year' }
                    ].map(filter => (
                      <button
                        key={filter.value}
                        onClick={() => handleQuickFilterHistory(filter.value)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition ${quickFilter === filter.value
                          ? 'bg-primary text-white shadow-lg shadow-primary/25'
                          : 'bg-white/5 text-text-muted border border-white/5 hover:bg-white/10 hover:text-white'
                          }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Advanced Filters */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-xs bg-surface/30 backdrop-blur-md p-3 rounded-xl border border-white/10">
                  <div>
                    <label className="block mb-1 font-medium text-text-muted">From Date</label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={e => {
                        setFilters({ ...filters, dateFrom: e.target.value, date: '' });
                        setQuickFilter('');
                        setPage(1);
                      }}
                      className="w-full px-2 py-1 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-text-muted">To Date</label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={e => {
                        setFilters({ ...filters, dateTo: e.target.value, date: '' });
                        setQuickFilter('');
                        setPage(1);
                      }}
                      className="w-full px-2 py-1 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-text-muted">Type</label>
                    <select value={filters.type} onChange={e => { setFilters({ ...filters, type: e.target.value }); setPage(1); }} className="w-full px-2 py-1 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none">
                      <option value="">All</option>
                      <option value="in">Check-in</option>
                      <option value="out">Check-out</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-text-muted">Team</label>
                    <select value={filters.team} onChange={e => { setFilters({ ...filters, team: e.target.value }); setPage(1); }} className="w-full px-2 py-1 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none">
                      <option value="">All Teams</option>
                      {uniqueTeams.map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-text-muted">Employee</label>
                    <input value={filters.employee} onChange={e => { setFilters({ ...filters, employee: e.target.value }); setPage(1); }} className="w-full px-2 py-1 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none" placeholder="Name or ID" />
                  </div>
                  <div className="flex items-end gap-1">
                    <button onClick={() => { setFilters({ date: '', dateFrom: '', dateTo: '', type: '', employee: '', team: '' }); setQuickFilter(''); setPage(1); }} className="px-3 py-1 bg-white/10 text-white rounded-lg text-xs hover:bg-white/20 transition-colors">Clear</button>
                    <button onClick={exportHistoryXLSX} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 transition-colors">Export</button>
                  </div>
                </div>
                {loadingCheckins ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-8 bg-white/5 animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto hidden md:block rounded-xl border border-white/10">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="bg-white/5 text-left text-text-muted">
                            <th className="p-3">Time</th>
                            <th className="p-3">Employee</th>
                            <th className="p-3">Team</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">WiFi</th>
                            <th className="p-2">Public IP</th>
                            <th className="p-2">Local IP</th>
                            <th className="p-2">Photo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageHistory.map(c => {
                            const emp = employeeMap[c.employeeId];
                            return (
                              <tr key={c.id} className="hover:bg-white/5 transition-colors border-t border-white/5">
                                <td className="p-2 whitespace-nowrap text-white">{c.timestamp ? new Date(c.timestamp).toLocaleString('en-US') : '—'}</td>
                                <td className="p-2 text-white">{c.employeeName} <span className="text-white/50">({c.employeeId})</span></td>
                                <td className="p-2 text-text-muted">{emp?.team || '—'}</td>
                                <td className="p-2 font-medium text-white">{c.type === 'in' ? 'IN' : 'OUT'}</td>
                                <td className="p-2 text-white">{c.wifi?.ssid}</td>
                                <td className="p-2 font-mono text-text-muted">{c.wifi?.publicIP || '—'}</td>
                                <td className="p-2 font-mono text-text-muted">{c.wifi?.localIP || '—'}</td>
                                <td className="p-2">{c.photoBase64 ? <div className='cursor-pointer' onClick={() => setModalPhoto({ src: c.photoBase64, employeeName: c.employeeName, timestamp: c.timestamp })}><img src={c.photoBase64} alt="Check-in Photo" width={50} height={50} className="rounded border border-white/10" /></div> : <span className="text-white/20">—</span>}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Mobile cards */}
                    <div className="md:hidden space-y-3">
                      {pageHistory.map(c => {
                        const emp = employeeMap[c.employeeId];
                        return (
                          <div key={c.id} className="border rounded-lg p-3 bg-gray-50">
                            <div className="text-xs text-gray-500">{c.timestamp ? new Date(c.timestamp).toLocaleString('en-US') : '—'}</div>
                            <div className="font-medium">{c.employeeName} <span className="text-gray-400">({c.employeeId})</span></div>
                            <div className="text-xs">Team: <span className="text-gray-600">{emp?.team || '—'}</span></div>
                            <div className="text-xs">Type: <span className="font-medium">{c.type === 'in' ? 'IN' : 'OUT'}</span></div>
                            <div className="text-xs">WiFi: {c.wifi?.ssid}</div>
                            <div className="text-[11px] font-mono text-gray-600">Public: {c.wifi?.publicIP || '—'} | Local: {c.wifi?.localIP || '—'}</div>
                            <div className="p-2">{c.photoBase64 ? <div className='cursor-pointer' onClick={() => setModalPhoto({ src: c.photoBase64, employeeName: c.employeeName, timestamp: c.timestamp })}><img src={c.photoBase64} alt="Check-in Photo" width={50} height={50} /></div> : <span className="text-gray-400">—</span>}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-3 text-xs">
                      <span>Page {page} / {totalPages} (Total {filteredHistory.length})</span>
                      <div className="space-x-2">
                        <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-1 border rounded disabled:opacity-40">Prev</button>
                        <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-2 py-1 border rounded disabled:opacity-40">Next</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          }
          {
            activeTab === 'workhours' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-white">Manage Work Hours</h2>
                <form onSubmit={saveWorkSettings} className="grid grid-cols-2 md:grid-cols-6 gap-4 bg-surface/30 backdrop-blur-md p-4 rounded-xl border border-white/10 text-xs text-text-muted">
                  <div>
                    <label className="block mb-1 font-medium">Check-in Time</label>
                    <input value={workSettings.standardCheckin} onChange={e => setWorkSettings(ws => ({ ...ws, standardCheckin: e.target.value }))} type="time" className="w-full px-2 py-1 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none" />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Check-out Time</label>
                    <input value={workSettings.standardCheckout} onChange={e => setWorkSettings(ws => ({ ...ws, standardCheckout: e.target.value }))} type="time" className="w-full px-2 py-1 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none" />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Lunch Start Time</label>
                    <input value={workSettings.lunchStart} onChange={e => setWorkSettings(ws => ({ ...ws, lunchStart: e.target.value }))} type="time" className="w-full px-2 py-1 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none" />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Lunch End Time</label>
                    <input value={workSettings.lunchEnd} onChange={e => setWorkSettings(ws => ({ ...ws, lunchEnd: e.target.value }))} type="time" className="w-full px-2 py-1 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none" />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Work Hours (auto)</label>
                    <input value={workSettings.standardHours} readOnly disabled className="w-full px-2 py-1 border border-white/10 rounded-lg bg-white/5 text-white/50 cursor-not-allowed" />
                  </div>
                  <div className="flex items-end">
                    <button disabled={savingSettings} type="submit" className="px-3 py-2 bg-primary text-white rounded-lg text-xs disabled:opacity-50 hover:bg-primary/80 transition-colors">Save</button>
                  </div>
                </form>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs bg-surface/30 backdrop-blur-md p-3 rounded-xl border border-white/10 text-text-muted">
                  <div>
                    <label className="block mb-1 font-medium">Team</label>
                    <select
                      value={workHoursFilters.team}
                      onChange={e => {
                        setWorkHoursFilters({ ...workHoursFilters, team: e.target.value });
                        setDailyPage(1);
                        setMonthlyPage(1);
                      }}
                      className="w-full px-2 py-1 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none"
                    >
                      <option value="">All Teams</option>
                      {uniqueTeams.map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Employee</label>
                    <input
                      value={workHoursFilters.employee}
                      onChange={e => {
                        setWorkHoursFilters({ ...workHoursFilters, employee: e.target.value });
                        setDailyPage(1);
                        setMonthlyPage(1);
                      }}
                      className="w-full px-2 py-1 bg-background/50 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary/50 outline-none"
                      placeholder="Name or ID"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setWorkHoursFilters({ team: '', employee: '' });
                        setDailyPage(1);
                        setMonthlyPage(1);
                      }}
                      className="px-3 py-1 bg-white/10 text-white rounded-lg text-xs hover:bg-white/20 transition-colors"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-sm text-white">Daily Records</h3>
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={e => setSelectedDate(e.target.value)}
                          className="px-2 py-1 bg-background/50 border border-white/10 rounded-lg text-white text-xs focus:ring-2 focus:ring-primary/50 outline-none"
                        />
                        <button
                          onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
                          className="px-2 py-1 bg-primary/20 text-primary rounded-lg text-xs hover:bg-primary/30 transition-colors"
                        >
                          Today
                        </button>
                      </div>
                      {filteredDailyRecords.length > 0 && (
                        <div className="flex gap-4 text-xs">
                          <span className="text-text-muted">Employees: <span className="font-semibold text-primary">{dailySummaryStats.employeeCount}</span></span>
                          <span className="text-text-muted">Total Hours: <span className="font-semibold text-green-400">{dailySummaryStats.totalHours}h</span></span>
                          <span className="text-text-muted">Late Hours: <span className="font-semibold text-red-400">{dailySummaryStats.totalLateHours}h</span></span>
                          <span className="text-text-muted">Late Count: <span className="font-semibold text-orange-400">{dailySummaryStats.lateCount}</span></span>
                        </div>
                      )}
                    </div>
                    {filteredDailyRecords.length === 0 ? <div className="text-xs text-text-muted">No data available for {selectedDate}.</div> : (
                      <div className="overflow-x-auto rounded-xl border border-white/10">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="bg-white/5 text-text-muted">
                              <th className="p-3 text-left">Employee</th>
                              <th className="p-3 text-left">Status</th>
                              <th className="p-3 text-left">Work Hours</th>
                              <th className="p-3 text-left">Late Hours</th>
                              <th className="p-3 text-left">Late</th>
                              <th className="p-3 text-left">Early</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {dailyPageList.map(r => (
                              <tr key={r.employeeId} className="hover:bg-white/5 transition-colors">
                                <td className="p-3 text-white">{r.employeeName} <span className="text-white/50">({r.employeeId})</span></td>
                                <td className="p-3 text-white">{r.status}</td>
                                <td className="p-3 text-white">{r.totalHours}h</td>
                                <td className="p-3">
                                  {r.shortageHours && r.shortageHours > 0 ? (
                                    <span className="text-red-400 font-medium">
                                      {r.shortageHours}h
                                    </span>
                                  ) : (
                                    <span className="text-green-400">0h</span>
                                  )}
                                </td>
                                <td className="p-3 text-white">{r.late ? '✔️' : '—'}</td>
                                <td className="p-3 text-white">{r.earlyDeparture ? '✔️' : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {filteredDailyRecords.length > 0 && (
                      <div className="flex items-center justify-between mt-3 text-xs text-text-muted">
                        <span>Page {dailyPage} / {dailyTotalPages} (Total {filteredDailyRecords.length})</span>
                        <div className="space-x-2">
                          <button disabled={dailyPage === 1} onClick={() => setDailyPage(p => Math.max(1, p - 1))} className="px-2 py-1 border border-white/10 rounded hover:bg-white/5 disabled:opacity-40 transition-colors">Prev</button>
                          <button disabled={dailyPage === dailyTotalPages} onClick={() => setDailyPage(p => Math.min(dailyTotalPages, p + 1))} className="px-2 py-1 border border-white/10 rounded hover:bg-white/5 disabled:opacity-40 transition-colors">Next</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm text-white">Monthly Summary (Current Month)</h3>
                      <div className="flex items-center gap-4">
                        {filteredMonthlySummary.length > 0 && (
                          <div className="flex gap-4 text-xs">
                            <span className="text-text-muted">Employees: <span className="font-semibold text-primary">{monthlySummaryStats.employeeCount}</span></span>
                            <span className="text-text-muted">Total Days: <span className="font-semibold text-blue-400">{monthlySummaryStats.totalDays}</span></span>
                            <span className="text-text-muted">Total Hours: <span className="font-semibold text-green-400">{monthlySummaryStats.totalHours}h</span></span>
                            <span className="text-text-muted">Late: <span className="font-semibold text-orange-400">{monthlySummaryStats.totalLateCount}</span></span>
                            <span className="text-text-muted">Early: <span className="font-semibold text-red-400">{monthlySummaryStats.totalEarlyCount}</span></span>
                          </div>
                        )}
                        <button onClick={exportMonthlyXLSX} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 transition-colors">Export XLSX</button>
                      </div>
                    </div>
                    {filteredMonthlySummary.length === 0 ? <div className="text-xs text-text-muted">No data available.</div> : (
                      <div className="overflow-x-auto rounded-xl border border-white/10">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="bg-white/5 text-text-muted">
                              <th className="p-3 text-left">Employee</th>
                              <th className="p-3 text-left">Work Days</th>
                              <th className="p-3 text-left">Total Hours</th>
                              <th className="p-3 text-left">Late</th>
                              <th className="p-3 text-left">Early</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {monthlyPageList.map(m => (
                              <tr key={m.employeeId} className="hover:bg-white/5 transition-colors">
                                <td className="p-3 text-white">{m.employeeName} <span className="text-white/50">({m.employeeId})</span></td>
                                <td className="p-3 text-white">{m.days}</td>
                                <td className="p-3 text-white">{m.totalHours}</td>
                                <td className="p-3 text-white">{m.lateCount}</td>
                                <td className="p-3 text-white">{m.earlyDepartureCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {filteredMonthlySummary.length > 0 && (
                      <div className="flex items-center justify-between mt-3 text-xs text-text-muted">
                        <span>Page {monthlyPage} / {monthlyTotalPages} (Total {filteredMonthlySummary.length})</span>
                        <div className="space-x-2">
                          <button disabled={monthlyPage === 1} onClick={() => setMonthlyPage(p => Math.max(1, p - 1))} className="px-2 py-1 border border-white/10 rounded hover:bg-white/5 disabled:opacity-40 transition-colors">Prev</button>
                          <button disabled={monthlyPage === monthlyTotalPages} onClick={() => setMonthlyPage(p => Math.min(monthlyTotalPages, p + 1))} className="px-2 py-1 border border-white/10 rounded hover:bg-white/5 disabled:opacity-40 transition-colors">Next</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          }
        </div >
        {modalPhoto && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setModalPhoto(null)}>
            <div className="bg-surface/90 backdrop-blur-xl p-4 rounded-2xl shadow-2xl max-w-[90%] max-h-[90%] overflow-auto border border-white/10" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-white">{modalPhoto.employeeName}</h3>
                <button onClick={() => setModalPhoto(null)} className="text-white/50 hover:text-white transition-colors">✕</button>
              </div>
              <div className="text-xs text-text-muted mb-2">{modalPhoto.timestamp ? new Date(modalPhoto.timestamp).toLocaleString('en-US') : ''}</div>
              <img src={modalPhoto.src} alt="Check-in Photo" className="max-w-full max-h-[70vh] object-contain rounded-lg border border-white/10" />
            </div>
          </div>
        )}

      </div >
    </div >
  );
}
