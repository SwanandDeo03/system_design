// Authentication System for Notes App

const USERS_STORAGE_KEY = "notesAppUsers";
const SESSION_STORAGE_KEY = "notesAppSession";

let currentUser = null;

// Initialize - check if user is logged in
function initAuth() {
  const session = getSession();
  if (session) {
    currentUser = session;
    showMainApp();
  } else {
    showAuthScreen();
  }
}

// Hash password using Web Crypto API
async function hashPassword(password) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    console.error('Web Crypto API not available. Password hashing will fail in insecure contexts.');
    throw new Error('Web Crypto API not available. Use HTTPS or localhost.');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Get all users from storage
function getUsers() {
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error("Failed to load users:", e);
    return {};
  }
}

// Save users to storage
function saveUsers(users) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error("Failed to save users:", e);
    alert("Failed to save user data. Storage may be full.");
  }
}

// Get current session
function getSession() {
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
}

// Set session
function setSession(user) {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    currentUser = user;
  } catch (e) {
    console.error("Failed to set session:", e);
  }
}

// Clear session (logout)
function clearSession() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  currentUser = null;
}

// Get current user ID
function getCurrentUserId() {
  return currentUser ? currentUser.id : null;
}

// Show authentication screen
function showAuthScreen() {
  document.getElementById("authScreen").style.display = "flex";
  document.getElementById("mainApp").style.display = "none";
}

// Show main app
function showMainApp() {
  document.getElementById("authScreen").style.display = "none";
  document.getElementById("mainApp").style.display = "block";
  
  // Update user name display
  if (currentUser) {
    const userNameDisplay = document.getElementById("userNameDisplay");
    if (userNameDisplay) {
      userNameDisplay.textContent = `Welcome, ${currentUser.name}`;
    }
  }
  
  // Setup workflow event listeners after main app is shown
  setTimeout(() => {
    if (typeof setupWorkflowEventListeners === 'function') {
      setupWorkflowEventListeners();
    }
    if (typeof updateWorkflowUI === 'function') {
      updateWorkflowUI();
    }
  }, 50);
  
  // Initialize app (this will load notes and set up event listeners)
  if (typeof initApp === 'function') {
    initApp();
  } else {
    // Fallback: try to load notes directly
    setTimeout(() => {
      if (typeof loadNotes === 'function') {
        loadNotes();
      }
    }, 100);
  }
}

// Register new user
async function register(name, email, password, passwordConfirm) {
  // Validation
  if (!name || !email || !password) {
    return { success: false, error: "All fields are required." };
  }
  
  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters." };
  }
  
  if (password !== passwordConfirm) {
    return { success: false, error: "Passwords do not match." };
  }
  
  // Check if user already exists
  const users = getUsers();
  if (users[email]) {
    return { success: false, error: "Email already registered. Please login." };
  }
  
  // Hash password
  const hashedPassword = await hashPassword(password);
  
  // Create user
  const userId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const newUser = {
    id: userId,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    createdAt: new Date().toISOString()
  };
  
  // Save user
  users[email.toLowerCase().trim()] = newUser;
  saveUsers(users);
  
  // Set session (without password)
  const sessionUser = {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email
  };
  setSession(sessionUser);
  
  console.debug('Registered user:', { email: newUser.email, id: newUser.id });
  return { success: true, user: sessionUser };
}

// Login user
async function login(email, password) {
  // Validation
  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }
  
  // Get user
  const users = getUsers();
  let user = users[email.toLowerCase().trim()];

  // Fallback: some stored data may not use email-as-key. Try to find by scanning values.
  if (!user) {
    const target = email.toLowerCase().trim();
    for (const k of Object.keys(users || {})) {
      const candidate = users[k];
      if (candidate && candidate.email && candidate.email.toLowerCase().trim() === target) {
        user = candidate;
        break;
      }
    }
  }

  if (!user) {
    return { success: false, error: "Invalid email or password." };
  }
  
  // Verify password
  const hashedPassword = await hashPassword(password);
  if (user.password !== hashedPassword) {
    return { success: false, error: "Invalid email or password." };
  }
  
  // Set session (without password)
  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email
  };
  setSession(sessionUser);
  
  console.debug('Login successful for:', { email: user.email, id: user.id });
  return { success: true, user: sessionUser };
}

// Logout
function logout() {
  clearSession();
  showAuthScreen();
  
  // Clear notes display
  if (typeof notes !== 'undefined') {
    notes = [];
  }
  
  // Reset workflow
  if (typeof resetWorkflow === 'function') {
    resetWorkflow();
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  const loginTabBtn = document.getElementById("loginTabBtn");
  const registerTabBtn = document.getElementById("registerTabBtn");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  
  loginTabBtn.addEventListener("click", () => {
    loginTabBtn.classList.add("active");
    registerTabBtn.classList.remove("active");
    loginForm.classList.add("active");
    registerForm.classList.remove("active");
    document.getElementById("loginError").textContent = "";
    document.getElementById("registerError").textContent = "";
  });
  
  registerTabBtn.addEventListener("click", () => {
    registerTabBtn.classList.add("active");
    loginTabBtn.classList.remove("active");
    registerForm.classList.add("active");
    loginForm.classList.remove("active");
    document.getElementById("loginError").textContent = "";
    document.getElementById("registerError").textContent = "";
  });
  
  // Login form
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;
    const errorEl = document.getElementById("loginError");
    
    errorEl.textContent = "";
    try {
      const result = await login(email, password);
      if (result.success) {
        showMainApp();
        loginForm.reset();
      } else {
        errorEl.textContent = result.error;
      }
    } catch (err) {
      console.error('Login failed with exception:', err);
      errorEl.textContent = err.message || 'Login failed';
    }
  });
  
  // Register form
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("registerName").value;
    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;
    const passwordConfirm = document.getElementById("registerPasswordConfirm").value;
    const errorEl = document.getElementById("registerError");
    
    errorEl.textContent = "";
    try {
      const result = await register(name, email, password, passwordConfirm);
      if (result.success) {
        showMainApp();
        registerForm.reset();
      } else {
        errorEl.textContent = result.error;
      }
    } catch (err) {
      console.error('Register failed with exception:', err);
      errorEl.textContent = err.message || 'Registration failed';
    }
  });
  
  // Logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to logout?")) {
        logout();
      }
    });
  }
  
  // Initialize auth
  initAuth();
});
