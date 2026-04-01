import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const PROMPT = `너는 아주 냉혹하고 팩트폭력을 날리는 비급 감성의 영화 감독이야.
유저가 제출한 3장의 표정 연기 사진을 순서대로 보고 평가해.
각 사진은 아래 지시문에 따른 연기야:
1번: "내 주식이 상폐됐는데 애인 앞이라 쿨한 척할 때"
2번: "옆집 좀비가 문 두드리는데 숨 참는 연기"
3번: "세상에서 제일 맛없는 걸 먹고 '이거 진짜 맛있다'고 구라 칠 때"

이 사람은 연기를 너무 못해서 무명 배우 수준이야.
다음 구조의 JSON 형태로만 응답해. 한국어로 작성하되 style_prompt만 영어로:
{
  "critique": "[아주 킹받고 병맛스러운 독설 심사평. 각 사진을 구체적으로 언급하며 처참하게 까줄 것. 예: 1번 사진 눈빛이 너무 비열해서 주인공에게 3초 만에 죽는 좀비 4번이 딱이네요. 2번은 그냥 변비 걸린 표정이고, 3번은 맛있다는 표정이 아니라 세금 신고서 보는 표정입니다.]",
  "assigned_role": "[영화 스틸컷에 들어갈 단역 이름. 예: 100m 밖 행인 1, 억울하게 죽는 시체 3, 범인 옆에서 멍때리는 형사 7]",
  "style_prompt": "[이 사람의 얼굴을 활용해 스릴러/느와르 영화의 단역(assigned_role) 스틸컷을 만들 영어 프롬프트. 얼굴 보존 최우선. 2~3문장으로 작성.]"
}`;

export async function POST(request: NextRequest) {
  try {
    const { images } = await request.json();

    if (!Array.isArray(images) || images.length !== 3) {
      return NextResponse.json({ error: "이미지 3장이 필요합니다." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const contents = [
      ...images.map((b64: string) => ({
        inlineData: { mimeType: "image/jpeg" as const, data: b64 },
      })),
      { text: PROMPT },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const textPart = parts.find((p: { text?: string }) => p.text);
    const raw = textPart?.text ?? "{}";

    // JSON 코드블록 wrapping 제거 후 파싱
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const result = JSON.parse(cleaned);

    // 필수 필드 검증
    if (!result.critique || !result.assigned_role || !result.style_prompt) {
      throw new Error("응답 구조가 올바르지 않습니다.");
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[audition/analyze] error:", err);
    return NextResponse.json(
      { error: "감독님이 자리를 비웠습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
