import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "StyleDrop — AI 스타일 분석";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "linear-gradient(135deg, #06070A 0%, #0D1117 50%, #090D12 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* 배경 글로우 */}
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,255,200,0.08) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
        {/* 로고 텍스트 */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: "-0.04em",
            marginBottom: 24,
          }}
        >
          Style<span style={{ color: "#00FFC8" }}>Drop</span>
        </div>
        {/* 서브 */}
        <div
          style={{
            fontSize: 32,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "-0.01em",
          }}
        >
          사진 한 장으로 AI가 분석하는 나만의 스타일
        </div>
        {/* 태그 */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 40,
          }}
        >
          {["AI 스타일 분석", "퍼스널컬러", "패션 추천"].map((tag) => (
            <div
              key={tag}
              style={{
                padding: "8px 20px",
                borderRadius: 100,
                border: "1px solid rgba(0,255,200,0.3)",
                color: "rgba(0,255,200,0.8)",
                fontSize: 20,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
        {/* 도메인 */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            color: "rgba(255,255,255,0.25)",
            fontSize: 22,
            letterSpacing: "0.02em",
          }}
        >
          styledrop.cloud
        </div>
      </div>
    ),
    { ...size },
  );
}
