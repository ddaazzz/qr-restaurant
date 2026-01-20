console.log("LOGIN JS LOADED FROM:", window.location.href);

const API_BASE = window.location.origin;


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

    if (data.role === "admin") {
      window.location.href = "/admin.html";
    } else if (data.role === "staff") {
      window.location.href = "/staff.html";
    }
  } catch (err) {
    console.error(err);
    document.getElementById("error").innerText = "Server error";
  }
});
