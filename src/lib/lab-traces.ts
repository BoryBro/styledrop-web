export type SidoOption = {
  id: string;
  label: string;
  shortLabel: string;
  mapCode: string;
  anchor: { x: number; y: number };
};

export const SIDO_OPTIONS: SidoOption[] = [
  { id: "seoul", label: "서울특별시", shortLabel: "서울", mapCode: "1100000000", anchor: { x: 49, y: 24 } },
  { id: "busan", label: "부산광역시", shortLabel: "부산", mapCode: "2600000000", anchor: { x: 76, y: 78 } },
  { id: "daegu", label: "대구광역시", shortLabel: "대구", mapCode: "2700000000", anchor: { x: 68, y: 61 } },
  { id: "incheon", label: "인천광역시", shortLabel: "인천", mapCode: "2800000000", anchor: { x: 41, y: 28 } },
  { id: "gwangju", label: "광주광역시", shortLabel: "광주", mapCode: "2900000000", anchor: { x: 37, y: 74 } },
  { id: "daejeon", label: "대전광역시", shortLabel: "대전", mapCode: "3000000000", anchor: { x: 53, y: 51 } },
  { id: "ulsan", label: "울산광역시", shortLabel: "울산", mapCode: "3100000000", anchor: { x: 80, y: 67 } },
  { id: "sejong", label: "세종특별자치시", shortLabel: "세종", mapCode: "3611000000", anchor: { x: 50, y: 46 } },
  { id: "gyeonggi", label: "경기도", shortLabel: "경기", mapCode: "4100000000", anchor: { x: 53, y: 33 } },
  { id: "gangwon", label: "강원특별자치도", shortLabel: "강원", mapCode: "5100000000", anchor: { x: 68, y: 27 } },
  { id: "chungbuk", label: "충청북도", shortLabel: "충북", mapCode: "4300000000", anchor: { x: 61, y: 45 } },
  { id: "chungnam", label: "충청남도", shortLabel: "충남", mapCode: "4400000000", anchor: { x: 44, y: 48 } },
  { id: "jeonbuk", label: "전북특별자치도", shortLabel: "전북", mapCode: "5200000000", anchor: { x: 44, y: 63 } },
  { id: "jeonnam", label: "전라남도", shortLabel: "전남", mapCode: "4600000000", anchor: { x: 33, y: 82 } },
  { id: "gyeongbuk", label: "경상북도", shortLabel: "경북", mapCode: "4700000000", anchor: { x: 72, y: 50 } },
  { id: "gyeongnam", label: "경상남도", shortLabel: "경남", mapCode: "4800000000", anchor: { x: 60, y: 75 } },
  { id: "jeju", label: "제주특별자치도", shortLabel: "제주", mapCode: "5000000000", anchor: { x: 29, y: 108 } },
];

const SIDO_ALIASES: Record<string, string> = {
  서울: "서울특별시",
  서울특별시: "서울특별시",
  부산: "부산광역시",
  부산광역시: "부산광역시",
  대구: "대구광역시",
  대구광역시: "대구광역시",
  인천: "인천광역시",
  인천광역시: "인천광역시",
  광주: "광주광역시",
  광주광역시: "광주광역시",
  대전: "대전광역시",
  대전광역시: "대전광역시",
  울산: "울산광역시",
  울산광역시: "울산광역시",
  세종: "세종특별자치시",
  세종특별자치시: "세종특별자치시",
  경기: "경기도",
  경기도: "경기도",
  강원: "강원특별자치도",
  강원도: "강원특별자치도",
  강원특별자치도: "강원특별자치도",
  충북: "충청북도",
  충청북도: "충청북도",
  충남: "충청남도",
  충청남도: "충청남도",
  전북: "전북특별자치도",
  전라북도: "전북특별자치도",
  전북특별자치도: "전북특별자치도",
  전남: "전라남도",
  전라남도: "전라남도",
  경북: "경상북도",
  경상북도: "경상북도",
  경남: "경상남도",
  경상남도: "경상남도",
  제주: "제주특별자치도",
  제주도: "제주특별자치도",
  제주특별자치도: "제주특별자치도",
};

export function normalizeRegionPart(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeSido(value: string | null | undefined) {
  const normalized = normalizeRegionPart(value);
  return SIDO_ALIASES[normalized] ?? normalized;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function jitterFromHash(hash: number) {
  return ((hash % 10000) / 9999) * 2 - 1;
}

export function buildTraceJitter(input: {
  sido: string;
  sigungu: string;
  dong: string;
  userId: string;
}) {
  const seedBase = `${normalizeSido(input.sido)}:${normalizeRegionPart(input.sigungu)}:${normalizeRegionPart(input.dong)}:${input.userId}`;
  const hashX = hashString(`${seedBase}:x`);
  const hashY = hashString(`${seedBase}:y`);

  return {
    x: jitterFromHash(hashX),
    y: jitterFromHash(hashY),
  };
}

export function formatTraceRegion(sido: string, sigungu: string, dong: string) {
  return [normalizeSido(sido), normalizeRegionPart(sigungu), normalizeRegionPart(dong)].filter(Boolean).join(" ");
}

export function buildTraceRegionKey(sido: string, sigungu: string, dong: string) {
  return [normalizeSido(sido), normalizeRegionPart(sigungu), normalizeRegionPart(dong)]
    .filter(Boolean)
    .join("|");
}

export function buildTracePoint(input: {
  sido: string;
  sigungu: string;
  dong: string;
  userId: string;
}) {
  const sido = normalizeSido(input.sido);
  const region = SIDO_OPTIONS.find((item) => item.label === sido) ?? SIDO_OPTIONS[0];
  const sigungu = normalizeRegionPart(input.sigungu);
  const dong = normalizeRegionPart(input.dong);
  const seedBase = `${region.id}:${sigungu}:${dong}:${input.userId}`;
  const hashX = hashString(`${seedBase}:x`);
  const hashY = hashString(`${seedBase}:y`);
  const spread = region.id === "seoul" ? 2.2 : region.id === "gyeonggi" ? 3.2 : 3.8;
  const x = clamp(region.anchor.x + jitterFromHash(hashX) * spread, 10, 90);
  const y = clamp(region.anchor.y + jitterFromHash(hashY) * (spread + 1.1), 10, 112);

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
  };
}

export function getSidoOption(sido: string) {
  return SIDO_OPTIONS.find((item) => item.label === normalizeSido(sido)) ?? null;
}
