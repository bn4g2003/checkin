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
  const [filters, setFilters] = useState({ date: '', type: '', employee: '' });
  const [debouncedEmployee, setDebouncedEmployee] = useState('');
  const [page, setPage] = useState(1);
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

  // history filters + pagination
  const filteredHistory = useMemo(() => {
    let list = checkins;
    // robust local-date filter to avoid timezone/format issues
    if (filters.date) {
      const start = new Date(`${filters.date}T00:00:00`);
      const end = new Date(`${filters.date}T23:59:59.999`);
      list = list.filter(c => {
        if (!c.timestamp) return false;
        const ts = new Date(c.timestamp);
        return ts >= start && ts <= end;
      });
    }
    if (filters.type) list = list.filter(c => c.type === filters.type);
    if (debouncedEmployee) {
      const q = debouncedEmployee.toLowerCase();
      list = list.filter(c => c.employeeId?.toLowerCase().includes(q) || c.employeeName?.toLowerCase().includes(q));
    }
    return list;
  }, [checkins, filters.date, filters.type, debouncedEmployee]);
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
  const dailyTotalPages = Math.max(1, Math.ceil(dailyRecords.length / commonPageSize));
  const dailyPageList = dailyRecords.slice((dailyPage - 1) * commonPageSize, dailyPage * commonPageSize);
  useEffect(() => { if (dailyPage > dailyTotalPages) setDailyPage(1); }, [dailyTotalPages, dailyPage]);
  // Monthly
  const [monthlyPage, setMonthlyPage] = useState(1);
  const monthlyTotalPages = Math.max(1, Math.ceil(monthlySummary.length / commonPageSize));
  const monthlyPageList = monthlySummary.slice((monthlyPage - 1) * commonPageSize, monthlyPage * commonPageSize);
  useEffect(() => { if (monthlyPage > monthlyTotalPages) setMonthlyPage(1); }, [monthlyTotalPages, monthlyPage]);

  // debounce employee filter 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedEmployee(filters.employee), 300);
    return () => clearTimeout(t);
  }, [filters.employee]);

  // Compute daily records for today when checkins change
  useEffect(() => {
    if (!checkins.length) { setDailyRecords([]); return; }
    const today = new Date().toISOString().slice(0, 10);
    const todays = checkins.filter(c => c.timestamp?.startsWith(today));
    const map = computeDailyRecords(todays, workSettings);
    const arr = Object.values(map);
    setDailyRecords(arr);
    // persist to Firebase workRecords/{date}/{employeeId}
    (async () => {
      try {
        const { database, ref, set } = await getDb();
        for (const r of arr) {
          await set(ref(database, `workRecords/${today}/${r.employeeId}`), r);
        }
      } catch { /* ignore persist errors for now */ }
    })();
  }, [checkins, workSettings]);

  // Compute monthly summary with cache
  useEffect(() => {
    if (!checkins.length) { setMonthlySummary([]); return; }
    const monthKey = new Date().toISOString().slice(0, 7);
    if (monthlyCache[monthKey]) { setMonthlySummary(monthlyCache[monthKey]); return; }
    const summary = computeMonthlySummary(checkins, workSettings, monthKey);
    setMonthlyCache(cache => ({ ...cache, [monthKey]: summary }));
    setMonthlySummary(summary);
  }, [checkins, workSettings, monthlyCache]);

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
    <div className="min-h-screen p-4 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white shadow rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Clock className="text-indigo-600" />
              <div>
                <div className="text-sm text-gray-500">Check-ins today</div>
                <div className="text-2xl font-bold text-gray-900">{stats.todayCheckins}</div>
              </div>
            </div>
            <button className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100">Refresh</button>
          </div>
          <div className="bg-white shadow rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Wifi className="text-green-600" />
              <div>
                <div className="text-sm text-gray-500">Configured WiFi</div>
                <div className="text-2xl font-bold text-gray-900">{stats.wifiCount}</div>
              </div>
            </div>
            <button className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100">Refresh</button>
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
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === t.id ? 'bg-indigo-600 text-white' : 'bg-white shadow text-gray-700 hover:bg-gray-100'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow p-6 min-h-[300px]">
          {activeTab === 'wifi' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Manage WiFi</h2>
              <form onSubmit={submitWifi} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm bg-gray-50 p-4 rounded border">
                <div>
                  <label className="block mb-1 font-medium">WiFi Name *</label>
                  <input value={wifiForm.name} onChange={e => setWifiForm({ ...wifiForm, name: e.target.value })} className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Public IP</label>
                  <input value={wifiForm.publicIP} onChange={e => setWifiForm({ ...wifiForm, publicIP: e.target.value })} className="w-full px-3 py-2 border rounded font-mono" />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Local IP</label>
                  <input value={wifiForm.localIP} onChange={e => setWifiForm({ ...wifiForm, localIP: e.target.value })} className="w-full px-3 py-2 border rounded font-mono" />
                </div>
                <div className="flex items-end gap-2">
                  <button type="button" onClick={refreshCurrentIPs} className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 text-xs">Get Current IP</button>
                  <button type="submit" className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-xs">{editingWifi ? 'Save' : 'Add'}</button>
                  {editingWifi && <button type="button" onClick={() => { setEditingWifi(null); setWifiForm({ name: '', publicIP: '', localIP: '' }); }} className="px-3 py-2 bg-gray-100 rounded text-xs">Cancel</button>}
                </div>
              </form>
              {status && <div className={`text-sm px-3 py-2 rounded ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{status.message}</div>}
              <div className="overflow-x-auto">
                {loadingWifi ? <div className="text-sm text-gray-500">Loading...</div> : (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-left">
                        <th className="p-2 font-medium">Name</th>
                        <th className="p-2 font-medium">Public IP</th>
                        <th className="p-2 font-medium">Local IP</th>
                        <th className="p-2 font-medium">Created At</th>
                        <th className="p-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wifiPageList.map(w => (
                        <tr key={w.id} className="border-t hover:bg-gray-50">
                          <td className="p-2 font-medium">{w.name}</td>
                          <td className="p-2 font-mono text-xs">{w.publicIP || <span className='text-gray-400'>—</span>}</td>
                          <td className="p-2 font-mono text-xs">{w.localIP || <span className='text-gray-400'>—</span>}</td>
                          <td className="p-2 text-xs">{w.createdAt ? new Date(w.createdAt).toLocaleString('en-US') : '—'}</td>
                          <td className="p-2 space-x-1 text-xs">
                            <button onClick={() => editWifi(w)} className="text-indigo-600 hover:underline">Edit</button>
                            <button onClick={() => deleteWifi(w)} className="text-red-600 hover:underline">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {!loadingWifi && (
                <div className="flex items-center justify-between mt-3 text-xs">
                  <span>Page {wifiPage} / {wifiTotalPages} (Total {wifis.length})</span>
                  <div className="space-x-2">
                    <button disabled={wifiPage === 1} onClick={() => setWifiPage(p => Math.max(1, p - 1))} className="px-2 py-1 border rounded disabled:opacity-40">Prev</button>
                    <button disabled={wifiPage === wifiTotalPages} onClick={() => setWifiPage(p => Math.min(wifiTotalPages, p + 1))} className="px-2 py-1 border rounded disabled:opacity-40">Next</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Check-in History</h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs bg-gray-50 p-3 rounded border">
                <div>
                  <label className="block mb-1">Date</label>
                  <input type="date" value={filters.date} onChange={e => { setFilters({ ...filters, date: e.target.value }); setPage(1); }} className="w-full px-2 py-1 border rounded" />
                </div>
                <div>
                  <label className="block mb-1">Type</label>
                  <select value={filters.type} onChange={e => { setFilters({ ...filters, type: e.target.value }); setPage(1); }} className="w-full px-2 py-1 border rounded">
                    <option value="">All</option>
                    <option value="in">Check-in</option>
                    <option value="out">Check-out</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block mb-1">Employee</label>
                  <input value={filters.employee} onChange={e => { setFilters({ ...filters, employee: e.target.value }); setPage(1); }} className="w-full px-2 py-1 border rounded" placeholder="Search by name or ID" />
                </div>
                <div className="flex items-end">
                  <button onClick={() => { setFilters({ date: '', type: '', employee: '' }); setPage(1); }} className="px-3 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200">Clear</button>
                  <button onClick={exportHistoryXLSX} className="ml-2 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Export XLSX</button>
                </div>
              </div>
              {loadingCheckins ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-8 bg-gray-100 animate-pulse rounded" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto hidden md:block">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-gray-100 text-left">
                          <th className="p-2">Time</th>
                          <th className="p-2">Employee</th>
                          <th className="p-2">Type</th>
                          <th className="p-2">WiFi</th>
                          <th className="p-2">Public IP</th>
                          <th className="p-2">Local IP</th>
                          <th className="p-2">Photo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageHistory.map(c => (
                          <tr key={c.id} className="border-t hover:bg-gray-50">
                            <td className="p-2 whitespace-nowrap">{c.timestamp ? new Date(c.timestamp).toLocaleString('en-US') : '—'}</td>
                            <td className="p-2">{c.employeeName} <span className="text-gray-400">({c.employeeId})</span></td>
                            <td className="p-2 font-medium">{c.type === 'in' ? 'IN' : 'OUT'}</td>
                            <td className="p-2">{c.wifi?.ssid}</td>
                            <td className="p-2 font-mono">{c.wifi?.publicIP || '—'}</td>
                            <td className="p-2 font-mono">{c.wifi?.localIP || '—'}</td>
                            <td className="p-2">{c.photoBase64 ? <div className='cursor-pointer' onClick={() => setModalPhoto({ src: c.photoBase64, employeeName: c.employeeName, timestamp: c.timestamp })}><img src={c.photoBase64} alt="Check-in Photo" width={50} height={50} /></div> : <span className="text-gray-400">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-3">
                    {pageHistory.map(c => (
                      <div key={c.id} className="border rounded-lg p-3 bg-gray-50">
                        <div className="text-xs text-gray-500">{c.timestamp ? new Date(c.timestamp).toLocaleString('en-US') : '—'}</div>
                        <div className="font-medium">{c.employeeName} <span className="text-gray-400">({c.employeeId})</span></div>
                        <div className="text-xs">Type: <span className="font-medium">{c.type === 'in' ? 'IN' : 'OUT'}</span></div>
                        <div className="text-xs">WiFi: {c.wifi?.ssid}</div>
                        <div className="text-[11px] font-mono text-gray-600">Public: {c.wifi?.publicIP || '—'} | Local: {c.wifi?.localIP || '—'}</div>
                        <div className="p-2">{c.photoBase64 ? <div className='cursor-pointer' onClick={() => setModalPhoto({ src: c.photoBase64, employeeName: c.employeeName, timestamp: c.timestamp })}><img src={c.photoBase64} alt="Check-in Photo" width={50} height={50} /></div> : <span className="text-gray-400">—</span>}</div>
                      </div>
                    ))}
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
          )}
          {activeTab === 'workhours' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Manage Work Hours</h2>
              <form onSubmit={saveWorkSettings} className="grid grid-cols-2 md:grid-cols-6 gap-4 bg-gray-50 p-4 rounded border text-xs">
                <div>
                  <label className="block mb-1 font-medium">Check-in Time</label>
                  <input value={workSettings.standardCheckin} onChange={e => setWorkSettings(ws => ({ ...ws, standardCheckin: e.target.value }))} type="time" className="w-full px-2 py-1 border rounded" />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Check-out Time</label>
                  <input value={workSettings.standardCheckout} onChange={e => setWorkSettings(ws => ({ ...ws, standardCheckout: e.target.value }))} type="time" className="w-full px-2 py-1 border rounded" />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Lunch Start Time</label>
                  <input value={workSettings.lunchStart} onChange={e => setWorkSettings(ws => ({ ...ws, lunchStart: e.target.value }))} type="time" className="w-full px-2 py-1 border rounded" />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Lunch End Time</label>
                  <input value={workSettings.lunchEnd} onChange={e => setWorkSettings(ws => ({ ...ws, lunchEnd: e.target.value }))} type="time" className="w-full px-2 py-1 border rounded" />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Work Hours (auto)</label>
                  <input value={workSettings.standardHours} readOnly disabled className="w-full px-2 py-1 border rounded bg-gray-100 text-gray-600 cursor-not-allowed" />
                </div>
                <div className="flex items-end">
                  <button disabled={savingSettings} type="submit" className="px-3 py-2 bg-indigo-600 text-white rounded text-xs disabled:opacity-50">Save</button>
                </div>
              </form>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2 text-sm">Daily Records (Today)</h3>
                  {dailyRecords.length === 0 ? <div className="text-xs text-gray-500">Not enough data.</div> : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="p-2 text-left">Employee</th>
                            <th className="p-2 text-left">Status</th>
                            <th className="p-2 text-left">Work Hours</th>
                            <th className="p-2 text-left">Late</th>
                            <th className="p-2 text-left">Early</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dailyPageList.map(r => (
                            <tr key={r.employeeId} className="border-t hover:bg-gray-50">
                              <td className="p-2">{r.employeeName} <span className="text-gray-400">({r.employeeId})</span></td>
                              <td className="p-2">{r.status}</td>
                              <td className="p-2">{r.totalHours}</td>
                              <td className="p-2">{r.late ? '✔️' : '—'}</td>
                              <td className="p-2">{r.earlyDeparture ? '✔️' : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {dailyRecords.length > 0 && (
                    <div className="flex items-center justify-between mt-3 text-xs">
                      <span>Page {dailyPage} / {dailyTotalPages} (Total {dailyRecords.length})</span>
                      <div className="space-x-2">
                        <button disabled={dailyPage === 1} onClick={() => setDailyPage(p => Math.max(1, p - 1))} className="px-2 py-1 border rounded disabled:opacity-40">Prev</button>
                        <button disabled={dailyPage === dailyTotalPages} onClick={() => setDailyPage(p => Math.min(dailyTotalPages, p + 1))} className="px-2 py-1 border rounded disabled:opacity-40">Next</button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">Monthly Summary (Current Month)</h3>
                    <button onClick={exportMonthlyXLSX} className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Export XLSX</button>
                  </div>
                  {monthlySummary.length === 0 ? <div className="text-xs text-gray-500">No monthly data.</div> : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="p-2 text-left">Employee</th>
                            <th className="p-2 text-left">Work Days</th>
                            <th className="p-2 text-left">Total Hours</th>
                            <th className="p-2 text-left">Late</th>
                            <th className="p-2 text-left">Early</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyPageList.map(m => (
                            <tr key={m.employeeId} className="border-t hover:bg-gray-50">
                              <td className="p-2">{m.employeeName} <span className="text-gray-400">({m.employeeId})</span></td>
                              <td className="p-2">{m.days}</td>
                              <td className="p-2">{m.totalHours}</td>
                              <td className="p-2">{m.lateCount}</td>
                              <td className="p-2">{m.earlyDepartureCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {monthlySummary.length > 0 && (
                    <div className="flex items-center justify-between mt-3 text-xs">
                      <span>Page {monthlyPage} / {monthlyTotalPages} (Total {monthlySummary.length})</span>
                      <div className="space-x-2">
                        <button disabled={monthlyPage === 1} onClick={() => setMonthlyPage(p => Math.max(1, p - 1))} className="px-2 py-1 border rounded disabled:opacity-40">Prev</button>
                        <button disabled={monthlyPage === monthlyTotalPages} onClick={() => setMonthlyPage(p => Math.min(monthlyTotalPages, p + 1))} className="px-2 py-1 border rounded disabled:opacity-40">Next</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        {modalPhoto && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setModalPhoto(null)}>
            <div className="bg-white p-4 rounded shadow-lg max-w-[90%] max-h-[90%] overflow-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">{modalPhoto.employeeName}</h3>
                <button onClick={() => setModalPhoto(null)} className="text-gray-500 hover:text-gray-900">✕</button>
              </div>
              <div className="text-xs text-gray-500 mb-2">{modalPhoto.timestamp ? new Date(modalPhoto.timestamp).toLocaleString('en-US') : ''}</div>
              <img src={modalPhoto.src} alt="Check-in Photo" className="max-w-full max-h-[70vh] object-contain rounded" />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
