// ============= MENU MODULE =============
// All menu management functionality extracted from admin.js
// Uses card-based layout similar to admin-tables.js

// ========== MENU EDIT MODE TOGGLE ==========
function toggleMenuEditMode() {
  // Only allow edit mode when menu section is active
  if (CURRENT_SECTION !== 'menu') {
    return;
  }
  
  // Toggle both the global flag and the body class (for compatibility)
  IS_EDIT_MODE = !IS_EDIT_MODE;
  document.body.classList.toggle("edit-mode");
  
  const createSection = document.getElementById('menu-create-section');
  if (createSection) {
    if (IS_EDIT_MODE) {
      createSection.classList.remove('hidden');
    } else {
      createSection.classList.add('hidden');
      // Close any open edit modals
      const editModal = document.getElementById('food-item-edit-modal');
      if (editModal) editModal.style.display = 'none';
      const variantModal = document.getElementById('variant-edit-modal');
      if (variantModal) variantModal.style.display = 'none';
    }
  }
  
  // Update button appearance - match the tables pattern
  const editBtn = document.getElementById('menu-edit-btn');
  if (editBtn) {
    if (IS_EDIT_MODE) {
      editBtn.innerHTML = '<img src="/uploads/website/pencil.png" alt="edit" class="btn-icon"> Done';
      editBtn.classList.add("active");
    } else {
      editBtn.innerHTML = '<img src="/uploads/website/pencil.png" alt="edit" class="btn-icon"> Edit';
      editBtn.classList.remove("active");
    }
  }
  
  // Re-render to show/hide add buttons
  renderMenuCategoryTabs();
  renderMenuItemsGrid();
}

async function loadMenuItems() {

  // Load categories
  const catRes = await fetch(`${API}/restaurants/${restaurantId}/menu_categories`);
  MENU_CATEGORIES = await catRes.json();

  // Load items
  const res = await fetch(`${API}/restaurants/${restaurantId}/menu/staff`);
  MENU_ITEMS = await res.json();

  // Auto-select first category
  if (!SELECTED_MENU_CATEGORY && MENU_CATEGORIES.length) {
    SELECTED_MENU_CATEGORY = MENU_CATEGORIES[0];
  }

  renderMenuCategoryTabs();
  renderMenuItemsGrid();
}

function renderMenuCategoryTabs() {
  // Render to both desktop tabs and mobile sidebar
  const tabs = document.getElementById("menu-category-tabs");
  const sidebar = document.querySelector(".menu-category-sidebar");
  
  if (!tabs && !sidebar) return;
  
  if (tabs) tabs.innerHTML = "";
  if (sidebar) sidebar.innerHTML = "";

  // If no categories exist and in edit mode, show "Create Category" button
  if (MENU_CATEGORIES.length === 0 && IS_EDIT_MODE) {
    const createBtn = document.createElement("button");
    createBtn.className = "tab active";
    createBtn.textContent = "+ Create First Category";
    createBtn.style.flex = "1";
    createBtn.onclick = () => addMenuCategoryPrompt();
    if (tabs) tabs.appendChild(createBtn);
    if (sidebar) sidebar.appendChild(createBtn.cloneNode(true));
    return;
  }

  MENU_CATEGORIES.forEach(cat => {
    // Create wrapper container for category button with controls
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.alignItems = "center";
    wrapper.style.position = "relative";
    wrapper.className = "category-button-wrapper";
    
    const btn = document.createElement("button");
    btn.className =
      SELECTED_MENU_CATEGORY && SELECTED_MENU_CATEGORY.id === cat.id
        ? "tab active"
        : "tab";
    btn.textContent = cat.name;
    btn.categoryId = cat.id;
    btn.style.flex = IS_EDIT_MODE ? "1" : "auto";
    btn.onclick = (e) => {
      if (e.target.classList.contains('category-btn-delete') || e.target.classList.contains('category-btn-edit')) {
        return; // Don't switch category if clicking edit/delete
      }
      SELECTED_MENU_CATEGORY = cat;
      renderMenuCategoryTabs();
      renderMenuItemsGrid();
    };
    wrapper.appendChild(btn);

    // Add edit/delete buttons in edit mode
    if (IS_EDIT_MODE) {
      const editBtn = document.createElement("button");
      editBtn.className = "category-btn-edit";
      editBtn.textContent = "✏️";
      editBtn.style.marginTop = "4px";
      editBtn.style.padding = "4px 8px";
      editBtn.style.backgroundColor = "#3b82f6";
      editBtn.style.color = "white";
      editBtn.style.border = "none";
      editBtn.style.borderRadius = "4px";
      editBtn.style.cursor = "pointer";
      editBtn.title = "Edit category name";
      editBtn.onclick = (e) => {
        e.stopPropagation();
        editMenuCategory(cat.id, cat.name);
      };
      wrapper.appendChild(editBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "category-btn-delete";
      deleteBtn.textContent = "🗑️";
      deleteBtn.style.marginTop = "4px";
      deleteBtn.style.padding = "4px 8px";
      deleteBtn.style.backgroundColor = "#ef4444";
      deleteBtn.style.color = "white";
      deleteBtn.style.border = "none";
      deleteBtn.style.borderRadius = "4px";
      deleteBtn.style.cursor = "pointer";
      deleteBtn.title = "Delete category";
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteMenuCategory(cat.id, cat.name);
      };
      wrapper.appendChild(deleteBtn);
    }

    if (tabs) tabs.appendChild(wrapper);
    
    // For sidebar, create version with edit/delete controls in vertical layout
    if (sidebar) {
      const sidebarWrapper = document.createElement("div");
      sidebarWrapper.style.display = "flex";
      sidebarWrapper.style.flexDirection = "column";
      sidebarWrapper.style.alignItems = "center";
      sidebarWrapper.style.position = "relative";
      sidebarWrapper.className = "category-button-wrapper";
      
      const sidebarBtn = document.createElement("button");
      sidebarBtn.className = btn.className;
      sidebarBtn.textContent = cat.name;
      sidebarBtn.categoryId = cat.id;
      sidebarBtn.style.width = "100%";
      sidebarBtn.style.flex = IS_EDIT_MODE ? "1" : "auto";
      sidebarBtn.onclick = btn.onclick;
      sidebarWrapper.appendChild(sidebarBtn);
      
      // Add edit/delete buttons for sidebar in edit mode
      if (IS_EDIT_MODE) {
        const sidebarEditBtn = document.createElement("button");
        sidebarEditBtn.className = "category-btn-edit";
        sidebarEditBtn.textContent = "✏️";
        sidebarEditBtn.style.marginTop = "4px";
        sidebarEditBtn.style.padding = "4px 8px";
        sidebarEditBtn.style.backgroundColor = "#3b82f6";
        sidebarEditBtn.style.color = "white";
        sidebarEditBtn.style.border = "none";
        sidebarEditBtn.style.borderRadius = "4px";
        sidebarEditBtn.style.cursor = "pointer";
        sidebarEditBtn.title = "Edit category name";
        sidebarEditBtn.onclick = (e) => {
          e.stopPropagation();
          editMenuCategory(cat.id, cat.name);
        };
        sidebarWrapper.appendChild(sidebarEditBtn);
        
        const sidebarDeleteBtn = document.createElement("button");
        sidebarDeleteBtn.className = "category-btn-delete";
        sidebarDeleteBtn.textContent = "🗑️";
        sidebarDeleteBtn.style.marginTop = "4px";
        sidebarDeleteBtn.style.padding = "4px 8px";
        sidebarDeleteBtn.style.backgroundColor = "#ef4444";
        sidebarDeleteBtn.style.color = "white";
        sidebarDeleteBtn.style.border = "none";
        sidebarDeleteBtn.style.borderRadius = "4px";
        sidebarDeleteBtn.style.cursor = "pointer";
        sidebarDeleteBtn.title = "Delete category";
        sidebarDeleteBtn.onclick = (e) => {
          e.stopPropagation();
          deleteMenuCategory(cat.id, cat.name);
        };
        sidebarWrapper.appendChild(sidebarDeleteBtn);
      }
      
      sidebar.appendChild(sidebarWrapper);
    }
  });

  // Add category button (only in edit mode, desktop only)
  if (IS_EDIT_MODE && tabs) {
    const addBtn = document.createElement("button");
    addBtn.className = "add-category-btn";
    addBtn.textContent = "+ Add Category";
    addBtn.onclick = () => addMenuCategoryPrompt();
    tabs.appendChild(addBtn);
  }
}

async function addMenuCategoryPrompt() {
  const categoryName = prompt("Enter new menu category name (e.g., Appetizers, Mains):", "");
  if (!categoryName || !categoryName.trim()) return;

  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/menu_categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: categoryName.trim() })
    });

    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || "Failed to create category");
    }

    await loadMenuItems();
  } catch (err) {
    alert("Error creating category: " + err.message);
  }
}

async function editMenuCategory(categoryId, currentName) {
  const newName = prompt("Edit menu category name:", currentName);
  if (!newName || !newName.trim() || newName === currentName) return;

  try {
    const res = await fetch(`${API}/menu_categories/${categoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() })
    });

    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || "Failed to update category");
    }

    await loadMenuItems();
  } catch (err) {
    alert("Error updating category: " + err.message);
  }
}

async function deleteMenuCategory(categoryId, categoryName) {
  if (!confirm(`Delete category "${categoryName}"? Any menu items in this category will be orphaned.`)) return;

  try {
    const res = await fetch(`${API}/menu_categories/${categoryId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" }
    });

    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || "Failed to delete category");
    }

    await loadMenuItems();
  } catch (err) {
    alert("Error deleting category: " + err.message);
  }
}

function renderMenuItemsGrid() {
  const grid = document.getElementById("menu-items-grid");
  if (!grid) return;
  grid.innerHTML = "";

  if (!SELECTED_MENU_CATEGORY) {
    if (IS_EDIT_MODE && MENU_CATEGORIES.length === 0) {
      grid.innerHTML = `<div class="empty-state"><p>Click "+ Create First Category" above to create a menu category</p></div>`;
    }
    return;
  }

  const items = MENU_ITEMS.filter(i => Number(i.category_id) === Number(SELECTED_MENU_CATEGORY.id));

  // Add "Add Item" card in edit mode
  if (IS_EDIT_MODE) {
    const addCard = document.createElement("div");
    addCard.className = "menu-item-card add-item-card";
    addCard.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 36px; cursor: pointer;">+</div>';
    addCard.onclick = () => startCreateItem();
    grid.appendChild(addCard);
  }

  if (!items.length) {
    if (!IS_EDIT_MODE) {
      grid.innerHTML = `<div class="empty-state"><p>No items in this category</p></div>`;
    }
    return;
  }

  items.forEach(item => {
    const isAvailable = item.available !== false;

    const card = document.createElement("div");
    card.className = `menu-item-card ${!isAvailable ? "unavailable" : ""}`;
    card.dataset.itemId = item.id;

    card.innerHTML = `
      <div class="menu-item-image">
        ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}"/>` : '<div class="no-image">📸</div>'}
      </div>
      <div class="menu-item-info">
        <div class="menu-item-name">${item.name}</div>
        <div class="menu-item-price">$${(item.price_cents / 100).toFixed(2)}</div>
      </div>
      ${IS_EDIT_MODE ? `
      <div class="menu-edit-controls">
        <button id="avail-btn-${item.id}" onclick="event.stopPropagation(); toggleMenuItemAvailability(${item.id}, ${!isAvailable})" style="background-color: ${isAvailable ? '#e7f5e7' : '#fee'}; color: ${isAvailable ? '#2d7a2d' : '#c33'}; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;">${isAvailable ? '✓' : '✕'} ${isAvailable ? t('admin.available') : t('admin.sold-out')}</button>
        <button onclick="event.stopPropagation(); deleteMenuItem(${item.id})" style="background-color: #fee; color: #c33; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;">🗑️ ${t('admin.delete')}</button>
      </div>
      ` : ''}
    `;

    grid.appendChild(card);
  });
}

// Add new item via prompt
async function addMenuItemPrompt(categoryId) {
  const name = prompt("Enter item name:", "");
  if (!name || !name.trim()) return;

  const priceStr = prompt("Enter price (in cents, e.g., 1200 for $12.00):", "");
  if (!priceStr || isNaN(priceStr)) return alert("Invalid price");

  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/menu-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        price_cents: Number(priceStr),
        category_id: categoryId,
        description: ""
      })
    });

    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || "Failed to create item");
    }

    await loadMenuItems();
  } catch (err) {
    alert("Error creating item: " + err.message);
  }
}

// Edit item modal
function editMenuItemModal(itemId) {
  const item = MENU_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = `edit-item-modal-${itemId}`;

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Edit Menu Item</h2>
        <button class="modal-close" onclick="document.getElementById('edit-item-modal-${itemId}').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label>Item Name</label>
            <input type="text" id="edit-item-name-${itemId}" value="${item.name}" />
          </div>
          <div class="form-group">
            <label>Price (cents)</label>
            <input type="number" id="edit-item-price-${itemId}" value="${item.price_cents}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Category</label>
            <select id="edit-item-category-${itemId}">
              ${MENU_CATEGORIES.map(c => `<option value="${c.id}" ${c.id === item.category_id ? "selected" : ""}>${c.name}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label>Available</label>
            <select id="edit-item-available-${itemId}">
              <option value="true" ${item.available !== false ? "selected" : ""}>Yes</option>
              <option value="false" ${item.available === false ? "selected" : ""}>No (Sold Out)</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Description</label>
            <textarea id="edit-item-desc-${itemId}" placeholder="Item description...">${item.description || ""}</textarea>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Image</label>
            <div class="image-upload-input">
              <div id="edit-item-image-preview-${itemId}" class="image-preview-box">
                ${item.image_url ? `<img src="${item.image_url}" style="max-width: 100%; border-radius: 8px;"/>` : '<div class="upload-placeholder">📸 Click to upload image</div>'}
              </div>
              <input type="file" id="edit-item-image-${itemId}" accept="image/*" onchange="previewEditItemImage(${itemId}, this)" class="hidden-file-input"/>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-primary" onclick="saveMenuItemEdit(${itemId})">✓ Save</button>
        <button class="btn-secondary" onclick="document.getElementById('edit-item-modal-${itemId}').remove()">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  
  // Make image preview clickable
  document.getElementById(`edit-item-image-preview-${itemId}`).onclick = () => {
    document.getElementById(`edit-item-image-${itemId}`).click();
  };
}

function previewEditItemImage(itemId, input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const previewBox = document.getElementById(`edit-item-image-preview-${itemId}`);
    previewBox.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; border-radius: 8px;"/>`;
  };
  reader.readAsDataURL(file);
}

async function saveMenuItemEdit(itemId) {
  const name = document.getElementById(`edit-item-name-${itemId}`).value.trim();
  const price = Number(document.getElementById(`edit-item-price-${itemId}`).value);
  const categoryId = Number(document.getElementById(`edit-item-category-${itemId}`).value);
  const available = document.getElementById(`edit-item-available-${itemId}`).value === "true";
  const description = document.getElementById(`edit-item-desc-${itemId}`).value.trim();
  const imageFile = document.getElementById(`edit-item-image-${itemId}`).files[0];

  if (!name || !price) return alert("Name and price are required");

  try {
    // Update item properties
    await fetch(`${API}/menu-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        price_cents: price,
        category_id: categoryId,
        description,
        available,
        restaurantId: restaurantId
      })
    });

    // Upload image if changed
    if (imageFile) {
      await uploadItemImage(itemId, imageFile);
    }

    // Close modal and reload
    document.getElementById(`edit-item-modal-${itemId}`).remove();
    await loadMenuItems();
  } catch (err) {
    alert("Error saving item: " + err.message);
  }
}

// Toggle menu item availability
async function toggleMenuItemAvailability(itemId, isAvailable) {
  try {
    // Find the button element and update it immediately (optimistic update)
    const availBtn = document.getElementById(`avail-btn-${itemId}`);
    if (availBtn) {
      const bgColor = isAvailable ? '#e7f5e7' : '#fee';
      const textColor = isAvailable ? '#2d7a2d' : '#c33';
      const icon = isAvailable ? '✓' : '✕';
      const text = isAvailable ? 'Available' : 'Sold Out';
      
      availBtn.style.backgroundColor = bgColor;
      availBtn.style.color = textColor;
      availBtn.textContent = `${icon} ${text}`;
      
      // CRITICAL: Update the onclick handler to toggle the NEW state (opposite of isAvailable)
      availBtn.onclick = function(e) {
        e.stopPropagation();
        toggleMenuItemAvailability(itemId, !isAvailable);
      };
    }

    // Update card class
    const card = document.querySelector(`[data-item-id="${itemId}"]`);
    if (card) {
      if (isAvailable) {
        card.classList.remove('unavailable');
      } else {
        card.classList.add('unavailable');
      }
    }

    // Update in memory IMMEDIATELY (before API call)
    const item = MENU_ITEMS.find(i => i.id === itemId);
    if (item) {
      item.available = isAvailable;
    }

    // Make API call to dedicated availability endpoint
    const res = await fetch(`${API}/menu-items/${itemId}/availability`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        available: isAvailable,
        restaurantId: restaurantId
      })
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Cannot update item availability");
      // Revert changes on error
      await loadMenuItems();
      return;
    }
  } catch (err) {
    alert("Error updating availability: " + err.message);
    // Revert changes on error
    await loadMenuItems();
  }
}

async function deleteMenuItem(itemId) {
  if (!confirm("Delete this menu item permanently?")) return;

  try {
    const res = await fetch(`${API}/menu-items/${itemId}`, { 
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: restaurantId })
    });

    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || "Cannot delete item");
    }

    await loadMenuItems();
  } catch (err) {
    alert("Error deleting item: " + err.message);
  }
}

async function uploadItemImage(itemId, file) {
  if (!file) return;

  try {
    const form = new FormData();
    form.append("image", file);
    form.append("restaurantId", localStorage.getItem("restaurantId"));

    await fetch(`${API}/menu-items/${itemId}/image`, {
      method: "POST",
      body: form
    });
  } catch (err) {
    console.error("Error uploading image:", err);
  }
}

// Category edit/delete
async function editMenuCategoryName(categoryId, oldName) {
  const newName = prompt("Edit category name:", oldName);
  if (!newName || !newName.trim()) return;

  try {
    await fetch(`${API}/menu-categories/${categoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() })
    });
    await loadMenuItems();
  } catch (err) {
    alert("Error updating category: " + err.message);
  }
}

async function deleteMenuCategory(categoryId) {
  if (!confirm("Delete this category? All items inside will also be deleted.")) return;

  try {
    const res = await fetch(`${API}/menu-categories/${categoryId}`, { method: "DELETE" });

    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || "Cannot delete category");
    }

    await loadMenuItems();
  } catch (err) {
    alert("Error deleting category: " + err.message);
  }
}

// ============= FOOD ITEM DETAIL PANEL =============

// Initialize panel - inject from admin-menu.html
async function initializeFoodPanel() {
  // Check if panel already exists
  if (document.getElementById("food-item-panel")) {
    return;
  }
  
  try {
    // Fetch the admin-menu.html file
    const response = await fetch('/admin-menu.html');
    const html = await response.text();
    
    // Parse the HTML and find the panel
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const panel = doc.getElementById('food-item-panel');
    
    // Get target section
    const menuSection = document.getElementById('section-menu');
    if (!menuSection) {
      console.error("Menu section not found for panel injection");
      return;
    }
    
    if (panel) {
      menuSection.appendChild(panel);
    }
  } catch (err) {
    console.error("Failed to load food panel from admin-menu.html:", err);
  }
}

async function openFoodItemPanel(itemId) {
  try {
    // Ensure panel is loaded
    if (!document.getElementById("food-item-panel")) {
      await initializeFoodPanel();
    }
    
    // Find item from already-loaded menu items
    const item = MENU_ITEMS.find(function(i) { return i.id == itemId; });
    if (!item) {
      console.error("Item not found:", itemId);
      alert("Item not found");
      return;
    }
    
    // Fetch variants for this item
    const variantRes = await fetch(`${API}/menu-items/${itemId}/variants`);
    const variants = variantRes.ok ? await variantRes.json() : [];
    
    // Store variants in global variable for edit mode
    CURRENT_VARIANTS = variants;
    currentEditingItemId = itemId;
    
    // Get panel
    const panel = document.getElementById("food-item-panel");
    if (!panel) {
      console.error("Panel still not found after initialization");
      alert("Food panel not found in page. Please refresh and try again.");
      return;
    }
    
    const panelImage = document.getElementById("food-panel-image");
    const panelName = document.getElementById("food-panel-name");
    const panelPrice = document.getElementById("food-panel-price");
    const panelDesc = document.getElementById("food-panel-desc");
    const variantsContainer = document.getElementById("food-panel-variants");
    
    if (panelImage) panelImage.src = item.image_url || '';
    if (panelName) {
      panelName.textContent = item.name;
      panelName.dataset.itemId = itemId;
    }
    if (panelPrice) panelPrice.textContent = "$" + (item.price_cents / 100).toFixed(2);
    if (panelDesc) panelDesc.textContent = item.description || 'No description available';
    
    // Populate variants
    if (variantsContainer) {
      variantsContainer.innerHTML = '';
      
      if (variants && variants.length > 0) {
        variants.forEach(function(variant) {
          const reqLabel = variant.required ? '<span style="color: red;">*</span>' : '';
          const minMax = (variant.min_select != null || variant.max_select != null) ? 
            ` (${variant.min_select != null ? 'Min: ' + variant.min_select : ''}${variant.min_select != null && variant.max_select != null ? ', ' : ''}${variant.max_select != null ? 'Max: ' + variant.max_select : ''})` : '';
          
          const variantHTML = `
            <div class="food-panel-variant-item">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div class="food-panel-variant-name">${variant.name}${reqLabel} <span style="font-size: 12px; color: #666;">${minMax}</span></div>
              </div>
              <div class="food-panel-variant-options">
                ${variant.options && variant.options.length > 0 ? variant.options.map(function(opt) { 
                  const priceLabel = opt.price_cents > 0 ? ' (+$' + (opt.price_cents / 100).toFixed(2) + ')' : '';
                  return `<span class="food-panel-variant-option">${opt.name}${priceLabel}</span>`; 
                }).join('') : '<span class="food-panel-variant-option">No options</span>'}
              </div>
            </div>
          `;
          variantsContainer.innerHTML += variantHTML;
        });
      } else {
        variantsContainer.innerHTML = '<p style="color: #999; font-size: 13px;">No variants available</p>';
      }
    }
    
    // Open panel
    if (panel) {
      panel.classList.add("active");
    } else {
      console.error("Panel element could not be found!");
    }
  } catch (err) {
    console.error("Error opening food item panel:", err);
    alert("Failed to load item details: " + err.message);
  }
}

function closeFoodItemPanel() {
  const panel = document.getElementById("food-item-panel");
  if (panel) panel.classList.remove("active");
}

// Add click handler to menu item cards
document.addEventListener('click', function(e) {
  const card = e.target.closest('.menu-item-card');
  if (!card) return;
  
  // Don't open panel if clicking on edit/delete buttons
  if (e.target.closest('.menu-edit-controls')) {
    return;
  }
  
  const itemId = card.dataset.itemId;
  if (itemId) {
    openFoodItemPanel(itemId);
  }
});

// ========== FOOD ITEM EDIT FUNCTIONS ==========

let currentEditingItemId = null;
let currentEditingVariantId = null;
let currentEditingOptionId = null;
let currentVariants = [];
let foodPanelEditMode = false;

function toggleFoodItemEdit() {
  const item = MENU_ITEMS.find(function(i) { return i.id == currentEditingItemId; });
  if (!item) return;
  
  foodPanelEditMode = !foodPanelEditMode;
  
  const nameSpan = document.getElementById('food-panel-name');
  const nameInput = document.getElementById('food-panel-name-input');
  const priceSpan = document.getElementById('food-panel-price');
  const priceInput = document.getElementById('food-panel-price-input');
  const descP = document.getElementById('food-panel-desc');
  const descInput = document.getElementById('food-panel-desc-input');
  const editBtn = document.getElementById('food-panel-edit-btn');
  const saveBtn = document.getElementById('food-panel-save-btn');
  const cancelBtn = document.getElementById('food-panel-cancel-btn');
  const changeImageBtn = document.getElementById('food-panel-change-image-btn');
  const addVariantBtn = document.getElementById('food-panel-add-variant-btn');
  
  if (foodPanelEditMode) {
    // Enable edit mode
    nameSpan.style.display = 'none';
    nameInput.style.display = 'block';
    nameInput.value = item.name;
    
    priceSpan.style.display = 'none';
    priceInput.style.display = 'inline';
    priceInput.value = item.price_cents;
    
    descP.style.display = 'none';
    descInput.style.display = 'block';
    descInput.value = item.description || '';
    
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline';
    cancelBtn.style.display = 'inline';
    
    if (changeImageBtn) changeImageBtn.style.display = 'block';
    if (addVariantBtn) addVariantBtn.style.display = 'block';
    
    // Render variants with edit/delete buttons - CURRENT_VARIANTS should be set by openFoodItemPanel
    renderFoodPanelVariantsForEdit();
  }
}

function cancelFoodItemEdit() {
  foodPanelEditMode = false;
  
  const nameSpan = document.getElementById('food-panel-name');
  const nameInput = document.getElementById('food-panel-name-input');
  const priceSpan = document.getElementById('food-panel-price');
  const priceInput = document.getElementById('food-panel-price-input');
  const descP = document.getElementById('food-panel-desc');
  const descInput = document.getElementById('food-panel-desc-input');
  const editBtn = document.getElementById('food-panel-edit-btn');
  const saveBtn = document.getElementById('food-panel-save-btn');
  const cancelBtn = document.getElementById('food-panel-cancel-btn');
  const changeImageBtn = document.getElementById('food-panel-change-image-btn');
  const addVariantBtn = document.getElementById('food-panel-add-variant-btn');
  
  nameSpan.style.display = 'block';
  nameInput.style.display = 'none';
  
  priceSpan.style.display = 'inline';
  priceInput.style.display = 'none';
  
  descP.style.display = 'block';
  descInput.style.display = 'none';
  
  editBtn.style.display = 'inline';
  saveBtn.style.display = 'none';
  cancelBtn.style.display = 'none';
  
  if (changeImageBtn) changeImageBtn.style.display = 'none';
  if (addVariantBtn) addVariantBtn.style.display = 'none';
  
  // Render variants without edit/delete buttons
  renderFoodPanelVariantsForView();
}

async function saveFoodItemEdit() {
  const nameInput = document.getElementById('food-panel-name-input');
  const priceInput = document.getElementById('food-panel-price-input');
  const descInput = document.getElementById('food-panel-desc-input');
  const imageInput = document.getElementById('food-panel-image-input');
  
  const newName = nameInput.value.trim();
  const newPrice = parseInt(priceInput.value) || 0;
  const newDesc = descInput.value;
  
  if (!newName) {
    alert('Item name is required');
    return;
  }
  
  try {
    let updateData = {
      name: newName,
      price_cents: newPrice,
      description: newDesc,
      restaurantId: restaurantId
    };
    
    const res = await fetch(`${API}/menu-items/${currentEditingItemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (!res.ok) throw new Error('Failed to save');
    
    // If image was changed, upload it separately
    if (imageInput.files && imageInput.files[0]) {
      const formData = new FormData();
      formData.append('image', imageInput.files[0]);
      formData.append('restaurantId', localStorage.getItem('restaurantId'));
      
      const uploadRes = await fetch(`${API}/menu-items/${currentEditingItemId}/image`, {
        method: 'POST',
        body: formData
      });
      
      if (!uploadRes.ok) {
        console.warn('Failed to upload image, but item updated successfully');
      }
    }
    
    // Update local item
    const item = MENU_ITEMS.find(function(i) { return i.id == currentEditingItemId; });
    if (item) {
      item.name = newName;
      item.price_cents = newPrice;
      item.description = newDesc;
    }
    
    // Update display
    const nameSpan = document.getElementById('food-panel-name');
    const priceSpan = document.getElementById('food-panel-price');
    const descP = document.getElementById('food-panel-desc');
    
    nameSpan.textContent = newName;
    priceSpan.textContent = '$' + (newPrice / 100).toFixed(2);
    descP.textContent = newDesc || 'No description available';
    
    // Clear image input
    imageInput.value = '';
    
    cancelFoodItemEdit();
    alert('Item updated successfully');
  } catch (err) {
    alert('Error saving: ' + err.message);
  }
}

function previewFoodPanelImage(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const panelImage = document.getElementById('food-panel-image');
      panelImage.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function renderFoodPanelVariantsForView() {
  // Render variants without edit/delete buttons (view mode)
  const item = MENU_ITEMS.find(function(i) { return i.id == currentEditingItemId; });
  if (!item) return;
  
  const variantsContainer = document.getElementById('food-panel-variants');
  if (!variantsContainer) return;
  
  variantsContainer.innerHTML = '';
  
  if (CURRENT_VARIANTS && CURRENT_VARIANTS.length > 0) {
    CURRENT_VARIANTS.forEach(function(variant) {
      const reqLabel = variant.required ? '<span style="color: red;">*</span>' : '';
      const minMax = (variant.min_select != null || variant.max_select != null) ? 
        ` (${variant.min_select != null ? 'Min: ' + variant.min_select : ''}${variant.min_select != null && variant.max_select != null ? ', ' : ''}${variant.max_select != null ? 'Max: ' + variant.max_select : ''})` : '';
      
      const variantHTML = `
        <div class="food-panel-variant-item">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div class="food-panel-variant-name">${variant.name}${reqLabel} <span style="font-size: 12px; color: #666;">${minMax}</span></div>
          </div>
          <div class="food-panel-variant-options">
            ${variant.options && variant.options.length > 0 ? variant.options.map(function(opt) { 
              const priceLabel = opt.price_cents > 0 ? ' (+$' + (opt.price_cents / 100).toFixed(2) + ')' : '';
              return `<span class="food-panel-variant-option">${opt.name}${priceLabel}</span>`; 
            }).join('') : '<span class="food-panel-variant-option">No options</span>'}
          </div>
        </div>
      `;
      variantsContainer.innerHTML += variantHTML;
    });
  } else {
    variantsContainer.innerHTML = '<p style="color: #999; font-size: 13px;">No variants available</p>';
  }
}

function renderFoodPanelVariantsForEdit() {
  // Render variants with delete buttons only (edit mode)
  const item = MENU_ITEMS.find(function(i) { return i.id == currentEditingItemId; });
  if (!item) return;
  
  const variantsContainer = document.getElementById('food-panel-variants');
  if (!variantsContainer) return;
  
  variantsContainer.innerHTML = '';
  
  if (CURRENT_VARIANTS && CURRENT_VARIANTS.length > 0) {
    CURRENT_VARIANTS.forEach(function(variant) {
      const reqLabel = variant.required ? '<span style="color: red;">*</span>' : '';
      const minMax = (variant.min_select != null || variant.max_select != null) ? 
        ` (${variant.min_select != null ? 'Min: ' + variant.min_select : ''}${variant.min_select != null && variant.max_select != null ? ', ' : ''}${variant.max_select != null ? 'Max: ' + variant.max_select : ''})` : '';
      
      const variantHTML = `
        <div id="variant-card-${variant.id}" class="food-panel-variant-item" data-variant-id="${variant.id}" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="flex: 1;">
              <div class="food-panel-variant-name" style="cursor: pointer;" onclick="editVariantInline(${variant.id})">${variant.name}${reqLabel} <span style="font-size: 12px; color: #666;">${minMax}</span></div>
            </div>
            <div style="display: flex; gap: 4px;">
              <button class="btn-tertiary" onclick="editVariantInline(${variant.id})" style="font-size: 12px; padding: 4px 8px;"><img src="/uploads/website/pencil.png" alt="edit" style="width: 14px; height: 14px;"/></button>
              <button class="btn-danger" onclick="deleteVariantFromPanel(${variant.id})" style="padding: 4px 8px;"><img src="/uploads/website/bin.png" alt="delete" style="width: 14px; height: 14px;"/></button>
            </div>
          </div>
          <div class="food-panel-variant-options">
            ${variant.options && variant.options.length > 0 ? variant.options.map(function(opt) { 
              const priceLabel = opt.price_cents > 0 ? ' (+$' + (opt.price_cents / 100).toFixed(2) + ')' : '';
              return `<span class="food-panel-variant-option">${opt.name}${priceLabel}</span>`; 
            }).join('') : '<span class="food-panel-variant-option">No options</span>'}
          </div>
        </div>
      `;
      variantsContainer.innerHTML += variantHTML;
    });
  } else {
    variantsContainer.innerHTML = '<p style="color: #999; font-size: 13px;">No variants available</p>';
  }
}

async function deleteVariantFromPanel(variantId) {
  if (!confirm('Delete this variant?')) return;
  
  try {
    const res = await fetch(`${API}/menu-items/${currentEditingItemId}/variants/${variantId}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) throw new Error('Failed to delete');
    
    // Remove from local array
    CURRENT_VARIANTS = CURRENT_VARIANTS.filter(function(v) { return v.id !== variantId; });
    
    // Re-render
    renderFoodPanelVariantsForEdit();
  } catch (err) {
    alert('Error deleting variant: ' + err.message);
  }
}

function startAddVariantFromPanel() {
  // Show the inline variant form
  const form = document.getElementById('food-panel-variant-form');
  const nameInput = document.getElementById('food-panel-variant-name');
  const minInput = document.getElementById('food-panel-variant-min');
  const maxInput = document.getElementById('food-panel-variant-max');
  const requiredCheckbox = document.getElementById('food-panel-variant-required');
  
  if (form && nameInput && minInput && maxInput && requiredCheckbox) {
    currentEditingVariantId = null;
    nameInput.value = '';
    minInput.value = '';
    maxInput.value = '';
    requiredCheckbox.checked = false;
    form.style.display = 'block';
  }
}

function cancelVariantForm() {
  const form = document.getElementById('food-panel-variant-form');
  const optionsSection = document.getElementById('food-panel-variant-options-section');
  const optionForm = document.getElementById('food-panel-variant-option-form');
  
  if (form) form.style.display = 'none';
  if (optionsSection) optionsSection.style.display = 'none';
  if (optionForm) optionForm.style.display = 'none';
  
  currentEditingVariantId = null;
  currentEditingOptionId = null;
}

async function saveNewVariantFromPanel() {
  const nameInput = document.getElementById('food-panel-variant-name');
  const minInput = document.getElementById('food-panel-variant-min');
  const maxInput = document.getElementById('food-panel-variant-max');
  const requiredCheckbox = document.getElementById('food-panel-variant-required');
  const form = document.getElementById('food-panel-variant-form');
  
  const name = nameInput.value.trim();
  const minSel = parseInt(minInput.value) || null;
  const maxSel = parseInt(maxInput.value) || null;
  const required = requiredCheckbox.checked;
  
  if (!name) {
    alert('Variant name is required');
    return;
  }
  
  try {
    const payload = {
      name: name,
      min_select: minSel,
      max_select: maxSel,
      required: required
    };
    
    const res = await fetch(`${API}/menu-items/${currentEditingItemId}/variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error('Failed to create variant');
    
    alert('Variant added');
    
    // Hide form and options section
    if (form) form.style.display = 'none';
    const optionsSection = document.getElementById('food-panel-variant-options-section');
    if (optionsSection) optionsSection.style.display = 'none';
    const optionForm = document.getElementById('food-panel-variant-option-form');
    if (optionForm) optionForm.style.display = 'none';
    
    // Reload variants
    const varRes = await fetch(`${API}/menu-items/${currentEditingItemId}/variants`);
    CURRENT_VARIANTS = varRes.ok ? await varRes.json() : [];
    renderFoodPanelVariantsForEdit();
    
    currentEditingVariantId = null;
    currentEditingOptionId = null;
  } catch (err) {
    alert('Error adding variant: ' + err.message);
  }
}

function editVariantInline(variantId) {
  // Get the variant data
  const variant = CURRENT_VARIANTS.find(function(v) { return v.id == variantId; });
  if (!variant) return;
  
  const variantCard = document.getElementById(`variant-card-${variantId}`);
  if (!variantCard) return;
  
  // Store the original variant data for cancel
  variantCard.dataset.originalName = variant.name;
  variantCard.dataset.originalMinSelect = variant.min_select || '';
  variantCard.dataset.originalMaxSelect = variant.max_select || '';
  variantCard.dataset.originalRequired = variant.required ? 'true' : 'false';
  
  // Create inline edit form - simple form with basic values
  const editHTML = `
    <div style="padding: 8px; border: 2px solid #2196F3; border-radius: 4px; background: #f5f5f5;">
      <div style="margin-bottom: 8px;">
        <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px;">Variant Name</label>
        <input class="inline-variant-name" type="text" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;" />
      </div>
      <div style="display: flex; gap: 8px; margin-bottom: 8px;">
        <div style="flex: 1;">
          <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px;">Min Select</label>
          <input class="inline-variant-min" type="number" min="0" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;" />
        </div>
        <div style="flex: 1;">
          <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px;">Max Select</label>
          <input class="inline-variant-max" type="number" min="0" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;" />
        </div>
      </div>
      <div style="margin-bottom: 8px;">
        <label style="display: flex; align-items: center; font-size: 12px;">
          <input class="inline-variant-required" type="checkbox" style="margin-right: 6px;" />
          <span>Required</span>
        </label>
      </div>
      <div style="display: flex; gap: 6px;">
        <button onclick="saveInlineVariant(${variantId})" style="flex: 1; padding: 6px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Save</button>
        <button onclick="cancelInlineVariant(${variantId})" style="flex: 1; padding: 6px; background: #999; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Cancel</button>
        <button onclick="openVariantOptionsEditor(${variantId})" style="flex: 1; padding: 6px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Edit Options</button>
      </div>
    </div>
  `;
  
  variantCard.innerHTML = editHTML;
  variantCard.style.background = '#fff9e6';
  
  // Populate the form with current values
  variantCard.querySelector('.inline-variant-name').value = variant.name;
  variantCard.querySelector('.inline-variant-min').value = variant.min_select || '';
  variantCard.querySelector('.inline-variant-max').value = variant.max_select || '';
  variantCard.querySelector('.inline-variant-required').checked = variant.required || false;
  
  currentEditingVariantId = variantId;
}

function cancelInlineVariant(variantId) {
  // Re-render the variant card with original data
  const variant = CURRENT_VARIANTS.find(function(v) { return v.id == variantId; });
  if (variant) {
    const variantsContainer = document.getElementById('food-panel-variants');
    if (variantsContainer) {
      renderFoodPanelVariantsForEdit();
    }
  }
  currentEditingVariantId = null;
}

async function saveInlineVariant(variantId) {
  const variantCard = document.getElementById(`variant-card-${variantId}`);
  if (!variantCard) return;
  
  const nameInput = variantCard.querySelector('.inline-variant-name');
  const minInput = variantCard.querySelector('.inline-variant-min');
  const maxInput = variantCard.querySelector('.inline-variant-max');
  const requiredCheckbox = variantCard.querySelector('.inline-variant-required');
  
  const name = nameInput.value.trim();
  const minSel = parseInt(minInput.value) || null;
  const maxSel = parseInt(maxInput.value) || null;
  const required = requiredCheckbox.checked;
  
  if (!name) {
    alert('Variant name is required');
    return;
  }
  
  try {
    const payload = {
      name: name,
      min_select: minSel,
      max_select: maxSel,
      required: required
    };
    
    const res = await fetch(`${API}/variants/${variantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error('Failed to update variant');
    
    alert('Variant updated');
    
    // Reload and re-render
    const varRes = await fetch(`${API}/menu-items/${currentEditingItemId}/variants`);
    CURRENT_VARIANTS = varRes.ok ? await varRes.json() : [];
    renderFoodPanelVariantsForEdit();
    
    currentEditingVariantId = null;
  } catch (err) {
    alert('Error updating variant: ' + err.message);
  }
}

function openVariantOptionsEditor(variantId) {
  // Change to options editing view within the same card
  const variant = CURRENT_VARIANTS.find(function(v) { return v.id == variantId; });
  if (!variant) return;
  
  const variantCard = document.getElementById(`variant-card-${variantId}`);
  if (!variantCard) return;
  
  // Create options editor HTML
  let optionsHTML = '';
  if (variant.options && variant.options.length > 0) {
    optionsHTML = variant.options.map(function(option) {
      const priceLabel = option.price_cents > 0 ? ' (+$' + (option.price_cents / 100).toFixed(2) + ')' : '';
      return `
        <div id="option-row-${option.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 6px; background: white; border: 1px solid #ddd; border-radius: 3px; margin-bottom: 4px;">
          <span style="font-size: 12px;">${option.name}${priceLabel}</span>
          <div style="display: flex; gap: 4px;">
            <button onclick="editVariantOption(${option.id})" style="padding: 2px 6px; background: #2196F3; color: white; border: none; border-radius: 2px; cursor: pointer; font-size: 10px;">Edit</button>
            <button onclick="deleteVariantOption(${option.id})" style="padding: 2px 6px; background: #d32f2f; color: white; border: none; border-radius: 2px; cursor: pointer; font-size: 10px;">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  } else {
    optionsHTML = '<p style="font-size: 12px; color: #999; margin: 0;">No options yet</p>';
  }
  
  const editHTML = `
    <div style="padding: 8px; border: 2px solid #FF9800; border-radius: 4px; background: #fff3e0;">
      <h4 style="margin: 0 0 8px 0; font-size: 13px;">Edit Options for "${variant.name}"</h4>
      <div style="margin-bottom: 8px; max-height: 200px; overflow-y: auto;">
        ${optionsHTML}
      </div>
      <div style="display: flex; gap: 6px; margin-bottom: 8px;">
        <button onclick="startAddVariantOption()" style="flex: 1; padding: 6px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">+ Add Option</button>
        <button onclick="backToVariantEdit(${variantId})" style="flex: 1; padding: 6px; background: #999; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Back to Edit</button>
      </div>
      <div id="variant-option-form-inline" style="display: none; padding: 8px; background: white; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 8px;">
        <h5 style="margin: 0 0 8px 0; font-size: 12px;">Add Option</h5>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div>
            <label style="display: block; font-size: 11px; font-weight: 500; margin-bottom: 2px;">Option Name</label>
            <input id="inline-option-name" type="text" style="width: 100%; padding: 4px; border: 1px solid #ddd; border-radius: 3px; font-size: 11px;" />
          </div>
          <div>
            <label style="display: block; font-size: 11px; font-weight: 500; margin-bottom: 2px;">Price (cents) - optional</label>
            <input id="inline-option-price" type="number" placeholder="0" style="width: 100%; padding: 4px; border: 1px solid #ddd; border-radius: 3px; font-size: 11px;" />
          </div>
          <div style="display: flex; gap: 4px;">
            <button onclick="saveInlineVariantOption()" style="flex: 1; padding: 4px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">Save</button>
            <button onclick="cancelInlineVariantOption()" style="flex: 1; padding: 4px; background: #999; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  variantCard.innerHTML = editHTML;
}

function backToVariantEdit(variantId) {
  currentEditingVariantId = null;
  renderFoodPanelVariantsForEdit();
}

function startAddVariantOption() {
  const form = document.getElementById('variant-option-form-inline');
  const nameInput = document.getElementById('inline-option-name');
  const priceInput = document.getElementById('inline-option-price');
  
  if (form && nameInput && priceInput) {
    currentEditingOptionId = null;
    nameInput.value = '';
    priceInput.value = '';
    form.style.display = 'block';
  }
}

function cancelInlineVariantOption() {
  const form = document.getElementById('variant-option-form-inline');
  const nameInput = document.getElementById('inline-option-name');
  const priceInput = document.getElementById('inline-option-price');
  if (form) {
    form.style.display = 'none';
    if (nameInput) nameInput.value = '';
    if (priceInput) priceInput.value = '';
  }
  currentEditingOptionId = null;
}

async function saveInlineVariantOption() {
  const nameInput = document.getElementById('inline-option-name');
  const priceInput = document.getElementById('inline-option-price');
  const form = document.getElementById('variant-option-form-inline');
  
  const name = nameInput.value.trim();
  const price = parseInt(priceInput.value) || 0;
  
  if (!name) {
    alert('Option name is required');
    return;
  }
  
  try {
    const payload = {
      name: name,
      price_cents: price
    };
    
    if (currentEditingOptionId) {
      // Update existing option
      const res = await fetch(`${API}/variant-options/${currentEditingOptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to update option');
      alert('Option updated');
    } else {
      // Create new option
      const res = await fetch(`${API}/variants/${currentEditingVariantId}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to create option');
      alert('Option added');
    }
    
    // Hide form and reload
    if (form) form.style.display = 'none';
    
    const varRes = await fetch(`${API}/menu-items/${currentEditingItemId}/variants`);
    CURRENT_VARIANTS = varRes.ok ? await varRes.json() : [];
    
    // Re-open the options editor
    openVariantOptionsEditor(currentEditingVariantId);
    
    currentEditingOptionId = null;
  } catch (err) {
    alert('Error saving option: ' + err.message);
  }
}

function renderVariantOptions(variant) {
  const optionsList = document.getElementById('food-panel-variant-options-list');
  if (!optionsList) return;
  
  optionsList.innerHTML = '';
  
  if (variant.options && variant.options.length > 0) {
    variant.options.forEach(function(option) {
      const priceLabel = option.price_cents > 0 ? ' (+$' + (option.price_cents / 100).toFixed(2) + ')' : '';
      const optionHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px; background: white; border: 1px solid #ddd; border-radius: 3px;">
          <span style="font-size: 12px;">${option.name}${priceLabel}</span>
          <div style="display: flex; gap: 4px;">
            <button onclick="editVariantOption(${option.id})" style="padding: 2px 6px; background: #2196F3; color: white; border: none; border-radius: 2px; cursor: pointer; font-size: 10px;">Edit</button>
            <button onclick="deleteVariantOption(${option.id})" style="padding: 2px 6px; background: #d32f2f; color: white; border: none; border-radius: 2px; cursor: pointer; font-size: 10px;">Delete</button>
          </div>
        </div>
      `;
      optionsList.innerHTML += optionHTML;
    });
  } else {
    optionsList.innerHTML = '<p style="font-size: 12px; color: #999; margin: 0;">No options yet</p>';
  }
}

function startAddVariantOption() {
  const form = document.getElementById('variant-option-form-inline');
  const nameInput = document.getElementById('inline-option-name');
  const priceInput = document.getElementById('inline-option-price');
  
  if (form && nameInput && priceInput) {
    currentEditingOptionId = null;
    nameInput.value = '';
    priceInput.value = '';
    form.style.display = 'block';
  }
}

function cancelVariantOptionForm() {
  const form = document.getElementById('food-panel-variant-option-form');
  if (form) form.style.display = 'none';
}

async function saveVariantOption() {
  const nameInput = document.getElementById('food-panel-option-name');
  const priceInput = document.getElementById('food-panel-option-price');
  const form = document.getElementById('food-panel-variant-option-form');
  
  const name = nameInput.value.trim();
  const price = parseInt(priceInput.value) || 0;
  
  if (!name) {
    alert('Option name is required');
    return;
  }
  
  try {
    const payload = {
      name: name,
      price_cents: price
    };
    
    if (currentEditingOptionId) {
      // Update existing option
      const res = await fetch(`${API}/variant-options/${currentEditingOptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to update option');
      alert('Option updated');
    } else {
      // Create new option
      const res = await fetch(`${API}/variants/${currentEditingVariantId}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to create option');
      alert('Option added');
    }
    
    // Hide form and reload
    if (form) form.style.display = 'none';
    
    const varRes = await fetch(`${API}/menu-items/${currentEditingItemId}/variants`);
    CURRENT_VARIANTS = varRes.ok ? await varRes.json() : [];
    
    // Re-render options for current variant
    const variant = CURRENT_VARIANTS.find(function(v) { return v.id == currentEditingVariantId; });
    if (variant) renderVariantOptions(variant);
    
    currentEditingOptionId = null;
  } catch (err) {
    alert('Error saving option: ' + err.message);
  }
}

function editVariantOption(optionId) {
  const variant = CURRENT_VARIANTS.find(function(v) { return v.id == currentEditingVariantId; });
  if (!variant) return;
  
  const option = variant.options.find(function(o) { return o.id == optionId; });
  if (!option) return;
  
  const optionRow = document.getElementById(`option-row-${optionId}`);
  if (!optionRow) return;
  
  // Replace option row with inline edit form
  const editFormHTML = `
    <div style="display: flex; flex-direction: column; gap: 6px; padding: 6px; background: #f5f5f5; border: 2px solid #2196F3; border-radius: 3px; margin-bottom: 4px;">
      <div style="display: flex; gap: 6px;">
        <div style="flex: 1;">
          <label style="display: block; font-size: 10px; font-weight: 500; margin-bottom: 2px;">Name</label>
          <input id="edit-opt-name-${optionId}" type="text" value="${option.name}" style="width: 100%; padding: 4px; border: 1px solid #ddd; border-radius: 3px; font-size: 11px; box-sizing: border-box;" />
        </div>
        <div style="flex: 0 0 80px;">
          <label style="display: block; font-size: 10px; font-weight: 500; margin-bottom: 2px;">Price</label>
          <input id="edit-opt-price-${optionId}" type="number" value="${option.price_cents || 0}" style="width: 100%; padding: 4px; border: 1px solid #ddd; border-radius: 3px; font-size: 11px; box-sizing: border-box;" />
        </div>
      </div>
      <div style="display: flex; gap: 4px;">
        <button onclick="saveOptionEdit(${optionId})" style="flex: 1; padding: 4px; background: #4CAF50; color: white; border: none; border-radius: 2px; cursor: pointer; font-size: 10px;">Save</button>
        <button onclick="cancelOptionEdit(${optionId})" style="flex: 1; padding: 4px; background: #999; color: white; border: none; border-radius: 2px; cursor: pointer; font-size: 10px;">Cancel</button>
      </div>
    </div>
  `;
  
  optionRow.innerHTML = editFormHTML;
  currentEditingOptionId = optionId;
}

async function saveOptionEdit(optionId) {
  const nameInput = document.getElementById(`edit-opt-name-${optionId}`);
  const priceInput = document.getElementById(`edit-opt-price-${optionId}`);
  
  if (!nameInput || !priceInput) return;
  
  const name = nameInput.value.trim();
  const price = parseInt(priceInput.value) || 0;
  
  if (!name) {
    alert('Option name is required');
    return;
  }
  
  try {
    const payload = {
      name: name,
      price_cents: price
    };
    
    const res = await fetch(`${API}/variant-options/${optionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error('Failed to update option');
    
    // Reload variants and re-open options editor
    const varRes = await fetch(`${API}/menu-items/${currentEditingItemId}/variants`);
    CURRENT_VARIANTS = varRes.ok ? await varRes.json() : [];
    openVariantOptionsEditor(currentEditingVariantId);
    
    currentEditingOptionId = null;
  } catch (err) {
    alert('Error saving option: ' + err.message);
  }
}

function cancelOptionEdit(optionId) {
  // Reload variants and re-open options editor to restore original state
  const variant = CURRENT_VARIANTS.find(function(v) { return v.id == currentEditingVariantId; });
  if (variant) {
    openVariantOptionsEditor(currentEditingVariantId);
  }
  currentEditingOptionId = null;
}

async function deleteVariantOption(optionId) {
  if (!confirm('Delete this option?')) return;
  
  try {
    const res = await fetch(`${API}/variant-options/${optionId}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) throw new Error('Failed to delete option');
    
    // Reload variants
    const varRes = await fetch(`${API}/menu-items/${currentEditingItemId}/variants`);
    CURRENT_VARIANTS = varRes.ok ? await varRes.json() : [];
    
    // Re-render options for current variant
    const variant = CURRENT_VARIANTS.find(function(v) { return v.id == currentEditingVariantId; });
    if (variant) renderVariantOptions(variant);
  } catch (err) {
    alert('Error deleting option: ' + err.message);
  }
}



// ========== CREATE MENU ITEM FUNCTIONS ==========

function startCreateItem() {
  const panel = document.getElementById('create-item-form-panel');
  if (panel) {
    panel.classList.add('active');
    
    // Populate category dropdown
    const categorySelect = document.getElementById('new-item-category');
    if (categorySelect && MENU_CATEGORIES.length > 0) {
      // Keep the default option
      categorySelect.innerHTML = '<option value="">-- Select a category --</option>';
      MENU_CATEGORIES.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        categorySelect.appendChild(option);
      });
    }
  }
}

function cancelCreateItem() {
  const panel = document.getElementById('create-item-form-panel');
  if (panel) panel.classList.remove('active');
  // Clear form
  document.getElementById('new-item-name').value = '';
  document.getElementById('new-item-price').value = '';
  document.getElementById('new-item-desc').value = '';
}

async function createMenuItem() {
  const nameEl = document.getElementById('new-item-name');
  const priceEl = document.getElementById('new-item-price');
  const descEl = document.getElementById('new-item-desc');
  const categoryEl = document.getElementById('new-item-category');
  const imageEl = document.getElementById('new-item-image');
  
  const name = nameEl.value.trim();
  const price = parseInt(priceEl.value) || 0;
  const desc = descEl.value.trim();
  const categoryId = parseInt(categoryEl.value);
  
  if (!name) {
    alert('Item name is required');
    return;
  }
  
  if (!categoryId) {
    alert('Category is required');
    return;
  }
  
  try {
    // Step 1: Create the menu item
    const itemData = {
      name,
      price_cents: price,
      description: desc,
      category_id: categoryId
    };
    
    const createRes = await fetch(`${API}/restaurants/${restaurantId}/menu-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(itemData)
    });
    
    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.error || 'Failed to create item');
    }
    
    const newItem = await createRes.json();
    
    // Step 2: Upload image if provided
    if (imageEl.files && imageEl.files[0]) {
      const formData = new FormData();
      formData.append('image', imageEl.files[0]);
      formData.append('restaurantId', localStorage.getItem('restaurantId'));
      
      const imageRes = await fetch(`${API}/menu-items/${newItem.id}/image`, {
        method: 'POST',
        body: formData
      });
      
      if (!imageRes.ok) {
        console.warn('Failed to upload image, but item created successfully');
      }
    }
    
    alert('Item created successfully!');
    cancelCreateItem();
    await loadMenuItems();
  } catch (err) {
    alert('Error creating item: ' + err.message);
  }
}

function previewItemImage(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('new-item-image-preview');
      if (preview) {
        preview.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 150px;" />`;
      }
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// Listen for language changes to re-render category tabs
window.addEventListener('languageChanged', () => {
  console.log('[Menu] Language changed - re-rendering tabs');
  renderMenuCategoryTabs();
  
  // Update form placeholders
  const itemNameInput = document.getElementById('new-item-name');
  const priceInput = document.getElementById('new-item-price');
  const descInput = document.getElementById('new-item-desc');
  const uploadDiv = document.querySelector('.upload-placeholder');
  
  if (itemNameInput) itemNameInput.placeholder = t('admin.item-name-placeholder');
  if (priceInput) priceInput.placeholder = t('admin.price-placeholder');
  if (descInput) descInput.placeholder = t('admin.description-placeholder');
  if (uploadDiv) uploadDiv.textContent = t('admin.upload-image');});