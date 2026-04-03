/**
 * QR Code Scanner for Staff Portal
 * Allows staff to scan table QR codes and quickly access session orders
 */

let QR_SCANNER_INSTANCE = null;
let SCAN_IN_PROGRESS = false;
let SCANNER_RUNNING = false; // Track if scanner is actively running

/**
 * Open the QR scanner modal and start scanning
 */
async function openScanQRModal() {
  const modal = document.getElementById("scan-qr-modal");
  if (!modal) {
    console.error("QR scanner modal not found");
    return;
  }

  modal.classList.remove("hidden");
  modal.classList.add("active");

  // Start scanning immediately (minimal delay for DOM rendering)
  setTimeout(() => {
    console.log("📱 Opening QR scanner modal, requesting camera permissions now...");
    startQRScanning();
  }, 50);
}

/**
 * Close the QR scanner modal and stop scanning
 */
function closeScanQRModal() {
  const modal = document.getElementById("scan-qr-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("active");
  }

  // Stop the scanner only if it's actually running
  if (QR_SCANNER_INSTANCE && SCANNER_RUNNING) {
    SCANNER_RUNNING = false;
    try {
      QR_SCANNER_INSTANCE.stop()
        .then(() => {
          console.log("✅ Scanner stopped");
          QR_SCANNER_INSTANCE = null;
          SCAN_IN_PROGRESS = false;
        })
        .catch(err => {
          console.warn("⚠️ Scanner was already stopped:", err.message);
          QR_SCANNER_INSTANCE = null;
          SCAN_IN_PROGRESS = false;
        });
    } catch (err) {
      console.warn("⚠️ Error stopping scanner:", err.message);
      QR_SCANNER_INSTANCE = null;
      SCAN_IN_PROGRESS = false;
    }
  } else {
    // Scanner not running, just clean up
    QR_SCANNER_INSTANCE = null;
    SCAN_IN_PROGRESS = false;
    SCANNER_RUNNING = false;
  }
}

/**
 * Start the QR code scanner - directly with camera (no UI dialog)
 */
async function startQRScanning() {
  if (SCAN_IN_PROGRESS) {
    console.warn("Scan already in progress");
    return;
  }

  // Wait for html5-qrcode library to load (with retry)
  let retries = 0;
  while (typeof Html5Qrcode === "undefined" && retries < 20) {
    console.warn(`Waiting for html5-qrcode library... (attempt ${retries + 1}/20)`);
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }

  // Debug: log what's available in window
  if (typeof Html5Qrcode === "undefined") {
    console.error("Html5Qrcode not found. Window keys containing 'qrcode':", 
      Object.keys(window).filter(k => k.toLowerCase().includes('qrcode')));
    showQRScannerError("QR code scanner library not loaded. Please refresh the page.");
    console.error("html5-qrcode library not loaded after retries");
    return;
  }

  try {
    SCAN_IN_PROGRESS = true;
    showQRScannerLoading(true);
    hideQRScannerError();

    // Step 1: Create scanner instance
    // Clean up any existing instance from a previous attempt
    if (QR_SCANNER_INSTANCE) {
      try { await QR_SCANNER_INSTANCE.clear(); } catch (e) {}
      QR_SCANNER_INSTANCE = null;
    }
    const qrReaderEl = document.getElementById('qr-reader');
    if (qrReaderEl) qrReaderEl.innerHTML = '';
    QR_SCANNER_INSTANCE = new Html5Qrcode("qr-reader", { 
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
      ]
    });

    // Step 2: Start scanning using ideal rear camera (environment).
    // Using facingMode avoids a separate getCameras() call that internally
    // triggers its own getUserMedia request before start() makes another one,
    // which caused duplicate permission prompts and a second NotAllowedError.
    // { ideal: "environment" } falls back to any available camera on desktop.
    console.log("▶️ Starting camera stream...");
    await QR_SCANNER_INSTANCE.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      },
      onQRScanSuccess,
      onQRScanError
    );

    SCANNER_RUNNING = true; // Mark scanner as actively running
    showQRScannerLoading(false);
    console.log("✅ Camera scanning started");
  } catch (err) {
    SCAN_IN_PROGRESS = false;
    SCANNER_RUNNING = false;
    showQRScannerLoading(false);
    
    // Better error message for various QR scanner failures
    let errorMsg = err?.message || String(err) || "Unknown error";
    
    if (typeof errorMsg === "string") {
      if (errorMsg.includes("NotAllowedError") || errorMsg.includes("Permission denied") || errorMsg.includes("previously denied")) {
        const ua = navigator.userAgent;
        const isIOS = /iPhone|iPad|iPod/.test(ua);
        const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
        const isFirefox = /Firefox/.test(ua);

        if (isIOS && isSafari) {
          errorMsg = "📵 Camera blocked on this site.\n\n1. Open the iOS Settings app\n2. Go to Safari → Camera\n3. Set to Allow\n4. Come back and tap 'Reload Page'";
        } else if (isIOS) {
          errorMsg = "📵 Camera blocked on this site.\n\n1. Open the iOS Settings app\n2. Find your browser → Camera\n3. Set to Allow\n4. Come back and tap 'Reload Page'";
        } else if (isFirefox) {
          errorMsg = "📵 Camera blocked on this site.\n\n1. Click the 🔒 lock icon in the address bar\n2. Click the Camera permission → Allow\n3. Tap 'Reload Page' below";
        } else {
          // Chrome, Edge, and other Chromium browsers
          errorMsg = "📵 Camera blocked on this site.\n\n1. Click the 🔒 or 📷 icon in the address bar\n2. Set Camera to 'Allow'\n3. Tap 'Reload Page' below";
        }
      } else if (errorMsg.includes("NotFoundError") || errorMsg.includes("No camera")) {
        errorMsg = "📷 No camera device found. Ensure your device has a camera and it's not in use by another app.";
      } else if (errorMsg.includes("NotReadableError")) {
        errorMsg = "⚠️ Camera is in use or not readable. Close other apps using the camera and try again.";
      } else if (errorMsg.includes("secure context") || 
                errorMsg.includes("https") || 
                errorMsg.includes("localhost")) {
        const currentHost = window.location.hostname;
        const protocol = window.location.protocol;
        
        if (protocol === "http:" && !currentHost.includes("localhost") && !currentHost.includes("127.0.0.1")) {
          errorMsg = `⚠️ Camera requires HTTPS. Access via https://${currentHost}:10000`;
        } else {
          errorMsg = "⚠️ Camera access requires secure connection (HTTPS). Try on localhost or enable HTTPS.";
        }
      }
    }
    
    showQRScannerError("Failed to start camera: " + errorMsg);
    console.error("❌ Error starting QR scanner:", err);
  }
}

/**
 * Callback when QR code is successfully scanned
 */
async function onQRScanSuccess(decodedText, decodedResult) {
  console.log("✅ QR code scanned:", decodedText);

  if (!SCAN_IN_PROGRESS) return;
  SCAN_IN_PROGRESS = false;
  SCANNER_RUNNING = false;

  // Stop the scanner
  if (QR_SCANNER_INSTANCE) {
    try {
      await QR_SCANNER_INSTANCE.stop();
      console.log("✅ Scanner stopped after scan");
    } catch (err) {
      console.warn("⚠️ Error stopping scanner:", err.message);
    }
  }

  // Process the scanned QR token
  await processQRScan(decodedText);
}

/**
 * Callback for QR scanner errors
 */
function onQRScanError(error) {
  // Ignore errors - scanner will keep trying
  // console.warn("QR scan attempt:", error);
}

/**
 * Process the scanned QR code by calling backend /scan endpoint
 */
async function processQRScan(qrToken) {
  try {
    showQRScannerLoading(true);
    hideQRScannerError();

    // Extract token from QR code
    // If QR contains a full URL (e.g., http://localhost:10000/40aabd8ce...), extract just the token part
    let token = qrToken;
    
    if (qrToken.includes("/")) {
      // It's a URL - extract the last segment (the actual token)
      const parts = qrToken.split("/");
      token = parts[parts.length - 1];
      console.log("🔍 Extracted token from QR URL:", token);
    } else {
      console.log("🔍 QR token (direct):", token);
    }

    // Validate token is not empty
    if (!token || token.trim().length === 0) {
      showQRScannerError("Invalid QR code - no token found");
      showQRScannerLoading(false);
      return;
    }

    // Call backend to get session info
    const response = await fetch(`${API}/scan/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const error = await response.text();
      let errorMsg = "Invalid QR code";
      
      try {
        const jsonError = JSON.parse(error);
        errorMsg = jsonError.error || errorMsg;
      } catch (e) {
        // If response isn't JSON, use text
        errorMsg = error.includes("404") ? "QR code not found or expired" : "Invalid QR code";
      }
      
      showQRScannerError(errorMsg);
      showQRScannerLoading(false);
      return;
    }

    const data = await response.json();
    console.log("📍 Scan result:", data);
    console.log("📍 Session ID:", data.session_id);
    console.log("📍 Table name:", data.table_name);

    // Close the scanner modal
    closeScanQRModal();

    // If there's an active session, open it
    if (data.session_id) {
      console.log("📋 Opening session:", data.session_id);
      
      // Switch to tables section - this load tables data
      console.log("🔀 Switching to tables section...");
      if (typeof switchSection === 'function') {
        await switchSection("tables");
        console.log("✅ Switched to tables section");
      } else {
        console.warn("⚠️ switchSection not found");
      }

      // Wait for TABLES data to be populated, with retry logic
      let retries = 0;
      const waitForTables = setInterval(() => {
        retries++;
        console.log(`⏳ Waiting for TABLES data... (attempt ${retries})`);
        
        if (typeof TABLES !== 'undefined' && TABLES && TABLES.length > 0) {
          clearInterval(waitForTables);
          console.log("✅ TABLES data is ready with", TABLES.length, "tables");
          
          // Now open the session
          console.log("📋 Attempting to open session", data.session_id);
          if (typeof handleSessionClick === 'function') {
            const session = findSessionById(data.session_id);
            if (session) {
              console.log("✅ Session found:", session);
              handleSessionClick(data.session_id);
              console.log("✅ Session panel opened successfully");
            } else {
              console.error("❌ Session not found with ID:", data.session_id);
              console.log("Available sessions:", TABLES.flatMap(t => t.sessions.map(s => s.id)));
            }
          } else {
            console.error("❌ handleSessionClick is not a function!");
          }
        } else {
          if (retries > 20) {
            clearInterval(waitForTables);
            console.error("❌ TABLES data not ready after 20 attempts");
            showQRScannerError("Could not load table data. Please try again.");
          }
        }
      }, 100);
    } else {
      // No active session - show the table options to start one
      console.log("⚠️ No active session found for this table");
      showQRScannerError(data.table_name + " has no active session. Start a new session from the tables view.");
      showQRScannerLoading(false);
      
      // Re-enable scanning after error
      setTimeout(() => {
        if (document.getElementById("scan-qr-modal").classList.contains("active")) {
          startQRScanning();
        }
      }, 2000);
    }
  } catch (err) {
    showQRScannerError("Failed to process QR: " + err.message);
    showQRScannerLoading(false);
    console.error("Error processing QR scan:", err);

    // Re-enable scanning after error
    setTimeout(() => {
      if (document.getElementById("scan-qr-modal").classList.contains("active")) {
        startQRScanning();
      }
    }, 2000);
  }
}

/**
 * Show error message in scanner
 */
function showQRScannerError(message) {
  const errorEl = document.getElementById("qr-scanner-error");
  const retryBtn = document.getElementById("qr-scanner-retry");
  
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
    
    // Show retry button for permission or recoverable errors
    if (retryBtn && (message.toLowerCase().includes("permission") || message.includes("Allow") || message.includes("Retry") || message.includes("denied"))) {
      retryBtn.classList.remove("hidden");
    }
  }
}

/**
 * Hide error message in scanner
 */
function hideQRScannerError() {
  const errorEl = document.getElementById("qr-scanner-error");
  const retryBtn = document.getElementById("qr-scanner-retry");
  
  if (errorEl) {
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
  }
  
  if (retryBtn) {
    retryBtn.classList.add("hidden");
  }
}

/**
 * Show/hide loading indicator in scanner
 */
function showQRScannerLoading(show) {
  const loadingEl = document.getElementById("qr-scanner-loading");
  if (loadingEl) {
    if (show) {
      loadingEl.classList.remove("hidden");
    } else {
      loadingEl.classList.add("hidden");
    }
  }
}

/**
 * Show the scan QR button in the header
 */
function showScanQRButton() {
  const btn = document.getElementById("scan-qr-btn");
  if (btn) {
    btn.style.display = "inline-block";
  }
}

/**
 * Hide the scan QR button in the header
 */
function hideScanQRButton() {
  const btn = document.getElementById("scan-qr-btn");
  if (btn) {
    btn.style.display = "none";
  }
}
