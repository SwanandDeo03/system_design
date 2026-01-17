// Authentication System for Notes App

const USERS_STORAGE_KEY = "notesAppUsers";
const SESSION_STORAGE_KEY = "notesAppSession";

let currentUser = null;

// Initialize - check if user is logged in
async function initAuth() {
  // First check server session
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    });

    if (response.ok) {
      const result = await response.json();
      if (result.user) {
        currentUser = result.user;
        setSession(result.user); // Sync local session
        showMainApp();
        return;
      }
    }
  } catch (err) {
    console.error('Session check error:', err);
    // Server might be unavailable or CORS issue - check local session as fallback
  }

  // No valid server session - check local session as fallback
  const session = getSession();
  if (session) {
    // Try to verify with server, but if it fails, still use local session
    // (useful during development or if server is temporarily down)
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const result = await response.json();
        if (result.user) {
          currentUser = result.user;
          setSession(result.user);
          showMainApp();
          return;
        }
      }
      // Server says no valid session - clear local session
      clearSession();
    } catch (err) {
      // Server unavailable - use local session (development mode)
      console.warn('Server unavailable, using local session:', err);
      currentUser = session;
      showMainApp();
      return;
    }
  }

  // No valid session found - show auth screen
  showAuthScreen();
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
  
  try {
    // Call backend API
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important for sessions
      body: JSON.stringify({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: password,
        passwordConfirm: passwordConfirm
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || "Registration failed." };
    }

    // Set session locally
    if (result.user) {
      setSession(result.user);
      console.debug('Registered user:', { email: result.user.email, id: result.user.id });
    }

    return { success: true, user: result.user };
  } catch (err) {
    console.error('Registration error:', err);
    return { success: false, error: "Failed to connect to server. Please try again." };
  }
}

// Login user
async function login(email, password) {
  // Validation
  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }
  
  try {
    // Call backend API
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important for sessions
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        password: password
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || "Login failed." };
    }

    // Set session locally
    if (result.user) {
      setSession(result.user);
      console.debug('Login successful for:', { email: result.user.email, id: result.user.id });
    }

    return { success: true, user: result.user };
  } catch (err) {
    console.error('Login error:', err);
    return { success: false, error: "Failed to connect to server. Please try again." };
  }
}

// Logout
async function logout() {
  try {
    // Call backend API to destroy session
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (err) {
    console.error('Logout API error:', err);
    // Continue with local logout even if API fails
  }
  
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
  
  // Initialize auth (async)
  initAuth().catch(err => {
    console.error('Auth initialization error:', err);
  });
});
