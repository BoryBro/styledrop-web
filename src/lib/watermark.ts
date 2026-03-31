import sharp from "sharp";

export async function addWatermark(imageBase64: string): Promise<string> {
  const imageBuffer = Buffer.from(imageBase64, "base64");
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;

  const fontSize = Math.max(16, Math.round(width * 0.028));
  const edgePad = Math.round(fontSize * 1.0);   // 이미지 끝과의 여백
  const innerPadX = Math.round(fontSize * 0.55); // 배지 내부 좌우 패딩
  const innerPadY = Math.round(fontSize * 0.45); // 배지 내부 상하 패딩

  // 별 크기 & "StyleDrop" 텍스트 너비 근사
  const starSize = Math.round(fontSize * 0.78);
  const gap = Math.round(fontSize * 0.32);
  const textW = Math.round(fontSize * 0.58 * "StyleDrop".length);

  const badgeW = innerPadX * 2 + starSize + gap + textW;
  const badgeH = Math.round(fontSize + innerPadY * 2);

  const badgeX = width - edgePad - badgeW;
  const badgeY = height - edgePad - badgeH;

  // 4각 별(sparkle) SVG path — 폰트 의존 없이 직접 그림
  const cx = badgeX + innerPadX + starSize / 2;
  const cy = badgeY + badgeH / 2;
  const ro = starSize / 2;       // 외부 반지름
  const ri = ro * 0.36;          // 내부 반지름
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

  // 텍스트 baseline: 배지 세로 중앙 + 폰트 크기의 약 35%
  const textX = badgeX + innerPadX + starSize + gap;
  const textY = badgeY + badgeH / 2 + fontSize * 0.36;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect
      x="${badgeX}" y="${badgeY}"
      width="${badgeW}" height="${badgeH}"
      rx="7" ry="7"
      fill="black" fill-opacity="0.38"
    />
    <path d="${starPath}" fill="white" fill-opacity="0.88"/>
    <text
      x="${textX}" y="${textY}"
      font-family="Arial, Helvetica, sans-serif"
      font-weight="bold"
      font-size="${fontSize}"
      fill="white"
      fill-opacity="0.88"
      letter-spacing="0.4"
    >StyleDrop</text>
  </svg>`;

  const result = await sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();

  return result.toString("base64");
}
