// Workflow Management System
// Always uses AI Robotics Project workflow

const WORKFLOW_DOCTOR = "doctor";

let currentWorkflow = WORKFLOW_DOCTOR;

// Get workflow storage key
function getWorkflowStorageKey() {
  const userId = typeof getCurrentUserId === 'function' ? getCurrentUserId() : null;
  if (!userId) {
    throw new Error("User not logged in");
  }
  return `notesApp_${userId}_${currentWorkflow}`;
}



// Update workflow UI
function updateWorkflowUI() {
  const workflowNameEl = document.getElementById("workflowName");
  if (workflowNameEl) {
    workflowNameEl.textContent = "AI_Robotics Project";
    workflowNameEl.className = "workflow-name workflow-doctor";
    console.log("UI updated to AI_Robotics Project workflow");
  } else {
    console.warn("Workflow name element not found");
  }
}

// Get current workflow
function getCurrentWorkflow() {
  return currentWorkflow;
}

// Reset workflow (called on logout)
function resetWorkflow() {
  currentWorkflow = WORKFLOW_DOCTOR;
  updateWorkflowUI();
}

// Setup workflow event listeners (disabled - no switching needed)
function setupWorkflowEventListeners() {
  // Workflow switching removed - always using AI_Robotics Project
  // Hide the switch button if it exists
  const switchBtn = document.getElementById("switchWorkflowBtn");
  if (switchBtn) {
    switchBtn.style.display = "none";
  }
}

// Initialize workflow system
async function initWorkflow() {
  // Always use AI_Robotics Project workflow
  currentWorkflow = WORKFLOW_DOCTOR;
  
  updateWorkflowUI();
  
  // Setup event listeners (hides switch button)
  setupWorkflowEventListeners();
}

// Make functions globally accessible
window.getWorkflowStorageKey = getWorkflowStorageKey;
window.getCurrentWorkflow = getCurrentWorkflow;
window.setupWorkflowEventListeners = setupWorkflowEventListeners;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initWorkflow, 100);
  });
} else {
  setTimeout(initWorkflow, 100);
}
