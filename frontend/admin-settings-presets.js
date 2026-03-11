// ============= ADDON & VARIANT PRESETS MANAGEMENT =============

let ADDON_PRESETS_CACHE = [];
let VARIANT_PRESETS_CACHE = [];

// ========== ADDON PRESETS ==========

/**
 * Load and display addon presets
 */
async function loadAddonPresets() {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/addon-presets`);
    if (!res.ok) return;
    
    ADDON_PRESETS_CACHE = await res.json();
    renderAddonPresetsList();
  } catch (err) {
    console.error('Error loading addon presets:', err);
  }
}

/**
 * Render addon presets list in the modal
 */
function renderAddonPresetsList() {
  const listContainer = document.getElementById('addon-presets-list');
  if (!listContainer) return;
  
  if (ADDON_PRESETS_CACHE.length === 0) {
    listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No presets created yet</div>';
    return;
  }
  
  listContainer.innerHTML = ADDON_PRESETS_CACHE.map(preset => `
    <div style="background: #f9f9f9; padding: 12px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid #27ae60;">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div style="flex: 1;">
          <strong style="font-size: 14px;">${preset.name}</strong>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">${preset.description || 'No description'}</p>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #999;">Items: ${preset.items_count || 0}</p>
        </div>
        <div style="display: flex; gap: 6px;">
          <button onclick="editAddonPreset(${preset.id})" class="btn-secondary" style="padding: 6px 12px; font-size: 12px;">Edit</button>
          <button onclick="deleteAddonPreset(${preset.id}, '${preset.name}')" class="btn-danger" style="padding: 6px 12px; font-size: 12px;">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

/**
 * Start creating a new addon preset
 */
function startCreateAddonPreset() {
  const name = prompt('Preset Name (e.g., "Drinks", "Appetizers"):');
  if (!name) return;
  
  const description = prompt('Description (optional):');
  
  createAddonPreset(name, description);
}

/**
 * Create a new addon preset
 */
async function createAddonPreset(name, description) {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/addon-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        is_active: true
      })
    });
    
    if (!res.ok) {
      alert('Failed to create preset');
      return;
    }
    
    const preset = await res.json();
    alert('Preset created! Now add items to it.');
    await editAddonPreset(preset.id);
  } catch (err) {
    alert('Error creating preset: ' + err.message);
  }
}

/**
 * Edit an addon preset (manage its items)
 */
async function editAddonPreset(presetId) {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/addon-presets/${presetId}`);
    if (!res.ok) return;
    
    const preset = await res.json();
    
    // Build modal for editing preset items
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
          <h3>Edit Preset: ${preset.name}</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Add Items to Preset:</label>
            <div style="display: flex; gap: 8px;">
              <select id="addon-item-select-${presetId}" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <option value="">-- Select menu item --</option>
              </select>
              <input id="addon-price-input-${presetId}" type="number" placeholder="Discount price" style="width: 120px; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"/>
              <button onclick="addItemToAddonPreset(${presetId})" style="padding: 8px 16px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer;">Add</button>
            </div>
          </div>
          
          <div style="margin-top: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Preset Items:</label>
            <div id="preset-items-${presetId}" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 8px;">
              <!-- Items rendered here -->
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">Close</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Populate item dropdown
    const select = document.getElementById(`addon-item-select-${presetId}`);
    MENU_ITEMS.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      select.appendChild(option);
    });
    
    // Load and render preset items
    await loadAndRenderPresetItems(presetId);
  } catch (err) {
    console.error('Error editing preset:', err);
  }
}

/**
 * Load and render items in a preset
 */
async function loadAndRenderPresetItems(presetId) {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/addon-presets/${presetId}/items`);
    if (!res.ok) return;
    
    const items = await res.json();
    const container = document.getElementById(`preset-items-${presetId}`);
    
    if (!items || items.length === 0) {
      container.innerHTML = '<div style="padding: 12px; text-align: center; color: #999;">No items in this preset</div>';
      return;
    }
    
    container.innerHTML = items.map(item => `
      <div style="padding: 10px; background: white; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 500; font-size: 13px;">${item.menu_item?.name || 'Unknown'}</div>
          <div style="font-size: 11px; color: #666;">Discount: $${(item.addon_discount_price_cents / 100).toFixed(2)}</div>
        </div>
        <button onclick="removeItemFromAddonPreset(${presetId}, ${item.id})" class="btn-danger" style="padding: 4px 8px; font-size: 11px;">Remove</button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading preset items:', err);
  }
}

/**
 * Add an item to an addon preset
 */
async function addItemToAddonPreset(presetId) {
  const itemSelect = document.getElementById(`addon-item-select-${presetId}`);
  const priceInput = document.getElementById(`addon-price-input-${presetId}`);
  
  const menuItemId = parseInt(itemSelect.value);
  const discountPrice = parseInt(priceInput.value) || 0;
  
  if (!menuItemId) {
    alert('Please select an item');
    return;
  }
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/addon-presets/${presetId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_item_id: menuItemId,
        addon_discount_price_cents: discountPrice
      })
    });
    
    if (!res.ok) {
      alert('Failed to add item to preset');
      return;
    }
    
    itemSelect.value = '';
    priceInput.value = '';
    await loadAndRenderPresetItems(presetId);
  } catch (err) {
    alert('Error adding item: ' + err.message);
  }
}

/**
 * Remove an item from an addon preset
 */
async function removeItemFromAddonPreset(presetId, itemId) {
  if (!confirm('Remove this item from the preset?')) return;
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/addon-presets/${presetId}/items/${itemId}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      alert('Failed to remove item');
      return;
    }
    
    await loadAndRenderPresetItems(presetId);
  } catch (err) {
    alert('Error removing item: ' + err.message);
  }
}

/**
 * Delete an addon preset
 */
async function deleteAddonPreset(presetId, presetName) {
  if (!confirm(`Delete preset "${presetName}"? This cannot be undone.`)) return;
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/addon-presets/${presetId}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      alert('Failed to delete preset');
      return;
    }
    
    await loadAddonPresets();
  } catch (err) {
    alert('Error deleting preset: ' + err.message);
  }
}

// ========== VARIANT PRESETS ==========

/**
 * Load and display variant presets
 */
async function loadVariantPresets() {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/variant-presets`);
    if (!res.ok) return;
    
    VARIANT_PRESETS_CACHE = await res.json();
    renderVariantPresetsList();
  } catch (err) {
    console.error('Error loading variant presets:', err);
  }
}

/**
 * Render variant presets list in the modal
 */
function renderVariantPresetsList() {
  const listContainer = document.getElementById('variant-presets-list');
  if (!listContainer) return;
  
  if (VARIANT_PRESETS_CACHE.length === 0) {
    listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No presets created yet</div>';
    return;
  }
  
  listContainer.innerHTML = VARIANT_PRESETS_CACHE.map(preset => `
    <div style="background: #f9f9f9; padding: 12px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid #2C3E50;">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div style="flex: 1;">
          <strong style="font-size: 14px;">${preset.name}</strong>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">${preset.description || 'No description'}</p>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #999;">Variants: ${preset.variants_count || 0}</p>
        </div>
        <div style="display: flex; gap: 6px;">
          <button onclick="editVariantPreset(${preset.id})" class="btn-secondary" style="padding: 6px 12px; font-size: 12px;">Edit</button>
          <button onclick="deleteVariantPreset(${preset.id}, '${preset.name}')" class="btn-danger" style="padding: 6px 12px; font-size: 12px;">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

/**
 * Start creating a new variant preset
 */
function startCreateVariantPreset() {
  const name = prompt('Preset Name (e.g., "Drink Sizes", "Preparation"):');
  if (!name) return;
  
  const description = prompt('Description (optional):');
  
  createVariantPreset(name, description);
}

/**
 * Create a new variant preset
 */
async function createVariantPreset(name, description) {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/variant-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        is_active: true
      })
    });
    
    if (!res.ok) {
      alert('Failed to create preset');
      return;
    }
    
    const preset = await res.json();
    alert('Preset created! Now add variants to it.');
    await editVariantPreset(preset.id);
  } catch (err) {
    alert('Error creating preset: ' + err.message);
  }
}

/**
 * Edit a variant preset (manage its variants)
 */
async function editVariantPreset(presetId) {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/variant-presets/${presetId}`);
    if (!res.ok) return;
    
    const preset = await res.json();
    
    // Get all variants from restaurant
    // Note: This assumes MENU_ITEMS has variants, or we need to fetch them separately
    const allVariants = [];
    MENU_ITEMS.forEach(item => {
      if (item.variants) {
        item.variants.forEach(v => {
          allVariants.push({ ...v, menu_item_name: item.name });
        });
      }
    });
    
    // Build modal for editing preset variants
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
          <h3>Edit Preset: ${preset.name}</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Add Variants to Preset:</label>
            <div style="display: flex; gap: 8px;">
              <select id="variant-select-${presetId}" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <option value="">-- Select variant --</option>
              </select>
              <button onclick="addVariantToPreset(${presetId})" style="padding: 8px 16px; background: #2C3E50; color: white; border: none; border-radius: 4px; cursor: pointer;">Add</button>
            </div>
          </div>
          
          <div style="margin-top: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Preset Variants:</label>
            <div id="preset-variants-${presetId}" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 8px;">
              <!-- Variants rendered here -->
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">Close</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Populate variant dropdown
    const select = document.getElementById(`variant-select-${presetId}`);
    allVariants.forEach(variant => {
      const option = document.createElement('option');
      option.value = variant.id;
      option.textContent = `${variant.menu_item_name} - ${variant.name}`;
      select.appendChild(option);
    });
    
    // Load and render preset variants
    await loadAndRenderPresetVariants(presetId);
  } catch (err) {
    console.error('Error editing preset:', err);
  }
}

/**
 * Load and render variants in a preset
 */
async function loadAndRenderPresetVariants(presetId) {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/variant-presets/${presetId}/variants`);
    if (!res.ok) return;
    
    const variants = await res.json();
    const container = document.getElementById(`preset-variants-${presetId}`);
    
    if (!variants || variants.length === 0) {
      container.innerHTML = '<div style="padding: 12px; text-align: center; color: #999;">No variants in this preset</div>';
      return;
    }
    
    container.innerHTML = variants.map(v => `
      <div style="padding: 10px; background: white; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 500; font-size: 13px;">${v.variant?.name || 'Unknown'}</div>
          <div style="font-size: 11px; color: #666;">From menu item</div>
        </div>
        <button onclick="removeVariantFromPreset(${presetId}, ${v.variant_id})" class="btn-danger" style="padding: 4px 8px; font-size: 11px;">Remove</button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading preset variants:', err);
  }
}

/**
 * Add a variant to a preset
 */
async function addVariantToPreset(presetId) {
  const select = document.getElementById(`variant-select-${presetId}`);
  
  const variantId = parseInt(select.value);
  
  if (!variantId) {
    alert('Please select a variant');
    return;
  }
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/variant-presets/${presetId}/variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variant_id: variantId
      })
    });
    
    if (!res.ok) {
      alert('Failed to add variant to preset');
      return;
    }
    
    select.value = '';
    await loadAndRenderPresetVariants(presetId);
  } catch (err) {
    alert('Error adding variant: ' + err.message);
  }
}

/**
 * Remove a variant from a preset
 */
async function removeVariantFromPreset(presetId, variantId) {
  if (!confirm('Remove this variant from the preset?')) return;
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/variant-presets/${presetId}/variants/${variantId}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      alert('Failed to remove variant');
      return;
    }
    
    await loadAndRenderPresetVariants(presetId);
  } catch (err) {
    alert('Error removing variant: ' + err.message);
  }
}

/**
 * Delete a variant preset
 */
async function deleteVariantPreset(presetId, presetName) {
  if (!confirm(`Delete preset "${presetName}"? This cannot be undone.`)) return;
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/variant-presets/${presetId}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      alert('Failed to delete preset');
      return;
    }
    
    await loadVariantPresets();
  } catch (err) {
    alert('Error deleting preset: ' + err.message);
  }
}

// ========== MODAL INITIALIZATION ==========

/**
 * Initialize preset modals when opened
 */
function initializePresetModals() {
  // Addon Presets
  const originalOpenAddonModal = window.openSettingsModal;
  window.openSettingsModal = function(setting) {
    if (setting === 'addon-presets') {
      loadAddonPresets();
    } else if (setting === 'variant-presets') {
      loadVariantPresets();
    }
    originalOpenAddonModal.call(this, argument);
  };
}

// Auto-initialize when script loads
document.addEventListener('DOMContentLoaded', function() {
  // This will be called after DOM is ready
  console.log('[admin-settings-presets.js] Loaded');
});
