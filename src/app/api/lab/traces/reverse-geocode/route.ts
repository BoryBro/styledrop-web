import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { latitude, longitude } = await request.json();

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "좌표가 올바르지 않아요." }, { status: 400 });
  }

  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "카카오 REST 키가 없어요." }, { status: 500 });
  }

  const response = await fetch(
    `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`,
    {
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return NextResponse.json({ error: "현재 위치 지역 변환에 실패했어요." }, { status: 502 });
  }

  const data = (await response.json()) as {
    documents?: Array<{
      region_type: string;
      region_1depth_name: string;
      region_2depth_name: string;
      region_3depth_name: string;
    }>;
  };

  const region = data.documents?.find((item) => item.region_type === "H") ?? data.documents?.[0];

  if (!region) {
    return NextResponse.json({ error: "현재 위치 지역 정보를 찾지 못했어요." }, { status: 404 });
  }

  return NextResponse.json({
    region: {
      sido: region.region_1depth_name,
      sigungu: region.region_2depth_name,
      dong: region.region_3depth_name,
    },
  });
}
