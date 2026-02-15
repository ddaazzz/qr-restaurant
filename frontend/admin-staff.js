// ============= STAFF MODULE =============

let STAFF_EDIT_MODE = false;
let STAFF_EDIT_ID = null; // Track which staff is being edited
// MENU_CATEGORIES is declared globally in admin.js

async function loadStaff() {
  if (!adminOnly("MANAGE_STAFF")) return;

  // Load menu categories for kitchen role
  await loadMenuCategories();

  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/staff`);
    if (!res.ok) throw new Error('Failed to load staff');
    
    const staff = await res.json();

    const container = document.getElementById("staff-grid");
    if (!container) {
      console.error("staff-grid container not found");
      return;
    }
    
    container.innerHTML = "";

    if (!staff || staff.length === 0) {
      container.innerHTML = "<p style='color: var(--text-light); grid-column: 1/-1;'>No staff members yet</p>";
      return;
    }

    // Render staff as cards
    staff.forEach(s => {
      const roleLabel = s.role === 'kitchen' ? 'Kitchen' : 'Staff';
      const roleColor = s.role === 'kitchen' ? '#ff6b6b' : '#3b82f6';
      
      // Format access rights display
      let accessDisplay = '';
      if (s.access_rights) {
        try {
          const rights = typeof s.access_rights === 'string' ? JSON.parse(s.access_rights) : s.access_rights;
          if (Array.isArray(rights)) {
            accessDisplay = rights.join(', ');
          }
        } catch (e) {
          accessDisplay = '';
        }
      }
      
      const card = document.createElement('div');
      card.className = 'staff-card';
      card.innerHTML = `
        <div class="staff-card-name">${s.name}</div>
        <div class="staff-card-role" style="background: ${roleColor}20; color: ${roleColor}; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 12px; margin-bottom: 8px;">${roleLabel}</div>
        <div class="staff-card-pin">PIN: ${s.pin || '-'}</div>
        ${accessDisplay ? `<div class="staff-card-access">${accessDisplay}</div>` : ''}
        <div class="staff-card-actions" style="display: ${STAFF_EDIT_MODE ? 'flex' : 'none'};">
          <button class="btn-edit" onclick="editStaff(${s.id}, event)">✏️ Edit</button>
          <button class="btn-delete" onclick="deleteStaff(${s.id}, event)">🗑 Delete</button>
        </div>
      `;
      container.appendChild(card);
    });

    // Add the "Add Staff" card at the end
    const addStaffCard = document.createElement('div');
    addStaffCard.id = 'add-staff-card';
    addStaffCard.className = 'staff-card add-staff-card-style';
    if (!STAFF_EDIT_MODE) {
      addStaffCard.classList.add('hidden');
    }
    addStaffCard.onclick = () => openStaffForm();
    addStaffCard.innerHTML = `
      <div style="font-size: 40px; margin-bottom: 8px;">➕</div>
      <div class="staff-card-name">Add Staff</div>
    `;
    container.appendChild(addStaffCard);
  } catch (err) {
    console.error("Error loading staff:", err);
    const container = document.getElementById("staff-grid");
    if (container) {
      container.innerHTML = `<p style="color: #ef4444; grid-column: 1/-1;">Error loading staff</p>`;
    }
  }
}

function toggleStaffEditMode(section) {
  // Only allow edit mode when staff section is active
  if (section !== 'staff') {
    return;
  }
  
  STAFF_EDIT_MODE = !STAFF_EDIT_MODE;
  document.body.classList.toggle("edit-mode");
  
  const editBtn = document.getElementById("staff-edit-btn");
  const staffCards = document.querySelectorAll('.staff-card:not(#add-staff-card)');
  const addStaffCard = document.getElementById('add-staff-card');
  
  // Update button text
  if (editBtn) {
    if (STAFF_EDIT_MODE) {
      editBtn.innerHTML = '<img src="/uploads/website/pencil.png" alt="edit" class="btn-icon"> Done';
      editBtn.classList.add("active");
    } else {
      editBtn.innerHTML = '<img src="/uploads/website/pencil.png" alt="edit" class="btn-icon"> Edit';
      editBtn.classList.remove("active");
    }
  }
  
  // Show/hide Add Staff card based on edit mode
  if (addStaffCard) {
    if (STAFF_EDIT_MODE) {
      addStaffCard.classList.remove('hidden');
    } else {
      addStaffCard.classList.add('hidden');
    }
  }
  
  // Show/hide edit/delete buttons on all cards
  staffCards.forEach(card => {
    const actions = card.querySelector('.staff-card-actions');
    if (actions) {
      actions.style.display = STAFF_EDIT_MODE ? 'flex' : 'none';
    }
  });
}

async function loadMenuCategories() {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/menu_categories`);
    if (res.ok) {
      MENU_CATEGORIES = await res.json();
      populateKitchenCategories();
    }
  } catch (err) {
    console.error("Error loading categories:", err);
  }
}

function populateKitchenCategories() {
  const container = document.getElementById("kitchen-categories-list");
  if (!container) return;
  
  container.innerHTML = "";
  MENU_CATEGORIES.forEach(cat => {
    const label = document.createElement("label");
    label.style.cssText = "display: flex; align-items: center; gap: 8px; cursor: pointer;";
    label.innerHTML = `
      <input type="checkbox" class="kitchen-category-checkbox" value="${cat.id}" />
      ${cat.name}
    `;
    container.appendChild(label);
  });
}

function handleStaffRoleChange() {
  const role = document.getElementById("staff-role").value;
  const tabAccessDiv = document.getElementById("staff-tab-access");
  const categoryAccessDiv = document.getElementById("kitchen-category-access");
  
  if (role === "staff") {
    tabAccessDiv.style.display = "block";
    categoryAccessDiv.style.display = "none";
  } else if (role === "kitchen") {
    tabAccessDiv.style.display = "none";
    categoryAccessDiv.style.display = "block";
  }
}

function resetStaffForm() {
  document.getElementById("staff-name").value = "";
  document.getElementById("staff-pin").value = "";
  document.getElementById("staff-role").value = "";
  document.getElementById("staff-error").style.display = "none";
  document.getElementById("staff-success").style.display = "none";
  document.getElementById("staff-submit-btn").textContent = "➕ Add Staff";
  
  // Clear checkboxes
  document.querySelectorAll(".staff-access-checkbox, .kitchen-category-checkbox").forEach(cb => {
    cb.checked = false;
  });
  
  // Hide both access sections
  document.getElementById("staff-tab-access").style.display = "none";
  document.getElementById("kitchen-category-access").style.display = "none";
  
  STAFF_EDIT_ID = null;
}

async function editStaff(staffId, event) {
  if (event) event.stopPropagation();
  if (!STAFF_EDIT_MODE) return;
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/staff/${staffId}`);
    if (!res.ok) throw new Error("Failed to load staff");
    
    const staff = await res.json();
    
    // Populate form
    document.getElementById("staff-name").value = staff.name;
    document.getElementById("staff-pin").value = staff.pin || "";
    document.getElementById("staff-role").value = staff.role || "staff";
    document.getElementById("staff-submit-btn").textContent = "💾 Update";
    
    // Clear all checkboxes first
    document.querySelectorAll(".staff-access-checkbox, .kitchen-category-checkbox").forEach(cb => {
      cb.checked = false;
    });
    
    // Populate access rights based on role
    if (staff.role === "staff" && staff.access_rights) {
      const tabs = typeof staff.access_rights === 'string' ? JSON.parse(staff.access_rights) : staff.access_rights;
      if (Array.isArray(tabs)) {
        tabs.forEach(tab => {
          const checkbox = document.getElementById(`access-${tab}`);
          if (checkbox) checkbox.checked = true;
        });
      }
    } else if (staff.role === "kitchen" && staff.access_rights) {
      const categories = typeof staff.access_rights === 'string' ? JSON.parse(staff.access_rights) : staff.access_rights;
      if (Array.isArray(categories)) {
        categories.forEach(catId => {
          const checkbox = document.querySelector(`.kitchen-category-checkbox[value="${catId}"]`);
          if (checkbox) checkbox.checked = true;
        });
      }
    }
    
    // Update display
    handleStaffRoleChange();
    STAFF_EDIT_ID = staffId;
    
    // Set title and open panel
    const title = document.getElementById("staff-form-title");
    if (title) title.textContent = "Edit Staff";
    openStaffForm();
    
  } catch (err) {
    console.error("Error loading staff:", err);
    alert("Error loading staff: " + err.message);
  }
}

async function createOrUpdateStaff() {
  const errorEl = document.getElementById("staff-error");
  const successEl = document.getElementById("staff-success");
  errorEl.style.display = "none";
  successEl.style.display = "none";

  const name = document.getElementById("staff-name").value.trim();
  const pin = document.getElementById("staff-pin").value.trim();
  const role = document.getElementById("staff-role").value;

  if (!name || !pin) {
    errorEl.textContent = "Name and PIN are required";
    errorEl.style.display = "flex";
    return;
  }

  if (pin.length !== 6 || isNaN(pin)) {
    errorEl.textContent = "PIN must be exactly 6 digits";
    errorEl.style.display = "flex";
    return;
  }

  // Collect access rights based on role
  let access_rights = [];
  if (role === "staff") {
    document.querySelectorAll(".staff-access-checkbox:checked").forEach(cb => {
      access_rights.push(cb.value);
    });
  } else if (role === "kitchen") {
    document.querySelectorAll(".kitchen-category-checkbox:checked").forEach(cb => {
      access_rights.push(parseInt(cb.value));
    });
  }

  try {
    const payload = { name, pin, role, access_rights };
    
    const url = STAFF_EDIT_ID 
      ? `${API}/restaurants/${restaurantId}/staff/${STAFF_EDIT_ID}`
      : `${API}/restaurants/${restaurantId}/staff`;
    
    const method = STAFF_EDIT_ID ? "PATCH" : "POST";
    
    const res = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || `Failed to ${STAFF_EDIT_ID ? 'update' : 'create'} staff`;
      errorEl.style.display = "flex";
      return;
    }

    // Success
    const actionText = STAFF_EDIT_ID ? 'updated' : 'created';
    successEl.textContent = `Staff member ${actionText} successfully`;
    successEl.style.display = "flex";
    
    setTimeout(() => {
      successEl.style.display = "none";
      closeStaffForm();
    }, 1500);

    resetStaffForm();
    loadStaff();
    
  } catch (err) {
    console.error("Error:", err);
    errorEl.textContent = "Network error: " + (err.message || "Operation failed");
    errorEl.style.display = "flex";
  }
}

async function deleteStaff(staffId, event) {
  if (event) event.stopPropagation();
  if (!STAFF_EDIT_MODE) return;

  if (!confirm("Delete this staff member?")) return;

  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/staff/${staffId}`, { 
      method: "DELETE" 
    });
    
    if (!res.ok) {
      const error = await res.json();
      alert(error.error || "Failed to delete staff");
      return;
    }

    const successEl = document.getElementById("staff-success");
    if (successEl) {
      successEl.textContent = "Staff member deleted";
      successEl.style.display = "flex";
      setTimeout(() => {
        successEl.style.display = "none";
      }, 3000);
    }

    loadStaff();
  } catch (err) {
    console.error(err);
    alert("Error: " + (err.message || "Failed to delete staff"));
  }
}
function openStaffForm() {
  const panel = document.getElementById("staff-form-panel");
  const overlay = document.getElementById("staff-form-overlay");
  if (!panel || !overlay) {
    console.error("Staff form panel or overlay not found");
    return;
  }
  
  // Only reset if not editing
  if (!STAFF_EDIT_ID) {
    const title = document.getElementById("staff-form-title");
    if (title) {
      title.textContent = "Create New Staff";
    }
    resetStaffForm();
  }
  
  panel.classList.remove("hidden");
  overlay.classList.remove("hidden");
  
  // Focus on first input
  setTimeout(() => {
    const nameInput = document.getElementById("staff-name");
    if (nameInput) nameInput.focus();
  }, 100);
}

function closeStaffForm() {
  const panel = document.getElementById("staff-form-panel");
  const overlay = document.getElementById("staff-form-overlay");
  if (!panel || !overlay) return;
  
  panel.classList.add("hidden");
  overlay.classList.add("hidden");
  STAFF_EDIT_ID = null;
  resetStaffForm();
}