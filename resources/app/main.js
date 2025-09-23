const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 900,
    minWidth: 800,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "assets", "icon.ico"),
    show: false, // Don't show until ready
  });

  // Maximize the window on startup
  mainWindow.maximize();

  // Prevent error dialogs from appearing
  mainWindow.webContents.on("crashed", (event) => {
    console.error("Renderer process crashed:", event);
    // Optionally restart the window
  });

  // Handle unresponsive renderer
  mainWindow.on("unresponsive", () => {
    console.warn("Window became unresponsive");
  });

  // Prevent JavaScript dialogs (alert, confirm, prompt) from blocking the UI
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });

  // Override JavaScript dialogs
  mainWindow.webContents.on("before-input-event", (event, input) => {
    // Log input events for debugging if needed
  });

  // Suppress JavaScript error dialogs but allow controlled dialogs
  mainWindow.webContents.on("dom-ready", () => {
    mainWindow.webContents.executeJavaScript(`
      // Store original functions for controlled use
      window._originalAlert = window.alert;
      window._originalConfirm = window.confirm;
      window._originalPrompt = window.prompt;
      
      // Override only for uncontrolled usage - our custom functions use IPC
      window.alert = function(message) {
        console.log('Uncontrolled alert suppressed:', message);
        // Don't show blocking dialog for uncontrolled alerts
      };
      
      window.confirm = function(message) {
        console.log('Uncontrolled confirm suppressed:', message);
        return false; // Default to false for safety
      };
      
      window.prompt = function(message, defaultValue) {
        console.log('Uncontrolled prompt suppressed:', message);
        return null; // Default to cancelled
      };
      
      // Handle uncaught errors
      window.addEventListener('error', function(event) {
        console.error('JavaScript error:', event.error);
        event.preventDefault();
        return true;
      });
      
      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        event.preventDefault();
      });
    `);
  });

  // Load the index.html of the app
  mainWindow.loadFile("src/index.html").catch((err) => {
    console.error("Failed to load main page:", err);
  });

  // Show window when ready to prevent flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Open DevTools in development mode only
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }

  // Set up menu
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Export Amortization Schedule",
          click: () => {
            mainWindow.webContents.send("menu-export-schedule");
          },
        },
        { type: "separator" },
        {
          label: "Exit",
          role: "quit",
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "delete" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              title: "About MortgagePros™ Calculator",
              message: "MortgagePros™ Calculator",
              detail:
                "A professional mortgage calculator application.\nVersion: 1.0.0\n© 2025 MortgagePros",
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Emitted when the window is closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    // On macOS, re-create window when dock icon is clicked and no other windows are open
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Handle saving CSV file
ipcMain.handle("save-file", async (event, data, defaultPath) => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: "Save Amortization Schedule",
      defaultPath: defaultPath,
      filters: [
        { name: "CSV", extensions: ["csv"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (filePath) {
      console.log("Attempting to save file to:", filePath);
      fs.writeFileSync(filePath, data);
      console.log("File saved successfully to:", filePath);
      return filePath;
    }
    console.log("Save dialog was cancelled");
    return null;
  } catch (error) {
    console.error("Error in save-file handler:", error);
    throw error;
  }
});

// Handle saving PDF file - just get the file path
ipcMain.handle("save-pdf", async (event, defaultPath) => {
  const { filePath } = await dialog.showSaveDialog({
    title: "Save Amortization Schedule as PDF",
    defaultPath: defaultPath,
    filters: [
      { name: "PDF", extensions: ["pdf"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  return filePath || null;
});

// Handle saving binary data to file (used for PDF)
ipcMain.handle("save-binary-file", async (event, filePath, base64Data) => {
  if (!filePath) {
    console.log("No file path provided to save-binary-file");
    return false;
  }

  try {
    console.log("Attempting to save binary file to:", filePath);
    // Convert base64 to binary buffer
    const buffer = Buffer.from(base64Data, "base64");

    // Write buffer directly to file
    fs.writeFileSync(filePath, buffer);
    console.log("Binary file saved successfully to:", filePath);
    return true;
  } catch (error) {
    console.error("Error saving binary file:", error);
    throw error;
  }
});

// Handle confirmation dialogs
ipcMain.handle("show-confirm-dialog", async (event, options) => {
  try {
    const result = await dialog.showMessageBox(mainWindow, options);
    return result;
  } catch (error) {
    console.error("Error showing confirm dialog:", error);
    return { response: 0 }; // Default to "Yes"
  }
});

// Handle opening files with system default application
ipcMain.handle("open-file", async (event, filePath) => {
  try {
    const { shell } = require("electron");
    await shell.openPath(filePath);
    return true;
  } catch (error) {
    console.error("Error opening file:", error);
    throw error;
  }
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Global error handling
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Don't exit the app, just log the error
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit the app, just log the error
});

// Handle app crashes gracefully
app.on("render-process-gone", (event, webContents, details) => {
  console.error("Render process gone:", details);
  // Optionally restart the window
  if (details.reason !== "clean-exit") {
    console.log("Attempting to reload due to crash...");
    webContents.reload();
  }
});

// Disable error dialogs in production
if (process.env.NODE_ENV !== "development") {
  // Override dialog.showErrorBox to prevent error dialogs
  const { dialog } = require("electron");
  dialog.showErrorBox = function (title, content) {
    console.error(`Error Dialog Suppressed - ${title}: ${content}`);
  };
}
