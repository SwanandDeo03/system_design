// Workflow Management System
// Supports two workflows: Office (default) and Doctor's Project (secured)

const WORKFLOW_OFFICE = "office";
const WORKFLOW_DOCTOR = "doctor";
const DEFAULT_PASSKEY = "AI_Robotics_2026"; // Default passkey - can be changed

let currentWorkflow = WORKFLOW_OFFICE;
let doctorWorkflowUnlocked = false;

// Get workflow storage key
function getWorkflowStorageKey() {
  const userId = typeof getCurrentUserId === 'function' ? getCurrentUserId() : null;
  if (!userId) {
    throw new Error("User not logged in");
  }
  return `notesApp_${userId}_${currentWorkflow}`;
}

// Get passkey storage key
function getPasskeyStorageKey() {
  const userId = typeof getCurrentUserId === 'function' ? getCurrentUserId() : null;
  if (!userId) {
    throw new Error("User not logged in");
  }
  return `notesApp_${userId}_passkey`;
}

// Hash passkey (same method as password)
async function hashPasskey(passkey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(passkey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Initialize passkey on first use
async function initializePasskey() {
  const storageKey = getPasskeyStorageKey();
  const stored = localStorage.getItem(storageKey);
  
  if (!stored) {
    // Set default passkey on first use
    const hashedPasskey = await hashPasskey(DEFAULT_PASSKEY);
    localStorage.setItem(storageKey, hashedPasskey);
  }
}

// Verify passkey
async function verifyPasskey(inputPasskey) {
  const storageKey = getPasskeyStorageKey();
  const storedHash = localStorage.getItem(storageKey);
  
  if (!storedHash) {
    // Initialize if not set
    await initializePasskey();
    return await verifyPasskey(inputPasskey);
  }
  
  const inputHash = await hashPasskey(inputPasskey);
  return inputHash === storedHash;
}

// Change passkey
async function changePasskey(oldPasskey, newPasskey) {
  const isValid = await verifyPasskey(oldPasskey);
  if (!isValid) {
    return { success: false, error: "Current passkey is incorrect." };
  }
  
  if (!newPasskey || newPasskey.length < 4) {
    return { success: false, error: "New passkey must be at least 4 characters." };
  }
  
  const storageKey = getPasskeyStorageKey();
  const newHash = await hashPasskey(newPasskey);
  localStorage.setItem(storageKey, newHash);
  
  return { success: true };
}

// Switch workflow
async function switchWorkflow() {
  console.log("switchWorkflow called. Current workflow:", currentWorkflow, "Unlocked:", doctorWorkflowUnlocked);
  
  if (currentWorkflow === WORKFLOW_OFFICE) {
    // Switching to AI Robotics - always requires access key
    // Reset unlock state when switching from Office to ensure access key is always asked
    doctorWorkflowUnlocked = false;
    console.log("Showing access key modal for AI Robotics");
    showPasskeyModal();
    return;
  } else {
    // Switching to Office - no access key needed, switch directly
    currentWorkflow = WORKFLOW_OFFICE;
    doctorWorkflowUnlocked = false; // Reset unlock state when switching back to Office
    console.log("Switched to Office workflow");
  }
  
  // Update UI immediately
  updateWorkflowUI();
  
  // Clear editor
  if (typeof clearEditor === 'function') {
    clearEditor();
  }
  
  // Reload notes for the new workflow
  if (typeof loadNotes === 'function') {
    loadNotes();
  }
}

// Show passkey modal
function showPasskeyModal() {
  const modal = document.getElementById("passkeyModal");
  const passkeyInput = document.getElementById("passkeyInput");
  const errorEl = document.getElementById("passkeyError");
  
  if (!modal) {
    console.error("Passkey modal not found");
    return;
  }
  
  modal.style.display = "flex";
  if (passkeyInput) {
    passkeyInput.value = "";
    setTimeout(() => passkeyInput.focus(), 100);
  }
  if (errorEl) {
    errorEl.textContent = "";
  }
}

// Hide passkey modal
function hidePasskeyModal() {
  const modal = document.getElementById("passkeyModal");
  modal.style.display = "none";
}

// Update workflow UI
function updateWorkflowUI() {
  const workflowNameEl = document.getElementById("workflowName");
  if (workflowNameEl) {
    if (currentWorkflow === WORKFLOW_OFFICE) {
      workflowNameEl.textContent = "Office";
      workflowNameEl.className = "workflow-name workflow-office";
      console.log("UI updated to Office workflow");
    } else if (currentWorkflow === WORKFLOW_DOCTOR) {
      workflowNameEl.textContent = "AI_Robotics Project";
      workflowNameEl.className = "workflow-name workflow-doctor";
      console.log("UI updated to AI_Robotics Project workflow");
    }
  } else {
    console.warn("Workflow name element not found");
  }
}

// Get current workflow
function getCurrentWorkflow() {
  return currentWorkflow;
}

// Check if doctor workflow is unlocked
function isDoctorWorkflowUnlocked() {
  return doctorWorkflowUnlocked;
}

// Reset workflow to office (called on logout)
function resetWorkflow() {
  currentWorkflow = WORKFLOW_OFFICE;
  doctorWorkflowUnlocked = false;
  updateWorkflowUI();
}

// Setup workflow event listeners
let workflowClickHandler = null;

function setupWorkflowEventListeners() {
  // Remove existing listener if any
  if (workflowClickHandler) {
    document.removeEventListener("click", workflowClickHandler);
  }
  
  // Create new handler
  workflowClickHandler = function(e) {
    // Check if clicked element is the switch button or its child
    const clickedEl = e.target;
    if (clickedEl && (clickedEl.id === "switchWorkflowBtn" || clickedEl.closest("#switchWorkflowBtn"))) {
      e.preventDefault();
      e.stopPropagation();
      console.log("Switch workflow button clicked");
      switchWorkflow();
    }
  };
  
  // Attach event listener using event delegation
  document.addEventListener("click", workflowClickHandler, true);
  
  // Also attach directly to button if it exists (as backup)
  const switchBtn = document.getElementById("switchWorkflowBtn");
  if (switchBtn) {
    switchBtn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("Switch workflow button clicked (direct)");
      switchWorkflow();
    };
    console.log("Workflow switch button event listeners attached");
  } else {
    console.warn("Switch workflow button not found");
  }
}

// Initialize workflow system
async function initWorkflow() {
  // Reset to office workflow on initialization
  currentWorkflow = WORKFLOW_OFFICE;
  doctorWorkflowUnlocked = false;
  
  await initializePasskey();
  updateWorkflowUI();
  
  // Setup event listeners
  setupWorkflowEventListeners();
  
  // Keyboard shortcut: Press 'W' key to switch workflow
  document.addEventListener("keydown", (e) => {
    // Only trigger if not typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    
    if (e.key.toLowerCase() === 'w' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      switchWorkflow();
    }
  });
  
  // Passkey form
  const passkeyForm = document.getElementById("passkeyForm");
  if (passkeyForm) {
    passkeyForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const passkeyInput = document.getElementById("passkeyInput");
      const errorEl = document.getElementById("passkeyError");
      const passkey = passkeyInput.value;
      
      errorEl.textContent = "";
      
      const isValid = await verifyPasskey(passkey);
      if (isValid) {
        console.log("Passkey verified successfully");
        
        // Unlock doctor workflow and switch to it
        doctorWorkflowUnlocked = true;
        currentWorkflow = WORKFLOW_DOCTOR;
        
        console.log("Workflow set to:", currentWorkflow, "Unlocked:", doctorWorkflowUnlocked);
        
        // Hide modal first
        hidePasskeyModal();
        
        // Force UI update immediately - no delay needed
        updateWorkflowUI();
        
        // Clear editor
        if (typeof clearEditor === 'function') {
          clearEditor();
        }
        
        // Reload notes for AI Robotics workflow
        if (typeof loadNotes === 'function') {
          loadNotes();
        }
        
        console.log("Successfully switched to AI_Robotics Project workflow. Current workflow:", currentWorkflow);
        
        // Double-check UI was updated
        setTimeout(() => {
          const workflowNameEl = document.getElementById("workflowName");
          if (workflowNameEl) {
            console.log("Workflow name element text:", workflowNameEl.textContent);
            if (workflowNameEl.textContent !== "AI_Robotics Project") {
              console.warn("UI not updated correctly, forcing update");
              updateWorkflowUI();
            }
          }
        }, 100);
      } else {
        errorEl.textContent = "Incorrect access key. Please try again.";
        passkeyInput.value = "";
        setTimeout(() => passkeyInput.focus(), 100);
      }
    });
  }
  
  // Cancel passkey button
  const cancelBtn = document.getElementById("cancelPasskeyBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      hidePasskeyModal();
    });
  }
  
  // Close modal on overlay click
  const modal = document.getElementById("passkeyModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        hidePasskeyModal();
      }
    });
  }
  
  // Close modal on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById("passkeyModal");
      if (modal && modal.style.display !== "none") {
        hidePasskeyModal();
      }
    }
  });
}

// Make functions globally accessible
window.getWorkflowStorageKey = getWorkflowStorageKey;
window.getCurrentWorkflow = getCurrentWorkflow;
window.switchWorkflow = switchWorkflow;
window.setupWorkflowEventListeners = setupWorkflowEventListeners;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initWorkflow, 100);
  });
} else {
  setTimeout(initWorkflow, 100);
}
