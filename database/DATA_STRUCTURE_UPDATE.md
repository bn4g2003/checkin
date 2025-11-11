# Hướng dẫn cập nhật cấu trúc dữ liệu Employees

## 📋 Tổng quan
File này hướng dẫn cập nhật cấu trúc dữ liệu employees để hỗ trợ đầy đủ các tính năng theo yêu cầu.

## 🔧 Các trường dữ liệu cần bổ sung

### 1. Thông tin cá nhân
```json
{
  "birthday": "YYYY-MM-DD",          // Ngày sinh để tính sinh nhật
  "phone": "+84 XXX XXX XXX",        // Số điện thoại
  "email": "email@company.com"       // Email cá nhân
}
```

### 2. Thông tin công việc
```json
{
  "startDate": "YYYY-MM-DD",         // Ngày bắt đầu làm việc
  "endDate": "YYYY-MM-DD"            // Ngày nghỉ việc (null nếu còn làm)
}
```

### 3. Thông tin lương
```json
{
  "baseSalary": 15000000,            // Lương cơ bản (VND)
  "salaryPercentage": 100            // Tỷ lệ % được hưởng lương
}
```

### 4. Hồ sơ nhân sự
```json
{
  "cvURL": "https://storage..."       // Link file CV đã upload
}
```

### 5. Thống kê chấm công
```json
{
  "lateMinutes": 0,                   // Tổng phút đi trễ trong tháng
  "earlyLeaveMinutes": 0,            // Tổng phút về sớm trong tháng
  "overtimeHours": 0,                // Tổng giờ tăng ca trong tháng
  "sundayWorkDays": 0                // Số ngày làm chủ nhật trong tháng
}
```

## 📊 Các tính năng được hỗ trợ sau khi cập nhật

### 1. Dashboard - Thống kê tổng quan
- ✅ Sinh nhật trong tháng (dùng trường `birthday`)
- ✅ Thâm niên nhân sự (dùng `startDate` và `endDate`)
- ✅ Phân loại theo chi nhánh (dùng `branch`)

### 2. Quản lý giờ làm việc & chấm công
- ✅ Đi làm muộn (dùng `lateMinutes`)
- ✅ Về sớm (dùng `earlyLeaveMinutes`)
- ✅ Tăng ca (dùng `overtimeHours`)
- ✅ Làm chủ nhật (dùng `sundayWorkDays`)

### 3. Tính lương tự động
- ✅ Lương cơ bản (dùng `baseSalary`)
- ✅ Tỷ lệ hưởng lương (dùng `salaryPercentage`)
- ✅ Tính toán theo ngày/tuần/tháng

### 4. Quản lý thông tin nhân sự
- ✅ Thông tin cá nhân đầy đủ
- ✅ Hồ sơ CV có thể tải lên/xem
- ✅ Lịch sử công việc

## 🚀 Cách cập nhật

### Bước 1: Backup dữ liệu hiện tại
```bash
# Sao lưu database hiện tại
cp sample-data.json sample-data-backup.json
```

### Bước 2: Cập nhật từng employee
Sử dụng cấu trúc trong file `employees-complete-structure.json` để cập nhật.

### Bước 3: Cập nhật Firebase Rules
```json
{
  "rules": {
    "employees": {
      "$employeeId": {
        ".validate": "newData.hasChildren(['fullName', 'department', 'position', 'branch', 'active', 'birthday', 'phone', 'email', 'startDate', 'baseSalary', 'salaryPercentage'])"
      }
    }
  }
}
```

## 📱 Code cập nhật trong ứng dụng

### DashboardPage.jsx - Cập nhật hiển thị sinh nhật
```javascript
// Thêm vào phần tính toán birthdayThisMonth
const birthdayThisMonth = Object.values(employees)
  .filter(emp => {
    if (!emp.birthday) return false;
    const birthday = new Date(emp.birthday);
    const currentMonth = new Date().getMonth();
    return birthday.getMonth() === currentMonth;
  })
  .map(emp => ({
    name: emp.fullName,
    position: emp.position,
    branch: emp.branch,
    birthday: emp.birthday
  }));
```

### EmployeesPage.jsx - Thêm form nhập liệu mới
```javascript
// Thêm các trường mới vào form
<input type="date" name="birthday" placeholder="Ngày sinh" />
<input type="tel" name="phone" placeholder="Số điện thoại" />
<input type="email" name="email" placeholder="Email" />
<input type="number" name="baseSalary" placeholder="Lương cơ bản" />
<input type="number" name="salaryPercentage" placeholder="Tỷ lệ lương %" />
```

## 🎯 Lưu ý quan trọng

1. **Bảo mật**: Các trường lương và thông tin cá nhân cần được bảo vệ kỹ
2. **Validation**: Cần validate dữ liệu đầu vào cho các trường mới
3. **Migration**: Cần có script để cập nhật dữ liệu cũ lên cấu trúc mới
4. **Backup**: Luôn backup trước khi thực hiện thay đổi lớn

## 📋 Checklist cập nhật

- [ ] Backup dữ liệu hiện tại
- [ ] Cập nhật cấu trúc employees
- [ ] Cập nhật Firebase rules
- [ ] Cập nhật code DashboardPage.jsx
- [ ] Cập nhật code EmployeesPage.jsx
- [ ] Test thử với dữ liệu mẫu
- [ ] Deploy lên production

## 🔗 File tham khảo
- `employees-complete-structure.json` - Cấu trúc đầy đủ mẫu
- `sample-data.json` - Dữ liệu hiện tại cần cập nhật