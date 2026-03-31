import sharp from "sharp";

export async function addWatermark(imageBase64: string): Promise<string> {
  const imageBuffer = Buffer.from(imageBase64, "base64");
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;

  const unit = Math.max(14, Math.round(width * 0.026));
  const pad = Math.round(unit * 0.9);

  // 배지 크기
  const badgeW = unit * 4;
  const badgeH = unit * 1.6;
  const bx = width - pad - badgeW;
  const by = height - pad - badgeH;
  const cx = bx + badgeW / 2;
  const cy = by + badgeH / 2;

  // 4-pointed star path (폰트 불필요)
  const starR = unit * 0.42;
  const starInner = starR * 0.36;
  function starPath(ox: number, oy: number, ro: number, ri: number): string {
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 4) * i - Math.PI / 2;
      const r = i % 2 === 0 ? ro : ri;
      pts.push(`${ox + r * Math.cos(angle)},${oy + r * Math.sin(angle)}`);
    }
    return `M ${pts.join(" L ")} Z`;
  }

  // "SD" — S와 D를 간단한 rect 조합으로 렌더링 (폰트 없이)
  const charW = unit * 0.52;
  const charH = unit * 0.72;
  const charGap = unit * 0.18;
  const totalTextW = charW * 2 + charGap;
  const textStartX = cx - totalTextW / 2 + unit * 0.5;
  const textY = cy - charH / 2;
  const th = charH / 5; // stroke thickness

  // S: 5 rect segments (top, mid, bot horizontal + top-left, bot-right vertical)
  const sx = textStartX;
  const sRects = [
    // top bar
    `<rect x="${sx}" y="${textY}" width="${charW}" height="${th}" rx="1"/>`,
    // mid bar
    `<rect x="${sx}" y="${textY + charH / 2 - th / 2}" width="${charW}" height="${th}" rx="1"/>`,
    // bot bar
    `<rect x="${sx}" y="${textY + charH - th}" width="${charW}" height="${th}" rx="1"/>`,
    // top-left vertical
    `<rect x="${sx}" y="${textY}" width="${th}" height="${charH / 2}" rx="1"/>`,
    // bot-right vertical
    `<rect x="${sx + charW - th}" y="${textY + charH / 2}" width="${th}" height="${charH / 2}" rx="1"/>`,
  ].join("");

  // D: left vertical + top/bot bar + right arc (simplified as rect with radius)
  const dx = textStartX + charW + charGap;
  const dRects = [
    `<rect x="${dx}" y="${textY}" width="${th}" height="${charH}" rx="1"/>`,
    `<rect x="${dx}" y="${textY}" width="${charW * 0.75}" height="${th}" rx="1"/>`,
    `<rect x="${dx}" y="${textY + charH - th}" width="${charW * 0.75}" height="${th}" rx="1"/>`,
    `<rect x="${dx + charW * 0.75 - th}" y="${textY}" width="${th}" height="${charH}" rx="1"/>`,
  ].join("");

  const starCx = bx + unit * 0.72;
  const starCy = cy;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="${bx}" y="${by}" width="${badgeW}" height="${badgeH}" rx="${unit * 0.32}" fill="black" fill-opacity="0.42"/>
    <path d="${starPath(starCx, starCy, starR, starInner)}" fill="white" fill-opacity="0.9"/>
    <g fill="white" fill-opacity="0.82">${sRects}${dRects}</g>
  </svg>`;

  const result = await sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();

  return result.toString("base64");
}
