// ============= ORDERS MODULE =============
// Order management for staff to place customer orders

// Global state for orders
let ORDERS_CART = [];
let ORDERS_CART_EDIT_MODE = false;
let ORDERS_TABLES = [];
let CURRENT_ORDER_TYPE = null;
let ORDERS_CATEGORIES = [];
let SELECTED_ORDERS_CATEGORY = null;
let ORDERS_MENU_ITEMS = [];
let ORDERS_HISTORY_MODE = false;

// ========== INITIALIZE ORDERS ==========
async function initializeOrders() {
  
  // Load categories and menu items together using the combined /menu endpoint
  await loadOrdersMenu();
  
  // Load tables for table selection
  await loadOrdersTables();
  
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
    btn.className = 'category-filter-btn';
    if (SELECTED_ORDERS_CATEGORY && SELECTED_ORDERS_CATEGORY.id === cat.id) {
      btn.classList.add('active');
    }
    btn.textContent = cat.name;
    btn.setAttribute('data-category', cat.id);
    btn.onclick = () => selectOrdersCategory(cat.id);
    
    categoryTabsContainer.appendChild(btn);
  });
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
  
  if (!cartList) return;
  
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
      submitBtn.textContent = 'Add to Table';
      if (tableUI) tableUI.style.display = 'block';
    } else if (orderType === 'pay-now') {
      submitBtn.textContent = 'Order Now';
    } else if (orderType === 'to-go') {
      submitBtn.textContent = 'To Go Order';
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
    // For "Order Now", create items array directly with correct format
    const items = ORDERS_CART.map(cartItem => ({
      menu_item_id: cartItem.id,
      quantity: cartItem.quantity,
      selected_option_ids: cartItem.variants.map(v => parseInt(v.optionId))
    }));
    
    // Calculate total
    const totalCents = ORDERS_CART.reduce((sum, item) => sum + (item.price_cents * item.quantity), 0);
    
    // Create temporary session for this order
    const pax = 1;
    const sessionRes = await fetch(`${API}/table-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: restaurantId,
        pax: pax,
        table_id: null,
        is_order_now: true
      })
    });
    
    if (!sessionRes.ok) {
      const error = await sessionRes.json();
      throw new Error(error.error || 'Failed to create order session');
    }
    
    const session = await sessionRes.json();
    
    // Create order
    const orderRes = await fetch(`${API}/sessions/${session.session_id || session.id}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    
    if (!orderRes.ok) {
      throw new Error('Failed to create order');
    }
    
    const order = await orderRes.json();
    
    // Close session and process payment immediately
    const closeRes = await fetch(`${API}/sessions/${session.session_id || session.id}/close`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paid_amount: totalCents,
        payment_method: 'card',
        payment_status: 'settled'
      })
    });
    
    // Clear cart
    ORDERS_CART = [];
    updateOrdersCartDisplay();
    document.getElementById('order-type-pay').checked = false;
    updateOrderTypeUI();
    
    alert('Order placed and payment processed');
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
    
    // Create temporary session for to-go order
    const pax = 1;
    const sessionRes = await fetch(`${API}/table-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: restaurantId,
        pax: pax,
        table_id: null,
        is_to_go: true
      })
    });
    
    if (!sessionRes.ok) {
      const error = await sessionRes.json();
      throw new Error(error.error || 'Failed to create to-go session');
    }
    
    const session = await sessionRes.json();
    
    // Create order
    const orderRes = await fetch(`${API}/sessions/${session.session_id || session.id}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    
    if (!orderRes.ok) {
      throw new Error('Failed to create order');
    }
    
    // Clear cart
    ORDERS_CART = [];
    updateOrdersCartDisplay();
    document.getElementById('order-type-togo').checked = false;
    updateOrderTypeUI();
    
    alert(`To-go order created for ${customerName}`);
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
  
  if (ORDERS_HISTORY_MODE) {
    // Show history view
    menuItemsView.style.display = 'none';
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
    const response = await fetch(`${API}/restaurants/${restaurantId}/orders?limit=20`);
    if (!response.ok) throw new Error('Failed to load order history');
    
    const orders = await response.json();
    
    if (!orders || orders.length === 0) {
      historyListLeft.innerHTML = '<p style="color: #999; text-align: center; padding: 12px;">No orders yet</p>';
      return;
    }
    
    // Render order history list in left panel
    historyListLeft.innerHTML = orders.map(order => {
      const statusStyle = getStatusStyle(order.status);
      return `
        <div class="order-history-item" onclick="selectOrderFromHistory(${order.id})" style="padding: 10px; border: 1px solid #eee; border-radius: 4px; margin-bottom: 6px; cursor: pointer; transition: all 0.2s;">
          <div style="font-weight: 600; font-size: 12px;">Order #${order.id}</div>
          <div style="font-size: 11px; color: #666; margin-top: 2px;">$${(order.total_cents / 100).toFixed(2)}</div>
          <div style="font-size: 10px; padding: 2px 4px; border-radius: 2px; margin-top: 2px; display: inline-block; ${statusStyle}">
            ${formatOrderStatus(order.status)}
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
    historyListLeft.innerHTML = `<p style="color: #ef4444; text-align: center; padding: 12px;">Error loading history</p>`;
  }
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
  
  // Format order time
  const orderTime = new Date(order.created_at).toLocaleString();
  
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
        <div>Qty: ${item.quantity}</div>
        <div>Subtotal: $${(item.price_cents * item.quantity / 100).toFixed(2)}</div>
      </div>
      ${item.variants ? `<div style="font-size: 11px; color: #999; margin-top: 4px;">Variants: ${item.variants}</div>` : ''}
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
            <div style="font-size: 12px; color: #666;">Order Number</div>
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
            <div style="font-size: 12px; color: #999; text-transform: uppercase; font-weight: 600;">Order Time</div>
            <div style="font-size: 14px; color: #333; margin-top: 4px;">${orderTime}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #999; text-transform: uppercase; font-weight: 600;">Total Items</div>
            <div style="font-size: 14px; color: #333; margin-top: 4px;">${order.items.length} item${order.items.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #333;">Order Items</h4>
      ${itemsHTML}
    </div>
    
    <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px;">
      <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #333;">Order Summary</h4>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0;">
        <div style="color: #666; font-size: 13px;">Subtotal</div>
        <div style="color: #333; font-weight: 500; font-size: 13px;">$${(itemsTotal / 100).toFixed(2)}</div>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;">
        <div style="color: #666; font-size: 13px;">Service Charge (10%)</div>
        <div style="color: #333; font-weight: 500; font-size: 13px;">$${(serviceCharge / 100).toFixed(2)}</div>
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="color: #333; font-size: 14px; font-weight: 600;">Total</div>
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
        <div class="order-history-item" onclick="restoreOrderToCart(${order.id})" style="padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600; font-size: 13px;">Order #${order.id}</div>
            <div style="font-size: 12px; color: #666; margin-top: 2px;">Total: $${(order.total_cents / 100).toFixed(2)}</div>
          </div>
          <div style="font-size: 11px; padding: 4px 8px; border-radius: 3px; ${statusStyle}">
            ${formatOrderStatus(order.status)}
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