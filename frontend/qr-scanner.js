/**
 * QR Code Scanner for Staff Portal
 * Allows staff to scan table QR codes and quickly access session orders
 */

let QR_SCANNER_INSTANCE = null;
let SCAN_IN_PROGRESS = false;

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

  // Small delay to ensure modal is rendered before starting camera
  setTimeout(() => {
    startQRScanning();
  }, 100);
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

  // Stop the scanner
  if (QR_SCANNER_INSTANCE) {
    try {
      QR_SCANNER_INSTANCE.stop().then(() => {
        QR_SCANNER_INSTANCE.clear();
        QR_SCANNER_INSTANCE = null;
      }).catch(err => {
        console.error("Error stopping QR scanner:", err);
        QR_SCANNER_INSTANCE = null;
      });
    } catch (err) {
      console.error("Error closing QR scanner:", err);
      QR_SCANNER_INSTANCE = null;
    }
  }

  SCAN_IN_PROGRESS = false;
}

/**
 * Start the QR code scanner
 */
async function startQRScanning() {
  if (SCAN_IN_PROGRESS) {
    console.warn("Scan already in progress");
    return;
  }

  // Check if html5-qrcode library is loaded (UMD version attaches to window)
  var Html5QrcodeScannerGlobal = typeof Html5QrcodeScanner !== "undefined" ? Html5QrcodeScanner : (window && window.Html5QrcodeScanner);
  if (!Html5QrcodeScannerGlobal) {
    showQRScannerError("QR code scanner library not loaded. Please refresh the page.");
    console.error("html5-qrcode library not loaded");
    return;
  }

  try {
    SCAN_IN_PROGRESS = true;
    showQRScannerLoading(true);
    hideQRScannerError();

    // Create scanner instance
    QR_SCANNER_INSTANCE = new Html5QrcodeScannerGlobal(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
        supportedScanTypes: ["SCAN_TYPE_CAMERA"],
      },
      false
    );

    // Set success callback
    QR_SCANNER_INSTANCE.render(onQRScanSuccess, onQRScanError);
    showQRScannerLoading(false);
  } catch (err) {
    SCAN_IN_PROGRESS = false;
    showQRScannerLoading(false);
    showQRScannerError("Failed to start camera: " + err.message);
    console.error("Error starting QR scanner:", err);
  }
}

/**
 * Callback when QR code is successfully scanned
 */
async function onQRScanSuccess(decodedText, decodedResult) {
  console.log("✅ QR code scanned:", decodedText);

  if (!SCAN_IN_PROGRESS) return;
  SCAN_IN_PROGRESS = false;

  // Stop the scanner
  if (QR_SCANNER_INSTANCE) {
    try {
      await QR_SCANNER_INSTANCE.stop();
    } catch (err) {
      console.error("Error stopping scanner:", err);
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

    // Call backend to get session info
    const response = await fetch(`${API}/scan/${qrToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const error = await response.json();
      showQRScannerError(error.error || "Invalid QR code");
      showQRScannerLoading(false);
      return;
    }

    const data = await response.json();
    console.log("📍 Scan result:", data);

    // Close the scanner modal
    closeScanQRModal();

    // If there's an active session, open it
    if (data.session && data.session.id) {
      console.log("📋 Opening session:", data.session.id);
      
      // Switch to tables section if not already there
      const section = document.querySelector("[data-section='tables']");
      if (section && section.onclick) {
        switchSection("tables");
      }

      // Give the UI time to switch sections
      setTimeout(() => {
        // Open the session order panel
        handleSessionClick(data.session.id);
      }, 100);
    } else {
      // No active session - show the table options to start one
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
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }
}

/**
 * Hide error message in scanner
 */
function hideQRScannerError() {
  const errorEl = document.getElementById("qr-scanner-error");
  if (errorEl) {
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
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
