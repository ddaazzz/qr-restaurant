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
    html += '<div class="user-card">';
    html += '  <div class="user-card-info">';
    html += '    <div class="user-card-name">' + escapeHtml(r.name) + '</div>';
    html += '    <div class="user-card-meta">';
    if (r.address) html += '<span>📍 ' + escapeHtml(r.address) + '</span>';
    if (r.phone) html += '<span>📞 ' + escapeHtml(r.phone) + '</span>';
    html += '    </div>';
    html += '    <div class="restaurant-meta">';
    html += '      <span class="meta-chip">👥 ' + (r.user_count || 0) + ' users</span>';
    if (r.timezone) html += '<span class="meta-chip">🕐 ' + r.timezone + '</span>';
    if (r.service_charge_percent != null) html += '<span class="meta-chip">' + r.service_charge_percent + '% SC</span>';
    html += '    </div>';
    html += '  </div>';
    html += '  <div class="user-card-actions">';
    html += '    <button class="btn-edit" onclick="openRestaurantModal(' + r.id + ')">✏️ Edit</button>';
    if (IS_SUPERADMIN) {
      html += '    <button class="btn-delete-user" onclick="deleteRestaurant(' + r.id + ', \'' + escapeHtml(r.name) + '\')">🗑️</button>';
    }
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
    if (password) payload.password = password;

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
