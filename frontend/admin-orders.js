// ============= ORDERS MODULE =============
// Order management for staff to place customer orders

// Global state for orders
let ORDERS_CART = [];
let ORDERS_CART_EDIT_MODE = false;
let ORDERS_TABLES = [];
let CURRENT_ORDER_TYPE = null;
let ORDERS_CATEGORIES = [];
let SELECTED_ORDERS_CATEGORY = null;
let ORDER_HISTORY_FILTER = 'all'; // Filter for order history tabs: 'all', 'table', 'order-now', 'to-go', 'sessions'
let ALL_ORDERS_DATA = []; // Store all orders for filtering
let ALL_SESSIONS_DATA = []; // Store all sessions for display
let ORDERS_MENU_ITEMS = [];
let ORDERS_HISTORY_MODE = false;

// ========== INITIALIZE ORDERS ==========
async function initializeOrders() {
  
  // Load categories and menu items together using the combined /menu endpoint
  await loadOrdersMenu();
  
  // Load tables for table selection
  await loadOrdersTables();
  
  // Listen for language changes to re-render tabs
  window.addEventListener('languageChanged', () => {
    console.log('[Orders] Language changed - re-rendering tabs');
    renderOrdersCategoryBar();
  });
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
    // Create category wrapper
    var categoryDiv = document.createElement('div');
    categoryDiv.className = 'orders-category';
    
    // Create grid
    var gridDiv = document.createElement('div');
    gridDiv.className = 'orders-items-grid';
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
      gridDiv.appendChild(card);
    }
    
    categoryDiv.appendChild(gridDiv);
    container.appendChild(categoryDiv);
  } else {
    var emptyMsg = document.createElement('p');
    emptyMsg.style.padding = '20px';
    emptyMsg.style.textAlign = 'center';
    emptyMsg.style.color = '#999';
    emptyMsg.textContent = 'No items in this category';
    container.appendChild(emptyMsg);
  }
  
  // Render category filter bar at bottom
  renderOrdersCategoryBar();
}

function renderOrdersCategoryBar() {
  const categoryTabsContainer = document.getElementById('orders-category-tabs');
  
  if (!categoryTabsContainer) {
    console.error("❌ orders-category-tabs not found!");
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
  const mainWrapper = document.querySelector('.orders-main-wrapper');
  
  if (cartPanel) {
    cartPanel.classList.toggle('visible');
    if (mainWrapper) {
      mainWrapper.classList.toggle('with-cart-open');
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
            <span class="label">Price:</span>
            <span class="variant-slide-price-value">$${(item.price_cents / 100).toFixed(2)}</span>
          </div>
        ` : ''}
        
        ${item.description ? `
          <div class="variant-slide-description">
            <label>Description</label>
            <p>${item.description}</p>
          </div>
        ` : ''}
        
        <div class="variant-options-section">
          <h3>Select Options</h3>
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
        <button onclick="submitItemWithVariants(${item.id}, this.closest('.variant-slide-panel'))" class="btn-primary">Add to Cart</button>
        <button onclick="this.closest('.variant-slide-panel').remove()" class="btn-secondary">Cancel</button>
      </div>
    </div>
  `;
  
  panel.classList.add('active');
  document.body.appendChild(panel);
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
          <button onclick="editCartItem('${item.cartItemId}')">Edit</button>
          <button onclick="removeCartItem('${item.cartItemId}')">Remove</button>
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
    editBtn.innerHTML = ORDERS_CART_EDIT_MODE ? 
      '<img src="/uploads/website/pencil.png" alt="edit" style="width: 14px; height: 14px;"/> Done' :
      '<img src="/uploads/website/pencil.png" alt="edit" style="width: 14px; height: 14px;"/> Edit';
  }
}

function removeCartItem(cartItemId) {
  ORDERS_CART = ORDERS_CART.filter(item => item.cartItemId !== cartItemId);
  updateOrdersCartDisplay();
}

function editCartItem(cartItemId) {
  const cartItem = ORDERS_CART.find(item => item.cartItemId === cartItemId);
  if (!cartItem) return;
  
  // For now, remove and re-add with ability to change quantity
  const quantity = prompt('Enter quantity:', cartItem.quantity);
  if (quantity && parseInt(quantity) > 0) {
    cartItem.quantity = parseInt(quantity);
    updateOrdersCartDisplay();
  }
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
    alert('Cart is empty');
    return;
  }
  
  const orderType = CURRENT_ORDER_TYPE;
  
  if (!orderType) {
    alert('Please select an order type');
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
  if (!tableId) {
    // Prompt user to select from available tables
    if (ORDERS_TABLES.length === 0) {
      alert('No tables available');
      return;
    }
    
    // Create a simple selection prompt
    const tableOptions = ORDERS_TABLES.map(t => `${t.id}: ${t.name}`).join('\n');
    const defaultTableId = ORDERS_TABLES.length > 0 ? ORDERS_TABLES[0].id : '';
    const selection = prompt(`Select table number:\n\n${tableOptions}`, defaultTableId);
    
    if (!selection) {
      alert('Table selection cancelled');
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
    // Create order for the selected table
    await createOrder(parseInt(tableId));
    
    // Clear cart
    ORDERS_CART = [];
    updateOrdersCartDisplay();
    
    // Reset selection
    document.getElementById('order-table-select').value = '';
    document.getElementById('order-type-table').checked = false;
    updateOrderTypeUI();
    
    alert('Order added to table');
  } catch (err) {
    alert('Error creating order: ' + err.message);
  }
}

async function submitPayNowOrder() {
  if (ORDERS_CART.length === 0) {
    alert('Cart is empty');
    return;
  }
  
  try {
    // For "Order Now" (counter order), use the counter-order endpoint
    const items = ORDERS_CART.map(cartItem => ({
      menu_item_id: cartItem.id,
      quantity: cartItem.quantity,
      selected_option_ids: cartItem.variants.map(v => parseInt(v.optionId))
    }));
    
    // Use counter-order endpoint
    const orderRes = await fetch(`${API}/restaurants/${restaurantId}/counter-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pax: 1,
        items: items,
        payment_method: 'card',
        payment_status: 'settled'
      })
    });
    
    if (!orderRes.ok) {
      const error = await orderRes.json();
      throw new Error(error.error || 'Failed to create order');
    }
    
    // Clear cart
    ORDERS_CART = [];
    updateOrdersCartDisplay();
    document.getElementById('order-type-pay').checked = false;
    updateOrderTypeUI();
    
    alert('Counter order placed and payment processed');
    await loadOrdersHistoryLeftPanel();
  } catch (err) {
    alert('Error processing order: ' + err.message);
    console.error(err);
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
    
    // Use to-go-order endpoint
    const orderRes = await fetch(`${API}/restaurants/${restaurantId}/to-go-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pax: 1,
        items: items,
        customer_name: customerName
      })
    });
    
    if (!orderRes.ok) {
      const error = await orderRes.json();
      throw new Error(error.error || 'Failed to create to-go order');
    }
    
    // Clear cart
    ORDERS_CART = [];
    updateOrdersCartDisplay();
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
      const pax = prompt('No active session for this table. How many people (pax)?', '2');
      if (!pax || isNaN(pax) || parseInt(pax) <= 0) {
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
      targetSessionId = sessionData.session_id;
      alert(`Session created for ${pax} people`);
    }
  }
  
  if (!targetSessionId) throw new Error('No valid session');
  
  // Create items for the order with correct format
  const items = ORDERS_CART.map(cartItem => ({
    menu_item_id: cartItem.id,
    quantity: cartItem.quantity,
    selected_option_ids: cartItem.variants.map(v => parseInt(v.optionId))
  }));
  
  const res = await fetch(`${API}/sessions/${targetSessionId}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
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

async function toggleOrdersHistoryMode() {
  ORDERS_HISTORY_MODE = !ORDERS_HISTORY_MODE;
  
  const menuItemsView = document.getElementById('orders-menu-items-view');
  const historyView = document.getElementById('orders-history-left-view');
  const cartView = document.getElementById('orders-cart-view');
  const detailsView = document.getElementById('orders-details-view');
  const categoryTabs = document.getElementById('orders-category-tabs');
  
  if (ORDERS_HISTORY_MODE) {
    // Show history view - full width
    menuItemsView.style.display = 'none';
    if (categoryTabs) categoryTabs.style.display = 'none';
    historyView.classList.add('active');
    cartView.style.display = 'none';
    detailsView.style.display = 'flex';
    
    // Load order history in left panel
    await loadOrdersHistoryLeftPanel();
    
    // Clear details initially
    const detailsContent = document.getElementById('order-details-content');
    if (detailsContent) {
      detailsContent.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Select an order to view details</p>';
    }
  } else {
    // Back to cart view
    menuItemsView.style.display = 'flex';
    if (categoryTabs) categoryTabs.style.display = 'flex';
    historyView.classList.remove('active');
    cartView.style.display = 'flex';
    detailsView.style.display = 'none';
    
    VIEWING_HISTORICAL_ORDER = null;
    clearOrderStatusDisplay();
  }
}

async function loadOrdersHistoryLeftPanel() {
  const historyListLeft = document.getElementById('orders-history-list-left');
  if (!historyListLeft) return;
  
  historyListLeft.innerHTML = '<p style="color: #999; text-align: center; padding: 12px;">Loading...</p>';
  
  try {
    // If sessions tab is selected, load sessions instead
    if (ORDER_HISTORY_FILTER === 'sessions') {
      const response = await fetch(`${API}/restaurants/${restaurantId}/sessions`);
      if (!response.ok) throw new Error('Failed to load sessions');
      
      const sessions = await response.json();
      ALL_SESSIONS_DATA = sessions || [];
      
      // Create tabs for filtering (always show tabs, even if no sessions)
      let html = '<div style="display: flex; gap: 4px; margin-bottom: 12px; border-bottom: 1px solid #ddd; padding-bottom: 8px; flex-wrap: wrap;">';
      
      const tabs = [
        { id: 'all', label: '📋 All Orders', icon: '📋', count: ALL_ORDERS_DATA.length },
        { id: 'counter', label: '🛒 Order Now', icon: '🛒', count: ALL_ORDERS_DATA.filter(o => o.order_type === 'counter').length },
        { id: 'togo', label: '🎁 To-Go', icon: '🎁', count: ALL_ORDERS_DATA.filter(o => o.order_type === 'to-go').length },
        { id: 'sessions', label: '🪑 Sessions', icon: '🪑', count: sessions.length }
      ];
      
      tabs.forEach(tab => {
        const isActive = ORDER_HISTORY_FILTER === tab.id;
        const bgColor = isActive ? '#667eea' : '#f0f0f0';
        const textColor = isActive ? 'white' : '#333';
        const borderStyle = isActive ? '2px solid #667eea' : '1px solid #e0e0e0';
        html += `
          <button onclick="setOrderHistoryFilter('${tab.id}')" style="
            padding: 8px 14px;
            border: ${borderStyle};
            border-radius: 6px;
            background: ${bgColor};
            color: ${textColor};
            font-size: 12px;
            font-weight: ${isActive ? '600' : '400'};
            cursor: pointer;
            transition: all 0.2s;
          ">
            ${tab.label} (${tab.count})
          </button>
        `;
      });
      
      html += '</div>';
      
      // Show empty state if no sessions
      if (!sessions || sessions.length === 0) {
        html += '<p style="color: #999; text-align: center; padding: 12px;">No sessions yet</p>';
        historyListLeft.innerHTML = html;
        return;
      }
      
      // Render sessions
      sessions.forEach(session => {
        const startDate = new Date(session.started_at);
        const startTime = formatTimeWithTimezone(session.started_at, restaurantTimezone, 'time');
        const startDateStr = formatTimeWithTimezone(session.started_at, restaurantTimezone, 'date');
        
        let sessionLabel = 'Session';
        if (session.table_name) {
          sessionLabel = `Table ${session.table_name}`;
        }
        
        // Use timezone-aware duration calculation
        const elapsedTime = session.ended_at 
          ? calculateElapsedTimeWithTimezone(session.ended_at, restaurantTimezone)
          : calculateElapsedTimeWithTimezone(session.started_at, restaurantTimezone);
        
        const durationDisplay = elapsedTime.display;
        
        const isActive = !session.ended_at;
        const statusColor = isActive ? '#10b981' : '#6b7280';
        const statusLabel = isActive ? 'Active' : 'Closed';
        
        html += `
          <div class="session-history-item" onclick="selectSessionFromHistory(${session.session_id})" style="padding: 10px; border: 1px solid #eee; border-radius: 4px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s;">
            <div style="font-weight: 600; font-size: 12px;">${sessionLabel}</div>
            <div style="font-size: 11px; color: #666; margin-top: 2px;">${startDateStr} at ${startTime} • ${durationDisplay}</div>
            <div style="font-size: 11px; color: #666; margin-top: 2px;">👥 ${session.pax} people</div>
            <div style="font-size: 10px; padding: 2px 6px; border-radius: 2px; margin-top: 4px; display: inline-block; background-color: ${statusColor}; color: white;">
              ${statusLabel}
            </div>
          </div>
        `;
      });
      
      historyListLeft.innerHTML = html;
      
      
      // Add hover effect
      document.querySelectorAll('.session-history-item').forEach(item => {
        item.onmouseover = function() { this.style.backgroundColor = '#f5f5f5'; };
        item.onmouseout = function() { this.style.backgroundColor = 'transparent'; };
      });
      
      return;
    }
    
    // Load orders for other tabs
    const response = await fetch(`${API}/restaurants/${restaurantId}/orders?limit=100`);
    if (!response.ok) throw new Error('Failed to load order history');
    
    const orders = await response.json();
    ALL_ORDERS_DATA = orders || [];
    
    if (!orders || orders.length === 0) {
      historyListLeft.innerHTML = '<p style="color: #999; text-align: center; padding: 12px;">No orders yet</p>';
      return;
    }
    
    // Create tabs for filtering
    let html = '<div style="display: flex; gap: 4px; margin-bottom: 12px; border-bottom: 1px solid #ddd; padding-bottom: 8px; flex-wrap: wrap;">';
    
    // Fetch session count for Sessions tab
    const sessionsResponse = await fetch(`${API}/restaurants/${restaurantId}/sessions`);
    const sessionCount = sessionsResponse.ok ? (await sessionsResponse.json()).length : 0;
    
    const tabs = [
      { id: 'all', label: '📋 All Orders', icon: '📋', count: orders.length },
      { id: 'counter', label: '🛒 Order Now', icon: '🛒', count: orders.filter(o => o.order_type === 'counter').length },
      { id: 'togo', label: '🎁 To-Go', icon: '🎁', count: orders.filter(o => o.order_type === 'to-go').length },
      { id: 'sessions', label: '🪑 Sessions', icon: '🪑', count: sessionCount }
    ];
    
    tabs.forEach(tab => {
      const isActive = ORDER_HISTORY_FILTER === tab.id;
      const bgColor = isActive ? '#667eea' : '#f0f0f0';
      const textColor = isActive ? 'white' : '#333';
      const borderStyle = isActive ? '2px solid #667eea' : '1px solid #e0e0e0';
      html += `
        <button onclick="setOrderHistoryFilter('${tab.id}')" style="
          padding: 8px 14px;
          border: ${borderStyle};
          border-radius: 6px;
          background: ${bgColor};
          color: ${textColor};
          font-size: 12px;
          font-weight: ${isActive ? '600' : '400'};
          cursor: pointer;
          transition: all 0.2s;
        ">
          ${tab.label} (${tab.count})
        </button>
      `;
    });
    
    html += '</div>';
    
    // Filter orders based on selected tab
    let filteredOrders = orders;
    if (ORDER_HISTORY_FILTER !== 'all') {
      const typeMap = { 'table': 'table', 'counter': 'counter', 'togo': 'to-go' };
      filteredOrders = orders.filter(o => o.order_type === typeMap[ORDER_HISTORY_FILTER]);
    }
    
    if (filteredOrders.length === 0) {
      html += '<p style="color: #999; text-align: center; padding: 12px;">No orders in this category</p>';
      historyListLeft.innerHTML = html;
      return;
    }
    
    // Render orders
    filteredOrders.forEach(order => {
      const statusStyle = getStatusStyle(order.status);
      let orderTypeLabel = 'Order';
      
      if (order.order_type === 'table') {
        orderTypeLabel = order.table_name ? `Table ${order.table_name}` : 'Table';
      } else if (order.order_type === 'counter') {
        orderTypeLabel = '🛒 Order Now';
      } else if (order.order_type === 'to-go') {
        orderTypeLabel = '🎁 To-Go';
      }
      
      const orderIcon = order.order_type === 'counter' ? '🛒' : (order.order_type === 'to-go' ? '🎁' : '🪑');
      const createdDate = new Date(order.created_at);
      const timeStr = formatTimeWithTimezone(order.created_at, restaurantTimezone, 'time');
      
      html += `
        <div class="order-history-item" onclick="selectOrderFromHistory(${order.id})" style="padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px; cursor: pointer; transition: all 0.3s; background: white; border-left: 4px solid #667eea;">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 12px; color: #1f2937;">Order #${order.id}</div>
              <div style="font-size: 11px; color: #6b7280; margin-top: 3px;">${orderTypeLabel}</div>
              <div style="font-size: 10px; color: #9ca3af; margin-top: 2px;">⏱️ ${timeStr}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 700; font-size: 13px; color: #667eea;">$${(order.total_cents / 100).toFixed(2)}</div>
              <div style="font-size: 10px; padding: 3px 6px; border-radius: 3px; margin-top: 4px; display: inline-block; ${statusStyle}; font-weight: 600;">
                ${formatOrderStatus(order.status)}
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    historyListLeft.innerHTML = html;
    
    // Add hover effect
    document.querySelectorAll('.order-history-item').forEach(item => {
      item.onmouseover = function() { this.style.backgroundColor = '#f3f4f6'; this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; };
      item.onmouseout = function() { this.style.backgroundColor = 'white'; this.style.boxShadow = 'none'; };
    });
    
  } catch (err) {
    console.error('Error loading order history:', err);
    historyListLeft.innerHTML = `<p style="color: #ef4444; text-align: center; padding: 12px;">Error loading history</p>`;
  }
}

// Set order history filter and reload
function setOrderHistoryFilter(filterType) {
  ORDER_HISTORY_FILTER = filterType;
  loadOrdersHistoryLeftPanel();
}

async function selectSessionFromHistory(sessionId) {
  try {
    // Fetch orders for this session
    const response = await fetch(`${API}/sessions/${sessionId}/orders`);
    if (!response.ok) throw new Error('Failed to load session orders');
    
    let data = await response.json();
    
    // Handle response format - API returns { items: [orders...] }
    let orders = [];
    if (data.items && Array.isArray(data.items)) {
      // Flatten orders: each item in data.items is an order with nested items
      data.items.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach(item => {
            orders.push({
              order_id: order.order_id,
              item_name: item.name,
              quantity: item.quantity,
              unit_price_cents: item.unit_price_cents,
              variants: item.variants,
              status: item.status,
              created_at: order.created_at
            });
          });
        }
      });
    } else if (Array.isArray(data)) {
      orders = data;
    }
    
    console.log('Session orders fetched:', { sessionId, orderCount: orders.length, originalData: data });
    
    // Display session details with its orders
    displaySessionDetails(sessionId, orders);
  } catch (err) {
    console.error('Error selecting session:', err);
    const detailsContent = document.getElementById('order-details-content');
    if (detailsContent) {
      detailsContent.innerHTML = `<p style="color: #ef4444; text-align: center; padding: 20px;">Error loading session</p>`;
    }
  }
}

function displaySessionDetails(sessionId, orders) {
  const detailsContent = document.getElementById('order-details-content');
  const detailsTitle = document.getElementById('order-details-title');
  
  if (!detailsContent) return;
  
  // Ensure orders is an array
  if (!Array.isArray(orders)) {
    console.error('Orders is not an array:', orders);
    detailsContent.innerHTML = `<p style="color: #ef4444; text-align: center; padding: 20px;">Invalid session data</p>`;
    return;
  }
  
  // Find session info from global data
  const session = ALL_SESSIONS_DATA.find(s => s.session_id === sessionId);
  if (!session) {
    console.error('Session not found:', sessionId);
    detailsContent.innerHTML = `<p style="color: #ef4444; text-align: center; padding: 20px;">Session not found</p>`;
    return;
  }
  
  // Format session times
  const startDate = new Date(session.started_at);
  const endDate = session.ended_at ? new Date(session.ended_at) : null;
  const startTime = formatTimeWithTimezone(session.started_at, restaurantTimezone, 'datetime');
  const endTime = session.ended_at ? formatTimeWithTimezone(session.ended_at, restaurantTimezone, 'datetime') : 'Active';
  
  // Use timezone-aware duration calculation
  const durationInfo = session.ended_at 
    ? calculateElapsedTimeWithTimezone(session.ended_at, restaurantTimezone)
    : calculateElapsedTimeWithTimezone(session.started_at, restaurantTimezone);
  const durationMinutes = durationInfo.minutes;
  
  let sessionLabel = 'Session';
  if (session.table_name) {
    sessionLabel = `Table ${session.table_name}`;
  }
  
  // Group orders by order_id to show order structure
  const orderMap = {};
  if (orders.length > 0) {
    orders.forEach(item => {
      if (!orderMap[item.order_id]) {
        orderMap[item.order_id] = {
          order_id: item.order_id,
          created_at: item.created_at,
          items: []
        };
      }
      orderMap[item.order_id].items.push(item);
    });
  }
  
  const orderList = Object.values(orderMap);
  
  // Calculate totals
  let totalItems = 0;
  let totalPrice = 0;
  orders.forEach(item => {
    totalItems += (item.quantity || 0);
    totalPrice += ((item.unit_price_cents || 0) * (item.quantity || 0));
  });
  
  // Build items HTML - group by order
  const itemsHTML = orderList.length > 0
    ? orderList.map(order => {
      const orderTotal = order.items.reduce((sum, item) => sum + ((item.unit_price_cents || 0) * (item.quantity || 0)), 0);
      const itemsInOrder = order.items.map(item => `
        <div style="padding: 8px; background: white; border-radius: 3px; margin-bottom: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: start; gap: 6px;">
            <div style="flex: 1;">
              <div style="font-weight: 500; font-size: 11px; color: #333;">${item.item_name || 'Unknown Item'}</div>
              <div style="font-size: 10px; color: #666; margin-top: 1px;">Qty: ${item.quantity || 0} × $${((item.unit_price_cents || 0) / 100).toFixed(2)}</div>
              ${item.variants ? `<div style="font-size: 9px; color: #999; margin-top: 2px;">${item.variants}</div>` : ''}
            </div>
            <div style="font-weight: 600; white-space: nowrap; font-size: 11px; color: #667eea;">$${(((item.unit_price_cents || 0) * (item.quantity || 0)) / 100).toFixed(2)}</div>
          </div>
        </div>
      `).join('');
      
      return `
        <div style="padding: 12px; background: #f9f9f9; border-radius: 6px; margin-bottom: 10px; border-left: 4px solid #667eea;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <div style="font-weight: 600; font-size: 11px; color: #333;">Order #${order.order_id}</div>
            <div style="font-size: 10px; color: #666;">${formatTimeWithTimezone(order.created_at, restaurantTimezone, 'time')}</div>
          </div>
          ${itemsInOrder}
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 10px; color: #666;">Order Total:</div>
            <div style="font-weight: 700; color: #667eea;">$${(orderTotal / 100).toFixed(2)}</div>
          </div>
        </div>
      `;
    }).join('')
    : '<p style="color: #999; font-size: 12px;">No items in this session</p>';
  
  // Build full details HTML
  const html = `
    <div style="margin-bottom: 20px;">
      <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">
        <!-- Session Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;">
          <div>
            <div style="font-size: 12px; color: #666;" data-i18n="admin.session-label">Session</div>
            <div style="font-size: 18px; font-weight: 700; color: #2c3e50; margin-top: 2px;">${sessionLabel}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: #666;"><span data-i18n="admin.session-id">ID:</span> ${sessionId}</div>
            <div style="font-size: 12px; font-weight: 600; color: #667eea; margin-top: 4px;">👥 ${session.pax} <span data-i18n="admin.session-people">people</span></div>
          </div>
        </div>
        
        <!-- Session Times -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; padding: 12px; background: #f9f9f9; border-radius: 6px;">
          <div>
            <div style="font-size: 11px; color: #666; margin-bottom: 2px;" data-i18n="admin.session-started">Started</div>
            <div style="font-size: 12px; font-weight: 600; color: #333;">${startTime}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #666; margin-bottom: 2px;" data-i18n="admin.session-duration">Duration</div>
            <div style="font-size: 12px; font-weight: 600; color: #333;">${durationMinutes} <span data-i18n="admin.minutes">minutes</span></div>
          </div>
        </div>
        
        <!-- Orders Count -->
        <div style="padding: 12px; background: #f0f7ff; border-left: 4px solid #667eea; border-radius: 4px; margin-bottom: 16px;">
          <div style="font-size: 12px; font-weight: 600; color: #667eea;">📦 ${orderList.length} <span data-i18n="admin.orders-count">order(s) in this session</span></div>
          <div style="font-size: 11px; color: #666; margin-top: 4px;"><span data-i18n="admin.items-total">${totalItems} items</span> • <span data-i18n="admin.total">Total:</span> $${(totalPrice / 100).toFixed(2)}</div>
        </div>
        
        <!-- Items List -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; font-weight: 600; color: #333; margin-bottom: 10px;" data-i18n="admin.items-in-session">Items in Session:</div>
          <div style="max-height: 400px; overflow-y: auto;">
            ${itemsHTML || '<p style="color: #999; font-size: 12px;" data-i18n="admin.no-items-session">No items in this session</p>'}
          </div>
        </div>
        
        <!-- Total -->
        <div style="padding: 12px; background: #f0f0f0; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="font-weight: 600; color: #333;" data-i18n="admin.session-total">Session Total:</div>
          <div style="font-size: 18px; font-weight: 700; color: #667eea;">$${(totalPrice / 100).toFixed(2)}</div>
        </div>
        
        <!-- Action Buttons -->
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <button onclick="printBill(${sessionId})" style="
            flex: 1;
            padding: 10px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#3b82f6'" data-i18n="admin.print-button">
            🖨️ Print
          </button>
          <button onclick="emailSessionOrder(${sessionId})" style="
            flex: 1;
            padding: 10px;
            background: #8b5cf6;
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='#6d28d9'" onmouseout="this.style.background='#8b5cf6'" data-i18n="admin.email-button">
            📧 Email
          </button>
        </div>
        
        <!-- Close Bill Button -->
        ${!session.ended_at ? `
          <button onclick="closeBillModal(${sessionId})" style="
            width: 100%;
            padding: 12px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
            💰 Close Bill
          </button>
        ` : `
          <div style="padding: 12px; background: #d1d5db; border-radius: 6px; text-align: center; color: #666; font-weight: 600;">
            ✓ Session Closed
          </div>
        `}
      </div>
    </div>
  `;
  
  if (detailsTitle) {
    detailsTitle.textContent = `Session: ${sessionLabel}`;
  }
  
  detailsContent.innerHTML = html;
}



async function selectOrderFromHistory(orderId) {
  try {
    // Fetch order details
    const response = await fetch(`${API}/restaurants/${restaurantId}/orders/${orderId}`);
    if (!response.ok) throw new Error('Failed to load order details');
    
    const order = await response.json();
    
    // Display order details in right panel
    displayOrderDetails(order);
    
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
  
  // Format order time - parse as UTC and display in local timezone
  var dateStr = order.created_at.trim();
  var createdDate;
  
  if (dateStr.includes('T') && dateStr.includes('Z')) {
    // ISO 8601 with Z - parse as UTC
    createdDate = new Date(dateStr);
  } else if (dateStr.includes('T')) {
    // ISO format without Z - treat as UTC by adding Z
    createdDate = new Date(dateStr + 'Z');
  } else {
    // Not ISO format
    createdDate = new Date(dateStr);
  }
  
  const orderTime = formatTimeWithTimezone(dateStr, restaurantTimezone, 'datetime');
  
  // Calculate totals
  const itemsTotal = order.items.reduce((sum, item) => sum + (item.price_cents * item.quantity), 0);
  const serviceCharge = Math.round(itemsTotal * 0.1); // 10% service charge (adjust as needed)
  const grandTotal = itemsTotal + serviceCharge;
  
  // Build items HTML
  const itemsHTML = order.items.map(item => `
    <div style="padding: 12px; background: #f9f9f9; border-radius: 6px; margin-bottom: 8px; border-left: 4px solid #2c3e50;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <div style="font-weight: 600; color: #333;">${item.item_name}</div>
        <div style="font-weight: 600; color: #2c3e50;">$${(item.price_cents / 100).toFixed(2)}</div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; color: #666;">
        <div><span data-i18n="admin.qty-label">Qty:</span> ${item.quantity}</div>
        <div><span data-i18n="admin.subtotal-label">Subtotal:</span> $${(item.price_cents * item.quantity / 100).toFixed(2)}</div>
      </div>
      ${item.variants ? `<div style="font-size: 11px; color: #999; margin-top: 4px;"><span data-i18n="admin.variants-label">Variants:</span> ${item.variants}</div>` : ''}
    </div>
  `).join('');
  
  // Format status
  const statusStyle = getStatusStyle(order.status);
  const statusText = formatOrderStatus(order.status);
  
  // Build full details HTML
  const html = `
    <div style="margin-bottom: 20px;">
      <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;">
          <div>
            <div style="font-size: 12px; color: #666;" data-i18n="admin.order-number">Order Number</div>
            <div style="font-size: 20px; font-weight: 700; color: #2c3e50; margin-top: 2px;">#${order.id}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 12px; padding: 6px 12px; border-radius: 4px; display: inline-block; ${statusStyle}; font-weight: 600;">
              ${statusText}
            </div>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div>
            <div style="font-size: 12px; color: #999; text-transform: uppercase; font-weight: 600;" data-i18n="admin.order-time-label">Order Time</div>
            <div style="font-size: 14px; color: #333; margin-top: 4px;">${orderTime}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #999; text-transform: uppercase; font-weight: 600;" data-i18n="admin.order-total-items">Total Items</div>
            <div style="font-size: 14px; color: #333; margin-top: 4px;">${order.items.length} <span data-i18n="admin.items">item${order.items.length !== 1 ? 's' : ''}</span></div>
          </div>
        </div>
      </div>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #333;" data-i18n="admin.order-items-label">Order Items</h4>
      ${itemsHTML}
    </div>
    
    <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">
      <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #333;" data-i18n="admin.order-summary">Order Summary</h4>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0;">
        <div style="color: #666; font-size: 13px;" data-i18n="admin.subtotal">Subtotal</div>
        <div style="color: #333; font-weight: 500; font-size: 13px;">$${(itemsTotal / 100).toFixed(2)}</div>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;">
        <div style="color: #666; font-size: 13px;" data-i18n="admin.service-charge">Service Charge (10%)</div>
        <div style="color: #333; font-weight: 500; font-size: 13px;">$${(serviceCharge / 100).toFixed(2)}</div>
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="color: #333; font-size: 14px; font-weight: 600;" data-i18n="admin.total">Total</div>
        <div style="color: #2c3e50; font-size: 20px; font-weight: 700;">$${(grandTotal / 100).toFixed(2)}</div>
      </div>
    </div>
  `;
  
  detailsContent.innerHTML = html;
  detailsTitle.textContent = `Order #${order.id}`;
}

async function toggleOrdersHistory() {
  const panel = document.getElementById('orders-history-panel');
  if (!panel) return;
  
  if (panel.style.display === 'none') {
    // Show history
    panel.style.display = 'block';
    await loadOrdersHistory();
  } else {
    // Hide history
    panel.style.display = 'none';
    VIEWING_HISTORICAL_ORDER = null;
    clearOrderStatusDisplay();
  }
}

async function loadOrdersHistory() {
  const historyList = document.getElementById('orders-history-list');
  if (!historyList) return;
  
  historyList.innerHTML = '<p style="color: #999; text-align: center; padding: 12px;">Loading...</p>';
  
  try {
    // Fetch historical orders from API
    const response = await fetch(`${API}/restaurants/${restaurantId}/orders?limit=20`);
    if (!response.ok) throw new Error('Failed to load order history');
    
    const orders = await response.json();
    
    if (!orders || orders.length === 0) {
      historyList.innerHTML = '<p style="color: #999; text-align: center; padding: 12px;">No orders yet</p>';
      return;
    }
    
    // Render order history list
    historyList.innerHTML = orders.map(order => {
      const statusStyle = getStatusStyle(order.status);
      return `
        <div class="order-history-item" style="padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center;">
          <div onclick="restoreOrderToCart(${order.id})" style="flex: 1;">
            <div style="font-weight: 600; font-size: 13px;">Order #${order.id}</div>
            <div style="font-size: 12px; color: #666; margin-top: 2px;">Total: $${(order.total_cents / 100).toFixed(2)}</div>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <div style="font-size: 11px; padding: 4px 8px; border-radius: 3px; ${statusStyle}">
              ${formatOrderStatus(order.status)}
            </div>
            <button onclick="event.stopPropagation(); printReceipt(${order.id})" title="Print Receipt" style="padding: 4px 8px; background: #2c3e50; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: 600;">🖨️</button>
            <button onclick="event.stopPropagation(); emailReceipt(${order.id})" title="Email Receipt" style="padding: 4px 8px; background: #3498db; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: 600;">✉️</button>
          </div>
        </div>
      `;
    }).join('');
    
    // Add hover effect
    document.querySelectorAll('.order-history-item').forEach(item => {
      item.onmouseover = function() { this.style.backgroundColor = '#f5f5f5'; };
      item.onmouseout = function() { this.style.backgroundColor = 'transparent'; };
    });
    
  } catch (err) {
    console.error('Error loading order history:', err);
    historyList.innerHTML = `<p style="color: #ef4444; text-align: center; padding: 12px;">Error loading history</p>`;
  }
}


async function restoreOrderToCart(orderId) {
  // Alias to selectOrderFromHistory for backward compatibility
  return selectOrderFromHistory(orderId);
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
    'pending': 'Pending',
    'completed': 'Completed'
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
    const order = ORDERS.find(o => o.id === orderId);
    if (!order) {
      alert('Order not found');
      return;
    }

    // Build receipt HTML
    let receiptHTML = `
      <html>
        <head>
          <title>Receipt - Order #${order.id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .receipt-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .receipt-title { font-size: 18px; font-weight: bold; }
            .receipt-content { margin: 20px 0; }
            .receipt-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .receipt-item-name { flex: 1; }
            .receipt-item-price { text-align: right; min-width: 100px; }
            .receipt-total { display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; margin-top: 20px; padding-top: 10px; border-top: 2px solid #000; }
            .receipt-footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="receipt-header">
            <div class="receipt-title">Receipt</div>
            <div>Order #${order.id}</div>
            <div style="font-size: 12px; color: #666;">${new Date(order.created_at).toLocaleString()}</div>
          </div>
          <div class="receipt-content">
            <div style="font-weight: bold; margin-bottom: 10px;">Items:</div>
    `;

    // Add order items
    order.items.forEach(item => {
      const itemTotal = (item.item_total_cents / 100).toFixed(2);
      receiptHTML += `
        <div class="receipt-item">
          <div class="receipt-item-name">${item.menu_item_name} x${item.quantity}</div>
          <div class="receipt-item-price">$${itemTotal}</div>
        </div>
      `;
    });

    // Add total
    const totalAmount = (order.total_cents / 100).toFixed(2);
    receiptHTML += `
          </div>
          <div class="receipt-total">
            <span>Total:</span>
            <span>$${totalAmount}</span>
          </div>
          <div class="receipt-footer">
            <p>Thank you for your order!</p>
          </div>
        </body>
      </html>
    `;

    // Open print dialog
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    printWindow.print();
  } catch (err) {
    console.error('Error printing receipt:', err);
    alert('Error printing receipt: ' + err.message);
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