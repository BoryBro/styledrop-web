import sharp from "sharp";

export async function addWatermark(imageBase64: string): Promise<string> {
  const imageBuffer = Buffer.from(imageBase64, "base64");
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;

  const fontSize = Math.max(18, Math.round(width * 0.032));
  const padding = Math.round(fontSize * 1.1);

  // 텍스트 너비 근사 (✦ + 공백 + "StyleDrop", Arial bold 기준)
  const label = "✦ StyleDrop";
  const textWidth = fontSize * 0.6 * label.length;
  const textHeight = fontSize;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect
      x="${width - textWidth - padding * 2}"
      y="${height - textHeight - padding * 1.5}"
      width="${textWidth + padding * 1.4}"
      height="${textHeight + padding * 0.9}"
      rx="6" ry="6"
      fill="black" fill-opacity="0.35"
    />
    <text
      x="${width - padding}"
      y="${height - padding}"
      text-anchor="end"
      font-family="Arial, sans-serif"
      font-weight="bold"
      font-size="${fontSize}"
      fill="white"
      fill-opacity="0.85"
      letter-spacing="0.5"
    >&#x2726; StyleDrop</text>
  </svg>`;

  const result = await sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();

  return result.toString("base64");
}
