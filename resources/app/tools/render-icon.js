const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { app, BrowserWindow } = require("electron");

const root = path.resolve(__dirname, "..");
const assets = path.join(root, "assets");
const svgPath = path.join(assets, "app-icon.svg");
const pngPath = path.join(assets, "app-icon.png");
const icoPath = path.join(assets, "app-icon.ico");

function writePngIco(pngBytes, targetPath) {
  const headerSize = 6;
  const entrySize = 16;
  const imageOffset = headerSize + entrySize;
  const out = Buffer.alloc(imageOffset + pngBytes.length);

  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(1, 4);
  out.writeUInt8(0, 6);
  out.writeUInt8(0, 7);
  out.writeUInt8(0, 8);
  out.writeUInt8(0, 9);
  out.writeUInt16LE(1, 10);
  out.writeUInt16LE(32, 12);
  out.writeUInt32LE(pngBytes.length, 14);
  out.writeUInt32LE(imageOffset, 18);
  pngBytes.copy(out, imageOffset);

  fs.writeFileSync(targetPath, out);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 256,
    height: 256,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false,
    },
  });

  await win.loadURL(pathToFileURL(svgPath).href);
  await new Promise((resolve) => setTimeout(resolve, 250));

  const image = await win.capturePage({ x: 0, y: 0, width: 256, height: 256 });
  const pngBytes = image.toPNG();
  fs.writeFileSync(pngPath, pngBytes);
  writePngIco(pngBytes, icoPath);

  console.log(`Rendered ${pngPath}`);
  console.log(`Rendered ${icoPath}`);
  app.quit();
});
