import { initSSOListener } from "./ssoListener";
import { getDb } from "./firebaseClient";

async function handleLogin(email, password) {
  console.log("🔄 SSO handleLogin called with:", email);
  const { database, ref, get } = await getDb();

  let employeeData = null;
  let foundId = null;

  const employeesRef = ref(database, "employees");
  const snapshot = await get(employeesRef);

  if (snapshot.exists()) {
    const allEmployees = snapshot.val();
    const searchEmail = email.toLowerCase().trim();

    for (const [id, emp] of Object.entries(allEmployees)) {
      if (emp.email && emp.email.toLowerCase() === searchEmail) {
        foundId = id;
        employeeData = emp;
        break;
      }
    }
  }

  if (!employeeData) {
    throw new Error("Email không tồn tại trong hệ thống");
  }

  const storedPassword = employeeData.password || "123456";
  if (storedPassword !== password) {
    throw new Error("Mật khẩu không đúng");
  }

  if (employeeData.active === false) {
    throw new Error("Tài khoản đã bị vô hiệu hóa");
  }

  // Lưu session
  localStorage.setItem("employeeSessionId", foundId);
  localStorage.setItem("employeeSessionName", employeeData.fullName);

  // Kiểm tra Position - nếu là CEO&FOUNDER thì set admin session
  const position = employeeData.position || "";
  if (position.toUpperCase() === "CEO&FOUNDER") {
    localStorage.setItem("adminSession", "true");
  }

  // Reload để cập nhật UI
  window.location.reload();
}

async function handleLogout() {
  localStorage.removeItem("employeeSessionId");
  localStorage.removeItem("employeeSessionName");
  localStorage.removeItem("adminSession");
  window.location.reload();
}

// Khởi tạo listener
initSSOListener({
  onLogin: handleLogin,
  onLogout: handleLogout,
});
