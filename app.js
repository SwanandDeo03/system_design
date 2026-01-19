// Simple Notes / Diary App with Date Functionality

// Notes storage key will be user-specific and workflow-specific
function getNotesStorageKey() {
  // Use workflow storage key if available
  if (typeof getWorkflowStorageKey === 'function') {
    return getWorkflowStorageKey();
  }
  
  // Fallback to old method
  const userId = typeof getCurrentUserId === 'function' ? getCurrentUserId() : null;
  if (!userId) {
    throw new Error("User not logged in");
  }
  return `notesApp_${userId}`;
}

let notes = [];
let currentlyEditingId = null;

// Elements
const noteTitleEl = document.getElementById("noteTitle");
const noteContentEl = document.getElementById("noteContent");
const noteDateEl = document.getElementById("noteDate");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const notesContainer = document.getElementById("notesContainer");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const filterDateSelect = document.getElementById("filterDateSelect");
const emptyStateEl = document.getElementById("emptyState");
const exportDateEl = document.getElementById("exportDate");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const exportExcelBtn = document.getElementById("exportExcelBtn");

// Load notes from localStorage (user-specific)
function loadNotes() {
  try {
    const storageKey = getNotesStorageKey();
    const stored = localStorage.getItem(storageKey);
    notes = stored ? JSON.parse(stored) : [];
    renderNotes();
  } catch (e) {
    console.error("Failed to load notes:", e);
    notes = [];
    renderNotes();
  }
}

// Save notes to localStorage (user-specific)
function saveNotes() {
  try {
    const storageKey = getNotesStorageKey();
    localStorage.setItem(storageKey, JSON.stringify(notes));
  } catch (e) {
    console.error("Failed to save notes:", e);
    alert("Failed to save notes. Storage may be full.");
  }
}

// Initialize date inputs with today's date (only if elements exist)
if (noteDateEl) {
  noteDateEl.value = new Date().toISOString().split('T')[0];
}
if (exportDateEl) {
  exportDateEl.value = new Date().toISOString().split('T')[0];
}

function clearEditor() {
  noteTitleEl.value = "";
  noteContentEl.value = "";
  noteDateEl.value = new Date().toISOString().split('T')[0];
  currentlyEditingId = null;
  saveBtn.textContent = "Save Note";
}

function createNote(title, content, taskDate) {
  const now = new Date().toISOString();
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    title: title.trim(),
    content: content.trim(),
    taskDate: taskDate || new Date().toISOString().split('T')[0],
    createdAt: now,
    updatedAt: now,
    pinned: false,
    archived: false,
  };
}

// Note: updates and deletes are sent to the server. UI refreshes from server.

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTaskDate(dateString) {
  if (!dateString) return "No date";
  const d = new Date(dateString + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(d);
  taskDate.setHours(0, 0, 0, 0);
  
  const diffTime = taskDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 0) return `In ${diffDays} days`;
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function isDateInRange(dateString, range) {
  if (!dateString || !range) return true;
  
  const taskDate = new Date(dateString + "T00:00:00");
  const today = new Date(); 
  today.setHours(0, 0, 0, 0);
  
  if (range === "today") {
    return taskDate.getTime() === today.getTime();
  }
  
  if (range === "thisWeek") {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return taskDate >= weekStart && taskDate <= weekEnd;
  }
  
  if (range === "thisMonth") {
    return taskDate.getMonth() === today.getMonth() && 
           taskDate.getFullYear() === today.getFullYear();
  }
  
  return true;
}

function renderNotes() {
  const query = searchInput.value.toLowerCase().trim();
  const sortBy = sortSelect.value;
  const dateFilter = filterDateSelect.value;

  let filtered = notes.filter((n) => {
    const target = (n.title + " " + n.content).toLowerCase();
    const matchesSearch = target.includes(query);
    const matchesDateFilter = isDateInRange(n.taskDate, dateFilter);
    return matchesSearch && matchesDateFilter;
  });

  if (sortBy === "latest") {
    filtered.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } else if (sortBy === "oldest") {
    filtered.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  } else if (sortBy === "title") {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy === "taskDate") {
    filtered.sort((a, b) => {
      const dateA = a.taskDate ? new Date(a.taskDate).getTime() : 0;
      const dateB = b.taskDate ? new Date(b.taskDate).getTime() : 0;
      return dateA - dateB;
    });
  } else if (sortBy === "taskDateDesc") {
    filtered.sort((a, b) => {
      const dateA = a.taskDate ? new Date(a.taskDate).getTime() : 0;
      const dateB = b.taskDate ? new Date(b.taskDate).getTime() : 0;
      return dateB - dateA;
    });
  }

  // Pinned first, then others
  filtered.sort((a, b) => Number(b.pinned) - Number(a.pinned));

  notesContainer.innerHTML = "";

  if (filtered.length === 0) {
    emptyStateEl.style.display = "block";
    return;
  }

  emptyStateEl.style.display = "none";

  for (const note of filtered) {
    const card = document.createElement("article");
    card.className = "note-card";
    if (note.pinned) card.classList.add("pinned");
    if (note.archived) card.classList.add("archived");

    const titleEl = document.createElement("div");
    titleEl.className = "note-card-title";
    titleEl.textContent = note.title || "Untitled";

    const contentEl = document.createElement("div");
    contentEl.className = "note-card-content";
    contentEl.textContent = note.content || "(Empty note)";

    const footer = document.createElement("div");
    footer.className = "note-card-footer";

    const meta = document.createElement("div");
    meta.className = "note-card-meta";
    const taskDateEl = document.createElement("div");
    taskDateEl.className = "task-date-badge";
    taskDateEl.textContent = formatTaskDate(note.taskDate);
    const updatedEl = document.createElement("span");
    updatedEl.className = "note-updated";
    updatedEl.textContent = formatDate(note.updatedAt);
    meta.appendChild(taskDateEl);
    meta.appendChild(updatedEl);

    const actions = document.createElement("div");
    actions.className = "note-card-actions";

    const pinBtn = document.createElement("button");
    pinBtn.className = "icon-btn";
    pinBtn.textContent = note.pinned ? "Unpin" : "Pin";
    pinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      note.pinned = !note.pinned;
      saveNotes();
      renderNotes();
    });

    const archiveBtn = document.createElement("button");
    archiveBtn.className = "icon-btn";
    archiveBtn.textContent = note.archived ? "Unarchive" : "Archive";
    archiveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      note.archived = !note.archived;
      saveNotes();
      renderNotes();
    });

    // Export to PDF button for single note
    const exportPdfBtn = document.createElement("button");
    exportPdfBtn.className = "icon-btn";
    exportPdfBtn.textContent = "📄 PDF";
    exportPdfBtn.title = "Export this task to PDF";
    exportPdfBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      exportSingleNoteToPDF(note);
    });

    // Export to Excel button for single note
    const exportExcelBtn = document.createElement("button");
    exportExcelBtn.className = "icon-btn";
    exportExcelBtn.textContent = "📊 Excel";
    exportExcelBtn.title = "Export this task to Excel";
    exportExcelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      exportSingleNoteToExcel(note);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!confirm("Delete this note?")) return;
      notes = notes.filter(n => n.id !== note.id);
      saveNotes();
      renderNotes();
    });

    actions.appendChild(pinBtn);
    actions.appendChild(archiveBtn);
    actions.appendChild(exportPdfBtn);
    actions.appendChild(exportExcelBtn);
    actions.appendChild(deleteBtn);

    footer.appendChild(meta);
    footer.appendChild(actions);

    card.appendChild(titleEl);
    card.appendChild(contentEl);
    card.appendChild(footer);

    card.addEventListener("click", () => {
      currentlyEditingId = note.id;
      noteTitleEl.value = note.title || "";
      noteContentEl.value = note.content || "";
      noteDateEl.value = note.taskDate || new Date().toISOString().split('T')[0];
      saveBtn.textContent = "Update Note";
      noteTitleEl.focus();
    });

    notesContainer.appendChild(card);
  }
}

function handleSave() {
  const title = noteTitleEl.value.trim();
  const content = noteContentEl.value.trim();
  const taskDate = noteDateEl.value;

  if (!title && !content) {
    alert("Write something before saving.");
    return;
  }

  if (currentlyEditingId) {
    const note = notes.find(n => n.id === currentlyEditingId);
    if (note) {
      note.title = title;
      note.content = content;
      note.taskDate = taskDate;
      note.updatedAt = new Date().toISOString();
    }
  } else {
    const newNote = createNote(title, content, taskDate);
    notes.push(newNote);
  }
  
  saveNotes();
  clearEditor();
  renderNotes();
}

// Export Functions
function getNotesForDate(selectedDate) {
  if (!selectedDate) {
    alert("Please select a date to export.");
    return [];
  }
  
  return notes.filter(note => {
    if (!note.taskDate) return false;
    return note.taskDate === selectedDate;
  });
}

function formatDateForDisplay(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function exportToPDF() {
  const selectedDate = exportDateEl.value;
  const dayNotes = getNotesForDate(selectedDate);
  
  if (dayNotes.length === 0) {
    alert(`No tasks found for ${formatDateForDisplay(selectedDate)}.`);
    return;
  }
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Title with workflow name
    const workflowName = "AI Robotics";
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text(`${workflowName} - Tasks for ${formatDateForDisplay(selectedDate)}`, 14, 20);
    
    // Date info
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Exported on: ${new Date().toLocaleString()}`, 14, 28);
    
    let yPos = 40;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 14;
    const lineHeight = 8;
    
    dayNotes.forEach((note, index) => {
      // Check if we need a new page
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 20;
      }
      
      // Task number
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.setFont(undefined, "bold");
      doc.text(`Task ${index + 1}:`, margin, yPos);
      yPos += lineHeight;
      
      // Title
      doc.setFontSize(11);
      doc.setFont(undefined, "bold");
      doc.text("Title:", margin, yPos);
      doc.setFont(undefined, "normal");
      const titleLines = doc.splitTextToSize(note.title || "Untitled", 180);
      doc.text(titleLines, margin + 20, yPos);
      yPos += titleLines.length * lineHeight + 3;
      
      // Content
      doc.setFont(undefined, "bold");
      doc.text("Content:", margin, yPos);
      doc.setFont(undefined, "normal");
      const contentLines = doc.splitTextToSize(note.content || "(Empty note)", 180);
      doc.text(contentLines, margin + 20, yPos);
      yPos += contentLines.length * lineHeight + 3;
      
      // Status
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      let status = [];
      if (note.pinned) status.push("Pinned");
      if (note.archived) status.push("Archived");
      if (status.length > 0) {
        doc.text(`Status: ${status.join(", ")}`, margin, yPos);
        yPos += lineHeight;
      }
      
      // Created/Updated
      doc.text(`Created: ${formatDate(note.createdAt)}`, margin, yPos);
      yPos += lineHeight + 5;
      
      // Separator line
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos, 200, yPos);
      yPos += 10;
    });
    
    // Summary
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Total Tasks: ${dayNotes.length}`, margin, yPos);
    
    // Save PDF with workflow name
    const workflowPrefix = "ai_robotics_";
    const fileName = `${workflowPrefix}tasks_${selectedDate.replace(/-/g, "_")}.pdf`;
    doc.save(fileName);
  } catch (error) {
    console.error("PDF export error:", error);
    alert("Failed to export PDF. Please check console for details.");
  }
}

function exportToExcel() {
  const selectedDate = exportDateEl.value;
  const dayNotes = getNotesForDate(selectedDate);
  
  if (dayNotes.length === 0) {
    alert(`No tasks found for ${formatDateForDisplay(selectedDate)}.`);
    return;
  }
  
  try {
    // Prepare data for Excel
    const excelData = dayNotes.map((note, index) => ({
      "Task #": index + 1,
      "Title": note.title || "Untitled",
      "Content": note.content || "(Empty note)",
      "Task Date": note.taskDate,
      "Status": [
        note.pinned ? "Pinned" : "",
        note.archived ? "Archived" : ""
      ].filter(s => s).join(", ") || "Active",
      "Created At": formatDate(note.createdAt),
      "Updated At": formatDate(note.updatedAt),
    }));
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create worksheet from data
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 8 },   // Task #
      { wch: 25 },  // Title
      { wch: 40 },  // Content
      { wch: 12 },  // Task Date
      { wch: 15 },  // Status
      { wch: 18 },  // Created At
      { wch: 18 },  // Updated At
    ];
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Tasks");
    
    // Add summary sheet with workflow info
    const workflowName = typeof getCurrentWorkflow === 'function' && getCurrentWorkflow() === 'doctor' 
      ? "AI Robotics" 
      : "Office";
    const summaryData = [
      { "Field": "Workflow", "Value": workflowName },
      { "Field": "Export Date", "Value": formatDateForDisplay(selectedDate) },
      { "Field": "Total Tasks", "Value": dayNotes.length },
      { "Field": "Pinned Tasks", "Value": dayNotes.filter(n => n.pinned).length },
      { "Field": "Archived Tasks", "Value": dayNotes.filter(n => n.archived).length },
      { "Field": "Active Tasks", "Value": dayNotes.filter(n => !n.archived).length },
      { "Field": "Exported On", "Value": new Date().toLocaleString() },
    ];
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");
    
    // Save file with workflow name
    const workflowPrefix = "ai_robotics_";
    const fileName = `${workflowPrefix}tasks_${selectedDate.replace(/-/g, "_")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  } catch (error) {
    console.error("Excel export error:", error);
    alert("Failed to export Excel. Please check console for details.");
  }
}

// Export single note to PDF
function exportSingleNoteToPDF(note) {
  if (!note) {
    alert("No note selected for export.");
    return;
  }
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Title with workflow name
    const workflowName = "AI Robotics";
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text(`${workflowName} - Task`, 14, 20);
    
    // Date info
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Exported on: ${new Date().toLocaleString()}`, 14, 28);
    
    let yPos = 40;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 14;
    const lineHeight = 8;
    
    // Check if we need a new page
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 20;
    }
    
    // Title
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.setFont(undefined, "bold");
    doc.text("Title:", margin, yPos);
    doc.setFont(undefined, "normal");
    const titleLines = doc.splitTextToSize(note.title || "Untitled", 180);
    doc.text(titleLines, margin + 20, yPos);
    yPos += titleLines.length * lineHeight + 5;
    
    // Content
    doc.setFont(undefined, "bold");
    doc.text("Content:", margin, yPos);
    doc.setFont(undefined, "normal");
    const contentLines = doc.splitTextToSize(note.content || "(Empty note)", 180);
    doc.text(contentLines, margin + 20, yPos);
    yPos += contentLines.length * lineHeight + 5;
    
    // Task Date
    doc.setFont(undefined, "bold");
    doc.text("Task Date:", margin, yPos);
    doc.setFont(undefined, "normal");
    doc.text(note.taskDate ? formatDateForDisplay(note.taskDate) : "No date", margin + 35, yPos);
    yPos += lineHeight + 3;
    
    // Status
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    let status = [];
    if (note.pinned) status.push("Pinned");
    if (note.archived) status.push("Archived");
    if (status.length > 0) {
      doc.text(`Status: ${status.join(", ")}`, margin, yPos);
      yPos += lineHeight;
    }
    
    // Created/Updated
    doc.text(`Created: ${formatDate(note.createdAt)}`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Updated: ${formatDate(note.updatedAt)}`, margin, yPos);
    
    // Save PDF with workflow name
    const workflowPrefix = "ai_robotics_";
    const safeTitle = (note.title || "untitled").replace(/[^a-z0-9]/gi, '_').substring(0, 30);
    const fileName = `${workflowPrefix}task_${safeTitle}_${note.id.substring(0, 8)}.pdf`;
    doc.save(fileName);
  } catch (error) {
    console.error("PDF export error:", error);
    alert("Failed to export PDF. Please check console for details.");
  }
}

// Export single note to Excel
function exportSingleNoteToExcel(note) {
  if (!note) {
    alert("No note selected for export.");
    return;
  }
  
  try {
    // Prepare data for Excel
    const excelData = [{
      "Title": note.title || "Untitled",
      "Content": note.content || "(Empty note)",
      "Task Date": note.taskDate || "No date",
      "Status": [
        note.pinned ? "Pinned" : "",
        note.archived ? "Archived" : ""
      ].filter(s => s).join(", ") || "Active",
      "Created At": formatDate(note.createdAt),
      "Updated At": formatDate(note.updatedAt),
    }];
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create worksheet from data
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 30 },  // Title
      { wch: 50 },  // Content
      { wch: 15 },  // Task Date
      { wch: 15 },  // Status
      { wch: 18 },  // Created At
      { wch: 18 },  // Updated At
    ];
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Task");
    
    // Add summary sheet with workflow info
    const workflowName = "AI Robotics";
    const summaryData = [
      { "Field": "Workflow", "Value": workflowName },
      { "Field": "Title", "Value": note.title || "Untitled" },
      { "Field": "Task Date", "Value": note.taskDate ? formatDateForDisplay(note.taskDate) : "No date" },
      { "Field": "Status", "Value": [
        note.pinned ? "Pinned" : "",
        note.archived ? "Archived" : ""
      ].filter(s => s).join(", ") || "Active" },
      { "Field": "Exported On", "Value": new Date().toLocaleString() },
    ];
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");
    
    // Save file with workflow name
    const workflowPrefix = "ai_robotics_";
    const safeTitle = (note.title || "untitled").replace(/[^a-z0-9]/gi, '_').substring(0, 30);
    const fileName = `${workflowPrefix}task_${safeTitle}_${note.id.substring(0, 8)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  } catch (error) {
    console.error("Excel export error:", error);
    alert("Failed to export Excel. Please check console for details.");
  }
}

// Initialize app only when user is logged in
function initApp() {
  // Wait for auth to initialize
  if (typeof getCurrentUserId === 'function' && getCurrentUserId()) {
    // Initialize date inputs
    if (noteDateEl) {
      noteDateEl.value = new Date().toISOString().split('T')[0];
    }
    if (exportDateEl) {
      exportDateEl.value = new Date().toISOString().split('T')[0];
    }
    
    // Workflow is always AI_Robotics Project - no need to reset
    
    // Load notes
    loadNotes();
    
    // Set up event listeners
    if (saveBtn) {
      saveBtn.addEventListener("click", handleSave);
    }
    
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        clearEditor();
      });
    }
    
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        renderNotes();
      });
    }
    
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        renderNotes();
      });
    }
    
    if (filterDateSelect) {
      filterDateSelect.addEventListener("change", () => {
        renderNotes();
      });
    }
    
    if (noteContentEl) {
      noteContentEl.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.key === "Enter") {
          handleSave();
        }
      });
    }
    
    // Event listeners for export
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener("click", exportToPDF);
    }
    
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener("click", exportToExcel);
    }
    
    // Ensure workflow event listeners are set up
    setTimeout(() => {
      if (typeof setupWorkflowEventListeners === 'function') {
        setupWorkflowEventListeners();
      }
    }, 100);
  }
}

// Make initApp globally accessible
window.initApp = initApp;

// Wait for DOM and auth to be ready
// Note: initApp will be called by auth.js when user is logged in
// This is just a fallback in case auth.js hasn't loaded yet
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in and app needs initialization
    setTimeout(() => {
      if (typeof getCurrentUserId === 'function' && getCurrentUserId()) {
        const mainApp = document.getElementById("mainApp");
        if (mainApp && mainApp.style.display !== 'none') {
          initApp();
        }
      }
    }, 200);
  });
} else {
  setTimeout(() => {
    if (typeof getCurrentUserId === 'function' && getCurrentUserId()) {
      const mainApp = document.getElementById("mainApp");
      if (mainApp && mainApp.style.display !== 'none') {
        initApp();
      }
    }
  }, 200);
}


