# Check-in HR System (React + Vite + Firebase)

Hệ thống check-in nhân viên với quản lý thời gian làm việc, ghi nhận WiFi và ảnh hiện trường.

## ✨ Tính năng chính

### 👥 Cho nhân viên
- **Check-in/Check-out**: Ghi nhận thời gian vào/ra với xác thực WiFi
- **Chụp ảnh hiện trường**: Tự động capture ảnh khi check-in/out
- **Thông tin môi trường**: Tự động ghi IP, WiFi, vị trí địa lý

### 🔧 Cho quản trị viên
- **Quản lý WiFi**: Cấu hình danh sách WiFi công ty, IP cho phép
- **Lịch sử check-in**: Xem, lọc, phân trang 10 bản ghi/trang
- **Xuất báo cáo**: Export Excel (XLSX) bao gồm ảnh hiện trường
- **Quản lý giờ làm việc**: Thiết lập khung giờ, tính toán tự động
- **Báo cáo tháng**: Thống kê ngày làm, giờ làm, trễ/sớm
- **CRUD nhân sự**: Quản lý thông tin nhân viên

## 🏗 Cấu trúc dự án

```
src/
├── pages/
│   ├── CheckinPage.jsx           # Trang check-in cho nhân viên
│   └── admin/
│       ├── AdminLoginPage.jsx    # Đăng nhập admin
│       ├── WifiCheckinsPage.jsx  # Quản lý WiFi + Lịch sử + Giờ làm việc
│       └── EmployeesPage.jsx     # Quản lý nhân sự
├── components/
│   ├── admin/AdminLayout.jsx     # Layout admin với navigation
│   └── ui/                       # Toast notifications
├── lib/
│   ├── firebaseClient.js         # Firebase Realtime Database
│   └── workHours.js              # Tính toán giờ làm việc
└── assets/                       # Static files
```

## 🔥 Firebase Realtime Database

### Schema dữ liệu

```javascript
{
  "checkins": {
    "[auto-id]": {
      "timestamp": "2025-11-10T09:15:30.000Z",
      "employeeId": "NV001", 
      "employeeName": "Nguyễn Văn An",
      "type": "in", // "in" hoặc "out"
      "wifi": {
        "ssid": "WiFi Guest",
        "publicIP": "203.113.151.45",
        "localIP": "192.168.1.105"
      },
      "photoBase64": "data:image/jpeg;base64,/9j/4AAQ..." // Ảnh hiện trường
    }
  },
  "employees": {
    "[employeeId]": {
      "fullName": "Nguyễn Văn An",
      "email": "an@company.com",
      "phone": "0901234567",
      "team": "IT",
      "position": "Developer",
      "isActive": true
    }
  },
  "companyWifis": {
    "[auto-id]": {
      "name": "WiFi Guest",
      "publicIP": "203.113.151.45",
      "localIP": "192.168.1.0/24",
      "createdAt": "2025-11-10T08:00:00.000Z"
    }
  },
  "workSettings": {
    "global": {
      "standardCheckin": "09:00",
      "standardCheckout": "18:00", 
      "lunchStart": "12:00",
      "lunchEnd": "13:00",
      "standardHours": 8
    }
  },
  "workRecords": {
    "2025-11-10": {
      "[employeeId]": {
        "employeeId": "NV001",
        "employeeName": "Nguyễn Văn An",
        "status": "Bình thường", // Trễ giờ | Về sớm | Trễ & Sớm | Đang làm việc | Vắng mặt
        "totalHours": 8.25,
        "late": false,
        "earlyDeparture": false
      }
    }
  }
}
```

### Rules bảo mật

```json
{
  "rules": {
    "checkins": {
      ".read": true,
      ".write": true,
      ".indexOn": ["timestamp", "employeeId", "type"]
    },
    "employees": {
      ".read": true,
      ".write": true,
      ".indexOn": ["fullName", "team", "isActive"]
    },
    "companyWifis": { ".read": true, ".write": true },
    "workSettings": { ".read": true, ".write": true },
    "workRecords": { 
      ".read": true, 
      ".write": true,
      ".indexOn": ["employeeId"]
    }
  }
}
```

> ⚠️ **Lưu ý**: Rules trên mở để phát triển. Production cần auth và phân quyền chi tiết.

## ⚙️ Logic tính giờ làm việc

### Nguyên tắc tính toán

1. **Thời gian làm việc**: `lastOut - firstIn - thời_gian_nghỉ_trưa`
2. **Trừ nghỉ trưa**: Nếu khoảng thời gian làm việc giao với khung nghỉ trưa
3. **Trễ giờ**: `firstIn > standardCheckin` 
4. **Về sớm**: `lastOut < standardCheckout`
5. **Số giờ chuẩn**: Tự động tính từ 4 thời điểm thiết lập

### Trạng thái nhân viên

- **Bình thường**: Không trễ, không về sớm
- **Trễ giờ**: Check-in sau giờ quy định  
- **Về sớm**: Check-out trước giờ quy định
- **Trễ & Sớm**: Cả hai lỗi trên
- **Đang làm việc**: Chỉ có check-in, chưa check-out
- **Vắng mặt**: Không có dữ liệu check-in/out

### Ví dụ tính toán

```javascript
// Cài đặt: 09:00-18:00, nghỉ trưa 12:00-13:00 → 8 giờ chuẩn
// Thực tế: Check-in 09:15, Check-out 18:30
// Tính toán:
// - Raw: 18:30 - 09:15 = 9h15m = 555 phút
// - Trừ nghỉ trưa: 555 - 60 = 495 phút = 8.25 giờ
// - Trễ: 09:15 > 09:00 → true (15 phút)
// - Về sớm: 18:30 > 18:00 → false
// - Status: "Trễ giờ"
```

## 📊 Xuất báo cáo

### Excel (XLSX) với ảnh
- **Lịch sử Check-in**: Bao gồm ảnh hiện trường nhúng vào file
- **Monthly Summary**: Tổng hợp theo tháng
- **Tự động đặt tên**: `checkins_2025-11-10.xlsx`

### Phân trang thông minh
- **10 records/trang** cho tất cả bảng
- **Filter real-time** với debounce 300ms
- **Pagination controls** với Previous/Next

## 🚀 Cài đặt và chạy

### Yêu cầu hệ thống
- Node.js >= 16
- NPM >= 8
- Firebase project với Realtime Database

### Cài đặt

```powershell
# Clone project
git clone [repository-url]
cd checkin

# Cài đặt dependencies  
npm install

# Cấu hình Firebase
cp .env.example .env
# Điền thông tin Firebase config vào .env
```

### Chạy development

```powershell
npm run dev
```

Mở trình duyệt: http://localhost:5173

### Build production

```powershell
npm run build
npm run preview  # Preview build local
```

### Deploy với Firebase Hosting

```powershell
npm run build
firebase deploy --only hosting
```

## 🔐 Quy trình sử dụng

### Cho nhân viên
1. Truy cập trang chính `/`
2. Nhập mã nhân viên 
3. Cho phép camera và vị trí
4. Chọn Check-in/Check-out
5. Chụp ảnh hiện trường → Hoàn tất

### Cho admin  
1. Truy cập `/admin` → Đăng nhập
2. **Tab WiFi**: Cấu hình danh sách WiFi công ty
3. **Tab Lịch sử**: Xem/lọc/export dữ liệu check-in
4. **Tab Giờ làm việc**: Thiết lập + xem báo cáo

## 🛡️ Bảo mật

### Hiện tại (Development)
- Login admin đơn giản (localStorage)
- Firebase rules mở public
- No encryption cho ảnh base64

### Khuyến nghị Production
- Firebase Auth với role-based access
- Encrypt sensitive data
- Rate limiting cho API
- HTTPS bắt buộc
- Backup dữ liệu định kỳ

## 📈 Hiệu năng

### Tối ưu đã áp dụng
- **Debounce search**: 300ms cho filter
- **useMemo**: Cache filtered data
- **Pagination**: 10 items/page
- **Monthly cache**: Cache theo `YYYY-MM`
- **Lazy loading**: Dynamic import ExcelJS

### Nâng cấp tiếp theo
- **Virtualization**: react-window cho >1000 records  
- **Service Worker**: Offline support
- **Image optimization**: WebP conversion
- **CDN**: Firebase Storage cho ảnh

## 🔧 Công nghệ sử dụng

### Frontend
- **React 18** + **Vite 5** - Fast development
- **Tailwind CSS** - Utility-first styling  
- **Lucide React** - Modern icons
- **ExcelJS** - Excel export với ảnh

### Backend
- **Firebase Realtime Database** - NoSQL real-time
- **Firebase Hosting** - Static deployment

### DevOps
- **ESLint** - Code quality
- **PostCSS** - CSS processing
- **Firebase CLI** - Deployment

## 📞 Hỗ trợ

### Troubleshooting
- **Build errors**: Kiểm tra Node.js version >= 16
- **Camera không hoạt động**: Cần HTTPS hoặc localhost  
- **Export Excel lỗi**: Kiểm tra ExcelJS dependency
- **Firebase connection**: Verify config trong `.env`

### Debug mode
- Mở F12 → Console để xem pagination debug
- Network tab để monitor Firebase calls

---

*Phát triển bởi: [Your Team Name]*  
*Version: 1.0.0*  
*Last updated: November 2025*

## 🔧 Công nghệ sử dụng

### Frontend
- **React 18** + **Vite 5** - Fast development
- **Tailwind CSS** - Utility-first styling  
- **Lucide React** - Modern icons
- **ExcelJS** - Excel export với ảnh

### Backend
- **Firebase Realtime Database** - NoSQL real-time
- **Firebase Hosting** - Static deployment

### DevOps
- **ESLint** - Code quality
- **PostCSS** - CSS processing
- **Firebase CLI** - Deployment

## 📞 Hỗ trợ

### Troubleshooting
- **Build errors**: Kiểm tra Node.js version >= 16
- **Camera không hoạt động**: Cần HTTPS hoặc localhost  
- **Export Excel lỗi**: Kiểm tra ExcelJS dependency
- **Firebase connection**: Verify config trong `.env`

### Debug mode
- Mở F12 → Console để xem pagination debug
- Network tab để monitor Firebase calls

---

*Phát triển bởi: [Your Team Name]*  
*Version: 1.0.0*  
*Last updated: November 2025*
