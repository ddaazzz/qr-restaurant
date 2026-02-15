const API_BASE = window.location.origin;
let restaurantId;

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
    localStorage.setItem("userId", data.userId || "");
    sessionStorage.setItem("restaurantId", data.restaurantId);
    
    // Store restaurants list for superadmin
    if (data.restaurants && data.restaurants.length > 0) {
      localStorage.setItem("superadminRestaurants", JSON.stringify(data.restaurants));
    }
    
    if (data.role === "admin" || data.role === "superadmin") {
      window.location.href = "/admin.html";
    } else if (data.role === "staff") {
      window.location.href = "/admin.html";
    } else if (data.role === "kitchen") {
      sessionStorage.setItem("kitchenStaffLogged", "true");
      window.location.href = "/kitchen.html";
    }
  } catch (err) {
    console.error(err);
    document.getElementById("error").innerText = "Server error";
  }
});
