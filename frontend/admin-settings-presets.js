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
 * Start creating a new addon preset — shows app-styled modal instead of browser prompt
 */
function startCreateAddonPreset() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 480px;">
      <div class="modal-header">
        <h3>${t('admin.create-addon-preset')}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div class="form-group">
          <label>${t('admin.preset-name-label')}</label>
          <input id="addon-preset-name" type="text" placeholder="${t('admin.preset-name-placeholder')}" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; font-family: inherit;" />
        </div>
        <div class="form-group" style="margin-top: 14px;">
          <label>${t('admin.preset-desc-label')}</label>
          <textarea id="addon-preset-desc" placeholder="${t('admin.preset-desc-placeholder')}" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; font-family: inherit; min-height: 64px; resize: vertical;"></textarea>
        </div>
      </div>
      <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px;">
        <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">${t('admin.cancel-button')}</button>
        <button onclick="_submitCreateAddonPreset()" class="btn-primary">${t('admin.create-preset-btn')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.querySelector('#addon-preset-name')?.focus(), 50);
}

async function _submitCreateAddonPreset() {
  const name = document.getElementById('addon-preset-name')?.value?.trim();
  const description = document.getElementById('addon-preset-desc')?.value?.trim();
  if (!name) return;
  document.querySelector('.modal-overlay')?.remove();
  await createAddonPreset(name, description);
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
          <h3>${t('admin.edit-addon-preset').replace('{0}', escapeHtml ? escapeHtml(preset.name) : preset.name)}</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="padding: 20px 24px;">
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.4px; color: #374151;">${t('admin.add-items-to-preset')}</label>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <select id="addon-item-select-${presetId}" style="flex: 1; min-width: 160px; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; font-family: inherit;">
                <option value="">${t('admin.select-menu-item')}</option>
              </select>
              <input id="addon-price-input-${presetId}" type="number" placeholder="${t('admin.discount-price-label')}" style="width: 130px; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; font-family: inherit;"/>
              <button onclick="addItemToAddonPreset(${presetId})" class="btn-primary">${t('admin.preset-add-btn')}</button>
            </div>
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.4px; color: #374151;">${t('admin.preset-items-label')}</label>
            <div id="preset-items-${presetId}" style="max-height: 300px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px;">
              <!-- Items rendered here -->
            </div>
          </div>
        </div>
        <div class="modal-footer" style="padding: 16px 24px; display: flex; justify-content: flex-end;">
          <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">${t('admin.close')}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Populate item dropdown — fetch if menu section hasn't been loaded yet
    const select = document.getElementById(`addon-item-select-${presetId}`);
    let menuItems = MENU_ITEMS;
    if (!menuItems || menuItems.length === 0) {
      try {
        const menuRes = await fetch(`${API}/restaurants/${restaurantId}/menu/staff`);
        if (menuRes.ok) {
          menuItems = await menuRes.json();
          MENU_ITEMS = menuItems;
        }
      } catch (e) {
        console.warn('Could not fetch menu items for preset dropdown', e);
      }
    }
    menuItems.forEach(item => {
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
      container.innerHTML = `<div style="padding: 12px; text-align: center; color: #9ca3af; font-size: 13px;">${t('admin.no-items-in-preset')}</div>`;
      return;
    }
    
    container.innerHTML = items.map(item => `
      <div style="padding: 10px 12px; background: white; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center; border-radius: 4px; margin-bottom: 4px;">
        <div>
          <div style="font-weight: 600; font-size: 13px; color: #1f2937;">${item.menu_item?.name || 'Unknown'}</div>
          <div style="font-size: 11px; color: #6b7280;">${t('admin.discount-display').replace('{0}', (item.addon_discount_price_cents / 100).toFixed(2))}</div>
        </div>
        <button onclick="removeItemFromAddonPreset(${presetId}, ${item.id})" class="btn-danger" style="padding: 4px 10px; font-size: 11px;">${t('admin.item-remove-btn')}</button>
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
  if (!confirm(t('admin.remove-item-from-preset'))) return;
  
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
  if (!confirm(t('admin.preset-delete-confirm').replace('{0}', presetName))) return;
  
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
    listContainer.innerHTML = '<div style="padding: 40px 20px; text-align: center;"><p style="color: #999; font-size: 14px; margin: 0;">📋 No variant presets created yet</p><p style="color: #bbb; font-size: 12px; margin-top: 8px;">Create a variant preset template to get started</p></div>';
    return;
  }
  
  listContainer.innerHTML = VARIANT_PRESETS_CACHE.map(preset => `
    <div style="background: linear-gradient(135deg, #ffffff 0%, #f8fafb 100%); padding: 16px; border-radius: 10px; margin-bottom: 14px; border: 2px solid #e5e7eb; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: all 0.3s ease; cursor: default;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 18px; line-height: 1;">🏷️</span>
            <strong style="font-size: 15px; color: #1f2937; word-break: break-word;">${preset.name}</strong>
            <span style="background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 12px; white-space: nowrap;">${preset.options_count || 0} option${(preset.options_count || 0) !== 1 ? 's' : ''}</span>
          </div>
          ${preset.description ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">${preset.description}</p>` : ''}
          <p style="margin: 0; font-size: 11px; color: #9ca3af;">Template for variant options used in menu items</p>
        </div>
        <div style="display: flex; gap: 6px; flex-shrink: 0;">
          <button onclick="editVariantPreset(${preset.id})" class="btn-secondary" style="padding: 8px 14px; font-size: 12px; border-radius: 6px; border: 1px solid #2C3E50; background: #2C3E50; color: white; cursor: pointer; font-weight: 600; transition: all 0.2s ease;"onmouseover="this.style.background='#1a252f'; this.style.borderColor='#1a252f'; this.style.boxShadow='0 2px 8px rgba(44, 62, 80, 0.3)';" onmouseout="this.style.background='#2C3E50'; this.style.borderColor='#2C3E50'; this.style.boxShadow='none';">✏️ Edit</button>
          <button onclick="deleteVariantPreset(${preset.id}, '${preset.name}')" class="btn-danger" style="padding: 8px 14px; font-size: 12px; border-radius: 6px; border: 1px solid #d32f2f; background: #d32f2f; color: white; cursor: pointer; font-weight: 600; transition: all 0.2s ease;" onmouseover="this.style.background='#b71c1c'; this.style.borderColor='#b71c1c'; this.style.boxShadow='0 2px 8px rgba(211, 47, 47, 0.3)';" onmouseout="this.style.background='#d32f2f'; this.style.borderColor='#d32f2f'; this.style.boxShadow='none';">🗑️ Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

/**
 * Start creating a new variant preset
 */
function startCreateVariantPreset() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h3>${t('admin.create-variant-preset')}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div class="form-group">
          <label>${t('admin.variant-title-label')}</label>
          <input id="preset-name" type="text" placeholder="${t('admin.variant-title-placeholder')}" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; font-family: inherit;">
        </div>
        <div class="form-group" style="margin-top: 14px;">
          <label>${t('admin.preset-desc-label')}</label>
          <textarea id="preset-description" placeholder="${t('admin.preset-desc-placeholder')}" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; min-height: 60px; font-family: inherit; resize: vertical;"></textarea>
        </div>
      </div>
      <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px;">
        <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">${t('admin.cancel-button')}</button>
        <button onclick="createVariantPreset()" class="btn-primary">${t('admin.create-preset-btn')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.querySelector('#preset-name')?.focus(), 50);
}

/**
 * Create a new variant preset
 */
async function createVariantPreset() {
  const name = document.getElementById('preset-name')?.value;
  const description = document.getElementById('preset-description')?.value;
  
  if (!name) {
    alert(t('admin.preset-name-label') + '?');
    return;
  }
  
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
    
    // Close the create modal
    document.querySelector('.modal-overlay').remove();
    
    // Reload presets and open the new preset for adding options
    await loadVariantPresets();
    editVariantPreset(preset.id);
  } catch (err) {
    alert('Error creating preset: ' + err.message);
  }
}

/**
 * Edit a variant preset (manage its options)
 */
async function editVariantPreset(presetId) {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/variant-presets/${presetId}`);
    if (!res.ok) return;
    
    const preset = await res.json();
    
    // Build modal for editing preset options
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 680px;">
        <div class="modal-header">
          <h3>🏷️ ${escapeHtml ? escapeHtml(preset.name) : preset.name}</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="padding: 20px 24px;">
          <div style="margin-bottom: 20px; padding: 14px 16px; background: #f0f9ff; border-left: 3px solid #3b82f6; border-radius: 6px;">
            <label style="display: block; margin-bottom: 10px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.4px; color: #1f2937;">${t('admin.add-new-option')}</label>
            <button onclick="showCreateOptionForm(${presetId})" class="btn-primary" style="width: 100%;">${t('admin.add-option-btn')}</button>
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 10px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.4px; color: #1f2937;">${t('admin.options-label')}</label>
            <div id="preset-options-${presetId}" style="max-height: 350px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; background: #fafbfc;">
              <!-- Options rendered here -->
            </div>
          </div>
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; padding: 16px 24px;">
          <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">${t('admin.close')}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load and render preset options
    await loadAndRenderPresetOptions(presetId);
  } catch (err) {
    console.error('Error editing preset:', err);
  }
}

/**
 * Show form to create a new option in preset
 */
function showCreateOptionForm(presetId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 560px;">
      <div class="modal-header">
        <h3>${t('admin.add-option-title')}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div class="form-group">
          <label>${t('admin.option-name-input')}</label>
          <input id="new-option-name-${presetId}" type="text" placeholder="${t('admin.option-name-placeholder')}" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; font-family: inherit;">
        </div>
        <div class="form-group" style="margin-top: 14px;">
          <label>${t('admin.option-price-input')}</label>
          <input id="new-option-price-${presetId}" type="number" placeholder="${t('admin.option-price-placeholder')}" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; font-family: inherit;">
        </div>
      </div>
      <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px;">
        <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">${t('admin.cancel-button')}</button>
        <button onclick="createOptionInPreset(${presetId})" class="btn-primary">${t('admin.add-option-btn')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.querySelector(`#new-option-name-${presetId}`)?.focus(), 50);
}

/**
 * Create a new option in a preset
 */
async function createOptionInPreset(presetId) {
  const name = document.getElementById(`new-option-name-${presetId}`)?.value;
  const priceCents = document.getElementById(`new-option-price-${presetId}`)?.value;
  
  if (!name) {
    alert('Please enter an option name');
    return;
  }
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/variant-presets/${presetId}/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        price_cents: priceCents ? parseInt(priceCents) : 0
      })
    });
    
    if (!res.ok) {
      alert('Failed to create option');
      return;
    }
    
    // Close the create form modal
    document.querySelector('.modal-overlay:last-child').remove();
    // Reload the preset options
    await loadAndRenderPresetOptions(presetId);
  } catch (err) {
    alert('Error creating option: ' + err.message);
  }
}

/**
 * Load and render options in a preset
 */
async function loadAndRenderPresetOptions(presetId) {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/variant-presets/${presetId}/options`);
    if (!res.ok) return;
    
    const options = await res.json();
    const container = document.getElementById(`preset-options-${presetId}`);
    
    if (!options || options.length === 0) {
      container.innerHTML = `<div style="padding: 20px; text-align: center;"><p style="color: #9ca3af; font-size: 13px; margin: 0;">${t('admin.no-options-in-preset')}</p><p style="color: #d1d5db; font-size: 12px; margin-top: 6px;">${t('admin.no-options-hint')}</p></div>`;
      return;
    }
    
    container.innerHTML = options.map(opt => {
      const price = opt.price_cents > 0 ? t('admin.option-price-plus').replace('{0}', (opt.price_cents / 100).toFixed(2)) : t('admin.option-price-display');
      
      return `
        <div style="padding: 12px 14px; background: white; border-bottom: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 12px; border-left: 4px solid #10b981;">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 13px; color: #1f2937;">${opt.name}</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 3px;">${price}</div>
          </div>
          <div style="display: flex; gap: 6px; flex-shrink: 0;">
            <button onclick="editOptionInPreset(${presetId}, ${opt.id})" class="btn-secondary" style="padding: 5px 10px; font-size: 11px;">✏️ ${t('admin.header-edit')}</button>
            <button onclick="deleteOptionFromPreset(${presetId}, ${opt.id})" class="btn-danger" style="padding: 5px 10px; font-size: 11px;">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading preset options:', err);
  }
}

/**
 * Edit an option in a preset
 */
async function editOptionInPreset(presetId, optionId) {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/variant-presets/${presetId}/options/${optionId}`);
    if (!res.ok) return;
    
    const option = await res.json();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 560px;">
        <div class="modal-header">
          <h3>${t('admin.edit-option-title')}</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="padding: 24px;">
          <div class="form-group">
            <label>${t('admin.option-name-input')}</label>
            <input id="edit-option-name-${optionId}" type="text" value="${option.name || ''}" placeholder="${t('admin.option-name-placeholder')}" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; font-family: inherit;">
          </div>
          <div class="form-group" style="margin-top: 14px;">
            <label>${t('admin.option-price-input')}</label>
            <input id="edit-option-price-${optionId}" type="number" value="${option.price_cents || 0}" placeholder="${t('admin.option-price-placeholder')}" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; font-family: inherit;">
          </div>
        </div>
        <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px;">
          <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">${t('admin.cancel-button')}</button>
          <button onclick="saveEditedOptionInPreset(${presetId}, ${optionId})" class="btn-primary">${t('admin.save-option-changes')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } catch (err) {
    alert('Error loading option: ' + err.message);
  }
}

/**
 * Save edited option in preset
 */
async function saveEditedOptionInPreset(presetId, optionId) {
  const name = document.getElementById(`edit-option-name-${optionId}`)?.value;
  const priceCents = document.getElementById(`edit-option-price-${optionId}`)?.value;
  
  if (!name) {
    alert('Please enter an option name');
    return;
  }
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/variant-presets/${presetId}/options/${optionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        price_cents: priceCents ? parseInt(priceCents) : 0
      })
    });
    
    if (!res.ok) {
      alert('Failed to update option');
      return;
    }
    
    document.querySelector('.modal-overlay:last-child').remove();
    await loadAndRenderPresetOptions(presetId);
  } catch (err) {
    alert('Error updating option: ' + err.message);
  }
}

/**
 * Delete an option from a preset
 */
async function deleteOptionFromPreset(presetId, optionId) {
  if (!confirm(t('admin.delete-option-confirm'))) return;
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/variant-presets/${presetId}/options/${optionId}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      alert('Failed to delete option');
      return;
    }
    
    await loadAndRenderPresetOptions(presetId);
  } catch (err) {
    alert('Error deleting option: ' + err.message);
  }
}

/**
 * Delete a variant preset
 */
async function deleteVariantPreset(presetId, presetName) {
  if (!confirm(t('admin.preset-delete-confirm').replace('{0}', presetName))) return;
  
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
