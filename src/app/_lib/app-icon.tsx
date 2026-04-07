import { ImageResponse } from "next/og";
import fs from "node:fs/promises";
import path from "node:path";

type IconSize = {
  width: number;
  height: number;
};

const IMAGE_PATH = path.join(process.cwd(), "public", "santa-app-icon-source.jpg");
const FONT_PATH = path.join(process.cwd(), "public", "fonts", "Unbounded-Bold.ttf");

let imageDataUrlPromise: Promise<string> | null = null;
let fontDataPromise: Promise<ArrayBuffer> | null = null;

async function loadImageDataUrl() {
  if (!imageDataUrlPromise) {
    imageDataUrlPromise = fs.readFile(IMAGE_PATH).then((buffer) => `data:image/jpeg;base64,${buffer.toString("base64")}`);
  }
  return imageDataUrlPromise;
}

async function loadFontData() {
  if (!fontDataPromise) {
    fontDataPromise = fs.readFile(FONT_PATH).then((buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  }
  return fontDataPromise;
}

export async function renderAppIcon(size: IconSize) {
  const [imageSrc, fontData] = await Promise.all([loadImageDataUrl(), loadFontData()]);
  const isLarge = size.width >= 256;
  const titleSize = isLarge ? 60 : 22;
  const subtitleSize = isLarge ? 30 : 11;
  const cardWidth = isLarge ? "76%" : "78%";
  const cardHeight = isLarge ? 160 : 58;
  const radius = isLarge ? 112 : 40;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          background: "#0A0A0A",
        }}
      >
        <img
          src={imageSrc}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 24%",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(5,5,5,0.08) 0%, rgba(5,5,5,0.16) 30%, rgba(5,5,5,0.3) 60%, rgba(5,5,5,0.42) 100%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at center, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.2) 45%, rgba(0,0,0,0.45) 100%)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: cardWidth,
            height: cardHeight,
            borderRadius: radius,
            background: "rgba(9, 9, 9, 0.48)",
            border: "1px solid rgba(255,255,255,0.16)",
            boxShadow: "0 18px 48px rgba(0,0,0,0.26)",
            color: "#ffffff",
            textAlign: "center",
            paddingTop: isLarge ? 10 : 4,
          }}
        >
          <div
            style={{
              fontFamily: "Unbounded",
              fontSize: titleSize,
              lineHeight: 1,
              letterSpacing: isLarge ? "0.02em" : "0.01em",
              textTransform: "uppercase",
              textShadow: "0 6px 22px rgba(0,0,0,0.45)",
            }}
          >
            Style
          </div>
          <div
            style={{
              marginTop: isLarge ? -4 : -1,
              fontFamily: "Unbounded",
              fontSize: subtitleSize,
              lineHeight: 1,
              letterSpacing: isLarge ? "0.38em" : "0.28em",
              textTransform: "uppercase",
              paddingLeft: isLarge ? "0.38em" : "0.28em",
              color: "#F6EBDD",
              opacity: 0.98,
            }}
          >
            DROP
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Unbounded",
          data: fontData,
          style: "normal",
          weight: 700,
        },
      ],
    }
  );
}
