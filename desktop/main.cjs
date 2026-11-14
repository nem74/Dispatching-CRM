
const {
  app,
  BrowserWindow,
  dialog,
  session,
  shell
} = require("electron");

const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");

const PORT = 8000;
const APP_URL = `http://127.0.0.1:${PORT}`;
const PROJECT_ROOT = path.resolve(__dirname, "..");

let backendProcess = null;
let backendError = null;
let mainWindow = null;
let logStream = null;

const singleInstance = app.requestSingleInstanceLock();

if (!singleInstance) {
  app.quit();
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
});

function getBackendCommand() {
  if (app.isPackaged) {
    return {
      command: path.join(
        process.resourcesPath,
        "backend",
        "lanecove-backend.exe"
      ),
      args: [],
      cwd: app.getPath("userData")
    };
  }

  return {
    command: path.join(
      PROJECT_ROOT,
      ".venv",
      "bin",
      "python"
    ),
    args: [
      path.join(PROJECT_ROOT, "backend_launcher.py")
    ],
    cwd: PROJECT_ROOT
  };
}

function portIsAvailable() {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));

    server.listen(PORT, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

function checkBackend() {
  return new Promise((resolve) => {
    const request = http.get(
      `${APP_URL}/api/health`,
      (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      }
    );

    request.setTimeout(1500, () => request.destroy());

    request.on("error", () => resolve(false));
  });
}

function startBackend() {
  const config = getBackendCommand();

  if (!fs.existsSync(config.command)) {
    backendError = `Backend not found: ${config.command}`;
    return;
  }

  const environment = { ...process.env };

  // Allows isolated database testing on Ubuntu.
  if (environment.LANECOVE_DB_NAME) {
    environment.DB_NAME = environment.LANECOVE_DB_NAME;
  }

  const logPath = path.join(
    app.getPath("userData"),
    "backend.log"
  );

  logStream = fs.createWriteStream(logPath, {
    flags: "a"
  });

  backendProcess = spawn(
    config.command,
    config.args,
    {
      cwd: config.cwd,
      env: environment,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  backendProcess.stdout.on("data", (data) => {
    logStream.write(data);
    if (!app.isPackaged) {
      process.stdout.write(data);
    }
  });

  backendProcess.stderr.on("data", (data) => {
    logStream.write(data);
    if (!app.isPackaged) {
      process.stderr.write(data);
    }
  });

  backendProcess.on("error", (error) => {
    backendError = error.message;
  });

  backendProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error("Backend exited with code:", code);
    }
  });
}

async function waitForBackend() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (backendError) return false;

    if (
      backendProcess &&
      (
        backendProcess.exitCode !== null ||
        backendProcess.signalCode !== null
      )
    ) {
      return false;
    }

    if (await checkBackend()) {
      return true;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 500)
    );
  }

  return false;
}

const approvedHosts = new Set([
  "www.fmcsa.dot.gov",
  "fmcsa.dot.gov",
  "safer.fmcsa.dot.gov",
  "motus.dot.gov",
  "data.transportation.gov"
]);

function openApprovedLink(rawUrl) {
  try {
    const target = new URL(rawUrl);

    if (
      target.protocol === "https:" &&
      approvedHosts.has(target.hostname)
    ) {
      shell.openExternal(target.toString())
        .catch(console.error);
    }
  } catch {
    // Ignore invalid external URLs.
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    title: "LaneCove",
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(
    ({ url }) => {
      openApprovedLink(url);
      return { action: "deny" };
    }
  );

  mainWindow.webContents.on(
    "will-navigate",
    (event, url) => {
      try {
        if (new URL(url).origin !== APP_URL) {
          event.preventDefault();
          openApprovedLink(url);
        }
      } catch {
        event.preventDefault();
      }
    }
  );

  mainWindow.loadURL(APP_URL);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

if (singleInstance) {
  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler(
      (_contents, _permission, callback) => {
        callback(false);
      }
    );

    if (app.isPackaged) {
      const required = [
        "DB_HOST",
        "DB_PORT",
        "DB_NAME",
        "DB_USER",
        "DB_PASSWORD"
      ];

      const missing = required.filter(
        (name) => !process.env[name]
      );

      if (missing.length > 0) {
        dialog.showErrorBox(
          "LaneCove Database Setup Required",
          "PostgreSQL must be configured before " +
          "LaneCove can start.\n\n" +
          "Missing settings:\n" +
          missing.join("\n")
        );

        app.quit();
        return;
      }
    }

    const available = await portIsAvailable();

    if (!available) {
      dialog.showErrorBox(
        "LaneCove Already Running",
        "Port 8000 is already in use.\n\n" +
        "Close the previous backend before " +
        "launching LaneCove."
      );

      app.quit();
      return;
    }

    startBackend();

    const ready = await waitForBackend();

    if (!ready) {
      dialog.showErrorBox(
        "LaneCove Startup Failed",
        "The backend could not start.\n\n" +
        "Check that PostgreSQL is running " +
        "and the database settings are correct.\n\n" +
        "Backend log location:\n" +
        path.join(app.getPath("userData"), "backend.log")
      );

      app.quit();
      return;
    }

    createWindow();
  });
}

app.on("before-quit", () => {
  if (
    backendProcess &&
    backendProcess.exitCode === null &&
    backendProcess.signalCode === null
  ) {
    backendProcess.kill();
  }

  if (logStream) {
    logStream.end();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
