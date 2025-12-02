const ALLOWED_ORIGIN = "https://up-care.vercel.app";

export function initSSOListener(handlers) {
  if (typeof window === "undefined") return;

  console.log("🔗 SSO Listener initialized for UP Care");

  window.addEventListener("message", async (event) => {
    console.log("📨 Received message from:", event.origin, event.data);
    
    // Chỉ chấp nhận message từ UP Care
    if (event.origin !== ALLOWED_ORIGIN) {
      console.log("⚠️ Ignored message from unknown origin:", event.origin);
      return;
    }

    const { type, email, password } = event.data || {};

    console.log("🔐 SSO Message type:", type);

    switch (type) {
      case "SSO_LOGIN":
        console.log("🔑 SSO Login attempt for:", email);
        try {
          await handlers.onLogin(email, password);
          console.log("✅ SSO Login thành công!");
          window.parent.postMessage(
            { type: "SSO_LOGIN_SUCCESS", email },
            ALLOWED_ORIGIN
          );
        } catch (error) {
          console.error("❌ SSO Login thất bại:", error.message);
          window.parent.postMessage(
            { type: "SSO_LOGIN_ERROR", error: error.message },
            ALLOWED_ORIGIN
          );
        }
        break;

      case "SSO_LOGOUT":
        console.log("🚪 SSO Logout request");
        try {
          await handlers.onLogout();
          console.log("✅ SSO Logout thành công!");
        } catch (error) {
          console.error("❌ SSO Logout thất bại:", error.message);
        }
        break;
      
      default:
        if (type) {
          console.log("⚠️ Unknown SSO message type:", type);
        }
    }
  });
}
