const API_BASE = window.location.origin;
let restaurantId;

// Reset menu background when on login page
if (window.resetMenuBackground) {
  window.resetMenuBackground();
}

function showDestinationChoice() {
  var form = document.getElementById("loginForm");
  if (form) form.style.display = "none";
  var err = document.getElementById("error");
  if (err) err.style.display = "none";

  var choice = document.createElement("div");
  choice.id = "destination-choice";
  choice.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:16px;padding:8px 0;";
  choice.innerHTML = [
    '<p style="font-size:15px;color:#555;margin:0 0 4px;text-align:center;">登入成功！請選擇前往<br><small style="color:#999;">Login successful. Choose your destination.</small></p>',
    '<div style="display:flex;gap:14px;width:100%;">',
    '  <button onclick="window.location.href=\'/admin.html\'" style="flex:1;padding:18px 10px;background:#fff;border:2px solid #e0e0e0;border-radius:12px;cursor:pointer;transition:border-color .2s;" onmouseover="this.style.borderColor=\'#A10035\'" onmouseout="this.style.borderColor=\'#e0e0e0\'">',
    '    <div style="font-size:26px;margin-bottom:6px;">⚙️</div>',
    '    <div style="font-weight:700;font-size:14px;color:#222;">Admin Portal</div>',
    '    <div style="font-size:11px;color:#888;margin-top:3px;">訂單 · 桌台 · 廚房</div>',
    '  </button>',
    '  <button onclick="window.location.href=\'/console.html\'" style="flex:1;padding:18px 10px;background:#fff;border:2px solid #A10035;border-radius:12px;cursor:pointer;transition:background .2s;" onmouseover="this.style.background=\'#A10035\';this.style.color=\'#fff\'" onmouseout="this.style.background=\'#fff\';this.style.color=\'#222\'">',
    '    <div style="font-size:26px;margin-bottom:6px;">🖥️</div>',
    '    <div style="font-weight:700;font-size:14px;color:inherit;">Web Console</div>',
    '    <div style="font-size:11px;color:inherit;opacity:.7;margin-top:3px;">CRM · 菜單 · 桌台管理</div>',
    '  </button>',
    '</div>',
  ].join("");

  var container = form ? form.parentNode : document.body;
  container.appendChild(choice);
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      document.getElementById("error").innerText = data.error;
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("restaurantId", data.restaurantId);
    localStorage.setItem("userId", data.userId || data.user_id || "");
    sessionStorage.setItem("restaurantId", data.restaurantId);
    
    // Store restaurants list for superadmin
    if (data.restaurants && data.restaurants.length > 0) {
      localStorage.setItem("superadminRestaurants", JSON.stringify(data.restaurants));
    }

    // Store access_rights for staff/kitchen
    if (data.access_rights) {
      localStorage.setItem("accessRights", JSON.stringify(data.access_rights));
    }
    
    if (data.role === "admin" || data.role === "superadmin") {
      // Show destination choice
      showDestinationChoice();
      return;
    } else if (data.role === "staff") {
      window.location.href = `/staff.html?rid=${data.restaurantId}`;
    } else if (data.role === "kitchen") {
      sessionStorage.setItem("kitchenStaffLogged", "true");
      window.location.href = `/kitchen.html?rid=${data.restaurantId}`;
    }
  } catch (err) {
    console.error(err);
    document.getElementById("error").innerText = "Server error";
  }
});
