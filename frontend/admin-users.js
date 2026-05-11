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

    // Stale / expired token — redirect to login
    if (usersRes.status === 401 || usersRes.status === 403) {
      if (usersRes.status === 401) {
        localStorage.clear();
        window.location.href = '/login.html?reason=SessionExpired';
        return;
      }
      var usersListEl = document.getElementById('users-list');
      if (usersListEl) usersListEl.innerHTML = '<p style="color:#ef4444;text-align:center;padding:20px;">Access denied. Please log out and log back in as a superadmin.</p>';
    } else if (usersRes.ok) {
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
  var container = document.querySelector('#section-users #users-list') || document.getElementById('users-list');
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
    if (u.email) html += '<span>' + escapeHtml(u.email) + '</span>';
    if (u.pin) html += '<span>PIN: ' + u.pin + '</span>';
    html += '<span>' + escapeHtml(u.restaurant_name || (u.restaurant_id ? '#' + u.restaurant_id : 'None')) + '</span>';
    html += '    </div>';
    html += '  </div>';
    html += '  <div class="user-card-actions">';
    html += '    <button class="btn-edit" onclick="openUserModal(' + u.id + ')">Edit</button>';
    if (!isCurrentUser) {
      html += '    <button class="btn-delete-user" onclick="deleteUser(' + u.id + ', \'' + escapeHtml(u.name || '') + '\')">Delete</button>';
    }
    html += '  </div>';
    html += '</div>';
  }

  container.innerHTML = html;
}

// ============= SUBSCRIPTION HELPERS =============

function getSubscriptionBadge(r) {
  var tier = r.subscription_tier || 'free';
  var now = new Date();

  if (tier === 'premium') {
    var endDate = r.subscription_end_date ? new Date(r.subscription_end_date) : null;
    var plan = r.subscription_plan ? (r.subscription_plan === 'annually' ? '/yr' : '/mo') : '';
    if (endDate && endDate < now) {
      return '<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">PAID EXPIRED</span>';
    }
    return '<span style="background:#d1fae5;color:#059669;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">PAID' + plan + '</span>';
  }
  if (tier === 'trial') {
    var trialEnd = r.subscription_trial_end ? new Date(r.subscription_trial_end) : null;
    if (!trialEnd || trialEnd < now) {
      return '<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">TRIAL EXPIRED</span>';
    }
    var daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
    var color = daysLeft <= 3 ? '#dc2626' : daysLeft <= 7 ? '#d97706' : '#0284c7';
    var bg = daysLeft <= 3 ? '#fee2e2' : daysLeft <= 7 ? '#fef3c7' : '#dbeafe';
    return '<span style="background:' + bg + ';color:' + color + ';padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">TRIAL · ' + daysLeft + 'd left</span>';
  }
  if (tier === 'expired') {
    return '<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">EXPIRED</span>';
  }
  // free
  return '<span style="background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">FREE</span>';
}

function getSubscriptionSummaryText(r) {
  var tier = r.subscription_tier || 'free';
  var now = new Date();
  var lines = [];

  if (tier === 'trial') {
    var trialEnd = r.subscription_trial_end ? new Date(r.subscription_trial_end) : null;
    if (trialEnd) {
      var daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
      lines.push('Trial ends: ' + trialEnd.toLocaleDateString('en-HK', { year: 'numeric', month: 'short', day: 'numeric' }) + (daysLeft > 0 ? ' (' + daysLeft + 'd left)' : ' (expired)'));
    }
  } else if (tier === 'premium') {
    if (r.subscription_start_date) lines.push('Paid since: ' + new Date(r.subscription_start_date).toLocaleDateString('en-HK', { year: 'numeric', month: 'short', day: 'numeric' }));
    if (r.subscription_end_date) lines.push('Renews: ' + new Date(r.subscription_end_date).toLocaleDateString('en-HK', { year: 'numeric', month: 'short', day: 'numeric' }));
    if (r.subscription_plan) lines.push('Plan: ' + r.subscription_plan);
  }
  return lines.join(' · ');
}



// ============= RESTAURANTS TAB =============

function renderRestaurantsList() {
  var container = document.querySelector('#section-users #restaurants-list') || document.getElementById('restaurants-list');
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
    html += '      ' + getSubscriptionBadge(r);
    html += '    </div>';
    html += '    <div class="user-card-meta">';
    if (r.address) html += '<span>' + escapeHtml(r.address) + '</span>';
    if (r.phone) html += '<span>' + escapeHtml(r.phone) + '</span>';
    if (r.admin_email) html += '<span>' + escapeHtml(r.admin_email) + '</span>';
    html += '    </div>';
    html += '    <div class="restaurant-meta">';
    html += '      <span class="meta-chip">' + (r.user_count || 0) + ' users</span>';
    if (r.timezone) html += '<span class="meta-chip">' + r.timezone + '</span>';
    if (r.service_charge_percent != null) html += '<span class="meta-chip">' + r.service_charge_percent + '% SC</span>';
    if (r.is_customized && r.app_version) html += '<span class="meta-chip meta-chip-version">v' + escapeHtml(r.app_version) + '</span>';
    if (r.is_customized && r.custom_branch) html += '<span class="meta-chip meta-chip-branch">' + escapeHtml(r.custom_branch) + '</span>';
    html += '    </div>';
    if (r.is_customized && r.api_base_url) {
      html += '    <div class="user-card-meta" style="margin-top: 2px;"><span>' + escapeHtml(r.api_base_url) + '</span></div>';
    }
    html += '  </div>';
    html += '  <div class="user-card-actions">';
    html += '    <span style="color: #9ca3af; font-size: 18px;">›</span>';
    html += '  </div>';
    html += '</div>';
  }

  container.innerHTML = html;
}

// ============= TAB SWITCHING =============

function switchUsersTab(tabName) {
  document.querySelectorAll('.users-tab-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
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

// ============= SUBSCRIPTION MODAL =============

var subscriptionModalRestId = null;

function openSubscriptionModal(restId) {
  var r = restaurantsData.find(function(x) { return x.id === restId; });
  if (!r) return;
  subscriptionModalRestId = restId;

  document.getElementById('sub-modal-title').textContent = 'Subscription: ' + r.name;
  document.getElementById('sub-tier').value = r.subscription_tier || 'free';
  document.getElementById('sub-plan').value = r.subscription_plan || 'monthly';
  document.getElementById('sub-trial-end').value = r.subscription_trial_end ? r.subscription_trial_end.split('T')[0] : '';
  document.getElementById('sub-start-date').value = r.subscription_start_date ? r.subscription_start_date.split('T')[0] : '';
  document.getElementById('sub-end-date').value = r.subscription_end_date ? r.subscription_end_date.split('T')[0] : '';

  updateSubscriptionModalVisibility();
  document.getElementById('subscription-modal').style.display = 'flex';
  document.getElementById('sub-save-error').style.display = 'none';
}

function updateSubscriptionModalVisibility() {
  var tier = document.getElementById('sub-tier').value;
  document.getElementById('sub-trial-section').style.display = tier === 'trial' ? 'block' : 'none';
  document.getElementById('sub-premium-section').style.display = tier === 'premium' ? 'block' : 'none';
}

function closeSubscriptionModal() {
  document.getElementById('subscription-modal').style.display = 'none';
  subscriptionModalRestId = null;
}

async function saveSubscription() {
  if (!subscriptionModalRestId) return;
  var tier = document.getElementById('sub-tier').value;
  var body = { tier: tier };

  if (tier === 'trial') {
    var trialEnd = document.getElementById('sub-trial-end').value;
    if (trialEnd) body.trial_end_date = trialEnd;
  } else if (tier === 'premium') {
    body.plan = document.getElementById('sub-plan').value;
    var startDate = document.getElementById('sub-start-date').value;
    var endDate = document.getElementById('sub-end-date').value;
    if (startDate) body.start_date = startDate;
    if (endDate) body.end_date = endDate;
  }

  var errEl = document.getElementById('sub-save-error');
  try {
    var res = await fetch(API + '/restaurants/' + subscriptionModalRestId + '/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body)
    });
    var data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Failed to save subscription';
      errEl.style.display = 'block';
      return;
    }
    closeSubscriptionModal();
    await loadUsersManagement();
  } catch (err) {
    errEl.textContent = err.message || 'Network error';
    errEl.style.display = 'block';
  }
}

// ============= RESTAURANT DETAIL (inline-editable) =============

function updateDetailSubVisibility() {
  var tier = document.getElementById('rd-sub-tier');
  if (!tier) return;
  var t = tier.value;
  var trialSec = document.getElementById('rd-trial-section');
  var premSec = document.getElementById('rd-premium-section');
  if (trialSec) trialSec.style.display = t === 'trial' ? 'block' : 'none';
  if (premSec) premSec.style.display = t === 'premium' ? 'block' : 'none';
}

async function openRestaurantDetail(restId) {
  var rest = restaurantsData.find(function(r) { return r.id === restId; });
  if (!rest) return;

  var modal = document.getElementById('restaurant-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'restaurant-detail-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  // Subscription fields (from restaurantsData — returned by manage/restaurants)
  var tier = rest.subscription_tier || 'free';
  var trialEnd = rest.subscription_trial_end ? rest.subscription_trial_end.split('T')[0] : '';
  var subStart = rest.subscription_start_date ? rest.subscription_start_date.split('T')[0] : '';
  var subEnd = rest.subscription_end_date ? rest.subscription_end_date.split('T')[0] : '';
  var subPlan = rest.subscription_plan || 'monthly';

  var lbl = 'display:block;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;margin-bottom:6px;';
  var inp = 'width:100%;box-sizing:border-box;';

  // Subscription section (superadmin only)
  var subSectionHtml = '';
  if (IS_SUPERADMIN) {
    subSectionHtml =
      '<div class="detail-section">' +
        '<h4 class="detail-section-title">Subscription &amp; Plan</h4>' +
        '<div style="margin-bottom:14px;">' +
          '<label style="' + lbl + '">Tier</label>' +
          '<select id="rd-sub-tier" class="modal-input" style="' + inp + '" onchange="updateDetailSubVisibility()">' +
            '<option value="trial"' + (tier === 'trial' ? ' selected' : '') + '>Trial</option>' +
            '<option value="premium"' + (tier === 'premium' ? ' selected' : '') + '>Premium (Paid)</option>' +
            '<option value="free"' + (tier === 'free' ? ' selected' : '') + '>Free</option>' +
            '<option value="expired"' + (tier === 'expired' ? ' selected' : '') + '>Expired</option>' +
          '</select>' +
        '</div>' +
        '<div id="rd-trial-section" style="display:' + (tier === 'trial' ? 'block' : 'none') + ';">' +
          '<div style="margin-bottom:14px;">' +
            '<label style="' + lbl + '">Trial End Date</label>' +
            '<input type="date" id="rd-trial-end" class="modal-input" value="' + trialEnd + '" style="' + inp + '">' +
          '</div>' +
        '</div>' +
        '<div id="rd-premium-section" style="display:' + (tier === 'premium' ? 'block' : 'none') + ';">' +
          '<div style="margin-bottom:14px;">' +
            '<label style="' + lbl + '">Plan</label>' +
            '<select id="rd-sub-plan" class="modal-input" style="' + inp + '">' +
              '<option value="monthly"' + (subPlan === 'monthly' ? ' selected' : '') + '>Monthly</option>' +
              '<option value="annually"' + (subPlan === 'annually' ? ' selected' : '') + '>Annually</option>' +
            '</select>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">' +
            '<div><label style="' + lbl + '">Start Date</label><input type="date" id="rd-sub-start" class="modal-input" value="' + subStart + '" style="' + inp + '"></div>' +
            '<div><label style="' + lbl + '">End Date</label><input type="date" id="rd-sub-end" class="modal-input" value="' + subEnd + '" style="' + inp + '"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  var flagsSectionHtml = IS_SUPERADMIN ?
    '<div class="detail-section">' +
      '<h4 class="detail-section-title">Premium Features</h4>' +
      '<p style="font-size:12px;color:#6b7280;margin-bottom:12px;">Disabled modules are hidden from all users of this restaurant.</p>' +
      '<div id="restaurant-detail-flags"><p style="color:#9ca3af;text-align:center;">Loading...</p></div>' +
    '</div>' : '';

  var appsSectionHtml = IS_SUPERADMIN ?
    '<div class="detail-section">' +
      '<h4 class="detail-section-title">Payment Terminal Applications</h4>' +
      '<div id="restaurant-detail-applications"><p style="color:#9ca3af;text-align:center;padding:12px;">Loading...</p></div>' +
    '</div>' : '';

  var deleteBtn = IS_SUPERADMIN ?
    '<button class="btn-delete-user" style="padding:10px 16px;" onclick="deleteRestaurantFromDetail(' + restId + ', \'' + escapeHtml(rest.name) + '\')">Delete</button>' : '';

  modal.innerHTML =
    '<div class="modal-content restaurant-detail-content">' +
      '<div class="modal-header">' +
        '<h3>' + escapeHtml(rest.name) + '</h3>' +
        '<button class="modal-close" onclick="closeRestaurantDetail()">&#x2715;</button>' +
      '</div>' +
      '<div class="modal-body" id="restaurant-detail-body">' +
        '<div id="restaurant-detail-error" style="display:none;background:#fee2e2;color:#991b1b;padding:10px 14px;border-radius:6px;margin-bottom:16px;font-size:14px;"></div>' +
        '<div class="detail-section">' +
          '<h4 class="detail-section-title">Restaurant Information</h4>' +
          '<div style="margin-bottom:14px;">' +
            '<label style="' + lbl + '">Restaurant Name *</label>' +
            '<input type="text" id="rd-name" class="modal-input" value="' + escapeHtml(rest.name) + '" style="' + inp + '">' +
          '</div>' +
          '<div style="margin-bottom:14px;">' +
            '<label style="' + lbl + '">Address</label>' +
            '<input type="text" id="rd-address" class="modal-input" value="' + escapeHtml(rest.address || '') + '" style="' + inp + '">' +
          '</div>' +
          '<div style="margin-bottom:14px;">' +
            '<label style="' + lbl + '">Phone</label>' +
            '<input type="text" id="rd-phone" class="modal-input" value="' + escapeHtml(rest.phone || '') + '" style="' + inp + '">' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">' +
            '<div><label style="' + lbl + '">Service Charge %</label><input type="number" id="rd-sc" class="modal-input" value="' + (rest.service_charge_percent != null ? rest.service_charge_percent : 10) + '" min="0" max="100" step="0.5" style="' + inp + '"></div>' +
            '<div><label style="' + lbl + '">Language</label><select id="rd-lang" class="modal-input" style="' + inp + '"><option value="en"' + (rest.language_preference === 'en' ? ' selected' : '') + '>English</option><option value="zh"' + (rest.language_preference === 'zh' ? ' selected' : '') + '>Chinese</option></select></div>' +
          '</div>' +
          '<div style="margin-bottom:14px;">' +
            '<label style="' + lbl + '">Timezone</label>' +
            '<select id="rd-tz" class="modal-input" style="' + inp + '">' +
              ['Asia/Hong_Kong','Asia/Shanghai','Asia/Singapore','Asia/Tokyo','UTC'].map(function(tz) {
                return '<option value="' + tz + '"' + (rest.timezone === tz ? ' selected' : '') + '>' + tz + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +
        subSectionHtml +
        flagsSectionHtml +
        appsSectionHtml +
        '<div style="display:flex;gap:10px;padding-top:16px;border-top:1px solid var(--border-color);margin-top:8px;">' +
          deleteBtn +
          '<button class="btn-primary" style="flex:1;padding:10px;" onclick="saveRestaurantDetail(' + restId + ')">Save Changes</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  modal.style.display = 'flex';

  // Load feature flags and applications in parallel (superadmin)
  if (IS_SUPERADMIN) {
    var flagDefs = [
      { key: 'bookings',                label: 'Bookings',          desc: 'Table reservations module' },
      { key: 'waitlist',                label: 'Waitlist',          desc: 'Queue / walk-in waitlist' },
      { key: 'crm',                     label: 'CRM',               desc: 'Customer relationship management' },
      { key: 'coupons',                 label: 'Coupons',           desc: 'Discount coupons and promotions' },
      { key: 'service_requests',        label: 'Service Requests',  desc: 'Customer call-waiter / bill requests' },
      { key: 'allow_custom_food_items', label: 'Custom Food Items', desc: 'Staff can add free-text items to orders' },
      { key: 'xish',                    label: '✦ XISH Loyalty',    desc: 'National loyalty network — members earn points & tiered discounts' },
    ];

    var results = await Promise.allSettled([
      fetch(API + '/restaurants/' + restId + '/settings', { headers: { Authorization: 'Bearer ' + token } }),
      fetch(API + '/restaurants/' + restId + '/payment-terminal-applications', { headers: { Authorization: 'Bearer ' + token } }),
    ]);

    var flagsEl = document.getElementById('restaurant-detail-flags');
    if (results[0].status === 'fulfilled' && results[0].value.ok) {
      var settings = await results[0].value.json();
      var flags = settings.feature_flags || {};
      var flagsHtml = '';
      for (var fi = 0; fi < flagDefs.length; fi++) {
        var fd = flagDefs[fi];
        var isOn = flags[fd.key] !== false;
        flagsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;' + (fi < flagDefs.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : '') + '">';
        flagsHtml += '  <div><div style="font-size:13px;font-weight:600;color:#111827;">' + escapeHtml(fd.label) + '</div><div style="font-size:11px;color:#6b7280;margin-top:2px;">' + escapeHtml(fd.desc) + '</div></div>';
        flagsHtml += '  <label class="toggle-switch" style="flex-shrink:0;margin-left:12px;"><input type="checkbox" ' + (isOn ? 'checked' : '') + ' onchange="toggleRestaurantFlag(' + restId + ', \'' + fd.key + '\', this.checked)"><span class="toggle-slider"></span></label>';
        flagsHtml += '</div>';
      }
      if (flagsEl) flagsEl.innerHTML = flagsHtml;
    } else {
      if (flagsEl) flagsEl.innerHTML = '<p style="color:#ef4444;text-align:center;">Failed to load feature flags</p>';
    }

    var appsEl = document.getElementById('restaurant-detail-applications');
    if (results[1].status === 'fulfilled' && results[1].value.ok) {
      var apps = await results[1].value.json();
      renderRestaurantApplications(apps);
    } else {
      if (appsEl) appsEl.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:12px;">No applications submitted</p>';
    }
  }
}

async function saveRestaurantDetail(restId) {
  var errEl = document.getElementById('restaurant-detail-error');
  if (errEl) errEl.style.display = 'none';

  var name = (document.getElementById('rd-name').value || '').trim();
  if (!name) {
    if (errEl) { errEl.textContent = 'Restaurant name is required'; errEl.style.display = 'block'; }
    return;
  }

  var payload = {
    name: name,
    address: (document.getElementById('rd-address').value || '').trim() || undefined,
    phone: (document.getElementById('rd-phone').value || '').trim() || undefined,
    service_charge_percent: parseFloat(document.getElementById('rd-sc').value) || 0,
    timezone: document.getElementById('rd-tz').value,
    language_preference: document.getElementById('rd-lang').value,
  };

  try {
    var res = await fetch(API + '/manage/restaurants/' + restId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      var data = await res.json();
      if (errEl) { errEl.textContent = data.error || 'Failed to save'; errEl.style.display = 'block'; }
      return;
    }
  } catch (err) {
    if (errEl) { errEl.textContent = err.message || 'Network error'; errEl.style.display = 'block'; }
    return;
  }

  // Save subscription if superadmin
  if (IS_SUPERADMIN) {
    var tierEl = document.getElementById('rd-sub-tier');
    if (tierEl) {
      var tier = tierEl.value;
      var subBody = { tier: tier };
      if (tier === 'trial') {
        var te = document.getElementById('rd-trial-end');
        if (te && te.value) subBody.trial_end_date = te.value;
      } else if (tier === 'premium') {
        var planEl = document.getElementById('rd-sub-plan');
        var ssEl = document.getElementById('rd-sub-start');
        var seEl = document.getElementById('rd-sub-end');
        if (planEl) subBody.plan = planEl.value;
        if (ssEl && ssEl.value) subBody.start_date = ssEl.value;
        if (seEl && seEl.value) subBody.end_date = seEl.value;
      }
      try {
        var subRes = await fetch(API + '/restaurants/' + restId + '/subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify(subBody),
        });
        if (!subRes.ok) {
          var subData = await subRes.json();
          if (errEl) { errEl.textContent = subData.error || 'Failed to save subscription'; errEl.style.display = 'block'; }
          return;
        }
      } catch (err) {
        if (errEl) { errEl.textContent = err.message || 'Network error'; errEl.style.display = 'block'; }
        return;
      }
    }
  }

  closeRestaurantDetail();
  await loadUsersManagement();
}

async function deleteRestaurantFromDetail(restId, restName) {
  if (!confirm('Delete restaurant "' + restName + '"? All users must be removed first.')) return;
  closeRestaurantDetail();
  try {
    var res = await fetch(API + '/manage/restaurants/' + restId, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
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
