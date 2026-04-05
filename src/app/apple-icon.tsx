import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

const BG = "#0A0A0A";
const ORANGE = "#C9571A";
const SOFT = "#F3B38F";

export default function AppleIcon() {
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
            width: 148,
            height: 148,
            borderRadius: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
            border: "1px solid rgba(201,87,26,0.28)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 40px rgba(0,0,0,0.28)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 10,
              borderRadius: 32,
              border: "1px solid rgba(243,179,143,0.12)",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 112,
              height: 112,
              borderRadius: 999,
              border: "1px solid rgba(201,87,26,0.32)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 22,
              left: 28,
              width: 8,
              height: 8,
              borderRadius: 999,
              background: ORANGE,
              boxShadow: "0 0 10px rgba(201,87,26,0.5)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 28,
              right: 24,
              width: 5,
              height: 5,
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
              transform: "translateY(-2px)",
            }}
          >
            <span
              style={{
                fontSize: 80,
                fontWeight: 900,
                letterSpacing: "-0.08em",
                color: "white",
              }}
            >
              S
            </span>
            <span
              style={{
                marginTop: -2,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.34em",
                color: ORANGE,
                paddingLeft: "0.34em",
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
