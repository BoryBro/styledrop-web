import sharp from "sharp";
import fs from "fs";
import path from "path";

let _fontBase64: string | null = null;
function getFontBase64(): string {
  if (_fontBase64) return _fontBase64;
  const fontPath = path.join(process.cwd(), "public/fonts/Montserrat-Bold.ttf");
  _fontBase64 = fs.readFileSync(fontPath).toString("base64");
  return _fontBase64;
}

export async function addWatermark(imageBase64: string): Promise<string> {
  const imageBuffer = Buffer.from(imageBase64, "base64");
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;

  // PNG 워터마크 파일이 있으면 우선 사용
  const pngPath = path.join(process.cwd(), "public/watermark.png");
  if (fs.existsSync(pngPath)) {
    const targetW = Math.round(width * 0.28);
    const wmBuf = await sharp(fs.readFileSync(pngPath))
      .resize(targetW, null, { fit: "inside" })
      .toBuffer();
    const wmMeta = await sharp(wmBuf).metadata();
    const wmW = wmMeta.width ?? targetW;
    const wmH = wmMeta.height ?? Math.round(targetW * 0.25);
    const edgePad = Math.round(width * 0.04);
    const result = await sharp(imageBuffer)
      .composite([{
        input: wmBuf,
        top: height - edgePad - wmH,
        left: width - edgePad - wmW,
        blend: "over",
      }])
      .jpeg({ quality: 88 })
      .toBuffer();
    return result.toString("base64");
  }

  const fontSize = Math.max(15, Math.round(width * 0.026));
  const edgePad = Math.round(fontSize * 1.1);
  const innerPadX = Math.round(fontSize * 0.6);
  const innerPadY = Math.round(fontSize * 0.42);

  // 4-pointed star (SVG path, 폰트 불필요)
  const starSize = Math.round(fontSize * 0.72);
  const gap = Math.round(fontSize * 0.3);
  // 텍스트 폭 추정 (Montserrat Bold ~0.62 em/char)
  const text = "StyleDrop";
  const textW = Math.round(fontSize * 0.62 * text.length);

  const badgeW = innerPadX * 2 + starSize + gap + textW;
  const badgeH = Math.round(fontSize + innerPadY * 2);
  const badgeX = width - edgePad - badgeW;
  const badgeY = height - edgePad - badgeH;

  // 별 중심
  const scx = badgeX + innerPadX + starSize / 2;
  const scy = badgeY + badgeH / 2;
  const ro = starSize / 2;
  const ri = ro * 0.36;
  const starPoints: string[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const r = i % 2 === 0 ? ro : ri;
    starPoints.push(`${scx + r * Math.cos(angle)},${scy + r * Math.sin(angle)}`);
  }
  const starPath = `M ${starPoints.join(" L ")} Z`;

  const textX = badgeX + innerPadX + starSize + gap;
  const textY = badgeY + badgeH / 2 + fontSize * 0.36;

  const fontBase64 = getFontBase64();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <style>
        @font-face {
          font-family: 'Montserrat';
          font-weight: 700;
          src: url('data:font/truetype;base64,${fontBase64}') format('truetype');
        }
      </style>
    </defs>
    <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="6" ry="6" fill="black" fill-opacity="0.40"/>
    <path d="${starPath}" fill="white" fill-opacity="0.90"/>
    <text
      x="${textX}" y="${textY}"
      font-family="Montserrat, sans-serif"
      font-weight="700"
      font-size="${fontSize}"
      fill="white"
      fill-opacity="0.90"
      letter-spacing="0.3"
    >${text}</text>
  </svg>`;

  const result = await sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();

  return result.toString("base64");
}
