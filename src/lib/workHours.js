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
      lastOut
    };
  }
  return records;
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
          earlyDepartureCount: 0
        };
      }
      summaryByEmployee[empId].totalHours += d.totalHours;
      summaryByEmployee[empId].days += 1;
      if (d.late) summaryByEmployee[empId].lateCount += 1;
      if (d.earlyDeparture) summaryByEmployee[empId].earlyDepartureCount += 1;
    }
  }
  // round totalHours
  for (const empId of Object.keys(summaryByEmployee)) {
    summaryByEmployee[empId].totalHours = +summaryByEmployee[empId].totalHours.toFixed(2);
  }
  return Object.values(summaryByEmployee).sort((a,b)=> a.employeeName.localeCompare(b.employeeName));
}
