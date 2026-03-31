import sharp from "sharp";

export async function addWatermark(imageBase64: string): Promise<string> {
  const imageBuffer = Buffer.from(imageBase64, "base64");
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;

  const fontSize = Math.max(14, Math.round(width * 0.032));
  const step = Math.round(Math.min(width, height) / 3.2);

  // 대각선 반복 워터마크 타일 생성
  const tiles: string[] = [];
  for (let row = -2; row < Math.ceil(height / step) + 3; row++) {
    for (let col = -2; col < Math.ceil(width / step) + 3; col++) {
      const x = col * step + (row % 2) * (step / 2);
      const y = row * step;
      tiles.push(`
        <text
          x="${x}" y="${y}"
          font-family="Arial, Helvetica, sans-serif"
          font-weight="bold"
          font-size="${fontSize}"
          fill="white"
          fill-opacity="0.22"
          transform="rotate(-30, ${x}, ${y})"
          letter-spacing="1"
        >StyleDrop</text>
      `);
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    ${tiles.join("")}
  </svg>`;

  const result = await sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 62 })
    .toBuffer();

  return result.toString("base64");
}
