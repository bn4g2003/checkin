# DATABASE STRUCTURE DOCUMENTATION

## Firebase Realtime Database Schema

### 1. `checkins` - Lưu trữ tất cả bản ghi check-in/out
```
checkins/
├── {checkinId}/
    ├── employeeId: string (required) - Mã nhân viên
    ├── employeeName: string (required) - Tên nhân viên  
    ├── type: "in" | "out" (required) - Loại check-in
    ├── timestamp: string (required) - ISO timestamp
    ├── photoBase64: string | null - Ảnh base64 (tạm thời)
    ├── photoURL: string | null - URL ảnh từ Vercel Blob
    ├── location: object (required)
    │   ├── lat: number - Vĩ độ (-90 to 90)
    │   ├── lng: number - Kinh độ (-180 to 180)
    │   └── address: string - Địa chỉ
    └── wifi: object (required)
        ├── ssid: string (required) - Tên WiFi
        ├── verified: boolean - Đã xác thực WiFi
        ├── publicIP: string | null - IP công cộng
        ├── localIP: string | null - IP nội bộ
        └── connectionType: string - Loại kết nối
```

### 2. `employees` - Quản lý thông tin nhân sự
```
employees/
├── {employeeId}/
    ├── fullName: string (required) - Họ tên đầy đủ
    ├── department: string | null - Phòng ban
    ├── team: string | null - Nhóm/Team
    ├── position: string | null - Vị trí công việc
    ├── branch: string | null - Chi nhánh
    ├── active: boolean (required) - Trạng thái hoạt động
    └── createdAt: string (required) - Thời gian tạo
```

### 3. `companyWifis` - Danh sách WiFi công ty
```
companyWifis/
├── {wifiId}/
    ├── name: string (required) - Tên WiFi
    ├── publicIP: string | null - IP công cộng
    ├── localIP: string | null - IP gateway
    └── createdAt: string (required) - Thời gian tạo
```

### 4. `workSettings` - Cài đặt giờ làm việc
```
workSettings/
└── global/
    ├── standardCheckin: string (required) - Giờ vào chuẩn (HH:MM)
    ├── standardCheckout: string (required) - Giờ ra chuẩn (HH:MM)  
    ├── lunchStart: string - Giờ bắt đầu nghỉ trưa (HH:MM)
    ├── lunchEnd: string - Giờ kết thúc nghỉ trưa (HH:MM)
    └── standardHours: number (required) - Số giờ làm chuẩn
```

### 5. `workRecords` - Bản ghi công việc hàng ngày
```
workRecords/
├── {YYYY-MM-DD}/
    └── {employeeId}/
        ├── employeeId: string (required)
        ├── employeeName: string (required)
        ├── status: "OK" | "Late" | "Early" | "Late & Early" | "Incomplete"
        ├── totalHours: number (required) - Tổng giờ làm
        ├── late: boolean - Có đi muộn không
        ├── earlyDeparture: boolean - Có về sớm không
        ├── firstIn: number | null - Phút đầu tiên check-in
        └── lastOut: number | null - Phút cuối cùng check-out
```

## Data Flow & Business Logic

### Check-in Process:
1. **Input**: employeeId, employeeName
2. **Capture**: Camera photo → base64
3. **Location**: GPS coordinates → address
4. **WiFi**: Detect IP, verify against companyWifis
5. **Save**: Store to `checkins` collection
6. **Background**: Upload photo to Vercel Blob, update photoURL

### Daily Records Calculation:
1. **Filter**: checkins by date and employeeId
2. **Group**: separate "in" and "out" times
3. **Calculate**: 
   - firstIn = earliest check-in time in minutes
   - lastOut = latest check-out time in minutes
   - totalHours = (lastOut - firstIn - lunchBreak) / 60
   - late = firstIn > standardCheckin + 1 minute
   - earlyDeparture = lastOut < standardCheckout - 1 minute
4. **Save**: Store to `workRecords/{date}/{employeeId}`

### Monthly Summary:
1. **Aggregate**: all workRecords for the month
2. **Calculate**: total days, total hours, late count, early departure count
3. **Cache**: Client-side cache by month key

## Indexing Strategy

### Performance Optimizations:
- `checkins`: indexed by timestamp, employeeId, type
- `employees`: indexed by fullName, department, team, active
- `companyWifis`: indexed by name, createdAt
- `workRecords`: indexed by date key

### Query Patterns:
- Recent checkins: order by timestamp desc
- Employee checkins: filter by employeeId
- Daily records: query by date
- Active employees: filter by active = true

## Security Rules

### Development Rules (current):
- Open read/write for rapid development
- Basic validation on required fields

### Production Rules (recommended):
- Strict validation on all data types
- IP address format validation
- Time format validation (HH:MM)
- ISO timestamp validation
- Coordinate range validation
- String length limits
- Enum value validation for status/type fields

## Migration Considerations

### From Development to Production:
1. Enable strict security rules
2. Add user authentication
3. Implement role-based access control
4. Add audit logs for sensitive operations
5. Set up database backups
6. Monitor for abuse patterns