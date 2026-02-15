const API =
  window.location.hostname === "localhost"
    ? "http://localhost:10000/api"
    : "https://chuio.io/api";

const params = new URLSearchParams(window.location.search);
const token = window.location.pathname.split("/").filter(Boolean)[0];
let restaurantId = null;
if (!token) {
  alert("Invalid QR");
}

async function loadLanding() {
  const res = await fetch(`${API}/qr/${token}/landing`);
  if (!res.ok) {
    alert("Failed to load table");
    return;
  }

  const data = await res.json();

  // Store for next page
  localStorage.setItem("sessionId", data.session_id);
  localStorage.setItem("tableName", data.table_name);
  localStorage.setItem("restaurantId", data.restaurant_id);
    restaurantId = data.restaurant_id;
    serviceChargePct = data.service_charge_percent;
    console.log(serviceChargePct);
  // Populate UI
  document.getElementById("restaurantName").textContent =
    data.restaurant_name;

  document.getElementById("tableInfo").textContent =
    `${data.table_name} • Pax ${data.pax != null ? data.pax : "-"}`;

  document.getElementById("address").textContent = data.address || "";
  document.getElementById("phone").textContent = data.phone || "";

document.getElementById("start-order-btn").onclick = () =>
  startOrdering();

document.getElementById("check-orders-btn").onclick = () =>
  startOrdering({ openOrders: true });

  if (data.logo_url) {
    const logo = document.getElementById("logo");
    logo.src = data.logo_url;
    logo.style.display = "block";
  }
}

async function startOrdering({ openOrders = false } = {}) {
  document.getElementById("landing-page").style.display = "none";
  document.getElementById("app").style.display = "block";

  document.getElementById("table-indicator").textContent = `Table ${tableName}`;
  document.getElementById("restaurant").textContent = "Welcome";
  document.getElementById("status").textContent = "";

  document
    .getElementById("confirm-order-btn")
    .addEventListener("click", submitOrder);

  document
    .getElementById("orders-btn")
    .addEventListener("click", openOrdersDrawer);

  // load menu
  const menuRes = await fetch(
    `${API_BASE}/restaurants/${restaurantId}/menu`
  );

  window.menu = await menuRes.json();

  renderMenu(window.menu);
  renderCategories(window.menu.categories);

  initDrawerSwipe();
  initOrdersDrawerSwipe();
  initCategoryObserver(window.menu.categories);

  startOrderPolling();
  updateCartBar();

  // 🔥 ONLY NOW open orders if requested
  if (openOrders) {
    openOrdersDrawer();
  }
}

function checkOrders() {
  startOrdering();
  openOrdersDrawer();
}

loadLanding();
