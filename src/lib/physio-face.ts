type RawPoint = { x: number; y: number };

type RawLandmark = {
  type?: string;
  kind?: string;
  name?: string;
  location?: RawPoint;
  positions?: RawPoint[];
  locations?: RawPoint[];
  x?: number;
  y?: number;
};

type RawDetectedFace = {
  boundingBox?: { x: number; y: number; width: number; height: number };
  landmarks?: RawLandmark[];
};

type BrowserFaceDetector = new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
  detect(image: HTMLImageElement): Promise<RawDetectedFace[]>;
};

export type PhysioPointKey =
  | "forehead"
  | "leftEye"
  | "rightEye"
  | "nose"
  | "leftCheek"
  | "rightCheek"
  | "mouth"
  | "chin";

export type PhysioOverlayPoint = {
  key: PhysioPointKey;
  label: string;
  x: number;
  y: number;
};

export type PhysioOverlayGeometry = {
  imageWidth: number;
  imageHeight: number;
  faceBox: { x: number; y: number; width: number; height: number };
  points: PhysioOverlayPoint[];
  detected: boolean;
};

export type PhysioPhotoCheck =
  | { status: "ok"; geometry: PhysioOverlayGeometry; reason?: string }
  | { status: "retry_required"; geometry: PhysioOverlayGeometry; reason: string }
  | { status: "unsupported"; geometry: PhysioOverlayGeometry; reason: string };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildFallbackGeometry(imageWidth: number, imageHeight: number): PhysioOverlayGeometry {
  const faceWidth = imageWidth * 0.5;
  const faceHeight = imageHeight * 0.62;
  const faceX = (imageWidth - faceWidth) / 2;
  const faceY = imageHeight * 0.12;

  return buildGeometry(imageWidth, imageHeight, {
    x: faceX,
    y: faceY,
    width: faceWidth,
    height: faceHeight,
  });
}

function normalizePoint(point: RawPoint | undefined | null, imageWidth: number, imageHeight: number) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return {
    x: clamp(point.x, 0, imageWidth),
    y: clamp(point.y, 0, imageHeight),
  };
}

function pickLandmarkPoint(landmarks: RawLandmark[] | undefined, imageWidth: number, imageHeight: number, matcher: RegExp) {
  if (!Array.isArray(landmarks)) return null;

  for (const landmark of landmarks) {
    const type = String(landmark.type ?? landmark.kind ?? landmark.name ?? "").toLowerCase();
    if (!matcher.test(type)) continue;
    const point =
      normalizePoint(landmark.location, imageWidth, imageHeight) ??
      normalizePoint(Array.isArray(landmark.locations) ? landmark.locations[0] : undefined, imageWidth, imageHeight) ??
      normalizePoint(Array.isArray(landmark.positions) ? landmark.positions[0] : undefined, imageWidth, imageHeight) ??
      normalizePoint(
        Number.isFinite(landmark.x) && Number.isFinite(landmark.y)
          ? { x: landmark.x as number, y: landmark.y as number }
          : undefined,
        imageWidth,
        imageHeight
      );
    if (point) return point;
  }

  return null;
}

function buildGeometry(
  imageWidth: number,
  imageHeight: number,
  faceBox: { x: number; y: number; width: number; height: number },
  landmarks?: Partial<Record<"leftEye" | "rightEye" | "nose" | "mouth", RawPoint>>
): PhysioOverlayGeometry {
  const safeBox = {
    x: clamp(faceBox.x, 0, imageWidth),
    y: clamp(faceBox.y, 0, imageHeight),
    width: clamp(faceBox.width, imageWidth * 0.1, imageWidth),
    height: clamp(faceBox.height, imageHeight * 0.12, imageHeight),
  };

  const leftEye = normalizePoint(landmarks?.leftEye, imageWidth, imageHeight) ?? {
    x: safeBox.x + safeBox.width * 0.32,
    y: safeBox.y + safeBox.height * 0.38,
  };
  const rightEye = normalizePoint(landmarks?.rightEye, imageWidth, imageHeight) ?? {
    x: safeBox.x + safeBox.width * 0.68,
    y: safeBox.y + safeBox.height * 0.38,
  };
  const nose = normalizePoint(landmarks?.nose, imageWidth, imageHeight) ?? {
    x: safeBox.x + safeBox.width * 0.5,
    y: safeBox.y + safeBox.height * 0.56,
  };
  const mouth = normalizePoint(landmarks?.mouth, imageWidth, imageHeight) ?? {
    x: safeBox.x + safeBox.width * 0.5,
    y: safeBox.y + safeBox.height * 0.74,
  };
  const forehead = {
    x: safeBox.x + safeBox.width * 0.5,
    y: safeBox.y + safeBox.height * 0.14,
  };
  const leftCheek = {
    x: safeBox.x + safeBox.width * 0.16,
    y: safeBox.y + safeBox.height * 0.58,
  };
  const rightCheek = {
    x: safeBox.x + safeBox.width * 0.84,
    y: safeBox.y + safeBox.height * 0.58,
  };
  const chin = {
    x: safeBox.x + safeBox.width * 0.5,
    y: safeBox.y + safeBox.height * 0.96,
  };

  return {
    imageWidth,
    imageHeight,
    faceBox: safeBox,
    detected: Boolean(landmarks),
    points: [
      { key: "forehead", label: "이마", ...forehead },
      { key: "leftEye", label: "눈", ...leftEye },
      { key: "rightEye", label: "눈", ...rightEye },
      { key: "nose", label: "코", ...nose },
      { key: "leftCheek", label: "광대", ...leftCheek },
      { key: "rightCheek", label: "광대", ...rightCheek },
      { key: "mouth", label: "입", ...mouth },
      { key: "chin", label: "턱", ...chin },
    ],
  };
}

async function loadImage(src: string) {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  if (img.decode) {
    await img.decode();
  } else {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("이미지 로드 실패"));
    });
  }
  return img;
}

function getFaceDetectorCtor() {
  if (typeof window === "undefined") return null;
  const maybeCtor = (window as Window & { FaceDetector?: BrowserFaceDetector }).FaceDetector;
  return typeof maybeCtor === "function" ? maybeCtor : null;
}

function validateFaceBox(faceBox: { x: number; y: number; width: number; height: number }, imageWidth: number, imageHeight: number) {
  const areaRatio = (faceBox.width * faceBox.height) / (imageWidth * imageHeight);
  if (areaRatio < 0.12) return "얼굴이 너무 작게 잡혔습니다. 얼굴을 더 가까이 맞춰주세요.";
  if (areaRatio > 0.82) return "얼굴이 너무 크게 잡혔습니다. 어깨까지 조금 더 여유 있게 찍어주세요.";
  if (faceBox.x < imageWidth * 0.03 || faceBox.y < imageHeight * 0.04) {
    return "얼굴이 프레임 바깥으로 잘렸습니다. 정면으로 다시 맞춰주세요.";
  }
  if (faceBox.x + faceBox.width > imageWidth * 0.97 || faceBox.y + faceBox.height > imageHeight * 0.96) {
    return "턱이나 이마가 프레임 끝에 걸렸습니다. 얼굴 전체가 보이게 다시 찍어주세요.";
  }
  return null;
}

export async function analyzePhysioPhoto(src: string): Promise<PhysioPhotoCheck> {
  const image = await loadImage(src);
  const imageWidth = image.naturalWidth || image.width || 1000;
  const imageHeight = image.naturalHeight || image.height || 1250;
  const fallbackGeometry = buildFallbackGeometry(imageWidth, imageHeight);
  const FaceDetectorCtor = getFaceDetectorCtor();

  if (!FaceDetectorCtor) {
    return {
      status: "unsupported",
      geometry: fallbackGeometry,
      reason: "이 브라우저는 얼굴 자동 판별을 지원하지 않아 서버에서 최종 판별합니다.",
    };
  }

  try {
    const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 1 });
    const faces = await detector.detect(image);

    if (faces.length === 0) {
      return {
        status: "retry_required",
        geometry: fallbackGeometry,
        reason: "정면 얼굴을 찾지 못했습니다. 얼굴이 한 명만 선명하게 나오게 다시 찍어주세요.",
      };
    }

    if (faces.length > 1) {
      return {
        status: "retry_required",
        geometry: fallbackGeometry,
        reason: "한 명의 얼굴만 인식해야 합니다. 혼자 나온 정면 사진으로 다시 찍어주세요.",
      };
    }

    const face = faces[0];
    const box = face.boundingBox;
    if (!box || !Number.isFinite(box.x) || !Number.isFinite(box.y) || !Number.isFinite(box.width) || !Number.isFinite(box.height)) {
      return {
        status: "retry_required",
        geometry: fallbackGeometry,
        reason: "얼굴 위치를 안정적으로 읽지 못했습니다. 정면 얼굴로 다시 찍어주세요.",
      };
    }

    const geometry = buildGeometry(
      imageWidth,
      imageHeight,
      { x: box.x, y: box.y, width: box.width, height: box.height },
      {
        leftEye: pickLandmarkPoint(face.landmarks, imageWidth, imageHeight, /left.*eye|eye.*left/) ?? undefined,
        rightEye: pickLandmarkPoint(face.landmarks, imageWidth, imageHeight, /right.*eye|eye.*right/) ?? undefined,
        nose: pickLandmarkPoint(face.landmarks, imageWidth, imageHeight, /nose/) ?? undefined,
        mouth: pickLandmarkPoint(face.landmarks, imageWidth, imageHeight, /mouth|lip/) ?? undefined,
      }
    );

    const validationError = validateFaceBox(geometry.faceBox, imageWidth, imageHeight);
    if (validationError) {
      return {
        status: "retry_required",
        geometry,
        reason: validationError,
      };
    }

    return {
      status: "ok",
      geometry,
    };
  } catch {
    return {
      status: "unsupported",
      geometry: fallbackGeometry,
      reason: "이 브라우저는 얼굴 자동 판별을 안정적으로 수행하지 못해 서버에서 최종 판별합니다.",
    };
  }
}

export function getPhysioPointMap(geometry: PhysioOverlayGeometry) {
  return Object.fromEntries(geometry.points.map((point) => [point.key, point])) as Record<PhysioPointKey, PhysioOverlayPoint>;
}
