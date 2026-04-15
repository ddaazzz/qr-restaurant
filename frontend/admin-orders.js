// ============= ORDERS MODULE =============
// Order management for staff to place customer orders
// HTML templates are organized in "HTML TEMPLATE BUILDERS" section at end of file

// Global state for orders
let ORDERS_CART = [];
let ORDERS_CART_EDIT_MODE = false;
let ORDERS_TABLES = [];
let CURRENT_ORDER_TYPE = null;
let ORDERS_CATEGORIES = [];
let SELECTED_ORDERS_CATEGORY = null;
let ORDER_HISTORY_FILTER = 'all'; // Filter for order history tabs: 'all', 'table', 'order-now', 'to-go'
let ALL_ORDERS_DATA = []; // Store all orders for filtering
let ORDERS_MENU_ITEMS = [];
let ORDERS_HISTORY_MODE = false;
let VIEWING_HISTORICAL_ORDER = null;
let _historyRefreshInterval = null;
let EDITING_EXISTING_ORDER_ID = null;
let EDITING_EXISTING_SESSION_ID = null;

// Initialization gate
let ordersInitialized = false;

// ========== INITIALIZE ORDERS ==========
async function initializeOrders() {
  // If returning to the orders section while history mode is active, refresh the list
  if (ORDERS_HISTORY_MODE) {
    loadOrdersHistoryLeftPanel();
  }

  // Always load categories and menu items together using the combined /menu endpoint
  await loadOrdersMenu();
  
  // Always load tables for table selection
  await loadOrdersTables();

  // Load active KPay terminal config (for close-bill KPay option + order history actions)
  if (typeof loadActiveKPayTerminal === 'function') {
    loadActiveKPayTerminal();
  } else {
    // Fallback if admin-tables.js not loaded yet
    try {
      const rid = restaurantId || localStorage.getItem('restaurantId');
      if (rid) {
        const resp = await fetch(`${API}/restaurants/${rid}/kpay-terminal/active`);
        if (resp.ok) {
          const data = await resp.json();
          window._kpayTerminal = data.configured ? data.terminal : null;
        }
      }
    } catch { window._kpayTerminal = null; }
  }

  // Attach event listeners only once
  if (!ordersInitialized) {
    ordersInitialized = true;
    attachEventListeners();
  }

  // Restore cart header if in edit mode
  updateCartOrderHeader();

  // Handle pending table order (from orderForTable in admin-tables.js)
  if (window._pendingOrderForTable) {
    const pending = window._pendingOrderForTable;
    window._pendingOrderForTable = null;

    // Pre-select table type and table
    const tableRadio = document.getElementById('order-type-table');
    if (tableRadio) { tableRadio.checked = true; updateOrderTypeUI(); }
    const tableSelect = document.getElementById('order-table-select');
    if (tableSelect && pending.tableId) {
      tableSelect.value = pending.tableId;
    }

    // Show cart panel
    const cartPanel = document.getElementById('orders-cart-view-container');
    if (cartPanel && !cartPanel.classList.contains('show-cart')) toggleCartPanel();
  }
}

// ========== ATTACH EVENT LISTENERS ==========
function attachEventListeners() {
  // Language change listener
  window.addEventListener('languageChanged', () => {
    console.log('[Orders] Language changed - re-rendering tabs');
    renderOrdersCategoryBar();
  });
  
  // Escape key handler for cart
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const cartPanel = document.getElementById('orders-cart-view-container');
      if (cartPanel && cartPanel.classList.contains('show-cart')) {
        toggleCartPanel();
      }
    }
  });
}

// ========== ORDER ITEM MANAGEMENT ==========
async function updateOrderItem(orderItemId, quantity) {
  const res = await fetch(`${API}/order-items/${orderItemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity, restaurantId })
  });

  if (!res.ok) {
    const err = await res.json();
    return alert(err.error || "Failed to update item");
  }

  if (ACTIVE_SESSION_ID) {
    loadAndRenderOrders(ACTIVE_SESSION_ID);
  }
}

async function removeOrderItem(orderItemId) {
  if (!confirm("Remove this item?")) return;

  const res = await fetch(`${API}/order-items/${orderItemId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId })
  });

  if (!res.ok) {
    const err = await res.json();
    return alert(err.error || "Failed to delete item");
  }
  if (ACTIVE_SESSION_ID) {
    loadAndRenderOrders(ACTIVE_SESSION_ID);
  }
}

// ========== LOAD MENU (CATEGORIES + ITEMS) ==========
async function loadOrdersMenu() {
  try {
    const url = `${API}/restaurants/${restaurantId}/menu`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("❌ API Error Response:", {
        status: response.status,
        statusText: response.statusText,
        body: errorBody.substring(0, 500)
      });
      throw new Error(`Failed to load menu - Status: ${response.status} ${response.statusText}`);
    }
    
    const menuData = await response.json();
    
    // Extract categories and items from response
    ORDERS_CATEGORIES = menuData.categories || [];
    ORDERS_MENU_ITEMS = menuData.items || [];
    
    // Set first category as selected if none selected
    if (!SELECTED_ORDERS_CATEGORY && ORDERS_CATEGORIES.length) {
      SELECTED_ORDERS_CATEGORY = ORDERS_CATEGORIES[0];
    }
    
    // Render the menu items
    renderOrdersMenuItems();
  } catch (err) {
    console.error('❌ Error loading menu:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack
    });
  }
}

function renderOrdersMenuItems() {
  const container = document.getElementById('orders-menu-items');
  if (!container) {
    console.error("❌ orders-menu-items not found!");
    return;
  }
  
  // Clear container first
  container.innerHTML = '';
  
  // Filter items by selected category
  var categoryItems = ORDERS_MENU_ITEMS.filter(function(item) {
    return SELECTED_ORDERS_CATEGORY && item.category_id === SELECTED_ORDERS_CATEGORY.id;
  });
  
  if (categoryItems.length > 0) {
    // Render items directly to grid (no wrapper divs)
    for (var i = 0; i < categoryItems.length; i++) {
      var item = categoryItems[i];
      var card = document.createElement('div');
      card.className = 'orders-item-card';
      card.onclick = (function(itemId) {
        return function() { addItemToOrderCart(itemId); };
      })(item.id);
      
      // Image
      var img = document.createElement('img');
      img.className = 'orders-item-image';
      img.src = item.image_url || '/uploads/website/placeholder.png';
      img.alt = item.name;
      img.onerror = function() { this.src = '/uploads/website/placeholder.png'; };
      card.appendChild(img);
      
      // Info container
      var infoDiv = document.createElement('div');
      infoDiv.className = 'orders-item-info';
      
      // Name
      var nameDiv = document.createElement('div');
      nameDiv.className = 'orders-item-name';
      nameDiv.textContent = item.name;
      infoDiv.appendChild(nameDiv);
      
      // Price
      var priceDiv = document.createElement('div');
      priceDiv.className = 'orders-item-price';
      priceDiv.textContent = '$' + (item.price_cents / 100).toFixed(2);
      infoDiv.appendChild(priceDiv);
      
      card.appendChild(infoDiv);
      container.appendChild(card);
    }
  } else {
    var emptyMsg = document.createElement('p');
    emptyMsg.style.padding = '20px';
    emptyMsg.style.textAlign = 'center';
    emptyMsg.style.color = '#999';
    emptyMsg.setAttribute('data-i18n', 'admin.no-items-category');
    emptyMsg.textContent = 'No items in this category';
    container.appendChild(emptyMsg);
  }
  
  // Render category filter bar at bottom
  renderOrdersCategoryBar();
}

function renderOrdersCategoryBar() {
  // Try to render to bottom tabs first (desktop), fallback to sidebar (mobile)
  let categoryTabsContainer = document.getElementById('orders-category-tabs');
  let categoryTabsBottomContainer = document.querySelector('.orders-category-tabs-bottom');
  let categorySidebarContainer = document.getElementById('orders-category-sidebar');
  
  // Determine which container to use based on visibility
  if (window.innerWidth > 768 && categoryTabsContainer) {
    categoryTabsContainer = categoryTabsContainer;
  } else if (categorySidebarContainer) {
    categoryTabsContainer = categorySidebarContainer;
  } else {
    console.error("❌ No category container found!");
    return;
  }
  
  // Clear existing content
  categoryTabsContainer.innerHTML = '';
  
  // Create category buttons
  ORDERS_CATEGORIES.forEach((cat, idx) => {
    const btn = document.createElement('button');
    btn.className = 'category-btn';
    if (SELECTED_ORDERS_CATEGORY && SELECTED_ORDERS_CATEGORY.id === cat.id) {
      btn.classList.add('active');
    }
    btn.textContent = cat.name;
    btn.setAttribute('data-category', cat.id);
    btn.onclick = () => selectOrdersCategory(cat.id);
    
    categoryTabsContainer.appendChild(btn);
  });
}

// Toggle cart panel visibility
function toggleCartPanel() {
  const cartPanel = document.getElementById('orders-cart-view-container');
  const cartBtn = document.getElementById('cart-toggle-btn');
  const container = document.querySelector('.orders-container');
  
  if (cartPanel) {
    cartPanel.classList.toggle('show-cart');
    if (container) {
      container.classList.toggle('cart-view-active');
    }
    if (cartBtn) {
      cartBtn.classList.toggle('active');
    }
  }
}

// ========== CART MANAGEMENT ==========
async function addItemToOrderCart(itemId) {
  try {
    // Find item in ORDERS_MENU_ITEMS (already loaded)
    const item = ORDERS_MENU_ITEMS.find(i => i.id === itemId);
    if (!item) {
      throw new Error('Item not found');
    }
    
    // Fetch variants
    const variantUrl = `${API}/menu-items/${itemId}/variants`;
    const variantRes = await fetch(variantUrl);
    const variants = variantRes.ok ? await variantRes.json() : [];
    
    // If item has variants, show a modal to select them
    if (variants.length > 0) {
      showItemVariantModal(item, variants);
    } else {
      // Add directly to cart
      const cartItem = {
        id: item.id,
        name: item.name,
        price_cents: item.price_cents,
        variants: [],
        quantity: 1,
        notes: '',
        cartItemId: Math.random().toString(36).substr(2, 9)
      };
      ORDERS_CART.push(cartItem);
      updateOrdersCartDisplay();
    }
  } catch (err) {
    console.error("Error in addItemToOrderCart:", err);
    alert('Error adding item: ' + err.message);
  }
}

function showItemVariantModal(item, variants) {
  // Create sliding panel for variant selection
  const panel = document.createElement('div');
  panel.className = 'variant-slide-panel';
  
  const imageHtml = item.image_url ? `<img src="${item.image_url}" alt="${item.name}" class="variant-slide-image">` : '';
  
  panel.innerHTML = `
    <div class="variant-slide-panel-overlay" onclick="if(event.target === this) this.closest('.variant-slide-panel').remove()"></div>
    
    <div class="variant-slide-content">
      <button class="variant-slide-close" onclick="this.closest('.variant-slide-panel').remove()">✕</button>
      
      ${item.image_url ? `
        <div class="variant-slide-image-section">
          ${imageHtml}
        </div>
      ` : ''}
      
      <div class="variant-slide-header">
        <h2 class="variant-slide-title">${item.name}</h2>
        
        ${item.price_cents ? `
          <div class="variant-slide-price">
            <span class="label" data-i18n="admin.price-label">Price:</span>
            <span class="variant-slide-price-value">$${(item.price_cents / 100).toFixed(2)}</span>
          </div>
        ` : ''}
        
        ${item.description ? `
          <div class="variant-slide-description">
            <label data-i18n="admin.description-label">Description</label>
            <p>${item.description}</p>
          </div>
        ` : ''}
        
        <div class="variant-options-section">
          <h3 data-i18n="admin.select-options">Select Options</h3>
          <div id="variant-selection-form" class="variant-options-container">
            ${variants.map((variant, idx) => {
              const required = variant.required ? '<span style="color: red; margin-left: 4px;">*</span>' : '';
              return `
                <div class="variant-option-item">
                  <div class="variant-option-name">${variant.name}${required}</div>
                  <div class="variant-option-choices">
                    ${variant.min_select === 1 && variant.max_select === 1 ? 
                      // Radio buttons for single selection
                      (variant.options || []).map(opt => `
                        <label class="variant-option-choice">
                          <input type="radio" name="variant-${variant.id}" value="${opt.id}" />
                          <span>${opt.name}${opt.price_cents > 0 ? ' (+$' + (opt.price_cents / 100).toFixed(2) + ')' : ''}</span>
                        </label>
                      `).join('')
                      :
                      // Checkboxes for multiple selections
                      (variant.options || []).map(opt => `
                        <label class="variant-option-choice">
                          <input type="checkbox" name="variant-${variant.id}" value="${opt.id}" />
                          <span>${opt.name}${opt.price_cents > 0 ? ' (+$' + (opt.price_cents / 100).toFixed(2) + ')' : ''}</span>
                        </label>
                      `).join('')
                    }
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
      
      <div class="variant-slide-footer">
        <button onclick="submitItemWithVariants(${item.id}, this.closest('.variant-slide-panel'))" class="btn-primary" data-i18n="admin.add-to-cart-variant">Add to Cart</button>
        <button onclick="this.closest('.variant-slide-panel').remove()" class="btn-secondary" data-i18n="admin.cancel-variant">Cancel</button>
      </div>
    </div>
  `;
  
  panel.classList.add('active');
  document.body.appendChild(panel);
  reTranslateContent();
}

function submitItemWithVariants(itemId, formContainer) {
  // Get selected variants
  const form = formContainer.querySelector('#variant-selection-form');
  const variantInputs = form.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked');
  
  const selectedVariants = [];
  variantInputs.forEach(input => {
    const variantId = input.name.replace('variant-', '');
    const optionId = input.value;
    
    // Get the label text to display variant and option names
    const label = input.closest('label');
    const optionName = label ? label.querySelector('span').textContent : optionId;
    
    // Get variant name from the form
    const variantGroup = input.closest('.variant-option-item');
    const variantName = variantGroup ? variantGroup.querySelector('.variant-option-name').textContent.replace('*', '').trim() : variantId;
    
    selectedVariants.push({
      optionId: optionId,
      variantId: variantId,
      variantName: variantName,
      optionName: optionName
    });
  });
  
  // Find item in ORDERS_MENU_ITEMS to get details
  const item = ORDERS_MENU_ITEMS.find(i => i.id == itemId);
  if (!item) return;
  
  // Create cart item
  const cartItem = {
    id: item.id,
    name: item.name,
    price_cents: item.price_cents,
    variants: selectedVariants,
    quantity: 1,
    notes: '',
    cartItemId: Math.random().toString(36).substr(2, 9)
  };
  
  ORDERS_CART.push(cartItem);
  updateOrdersCartDisplay();
  
  // Close panel
  formContainer.remove();
}

function updateOrdersCartDisplay() {
  const cartList = document.getElementById('cart-items-list');
  const totalPrice = document.getElementById('cart-total-price');
  const cartCount = document.getElementById('cart-item-count');
  
  if (!cartList) return;
  
  // Update cart button count
  if (cartCount) {
    cartCount.textContent = ORDERS_CART.length;
  }
  
  if (ORDERS_CART.length === 0) {
    cartList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Cart is empty</p>';
    totalPrice.textContent = '$0.00';
    return;
  }
  
  let html = '';
  let total = 0;
  
  ORDERS_CART.forEach(item => {
    const itemTotal = item.price_cents * item.quantity;
    total += itemTotal;
    
    // Build variants display with proper formatting
    const variantText = item.variants && item.variants.length > 0 ? 
      `<div class="cart-item-variant">
        ${item.variants.map(v => `<div style="font-size: 11px; color: #666; margin-top: 2px;"><strong>${v.variantName}:</strong> ${v.optionName}</div>`).join('')}
      </div>` : '';
    
    html += `
      <div class="cart-item" data-cart-id="${item.cartItemId}">
        <div class="cart-item-details">
          <div class="cart-item-name">${item.name} x${item.quantity}</div>
          ${variantText}
          <div class="cart-item-price">$${(itemTotal / 100).toFixed(2)}</div>
        </div>
        <div class="cart-item-actions" ${ORDERS_CART_EDIT_MODE ? '' : 'style="display: none;"'}>
          <div class="cart-item-qty-editor">
            <button class="cart-qty-btn" onclick="cartItemChangeQty('${item.cartItemId}', -1)">−</button>
            <span class="cart-qty-value">${item.quantity}</span>
            <button class="cart-qty-btn" onclick="cartItemChangeQty('${item.cartItemId}', 1)">+</button>
            <button class="cart-remove-btn" onclick="removeCartItem('${item.cartItemId}')">✕</button>
          </div>
          <div class="cart-item-remarks-row">
            <button class="cart-remarks-btn" onclick="toggleCartItemRemarks('${item.cartItemId}')">${t('admin.remarks-button') || 'Remarks'}</button>
            <textarea id="remarks-${item.cartItemId}" class="cart-remarks-textarea" ${item.notes ? '' : 'style="display:none;"'} placeholder="${t('admin.remarks-placeholder') || 'Add remarks...'}" oninput="saveCartItemRemarks('${item.cartItemId}', this.value)">${escapeHtml(item.notes || '')}</textarea>
          </div>
        </div>
      </div>
    `;
  });
  
  cartList.innerHTML = html;
  totalPrice.textContent = '$' + (total / 100).toFixed(2);
}

function toggleCartEdit() {
  ORDERS_CART_EDIT_MODE = !ORDERS_CART_EDIT_MODE;
  updateOrdersCartDisplay();
  
  const editBtn = document.getElementById('cart-edit-btn');
  if (editBtn) {
    const buttonText = ORDERS_CART_EDIT_MODE ? 
      t('admin.edit-mode-done') :
      t('admin.edit-button');
    editBtn.innerHTML = `<img src="/uploads/website/pencil.png" alt="edit" style="width: 14px; height: 14px;"/> ${buttonText}`;
  }
}

function removeCartItem(cartItemId) {
  ORDERS_CART = ORDERS_CART.filter(item => item.cartItemId !== cartItemId);
  updateOrdersCartDisplay();
}

function cartItemChangeQty(cartItemId, delta) {
  const cartItem = ORDERS_CART.find(item => item.cartItemId === cartItemId);
  if (!cartItem) return;
  const newQty = cartItem.quantity + delta;
  if (newQty <= 0) {
    ORDERS_CART = ORDERS_CART.filter(item => item.cartItemId !== cartItemId);
  } else {
    cartItem.quantity = newQty;
  }
  updateOrdersCartDisplay();
}

function toggleCartItemRemarks(cartItemId) {
  const textarea = document.getElementById('remarks-' + cartItemId);
  if (!textarea) return;
  if (textarea.style.display === 'none') {
    textarea.style.display = 'block';
    textarea.focus();
  } else {
    textarea.style.display = 'none';
  }
}

function saveCartItemRemarks(cartItemId, value) {
  const cartItem = ORDERS_CART.find(item => item.cartItemId === cartItemId);
  if (cartItem) cartItem.notes = value;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ========== LOAD TABLES ==========
async function loadOrdersTables() {
  try {
    const url = `${API}/restaurants/${restaurantId}/tables`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("❌ API Error Response:", {
        status: response.status,
        statusText: response.statusText,
        body: errorBody
      });
      throw new Error(`Failed to load tables - Status: ${response.status}`);
    }
    
    const tables = await response.json();
    ORDERS_TABLES = tables;
    
    // Populate table select dropdown
    const select = document.getElementById('order-table-select');
    if (select) {
      select.innerHTML = '<option value="">-- Select a table --</option>' +
        tables.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    }
  } catch (err) {
    console.error('❌ Error loading tables:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack
    });
  }
}
// ========== ORDER TYPE SELECTION ==========
function updateOrderTypeUI() {
  const checkedInput = document.querySelector('input[name="order-type"]:checked');
  const orderType = checkedInput ? checkedInput.value : null;
  CURRENT_ORDER_TYPE = orderType;
  
  const tableUI = document.getElementById('table-selection-ui');
  const submitBtn = document.getElementById('order-submit-btn');
  
  // Hide table selection
  if (tableUI) tableUI.style.display = 'none';
  
  // Update button visibility and text
  if (!orderType) {
    if (submitBtn) submitBtn.style.display = 'none';
    return;
  }
  
  if (submitBtn) {
    submitBtn.style.display = 'block';
    
    if (orderType === 'table') {
      submitBtn.textContent = t('admin.add-to-table');
      if (tableUI) tableUI.style.display = 'block';
    } else if (orderType === 'pay-now') {
      submitBtn.textContent = t('admin.order-now');
    } else if (orderType === 'to-go') {
      submitBtn.textContent = t('admin.to-go');
    }
  }
}

// ========== SUBMIT ORDERS ==========
async function submitOrder() {
  if (ORDERS_CART.length === 0) {
    alert(t('admin.cart-empty-alert'));
    return;
  }
  
  const orderType = CURRENT_ORDER_TYPE;
  
  if (!orderType) {
    alert(t('admin.select-order-type'));
    return;
  }
  
  if (orderType === 'table') {
    await submitTableOrder();
  } else if (orderType === 'pay-now') {
    await submitPayNowOrder();
  } else if (orderType === 'to-go') {
    await submitToGoOrder();
  }
}

async function submitTableOrder() {
  let tableId = document.getElementById('order-table-select').value;
  
  // If no table selected, show dropdown prompt or use modal selection
  if (!tableId && !EDITING_EXISTING_SESSION_ID) {
    // Prompt user to select from available tables
    if (ORDERS_TABLES.length === 0) {
      alert(t('admin.no-tables-available'));
      return;
    }
    
    // Create a simple selection prompt
    const tableOptions = ORDERS_TABLES.map(t => `${t.id}: ${t.name}`).join('\n');
    const defaultTableId = ORDERS_TABLES.length > 0 ? ORDERS_TABLES[0].id : '';
    const selection = prompt(`Select table number:\n\n${tableOptions}`, defaultTableId);
    
    if (!selection) {
      alert(t('admin.table-cancelled'));
      return;
    }
    
    tableId = selection.split(':')[0].trim();
    
    // Verify table exists
    const selectedTable = ORDERS_TABLES.find(t => t.id.toString() === tableId);
    if (!selectedTable) {
      alert('Invalid table selection');
      return;
    }
  }
  
  try {
    // Create order for the selected table (reuse session if editing)
    await createOrder(tableId ? parseInt(tableId) : null, EDITING_EXISTING_SESSION_ID || undefined);
    
    // Clear cart and edit state
    ORDERS_CART = [];
    EDITING_EXISTING_ORDER_ID = null;
    EDITING_EXISTING_SESSION_ID = null;
    updateOrdersCartDisplay();
    updateCartOrderHeader();
    
    // Reset selection
    document.getElementById('order-table-select').value = '';
    document.getElementById('order-type-table').checked = false;
    updateOrderTypeUI();

    const tableName = tableId
      ? (ORDERS_TABLES.find(t => t.id == tableId) || {}).name || `Table ${tableId}`
      : 'table';
    showToast(`Order added to ${tableName}`);
  } catch (err) {
    if (err.message !== 'Session creation cancelled') {
      alert('Error creating order: ' + err.message);
    }
  }
}

async function submitPayNowOrder() {
  if (ORDERS_CART.length === 0) {
    alert('Cart is empty');
    return;
  }

  try {
    const items = ORDERS_CART.map(cartItem => ({
      menu_item_id: cartItem.id,
      quantity: cartItem.quantity,
      notes: cartItem.notes || null,
      selected_option_ids: cartItem.variants.map(v => parseInt(v.optionId))
    }));

    // Create counter-order session + order (NOT settled yet — let the modal handle payment)
    const orderRes = await fetch(`${API}/restaurants/${restaurantId}/counter-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pax: 1, items, placed_by_user_id: window.staffUserId || null })
    });

    if (!orderRes.ok) {
      const error = await orderRes.json();
      throw new Error(error.error || 'Failed to create order');
    }

    const { session } = await orderRes.json();

    // Clear cart
    ORDERS_CART = [];
    EDITING_EXISTING_ORDER_ID = null;
    EDITING_EXISTING_SESSION_ID = null;
    updateOrdersCartDisplay();
    updateCartOrderHeader();
    document.getElementById('order-type-pay').checked = false;
    updateOrderTypeUI();

    // Open payment modal for the newly created session
    await openCounterOrderPaymentModal(session.id);
  } catch (err) {
    alert('Error processing order: ' + err.message);
    console.error(err);
  }
}

async function openCounterOrderPaymentModal(sessionId) {
  // Ensure KPay terminal state is current
  if (typeof loadActiveKPayTerminal === 'function') await loadActiveKPayTerminal();

  // Fetch session total
  const res = await fetch(`${API}/sessions/${sessionId}/orders?restaurantId=${restaurantId}`);
  let subtotalCents = 0;
  if (res.ok) {
    const data = await res.json();
    const orders = data.items || [];
    orders.forEach(order => order.items.forEach(i => { subtotalCents += i.quantity * i.unit_price_cents; }));
  }

  const serviceChargePercent = window.serviceChargeFee || Number(window.RESTAURANT_SERVICE_CHARGE || 10);
  const serviceChargeCents = Math.round(subtotalCents * serviceChargePercent / 100);
  const grandTotal = subtotalCents + serviceChargeCents;

  // Fetch coupons
  const couponsRes = await fetch(`${API}/restaurants/${restaurantId}/coupons`);
  const coupons = couponsRes.ok ? await couponsRes.json() : [];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" style="width:400px;">
      <h3 style="margin:0 0 16px 0;">Order Now — Collect Payment</h3>

      <div style="background:#f5f5f5; border-radius:8px; padding:14px; margin-bottom:16px;">
        <p style="margin:0 0 5px 0; font-size:14px;">Subtotal: $${(subtotalCents / 100).toFixed(2)}</p>
        <p style="margin:0 0 5px 0; font-size:14px;">Service Charge (${serviceChargePercent}%): $${(serviceChargeCents / 100).toFixed(2)}</p>
        <p id="counter-total-line" style="margin:8px 0 0 0; font-size:16px; font-weight:bold; border-top:1px solid #ddd; padding-top:8px;">Total: $${(grandTotal / 100).toFixed(2)}</p>
      </div>

      <label style="display:block; margin-bottom:14px;">
        <span style="font-weight:600; display:block; margin-bottom:5px;">Payment Method</span>
        <select id="counter-payment-method" onchange="document.getElementById('counter-kpay-notice').style.display=this.value==='kpay'?'block':'none'" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          ${window._kpayTerminal ? `<option value="kpay">KPay Terminal</option>` : ''}
        </select>
      </label>

      <div id="counter-kpay-notice" style="display:none; background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:10px; margin-bottom:14px; font-size:13px; color:#1d4ed8;">
        Payment will be sent to KPay terminal <strong>${window._kpayTerminal ? window._kpayTerminal.terminal_ip : ''}</strong>.
      </div>

      <label style="display:block; margin-bottom:14px;">
        <span style="font-weight:600; display:block; margin-bottom:5px;">Discount / Coupon</span>
        <select id="counter-discount-coupon" onchange="updateCounterBillTotal(${grandTotal})" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
          <option value="">No Discount</option>
          ${coupons.map(c => `<option value="${c.id}" data-type="${c.discount_type}" data-value="${c.discount_value}">${c.code} - ${c.discount_type === 'percentage' ? c.discount_value + '%' : '$' + (c.discount_value / 100).toFixed(2)}</option>`).join('')}
        </select>
      </label>

      <label style="display:block; margin-bottom:16px;">
        <span style="font-weight:600; display:block; margin-bottom:5px;">Reason (Optional)</span>
        <textarea id="counter-close-reason" placeholder="e.g. Staff meal, discount applied..." style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px; font-family:inherit; resize:vertical; height:60px; box-sizing:border-box;"></textarea>
      </label>

      <div class="modal-button-group">
        <button onclick="this.closest('.modal-overlay').remove()" class="modal-cancel-btn">Cancel</button>
        <button onclick="submitCounterOrderPayment(${sessionId}, ${grandTotal}, ${serviceChargeCents})" class="modal-btn-primary">Confirm Payment</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function updateCounterBillTotal(grandTotal) {
  const couponSelect = document.getElementById('counter-discount-coupon');
  const selectedOption = couponSelect?.options?.[couponSelect.selectedIndex];
  let discountAmount = 0;
  if (selectedOption?.value) {
    const couponType = selectedOption.getAttribute('data-type');
    const couponValue = Number(selectedOption.getAttribute('data-value'));
    discountAmount = couponType === 'percentage' ? Math.round(grandTotal * couponValue / 100) : couponValue;
  }
  const finalTotal = grandTotal - discountAmount;
  const totalLine = document.getElementById('counter-total-line');
  if (totalLine) {
    totalLine.innerHTML = `Total: <span style="color:${discountAmount > 0 ? '#10b981' : 'inherit'};">$${(finalTotal / 100).toFixed(2)}</span>${discountAmount > 0 ? ` <span style="font-size:12px; color:#666;">(-$${(discountAmount / 100).toFixed(2)})</span>` : ''}`;
  }
}

async function submitCounterOrderPayment(sessionId, grandTotal, serviceChargeCents) {
  const paymentMethod = document.getElementById('counter-payment-method')?.value || 'cash';

  const couponSelect = document.getElementById('counter-discount-coupon');
  const selectedOption = couponSelect?.options?.[couponSelect.selectedIndex];
  let discountApplied = 0;
  if (selectedOption?.value) {
    const couponType = selectedOption.getAttribute('data-type');
    const couponValue = Number(selectedOption.getAttribute('data-value'));
    discountApplied = couponType === 'percentage' ? Math.round(grandTotal * couponValue / 100) : couponValue;
  }

  const reason = document.getElementById('counter-close-reason')?.value || '';
  const finalAmount = grandTotal - discountApplied;

  document.querySelector('.modal-overlay')?.remove();

  if (paymentMethod === 'kpay') {
    if (!window._kpayTerminal) return alert('No active KPay terminal configured.');
    await startKPayPayment({
      sessionId,
      finalAmount,
      discountApplied,
      serviceChargeAmount: serviceChargeCents,
      reason,
      terminalId: window._kpayTerminal.id,
    });
  } else {
    await _doCloseBill({
      sessionId,
      paymentMethod,
      finalAmount,
      discountApplied,
      serviceChargeAmount: serviceChargeCents,
      reason,
    });
    await loadOrdersHistoryLeftPanel();
  }
}

async function submitToGoOrder() {
  if (ORDERS_CART.length === 0) {
    alert('Cart is empty');
    return;
  }
  
  try {
    // For "To Go", create items array directly with correct format
    const items = ORDERS_CART.map(cartItem => ({
      menu_item_id: cartItem.id,
      quantity: cartItem.quantity,
      selected_option_ids: cartItem.variants.map(v => parseInt(v.optionId))
    }));
    
    // Get customer contact info
    const customerName = prompt('Customer name:', '');
    if (!customerName) throw new Error('Customer name required for to-go order');
    const customerPhone = prompt('Customer phone (optional):', '');
    
    // Use to-go-order endpoint
    const orderRes = await fetch(`${API}/restaurants/${restaurantId}/to-go-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pax: 1,
        items: items,
        customer_name: customerName,
        customer_phone: customerPhone || null
      })
    });
    
    if (!orderRes.ok) {
      const error = await orderRes.json();
      throw new Error(error.error || 'Failed to create to-go order');
    }
    
    // Clear cart
    ORDERS_CART = [];
    EDITING_EXISTING_ORDER_ID = null;
    EDITING_EXISTING_SESSION_ID = null;
    updateOrdersCartDisplay();
    updateCartOrderHeader();
    document.getElementById('order-type-togo').checked = false;
    updateOrderTypeUI();
    
    alert(`To-go order created for ${customerName}`);
    await loadOrdersHistoryLeftPanel();
  } catch (err) {
    alert('Error creating to-go order: ' + err.message);
    console.error(err);
  }
}

async function createOrder(tableId, sessionId) {
  // Get or create session
  let targetSessionId = sessionId;
  
  if (tableId && !sessionId) {
    // Check for active sessions on this table
    try {
      const tableStateRes = await fetch(`${API}/restaurants/${restaurantId}/table-state`);
      if (tableStateRes.ok) {
        const tableState = await tableStateRes.json();
        // Find active sessions for this table
        const activeSessions = tableState.filter(row => 
          row.table_id == tableId && row.session_id && !row.ended_at
        );
        if (activeSessions.length > 0) {
          targetSessionId = activeSessions[0].session_id;
        }
      }
    } catch (err) {
      // Continue silently if table state check fails
    }
    
    // If no active session, prompt user to create one
    if (!targetSessionId) {
      const pax = await showPaxPrompt();
      if (!pax || pax <= 0) {
        throw new Error('Session creation cancelled');
      }
      
      // Create session
      const createSessionRes = await fetch(`${API}/tables/${tableId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pax: parseInt(pax) })
      });
      
      if (!createSessionRes.ok) {
        const errorData = await createSessionRes.json();
        throw new Error(errorData.error || 'Failed to create session');
      }
      
      const sessionData = await createSessionRes.json();
      targetSessionId = sessionData.id; // Session endpoint returns 'id', not 'session_id'
      console.log('[Orders] Created new session with ID:', targetSessionId);
      showToast(`Session created for ${pax} people`);
    }
  }
  
  if (!targetSessionId) throw new Error('No valid session');
  
  // Create items for the order with correct format
  const items = ORDERS_CART.map(cartItem => ({
    menu_item_id: cartItem.id,
    quantity: cartItem.quantity,
    notes: cartItem.notes || null,
    selected_option_ids: cartItem.variants.map(v => parseInt(v.optionId))
  }));
  
  const res = await fetch(`${API}/sessions/${targetSessionId}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, placed_by_user_id: window.staffUserId || null })
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || 'Failed to create order');
  }
  
  return res.json();
}

// Initialize when the Orders section is loaded

// ========== CATEGORY FILTERING ==========
function selectOrdersCategory(categoryId) {
  const category = ORDERS_CATEGORIES.find(c => c.id === categoryId);
  
  if (category) {
    SELECTED_ORDERS_CATEGORY = category;
    // Re-render menu items with new category filter
    renderOrdersMenuItems();
  } else {
    console.error("❌ Category not found:", categoryId);
  }
}

// ========== ORDER HISTORY ==========

async function loadExistingOrderForEdit(orderId) {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/orders/${orderId}`);
    if (!res.ok) throw new Error('Failed to load order');
    const order = await res.json();

    // Load items into cart
    ORDERS_CART = (order.items || []).map(item => ({
      id: item.menu_item_id,
      cartItemId: `edit-${item.id}-${Date.now()}`,
      name: item.menu_item_name,
      quantity: item.quantity,
      price_cents: item.unit_price_cents || Math.round((item.item_total_cents || 0) / item.quantity),
      variants: []
    }));

    EDITING_EXISTING_ORDER_ID = orderId;
    EDITING_EXISTING_SESSION_ID = order.session_id || null;

    // Exit history mode
    if (ORDERS_HISTORY_MODE) await toggleOrdersHistoryMode();

    // Pre-select order type & table if applicable
    if (order.order_type === 'table') {
      const tableRadio = document.getElementById('order-type-table');
      if (tableRadio) { tableRadio.checked = true; updateOrderTypeUI(); }
      if (order.table_id) {
        const tableSelect = document.getElementById('order-table-select');
        if (tableSelect) tableSelect.value = order.table_id;
      }
    }

    // Update cart display and header
    updateOrdersCartDisplay();
    updateCartOrderHeader();

    // Show cart panel
    const cartPanel = document.getElementById('orders-cart-view-container');
    if (cartPanel && !cartPanel.classList.contains('show-cart')) toggleCartPanel();
  } catch (err) {
    console.error('Error loading order for edit:', err);
    alert('Failed to load order for editing.');
  }
}

function updateCartOrderHeader() {
  const cartHeader = document.querySelector('#orders-cart-view .cart-header h3');
  if (!cartHeader) return;
  if (EDITING_EXISTING_ORDER_ID) {
    cartHeader.textContent = `Order #${EDITING_EXISTING_ORDER_ID}`;
  } else {
    cartHeader.setAttribute('data-i18n', 'admin.cart');
    cartHeader.textContent = t('admin.cart') || 'Cart';
  }
}

async function toggleOrdersHistoryMode() {
  ORDERS_HISTORY_MODE = !ORDERS_HISTORY_MODE;
  
  const historyView = document.getElementById('orders-history-left-view');
  const detailsView = document.getElementById('orders-details-view');
  const leftColumnWrapper = document.querySelector('.orders-container > .left-column-wrapper');
  const ordersContainer = document.querySelector('.orders-container');
  
  if (ORDERS_HISTORY_MODE) {
    // Show history view
    historyView.classList.add('active');
    
    // DO NOT auto-show details view - let user click on an order first
    detailsView.classList.remove('active');
    
    // Hide the menu/cart section
    if (leftColumnWrapper) {
      leftColumnWrapper.style.display = 'none';
    }
    
    // Add history mode class to container for CSS layout changes
    if (ordersContainer) {
      ordersContainer.classList.add('history-mode');
    }
    
    await loadOrdersHistoryLeftPanel();

    // Auto-refresh history every 15 seconds while panel is open
    if (_historyRefreshInterval) clearInterval(_historyRefreshInterval);
    _historyRefreshInterval = setInterval(() => {
      if (ORDERS_HISTORY_MODE && !VIEWING_HISTORICAL_ORDER) {
        loadOrdersHistoryLeftPanel();
      }
    }, 15000);
    
    const detailsContent = document.getElementById('order-details-content');
    if (detailsContent) {
      detailsContent.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Select an order to view details</p>';
    }
  } else {
    // Hide history view
    historyView.classList.remove('active');

    // Stop auto-refresh
    if (_historyRefreshInterval) { clearInterval(_historyRefreshInterval); _historyRefreshInterval = null; }
    
    // Hide details view
    detailsView.classList.remove('active');
    
    // Restore the menu/cart section
    if (leftColumnWrapper) {
      leftColumnWrapper.style.display = 'flex';
    }
    
    // Remove history mode class from container
    if (ordersContainer) {
      ordersContainer.classList.remove('history-mode');
    }
    
    VIEWING_HISTORICAL_ORDER = null;
  }
}

function closeDetailsView() {
  // Hide details and show history instead
  const detailsView = document.getElementById('orders-details-view');
  const historyView = document.getElementById('orders-history-left-view');
  
  if (detailsView) {
    detailsView.classList.remove('active');
  }
  if (historyView) {
    historyView.classList.add('active');
  }

  VIEWING_HISTORICAL_ORDER = null;
  // Refresh the list so any status changes are reflected
  loadOrdersHistoryLeftPanel();
}

async function loadOrdersHistoryLeftPanel() {
  const historyListLeft = document.getElementById('orders-history-list-left');
  if (!historyListLeft) return;
  
  historyListLeft.innerHTML = '<p style="color: #999; padding: 20px; text-align: center;">Loading orders...</p>';
  
  try {
    // Load orders from API
    const response = await fetch(`${API}/restaurants/${restaurantId}/orders?limit=100`);
    if (!response.ok) throw new Error('Failed to load orders');
    
    const orders = await response.json();
    
    if (!orders || orders.length === 0) {
      historyListLeft.innerHTML = '<p style="color: #999; padding: 20px; text-align: center;">No orders yet</p>';
      return;
    }
    
    // Build HTML for order list
    let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
    
    orders.forEach(order => {
      const isKpay = order.payment_method_online === 'kpay';
      const isPA = order.payment_method_online === 'payment-asia';
      const ps = order.payment_status;
      const isPaid = order.payment_received;

      // Resolve payment method and vendor — prefer chuio_payments, fall back to legacy fields
      const _kpayM = { 1:'Visa', 2:'Mastercard', 3:'Amex', 4:'UnionPay', 5:'Alipay', 6:'WeChat Pay', 7:'FPS', 8:'Octopus', 10:'JCB', 11:'Octopus', 12:'PayMe', 14:'FPS' };
      const _paM   = { 'Alipay':'Alipay', 'WeChat Pay':'WeChat Pay', 'CreditCard':'Credit Card', 'Wechat':'WeChat Pay', 'Octopus':'Octopus', 'FPS':'FPS', 'CUP':'UnionPay', 'UnionPay':'UnionPay' };
      let subMethod = order.cp_method || '';
      if (!subMethod) {
        if (isKpay && order.kpay_pay_method) subMethod = _kpayM[order.kpay_pay_method] || '';
        else if (isPA && order.payment_network) subMethod = _paM[order.payment_network] || order.payment_network;
        else if (order.payment_method_online === 'card') subMethod = 'Credit Card';
        else if (!order.payment_method_online || order.payment_method_online === 'cash') subMethod = 'Cash';
      }
      const _cpVendorLabel = { 'kpay':'KPay', 'payment-asia':'Payment Asia', 'cash':'', 'card':'' };
      const vendorLabel = _cpVendorLabel[order.cp_vendor] ?? (isKpay ? 'KPay' : isPA ? 'Payment Asia' : '');
      const envBadge = order.cp_env === 'sandbox' ? ' <span style="font-size:9px; background:#e0e7ff; color:#3730a3; border-radius:2px; padding:0 4px;">sandbox</span>' : '';
      const methodLine = (subMethod || vendorLabel)
        ? `<div style="font-size:10px; color:#9ca3af; margin-top:2px; text-align:right;">${[subMethod, vendorLabel].filter(Boolean).join(' · ')}${envBadge}</div>`
        : '';

      // Payment status badge — prefer chuio_payments status as canonical source
      const effectiveStatus = order.cp_status || ps;
      let paymentBadge = '';
      const isPaidOrCp = isPaid || order.cp_status === 'completed';
      if (isPaidOrCp || (isKpay && effectiveStatus)) {
        if (effectiveStatus === 'refunded')       paymentBadge = `<span style="padding:2px 8px; background:#fee2e2; color:#dc2626; border-radius:3px; font-size:10px; font-weight:600;">↩ Refunded</span>`;
        else if (effectiveStatus === 'partial_refund') paymentBadge = `<span style="padding:2px 8px; background:#fef3c7; color:#f59e0b; border-radius:3px; font-size:10px; font-weight:600;">↩ Partial</span>`;
        else if (effectiveStatus === 'voided')    paymentBadge = `<span style="padding:2px 8px; background:#fef3c7; color:#b45309; border-radius:3px; font-size:10px; font-weight:600;">Voided</span>`;
        else paymentBadge = `<span style="padding:2px 8px; background:#10b981; color:white; border-radius:3px; font-size:10px; font-weight:600;">✓ Paid</span>`;
      } else {
        paymentBadge = `<span style="padding:2px 8px; background:#d1d5db; color:#666; border-radius:3px; font-size:10px; font-weight:600;">Unpaid</span>`;
      }
      
      const orderTimeStr = formatTimeWithTimezone(order.created_at, restaurantTimezone, 'time');
      const orderDateStr = formatTimeWithTimezone(order.created_at, restaurantTimezone, 'date');
      
      let typeLabel = 'Order';
      let typeIcon = '';
      if (order.order_type === 'counter') {
        typeLabel = 'Order Now';
        typeIcon = '';
      } else if (order.order_type === 'to-go') {
        typeLabel = 'To Go';
        typeIcon = '';
      } else if (order.order_type === 'table') {
        typeLabel = order.table_name ? `Table ${order.table_name}` : 'Table Order';
        typeIcon = '';
      }
      
      html += `
        <div class="order-list-item" data-order-id="${order.id}" onclick="selectOrderFromHistory(${order.id})" style="
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          cursor: pointer;
          background: white;
          transition: all 0.2s;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        " onmouseover="if(!this.classList.contains('selected-order-row')) this.style.backgroundColor='#f9fafb'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.05)';" onmouseout="if(!this.classList.contains('selected-order-row')) this.style.backgroundColor='white'; this.style.boxShadow='none';">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 13px; color: #1f2937;">Order #${order.id}</div>
            <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${typeLabel}</div>
            <div style="font-size: 10px; color: #9ca3af; margin-top: 2px;">${orderDateStr} at ${orderTimeStr}</div>
          </div>
          <div style="text-align: right; margin-left: 12px; flex-shrink: 0;">
            <div style="font-weight: 700; font-size: 14px; color: #667eea; margin-bottom: 4px;">$${(order.total_cents / 100).toFixed(2)}</div>
            <div style="text-align:right;">${paymentBadge}</div>
            ${methodLine}
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    historyListLeft.innerHTML = html;

    // On wide screens only, auto-select the first/top order if none is currently selected
    if (window.innerWidth > 900 && !VIEWING_HISTORICAL_ORDER && orders.length > 0) {
      selectOrderFromHistory(orders[0].id);
    }
    
  } catch (err) {
    console.error('Error loading order history:', err);
    historyListLeft.innerHTML = `<p style="color: #ef4444; padding: 20px; text-align: center;">Error loading orders</p>`;
  }
}

// Set order history filter and reload
function setOrderHistoryFilter(filterType) {
  ORDER_HISTORY_FILTER = filterType;
  
  // Update filter tab styles
  const tabs = document.querySelectorAll('.history-filter-tab');
  tabs.forEach(tab => {
    const filter = tab.getAttribute('data-filter');
    if (filter === filterType) {
      tab.style.borderBottomColor = '#667eea';
      tab.style.color = '#667eea';
    } else {
      tab.style.borderBottomColor = 'transparent';
      tab.style.color = '#999';
    }
  });
  
  // Load appropriate content
  loadOrdersHistoryLeftPanel();
}

async function selectOrderFromHistory(orderId) {
  console.log('🎯 selectOrderFromHistory called with orderId:', orderId, 'restaurantId:', restaurantId);
  try {
    // Fetch order details
    const response = await fetch(`${API}/restaurants/${restaurantId}/orders/${orderId}`);
    console.log('🎯 API Response status:', response.status);
    if (!response.ok) throw new Error('Failed to load order details');
    
    const order = await response.json();
    console.log('🔍 API Response - Order object:', order);
    
    // Show details view — on narrow screens, swap to details-only; on wide screens show side-by-side
    const historyView = document.getElementById('orders-history-left-view');
    const detailsView = document.getElementById('orders-details-view');
    if (window.innerWidth <= 900) {
      // Narrow: hide history list, show details with back button
      if (historyView) historyView.classList.remove('active');
    }
    if (detailsView) detailsView.classList.add('active');

    // Highlight selected row
    document.querySelectorAll('.order-list-item').forEach(el => {
      el.classList.remove('selected-order-row');
      el.style.backgroundColor = 'white';
      el.style.borderColor = '#e5e7eb';
    });
    const selectedRow = document.querySelector(`.order-list-item[data-order-id="${orderId}"]`);
    if (selectedRow) {
      selectedRow.classList.add('selected-order-row');
      selectedRow.style.backgroundColor = '#eef2ff';
      selectedRow.style.borderColor = '#667eea';
    }
    
    // Display order details in right panel
    displayOrderDetails(order);

    // If KPay payment, load transaction details asynchronously
    if (order.payment_method_online === 'kpay' && order.kpay_reference_id) {
      loadKPayOrderDetails(order.id, order.kpay_reference_id);
    }

    // If Payment Asia payment, load transaction query details asynchronously
    if (order.payment_method_online === 'payment-asia' && order.kpay_reference_id) {
      loadPaymentAsiaOrderDetails(order.id, order.kpay_reference_id, order.payment_network);
    }

    // Track that we're viewing a historical order
    VIEWING_HISTORICAL_ORDER = orderId;
  } catch (err) {
    console.error('Error selecting order:', err);
    const detailsContent = document.getElementById('order-details-content');
    if (detailsContent) {
      detailsContent.innerHTML = `<p style="color: #ef4444; text-align: center; padding: 20px;">Error loading order</p>`;
    }
  }
}
    
function displayOrderDetails(order) {
  const detailsContent = document.getElementById('order-details-content');
  const detailsTitle = document.getElementById('order-details-title');
  
  if (!detailsContent) return;
  
  // Clear and build HTML from scratch
  let html = '<div style="display: flex; flex-direction: column; gap: 16px;">';
  
  // Order Header
  const createdTime = new Date(order.created_at).toLocaleString();
  html += `
    <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;">
        <div>
          <div style="font-size: 12px; color: #666; font-weight: 600; text-transform: uppercase;">Order Number</div>
          <div style="font-size: 20px; font-weight: 700; color: #2c3e50; margin-top: 4px;">#${order.id}</div>
        </div>
        <div style="text-align: right;">
          <div style="padding: 6px 12px; background: ${order.status === 'pending' ? '#e0e7ff' : '#d1fae5'}; color: ${order.status === 'pending' ? '#3730a3' : '#065f46'}; border-radius: 4px; font-weight: 600; font-size: 12px;">
            ${formatOrderStatus(order.status)}
          </div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px;">
        <div>
          <div style="font-size: 12px; color: #999; text-transform: uppercase; font-weight: 600;">Order Time</div>
          <div style="font-size: 13px; color: #333; margin-top: 4px;">${createdTime}</div>
        </div>
        <div>
          <div style="font-size: 12px; color: #999; text-transform: uppercase; font-weight: 600;">Total Items</div>
          <div style="font-size: 13px; color: #333; margin-top: 4px;">${order.items ? order.items.length : 0} items</div>
        </div>
      </div>
      ${(order.customer_name || order.customer_phone) ? `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #f0f0f0;">
        <div>
          <div style="font-size: 12px; color: #999; text-transform: uppercase; font-weight: 600;">Customer</div>
          <div id="order-customer-name-display" style="font-size: 13px; color: #333; margin-top: 4px;">${order.customer_name || '—'}</div>
        </div>
        <div>
          <div style="font-size: 12px; color: #999; text-transform: uppercase; font-weight: 600;">Phone</div>
          <div id="order-customer-phone-display" style="font-size: 13px; color: #333; margin-top: 4px;">${order.customer_phone || '—'}</div>
        </div>
      </div>
      ` : `
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #f0f0f0;">
        <button onclick="editOrderCustomerInfo(${order.session_id})" style="padding: 6px 14px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 5px; cursor: pointer; font-size: 12px; color: #374151; font-weight: 500;">+ Add Customer Info</button>
      </div>
      `}
    </div>
  `;
  
  // Order Items
  html += `
    <div>
      <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #333;">Order Items</h4>
      <div style="display: flex; flex-direction: column; gap: 8px;">
  `;
  
  let itemsTotal = 0;
  if (order.items && order.items.length > 0) {
    order.items.forEach(item => {
      itemsTotal += item.item_total_cents || 0;
      html += `
        <div style="padding: 12px; background: #f9f9f9; border-radius: 6px; border-left: 3px solid #667eea;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: ${item.variants ? '6px' : '0'};">
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #333; font-size: 13px;">${item.menu_item_name} × ${item.quantity}</div>
            </div>
            <div style="font-weight: 600; color: #667eea; font-size: 13px; margin-left: 8px;">$${((item.item_total_cents || 0) / 100).toFixed(2)}</div>
          </div>
          ${item.variants ? `<div style="font-size: 11px; color: #999;">${item.variants}</div>` : ''}
          ${item.addons && item.addons.length > 0 ? item.addons.map(a => `<div style="font-size: 11px; color: #667eea; margin-top: 2px;">+ ${a.menu_item_name} ×${a.quantity} ($${((a.item_total_cents || a.unit_price_cents * a.quantity) / 100).toFixed(2)})</div>`).join('') : ''}
        </div>
      `;
    });
  } else {
    html += `<p style="color: #999; font-size: 13px;">No items in this order</p>`;
  }
  
  html += `</div></div>`;
  
  // Order Summary
  const serviceCharge = Math.round(itemsTotal * 0.1);
  const grandTotal = itemsTotal + serviceCharge;
  
  html += `
    <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">
      <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #333;">Order Summary</h4>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0; font-size: 13px;">
        <div style="color: #666;">Subtotal</div>
        <div style="color: #333; font-weight: 500;">$${(itemsTotal / 100).toFixed(2)}</div>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0; font-size: 13px;">
        <div style="color: #666;">Service Charge (10%)</div>
        <div style="color: #333; font-weight: 500;">$${(serviceCharge / 100).toFixed(2)}</div>
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="color: #333; font-size: 14px; font-weight: 600;">Total</div>
        <div style="color: #2c3e50; font-size: 18px; font-weight: 700;">$${(grandTotal / 100).toFixed(2)}</div>
      </div>
    </div>
  `;
  
  // Payment Information
  const paymentMethod = order.payment_method_online || 'cash';
  // Use chuio_payments status as canonical source; fall back to orders.payment_status
  const effectivePaymentStatus = order.cp_status || order.payment_status || (order.payment_received ? 'completed' : null);

  const paymentStatusConfig = {
    completed:      { label: '✓ Paid',            color: '#10b981' },
    paid:           { label: '✓ Paid',            color: '#10b981' },
    voided:         { label: 'Voided',          color: '#b45309' },
    refunded:       { label: 'Refunded',         color: '#dc2626' },
    partial_refund: { label: 'Partial Refund',   color: '#f59e0b' },
  };
  const psDisplay = paymentStatusConfig[effectivePaymentStatus] || { label: effectivePaymentStatus || 'Unpaid', color: '#6b7280' };

  // Payment vendor and actual sub-method — prefer chuio_payments, fall back to legacy
  const _kpayDetailMethods = { 1:'Visa', 2:'Mastercard', 3:'Amex', 4:'UnionPay', 5:'Alipay', 6:'WeChat Pay', 7:'FPS', 8:'Octopus', 10:'JCB', 11:'Octopus', 12:'PayMe', 14:'FPS' };
  const _paDetailNetworks  = { 'Alipay':'Alipay', 'WeChat Pay':'WeChat Pay', 'CreditCard':'Credit Card', 'Wechat':'WeChat Pay', 'Octopus':'Octopus', 'FPS':'FPS', 'CUP':'UnionPay', 'UnionPay':'UnionPay' };
  const _cpVendorLabels    = { 'kpay':'KPay Terminal', 'payment-asia':'Payment Asia', 'cash':'Cash', 'card':'Card Terminal' };
  const _cpVendorColors    = { 'kpay':'#667eea', 'payment-asia':'#f59e0b', 'cash':'#10b981', 'card':'#6b7280' };

  const payVendorLabel = _cpVendorLabels[order.cp_vendor] || (paymentMethod === 'kpay' ? 'KPay Terminal' : paymentMethod === 'payment-asia' ? 'Payment Asia' : '');
  const payVendorColor = _cpVendorColors[order.cp_vendor] || (paymentMethod === 'kpay' ? '#667eea' : '#f59e0b');
  const payMethodLabel = order.cp_method
    ? order.cp_method
    : paymentMethod === 'kpay'
      ? (_kpayDetailMethods[order.kpay_pay_method] || 'Terminal')
      : paymentMethod === 'payment-asia'
        ? (_paDetailNetworks[order.payment_network] || order.payment_network || 'Online')
        : paymentMethod === 'card' ? 'Credit Card' : 'Cash';

  if (order.payment_received === true) {
    html += `
      <div style="background: #f9fafb; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">
        <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #333;">Payment Information</h4>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e0e0e0; font-size: 13px;">
          <div style="color: #666;">Payment Status</div>
          <div style="font-weight: 600; color: ${psDisplay.color};">${psDisplay.label}${order.cp_env === 'sandbox' ? ' <span style="font-size:10px; background:#e0e7ff; color:#3730a3; border-radius:3px; padding:1px 5px; font-weight:500;">sandbox</span>' : ''}</div>
        </div>
        
        ${payVendorLabel ? `
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px;">
          <div style="color:#666;">Payment Vendor</div>
          <div style="font-weight:600; color:${payVendorColor};">${payVendorLabel}</div>
        </div>` : ''}

        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px;">
          <div style="color:#666;">Payment Method</div>
          <div style="font-weight:600; color:#444;">${payMethodLabel}</div>
        </div>

        ${order.cp_vendor_ref ? `
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid #e5e7eb;">
          <div style="color:#9ca3af;">Vendor Reference</div>
          <div style="color:#555; font-family:monospace; font-size:11px; word-break:break-all; text-align:right; max-width:200px;">${order.cp_vendor_ref}</div>
        </div>` : ''}

        ${order.cp_completed_at ? `
        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px; color:#555;">
          <div style="color:#9ca3af;">Paid At</div>
          <div>${new Date(order.cp_completed_at).toLocaleString()}</div>
        </div>` : ''}

        ${order.cp_refund_amount_cents ? `
        <div style="background:#fee2e2; border-radius:5px; padding:8px 10px; font-size:12px; margin-bottom:8px;">
          <div style="font-weight:600; color:#dc2626;">Refund: $${(order.cp_refund_amount_cents/100).toFixed(2)}</div>
          ${order.cp_refunded_at ? `<div style="color:#b91c1c; margin-top:2px;">Refunded at ${new Date(order.cp_refunded_at).toLocaleString()}</div>` : ''}
        </div>` : ''}

        ${paymentMethod !== 'kpay' && paymentMethod !== 'payment-asia' && (!effectivePaymentStatus || effectivePaymentStatus === 'completed' || effectivePaymentStatus === 'paid') ? `
        <div style="display:flex; gap:8px; margin-top:8px;" id="non-kpay-actions-${order.id}">
          <button onclick="orderVoid(${order.id})" style="padding:5px 12px; background:#fef3c7; color:#b45309; border:1px solid #fde68a; border-radius:5px; cursor:pointer; font-size:12px; font-weight:600;">Void</button>
          <button onclick="orderRefund(${order.id})" style="padding:5px 12px; background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:5px; cursor:pointer; font-size:12px; font-weight:600;">Refund</button>
        </div>` : ''}

        ${paymentMethod === 'kpay' && order.kpay_reference_id ? `
        <div style="background:#eff6ff; border-radius:6px; padding:10px; font-size:12px; color:#1e40af; margin-top:8px;">
          <div style="font-weight:600; margin-bottom:6px;">KPay Transaction Details</div>
          <div style="margin-bottom:2px; font-size:11px; color:#64748b;">Order Ref: <code style="font-family:monospace;">${order.kpay_reference_id}</code></div>
          <div id="kpay-txn-detail-${order.id}" style="margin-top:6px; color:#64748b;">Loading transaction details…</div>
          <div style="display:flex; gap:8px; margin-top:10px;" id="kpay-txn-actions-${order.id}"></div>
        </div>` : ''}

        ${paymentMethod === 'payment-asia' && order.kpay_reference_id ? `
        <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:10px; font-size:12px; color:#92400e; margin-top:8px;">
          <div style="font-weight:600; margin-bottom:6px;">Payment Asia Transaction Details</div>
          <div style="margin-bottom:4px; font-size:11px; color:#78350f;">Merchant Ref: <code style="font-family:monospace;font-size:11px;">${order.kpay_reference_id}</code></div>
          <div id="pa-txn-detail-${order.id}" style="margin-top:6px; color:#78350f;">Loading transaction details…</div>
          <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;" id="pa-txn-actions-${order.id}"></div>
        </div>` : ''}
      </div>
    `;

    // Payment Ledger — full chuio_payments records
    if (order.payment_records && order.payment_records.length > 0) {
      const _cpStatusBadge = {
        completed:      '<span style="background:#d1fae5;color:#065f46;padding:1px 7px;border-radius:3px;font-size:11px;font-weight:600;">✓ Completed</span>',
        pending:        '<span style="background:#fef9c3;color:#713f12;padding:1px 7px;border-radius:3px;font-size:11px;font-weight:600;">Pending</span>',
        failed:         '<span style="background:#fee2e2;color:#991b1b;padding:1px 7px;border-radius:3px;font-size:11px;font-weight:600;">✗ Failed</span>',
        voided:         '<span style="background:#fef3c7;color:#92400e;padding:1px 7px;border-radius:3px;font-size:11px;font-weight:600;">Voided</span>',
        refunded:       '<span style="background:#fee2e2;color:#dc2626;padding:1px 7px;border-radius:3px;font-size:11px;font-weight:600;">↩ Refunded</span>',
        partial_refund: '<span style="background:#fef3c7;color:#d97706;padding:1px 7px;border-radius:3px;font-size:11px;font-weight:600;">↩ Partial</span>',
      };
      const _cpRecIcons = { 'kpay':'', 'payment-asia':'', 'cash':'', 'card':'' };
      html += `
        <div style="background:white; border:1px solid #e0e0e0; border-radius:8px; padding:16px;">
          <h4 style="margin:0 0 12px 0; font-size:14px; font-weight:600; color:#333;">Payment Ledger</h4>
          <div style="display:flex; flex-direction:column; gap:10px;">
      `;
      order.payment_records.forEach(rec => {
        const recVendor  = _cpVendorLabels[rec.payment_vendor] || rec.payment_vendor || '';
        const recIcon    = _cpRecIcons[rec.payment_vendor] || '';
        const recStatus  = _cpStatusBadge[rec.status] || `<span style="background:#f3f4f6;color:#374151;padding:1px 7px;border-radius:3px;font-size:11px;">${rec.status || '—'}</span>`;
        const recEnv     = rec.payment_gateway_env === 'sandbox' ? ' <span style="font-size:9px;background:#e0e7ff;color:#3730a3;border-radius:2px;padding:0 4px;">sandbox</span>' : '';
        const recTotal   = rec.total_cents   ? `$${(rec.total_cents/100).toFixed(2)}`   : rec.amount_cents ? `$${(rec.amount_cents/100).toFixed(2)}` : '—';
        const recCurrency = rec.currency_code || 'HKD';
        const recCreated   = rec.created_at   ? new Date(rec.created_at).toLocaleString()   : '—';
        const recCompleted = rec.completed_at ? new Date(rec.completed_at).toLocaleString() : null;
        html += `
          <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:12px; font-size:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div style="font-weight:700; color:#1f2937; font-size:13px;">${recVendor}${rec.payment_method ? ' · ' + rec.payment_method : ''}${recEnv}</div>
              <div>${recStatus}</div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px 16px; color:#555; line-height:1.6;">
              <div><span style="color:#9ca3af;">Amount: </span>${recTotal} ${recCurrency}</div>
              <div><span style="color:#9ca3af;">Created: </span>${recCreated}</div>
              ${recCompleted ? `<div style="grid-column:span 2;"><span style="color:#9ca3af;">Completed: </span>${recCompleted}</div>` : ''}
              ${rec.vendor_reference ? `<div style="grid-column:span 2;"><span style="color:#9ca3af;">Vendor Ref: </span><span style="font-family:monospace;word-break:break-all;">${rec.vendor_reference}</span></div>` : ''}
              ${rec.order_reference  ? `<div style="grid-column:span 2;"><span style="color:#9ca3af;">Order Ref: </span><span style="font-family:monospace;font-size:11px;word-break:break-all;">${rec.order_reference}</span></div>` : ''}
              ${rec.refund_amount_cents ? `<div style="grid-column:span 2; color:#dc2626;"><span style="color:#9ca3af;">Refund: </span>$${(rec.refund_amount_cents/100).toFixed(2)}${rec.refunded_at ? ' · ' + new Date(rec.refunded_at).toLocaleString() : ''}</div>` : ''}
              ${rec.refund_reference  ? `<div style="grid-column:span 2;"><span style="color:#9ca3af;">Refund Ref: </span><span style="font-family:monospace;">${rec.refund_reference}</span></div>` : ''}
            </div>
          </div>
        `;
      });
      html += `</div></div>`;
    }

  } else {
    // Unpaid order — show Settle Bill + Edit Order options
    html += `
      <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px;">
        <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #92400e;">Payment Pending</h4>
        <p style="margin: 0 0 12px 0; font-size: 13px; color: #78350f;">This order has not been settled yet.</p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button onclick="openSettleBillModal(${order.id}, ${order.session_id})" style="padding:8px 18px; background:#667eea; color:white; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600;">Settle Bill</button>
          <button onclick="loadExistingOrderForEdit(${order.id})" style="padding:8px 18px; background:#f59e0b; color:white; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600;">Edit Order</button>
        </div>
      </div>
    `;
  }
  
  html += '</div>';
  
  detailsContent.innerHTML = html;
  
  if (detailsTitle) {
    detailsTitle.textContent = `Order #${order.id}`;
  }
}

async function restoreOrderToCart(orderId) {
  // Alias to selectOrderFromHistory for backward compatibility
  return selectOrderFromHistory(orderId);
}

async function editOrderCustomerInfo(sessionId) {
  const name = prompt('Customer name:', '');
  if (name === null) return;
  const phone = prompt('Customer phone:', '');
  if (phone === null) return;

  try {
    const res = await fetch(`${API}/sessions/${sessionId}/customer`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: name || null, customer_phone: phone || null })
    });
    if (!res.ok) throw new Error('Failed to update customer info');
    // Refresh the order detail
    if (VIEWING_HISTORICAL_ORDER) {
      await selectOrderFromHistory(VIEWING_HISTORICAL_ORDER);
    }
  } catch (err) {
    alert('Error updating customer: ' + err.message);
  }
}

async function openSettleBillModal(orderId, sessionId) {
  if (typeof loadActiveKPayTerminal === 'function') await loadActiveKPayTerminal();

  // Fetch order to get items total
  const res = await fetch(`${API}/restaurants/${restaurantId}/orders/${orderId}`);
  if (!res.ok) return alert('Failed to load order details.');
  const order = await res.json();

  let subtotalCents = 0;
  (order.items || []).forEach(item => { subtotalCents += item.item_total_cents || 0; });

  const serviceChargePercent = window.serviceChargeFee || Number(window.RESTAURANT_SERVICE_CHARGE || 10);
  const serviceChargeCents = Math.round(subtotalCents * serviceChargePercent / 100);
  const grandTotal = subtotalCents + serviceChargeCents;

  const couponsRes = await fetch(`${API}/restaurants/${restaurantId}/coupons`);
  const coupons = couponsRes.ok ? await couponsRes.json() : [];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" style="width:400px;">
      <h3 style="margin:0 0 16px 0;">Settle Bill — Order #${orderId}</h3>

      <div style="background:#f5f5f5; border-radius:8px; padding:14px; margin-bottom:16px;">
        <p style="margin:0 0 5px 0; font-size:14px;">Subtotal: $${(subtotalCents / 100).toFixed(2)}</p>
        <p style="margin:0 0 5px 0; font-size:14px;">Service Charge (${serviceChargePercent}%): $${(serviceChargeCents / 100).toFixed(2)}</p>
        <p id="settle-total-line" style="margin:8px 0 0 0; font-size:16px; font-weight:bold; border-top:1px solid #ddd; padding-top:8px;">Total: $${(grandTotal / 100).toFixed(2)}</p>
      </div>

      <label style="display:block; margin-bottom:14px;">
        <span style="font-weight:600; display:block; margin-bottom:5px;">Payment Method</span>
        <select id="settle-payment-method" onchange="document.getElementById('settle-kpay-notice').style.display=this.value==='kpay'?'block':'none'" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          ${window._kpayTerminal ? `<option value="kpay">KPay Terminal</option>` : ''}
        </select>
      </label>

      <div id="settle-kpay-notice" style="display:none; background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:10px; margin-bottom:14px; font-size:13px; color:#1d4ed8;">
        Payment will be sent to KPay terminal <strong>${window._kpayTerminal ? window._kpayTerminal.terminal_ip : ''}</strong>.
      </div>

      <label style="display:block; margin-bottom:14px;">
        <span style="font-weight:600; display:block; margin-bottom:5px;">Discount / Coupon</span>
        <select id="settle-discount-coupon" onchange="updateSettleBillTotal(${grandTotal})" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
          <option value="">No Discount</option>
          ${coupons.map(c => `<option value="${c.id}" data-type="${c.discount_type}" data-value="${c.discount_value}">${c.code} - ${c.discount_type === 'percentage' ? c.discount_value + '%' : '$' + (c.discount_value / 100).toFixed(2)}</option>`).join('')}
        </select>
      </label>

      <label style="display:block; margin-bottom:16px;">
        <span style="font-weight:600; display:block; margin-bottom:5px;">Reason (Optional)</span>
        <textarea id="settle-close-reason" placeholder="e.g. Staff meal, discount applied..." style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px; font-family:inherit; resize:vertical; height:60px; box-sizing:border-box;"></textarea>
      </label>

      <div class="modal-button-group">
        <button onclick="this.closest('.modal-overlay').remove()" class="modal-cancel-btn">Cancel</button>
        <button onclick="submitSettleBill(${sessionId}, ${grandTotal}, ${serviceChargeCents}, ${orderId})" class="modal-btn-primary">Confirm Payment</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function updateSettleBillTotal(grandTotal) {
  const couponSelect = document.getElementById('settle-discount-coupon');
  const selectedOption = couponSelect?.options?.[couponSelect.selectedIndex];
  let discountAmount = 0;
  if (selectedOption?.value) {
    const couponType = selectedOption.getAttribute('data-type');
    const couponValue = Number(selectedOption.getAttribute('data-value'));
    discountAmount = couponType === 'percentage' ? Math.round(grandTotal * couponValue / 100) : couponValue;
  }
  const finalTotal = grandTotal - discountAmount;
  const totalLine = document.getElementById('settle-total-line');
  if (totalLine) {
    totalLine.innerHTML = `Total: <span style="color:${discountAmount > 0 ? '#10b981' : 'inherit'};">$${(finalTotal / 100).toFixed(2)}</span>${discountAmount > 0 ? ` <span style="font-size:12px; color:#666;">(-$${(discountAmount / 100).toFixed(2)})</span>` : ''}`;
  }
}

async function submitSettleBill(sessionId, grandTotal, serviceChargeCents, orderId) {
  const paymentMethod = document.getElementById('settle-payment-method')?.value || 'cash';

  const couponSelect = document.getElementById('settle-discount-coupon');
  const selectedOption = couponSelect?.options?.[couponSelect.selectedIndex];
  let discountApplied = 0;
  if (selectedOption?.value) {
    const couponType = selectedOption.getAttribute('data-type');
    const couponValue = Number(selectedOption.getAttribute('data-value'));
    discountApplied = couponType === 'percentage' ? Math.round(grandTotal * couponValue / 100) : couponValue;
  }

  const reason = document.getElementById('settle-close-reason')?.value || '';
  const finalAmount = grandTotal - discountApplied;

  document.querySelector('.modal-overlay')?.remove();

  if (paymentMethod === 'kpay') {
    if (!window._kpayTerminal) return alert('No active KPay terminal configured.');
    await startKPayPayment({
      sessionId,
      finalAmount,
      discountApplied,
      serviceChargeAmount: serviceChargeCents,
      reason,
      terminalId: window._kpayTerminal.id,
    });
  } else {
    await _doCloseBill({
      sessionId,
      paymentMethod,
      finalAmount,
      discountApplied,
      serviceChargeAmount: serviceChargeCents,
      reason,
    });
    await loadOrdersHistoryLeftPanel();
  }
  // Refresh the order detail to reflect new paid status
  await selectOrderFromHistory(orderId);
}

// ─── KPay order-history helpers ──────────────────────────────────────────────

// Stores the fetched KPay transaction for the currently-viewed order
let _historyKPayTxn = null;

async function loadKPayOrderDetails(orderId, outTradeNo) {
  const detailDiv   = document.getElementById(`kpay-txn-detail-${orderId}`);
  const actionsDiv  = document.getElementById(`kpay-txn-actions-${orderId}`);
  if (!detailDiv) return;

  try {
    const resp = await fetch(`${API}/restaurants/${restaurantId}/kpay-transactions/${encodeURIComponent(outTradeNo)}`);
    if (!resp.ok) { detailDiv.textContent = 'Could not load KPay details.'; return; }
    const txn = await resp.json();
    _historyKPayTxn = txn;

    const amountHKD = txn.amount_cents ? (txn.amount_cents / 100).toFixed(2) : (txn.payAmount ? (parseInt(txn.payAmount) / 100).toFixed(2) : '—');
    const statusColor = txn.status === 'completed' ? '#10b981' : txn.status === 'refunded' ? '#ef4444' : txn.status === 'voided' ? '#f59e0b' : txn.status === 'failed' ? '#ef4444' : '#64748b';
    const hasCard = !!(txn.refNo && txn.commitTime);
    const hasQR   = !!txn.transactionNo;

    const completedAtStr = txn.completed_at
      ? new Date(txn.completed_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : null;
    const refundAmountHKD = txn.refund_amount_cents ? (txn.refund_amount_cents / 100).toFixed(2) : null;

    let statusExtra = '';
    if (txn.status === 'voided' && completedAtStr) {
      statusExtra = `<div style="margin-top:4px; color:#b45309;">Voided on ${completedAtStr}</div>`;
    } else if (txn.status === 'refunded') {
      statusExtra = `<div style="margin-top:4px; color:#dc2626;">Refunded${refundAmountHKD ? ` HKD ${refundAmountHKD}` : ''}${completedAtStr ? ` on ${completedAtStr}` : ''}</div>`;
    }

    const payMethodLabels = {
      1: 'Visa', 2: 'Mastercard', 3: 'Amex', 4: 'UnionPay', 5: 'Alipay',
      6: 'WeChat Pay', 7: 'FPS', 8: 'Octopus', 10: 'JCB',
    };
    const payMethodLabel = txn.payMethod ? (payMethodLabels[txn.payMethod] || `Code ${txn.payMethod}`) : null;
    const payResultLabels = { '-1': 'Timeout', 1: 'Pending', 2: 'Success ✓', 3: 'Failed ✗', 4: 'Refunded', 5: 'Cancelled', 6: 'Cancelled' };
    const payResultLabel = txn.payResult != null ? (payResultLabels[txn.payResult] || `Code ${txn.payResult}`) : null;
    const payResultColor = txn.payResult === 2 ? '#10b981' : txn.payResult === 1 ? '#64748b' : '#ef4444';

    detailDiv.innerHTML = `
      <div style="color:#1e40af; line-height:1.9; font-size:12px;">
        <div>Amount: <strong>HKD ${amountHKD}</strong>${txn.payCurrency ? ` (${txn.payCurrency})` : ''}</div>
        <div>Status: <strong style="color:${statusColor};">${txn.status}</strong></div>
        ${payResultLabel    ? `<div>payResult: <strong style="color:${payResultColor};">${payResultLabel}</strong></div>` : ''}
        ${txn.outTradeNo    ? `<div>outTradeNo: <code style="font-family:monospace;font-size:11px;">${txn.outTradeNo}</code></div>` : ''}
        ${txn.transactionNo ? `<div>transactionNo: <code style="font-family:monospace;font-size:11px;">${txn.transactionNo}</code></div>` : ''}
        ${txn.refNo         ? `<div>refNo: <code style="font-family:monospace;font-size:11px;">${txn.refNo}</code></div>` : ''}
        ${txn.commitTime    ? `<div>commitTime: ${txn.commitTime}</div>` : ''}
        ${payMethodLabel    ? `<div>payMethod: ${payMethodLabel}</div>` : ''}
        ${txn.transactionType != null ? `<div>transactionType: ${txn.transactionType}</div>` : ''}
        ${statusExtra}
      </div>
    `;

    // Show action buttons only if a KPay terminal is active
    if (!actionsDiv) return;
    actionsDiv.innerHTML = '';

    if (txn.status === 'completed' && window._kpayTerminal) {
      // Refund (only when settled)
      const refundBtn = document.createElement('button');
      refundBtn.textContent = 'Refund';
      refundBtn.style.cssText = 'padding:6px 14px; background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;';
      refundBtn.onclick = () => openHistoryKPayRefund(outTradeNo, txn);
      actionsDiv.appendChild(refundBtn);
    }

    if ((txn.status === 'completed' || txn.status === 'pending') && window._kpayTerminal) {
      // Void (completed-but-unsettled same-day only — terminal will reject if inappropriate)
      const voidBtn = document.createElement('button');
      voidBtn.textContent = 'Void';
      voidBtn.title = 'Only works for same-day, unsettled transactions';
      voidBtn.style.cssText = 'padding:6px 14px; background:#fef3c7; color:#b45309; border:1px solid #fde68a; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;';
      voidBtn.onclick = () => historyKPayVoid(outTradeNo);
      actionsDiv.appendChild(voidBtn);
    }
  } catch (e) {
    if (detailDiv) detailDiv.textContent = `Error: ${e.message}`;
  }
}

// ─── Payment Asia order-history helpers ──────────────────────────────────────

async function loadPaymentAsiaOrderDetails(orderId, merchantReference, paymentNetwork) {
  const detailDiv  = document.getElementById(`pa-txn-detail-${orderId}`);
  const actionsDiv = document.getElementById(`pa-txn-actions-${orderId}`);
  if (!detailDiv) return;

  try {
    const resp = await fetch(`${API}/restaurants/${restaurantId}/payment-asia/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant_reference: merchantReference }),
    });
    if (!resp.ok) { detailDiv.textContent = 'Could not load Payment Asia details.'; return; }
    const data = await resp.json();

    if (!data.success || !data.records || data.records.length === 0) {
      detailDiv.innerHTML = '<span style="color:#b45309;">No transaction records found.</span>';
      return;
    }

    const records = data.records;
    // PA sandbox returns type:"Sale" (string); production returns type:"1"
    const isSaleRec = r => { const t = String(r.type); return t === '1' || t.toLowerCase() === 'sale'; };
    const sale = records.find(isSaleRec) || records[0];
    const paStatusMap = { '1': 'Completed ✓', '2': 'Pending', '3': 'Failed ✗', '4': 'Processing', '5': 'Refunded' };
    const saleStatusLabel = paStatusMap[String(sale.status)] || `Status ${sale.status}`;
    const saleStatusColor = String(sale.status) === '1' ? '#10b981' : String(sale.status) === '5' ? '#ef4444' : '#92400e';

    // Convert Unix timestamp (seconds) to readable date
    const fmtPATime = ts => {
      if (!ts) return null;
      const n = parseInt(ts);
      if (!isNaN(n) && n > 1000000000) return new Date(n * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      return ts;
    };

    const _paNetLbl = { 'Alipay':'Alipay', 'WeChat Pay':'WeChat Pay', 'CreditCard':'Credit Card', 'Octopus':'Octopus', 'FPS':'FPS', 'UnionPay':'UnionPay' };
    const networkLabel = paymentNetwork ? (_paNetLbl[paymentNetwork] || paymentNetwork) : null;

    let html = `
      <div style="line-height:1.9; font-size:12px;">
        ${networkLabel ? `<div>Method: <strong>${networkLabel}</strong></div>` : ''}
        <div>Amount: <strong>${sale.currency || 'HKD'} ${sale.amount}</strong></div>
        <div>Status: <strong style="color:${saleStatusColor};">${saleStatusLabel}</strong></div>
        <div>Request Ref: <code style="font-family:monospace;font-size:11px;">${sale.request_reference || '—'}</code></div>
        ${fmtPATime(sale.created_time) ? `<div>Created: ${fmtPATime(sale.created_time)}</div>` : ''}
        ${fmtPATime(sale.completed_time) ? `<div>Completed: ${fmtPATime(sale.completed_time)}</div>` : ''}
      </div>
    `;

    // Show any refund records (exclude the main sale record)
    const refunds = records.filter(r => !isSaleRec(r));
    if (refunds.length > 0) {
      html += `<div style="margin-top:6px; padding-top:6px; border-top:1px solid #fde68a; font-size:11px; color:#78350f;">`;
      refunds.forEach(r => {
        const refStatus = paStatusMap[String(r.status)] || r.status;
        const refTime = fmtPATime(r.completed_time);
        html += `<div>↩️ Refund: ${r.currency || 'HKD'} ${r.amount} — ${refStatus}${refTime ? ' on ' + refTime : ''}</div>`;
      });
      html += `</div>`;
    }

    detailDiv.innerHTML = html;

    // Show refund button if sale is completed
    if (actionsDiv && String(sale.status) === '1') {
      actionsDiv.innerHTML = '';
      const refundBtn = document.createElement('button');
      refundBtn.textContent = '↩️ Refund via Payment Asia';
      refundBtn.style.cssText = 'padding:6px 14px; background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;';
      refundBtn.onclick = () => openPaymentAsiaRefund(orderId, merchantReference, parseFloat(sale.amount));
      actionsDiv.appendChild(refundBtn);
    }
  } catch (e) {
    if (detailDiv) detailDiv.textContent = `Error: ${e.message}`;
  }
}

function openPaymentAsiaRefund(orderId, merchantReference, saleAmount) {
  document.getElementById('pa-refund-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'pa-refund-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" style="width:380px; max-width:95vw;">
      <h3 style="margin:0 0 14px 0;">↩️ Refund via Payment Asia</h3>
      <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:10px; font-size:12px; margin-bottom:14px; line-height:1.8;">
        <div><b>Merchant Reference:</b><br><code style="font-family:monospace;font-size:11px;">${merchantReference}</code></div>
        <div><b>Original Amount:</b> HKD ${saleAmount.toFixed(2)}</div>
      </div>
      <label style="display:block; margin-bottom:14px; font-size:13px;">
        <span style="font-weight:600; display:block; margin-bottom:4px;">Refund Amount (HKD)</span>
        <input id="pa-refund-amount" type="number" step="0.01" min="0.01" value="${saleAmount.toFixed(2)}"
          style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box; font-size:13px;"/>
      </label>
      <div id="pa-refund-error" style="color:#dc2626; font-size:12px; margin-bottom:8px; display:none;"></div>
      <div class="modal-button-group">
        <button onclick="document.getElementById('pa-refund-overlay').remove()" class="modal-cancel-btn">Cancel</button>
        <button onclick="submitPaymentAsiaRefund('${merchantReference}', ${orderId})" class="modal-btn-primary" style="background:#dc2626;">Submit Refund</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function submitPaymentAsiaRefund(merchantReference, orderId) {
  const amountInput = document.getElementById('pa-refund-amount');
  const errorDiv    = document.getElementById('pa-refund-error');
  const amount = parseFloat(amountInput?.value || '0');
  if (!amount || amount <= 0) {
    errorDiv.textContent = 'Please enter a valid refund amount.';
    errorDiv.style.display = 'block';
    return;
  }
  errorDiv.style.display = 'none';

  try {
    const resp = await fetch(`${API}/restaurants/${restaurantId}/payment-asia/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant_reference: merchantReference, amount }),
    });
    const data = await resp.json();
    document.getElementById('pa-refund-overlay')?.remove();

    if (!data.success) {
      alert(` Refund failed: ${data.error}`);
      return;
    }

    const refundRef = data.payload?.refund_reference || data.refund_reference || '';
    alert(`✅ Refund submitted successfully!\n\nRefund Reference: ${refundRef}\n\nStatus is "Processing" — Payment Asia will process the refund.`);
    // Reload the order details to reflect updated state
    selectOrderFromHistory(orderId);
  } catch (e) {
    document.getElementById('pa-refund-overlay')?.remove();
    alert(` Refund request failed: ${e.message}`);
  }
}

// ─── Non-KPay void / refund ───────────────────────────────────────────────────

async function orderVoid(orderId) {
  if (!confirm('Mark this order as Voided?\nThis is a manual record update only — no payment system will be called.')) return;
  try {
    const resp = await fetch(`${API}/restaurants/${restaurantId}/orders/${orderId}/void`, { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      selectOrderFromHistory(orderId);
    } else {
      alert(` Void failed: ${data.error}`);
    }
  } catch (e) {
    alert(` ${e.message}`);
  }
}

async function orderRefund(orderId) {
  if (!confirm('Mark this order as Refunded?\nThis is a manual record update only — no payment system will be called.')) return;
  try {
    const resp = await fetch(`${API}/restaurants/${restaurantId}/orders/${orderId}/refund`, { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      selectOrderFromHistory(orderId);
    } else {
      alert(` Refund failed: ${data.error}`);
    }
  } catch (e) {
    alert(` ${e.message}`);
  }
}

async function historyKPayVoid(outTradeNo) {
  if (!window._kpayTerminal) return alert('No active KPay terminal configured.');
  if (!confirm(`Void transaction ${outTradeNo}?\n\nOnly works for same-day unsettled transactions.`)) return;

  const terminalId   = window._kpayTerminal.id;
  const voidOutTradeNo = `VOID-${Date.now()}`;

  try {
    const resp = await fetch(`${API}/restaurants/${restaurantId}/payment-terminals/${terminalId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outTradeNo: voidOutTradeNo, originOutTradeNo: outTradeNo }),
    });
    const data = await resp.json();
    alert(data.success
      ? '✅ Void initiated — check terminal to complete cancellation.'
      : `❌ Void failed: ${data.message || data.error}`);
    if (data.success) selectOrderFromHistory(VIEWING_HISTORICAL_ORDER);
  } catch (e) {
    alert(` Void request failed: ${e.message}`);
  }
}

function openHistoryKPayRefund(outTradeNo, txn) {
  if (!window._kpayTerminal) return alert('No active KPay terminal configured.');

  // Remove any existing refund overlay
  document.getElementById('history-kpay-refund-overlay')?.remove();

  const hasCard = !!(txn.refNo && txn.commitTime);
  const hasQR   = !!txn.transactionNo;
  const refundTypeDetected = hasCard ? 1 : 2;
  const amountHKD = txn.amount_cents ? (txn.amount_cents / 100).toFixed(2) : '—';
  const typeLabel = refundTypeDetected === 1
    ? `Card  |  refNo: ${txn.refNo}  |  commitTime: ${txn.commitTime}`
    : `QR  |  transactionNo: ${txn.transactionNo}`;

  const overlay = document.createElement('div');
  overlay.id = 'history-kpay-refund-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" style="width:400px; max-width:95vw;">
      <h3 style="margin:0 0 14px 0;">Refund KPay Transaction</h3>
      <div style="background:#f9fafb; border-radius:6px; padding:10px; font-size:12px; font-family:monospace; color:#333; margin-bottom:14px; line-height:1.8;">
        <b>outTradeNo:</b> ${outTradeNo}<br>
        <b>Type:</b> ${typeLabel}<br>
        <b>Amount:</b> HKD ${amountHKD}<br>
        <b>Status:</b> ${txn.status}
      </div>
      <label style="display:block; margin-bottom:10px; font-size:13px;">
        <span style="font-weight:600; display:block; margin-bottom:4px;">Partial Refund Amount <span style="color:#999; font-weight:400;">(blank = full refund)</span></span>
        <input id="hist-refund-amount" type="text" placeholder="12-digit cents e.g. 000000000100"
          style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box; font-family:monospace;"/>
      </label>
      <label style="display:block; margin-bottom:14px; font-size:13px;">
        <span style="font-weight:600; display:block; margin-bottom:4px;">Admin Password <span style="color:red">*</span></span>
        <input id="hist-refund-password" type="password" placeholder="Admin password"
          style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box;"/>
      </label>
      <div id="hist-refund-error" style="display:none; color:#dc2626; font-size:12px; margin-bottom:10px;"></div>
      <div class="modal-button-group">
        <button onclick="document.getElementById('history-kpay-refund-overlay').remove()" class="modal-cancel-btn">Cancel</button>
        <button onclick="submitHistoryKPayRefund('${outTradeNo}', ${refundTypeDetected})" class="modal-btn-primary">Submit Refund</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function submitHistoryKPayRefund(outTradeNo, refundType) {
  const txn = _historyKPayTxn;
  const managerPassword = document.getElementById('hist-refund-password')?.value.trim();
  const refundAmount    = document.getElementById('hist-refund-amount')?.value.trim() || undefined;
  const errDiv          = document.getElementById('hist-refund-error');

  if (!managerPassword) {
    if (errDiv) { errDiv.textContent = 'Admin password is required'; errDiv.style.display = 'block'; }
    return;
  }
  if (errDiv) errDiv.style.display = 'none';

  document.getElementById('history-kpay-refund-overlay')?.remove();

  const terminalId     = window._kpayTerminal.id;
  const refundOutTradeNo = `REF-${Date.now()}`;
  const body = { outTradeNo: refundOutTradeNo, refundType, managerPassword };
  if (refundAmount) body.refundAmount = refundAmount;
  if (refundType === 1) { body.refNo = txn.refNo; body.commitTime = txn.commitTime; }
  else                  { body.transactionNo = txn.transactionNo; }

  try {
    const resp = await fetch(`${API}/restaurants/${restaurantId}/payment-terminals/${terminalId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    alert(data.success
      ? '✅ Refund initiated — check terminal to complete.'
      : `❌ Refund failed: ${data.message || data.error}`);
    if (data.success) selectOrderFromHistory(VIEWING_HISTORICAL_ORDER);
  } catch (e) {
    alert(` Refund request failed: ${e.message}`);
  }
}

function displayOrderStatus(status) {
  const statusDisplay = document.getElementById('order-status-display');
  const statusValue = document.getElementById('order-status-value');
  
  if (statusDisplay && statusValue) {
    statusDisplay.style.display = 'block';
    statusValue.textContent = formatOrderStatus(status);
    const styleClass = getStatusStyle(status);
    // Extract color from style class if needed
    const colorMap = {
      'not-paid': '#f59e0b',
      'paid': '#10b981',
      'refunded': '#ef4444'
    };
    statusValue.style.color = colorMap[status] || '#666';
  }
}

function clearOrderStatusDisplay() {
  const statusDisplay = document.getElementById('order-status-display');
  if (statusDisplay) {
    statusDisplay.style.display = 'none';
  }
}

function formatOrderStatus(status) {
  const statusMap = {
    'not-paid': 'Not Paid',
    'paid': 'Paid',
    'refunded': 'Refunded',
    'pending': 'Sending',
    'completed': 'Delivered'
  };
  return statusMap[status] || status;
}

function getStatusStyle(status) {
  const styles = {
    'not-paid': 'background: #fef3c7; color: #b45309;',
    'paid': 'background: #d1fae5; color: #065f46;',
    'refunded': 'background: #fee2e2; color: #7f1d1d;',
    'pending': 'background: #e0e7ff; color: #3730a3;',
    'completed': 'background: #d1fae5; color: #065f46;'
  };
  return styles[status] || 'background: #f3f4f6; color: #374151;';
}

// Print receipt for an order
async function printReceipt(orderId) {
  try {
    console.log('[PrintReceipt] Starting receipt print for order:', orderId);
    
    const restaurantId = localStorage.getItem('restaurantId');
    
    // Call backend endpoint - it handles HTML generation and printer routing
    await printOrderViaAPI(restaurantId, orderId);
    console.log('[PrintReceipt] Receipt print completed');
  } catch (err) {
    console.error('[PrintReceipt] Error:', err);
    alert('⚠️ Print error: ' + err.message);
  }
}

// Email receipt for an order
async function emailReceipt(orderId) {
  try {
    const order = ORDERS.find(o => o.id === orderId);
    if (!order) {
      alert('Order not found');
      return;
    }

    // Prompt for email address
    const email = prompt('Enter email address to send receipt:', 'customer@example.com');
    if (!email) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }

    // Build email content
    let emailContent = `Order Receipt\n\n`;
    emailContent += `Order #${order.id}\n`;
    emailContent += `Date: ${new Date(order.created_at).toLocaleString()}\n\n`;
    emailContent += `Items:\n`;

    order.items.forEach(item => {
      const itemTotal = (item.item_total_cents / 100).toFixed(2);
      emailContent += `- ${item.menu_item_name} x${item.quantity}: $${itemTotal}\n`;
      if (item.addons && item.addons.length > 0) {
        item.addons.forEach(a => {
          emailContent += `  + ${a.menu_item_name} x${a.quantity}: $${((a.item_total_cents || a.unit_price_cents * a.quantity) / 100).toFixed(2)}\n`;
        });
      }
    });

    const totalAmount = (order.total_cents / 100).toFixed(2);
    emailContent += `\nTotal: $${totalAmount}\n\n`;
    emailContent += `Thank you for your order!\n`;

    // Send email via API
    const response = await fetch(`${API}/restaurants/${restaurantId}/orders/${orderId}/send-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, content: emailContent })
    });

    if (response.ok) {
      alert(`Receipt sent to ${email}`);
    } else {
      const error = await response.json();
      alert('Error sending receipt: ' + (error.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Error emailing receipt:', err);
    alert('Error emailing receipt: ' + err.message);
  }
}

// Print session order
// DEPRECATED: Use printBill() instead
// printSessionOrder() has been replaced with printBill() for consistency

// Email session order
async function emailSessionOrder(sessionId) {
  const email = prompt('Enter email address to send receipt:', 'customer@example.com');
  if (!email) return;

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert('Please enter a valid email address');
    return;
  }

  try {
    // Fetch bill data from backend (same as printBill)
    const res = await fetch(`${API}/sessions/${sessionId}/bill`);
    if (!res.ok) return alert("Failed to load bill");

    const bill = await res.json();
    
    // Build receipt HTML using same format as printBill
    let itemsHTML = '';
    bill.items.forEach(i => {
      const lineTotal = (i.price_cents * i.quantity / 100).toFixed(2);
      itemsHTML += `<div class="item-row"><div class="item-name">${i.name}</div><div class="item-qty">x${i.quantity}</div><div class="item-price">$${lineTotal}</div></div>`;
    });
    
    const serviceChargeHTML = bill.service_charge_cents ? `<div class="summary-row"><span>Service Charge:</span><span>$${(bill.service_charge_cents / 100).toFixed(2)}</span></div>` : '';

    const receiptHTML = `<!DOCTYPE html>
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
      .summary-row.total { font-size: 16px; font-weight: bold; margin-top: 3px; }
      .footer { margin-top: 10px; font-size: 10px; color: #666; border-top: 1px dashed #000; padding-top: 6px; }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="header">
        ${bill.restaurant && bill.restaurant.logo_url ? `<img src="${bill.restaurant.logo_url}" class="logo" alt="Logo"/>` : ''}
        <div class="restaurant-name">${bill.restaurant ? bill.restaurant.name : 'Receipt'}</div>
        <div class="restaurant-info">${bill.restaurant ? bill.restaurant.address || '' : ''}</div>
        <div class="restaurant-info">${bill.restaurant ? bill.restaurant.phone || '' : ''}</div>
      </div>
      <div class="divider"></div>
      <div class="items">${itemsHTML}</div>
      <div class="summary">
        <div class="summary-row subtotal">
          <span>Subtotal:</span>
          <span>$${(bill.subtotal_cents / 100).toFixed(2)}</span>
        </div>
        ${serviceChargeHTML}
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
  </body>
</html>`;

    const response = await fetch(`${API}/restaurants/${restaurantId}/send-order-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        sessionId: sessionId,
        receiptHTML: receiptHTML,
        restaurantId: restaurantId
      })
    });

    if (response.ok) {
      alert(`Receipt sent to ${email}`);
    } else {
      const error = await response.json();
      alert('Error sending receipt: ' + (error.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Error emailing receipt:', err);
    alert('Error emailing receipt: ' + err.message);
  }
}