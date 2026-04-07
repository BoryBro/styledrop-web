import { ImageResponse } from "next/og";
import fs from "node:fs/promises";
import path from "node:path";

type IconSize = {
  width: number;
  height: number;
};

const IMAGE_PATH = path.join(process.cwd(), "public", "santa-app-icon-source.jpg");

let imageDataUrlPromise: Promise<string> | null = null;

async function loadImageDataUrl() {
  if (!imageDataUrlPromise) {
    imageDataUrlPromise = fs.readFile(IMAGE_PATH).then((buffer) => `data:image/jpeg;base64,${buffer.toString("base64")}`);
  }
  return imageDataUrlPromise;
}

export async function renderAppIcon(size: IconSize) {
  const imageSrc = await loadImageDataUrl();

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
            width: "116%",
            height: "116%",
            left: "-8%",
            top: "-8%",
            objectFit: "cover",
            objectPosition: "center 16%",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(5,5,5,0.04) 0%, rgba(5,5,5,0.08) 30%, rgba(5,5,5,0.16) 60%, rgba(5,5,5,0.22) 100%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at center, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.26) 100%)",
          }}
        />
      </div>
    ),
    size
  );
}
