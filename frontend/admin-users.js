// ============= USERS & RESTAURANTS MODULE =============

let usersData = [];
let restaurantsData = [];
let editingUserId = null;
let editingRestaurantId = null;
let selectedUserRole = 'staff';

// ============= LOAD DATA =============

async function loadUsersManagement() {
  try {
    const [usersRes, restaurantsRes] = await Promise.all([
      fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/manage/restaurants`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    if (usersRes.ok) {
      usersData = await usersRes.json();
    }
    if (restaurantsRes.ok) {
      restaurantsData = await restaurantsRes.json();
    }

    renderUsersList();
    renderRestaurantsList();

    // Show superadmin-only elements
    if (IS_SUPERADMIN) {
      var createRestBtn = document.getElementById('create-restaurant-btn');
      if (createRestBtn) createRestBtn.style.display = '';
      var adminChip = document.getElementById('role-admin-chip');
      if (adminChip) adminChip.style.display = '';
      var saChip = document.getElementById('role-superadmin-chip');
      if (saChip) saChip.style.display = '';
    }
  } catch (err) {
    console.error('Failed to load users/restaurants:', err);
  }
}

// ============= USERS TAB =============

function renderUsersList() {
  var container = document.getElementById('users-list');
  if (!container) return;

  if (!usersData.length) {
    container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No users found</p>';
    return;
  }

  var currentUserId = localStorage.getItem('userId');
  var html = '';
  for (var i = 0; i < usersData.length; i++) {
    var u = usersData[i];
    var isCurrentUser = String(u.id) === String(currentUserId);
    var roleBadgeClass = 'role-badge-' + u.role;

    html += '<div class="user-card">';
    html += '  <div class="user-card-info">';
    html += '    <div class="user-card-name">';
    html += '      <span>' + escapeHtml(u.name || '(unnamed)') + '</span>';
    html += '      <span class="role-badge ' + roleBadgeClass + '">' + u.role + '</span>';
    html += '    </div>';
    html += '    <div class="user-card-meta">';
    if (u.email) html += '<span>📧 ' + escapeHtml(u.email) + '</span>';
    if (u.pin) html += '<span>🔑 ' + u.pin + '</span>';
    html += '<span>🏪 ' + escapeHtml(u.restaurant_name || (u.restaurant_id ? '#' + u.restaurant_id : 'None')) + '</span>';
    html += '    </div>';
    html += '  </div>';
    html += '  <div class="user-card-actions">';
    html += '    <button class="btn-edit" onclick="openUserModal(' + u.id + ')">✏️ Edit</button>';
    if (!isCurrentUser) {
      html += '    <button class="btn-delete-user" onclick="deleteUser(' + u.id + ', \'' + escapeHtml(u.name || '') + '\')">🗑️</button>';
    }
    html += '  </div>';
    html += '</div>';
  }

  container.innerHTML = html;
}

// ============= RESTAURANTS TAB =============

function renderRestaurantsList() {
  var container = document.getElementById('restaurants-list');
  if (!container) return;

  if (!restaurantsData.length) {
    container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No restaurants found</p>';
    return;
  }

  var html = '';
  for (var i = 0; i < restaurantsData.length; i++) {
    var r = restaurantsData[i];
    html += '<div class="user-card restaurant-card-clickable" onclick="openRestaurantDetail(' + r.id + ')" style="cursor: pointer;">';
    html += '  <div class="user-card-info">';
    html += '    <div class="user-card-name">';
    html += '      <span>' + escapeHtml(r.name) + '</span>';
    if (r.is_customized) {
      html += '      <span class="deploy-badge deploy-badge-custom">CUSTOM</span>';
    } else {
      html += '      <span class="deploy-badge deploy-badge-standard">STANDARD</span>';
    }
    html += '    </div>';
    html += '    <div class="user-card-meta">';
    if (r.address) html += '<span>📍 ' + escapeHtml(r.address) + '</span>';
    if (r.phone) html += '<span>📞 ' + escapeHtml(r.phone) + '</span>';
    html += '    </div>';
    html += '    <div class="restaurant-meta">';
    html += '      <span class="meta-chip">👥 ' + (r.user_count || 0) + ' users</span>';
    if (r.timezone) html += '<span class="meta-chip">🕐 ' + r.timezone + '</span>';
    if (r.service_charge_percent != null) html += '<span class="meta-chip">' + r.service_charge_percent + '% SC</span>';
    if (r.is_customized && r.app_version) html += '<span class="meta-chip meta-chip-version">v' + escapeHtml(r.app_version) + '</span>';
    if (r.is_customized && r.custom_branch) html += '<span class="meta-chip meta-chip-branch">🌿 ' + escapeHtml(r.custom_branch) + '</span>';
    html += '    </div>';
    if (r.is_customized && r.api_base_url) {
      html += '    <div class="user-card-meta" style="margin-top: 2px;"><span>🔗 ' + escapeHtml(r.api_base_url) + '</span></div>';
    }
    html += '  </div>';
    html += '  <div class="user-card-actions">';
    html += '    <button class="btn-edit" onclick="event.stopPropagation(); openRestaurantModal(' + r.id + ')">✏️ Edit</button>';
    if (IS_SUPERADMIN) {
      html += '    <button class="btn-delete-user" onclick="event.stopPropagation(); deleteRestaurant(' + r.id + ', \'' + escapeHtml(r.name) + '\')">🗑️</button>';
    }
    html += '    <span style="color: #9ca3af; font-size: 18px; margin-left: 4px;">›</span>';
    html += '  </div>';
    html += '</div>';
  }

  container.innerHTML = html;
}

// ============= TAB SWITCHING =============

function switchUsersTab(tabName) {
  // Update tab buttons
  var tabBtns = document.querySelectorAll('.users-tab-btn');
  for (var i = 0; i < tabBtns.length; i++) {
    tabBtns[i].classList.remove('active');
  }
  var activeBtn = document.querySelector('.users-tab-btn[data-tab="' + tabName + '"]');
  if (activeBtn) activeBtn.classList.add('active');

  // Toggle content
  document.getElementById('users-tab-content').style.display = tabName === 'users' ? '' : 'none';
  document.getElementById('restaurants-tab-content').style.display = tabName === 'restaurants' ? '' : 'none';
}

// ============= USER MODAL =============

function openUserModal(userId) {
  editingUserId = userId || null;
  var modal = document.getElementById('user-modal');
  var titleEl = document.getElementById('user-modal-title');
  var saveBtn = document.getElementById('user-save-btn');
  var errorEl = document.getElementById('user-modal-error');
  if (errorEl) errorEl.style.display = 'none';

  if (editingUserId) {
    titleEl.textContent = 'Edit User';
    saveBtn.textContent = 'Save Changes';

    // Find user and populate form
    var user = usersData.find(function(u) { return u.id === editingUserId; });
    if (user) {
      document.getElementById('user-form-name').value = user.name || '';
      document.getElementById('user-form-email').value = user.email || '';
      document.getElementById('user-form-password').value = '';
      document.getElementById('user-form-confirm-password').value = '';
      document.getElementById('user-form-pin').value = user.pin || '';
      document.getElementById('user-form-hourly-rate').value = user.hourly_rate_cents ? (user.hourly_rate_cents / 100).toFixed(2) : '';
      selectUserRole(user.role);

      // Populate restaurant select
      populateRestaurantSelect(user.restaurant_id);

      // Update password label for editing
      var pwLabel = document.getElementById('user-form-password-label');
      if (pwLabel) pwLabel.textContent = 'Password (leave blank to keep)';
    }
  } else {
    titleEl.textContent = 'Create User';
    saveBtn.textContent = 'Create User';

    // Clear form
    document.getElementById('user-form-name').value = '';
    document.getElementById('user-form-email').value = '';
    document.getElementById('user-form-password').value = '';
    document.getElementById('user-form-confirm-password').value = '';
    document.getElementById('user-form-pin').value = '';
    document.getElementById('user-form-hourly-rate').value = '';
    selectUserRole('staff');
    populateRestaurantSelect(restaurantId);

    var pwLabel = document.getElementById('user-form-password-label');
    if (pwLabel) pwLabel.textContent = 'Password *';
  }

  modal.style.display = 'flex';
}

function closeUserModal() {
  var modal = document.getElementById('user-modal');
  modal.style.display = 'none';
  editingUserId = null;
}

function selectUserRole(roleName) {
  selectedUserRole = roleName;

  // Update chip buttons
  var chips = document.querySelectorAll('.users-role-picker .role-chip');
  for (var i = 0; i < chips.length; i++) {
    chips[i].classList.remove('active');
  }
  var activeChip = document.querySelector('.role-chip[data-role="' + roleName + '"]');
  if (activeChip) activeChip.classList.add('active');

  // Toggle email/password vs PIN sections
  var needsEmail = (roleName === 'admin' || roleName === 'superadmin');
  var needsPin = (roleName === 'staff' || roleName === 'kitchen');

  document.getElementById('user-form-email-section').style.display = needsEmail ? '' : 'none';
  document.getElementById('user-form-pin-section').style.display = needsPin ? '' : 'none';

  // Show restaurant select for superadmin
  var restSection = document.getElementById('user-form-restaurant-section');
  if (restSection) restSection.style.display = IS_SUPERADMIN ? '' : 'none';
}

function populateRestaurantSelect(selectedId) {
  var select = document.getElementById('user-form-restaurant');
  if (!select) return;
  select.innerHTML = '';
  for (var i = 0; i < restaurantsData.length; i++) {
    var r = restaurantsData[i];
    var opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.name;
    if (String(r.id) === String(selectedId)) opt.selected = true;
    select.appendChild(opt);
  }
}

async function saveUser() {
  var errorEl = document.getElementById('user-modal-error');
  errorEl.style.display = 'none';

  var name = document.getElementById('user-form-name').value.trim();
  if (!name) { showUserError('Name is required'); return; }

  var payload = { name: name, role: selectedUserRole };

  if (selectedUserRole === 'admin' || selectedUserRole === 'superadmin') {
    var email = document.getElementById('user-form-email').value.trim();
    var password = document.getElementById('user-form-password').value;

    if (email) payload.email = email;

    if (password) {
      var confirmPassword = document.getElementById('user-form-confirm-password').value;
      if (password !== confirmPassword) { showUserError('Passwords do not match'); return; }
      if (password.length < 8) { showUserError('Password must be at least 8 characters'); return; }
      payload.password = password;
    }

    if (!editingUserId) {
      if (!email) { showUserError('Email is required'); return; }
      if (!password) { showUserError('Password is required'); return; }
    }
  }

  if (selectedUserRole === 'staff' || selectedUserRole === 'kitchen') {
    var pin = document.getElementById('user-form-pin').value.trim();
    if (!pin && !editingUserId) { showUserError('PIN is required'); return; }
    if (pin) payload.pin = pin;
  }

  if (IS_SUPERADMIN) {
    var rid = document.getElementById('user-form-restaurant').value;
    if (rid) payload.restaurant_id = parseInt(rid);
  }

  var hourlyRate = document.getElementById('user-form-hourly-rate').value;
  if (hourlyRate) payload.hourly_rate_cents = Math.round(parseFloat(hourlyRate) * 100);

  try {
    var url, method;
    if (editingUserId) {
      url = `${API}/users/${editingUserId}`;
      method = 'PATCH';
    } else {
      url = `${API}/users`;
      method = 'POST';
    }

    var res = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    var data = await res.json();
    if (!res.ok) {
      showUserError(data.error || data.message || 'Failed to save user');
      return;
    }

    closeUserModal();
    await loadUsersManagement();
  } catch (err) {
    showUserError(err.message || 'Network error');
  }
}

async function deleteUser(userId, userName) {
  if (!confirm('Delete user "' + userName + '"? This cannot be undone.')) return;

  try {
    var res = await fetch(`${API}/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      var data = await res.json();
      alert(data.error || 'Failed to delete user');
      return;
    }

    await loadUsersManagement();
  } catch (err) {
    alert('Failed to delete user: ' + err.message);
  }
}

function showUserError(msg) {
  var errorEl = document.getElementById('user-modal-error');
  if (errorEl) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }
}

// ============= RESTAURANT MODAL =============

function openRestaurantModal(restId) {
  editingRestaurantId = restId || null;
  var modal = document.getElementById('restaurant-modal');
  var titleEl = document.getElementById('restaurant-modal-title');
  var saveBtn = document.getElementById('restaurant-save-btn');
  var errorEl = document.getElementById('restaurant-modal-error');
  if (errorEl) errorEl.style.display = 'none';

  if (editingRestaurantId) {
    titleEl.textContent = 'Edit Restaurant';
    saveBtn.textContent = 'Save Changes';

    var rest = restaurantsData.find(function(r) { return r.id === editingRestaurantId; });
    if (rest) {
      document.getElementById('restaurant-form-name').value = rest.name || '';
      document.getElementById('restaurant-form-address').value = rest.address || '';
      document.getElementById('restaurant-form-phone').value = rest.phone || '';
      document.getElementById('restaurant-form-sc').value = rest.service_charge_percent != null ? rest.service_charge_percent : 10;
      document.getElementById('restaurant-form-timezone').value = rest.timezone || 'Asia/Hong_Kong';
      document.getElementById('restaurant-form-language').value = rest.language_preference || 'en';
    }
  } else {
    titleEl.textContent = 'Create Restaurant';
    saveBtn.textContent = 'Create Restaurant';

    document.getElementById('restaurant-form-name').value = '';
    document.getElementById('restaurant-form-address').value = '';
    document.getElementById('restaurant-form-phone').value = '';
    document.getElementById('restaurant-form-sc').value = '10';
    document.getElementById('restaurant-form-timezone').value = 'Asia/Hong_Kong';
    document.getElementById('restaurant-form-language').value = 'en';
  }

  modal.style.display = 'flex';
}

function closeRestaurantModal() {
  var modal = document.getElementById('restaurant-modal');
  modal.style.display = 'none';
  editingRestaurantId = null;
}

async function saveRestaurant() {
  var errorEl = document.getElementById('restaurant-modal-error');
  errorEl.style.display = 'none';

  var name = document.getElementById('restaurant-form-name').value.trim();
  if (!name) { showRestaurantError('Restaurant name is required'); return; }

  var payload = {
    name: name,
    address: document.getElementById('restaurant-form-address').value.trim() || undefined,
    phone: document.getElementById('restaurant-form-phone').value.trim() || undefined,
    service_charge_percent: parseFloat(document.getElementById('restaurant-form-sc').value) || 0,
    timezone: document.getElementById('restaurant-form-timezone').value,
    language_preference: document.getElementById('restaurant-form-language').value,
  };

  try {
    var url, method;
    if (editingRestaurantId) {
      url = `${API}/manage/restaurants/${editingRestaurantId}`;
      method = 'PATCH';
    } else {
      url = `${API}/manage/restaurants`;
      method = 'POST';
    }

    var res = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    var data = await res.json();
    if (!res.ok) {
      showRestaurantError(data.error || data.message || 'Failed to save restaurant');
      return;
    }

    closeRestaurantModal();
    await loadUsersManagement();
  } catch (err) {
    showRestaurantError(err.message || 'Network error');
  }
}

async function deleteRestaurant(restId, restName) {
  if (!confirm('Delete restaurant "' + restName + '"? All users must be removed first.')) return;

  try {
    var res = await fetch(`${API}/manage/restaurants/${restId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      var data = await res.json();
      alert(data.error || 'Failed to delete restaurant');
      return;
    }

    await loadUsersManagement();
  } catch (err) {
    alert('Failed to delete restaurant: ' + err.message);
  }
}

function showRestaurantError(msg) {
  var errorEl = document.getElementById('restaurant-modal-error');
  if (errorEl) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }
}

// ============= RESTAURANT DETAIL =============

async function openRestaurantDetail(restId) {
  var rest = restaurantsData.find(function(r) { return r.id === restId; });
  if (!rest) return;

  var modal = document.getElementById('restaurant-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'restaurant-detail-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = '<div class="modal-content restaurant-detail-content"><div class="modal-header"><h3 id="restaurant-detail-title"></h3><button class="modal-close" onclick="closeRestaurantDetail()">✕</button></div><div class="modal-body" id="restaurant-detail-body"></div></div>';
    document.body.appendChild(modal);
  }

  document.getElementById('restaurant-detail-title').textContent = rest.name;

  var bodyHtml = '';

  // --- Restaurant Info Section ---
  bodyHtml += '<div class="detail-section">';
  bodyHtml += '<h4 class="detail-section-title">Restaurant Information</h4>';
  bodyHtml += '<div class="detail-grid">';
  bodyHtml += '<div class="detail-row"><span class="detail-label">ID</span><span class="detail-value">#' + rest.id + '</span></div>';
  if (rest.address) bodyHtml += '<div class="detail-row"><span class="detail-label">Address</span><span class="detail-value">' + escapeHtml(rest.address) + '</span></div>';
  if (rest.phone) bodyHtml += '<div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">' + escapeHtml(rest.phone) + '</span></div>';
  if (rest.timezone) bodyHtml += '<div class="detail-row"><span class="detail-label">Timezone</span><span class="detail-value">' + rest.timezone + '</span></div>';
  if (rest.service_charge_percent != null) bodyHtml += '<div class="detail-row"><span class="detail-label">Service Charge</span><span class="detail-value">' + rest.service_charge_percent + '%</span></div>';
  if (rest.language_preference) bodyHtml += '<div class="detail-row"><span class="detail-label">Language</span><span class="detail-value">' + (rest.language_preference === 'zh' ? '中文' : 'English') + '</span></div>';
  bodyHtml += '<div class="detail-row"><span class="detail-label">Users</span><span class="detail-value">' + (rest.user_count || 0) + '</span></div>';
  bodyHtml += '</div></div>';

  // --- Premium Features (Feature Flags) ---
  if (IS_SUPERADMIN) {
    bodyHtml += '<div class="detail-section">';
    bodyHtml += '<h4 class="detail-section-title">Premium Features</h4>';
    bodyHtml += '<p style="font-size: 12px; color: #6b7280; margin-bottom: 12px;">Disabled modules are hidden from all users of this restaurant.</p>';
    bodyHtml += '<div id="restaurant-detail-flags"><p style="color: #9ca3af; text-align: center;">Loading...</p></div>';
    bodyHtml += '</div>';
  }

  // --- Payment Terminal Applications ---
  bodyHtml += '<div class="detail-section">';
  bodyHtml += '<h4 class="detail-section-title">Payment Terminal Applications</h4>';
  bodyHtml += '<div id="restaurant-detail-applications"><p style="color: #9ca3af; text-align: center;">Loading...</p></div>';
  bodyHtml += '</div>';

  document.getElementById('restaurant-detail-body').innerHTML = bodyHtml;
  modal.style.display = 'flex';

  // Fetch settings (feature flags) and applications in parallel
  var flagDefs = [
    { key: 'bookings',             label: 'Bookings',         desc: 'Table reservations module' },
    { key: 'waitlist',             label: 'Waitlist',         desc: 'Queue / walk-in waitlist' },
    { key: 'crm',                  label: 'CRM',              desc: 'Customer relationship management' },
    { key: 'coupons',              label: 'Coupons',          desc: 'Discount coupons and promotions' },
    { key: 'service_requests',     label: 'Service Requests', desc: 'Customer call-waiter / bill requests' },
    { key: 'allow_custom_food_items', label: 'Custom Food Items', desc: 'Staff can add free-text items to orders' },
  ];

  if (IS_SUPERADMIN) {
    try {
      var settingsRes = await fetch(`${API}/restaurants/${restId}/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (settingsRes.ok) {
        var settings = await settingsRes.json();
        var flags = settings.feature_flags || {};
        var flagsHtml = '';
        for (var fi = 0; fi < flagDefs.length; fi++) {
          var fd = flagDefs[fi];
          // Default: true (opt-out) — if explicitly false it's disabled
          var isOn = flags[fd.key] !== false;
          flagsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;' + (fi < flagDefs.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : '') + '">';
          flagsHtml += '  <div>';
          flagsHtml += '    <div style="font-size:13px;font-weight:600;color:#111827;">' + escapeHtml(fd.label) + '</div>';
          flagsHtml += '    <div style="font-size:11px;color:#6b7280;margin-top:2px;">' + escapeHtml(fd.desc) + '</div>';
          flagsHtml += '  </div>';
          flagsHtml += '  <label class="toggle-switch" style="flex-shrink:0;margin-left:12px;">';
          flagsHtml += '    <input type="checkbox" ' + (isOn ? 'checked' : '') + ' onchange="toggleRestaurantFlag(' + restId + ', \'' + fd.key + '\', this.checked)">';
          flagsHtml += '    <span class="toggle-slider"></span>';
          flagsHtml += '  </label>';
          flagsHtml += '</div>';
        }
        document.getElementById('restaurant-detail-flags').innerHTML = flagsHtml;
      } else {
        document.getElementById('restaurant-detail-flags').innerHTML = '<p style="color: #ef4444; text-align: center;">Failed to load feature flags</p>';
      }
    } catch (err) {
      document.getElementById('restaurant-detail-flags').innerHTML = '<p style="color: #ef4444; text-align: center;">Failed to load feature flags</p>';
    }
  }

  // Fetch applications
  try {
    var res = await fetch(`${API}/restaurants/${restId}/payment-terminal-applications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      var apps = await res.json();
      renderRestaurantApplications(apps);
    } else {
      document.getElementById('restaurant-detail-applications').innerHTML = '<p style="color: #ef4444; text-align: center;">Failed to load applications</p>';
    }
  } catch (err) {
    document.getElementById('restaurant-detail-applications').innerHTML = '<p style="color: #ef4444; text-align: center;">Failed to load applications</p>';
  }
}

// ============= FEATURE FLAG TOGGLE =============

async function toggleRestaurantFlag(restId, flagKey, value) {
  try {
    var res = await fetch(`${API}/restaurants/${restId}/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ feature_flags: { [flagKey]: value } }),
    });
    if (!res.ok) {
      var data = await res.json();
      alert(data.error || 'Failed to update feature flag');
    }
  } catch (err) {
    alert('Failed to update feature flag: ' + err.message);
  }
}

// ============= CUSTOMIZATION TOGGLE =============

async function toggleCustomization(restId, enable) {
  var actionText = enable ? 'enable custom deployment for' : 'disable custom deployment for';
  var rest = restaurantsData.find(function(r) { return r.id === restId; });
  var restName = rest ? rest.name : '#' + restId;

  if (!confirm('Are you sure you want to ' + actionText + ' "' + restName + '"?\n\n' +
    (enable ? 'This will automatically:\n• Create a git branch\n• Create a Render web service\n• Copy production env vars\n• Set up custom domain & DNS\n• Auto-fill all deployment details' : 'The restaurant will revert to the shared platform.'))) {
    var cb = document.getElementById('customization-toggle-' + restId);
    if (cb) cb.checked = !enable;
    return;
  }

  // Show deploying state
  var toggleRow = document.getElementById('customization-toggle-' + restId);
  if (toggleRow) toggleRow.disabled = true;
  var deployDetails = document.getElementById('deploy-details-' + restId);
  if (deployDetails && enable) {
    deployDetails.innerHTML = '<div style="text-align: center; padding: 20px; color: #6366f1;"><div style="font-size: 24px; margin-bottom: 8px;">⏳</div><div style="font-weight: 600;">Deploying...</div><div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">Creating service, configuring DNS, copying env vars...</div></div>';
  }

  try {
    var res = await fetch(`${API}/manage/restaurants/${restId}/toggle-customization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ enable: enable }),
    });

    var data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to toggle customization');
      var cb = document.getElementById('customization-toggle-' + restId);
      if (cb) { cb.checked = !enable; cb.disabled = false; }
      return;
    }

    // Build result message
    var msg = '✅ Customization ' + (enable ? 'enabled' : 'disabled') + ' for "' + restName + '"';
    if (data.steps && data.steps.length) msg += '\n\nSteps completed:\n• ' + data.steps.join('\n• ');
    if (data.errors && data.errors.length) msg += '\n\n⚠️ Warnings:\n• ' + data.errors.join('\n• ');
    if (data.note) msg += '\n\nℹ️ ' + data.note;
    alert(msg);

    // Refresh data and re-open detail
    await loadUsersManagement();
    openRestaurantDetail(restId);
  } catch (err) {
    alert('Failed to toggle customization: ' + err.message);
    var cb = document.getElementById('customization-toggle-' + restId);
    if (cb) { cb.checked = !enable; cb.disabled = false; }
  }
}

// ============= SAVE DEPLOYMENT SETTINGS =============

async function saveDeploymentSettings(restId) {
  var version = document.getElementById('deploy-version-' + restId).value.trim();
  var branch = document.getElementById('deploy-branch-' + restId).value.trim();
  var renderServiceId = document.getElementById('deploy-render-' + restId).value.trim();
  var apiBaseUrl = document.getElementById('deploy-url-' + restId).value.trim();

  var payload = {};
  payload.app_version = version || null;
  payload.custom_branch = branch || null;
  payload.render_service_id = renderServiceId || null;
  payload.api_base_url = apiBaseUrl || null;

  try {
    var res = await fetch(`${API}/manage/restaurants/${restId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    var data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to save deployment settings');
      return;
    }

    alert('Deployment settings saved successfully.');
    await loadUsersManagement();
    openRestaurantDetail(restId);
  } catch (err) {
    alert('Failed to save: ' + err.message);
  }
}

function renderRestaurantApplications(apps) {
  var container = document.getElementById('restaurant-detail-applications');
  if (!container) return;

  if (!apps.length) {
    container.innerHTML = '<p style="color: #9ca3af; text-align: center; padding: 20px;">No applications submitted</p>';
    return;
  }

  var html = '';
  for (var i = 0; i < apps.length; i++) {
    var app = apps[i];
    var statusColor = app.status === 'approved' ? '#059669' : app.status === 'rejected' ? '#dc2626' : '#d97706';
    var statusBg = app.status === 'approved' ? '#dcfce7' : app.status === 'rejected' ? '#fef2f2' : '#fef3c7';

    html += '<div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 10px;">';
    html += '  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">';
    html += '    <strong style="font-size: 14px; color: #1f2937;">' + escapeHtml(app.company_name) + '</strong>';
    html += '    <span style="background: ' + statusBg + '; color: ' + statusColor + '; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">' + app.status.toUpperCase() + '</span>';
    html += '  </div>';
    html += '  <p style="margin: 0 0 3px 0; font-size: 12px; color: #6b7280;">📞 ' + escapeHtml(app.contact_number) + '</p>';
    html += '  <p style="margin: 0 0 3px 0; font-size: 12px; color: #6b7280;">📧 ' + escapeHtml(app.contact_email) + '</p>';
    html += '  <p style="margin: 0 0 3px 0; font-size: 12px; color: #6b7280;">📋 BR No: ' + escapeHtml(app.br_license_no) + '</p>';
    html += '  <p style="margin: 0 0 3px 0; font-size: 12px; color: #6b7280;">📅 Submitted: ' + new Date(app.submitted_at).toLocaleDateString() + '</p>';
    if (app.br_certificate_url) {
      html += '  <p style="margin: 0 0 3px 0; font-size: 12px;"><a href="' + escapeHtml(app.br_certificate_url) + '" target="_blank" style="color: #3b82f6;">📄 BR Certificate</a></p>';
    }
    if (app.restaurant_license_url) {
      html += '  <p style="margin: 0 0 3px 0; font-size: 12px;"><a href="' + escapeHtml(app.restaurant_license_url) + '" target="_blank" style="color: #3b82f6;">📄 Restaurant License</a></p>';
    }
    if (app.admin_notes) {
      html += '  <p style="margin: 3px 0 0 0; font-size: 12px; color: #6b7280;">📝 Notes: ' + escapeHtml(app.admin_notes) + '</p>';
    }

    if (IS_SUPERADMIN && app.status === 'pending') {
      html += '  <div style="display: flex; gap: 8px; margin-top: 10px;">';
      html += '    <button onclick="event.stopPropagation(); updateApplicationStatus(' + app.id + ', \'approved\', ' + app.restaurant_id + ')" style="flex: 1; background: #059669; color: #fff; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">Approve</button>';
      html += '    <button onclick="event.stopPropagation(); updateApplicationStatus(' + app.id + ', \'rejected\', ' + app.restaurant_id + ')" style="flex: 1; background: #dc2626; color: #fff; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">Reject</button>';
      html += '  </div>';
    }

    html += '</div>';
  }

  container.innerHTML = html;
}

function closeRestaurantDetail() {
  var modal = document.getElementById('restaurant-detail-modal');
  if (modal) modal.style.display = 'none';
}

async function updateApplicationStatus(appId, status, restaurantId) {
  try {
    var res = await fetch(`${API}/manage/payment-terminal-applications/${appId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: status }),
    });

    if (!res.ok) {
      var data = await res.json();
      alert(data.error || 'Failed to update application');
      return;
    }

    // Refresh the applications list
    var appsRes = await fetch(`${API}/restaurants/${restaurantId}/payment-terminal-applications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (appsRes.ok) {
      var apps = await appsRes.json();
      renderRestaurantApplications(apps);
    }
  } catch (err) {
    alert('Failed to update application: ' + err.message);
  }
}

// ============= UTILS =============

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
