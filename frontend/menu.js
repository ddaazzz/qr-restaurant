//Swipe
  let touchStartY = 0;
  let touchCurrentY = 0;
  let mouseStartY = 0;
  let mouseCurrentY = 0;
  let dragging = false;
  let activeDrawer = null;

  const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:10000/api"
    : "https://chuio.io/api";

const urlParams = new URLSearchParams(window.location.search);
const IS_STAFF = urlParams.get("staff") === "1";

const qrToken = window.location.pathname.split("/").filter(Boolean)[0];

let sessionId = null;
let tableName = null;
let orderPollerStarted = false;

// cart, variants — unchanged
let cart = { items: [], total: 0 };
const variantSelections = {};

async function initLanding() {
  if (!qrToken) {
    alert("Invalid QR code");
    return;
  }

  const res = await fetch(`${API_BASE}/scan/${qrToken}`, { method: "POST" });
  const session = await res.json();
  sessionId = session.session_id;
  restaurantId = session.restaurant_id;
  tableName = session.table_name;
console.log("Session data:", session);
  // 🔥 Populate landing page
  const logoEl = document.getElementById("landing-logo")
  if (logoEl){
    logoEl.src = session.logo_url || "https://via.placeholder.com/200";
  }

  const nameEl = document.getElementById("landing-restaurant")
  if (nameEl){
    nameEl.textContent = session.restaurant_name;
  }
  const tableNameEl = document.getElementById("landing-table")
  if (tableNameEl){
    tableNameEl.textContent = `Table ${tableName}`;
  }
  const landingInfoEl = document.getElementById("landing-info")
  if (landingInfoEl){
    landingInfoEl.textContent = `${session.address || ""} ${session.phone || ""}`;
  }

  // buttons
  document.getElementById("start-order-btn").onclick = startOrdering;
  document.getElementById("check-orders-btn").onclick = () => {
    startOrdering();
    openOrdersDrawer();
  };
}

async function startOrdering() {
  document.getElementById("landing-page").style.display = "none";
  document.getElementById("app").style.display = "block";

  document.getElementById("table-indicator").textContent = `Table ${tableName}`;
  document.getElementById("restaurant").textContent = "Welcome";
  document.getElementById("status").textContent = "";

  // Cart bar click handlers
  document
    .getElementById("confirm-order-btn")
    .addEventListener("click", openCartDrawer);

  document
    .getElementById("cart-count")
    .addEventListener("click", openCartDrawer);

  document
    .getElementById("cart-total")
    .addEventListener("click", openCartDrawer);

  document
    .getElementById("orders-btn")
    .addEventListener("click", openOrdersDrawer);

  // Overlay click to close drawer
  document
    .getElementById("drawer-overlay")
    .addEventListener("click", closeAllDrawers);

  // 🔥 load menu
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
}

function renderCategories(categories) {
  const catDiv = document.getElementById("categories");
  const menu = document.getElementById("menu");

  catDiv.innerHTML = "";

  categories.forEach(cat => {
    const el = document.createElement("div");
    el.className = "category-item";
    el.textContent = cat.name;
    el.dataset.categoryId = cat.id;

    el.onclick = () => {
      const target = document.getElementById(`category-${cat.id}`);
      if (!target) return;

      // Use scrollIntoView for reliable scrolling
      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      setActiveCategory(cat.id);
    };

    catDiv.appendChild(el);
  });
}

//RenderMenu to put food cards inside grid 
function renderMenu(menu) {
  const container = document.getElementById("menu");
  container.innerHTML = "";

  const { categories, items } = menu;

  categories.forEach(category => {
    // Category title
    const categoryTitle = document.createElement("div");
    categoryTitle.className = "category";
    categoryTitle.id = `category-${category.id}`;
    categoryTitle.textContent = category.name;
    
    container.appendChild(categoryTitle);

    // Grid for items
    const grid = document.createElement("div");
    grid.className = "menu-grid";

    const categoryItems = items.filter(
      item => item.category_id === category.id
    );  
    console.log(menu);

    categoryItems.forEach(item => {
      const itemEl = renderMenuItem(item);
      grid.appendChild(itemEl);
    });

    container.appendChild(grid);
  });
}

//Clicking an item navigates to detail page
function renderMenuItem(item) {
  const card = document.createElement("div");
  card.className = "menu-item";

 card.innerHTML = `
  <img src="${item.image_url || "https://via.placeholder.com/300"}" />

  <div class="menu-item-name">${item.name}</div>

  <div class="menu-item-footer">
    <span class="menu-item-price">
      $${(item.price_cents / 100).toFixed(2)}
    </span>
    <span class="menu-item-arrow">›</span>
  </div>
`;

  card.onclick = () => openDrawer(item.id);




  return card;



}//Render

function renderMenuItemWithVariants(item){
    const card = document.createElement("div");
    card.className = "drawer-item";

    card.innerHTML = `
    <img src="${item.image_url || "https://via.placeholder.com/300"}"/>

    <div class="menu-item-content">
      <div class="menu-item-name">${item.name}</div>
      <div class="menu-item-price">
        $${(item.price_cents / 100).toFixed(2)}
      </div>
      ${item.description ? `<div class="menu-item-desc">${item.description}</div>` : ""}
    </div>
  `;

  const content = card.querySelector(".menu-item-content");

    // Add variants
    if (Array.isArray(item.variants)) {
  item.variants.forEach(v => {
        const vContainer = document.createElement("div");
        vContainer.className = "variant-group";

        vContainer.innerHTML = `
          <div class="variant-title">
            <strong>
              ${v.name}
              ${v.required ? `<span style="color:red;"> *</span>` : ""}
            </strong>
            <small id="variant-counter-${item.id}-${v.id}" style="margin-left:6px;color:#666;">
              ${
                v.min_select === v.max_select && v.min_select !== null
                  ? `(select ${v.min_select})`
                  : v.max_select
                  ? `(select ${v.min_select ?? 0}–${v.max_select})`
                  : v.min_select
                  ? `(select at least ${v.min_select})`
                  : `(optional)`
              }
            </small>
          </div>
        `;



        (v.options || [])
        .filter(o => o.is_available)
        .forEach(o => {
        const opt = document.createElement("label");

        opt.innerHTML = `
          <input
            type="checkbox"
            value="${o.id}"
            data-item-id="${item.id}"
            data-variant-id="${v.id}"
             ${
    variantSelections[item.id]?.[v.id]?.includes(o.id)
      ? "checked"
      : ""}
            onchange="onVariantChange(${item.id}, ${v.id}, ${o.id}, this.checked)"
          />
          <span>
          ${o.name}
          ${o.price_cents > 0 ? `(+$${(o.price_cents / 100).toFixed(2)})` : ""}
          </span>
        `;
      

        vContainer.appendChild(opt);       

      });

content.appendChild(vContainer);
    });
  }

 // ---------- ADD TO CART BUTTON ----------
  const addBtn = document.createElement("button");
  addBtn.className = "add-btn";
  addBtn.textContent = "Add to Cart";
  addBtn.dataset.itemId = item.id;
  addBtn.disabled = !canAddToCart(item);
  addBtn.onclick = () => addToCart(item);

  content.appendChild(addBtn);

  return card;


}

function setActiveCategory(categoryId) {
  document.querySelectorAll(".category-item").forEach(el => {
    el.classList.remove("active");
  });

  const active = document.querySelector(
    `.category-item[data-category-id="${categoryId}"]`
  );

  if (active) active.classList.add("active");
}

function initCategoryObserver(categories) {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id.replace("category-", "");
          setActiveCategory(id);
        }
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );

  categories.forEach(cat => {
    const el = document.getElementById(`category-${cat.id}`);
    if (el) observer.observe(el);
  });
}

function addToCart(item) {
  const selectedOptions = [];
  const variantDetails = [];
  let extraPrice = 0;
    if (Array.isArray(item.variants)) {
  item.variants.forEach(v => {
  const selectedIds = variantSelections[item.id]?.[v.id] || [];

 if (v.required && selectedIds.length === 0) {
  alert(`Please select ${v.name}`);
  throw new Error("Missing required variant");
}

if (v.max_select && selectedIds.length > v.max_select) {
  alert(`You can only select ${v.max_select} for ${v.name}`);
  throw new Error("Too many selections");
}

  selectedIds.forEach(optionId => {
    const option = v.options.find(o => o.id === optionId);

    selectedOptions.push(optionId);
    variantDetails.push({
      variant: v.name,
      option: option.name
    });

    extraPrice += option.price_cents || 0;
  });
});
    }


  const existing = cart.items.find(
    c =>
      c.menuItemId === item.id &&
      JSON.stringify(c.variantOptionIds) === JSON.stringify(selectedOptions)
  );

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.items.push({
  menuItemId: item.id,
  name: item.name,
  quantity: 1,
  basePriceCents: item.price_cents,
  totalPriceCents: item.price_cents + extraPrice,
  variantOptionIds: selectedOptions,
  variantOptionDetails: variantDetails
});

  }
  closeAllDrawers();
  updateCartBar();

}

function canAddToCart(item) {
  if (!item.variants || item.variants.length === 0) return true;

  for (const v of item.variants) {
    const selected =
      variantSelections[item.id]?.[v.id]?.length || 0;

    const min = v.min_select ?? (v.required ? 1 : 0);

    if (selected < min) {
      return false;
    }
  }

  return true;
}

function updateAddToCartButton(item) {
  const btn = document.querySelector(
    `button[data-item-id="${item.id}"]`
  );

  if (!btn) return;

  btn.disabled = !canAddToCart(item);
}

function updateVariantCounter(itemId, variant) {
  const selected =
    variantSelections[itemId]?.[variant.id] || [];

  const count = selected.length;

  const counterEl = document.getElementById(
    `variant-counter-${itemId}-${variant.id}`
  );

  if (counterEl) {
    if (variant.max_select) {
      counterEl.textContent = `${count} / ${variant.max_select} selected`;
    } else {
      counterEl.textContent = `${count} selected`;
    }
  }

  // 🔥 THIS IS THE MISSING PART 🔥
  const inputs = document.querySelectorAll(
    `input[data-item-id="${itemId}"][data-variant-id="${variant.id}"]`
  );

  // 1️⃣ ALWAYS reset disabled state first
  inputs.forEach(input => {
    input.removeAttribute("disabled");
    input.disabled = false;
  });

  // 2️⃣ Apply max_select rule ONLY if max reached
  if (variant.max_select && count >= variant.max_select) {
    inputs.forEach(input => {
      const optionId = Number(input.value);
      if (!selected.includes(optionId)) {
        input.disabled = true;
      }
    });
  }
}

async function submitOrder() {
  if (!cart.items.length) return;

  const payload = {
    items: cart.items.map(i => ({
      menu_item_id: i.menuItemId,
      quantity: i.quantity,
      selected_option_ids: i.variantOptionIds || []
    }))
  };

  const res = await fetch(
    `${API_BASE}/${sessionId}/orders`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  if (!res.ok) {
    const err = await res.json();
    alert(err.error || "Order failed");
    return;
  }

    cart.items = [];
    updateCartBar();
    closeAllDrawers();
    alert("Order sent to kitchen!");

}

function onVariantChange(itemId, variantId, optionId, checked) {
  if (!variantSelections[itemId]) {
    variantSelections[itemId] = {};
  }

  const item = window.menu.items.find(i => i.id === itemId);
  const variant = item.variants.find(v => v.id === variantId);

  let selected = variantSelections[itemId][variantId] || [];

  // ------------------------------
  // EXACT MODE (min === max)
  // ------------------------------
  if (
    variant.min_select !== null &&
    variant.max_select !== null &&
    variant.min_select === variant.max_select
  ) {
    if (checked) {
      selected = [optionId];

      // force UI sync
      document
        .querySelectorAll(
          `input[data-item-id="${itemId}"][data-variant-id="${variantId}"]`
        )
        .forEach(input => {
          input.checked = Number(input.value) === optionId;
        });
    } else {
      // prevent unchecking below min
      selected = [];
    }
  }

  // ------------------------------
  // NORMAL MULTI MODE
  // ------------------------------
  else {
    if (checked) {
      if (variant.max_select && selected.length >= variant.max_select) {
        // undo UI change
        const input = document.querySelector(
          `input[data-item-id="${itemId}"][data-variant-id="${variantId}"][value="${optionId}"]`
        );
        if (input) input.checked = false;
        return;
      }
      selected.push(optionId);
    } else {
      selected = selected.filter(id => id !== optionId);
    }
  }

  variantSelections[itemId][variantId] = selected;

  // ------------------------------
  // Disable unchecked when max reached
  // ------------------------------
if (variant.max_select) {
  document
    .querySelectorAll(
      `input[data-item-id="${itemId}"][data-variant-id="${variantId}"]`
    )
    .forEach(input => {
      const id = Number(input.value);

    });
}


  updateVariantCounter(itemId, variant);
  updateAddToCartButton(item);
}

async function loadOrderStatus() {
  if (!sessionId) return;

  const res = await fetch(
    `${API_BASE}/${sessionId}/orders`
  );

  if (!res.ok) return;

  const data = await res.json();
  renderOrdersDrawer(data.items || [],tableName);
}

function renderOrdersDrawer(orders, tableName) {
  const el = document.getElementById("orders-drawer-content");
  if (!el) return;

  let subtotal = 0;

  // Drawer header
  let html = `
    <div class="orders-drawer-header">
      <button class="hide-drawer" onclick="closeAllDrawers()">Hide</button>
      <div class="orders-title">Active Orders</div>
      <div class="table-name">Table ${tableName}</div>
    </div>
    <div class="orders-items">
  `;

  if (!orders.length) {
    html += `<p class="no-orders">No orders yet</p>`;
  } else {
    orders.forEach(order => {
      order.items.forEach(item => {
        const line = item.total_price_cents;
        subtotal += line;

        html += `
          <div class="order-item">
            <div class="order-line">
              <span class="item-name">${item.name}</span>
              <span class="item-quantity">×${item.quantity}</span>
              <span class="item-price">$${(line / 100).toFixed(2)}</span>
            </div>
            ${item.variants ? `<div class="item-variants">${item.variants}</div>` : ""}
            <div class="item-status status-${item.status}">(${item.status})</div>
          </div>
        `;
      });
    });
  }
  serviceCharge = subtotal/100 * serviceChargePct;
  const total = subtotal + serviceCharge;

  html += `
    </div>
    <hr/>
    <div class="orders-summary">
      <div class="summary-line">
        <span>Subtotal</span>
        <span>$${(subtotal / 100).toFixed(2)}</span>
      </div>
      <div class="summary-line">
        <span>Service Charge (${serviceChargePct}%)</span>
        <span>$${(serviceCharge / 100).toFixed(2)}</span>
      </div>
      <div class="summary-line total">
        <strong>Total</strong>
        <strong id="orders-total-display">$${(total / 100).toFixed(2)}</strong>
      </div>
    </div>
    <div class="coupon-section">
      <input type="text" id="orders-coupon-input" placeholder="Enter coupon code" />
      <button onclick="applyCouponToOrders()" class="btn-secondary">Apply Coupon</button>
      <div id="orders-coupon-display"></div>
    </div>
    <div class="orders-actions">
      <button class="btn-primary" onclick="printMenuBill()">🖨 Print Bill</button>
      <button class="btn-secondary" onclick="closeAllDrawers()">Close</button>
    </div>
  `;

  el.innerHTML = html;
}

function renderCartDrawer() {
  const el = document.getElementById("cart-drawer-content");

  if (!cart.items.length) {
    el.innerHTML = '<div class="empty-cart"><p>Your cart is empty</p></div>';
    return;
  }

  let total = 0;

  let html = '<div class="cart-items">';
  html += cart.items.map((item, idx) => {
    const line = item.totalPriceCents * item.quantity;
    total += line;

    return `
      <div class="cart-item">
        <div class="cart-item-header">
          <strong>${item.name}</strong>
          <span class="cart-item-price">$${(line / 100).toFixed(2)}</span>
        </div>
        ${item.variantOptionDetails?.map(v => `<div class="cart-item-variant">${v.variant}: ${v.option}</div>`).join("") || ""}
        <div class="qty-controls">
          <button class="qty-btn" onclick="updateCartQty(${idx}, -1)">−</button>
          <span class="qty-display">${item.quantity}</span>
          <button class="qty-btn" onclick="updateCartQty(${idx}, 1)">+</button>
          <button class="qty-btn danger" onclick="removeCartItem(${idx})">🗑</button>
        </div>
      </div>
    `;
  }).join("");
  html += '</div>';

  html += `
    <div class="cart-footer">
      <div class="coupon-section">
        <input type="text" id="cart-coupon-input" placeholder="Enter coupon code" />
        <button onclick="applyCouponToCart()" class="btn-secondary">Apply Coupon</button>
        <div id="cart-coupon-display"></div>
      </div>
      <div class="cart-total">
        <span>Total:</span>
        <strong id="cart-total-display">$${(total / 100).toFixed(2)}</strong>
      </div>
      <button class="btn-primary cart-submit" onclick="submitOrder()">Confirm Order</button>
    </div>
  `;

  el.innerHTML = html;
}

function updateCartQty(index, delta) {
  const item = cart.items[index];
  if (!item) return;

  item.quantity += delta;

  if (item.quantity <= 0) {
    cart.items.splice(index, 1);
  }

  updateCartBar();
  renderCartDrawer();
}

function removeCartItem(index) {
  cart.items.splice(index, 1);
  updateCartBar();
  renderCartDrawer();
}

function openCartDrawer() {
    closeAllDrawers();

  activeDrawer = document.getElementById("cart-drawer");
  const overlay = document.getElementById("drawer-overlay");

  activeDrawer.classList.add("open");
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";

  renderCartDrawer();
  initDrawerSwipe("cart-drawer");
}

function updateCartBar() {
  const btn = document.getElementById("confirm-order-btn");
  const countEl = document.getElementById("cart-count");
  const totalEl = document.getElementById("cart-total");

  const count = cart.items.reduce((s, i) => s + i.quantity, 0);
  const totalCents = cart.items.reduce(
    (sum, i) => sum + i.totalPriceCents * i.quantity,
    0
  );

  countEl.textContent = `${count} item${count !== 1 ? "s" : ""}`;
  totalEl.textContent = `$${(totalCents / 100).toFixed(2)}`;

  btn.disabled = count === 0;
}

function openDrawer(itemId) {

    closeAllDrawers();
  

  const item = window.menu.items.find(i => i.id === itemId);
  if (!item) return;

  activeDrawer = document.getElementById("item-drawer");
   const overlay = document.getElementById("drawer-overlay");
  const content = activeDrawer.querySelector(".drawer-content");

  content.innerHTML = ""; // FULL RESET

  const itemUI = renderMenuItemWithVariants(item);
  itemUI.classList.add("drawer-item"); // important
  content.appendChild(itemUI);

  overlay.classList.add("open");
  activeDrawer.classList.add("open");
  activeDrawer.style.transform = ""; // Reset transform before opening

  document.body.style.overflow = "hidden";

  content.scrollTop = 0;
}

function initDrawerSwipe(drawerId = "item-drawer") {
  const drawer = document.getElementById(drawerId);
  if (!drawer || drawer.dataset.swipeInit) return;

  drawer.dataset.swipeInit = "true";

  if (isTouchDevice()) {
    initTouchSwipe(drawer);
  } else {
    initMouseSwipe(drawer);
  }
}

function openOrdersDrawer() {
  closeAllDrawers();

  activeDrawer = document.getElementById("orders-drawer");
  const overlay = document.getElementById("drawer-overlay");

  activeDrawer.classList.add("open");
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";

  // 🔥 render immediately using latest polled data
  loadOrderStatus();
}



function initOrdersDrawerSwipe() {
  const drawer = document.getElementById("orders-drawer");
  if (!drawer || drawer.dataset.swipeInit) return;

  drawer.dataset.swipeInit = "true";

  if (isTouchDevice()) {
    initTouchSwipe(drawer);
  } else {
    initMouseSwipe(drawer);
  }
}

function isInteractiveElement(el) {
  return (
    el.tagName === "INPUT" ||
    el.tagName === "LABEL" ||
    el.tagName === "BUTTON" ||
    el.closest(".variant-group")
  );
}

function isTouchDevice() {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0
  );
}

function initTouchSwipe(drawer) {
  drawer.addEventListener("touchstart", e => {
    if (drawer !== activeDrawer) return;
    if (isInteractiveElement(e.target)) return;

    touchStartY = e.touches[0].clientY;
    drawer.style.transition = "none";
  }, { passive: true });

  drawer.addEventListener("touchmove", e => {
    if (drawer !== activeDrawer) return;
    if (isInteractiveElement(e.target)) return;

    touchCurrentY = e.touches[0].clientY;
    const delta = touchCurrentY - touchStartY;
    if (delta < 0) return;

    drawer.style.transform = `translateX(-50%) translateY(${delta}px)`;
    e.preventDefault();
  }, { passive: false });

  drawer.addEventListener("touchend", () => {
    if (drawer !== activeDrawer) return;

    const delta = touchCurrentY - touchStartY;
    drawer.style.transition = "transform 0.25s ease";

    if (delta > 120) {
      closeActiveDrawer();
    } else {
      drawer.style.transform = "";
    }
  });
}

function initMouseSwipe(drawer) {
  drawer.addEventListener("mousedown", e => {
    if (drawer !== activeDrawer) return;

    dragging = true;
    mouseStartY = e.clientY;
    drawer.style.transition = "none";
  });

  window.addEventListener("mousemove", e => {
    if (!dragging || drawer !== activeDrawer) return;

    mouseCurrentY = e.clientY;
    const delta = mouseCurrentY - mouseStartY;
    if (delta < 0) return;

    drawer.style.transform = `translateX(-50%) translateY(${delta}px)`;
  });

  window.addEventListener("mouseup", () => {
    if (!dragging || drawer !== activeDrawer) return;

    dragging = false;
    const delta = mouseCurrentY - mouseStartY;

    drawer.style.transition = "transform 0.25s ease";

    if (delta > 120) {
      closeActiveDrawer();
    } else {
      drawer.style.transform = "";
    }
  });
}

function closeAllDrawers() {
  ["item-drawer", "orders-drawer", "cart-drawer"].forEach(id => {
    const d = document.getElementById(id);
    if (!d) return;
    d.classList.remove("open");
    d.style.transform = "";
  });

  document.getElementById("drawer-overlay")?.classList.remove("open");
  document.body.style.overflow = "";
  activeDrawer = null;
}

function closeActiveDrawer() {
  if (!activeDrawer) return;

  activeDrawer.classList.remove("open");
  activeDrawer.style.transform = "";

  document.getElementById("drawer-overlay")?.classList.remove("open");
  document.body.style.overflow = "";

  activeDrawer = null;
}

function startOrderPolling() {
  if (orderPollerStarted) return;
  orderPollerStarted = true;

  loadOrderStatus(); // immediate
  setInterval(loadOrderStatus, 5000);
}

// ============= COUPON FUNCTIONS =============
function applyCouponToCart() {
  const couponCode = document.getElementById("cart-coupon-input").value.trim().toUpperCase();
  if (!couponCode) {
    alert("Please enter a coupon code");
    return;
  }
  
  // Store coupon in session storage for use during order submission
  sessionStorage.setItem("pendingCouponCode", couponCode);
  
  // Display applied coupon
  const displayEl = document.getElementById("cart-coupon-display");
  displayEl.innerHTML = `<div class="coupon-applied">✓ Coupon "${couponCode}" will be applied at checkout</div>`;
}

function applyCouponToOrders() {
  const couponCode = document.getElementById("orders-coupon-input").value.trim().toUpperCase();
  if (!couponCode) {
    alert("Please enter a coupon code");
    return;
  }
  
  // Get current session ID from somewhere (may need to modify based on your app structure)
  const sessionId = sessionStorage.getItem("sessionId");
  if (!sessionId) {
    alert("Session not found");
    return;
  }
  
  applyCouponToSession(sessionId, couponCode);
}

async function applyCouponToSession(sessionId, couponCode) {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/apply-coupon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coupon_code: couponCode })
    });
    
    const data = await response.json();
    const displayEl = document.getElementById("orders-coupon-display");
    
    if (response.ok) {
      displayEl.innerHTML = `<div class="coupon-applied">✓ Coupon applied: ${data.message}</div>`;
      // Refresh orders to show updated total
      loadOrdersDrawer();
    } else {
      displayEl.innerHTML = `<div class="coupon-error">✗ ${data.error}</div>`;
    }
  } catch (error) {
    console.error("Error applying coupon:", error);
    document.getElementById("orders-coupon-display").innerHTML = `<div class="coupon-error">✗ Failed to apply coupon</div>`;
  }
}

async function removeCouponFromSession(sessionId) {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/remove-coupon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    
    if (response.ok) {
      document.getElementById("orders-coupon-input").value = "";
      document.getElementById("orders-coupon-display").innerHTML = "";
      loadOrdersDrawer();
    }
  } catch (error) {
    console.error("Error removing coupon:", error);
  }
}

async function printMenuBill() {
  if (!sessionId) {
    alert("Session not found");
    return;
  }
  
  try {
    const res = await fetch(`/api/sessions/${sessionId}/bill`);
    if (!res.ok) return alert("Failed to load bill");

    const bill = await res.json();
    const win = window.open("", "_blank");
    
    let itemsHTML = '';
    bill.items.forEach(i => {
      const lineTotal = (i.unit_price_cents * i.quantity / 100).toFixed(2);
      itemsHTML += `<div class="item-row"><div class="item-name">${i.item_name}</div><div class="item-qty">x${i.quantity}</div><div class="item-price">$${lineTotal}</div></div>`;
    });
    
    const serviceChargeHTML = bill.service_charge_cents ? `<div class="summary-row"><span>Service Charge:</span><span>$${(bill.service_charge_cents / 100).toFixed(2)}</span></div>` : '';
    const discountHTML = bill.discount_applied_cents ? `<div class="summary-row discount"><span>Discount:</span><span>-$${(bill.discount_applied_cents / 100).toFixed(2)}</span></div>` : '';
    
    const billHTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Receipt</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Courier New', monospace; width: 300px; padding: 12px; background: #fff; }
      .receipt { width: 100%; text-align: center; font-size: 13px; line-height: 1.4; }
      .header { border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
      .logo { max-width: 60px; margin: 0 auto 6px; height: auto; }
      .restaurant-name { font-weight: bold; font-size: 16px; margin-bottom: 4px; }
      .restaurant-info { font-size: 11px; color: #333; margin-bottom: 2px; }
      .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
      .items { text-align: left; margin: 8px 0; }
      .item-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
      .item-name { flex: 1; }
      .item-qty { text-align: center; min-width: 30px; margin: 0 4px; }
      .item-price { text-align: right; min-width: 50px; font-weight: bold; }
      .summary { border-top: 2px dashed #000; padding-top: 6px; margin-top: 8px; }
      .summary-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; }
      .summary-row.subtotal { border-bottom: 1px dashed #000; padding-bottom: 3px; }
      .summary-row.discount { color: #059669; font-weight: bold; }
      .summary-row.total { font-size: 16px; font-weight: bold; margin-top: 3px; }
      .footer { margin-top: 10px; font-size: 10px; color: #666; border-top: 1px dashed #000; padding-top: 6px; }
      .thank-you { font-weight: bold; margin-top: 4px; }
      @media print { body { margin: 0; padding: 0; } .receipt { width: 100%; } }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="header">
        ${bill.restaurant.logo_url ? `<img src="${bill.restaurant.logo_url}" class="logo" alt="Logo"/>` : ''}
        <div class="restaurant-name">${bill.restaurant.name}</div>
        <div class="restaurant-info">${bill.restaurant.address}</div>
        <div class="restaurant-info">${bill.restaurant.phone}</div>
      </div>
      <div class="divider"></div>
      <div class="items">${itemsHTML}</div>
      <div class="summary">
        <div class="summary-row subtotal">
          <span>Subtotal:</span>
          <span>$${(bill.subtotal_cents / 100).toFixed(2)}</span>
        </div>
        ${serviceChargeHTML}
        ${discountHTML}
        <div class="summary-row total">
          <span>TOTAL:</span>
          <span>$${(bill.total_cents / 100).toFixed(2)}</span>
        </div>
      </div>
      <div class="footer">
        <div>Thank you for your visit!</div>
        <div class="thank-you">Come Again!</div>
      </div>
    </div>
    <script>
      window.print();
      window.onafterprint = () => window.close();
    </script>
  </body>
</html>`;
    
    win.document.write(billHTML);
  } catch (error) {
    console.error("Error printing bill:", error);
    alert("Failed to print bill");
  }
}

  initLanding();
