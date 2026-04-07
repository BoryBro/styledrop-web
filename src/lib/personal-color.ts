import { analyzePhysioPhoto } from "@/lib/physio-face";

export type PersonalColorSeason = "spring-warm" | "summer-cool" | "autumn-warm" | "winter-cool";

export type PersonalColorAxis = {
  score: number;
  label: string;
  value: number;
};

export type PersonalColorSwatch = {
  name: string;
  hex: string;
};

export type PersonalColorSample = {
  id: "forehead" | "left-cheek" | "right-cheek";
  label: string;
  x: number;
  y: number;
  radius: number;
  color: string;
};

export type PersonalColorProfile = {
  title: string;
  subtitle: string;
  summary: string;
  accent: string;
  surface: string;
  flattering: PersonalColorSwatch[];
  avoid: PersonalColorSwatch[];
  lip: PersonalColorSwatch[];
  blush: PersonalColorSwatch[];
  hair: PersonalColorSwatch[];
  recommendedStyleIds: string[];
};

export type PersonalColorSuccess = {
  status: "ok";
  season: PersonalColorSeason;
  profile: PersonalColorProfile;
  imageWidth: number;
  imageHeight: number;
  faceBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  brightness: PersonalColorAxis;
  temperature: PersonalColorAxis;
  clarity: PersonalColorAxis;
  subtype: string;
  summaryLine: string;
  averageHex: string;
  samples: PersonalColorSample[];
  measuredLab: {
    L: number;
    a: number;
    b: number;
    chroma: number;
    undertoneDelta: number;
  };
};

export type PersonalColorFailure = {
  status: "retry_required" | "unsupported";
  reason: string;
};

export type PersonalColorResult = PersonalColorSuccess | PersonalColorFailure;

export const PERSONAL_COLOR_PROFILES: Record<PersonalColorSeason, PersonalColorProfile> = {
  "spring-warm": {
    title: "봄 웜",
    subtitle: "따뜻하고 화사한 색감이 얼굴에 생기를 더해줄 가능성이 높아요.",
    summary: "노란기와 밝은 생기가 자연스럽게 잡히는 편이라, 맑고 경쾌한 색이 잘 받는 타입에 가깝습니다.",
    accent: "#FF7E57",
    surface: "#FFF4EB",
    flattering: [
      { name: "살구 코랄", hex: "#FF9E7A" },
      { name: "버터 옐로", hex: "#F6D36A" },
      { name: "애플 민트", hex: "#A8D9A1" },
      { name: "피치 베이지", hex: "#F8C9A4" },
      { name: "웜 아이보리", hex: "#FFF1D8" },
      { name: "골든 카멜", hex: "#C99B63" },
    ],
    avoid: [
      { name: "블루 그레이", hex: "#7D8A99" },
      { name: "플럼", hex: "#6A4F67" },
      { name: "차콜", hex: "#43464F" },
      { name: "쿨 라벤더", hex: "#B5A9D9" },
    ],
    lip: [
      { name: "피치 코랄", hex: "#FF8D6D" },
      { name: "살구 누드", hex: "#E8A07B" },
      { name: "웜 로즈", hex: "#D97F72" },
    ],
    blush: [
      { name: "애프리콧", hex: "#F5A373" },
      { name: "코랄 피치", hex: "#FFA58C" },
    ],
    hair: [
      { name: "밀크 브라운", hex: "#8A6145" },
      { name: "허니 브라운", hex: "#A56A3D" },
    ],
    recommendedStyleIds: ["idol-photocard", "angel", "maid-cafe-heart"],
  },
  "summer-cool": {
    title: "여름 쿨",
    subtitle: "맑고 차분한 쿨톤 계열이 피부를 더 깨끗하게 보이게 할 가능성이 높아요.",
    summary: "톤이 과하게 노랗기보다는 부드럽고 시원하게 읽혀서, 탁하지 않은 쿨톤과 소프트한 무드가 잘 맞는 편입니다.",
    accent: "#628DFF",
    surface: "#EEF3FF",
    flattering: [
      { name: "로즈 핑크", hex: "#D98FA5" },
      { name: "소프트 블루", hex: "#91AEDD" },
      { name: "쿨 그레이", hex: "#B9C0CC" },
      { name: "라벤더", hex: "#B9A4DD" },
      { name: "모브", hex: "#A57A99" },
      { name: "오프화이트", hex: "#F4F5F8" },
    ],
    avoid: [
      { name: "강한 오렌지", hex: "#E9753D" },
      { name: "카멜", hex: "#B98852" },
      { name: "올리브", hex: "#6D7750" },
      { name: "머스터드", hex: "#BFA136" },
    ],
    lip: [
      { name: "로지 핑크", hex: "#C57B8D" },
      { name: "베리 모브", hex: "#A46683" },
      { name: "쿨 로즈", hex: "#C87C95" },
    ],
    blush: [
      { name: "쿨 핑크", hex: "#DCA1B2" },
      { name: "모브 핑크", hex: "#C595B0" },
    ],
    hair: [
      { name: "애쉬 브라운", hex: "#6F625C" },
      { name: "쿨 다크브라운", hex: "#4E403A" },
    ],
    recommendedStyleIds: ["datecam-film", "ulzzang-cam", "existential-studio"],
  },
  "autumn-warm": {
    title: "가을 웜",
    subtitle: "깊이감 있는 웜톤과 차분한 색감이 얼굴을 더 안정감 있게 살려줄 가능성이 높아요.",
    summary: "밝기보다 무드와 깊이가 더 잘 받는 편이라, 너무 쨍한 색보다 톤 다운된 웜 컬러가 더 자연스럽습니다.",
    accent: "#B96B38",
    surface: "#FFF1E6",
    flattering: [
      { name: "테라코타", hex: "#C36B4B" },
      { name: "브릭", hex: "#A44F3F" },
      { name: "카멜", hex: "#B88756" },
      { name: "모스 그린", hex: "#7B8752" },
      { name: "웜 토프", hex: "#8C7564" },
      { name: "크림 베이지", hex: "#E7D3B4" },
    ],
    avoid: [
      { name: "아이스 블루", hex: "#AFCBEA" },
      { name: "쿨 핑크", hex: "#E1A4BF" },
      { name: "실버 그레이", hex: "#CED3DA" },
      { name: "라일락", hex: "#C6B7E8" },
    ],
    lip: [
      { name: "브릭 로즈", hex: "#A55A4F" },
      { name: "시나몬 누드", hex: "#B37757" },
      { name: "토피 브라운", hex: "#8A5644" },
    ],
    blush: [
      { name: "테라코타 피치", hex: "#C17E62" },
      { name: "웜 베이지", hex: "#D3A07D" },
    ],
    hair: [
      { name: "초콜릿 브라운", hex: "#5A3F33" },
      { name: "카퍼 브라운", hex: "#8D5B3D" },
    ],
    recommendedStyleIds: ["western-gunslinger", "luxury-bedroom-bag", "joseon-farmer"],
  },
  "winter-cool": {
    title: "겨울 쿨",
    subtitle: "대비가 또렷한 쿨톤과 선명한 색감이 인상을 더 또렷하게 만들어줄 가능성이 높아요.",
    summary: "차갑고 선명한 쪽으로 무드가 잡혀서, 흐릿한 컬러보다 대비감 있는 쿨톤이 더 힘 있게 받는 편입니다.",
    accent: "#315EFB",
    surface: "#EDF2FF",
    flattering: [
      { name: "체리 레드", hex: "#D63F58" },
      { name: "코발트 블루", hex: "#3C63E5" },
      { name: "블랙", hex: "#202228" },
      { name: "퓨어 화이트", hex: "#FBFBFD" },
      { name: "베리 퍼플", hex: "#7D4EC8" },
      { name: "딥 네이비", hex: "#26355D" },
    ],
    avoid: [
      { name: "머스터드", hex: "#B2973B" },
      { name: "웜 베이지", hex: "#D8B490" },
      { name: "오렌지 코랄", hex: "#F48A5A" },
      { name: "카키", hex: "#7D7A55" },
    ],
    lip: [
      { name: "체리 핑크", hex: "#D14F78" },
      { name: "플럼", hex: "#7E4567" },
      { name: "쿨 레드", hex: "#C53B4F" },
    ],
    blush: [
      { name: "베리 핑크", hex: "#C67194" },
      { name: "쿨 로즈", hex: "#D289A0" },
    ],
    hair: [
      { name: "블루블랙", hex: "#1F2432" },
      { name: "에스프레소", hex: "#382E30" },
    ],
    recommendedStyleIds: ["dark-coquette", "club-flash", "hiphop-grillz"],
  },
};

type Rgb = { r: number; g: number; b: number };
type Lab = { L: number; a: number; b: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function averageRgb(colors: Rgb[]) {
  const total = colors.reduce(
    (acc, color) => ({
      r: acc.r + color.r,
      g: acc.g + color.g,
      b: acc.b + color.b,
    }),
    { r: 0, g: 0, b: 0 }
  );

  return {
    r: total.r / colors.length,
    g: total.g / colors.length,
    b: total.b / colors.length,
  };
}

function rgbToHex(color: Rgb) {
  const channelToHex = (channel: number) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0");
  return `#${channelToHex(color.r)}${channelToHex(color.g)}${channelToHex(color.b)}`;
}

function srgbToLinear(value: number) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function rgbToLab(color: Rgb): Lab {
  const r = srgbToLinear(color.r);
  const g = srgbToLinear(color.g);
  const b = srgbToLinear(color.b);

  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;

  const refX = 0.95047;
  const refY = 1;
  const refZ = 1.08883;

  const pivot = (value: number) => (
    value > 0.008856
      ? value ** (1 / 3)
      : (7.787 * value) + (16 / 116)
  );

  const fx = pivot(x / refX);
  const fy = pivot(y / refY);
  const fz = pivot(z / refZ);

  return {
    L: (116 * fy) - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

async function loadImage(src: string) {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  if (image.decode) {
    await image.decode();
  } else {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    });
  }
  return image;
}

function sampleRegionColors(
  imageData: ImageData,
  centerX: number,
  centerY: number,
  radius: number
) {
  const startX = Math.max(0, Math.floor(centerX - radius));
  const startY = Math.max(0, Math.floor(centerY - radius));
  const endX = Math.min(imageData.width - 1, Math.ceil(centerX + radius));
  const endY = Math.min(imageData.height - 1, Math.ceil(centerY + radius));
  const radiusSq = radius * radius;
  const colors: Array<Rgb & { brightness: number }> = [];

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if ((dx * dx) + (dy * dy) > radiusSq) continue;

      const index = (y * imageData.width + x) * 4;
      const r = imageData.data[index];
      const g = imageData.data[index + 1];
      const b = imageData.data[index + 2];
      const a = imageData.data[index + 3];
      if (a < 200) continue;

      const brightness = (r + g + b) / 3;
      if (brightness < 35 || brightness > 235) continue;

      colors.push({ r, g, b, brightness });
    }
  }

  if (!colors.length) return null;

  colors.sort((left, right) => left.brightness - right.brightness);
  const trim = Math.floor(colors.length * 0.12);
  const trimmed = colors.slice(trim, colors.length - trim);
  const stable = trimmed.length >= 20 ? trimmed : colors;
  return averageRgb(stable);
}

function getAxisLabel(value: number, axis: "brightness" | "temperature" | "clarity") {
  if (axis === "brightness") {
    if (value >= 74) return "매우 밝음";
    if (value >= 60) return "밝은 편";
    if (value >= 44) return "중간";
    return "딥한 편";
  }

  if (axis === "temperature") {
    if (value >= 64) return "웜 쪽에 가까움";
    if (value >= 48) return "중립에 가까운 웜";
    if (value >= 36) return "중립에 가까운 쿨";
    return "쿨 쪽에 가까움";
  }

  if (value >= 68) return "선명한 편";
  if (value >= 46) return "균형형";
  return "뮤트한 편";
}

function seasonFromAxes(
  brightnessScore: number,
  temperatureScore: number,
  clarityScore: number
) {
  const warm = temperatureScore >= 50;
  let season: PersonalColorSeason;
  let subtype: string;

  if (warm) {
    if (brightnessScore >= 58) {
      season = "spring-warm";
      subtype = clarityScore >= 58 ? "브라이트" : "라이트";
    } else {
      season = "autumn-warm";
      subtype = brightnessScore < 42 ? "딥" : clarityScore < 46 ? "뮤트" : "웜";
    }
  } else if (clarityScore >= 58 || brightnessScore < 45) {
    season = "winter-cool";
    subtype = clarityScore >= 66 ? "브라이트" : "딥";
  } else {
    season = "summer-cool";
    subtype = brightnessScore >= 62 ? "라이트" : "뮤트";
  }

  return { season, subtype };
}

export async function analyzePersonalColor(src: string): Promise<PersonalColorResult> {
  const faceCheck = await analyzePhysioPhoto(src);
  if (faceCheck.status !== "ok") {
    return {
      status: faceCheck.status,
      reason: faceCheck.reason,
    };
  }

  const image = await loadImage(src);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      status: "unsupported",
      reason: "브라우저에서 이미지를 처리하지 못했습니다.",
    };
  }

  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const { faceBox } = faceCheck.geometry;

  const sampleDefinitions = [
    {
      id: "forehead" as const,
      label: "이마",
      x: faceBox.x + faceBox.width * 0.5,
      y: faceBox.y + faceBox.height * 0.24,
      radius: Math.min(faceBox.width, faceBox.height) * 0.08,
      weight: 0.28,
    },
    {
      id: "left-cheek" as const,
      label: "왼볼",
      x: faceBox.x + faceBox.width * 0.3,
      y: faceBox.y + faceBox.height * 0.58,
      radius: Math.min(faceBox.width, faceBox.height) * 0.095,
      weight: 0.36,
    },
    {
      id: "right-cheek" as const,
      label: "오른볼",
      x: faceBox.x + faceBox.width * 0.7,
      y: faceBox.y + faceBox.height * 0.58,
      radius: Math.min(faceBox.width, faceBox.height) * 0.095,
      weight: 0.36,
    },
  ];

  const sampled = sampleDefinitions
    .map((sample) => {
      const color = sampleRegionColors(imageData, sample.x, sample.y, sample.radius);
      return color ? { ...sample, color } : null;
    })
    .filter((sample): sample is typeof sampleDefinitions[number] & { color: Rgb } => Boolean(sample));

  if (sampled.length < 2) {
    return {
      status: "retry_required",
      reason: "피부톤을 안정적으로 읽지 못했어요. 자연광에서 정면 셀카로 다시 시도해주세요.",
    };
  }

  const totalWeight = sampled.reduce((sum, sample) => sum + sample.weight, 0);
  const weightedRgb = sampled.reduce(
    (acc, sample) => ({
      r: acc.r + (sample.color.r * sample.weight),
      g: acc.g + (sample.color.g * sample.weight),
      b: acc.b + (sample.color.b * sample.weight),
    }),
    { r: 0, g: 0, b: 0 }
  );

  const averageRgbValue = {
    r: weightedRgb.r / totalWeight,
    g: weightedRgb.g / totalWeight,
    b: weightedRgb.b / totalWeight,
  };
  const averageLab = rgbToLab(averageRgbValue);
  const chroma = Math.hypot(averageLab.a, averageLab.b);
  const undertoneDelta = averageLab.b - (averageLab.a * 0.85);

  const brightnessScore = clamp(Math.round(((averageLab.L - 35) / 42) * 100), 0, 100);
  const temperatureScore = clamp(Math.round(((undertoneDelta + 8) / 20) * 100), 0, 100);
  const clarityScore = clamp(Math.round(((chroma - 12) / 22) * 100), 0, 100);

  const { season, subtype } = seasonFromAxes(brightnessScore, temperatureScore, clarityScore);
  const profile = PERSONAL_COLOR_PROFILES[season];

  return {
    status: "ok",
    season,
    profile,
    imageWidth: width,
    imageHeight: height,
    faceBox: {
      x: faceBox.x,
      y: faceBox.y,
      width: faceBox.width,
      height: faceBox.height,
    },
    brightness: {
      score: brightnessScore,
      label: getAxisLabel(brightnessScore, "brightness"),
      value: Number(averageLab.L.toFixed(1)),
    },
    temperature: {
      score: temperatureScore,
      label: getAxisLabel(temperatureScore, "temperature"),
      value: Number(undertoneDelta.toFixed(1)),
    },
    clarity: {
      score: clarityScore,
      label: getAxisLabel(clarityScore, "clarity"),
      value: Number(chroma.toFixed(1)),
    },
    subtype,
    summaryLine: `${profile.title} ${subtype}에 가까운 톤으로 추정돼요.`,
    averageHex: rgbToHex(averageRgbValue),
    samples: sampled.map((sample) => ({
      id: sample.id,
      label: sample.label,
      x: sample.x,
      y: sample.y,
      radius: sample.radius,
      color: rgbToHex(sample.color),
    })),
    measuredLab: {
      L: Number(averageLab.L.toFixed(2)),
      a: Number(averageLab.a.toFixed(2)),
      b: Number(averageLab.b.toFixed(2)),
      chroma: Number(chroma.toFixed(2)),
      undertoneDelta: Number(undertoneDelta.toFixed(2)),
    },
  };
}
