const { app, BrowserWindow, protocol, net, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");
// 固定安全的应用 origin，安装升级仍能访问同一套 IndexedDB。
protocol.registerSchemesAsPrivileged([
  {
    scheme: "focus",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
let window;
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app.whenReady().then(() => {
    const root = path.resolve(__dirname, "../dist");
    protocol.handle("focus", (request) => {
      try {
        const url = new URL(request.url);
        if (url.hostname !== "app")
          return new Response("Forbidden", { status: 403 });
        const relative =
          decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
        const file = path.resolve(root, relative);
        if (
          !file.startsWith(root + path.sep) ||
          !fs.existsSync(file) ||
          !fs.statSync(file).isFile()
        )
          return new Response("Not found", { status: 404 });
        return net.fetch(pathToFileURL(file).toString());
      } catch {
        return new Response("Bad request", { status: 400 });
      }
    });
    function createWindow() {
      window = new BrowserWindow({
        width: 1360,
        height: 940,
        minWidth: 360,
        minHeight: 600,
        title: "专注时光",
        backgroundColor: "#f5f7f4",
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          devTools: !app.isPackaged,
        },
      });
      window.webContents.session.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
      );
      window.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//.test(url)) void shell.openExternal(url);
        return { action: "deny" };
      });
      window.webContents.on("will-navigate", (event, url) => {
        if (!url.startsWith("focus://app/")) event.preventDefault();
      });
      window.webContents.session.on("will-download", (_event, item) => {
        item.setSaveDialogOptions({
          title: "导出专注时光备份",
          defaultPath: path.join(app.getPath("downloads"), item.getFilename()),
        });
      });
      void window.loadURL("focus://app/index.html");
    }
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
