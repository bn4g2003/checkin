// workHours.js - tính toán giờ làm việc cơ bản từ danh sách checkins trong ngày
// Giả định: Không ca qua đêm, lấy earliest 'in' và latest 'out' làm cặp chính.

export function parseTimeToMinutes(timeStr) {
  // timeStr: 'HH:MM'
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function computeDailyRecords(checkins, workSettings) {
  // checkins: array { employeeId, employeeName, type, timestamp }
  // workSettings: { standardCheckin, standardCheckout, lunchStart, lunchEnd, standardHours }
  const byEmployee = {};
  const standardIn = parseTimeToMinutes(workSettings.standardCheckin);
  const standardOut = parseTimeToMinutes(workSettings.standardCheckout);
  const lunchStart = parseTimeToMinutes(workSettings.lunchStart);
  const lunchEnd = parseTimeToMinutes(workSettings.lunchEnd);

  // Group by employee -> timesIn[], timesOut[]
  for (const c of checkins) {
    const ts = new Date(c.timestamp);
    const minutes = ts.getHours()*60 + ts.getMinutes();
    if (!byEmployee[c.employeeId]) {
      byEmployee[c.employeeId] = { employeeId: c.employeeId, employeeName: c.employeeName, ins: [], outs: [] };
    }
    if (c.type === 'in') byEmployee[c.employeeId].ins.push(minutes);
    else if (c.type === 'out') byEmployee[c.employeeId].outs.push(minutes);
  }

  const records = {};
  for (const empId of Object.keys(byEmployee)) {
    const rec = byEmployee[empId];
    
    // Nếu thiếu dữ liệu
    if (rec.ins.length === 0 && rec.outs.length === 0) {
      records[empId] = {
        employeeId: empId,
        employeeName: rec.employeeName,
        status: 'Vắng mặt',
        totalHours: 0,
        late: false,
        earlyDeparture: false,
        firstIn: null,
        lastOut: null
      };
      continue;
    }
    
    if (rec.ins.length === 0 || rec.outs.length === 0) {
      records[empId] = {
        employeeId: empId,
        employeeName: rec.employeeName,
        status: 'Đang làm việc',
        totalHours: 0,
        late: false,
        earlyDeparture: false,
        firstIn: rec.ins.length > 0 ? Math.min(...rec.ins) : null,
        lastOut: rec.outs.length > 0 ? Math.max(...rec.outs) : null
      };
      continue;
    }
    
    const firstIn = Math.min(...rec.ins);
    const lastOut = Math.max(...rec.outs);
    let workedMinutes = Math.max(0, lastOut - firstIn);
    
    // Trừ giờ nghỉ trưa nếu thời gian làm việc giao với block lunch
    if (lunchStart != null && lunchEnd != null && firstIn < lunchEnd && lastOut > lunchStart) {
      const overlapStart = Math.max(firstIn, lunchStart);
      const overlapEnd = Math.min(lastOut, lunchEnd);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      workedMinutes -= overlap;
    }
    
    const totalHours = +(workedMinutes / 60).toFixed(2);
    
    // Simplified late/early logic: no grace period
    const late = standardIn != null ? firstIn > standardIn : false;
    const earlyDeparture = standardOut != null ? lastOut < standardOut : false;
    
    // Calculate late minutes (how many minutes late for check-in)
    const lateMinutes = (late && standardIn != null) ? Math.max(0, firstIn - standardIn) : 0;
    
    // Calculate shortage hours (difference between standard hours and actual worked hours)
    const standardHours = workSettings.standardHours || 8;
    const shortageHours = Math.max(0, standardHours - totalHours);
    
    let status = 'Bình thường';
    if (late && earlyDeparture) status = 'Trễ & Sớm';
    else if (late) status = 'Trễ giờ';
    else if (earlyDeparture) status = 'Về sớm';
    
    records[empId] = {
      employeeId: empId,
      employeeName: rec.employeeName,
      status,
      totalHours,
      late,
      earlyDeparture,
      firstIn,
      lastOut,
      lateMinutes,
      shortageHours: +shortageHours.toFixed(2)
    };
  }
  return records;
}

// Helper: convert minutes to HH:MM string
export function minutesToTimeStr(minutes) {
  if (minutes == null) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Get all days in a month
export function getDaysInMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(`${monthKey}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

export function computeMonthlySummary(checkins, workSettings, monthKey) {
  // monthKey: 'YYYY-MM'
  const monthCheckins = checkins.filter(c => c.timestamp && c.timestamp.startsWith(monthKey));
  // group by date first
  const byDate = {};
  for (const c of monthCheckins) {
    const day = c.timestamp.slice(0,10);
    if (!byDate[day]) byDate[day] = [];
    byDate[day].push(c);
  }
  
  // Get all days in the month
  const allDays = getDaysInMonth(monthKey);
  
  const summaryByEmployee = {};
  for (const day of Object.keys(byDate)) {
    const daily = computeDailyRecords(byDate[day], workSettings);
    for (const empId of Object.keys(daily)) {
      const d = daily[empId];
      if (!summaryByEmployee[empId]) {
        summaryByEmployee[empId] = {
          employeeId: empId,
          employeeName: d.employeeName,
          totalHours: 0,
          days: 0,
          lateCount: 0,
          earlyDepartureCount: 0,
          dailyDetails: {} // Store daily details: { 'YYYY-MM-DD': { checkin, checkout, status, hours, late, early } }
        };
      }
      summaryByEmployee[empId].totalHours += d.totalHours;
      summaryByEmployee[empId].days += 1;
      if (d.late) summaryByEmployee[empId].lateCount += 1;
      if (d.earlyDeparture) summaryByEmployee[empId].earlyDepartureCount += 1;
      
      // Store daily detail
      summaryByEmployee[empId].dailyDetails[day] = {
        checkin: minutesToTimeStr(d.firstIn),
        checkout: minutesToTimeStr(d.lastOut),
        status: d.status,
        hours: d.totalHours,
        late: d.late,
        earlyDeparture: d.earlyDeparture,
        lateMinutes: d.lateMinutes || 0,
        shortageHours: d.shortageHours || 0
      };
    }
  }
  
  // Mark absent days for each employee (days in month with no record)
  for (const empId of Object.keys(summaryByEmployee)) {
    const emp = summaryByEmployee[empId];
    for (const day of allDays) {
      // Only mark past days as absent (not future days)
      const today = new Date().toISOString().slice(0, 10);
      if (day <= today && !emp.dailyDetails[day]) {
        emp.dailyDetails[day] = {
          checkin: null,
          checkout: null,
          status: 'Vắng mặt',
          hours: 0,
          late: false,
          earlyDeparture: false,
          lateMinutes: 0,
          shortageHours: workSettings.standardHours || 8
        };
      }
    }
    // Calculate work days and absent days
    const workedDays = Object.values(emp.dailyDetails).filter(d => d.status !== 'Vắng mặt').length;
    const absentDays = Object.values(emp.dailyDetails).filter(d => d.status === 'Vắng mặt').length;
    emp.workDays = workedDays;
    emp.absentDays = absentDays;
  }
  
  // round totalHours
  for (const empId of Object.keys(summaryByEmployee)) {
    summaryByEmployee[empId].totalHours = +summaryByEmployee[empId].totalHours.toFixed(2);
  }
  return Object.values(summaryByEmployee).sort((a,b)=> a.employeeName.localeCompare(b.employeeName));
}
