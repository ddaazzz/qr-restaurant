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
      <div class="modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;">
        <h3 style="margin: 0; color: white;">Create New Variant Preset</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="color: white; font-size: 28px; background: none; border: none; cursor: pointer;">✕</button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #1f2937;">Variant Title (e.g., "Drink Size", "Temperature")</label>
          <input id="preset-name" type="text" placeholder="e.g., Drink Size" style="width: 100%; padding: 10px 12px; border: 2px solid #d1d5db; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #1f2937;">Description (optional)</label>
          <textarea id="preset-description" placeholder="e.g., Available drink sizes" style="width: 100%; padding: 10px 12px; border: 2px solid #d1d5db; border-radius: 6px; font-size: 13px; box-sizing: border-box; min-height: 60px; font-family: inherit;"></textarea>
        </div>
      </div>
      <div class="modal-footer" style="padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary" style="padding: 10px 20px; background: white; color: #1f2937; border: 2px solid #d1d5db; border-radius: 6px; cursor: pointer; font-weight: 600;">Cancel</button>
        <button onclick="createVariantPreset()" style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Create Preset</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

/**
 * Create a new variant preset
 */
async function createVariantPreset() {
  const name = document.getElementById('preset-name')?.value;
  const description = document.getElementById('preset-description')?.value;
  
  if (!name) {
    alert('Please enter a variant title');
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
    alert('Preset created! Now add variant options.');
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
      <div class="modal-content" style="max-width: 700px;">
        <div class="modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;">
          <h3 style="margin: 0; color: white; display: flex; align-items: center; gap: 10px;"><span>🏷️</span> ${preset.name}</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="color: white; font-size: 28px; background: none; border: none; cursor: pointer;">✕</button>
        </div>
        <div class="modal-body" style="padding: 24px;">
          <div style="margin-bottom: 24px; padding: 16px; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 6px;">
            <label style="display: block; margin-bottom: 10px; font-weight: 700; font-size: 14px; color: #1f2937;">➕ Add New Option:</label>
            <button onclick="showCreateOptionForm(${presetId})" style="width: 100%; padding: 10px 18px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 700; transition: all 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">+ Add Option</button>
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 12px; font-weight: 700; font-size: 14px; color: #1f2937;">📋 Options:</label>
            <div id="preset-options-${presetId}" style="max-height: 350px; overflow-y: auto; border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #fafbfc;">
              <!-- Options rendered here -->
            </div>
          </div>
        </div>
        <div class="modal-footer" style="padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; display: flex; gap: 10px; justify-content: flex-end;">
          <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary" style="padding: 10px 20px; background: white; color: #1f2937; border: 2px solid #d1d5db; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.2s ease;" onmouseover="this.style.borderColor='#1f2937'; this.style.background='#f3f4f6';" onmouseout="this.style.borderColor='#d1d5db'; this.style.background='white';">Close</button>
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
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;">
        <h3 style="margin: 0; color: white;">Add Option</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="color: white; font-size: 28px; background: none; border: none; cursor: pointer;">✕</button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #1f2937;">Option Name (e.g., "Small", "Medium", "Large")</label>
          <input id="new-option-name-${presetId}" type="text" placeholder="e.g., Small" style="width: 100%; padding: 10px 12px; border: 2px solid #d1d5db; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #1f2937;">Price/Upcharge (optional, in cents)</label>
          <input id="new-option-price-${presetId}" type="number" placeholder="e.g., 0 or 100 for $1.00" style="width: 100%; padding: 10px 12px; border: 2px solid #d1d5db; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
        </div>
      </div>
      <div class="modal-footer" style="padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary" style="padding: 10px 20px; background: white; color: #1f2937; border: 2px solid #d1d5db; border-radius: 6px; cursor: pointer; font-weight: 600;">Cancel</button>
        <button onclick="createOptionInPreset(${presetId})" style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Add Option</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
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
      container.innerHTML = '<div style="padding: 24px; text-align: center;"><p style="color: #999; font-size: 13px; margin: 0;">No options added yet</p><p style="color: #bbb; font-size: 12px; margin-top: 8px;">Click "Add Option" to add the first one</p></div>';
      return;
    }
    
    container.innerHTML = options.map(opt => {
      const price = opt.price_cents > 0 ? `+$${(opt.price_cents / 100).toFixed(2)}` : 'No charge';
      
      return `
        <div style="padding: 14px; background: white; border-bottom: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; gap: 12px; transition: all 0.2s ease; border-left: 4px solid #10b981;">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 13px; color: #1f2937;">${opt.name}</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${price}</div>
          </div>
          <div style="display: flex; gap: 6px; flex-shrink: 0;">
            <button onclick="editOptionInPreset(${presetId}, ${opt.id})" style="padding: 6px 10px; background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; border-radius: 5px; font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.2s ease;" onmouseover="this.style.background='#93c5fd';" onmouseout="this.style.background='#dbeafe';">✏️ Edit</button>
            <button onclick="deleteOptionFromPreset(${presetId}, ${opt.id})" style="padding: 6px 10px; background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; border-radius: 5px; font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.2s ease;" onmouseover="this.style.background='#fca5a5'; this.style.color='#7c2d12';" onmouseout="this.style.background='#fee2e2'; this.style.color='#991b1b';">🗑️ Delete</button>
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
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;">
          <h3 style="margin: 0; color: white;">Edit Option</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="color: white; font-size: 28px; background: none; border: none; cursor: pointer;">✕</button>
        </div>
        <div class="modal-body" style="padding: 24px;">
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #1f2937;">Option Name</label>
            <input id="edit-option-name-${optionId}" type="text" value="${option.name || ''}" placeholder="e.g., Small" style="width: 100%; padding: 10px 12px; border: 2px solid #d1d5db; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #1f2937;">Price/Upcharge (optional, in cents)</label>
            <input id="edit-option-price-${optionId}" type="number" value="${option.price_cents || 0}" placeholder="e.g., 0 or 100 for $1.00" style="width: 100%; padding: 10px 12px; border: 2px solid #d1d5db; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
          </div>
        </div>
        <div class="modal-footer" style="padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; display: flex; gap: 10px; justify-content: flex-end;">
          <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary" style="padding: 10px 20px; background: white; color: #1f2937; border: 2px solid #d1d5db; border-radius: 6px; cursor: pointer; font-weight: 600;">Cancel</button>
          <button onclick="saveEditedOptionInPreset(${presetId}, ${optionId})" style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Save Changes</button>
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
  if (!confirm('Delete this option?')) return;
  
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
