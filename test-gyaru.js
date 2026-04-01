// 갸루 A/B 프롬프트 테스트 스크립트
// 기존 썸네일 이미지로 양쪽 프롬프트를 테스트하여 결과물 비교

const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";

async function test() {
  // 테스트용 이미지 (기존 flash-before.jpg 사용)
  const testImagePath = path.join(__dirname, "public/thumbnails/flash-before.jpg");
  const imageBuffer = fs.readFileSync(testImagePath);
  const imageBase64 = imageBuffer.toString("base64");

  console.log(`\n🎌 갸루 A/B 프롬프트 테스트 시작`);
  console.log(`📸 테스트 이미지: flash-before.jpg (${(imageBuffer.length / 1024).toFixed(0)}KB)\n`);

  for (const styleId of ["gyaru-a", "gyaru-b"]) {
    console.log(`── ${styleId} 테스트 중... (약 15-30초 소요)`);
    const start = Date.now();

    try {
      const res = await fetch(`${BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style: styleId,
          imageBase64,
          mimeType: "image/jpeg",
        }),
      });

      const data = await res.json();
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      if (data.image) {
        // 결과 이미지를 파일로 저장
        const outputPath = path.join(__dirname, `public/thumbnails/${styleId}-test-result.jpg`);
        const imgBuffer = Buffer.from(data.image, "base64");
        fs.writeFileSync(outputPath, imgBuffer);
        console.log(`   ✅ 성공! ${elapsed}초 | 결과: ${outputPath}`);
        console.log(`   📏 결과 크기: ${(imgBuffer.length / 1024).toFixed(0)}KB`);
      } else {
        console.log(`   ❌ 실패: ${data.error} (${elapsed}초)`);
      }
    } catch (err) {
      console.log(`   ❌ 에러: ${err.message}`);
    }
  }

  console.log(`\n🏁 테스트 완료! 결과 파일을 확인해주세요:`);
  console.log(`   - public/thumbnails/gyaru-a-test-result.jpg`);
  console.log(`   - public/thumbnails/gyaru-b-test-result.jpg`);
}

test();
