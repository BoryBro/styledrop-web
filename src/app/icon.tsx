import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

const BG = "#0A0A0A";
const ORANGE = "#C9571A";
const SOFT = "#F3B38F";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `radial-gradient(circle at 30% 20%, rgba(243,179,143,0.28), transparent 30%), linear-gradient(180deg, #17110E 0%, ${BG} 100%)`,
        }}
      >
        <div
          style={{
            width: 416,
            height: 416,
            borderRadius: 112,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
            border: "2px solid rgba(201,87,26,0.28)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 32px 80px rgba(0,0,0,0.28)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 28,
              borderRadius: 92,
              border: "1px solid rgba(243,179,143,0.12)",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 312,
              height: 312,
              borderRadius: 999,
              border: "2px solid rgba(201,87,26,0.32)",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 250,
              height: 250,
              borderRadius: 999,
              border: "1px solid rgba(243,179,143,0.15)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 64,
              left: 104,
              width: 22,
              height: 22,
              borderRadius: 999,
              background: ORANGE,
              boxShadow: "0 0 24px rgba(201,87,26,0.5)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 78,
              right: 92,
              width: 12,
              height: 12,
              borderRadius: 999,
              background: SOFT,
              opacity: 0.9,
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 0.9,
              transform: "translateY(-4px)",
            }}
          >
            <span
              style={{
                fontSize: 212,
                fontWeight: 900,
                letterSpacing: "-0.08em",
                color: "white",
                textShadow: "0 12px 40px rgba(0,0,0,0.35)",
              }}
            >
              S
            </span>
            <span
              style={{
                marginTop: -6,
                fontSize: 34,
                fontWeight: 800,
                letterSpacing: "0.42em",
                color: ORANGE,
                paddingLeft: "0.42em",
              }}
            >
              DROP
            </span>
          </div>
        </div>
      </div>
    ),
    size
  );
}
