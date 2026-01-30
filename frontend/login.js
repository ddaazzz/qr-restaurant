console.log("LOGIN JS LOADED FROM:", window.location.href);

const API_BASE = window.location.origin;
let restaurantId;

console.log("API_BASE:", API_BASE);

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
    sessionStorage.setItem("restaurantId", data.restaurantId);
    
    // Store restaurants list for superadmin
    if (data.restaurants && data.restaurants.length > 0) {
      localStorage.setItem("superadminRestaurants", JSON.stringify(data.restaurants));
    }
    
    console.log("LOGIN SUCCESS - Role:", data.role, "RestaurantId:", data.restaurantId);
    
    if (data.role === "admin" || data.role === "superadmin") {
      console.log("Redirecting to admin.html");
      window.location.href = "/admin.html";
    } else if (data.role === "staff") {
      console.log("Redirecting to admin.html (staff)");
      window.location.href = "/admin.html";
    } else if (data.role === "kitchen") {
      console.log("Redirecting to kitchen.html");
      sessionStorage.setItem("kitchenStaffLogged", "true");
      window.location.href = "/kitchen.html";
    } else {
      console.log("Unknown role:", data.role);
      document.getElementById("error").innerText = "Unknown role. Please contact support.";
    }
  } catch (err) {
    console.error(err);
    document.getElementById("error").innerText = "Server error";
  }
});

