// ============= MENU MODULE =============
// All menu management functionality extracted from admin.js
// Uses card-based layout similar to admin-tables.js

// ========== MENU VARIANT GLOBAL STATE ==========
let OPEN_VARIANTS_ITEM_ID = null;
let EDITING_VARIANT_ID = null;
let CURRENT_VARIANTS = [];

// ========== INITIALIZE MENU ==========
async function initializeMenu() {
  console.log('[Menu] Initializing menu...');
  await loadMenuItems();
  attachEventListeners();
  console.log('[Menu] Menu initialized');
}

// ========== ATTACH EVENT LISTENERS ==========
function attachEventListeners() {
  // Language change listener
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
    if (uploadDiv) uploadDiv.textContent = t('admin.upload-image');
  });
}

// ========== TEMPLATE HELPER FUNCTIONS ==========
/**
 * Clones a template and returns the content
 * @param {string} templateId - ID of the template element
 * @returns {DocumentFragment} The cloned template content
 */
function cloneTemplate(templateId) {
  const template = document.getElementById(templateId);
  if (!template) {
    console.error(`Template not found: ${templateId}`);
    return null;
  }
  return template.content.cloneNode(true);
}

/**
 * Creates a menu item card using template
 * @param {Object} item - Menu item object
 * @param {boolean} isEditMode - Whether in edit mode
 * @returns {HTMLElement} The card element
 */
function createMenuItemCardElement(item, isEditMode) {
  const fragment = cloneTemplate('menu-item-card-template');
  if (!fragment) return null;
  
  // Extract the wrapper div from the template fragment
  const card = fragment.querySelector('.menu-item-card-wrapper');
  if (!card) {
    console.error('Could not find menu-item-card-wrapper in template');
    return null;
  }
  
  // Update content
  const isAvailable = item.available !== false;
  const imgEl = card.querySelector('.menu-item-img');
  if (item.image_url) {
    imgEl.src = item.image_url;
  } else {
    imgEl.style.display = 'none';
    card.querySelector('.menu-item-image').innerHTML = '<div class="no-image">📸</div>';
  }
  
  card.querySelector('.menu-item-name').textContent = item.name;
  card.querySelector('.menu-item-price').textContent = '$' + (item.price_cents / 100).toFixed(2);
  
  // Add controls if in edit mode
  if (isEditMode) {
    const controlsDiv = card.querySelector('.menu-edit-controls');
    controlsDiv.style.display = 'flex';
    controlsDiv.innerHTML = `
      <button id="avail-btn-${item.id}" onclick="event.stopPropagation(); toggleMenuItemAvailability(${item.id}, ${!isAvailable})" style="background-color: ${isAvailable ? '#e7f5e7' : '#fee'}; color: ${isAvailable ? '#2d7a2d' : '#c33'}; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;">${isAvailable ? '✓' : '✕'} ${isAvailable ? t('admin.available') : t('admin.sold-out')}</button>
      <button onclick="event.stopPropagation(); deleteMenuItem(${item.id})" style="background-color: #fee; color: #c33; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;">🗑️ ${t('admin.delete')}</button>
    `;
  }
  
  return card;
}

/**
 * Creates an add item card using template
 * @returns {HTMLElement} The add card element
 */
function createAddItemCardElement() {
  const fragment = cloneTemplate('add-item-card-template');
  if (!fragment) return null;
  
  // The add-item-card-template has the content directly, wrap it
  const card = document.createElement('div');
  card.appendChild(fragment);
  card.className = 'add-item-card';
  return card;
}

/**
 * Creates an edit modal using template
 * @param {Object} item - Menu item object
 * @param {Array} categories - Available categories
 * @returns {HTMLElement} The modal element
 */
function createEditItemModalElement(item, categories) {
  const fragment = cloneTemplate('edit-menu-item-modal-template');
  if (!fragment) return null;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = `edit-item-modal-${item.id}`;
  modal.appendChild(fragment);
  
  // Set up form elements with IDs for saveMenuItemEdit to find them
  const nameInput = modal.querySelector('.edit-item-name');
  nameInput.id = `edit-item-name-${item.id}`;
  nameInput.value = item.name;
  
  const priceInput = modal.querySelector('.edit-item-price');
  priceInput.id = `edit-item-price-${item.id}`;
  priceInput.value = item.price_cents;
  
  const descInput = modal.querySelector('.edit-item-desc');
  descInput.id = `edit-item-desc-${item.id}`;
  descInput.value = item.description || '';
  
  // Populate categories
  const categorySelect = modal.querySelector('.edit-item-category');
  categorySelect.id = `edit-item-category-${item.id}`;
  categories.forEach(c => {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = c.name;
    if (c.id === item.category_id) option.selected = true;
    categorySelect.appendChild(option);
  });
  
  // Populate available status
  const availSelect = modal.querySelector('.edit-item-available');
  availSelect.id = `edit-item-available-${item.id}`;
  availSelect.value = item.available !== false ? 'true' : 'false';
  
  // Set up image
  const imagePreview = modal.querySelector('.edit-item-image-preview');
  imagePreview.id = `edit-item-image-preview-${item.id}`;
  if (item.image_url) {
    imagePreview.innerHTML = `<img src="${item.image_url}" style="max-width: 100%; border-radius: 8px;"/>`;
  }
  
  // Set up event listeners
  const imageInput = modal.querySelector('.edit-item-image-input');
  imageInput.id = `edit-item-image-${item.id}`;
  imageInput.onchange = function() {
    previewEditItemImage(item.id, this);
  };
  
  imagePreview.onclick = () => imageInput.click();
  
  // Set up meal/combo checkbox
  const mealComboCheckbox = modal.querySelector('.edit-item-is-meal-combo');
  const addonsSection = modal.querySelector('.edit-item-addons-section');
  if (mealComboCheckbox && addonsSection) {
    mealComboCheckbox.checked = item.is_meal_combo || false;
    mealComboCheckbox.onchange = function() {
      addonsSection.style.display = this.checked ? 'block' : 'none';
    };
    addonsSection.style.display = mealComboCheckbox.checked ? 'block' : 'none';
  }
  
  // Set up has_variants checkbox
  const variantsCheckbox = modal.querySelector('.edit-item-has-variants');
  const variantsSection = modal.querySelector('.edit-item-variants-section');
  if (variantsCheckbox && variantsSection) {
    // Check if item has any variants
    const hasVariants = item.variants && item.variants.length > 0;
    variantsCheckbox.checked = hasVariants || false;
    variantsCheckbox.onchange = function() {
      variantsSection.style.display = this.checked ? 'block' : 'none';
    };
    variantsSection.style.display = variantsCheckbox.checked ? 'block' : 'none';
  }
  
  // Set up addon button handlers
  const customAddonBtn = modal.querySelector('.btn-addon-add');
  if (customAddonBtn) {
    customAddonBtn.onclick = () => openAddonSelector(item.id, modal);
  }
  
  // Set up preset addon button
  const presetAddonBtn = modal.querySelector('.btn-add-preset-addon');
  if (presetAddonBtn) {
    presetAddonBtn.onclick = async () => {
      const select = modal.querySelector('.edit-item-preset-addon-select');
      if (select.value) {
        await addPresetAddonsToItem(item.id, select.value, modal);
        select.value = '';
      }
    };
  }
  
  // Load and display current addons
  (async () => {
    await renderAddonsInModal(item.id, modal);
    await loadAddonPresetsDropdown(modal);
  })();
  
  // Button handlers
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.querySelector('.modal-save').onclick = () => saveMenuItemEdit(item.id);
  modal.querySelector('.modal-cancel').onclick = () => modal.remove();
  
  return modal;
}

/**
 * Creates a variant item element for view mode (read-only)
 * @param {Object} variant - Variant object
 * @returns {HTMLElement} The variant item element
 */
function createVariantViewElement(variant) {
  const fragment = cloneTemplate('variant-view-template');
  if (!fragment) return null;
  
  const variantItem = fragment.querySelector('.food-panel-variant-item');
  if (!variantItem) return null;
  
  // Build variant name with required indicator and min/max
  const reqLabel = variant.required ? '<span style="color: red;">*</span>' : '';
  const minMax = (variant.min_select != null || variant.max_select != null) ? 
    ` (${variant.min_select != null ? 'Min: ' + variant.min_select : ''}${variant.min_select != null && variant.max_select != null ? ', ' : ''}${variant.max_select != null ? 'Max: ' + variant.max_select : ''})` : '';
  
  const nameDiv = variantItem.querySelector('.food-panel-variant-name');
  if (nameDiv) {
    nameDiv.innerHTML = `${variant.name}${reqLabel} <span style="font-size: 12px; color: #666;">${minMax}</span>`;
  }
  
  // Render options
  const optionsDiv = variantItem.querySelector('.food-panel-variant-options');
  if (optionsDiv) {
    if (variant.options && variant.options.length > 0) {
      optionsDiv.innerHTML = variant.options.map(function(opt) {
        const priceLabel = opt.price_cents > 0 ? ' (+$' + (opt.price_cents / 100).toFixed(2) + ')' : '';
        return `<span class="food-panel-variant-option">${opt.name}${priceLabel}</span>`;
      }).join('');
    } else {
      optionsDiv.innerHTML = '<span class="food-panel-variant-option">No options</span>';
    }
  }
  
  return variantItem;
}

/**
 * Creates a variant item element for edit mode (with delete buttons)
 * @param {Object} variant - Variant object
 * @returns {HTMLElement} The variant item element
 */
function createVariantEditElement(variant) {
  const fragment = cloneTemplate('variant-edit-template');
  if (!fragment) return null;
  
  const variantCard = fragment.querySelector('.food-panel-variant-item');
  if (!variantCard) return null;
  
  variantCard.id = `variant-card-${variant.id}`;
  variantCard.dataset.variantId = variant.id;
  
  // Build variant name with required indicator and min/max
  const reqLabel = variant.required ? '<span style="color: red;">*</span>' : '';
  const minMax = (variant.min_select != null || variant.max_select != null) ? 
    ` (${variant.min_select != null ? 'Min: ' + variant.min_select : ''}${variant.min_select != null && variant.max_select != null ? ', ' : ''}${variant.max_select != null ? 'Max: ' + variant.max_select : ''})` : '';
  
  const nameDiv = variantCard.querySelector('.food-panel-variant-name');
  if (nameDiv) {
    nameDiv.innerHTML = `${variant.name}${reqLabel} <span style="font-size: 12px; color: #666;">${minMax}</span>`;
  }
  
  // Set up edit button
  const editBtn = variantCard.querySelector('.variant-edit-btn');
  if (editBtn) {
    editBtn.onclick = () => editVariantInline(variant.id);
  }
  
  // Set up delete button
  const deleteBtn = variantCard.querySelector('.variant-delete-btn');
  if (deleteBtn) {
    deleteBtn.onclick = () => deleteVariantFromPanel(variant.id);
  }
  
  // Render options
  const optionsDiv = variantCard.querySelector('.food-panel-variant-options');
  if (optionsDiv) {
    if (variant.options && variant.options.length > 0) {
      optionsDiv.innerHTML = variant.options.map(function(opt) {
        const priceLabel = opt.price_cents > 0 ? ' (+$' + (opt.price_cents / 100).toFixed(2) + ')' : '';
        return `<span class="food-panel-variant-option">${opt.name}${priceLabel}</span>`;
      }).join('');
    } else {
      optionsDiv.innerHTML = '<span class="food-panel-variant-option">No options</span>';
    }
  }
  
  return variantCard;
}

/**
 * Creates a variant inline edit form element
 * @param {Object} variant - Variant object
 * @returns {HTMLElement} The edit form element
 */
function createVariantInlineEditElement(variant) {
  const fragment = cloneTemplate('variant-inline-edit-template');
  if (!fragment) return null;
  
  const editForm = fragment.firstElementChild;
  if (!editForm) return null;
  
  // Set up event listeners
  const saveBtn = editForm.querySelector('.variant-inline-save');
  const cancelBtn = editForm.querySelector('.variant-inline-cancel');
  const optionsBtn = editForm.querySelector('.variant-options-edit-btn');
  
  if (saveBtn) saveBtn.onclick = () => saveInlineVariant(variant.id);
  if (cancelBtn) cancelBtn.onclick = () => cancelInlineVariant(variant.id);
  if (optionsBtn) optionsBtn.onclick = () => openVariantOptionsEditor(variant.id);
  
  // Populate values
  const nameInput = editForm.querySelector('.inline-variant-name');
  const minInput = editForm.querySelector('.inline-variant-min');
  const maxInput = editForm.querySelector('.inline-variant-max');
  const requiredCheckbox = editForm.querySelector('.inline-variant-required');
  
  if (nameInput) nameInput.value = variant.name;
  if (minInput) minInput.value = variant.min_select || '';
  if (maxInput) maxInput.value = variant.max_select || '';
  if (requiredCheckbox) requiredCheckbox.checked = variant.required || false;
  
  return editForm;
}

/**
 * Creates a variant options editor element
 * @param {Object} variant - Variant object
 * @returns {HTMLElement} The options editor element
 */
function createVariantOptionsEditorElement(variant) {
  const fragment = cloneTemplate('variant-options-editor-template');
  if (!fragment) return null;
  
  const editorForm = fragment.firstElementChild;
  if (!editorForm) return null;
  
  // Set title
  const titleEl = editorForm.querySelector('.options-editor-title');
  if (titleEl) titleEl.textContent = `Edit Options for "${variant.name}"`;
  
  // Render options list
  const optionsList = editorForm.querySelector('.options-list');
  if (optionsList) {
    if (variant.options && variant.options.length > 0) {
      optionsList.innerHTML = variant.options.map(function(option) {
        const priceLabel = option.price_cents > 0 ? ' (+$' + (option.price_cents / 100).toFixed(2) + ')' : '';
        return `
          <div id="option-row-${option.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 6px; background: white; border: 1px solid #ddd; border-radius: 3px; margin-bottom: 4px;">
            <span style="font-size: 12px;">${option.name}${priceLabel}</span>
            <div style="display: flex; gap: 4px;">
              <button onclick="editVariantOption(${option.id})" style="padding: 2px 6px; background: #2C3E50; color: white; border: none; border-radius: 2px; cursor: pointer; font-size: 10px;">Edit</button>
              <button onclick="deleteVariantOption(${option.id})" style="padding: 2px 6px; background: #d32f2f; color: white; border: none; border-radius: 2px; cursor: pointer; font-size: 10px;">Delete</button>
            </div>
          </div>
        `;
      }).join('');
    } else {
      optionsList.innerHTML = '<p style="font-size: 12px; color: #999; margin: 0;">No options yet</p>';
    }
  }
  
  // Set up buttons
  const addBtn = editorForm.querySelector('.add-option-btn');
  const backBtn = editorForm.querySelector('.back-to-variant-btn');
  if (addBtn) addBtn.onclick = startAddVariantOption;
  if (backBtn) backBtn.onclick = () => backToVariantEdit(variant.id);
  
  return editorForm;
}

/**
 * Creates a variant option edit form element
 * @param {Object} option - Option object
 * @returns {HTMLElement} The edit form element
 */
function createVariantOptionEditFormElement(option) {
  const fragment = cloneTemplate('variant-option-edit-form-template');
  if (!fragment) return null;
  
  const editForm = fragment.firstElementChild;
  if (!editForm) return null;
  
  // Populate values
  const nameInput = editForm.querySelector('.option-name-input');
  const priceInput = editForm.querySelector('.option-price-input');
  
  if (nameInput) {
    nameInput.id = `edit-opt-name-${option.id}`;
    nameInput.value = option.name;
  }
  
  if (priceInput) {
    priceInput.id = `edit-opt-price-${option.id}`;
    priceInput.value = option.price_cents || 0;
  }
  
  // Set up buttons
  const saveBtn = editForm.querySelector('.option-save-btn');
  const cancelBtn = editForm.querySelector('.option-cancel-btn');
  
  if (saveBtn) saveBtn.onclick = () => saveOptionEdit(option.id);
  if (cancelBtn) cancelBtn.onclick = () => cancelOptionEdit(option.id);
  
  return editForm;
}

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
    const fragment = cloneTemplate('add-item-card-template');
    if (fragment) addCard.appendChild(fragment);
    addCard.onclick = () => startCreateItem();
    grid.appendChild(addCard);
  }

  if (!items.length) {
    if (!IS_EDIT_MODE) {
      grid.innerHTML = `<div class="empty-state"><p>No items in this category</p></div>`;
    }
    return;
  }

  items.forEach((item, index) => {
    const isAvailable = item.available !== false;

    // Use template instead of buildMenuItemCardHTML
    const cardContent = createMenuItemCardElement(item, IS_EDIT_MODE);
    if (cardContent) {
      cardContent.className = `menu-item-card ${!isAvailable ? "unavailable" : ""}`;
      cardContent.dataset.itemId = item.id;
      
      // Direct click handler on each card
      cardContent.addEventListener('click', function cardClickHandler(e) {
        // Prevent event from bubbling if clicking controls
        if (e.target.closest('.menu-edit-controls')) return;
        openFoodItemPanel(item.id);
      });
      
      grid.appendChild(cardContent);
    }
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

  // Use template instead of buildEditItemModalHTML
  const modal = createEditItemModalElement(item, MENU_CATEGORIES);
  if (modal) {
    document.body.appendChild(modal);
  }
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
  
  // Get meal/combo flag from checkbox
  const isMealCombo = document.querySelector('.edit-item-is-meal-combo')?.checked || false;
  
  const imageFile = document.getElementById(`edit-item-image-${itemId}`).files[0];

  if (!name || !price) return alert("Name and price are required");

  try {
    // Update item properties including is_meal_combo
    await fetch(`${API}/menu-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        price_cents: price,
        category_id: categoryId,
        description,
        available,
        is_meal_combo: isMealCombo,
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

// Removed: editMenuCategoryName - unused function (category editing happens via inline workflow)

// ============= FOOD ITEM DETAIL PANEL =============

async function openFoodItemPanel(itemId) {
  try {
    // Panel is already loaded as part of admin-menu.html
    let panel = document.getElementById("food-item-panel");
    if (!panel) {
      console.error("Food item panel not found");
      return;
    }
    
    // Find item from already-loaded menu items
    const item = MENU_ITEMS.find(function(i) { return i.id == itemId; });
    if (!item) {
      alert("Item not found");
      return;
    }
    
    // Fetch variants for this item
    const variantRes = await fetch(`${API}/menu-items/${itemId}/variants`);
    const variants = variantRes.ok ? await variantRes.json() : [];
    
    // Store variants in global variable for edit mode
    CURRENT_VARIANTS = variants;
    currentEditingItemId = itemId;
    
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
  
  if (!CURRENT_VARIANTS || CURRENT_VARIANTS.length === 0) {
    variantsContainer.innerHTML = '<p style="color: #999; font-size: 13px;">No variants available</p>';
    return;
  }
  
  variantsContainer.innerHTML = '';
  CURRENT_VARIANTS.forEach(variant => {
    const variantEl = createVariantViewElement(variant);
    if (variantEl) variantsContainer.appendChild(variantEl);
  });
}

function renderFoodPanelVariantsForEdit() {
  // Render variants with delete buttons only (edit mode)
  const item = MENU_ITEMS.find(function(i) { return i.id == currentEditingItemId; });
  if (!item) return;
  
  const variantsContainer = document.getElementById('food-panel-variants');
  if (!variantsContainer) return;
  
  if (!CURRENT_VARIANTS || CURRENT_VARIANTS.length === 0) {
    variantsContainer.innerHTML = '<p style="color: #999; font-size: 13px;">No variants available</p>';
    return;
  }
  
  variantsContainer.innerHTML = '';
  CURRENT_VARIANTS.forEach(variant => {
    const variantEl = createVariantEditElement(variant);
    if (variantEl) variantsContainer.appendChild(variantEl);
  });
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
  
  // Use template instead of buildVariantInlineEditHTML
  const editElement = createVariantInlineEditElement(variant);
  variantCard.innerHTML = editElement.innerHTML;
  variantCard.style.background = '#fff9e6';
  
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
  
  // Use template instead of buildVariantOptionsEditorHTML
  const editorElement = createVariantOptionsEditorElement(variant);
  variantCard.innerHTML = editorElement.innerHTML;
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

// Removed: renderVariantOptions - unused function (variant rendering handled by renderFoodPanelVariantsForView/Edit)

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
  
  // Use template instead of buildVariantOptionEditFormHTML
  const editForm = createVariantOptionEditFormElement(option);
  optionRow.innerHTML = editForm.innerHTML;
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

// ============= MENU VARIANT MANAGEMENT =============
async function manageVariants(itemId) {
  OPEN_VARIANTS_ITEM_ID = OPEN_VARIANTS_ITEM_ID === itemId ? null : itemId;
  await loadMenuItems();
}

async function fetchVariants(itemId) {
  const res = await fetch(`${API}/menu-items/${itemId}/variants`);
  return await res.json();
}

function renderVariants(itemId, variants) {
  // Now deprecated - use renderFoodPanelVariantsForView or renderFoodPanelVariantsForEdit instead
  return '';
}


async function addVariantGroup(itemId) {
  const name = prompt("Variant group name (e.g., 'Size', 'Temperature'):");
  if (!name) return;

  const res = await fetch(`${API}/menu-items/${itemId}/variants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, required: true })
  });

  if (!res.ok) {
    alert("Failed to add variant group");
    return;
  }

  await loadMenuItems();
}

async function addVariantOption(itemId, groupId) {
  const name = prompt("Option name:");
  if (!name) return;

  const res = await fetch(
    `${API}/menu-items/${itemId}/variants/${groupId}/options`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price_cents: 0 })
    }
  );

  if (!res.ok) {
    alert("Failed to add option");
    return;
  }

  await loadMenuItems();
}

function sanitizeVariantChanges(changes) {
  // Prevent injection
  return {
    ...changes,
    name: changes.name ? changes.name.substring(0, 100) : ""
  };
}

async function updateVariant(itemId, groupId, changes) {
  const sanitized = sanitizeVariantChanges(changes);

  await fetch(`${API}/menu-items/${itemId}/variants/${groupId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sanitized)
  });

  await loadMenuItems();
}

async function deleteVariant(itemId, groupId) {
  if (!confirm("Delete this variant group?")) return;

  const res = await fetch(`${API}/menu-items/${itemId}/variants/${groupId}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    alert("Failed to delete variant");
    return;
  }

  await loadMenuItems();
}

async function updateVariantOption(itemId, groupId, optionId, name, price) {
  await fetch(
    `${API}/menu-items/${itemId}/variants/${groupId}/options/${optionId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price_cents: price })
    }
  );

  await loadMenuItems();
}

async function deleteVariantOption(itemId, groupId, optionId) {
  if (!confirm("Delete this option?")) return;

  const res = await fetch(
    `${API}/menu-items/${itemId}/variants/${groupId}/options/${optionId}`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    alert("Failed to delete option");
    return;
  }

  await loadMenuItems();
}

// ============ ADDON MANAGEMENT FUNCTIONS ============

/**
 * Load addons configured for a specific menu item
 * @param {number} itemId - Menu item ID
 * @returns {Promise<Array>} Array of addon configurations
 */
async function loadAddonsForItem(itemId) {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/addons?menu_item_id=${itemId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data || [];
  } catch (err) {
    console.error('Error loading addons:', err);
    return [];
  }
}

/**
 * Render addons in the edit modal
 * @param {number} itemId - Menu item ID
 * @param {HTMLElement} modal - Modal element
 */
async function renderAddonsInModal(itemId, modal) {
  const addons = await loadAddonsForItem(itemId);
  const addonsList = modal.querySelector('.edit-item-addons-list');
  const emptyMsg = modal.querySelector('.empty-addons-message');
  
  if (!addonsList) return;
  
  // Clear existing addons (except empty message)
  const existingItems = addonsList.querySelectorAll('.addon-item');
  existingItems.forEach(item => item.remove());
  
  if (addons.length === 0) {
    if (emptyMsg) emptyMsg.style.display = 'block';
    return;
  }
  
  if (emptyMsg) emptyMsg.style.display = 'none';
  
  // Render each addon
  addons.forEach(addon => {
    const addonEl = renderAddonItem(addon, itemId);
    addonsList.appendChild(addonEl);
  });
  
  // Store addons in modal for saving later
  modal.dataset.configuredAddons = JSON.stringify(addons);
}

/**
 * Render a single addon item element
 * @param {Object} addon - Addon configuration
 * @param {number} itemId - Parent menu item ID
 * @returns {HTMLElement} Addon item element
 */
function renderAddonItem(addon, itemId) {
  const fragment = cloneTemplate('addon-item-template');
  const addonItem = fragment.querySelector('.addon-item');
  
  if (!addonItem) return document.createElement('div');
  
  addonItem.dataset.addonId = addon.id;
  addonItem.dataset.addonItemId = addon.addon_item_id;
  
  // Set addon name
  const nameEl = addonItem.querySelector('.addon-item-name');
  if (nameEl) nameEl.textContent = addon.addon_name || 'Unknown Item';
  
  // Set prices
  const regularPriceEl = addonItem.querySelector('.addon-regular-price');
  const discountPriceEl = addonItem.querySelector('.addon-discount-price');
  
  if (regularPriceEl) {
    regularPriceEl.textContent = (addon.regular_price_cents / 100).toFixed(2);
  }
  if (discountPriceEl) {
    discountPriceEl.textContent = (addon.addon_discount_price_cents / 100).toFixed(2);
  }
  
  // Set up edit button
  const editBtn = addonItem.querySelector('.btn-addon-edit');
  if (editBtn) {
    editBtn.onclick = () => editAddonPrice(itemId, addon.id, addon);
  }
  
  // Set up remove button
  const removeBtn = addonItem.querySelector('.btn-addon-remove');
  if (removeBtn) {
    removeBtn.onclick = () => removeAddonFromModal(itemId, addon.id, addonItem);
  }
  
  return addonItem;
}

/**
 * Open addon selector modal for adding new addons
 * @param {number} itemId - Menu item ID
 * @param {HTMLElement} editModal - The edit modal element
 */
function openAddonSelector(itemId, editModal) {
  const fragment = cloneTemplate('addon-selector-modal-template');
  if (!fragment) return;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = `addon-selector-${itemId}`;
  modal.appendChild(fragment);
  
  // Get current addons to exclude them from the list
  const currentAddOnElements = editModal.querySelectorAll('.addon-item');
  const currentAddonIds = Array.from(currentAddOnElements).map(el => 
    parseInt(el.dataset.addonItemId) || 0
  );
  
  // Filter menu items: exclude current item and already added addons
  const availableItems = MENU_ITEMS.filter(item => 
    item.id !== itemId && !currentAddonIds.includes(item.id)
  );
  
  let selectedItemId = null;
  let selectedItem = null;
  
  // Render searchable item list
  const itemsContainer = modal.querySelector('.addon-items-selector');
  const searchInput = modal.querySelector('.addon-search-input');
  const priceSection = modal.querySelector('.addon-price-section');
  const priceInput = modal.querySelector('.addon-price-input');
  const confirmBtn = modal.querySelector('.btn-addon-confirm-select');
  
  function renderItems(items) {
    itemsContainer.innerHTML = items.map(item => `
      <div class="addon-selectable-item" data-item-id="${item.id}" style="padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 500; font-size: 13px;">${item.name}</div>
          <div style="font-size: 11px; color: #666;">$${(item.price_cents / 100).toFixed(2)}</div>
        </div>
        <div style="font-size: 20px; color: #ccc; cursor: pointer;" class="addon-select-icon">○</div>
      </div>
    `).join('');
    
    // Add click handlers and hover effects
    itemsContainer.querySelectorAll('.addon-selectable-item').forEach(el => {
      el.onmouseenter = () => {
        if (!el.style.background.includes('e8f5e9')) {
          el.style.background = '#f5f5f5';
        }
      };
      el.onmouseleave = () => {
        if (!el.style.background.includes('e8f5e9')) {
          el.style.background = '';
        }
      };
      el.onclick = () => selectAddonItem(parseInt(el.dataset.itemId), el);
    });
  }
  
  function selectAddonItem(addonItemId, element) {
    // Deselect previous
    itemsContainer.querySelectorAll('.addon-selectable-item').forEach(el => {
      el.style.background = '';
      el.querySelector('.addon-select-icon').textContent = '○';
    });
    
    // Select current
    selectedItemId = addonItemId;
    selectedItem = MENU_ITEMS.find(i => i.id === addonItemId);
    element.style.background = '#e8f5e9';
    element.querySelector('.addon-select-icon').textContent = '●';
    
    // Show price section
    priceSection.style.display = 'block';
    confirmBtn.style.display = 'block';
    
    // Set default price to item's regular price
    if (priceInput && selectedItem) {
      priceInput.value = selectedItem.price_cents;
    }
  }
  
  // Search functionality
  searchInput.oninput = (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = availableItems.filter(item => 
      item.name.toLowerCase().includes(query)
    );
    renderItems(filtered);
    
    // Re-select if item is still visible after filter
    if (selectedItemId) {
      const el = itemsContainer.querySelector(`[data-item-id="${selectedItemId}"]`);
      if (el) selectAddonItem(selectedItemId, el);
    }
  };
  
  // Initial render
  renderItems(availableItems);
  
  // Close handlers
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.querySelector('.btn-addon-cancel-select').onclick = () => modal.remove();
  
  // Confirm selection
  confirmBtn.onclick = async () => {
    if (!selectedItemId || !selectedItem) {
      alert('Please select an item');
      return;
    }
    
    const discountPrice = parseInt(priceInput.value) || selectedItem.price_cents;
    
    try {
      // Create addon configuration via API
      const res = await fetch(`${API}/restaurants/${restaurantId}/addons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_item_id: itemId,
          addon_item_id: selectedItemId,
          addon_name: selectedItem.name,
          regular_price_cents: selectedItem.price_cents,
          addon_discount_price_cents: discountPrice,
          is_available: true
        })
      });
      
      if (!res.ok) {
        alert('Failed to add addon');
        return;
      }
      
      // Close selector modal and refresh addons in edit modal
      modal.remove();
      await renderAddonsInModal(itemId, editModal);
    } catch (err) {
      alert('Error adding addon: ' + err.message);
    }
  };
  
  document.body.appendChild(modal);
}

/**
 * Load and populate addon presets dropdown in the edit modal
 */
async function loadAddonPresetsDropdown(modal) {
  try {
    const select = modal.querySelector('.edit-item-preset-addon-select');
    if (!select) return;
    
    const res = await fetch(`${API}/restaurants/${restaurantId}/addon-presets`);
    if (!res.ok) return;
    
    const presets = await res.json();
    
    // Clear existing options except the first one
    while (select.length > 1) {
      select.remove(1);
    }
    
    // Add preset options
    presets.forEach(preset => {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.name;
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading addon presets:', err);
  }
}

/**
 * Add all items from a preset addon list to a menu item
 */
async function addPresetAddonsToItem(itemId, presetId, modal) {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/addon-presets/${presetId}/items`);
    if (!res.ok) {
      alert('Failed to load preset items');
      return;
    }
    
    const presetItems = await res.json();
    
    // Add each item from the preset as an addon
    for (const presetItem of presetItems) {
      try {
        const addRes = await fetch(`${API}/restaurants/${restaurantId}/addons`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            menu_item_id: itemId,
            addon_item_id: presetItem.menu_item_id,
            addon_name: presetItem.menu_item?.name || 'Unknown',
            addon_preset_id: presetId,
            regular_price_cents: presetItem.menu_item?.price_cents || 0,
            addon_discount_price_cents: presetItem.addon_discount_price_cents,
            is_available: presetItem.is_available
          })
        });
        
        if (!addRes.ok) {
          console.warn('Failed to add addon from preset:', presetItem.menu_item_id);
        }
      } catch (err) {
        console.error('Error adding preset addon:', err);
      }
    }
    
    // Refresh addons display
    await renderAddonsInModal(itemId, modal);
    alert('Preset addons added successfully');
  } catch (err) {
    alert('Error adding preset addons: ' + err.message);
  }
}

/**
 * Edit addon discount price
 * @param {number} itemId - Menu item ID
 * @param {number} addonId - Addon configuration ID
 * @param {Object} addon - Current addon data
 */
async function editAddonPrice(itemId, addonId, addon) {
  const newPrice = prompt(
    'Enter new addon discount price (cents):',
    addon.addon_discount_price_cents
  );
  
  if (newPrice === null) return;
  
  const price = parseInt(newPrice);
  if (isNaN(price) || price < 0) {
    alert('Invalid price');
    return;
  }
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/addons/${addonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addon_discount_price_cents: price
      })
    });
    
    if (!res.ok) {
      alert('Failed to update addon price');
      return;
    }
    
    // Re-render addons in the modal
    const modal = document.getElementById(`edit-item-modal-${itemId}`);
    if (modal) {
      await renderAddonsInModal(itemId, modal);
    }
  } catch (err) {
    alert('Error updating addon: ' + err.message);
  }
}

/**
 * Remove addon from modal (immediately delete)
 * @param {number} itemId - Menu item ID
 * @param {number} addonId - Addon configuration ID
 * @param {HTMLElement} element - Addon item element
 */
async function removeAddonFromModal(itemId, addonId, element) {
  if (!confirm('Remove this addon?')) return;
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/addons/${addonId}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      alert('Failed to remove addon');
      return;
    }
    
    // Remove element and check if list is empty
    element.remove();
    
    const modal = document.getElementById(`edit-item-modal-${itemId}`);
    if (modal) {
      const list = modal.querySelector('.edit-item-addons-list');
      const items = list.querySelectorAll('.addon-item');
      const emptyMsg = modal.querySelector('.empty-addons-message');
      
      if (items.length === 0 && emptyMsg) {
        emptyMsg.style.display = 'block';
      }
    }
  } catch (err) {
    alert('Error removing addon: ' + err.message);
  }
}