const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, nativeImage } = require("electron");

const root = path.resolve(__dirname, "..");
const assets = path.join(root, "assets");
const svgPath = path.join(assets, "app-icon.svg");
const pngPath = path.join(assets, "app-icon.png");
const icoPath = path.join(assets, "app-icon.ico");

function writePngIco(images, targetPath) {
  const headerSize = 6;
  const entrySize = 16;
  let imageOffset = headerSize + entrySize * images.length;
  const totalSize = imageOffset + images.reduce((sum, image) => sum + image.pngBytes.length, 0);
  const out = Buffer.alloc(totalSize);

  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(images.length, 4);

  for (const [index, image] of images.entries()) {
    const entryOffset = headerSize + entrySize * index;
    const sizeByte = image.size >= 256 ? 0 : image.size;
    out.writeUInt8(sizeByte, entryOffset);
    out.writeUInt8(sizeByte, entryOffset + 1);
    out.writeUInt8(0, entryOffset + 2);
    out.writeUInt8(0, entryOffset + 3);
    out.writeUInt16LE(1, entryOffset + 4);
    out.writeUInt16LE(32, entryOffset + 6);
    out.writeUInt32LE(image.pngBytes.length, entryOffset + 8);
    out.writeUInt32LE(imageOffset, entryOffset + 12);
    image.pngBytes.copy(out, imageOffset);
    imageOffset += image.pngBytes.length;
  }

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

  const svgMarkup = fs.readFileSync(svgPath, "utf8");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body {
      width: 256px;
      height: 256px;
      margin: 0;
      overflow: hidden;
      background: transparent;
    }
    svg {
      width: 256px;
      height: 256px;
      display: block;
    }
  </style>
</head>
<body>
  ${svgMarkup}
</body>
</html>`;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise((resolve) => setTimeout(resolve, 250));

  const image = await win.capturePage({ x: 0, y: 0, width: 256, height: 256 });
  const capturedPng = image.toPNG();
  const iconImage = nativeImage.createFromBuffer(capturedPng);
  const pngBytes = iconImage.resize({ width: 256, height: 256, quality: "best" }).toPNG();
  fs.writeFileSync(pngPath, pngBytes);
  const icoImages = [256, 128, 64, 48, 32, 16].map((size) => ({
    size,
    pngBytes: iconImage.resize({ width: size, height: size, quality: "best" }).toPNG(),
  }));
  writePngIco(icoImages, icoPath);

  console.log(`Rendered ${pngPath}`);
  console.log(`Rendered ${icoPath}`);
  app.quit();
});
