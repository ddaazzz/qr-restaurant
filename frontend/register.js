const API_BASE = window.location.origin;

let currentStep = 0;
let registeredEmail = '';
let registeredPassword = '';
let resendCountdown = null;

// ---- Step navigation ----
function showStep(step) {
  document.querySelectorAll('.step-section').forEach(function(el) { el.classList.remove('active'); });
  var stepEl = document.getElementById('step-' + step);
  if (stepEl) stepEl.classList.add('active');
  if (step === 'success') {
    document.getElementById('success-section').classList.add('active');
    document.getElementById('login-link-row').style.display = 'none';
  }

  // Update dots
  for (var i = 0; i < 3; i++) {
    var dot = document.getElementById('dot-' + i);
    dot.classList.remove('active', 'done');
    if (i < step) dot.classList.add('done');
    else if (i === step) dot.classList.add('active');
  }
  currentStep = step;
  hideError();
}

function showError(msg) {
  var el = document.getElementById('error');
  el.innerText = msg;
  el.style.display = 'block';
}

function hideError() {
  var el = document.getElementById('error');
  el.innerText = '';
  el.style.display = 'none';
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  if (loading) btn.classList.add('loading');
  else btn.classList.remove('loading');
}

// ---- Step 0: Send verification code ----
document.getElementById('btn-send-code').addEventListener('click', async function() {
  var email = document.getElementById('reg-email').value.trim();
  var password = document.getElementById('reg-password').value;
  var confirmPassword = document.getElementById('reg-confirm-password').value;

  if (!email || !email.includes('@')) {
    showError('Please enter a valid email address');
    return;
  }
  if (password.length < 8) {
    showError('Password must be at least 8 characters');
    return;
  }
  if (password !== confirmPassword) {
    showError('Passwords do not match');
    return;
  }

  var btn = this;
  setLoading(btn, true);
  try {
    var res = await fetch(API_BASE + '/api/auth/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    });
    var data = await res.json();
    if (!res.ok) {
      showError(data.error || 'Failed to send code');
      return;
    }
    registeredEmail = email;
    registeredPassword = password;
    document.getElementById('verify-email-display').textContent = email;
    showStep(1);
    startResendTimer();
    // Focus first code input
    document.querySelector('.code-digit[data-index="0"]').focus();
  } catch (err) {
    showError('Network error. Please try again.');
  } finally {
    setLoading(btn, false);
  }
});

// ---- Step 1: Verify code ----
// Auto-advance code inputs
document.querySelectorAll('.code-digit').forEach(function(input) {
  input.addEventListener('input', function(e) {
    var val = e.target.value.replace(/\D/g, '');
    e.target.value = val;
    if (val && e.target.dataset.index < 5) {
      var next = document.querySelector('.code-digit[data-index="' + (parseInt(e.target.dataset.index) + 1) + '"]');
      if (next) next.focus();
    }
  });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Backspace' && !e.target.value && e.target.dataset.index > 0) {
      var prev = document.querySelector('.code-digit[data-index="' + (parseInt(e.target.dataset.index) - 1) + '"]');
      if (prev) { prev.focus(); prev.value = ''; }
    }
  });
  // Handle paste
  input.addEventListener('paste', function(e) {
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
    for (var i = 0; i < text.length; i++) {
      var digit = document.querySelector('.code-digit[data-index="' + i + '"]');
      if (digit) digit.value = text[i];
    }
    var lastIdx = Math.min(text.length, 5);
    document.querySelector('.code-digit[data-index="' + lastIdx + '"]').focus();
  });
});

document.getElementById('btn-verify-code').addEventListener('click', async function() {
  var code = '';
  document.querySelectorAll('.code-digit').forEach(function(d) { code += d.value; });
  if (code.length !== 6) {
    showError('Please enter the full 6-digit code');
    return;
  }

  var btn = this;
  setLoading(btn, true);
  try {
    var res = await fetch(API_BASE + '/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: registeredEmail, code: code })
    });
    var data = await res.json();
    if (!res.ok) {
      showError(data.error || 'Invalid code');
      return;
    }
    showStep(2);
  } catch (err) {
    showError('Network error. Please try again.');
  } finally {
    setLoading(btn, false);
  }
});

document.getElementById('btn-back-to-email').addEventListener('click', function() {
  showStep(0);
});

function startResendTimer() {
  var seconds = 60;
  var timerEl = document.getElementById('resend-timer');
  var btnResend = document.getElementById('btn-resend');
  btnResend.disabled = true;
  btnResend.innerHTML = 'Resend code in <span id="resend-timer">' + seconds + '</span>s';
  timerEl = document.getElementById('resend-timer');

  if (resendCountdown) clearInterval(resendCountdown);
  resendCountdown = setInterval(function() {
    seconds--;
    if (timerEl) timerEl.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(resendCountdown);
      btnResend.disabled = false;
      btnResend.textContent = 'Resend code';
    }
  }, 1000);
}

document.getElementById('btn-resend').addEventListener('click', async function() {
  var btn = this;
  btn.disabled = true;
  try {
    await fetch(API_BASE + '/api/auth/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: registeredEmail })
    });
    startResendTimer();
  } catch (err) {
    btn.disabled = false;
  }
});

// ---- Step 2: Create restaurant ----
document.getElementById('btn-create-restaurant').addEventListener('click', async function() {
  var name = document.getElementById('reg-restaurant-name').value.trim();
  if (!name) {
    showError('Restaurant name is required');
    return;
  }

  var btn = this;
  setLoading(btn, true);
  try {
    var res = await fetch(API_BASE + '/api/auth/register-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: registeredEmail,
        password: registeredPassword,
        restaurant_name: name,
        address: document.getElementById('reg-address').value.trim() || undefined,
        phone: document.getElementById('reg-phone').value.trim() || undefined,
        timezone: document.getElementById('reg-timezone').value,
      })
    });
    var data = await res.json();
    if (!res.ok) {
      showError(data.error || 'Registration failed');
      return;
    }

    // Store auth
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', data.role);
    localStorage.setItem('restaurantId', data.restaurantId);
    localStorage.setItem('userId', data.userId || '');
    sessionStorage.setItem('restaurantId', data.restaurantId);

    showStep('success');
  } catch (err) {
    showError('Network error. Please try again.');
  } finally {
    setLoading(btn, false);
  }
});

// ---- Success: Go to dashboard ----
document.getElementById('btn-go-dashboard').addEventListener('click', function() {
  window.location.href = '/admin.html';
});
