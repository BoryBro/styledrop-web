import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "여행을 같이 간다면 | StyleDrop";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TravelTogetherOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#F8FAFC",
          fontFamily: "sans-serif",
          padding: "44px",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 18% 12%, rgba(191,219,254,0.75) 0%, rgba(248,250,252,0) 38%), radial-gradient(circle at 82% 90%, rgba(219,234,254,0.95) 0%, rgba(248,250,252,0) 34%)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            width: "100%",
            height: "100%",
            borderRadius: "42px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.55)",
            background: "#07101D",
            boxShadow: "0 28px 80px rgba(7,16,29,0.18)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 80% 60% at 10% 100%, rgba(59,130,246,0.18) 0%, transparent 70%)",
            }}
          />

          <div
            style={{
              position: "absolute",
              bottom: "-4%",
              right: "-3%",
              fontSize: 178,
              lineHeight: 1,
              letterSpacing: "-0.06em",
              color: "rgba(255,255,255,0.03)",
              fontWeight: 900,
            }}
          >
            TRAVEL
          </div>

          <div
            style={{
              position: "absolute",
              top: 48,
              left: 52,
              right: 52,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                color: "#3B82F6",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 4,
                  background: "#3B82F6",
                }}
              />
              Travel Match
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px 18px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.3)",
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              Beta
            </div>
          </div>

          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              width: "100%",
              height: "100%",
              padding: "172px 52px 66px",
              color: "#FFFFFF",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                maxWidth: 860,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 4,
                  background: "#3B82F6",
                  marginBottom: 24,
                }}
              />
              <div
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Trip chemistry
              </div>
              <div
                style={{
                  fontSize: 88,
                  fontWeight: 900,
                  lineHeight: 0.94,
                  letterSpacing: "-0.05em",
                }}
              >
                여행을 같이 간다면
              </div>
              <div
                style={{
                  marginTop: 56,
                  fontSize: 28,
                  lineHeight: 1.45,
                  color: "rgba(255,255,255,0.5)",
                  letterSpacing: "-0.02em",
                }}
              >
                2인 궁합 · 티어 결과 · 추천 여행지
                <div style={{ color: "rgba(255,255,255,0.3)" }}>
                  같이 가면 진짜 맞는지 먼저 봅니다
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "auto",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: 14 }}>
                {["2인 여행 궁합", "20문항"].map((tag) => (
                  <div
                    key={tag}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "10px 18px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.4)",
                      fontSize: 20,
                      background: "transparent",
                      fontWeight: 800,
                    }}
                  >
                    {tag}
                  </div>
                ))}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "10px 18px",
                    borderRadius: 999,
                    border: "1px solid rgba(96,165,250,0.4)",
                    color: "#60A5FA",
                    fontSize: 20,
                    background: "transparent",
                    fontWeight: 800,
                  }}
                >
                  NEW
                </div>
              </div>

              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 999,
                  background: "#3B82F6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  fontSize: 34,
                  fontWeight: 900,
                }}
              >
                →
              </div>
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              right: 52,
              top: 166,
              bottom: 82,
              width: 2,
              background:
                "linear-gradient(to bottom, transparent, rgba(59,130,246,0.5), transparent)",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
