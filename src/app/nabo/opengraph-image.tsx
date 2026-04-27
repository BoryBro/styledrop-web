import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "내가 보는 너 | StyleDrop";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function NaboOgImage() {
  const [
    kkubulim,
    unboundedBold,
    unboundedBlack,
    pretendardSemiBold,
    pretendardBlack,
  ] = await Promise.all([
    readFile(join(process.cwd(), "public/fonts/BMKkubulim.otf")),
    readFile(join(process.cwd(), "public/fonts/Unbounded-Bold.ttf")),
    readFile(join(process.cwd(), "public/fonts/Unbounded-Black.ttf")),
    readFile(join(process.cwd(), "public/fonts/Pretendard-SemiBold.ttf")),
    readFile(join(process.cwd(), "public/fonts/Pretendard-Black.ttf")),
  ]);

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
          padding: "44px",
          fontFamily: "Pretendard",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 18% 10%, rgba(34,197,94,0.18) 0%, rgba(248,250,252,0) 36%), radial-gradient(circle at 86% 88%, rgba(15,23,42,0.08) 0%, rgba(248,250,252,0) 34%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            width: "100%",
            height: "100%",
            overflow: "hidden",
            borderRadius: 42,
            background: "#07101D",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 30px 90px rgba(7,16,29,0.22)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 16% 18%, rgba(34,197,94,0.2) 0%, rgba(34,197,94,0) 30%), linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(7,16,29,0) 48%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: -30,
              bottom: -14,
              color: "rgba(255,255,255,0.035)",
              fontSize: 138,
              fontWeight: 900,
              letterSpacing: "-0.08em",
              lineHeight: 1,
              fontFamily: "Unbounded",
            }}
          >
            ANONYMOUS
          </div>

          <div
            style={{
              position: "absolute",
              top: 48,
              left: 52,
              right: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                color: "#22C55E",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontFamily: "Unbounded",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 4,
                  background: "#22C55E",
                }}
              />
              Anonymous Lab
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px 18px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.32)",
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontFamily: "Unbounded",
              }}
            >
              Beta
            </div>
          </div>

          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              padding: "172px 52px 66px",
              color: "#FFFFFF",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                maxWidth: 850,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 4,
                  background: "#22C55E",
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
                  fontFamily: "Unbounded",
                }}
              >
                Who sees you?
              </div>
              <div
                style={{
                  fontSize: 98,
                  fontWeight: 400,
                  lineHeight: 0.92,
                  letterSpacing: "-0.05em",
                  fontFamily: "BMKkubulim",
                }}
              >
                내가 보는 너
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginTop: 56,
                  fontSize: 28,
                  lineHeight: 1.45,
                  color: "rgba(255,255,255,0.52)",
                  letterSpacing: "-0.02em",
                }}
              >
                익명으로 모이는 나의 인상 리포트
                <div style={{ color: "rgba(255,255,255,0.32)" }}>
                  누가 뭐라 했는지는 절대 안 보여요
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "auto",
              }}
            >
              <div style={{ display: "flex", gap: 14 }}>
                {["3명 기본 공개", "5명 전체 공개", "익명 보호"].map((tag) => (
                  <div
                    key={tag}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "10px 18px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.58)",
                      fontSize: 20,
                      fontWeight: 700,
                    }}
                  >
                    {tag}
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  color: "#22C55E",
                  fontSize: 24,
                  fontWeight: 900,
                  fontFamily: "Pretendard",
                }}
              >
                시작하기
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 46,
                    height: 46,
                    borderRadius: 999,
                    background: "#22C55E",
                    color: "#07101D",
                    fontSize: 28,
                    fontWeight: 900,
                  }}
                >
                  →
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "BMKkubulim",
          data: kkubulim,
          style: "normal",
          weight: 400,
        },
        {
          name: "Unbounded",
          data: unboundedBold,
          style: "normal",
          weight: 700,
        },
        {
          name: "Unbounded",
          data: unboundedBlack,
          style: "normal",
          weight: 900,
        },
        {
          name: "Pretendard",
          data: pretendardSemiBold,
          style: "normal",
          weight: 700,
        },
        {
          name: "Pretendard",
          data: pretendardBlack,
          style: "normal",
          weight: 900,
        },
      ],
    },
  );
}
