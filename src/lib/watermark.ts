import sharp from "sharp";

export async function addWatermark(imageBase64: string): Promise<string> {
  const imageBuffer = Buffer.from(imageBase64, "base64");
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;

  const fontSize = Math.max(16, Math.round(width * 0.028));
  const edgePad = Math.round(fontSize * 1.0);
  const innerPadX = Math.round(fontSize * 0.55);
  const innerPadY = Math.round(fontSize * 0.45);

  const starSize = Math.round(fontSize * 0.78);
  const gap = Math.round(fontSize * 0.32);
  const textW = Math.round(fontSize * 0.58 * "StyleDrop".length);

  const badgeW = innerPadX * 2 + starSize + gap + textW;
  const badgeH = Math.round(fontSize + innerPadY * 2);

  const badgeX = width - edgePad - badgeW;
  const badgeY = height - edgePad - badgeH;

  const cx = badgeX + innerPadX + starSize / 2;
  const cy = badgeY + badgeH / 2;
  const ro = starSize / 2;
  const ri = ro * 0.36;
  const starPath = [
    `M ${cx},${cy - ro}`,
    `L ${cx + ri},${cy - ri}`,
    `L ${cx + ro},${cy}`,
    `L ${cx + ri},${cy + ri}`,
    `L ${cx},${cy + ro}`,
    `L ${cx - ri},${cy + ri}`,
    `L ${cx - ro},${cy}`,
    `L ${cx - ri},${cy - ri}`,
    "Z",
  ].join(" ");

  const textX = badgeX + innerPadX + starSize + gap;
  const textY = badgeY + badgeH / 2 + fontSize * 0.36;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="7" ry="7" fill="black" fill-opacity="0.38"/>
    <path d="${starPath}" fill="white" fill-opacity="0.88"/>
    <text x="${textX}" y="${textY}" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="${fontSize}" fill="white" fill-opacity="0.88" letter-spacing="0.4">StyleDrop</text>
  </svg>`;

  const result = await sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();

  return result.toString("base64");
}
