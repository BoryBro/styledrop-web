import type { FaceLandmarker as MediaPipeFaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";

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

const MEDIAPIPE_WASM_ROOT = "/mediapipe/wasm";
const MEDIAPIPE_MODEL_PATH = "/mediapipe/models/face_landmarker.task";

let mediaPipeLandmarkerPromise: Promise<MediaPipeFaceLandmarker | null> | null = null;

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

function averagePoints(points: Array<RawPoint | null | undefined>) {
  const validPoints = points.filter((point): point is RawPoint => Boolean(point));
  if (!validPoints.length) return null;

  const total = validPoints.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );

  return {
    x: total.x / validPoints.length,
    y: total.y / validPoints.length,
  };
}

function pickLandmarkPoint(
  landmarks: RawLandmark[] | undefined,
  imageWidth: number,
  imageHeight: number,
  matcher: RegExp
) {
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

function normalizedLandmarkToPoint(
  landmark: NormalizedLandmark | undefined,
  imageWidth: number,
  imageHeight: number
) {
  if (!landmark) return null;
  if (!Number.isFinite(landmark.x) || !Number.isFinite(landmark.y)) return null;
  return {
    x: clamp(landmark.x * imageWidth, 0, imageWidth),
    y: clamp(landmark.y * imageHeight, 0, imageHeight),
  };
}

function pickMediaPipePoint(
  landmarks: NormalizedLandmark[],
  imageWidth: number,
  imageHeight: number,
  indices: number[]
) {
  return averagePoints(indices.map((index) => normalizedLandmarkToPoint(landmarks[index], imageWidth, imageHeight)));
}

function getMediaPipeFaceBox(landmarks: NormalizedLandmark[], imageWidth: number, imageHeight: number) {
  const points = landmarks
    .map((landmark) => normalizedLandmarkToPoint(landmark, imageWidth, imageHeight))
    .filter((point): point is RawPoint => Boolean(point));

  if (!points.length) return null;

  let minX = imageWidth;
  let minY = imageHeight;
  let maxX = 0;
  let maxY = 0;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, imageWidth * 0.08),
    height: Math.max(maxY - minY, imageHeight * 0.08),
  };
}

function buildGeometry(
  imageWidth: number,
  imageHeight: number,
  faceBox: { x: number; y: number; width: number; height: number },
  points?: Partial<Record<PhysioPointKey, RawPoint>>
): PhysioOverlayGeometry {
  const safeBox = {
    x: clamp(faceBox.x, 0, imageWidth),
    y: clamp(faceBox.y, 0, imageHeight),
    width: clamp(faceBox.width, imageWidth * 0.1, imageWidth),
    height: clamp(faceBox.height, imageHeight * 0.12, imageHeight),
  };

  const leftEye = normalizePoint(points?.leftEye, imageWidth, imageHeight) ?? {
    x: safeBox.x + safeBox.width * 0.32,
    y: safeBox.y + safeBox.height * 0.38,
  };
  const rightEye = normalizePoint(points?.rightEye, imageWidth, imageHeight) ?? {
    x: safeBox.x + safeBox.width * 0.68,
    y: safeBox.y + safeBox.height * 0.38,
  };
  const nose = normalizePoint(points?.nose, imageWidth, imageHeight) ?? {
    x: safeBox.x + safeBox.width * 0.5,
    y: safeBox.y + safeBox.height * 0.56,
  };
  const mouth = normalizePoint(points?.mouth, imageWidth, imageHeight) ?? {
    x: safeBox.x + safeBox.width * 0.5,
    y: safeBox.y + safeBox.height * 0.74,
  };
  const forehead = normalizePoint(points?.forehead, imageWidth, imageHeight) ?? {
    x: safeBox.x + safeBox.width * 0.5,
    y: safeBox.y + safeBox.height * 0.14,
  };
  const leftCheek = normalizePoint(points?.leftCheek, imageWidth, imageHeight) ?? {
    x: safeBox.x + safeBox.width * 0.16,
    y: safeBox.y + safeBox.height * 0.58,
  };
  const rightCheek = normalizePoint(points?.rightCheek, imageWidth, imageHeight) ?? {
    x: safeBox.x + safeBox.width * 0.84,
    y: safeBox.y + safeBox.height * 0.58,
  };
  const chin = normalizePoint(points?.chin, imageWidth, imageHeight) ?? {
    x: safeBox.x + safeBox.width * 0.5,
    y: safeBox.y + safeBox.height * 0.96,
  };

  return {
    imageWidth,
    imageHeight,
    faceBox: safeBox,
    detected: Boolean(points),
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

async function getMediaPipeLandmarker() {
  if (typeof window === "undefined") return null;

  if (!mediaPipeLandmarkerPromise) {
    mediaPipeLandmarkerPromise = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT);
      return vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: MEDIAPIPE_MODEL_PATH,
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        numFaces: 2,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.5,
      });
    })().catch(() => null);
  }

  return mediaPipeLandmarkerPromise;
}

function validateFaceBox(faceBox: { x: number; y: number; width: number; height: number }, imageWidth: number, imageHeight: number) {
  const areaRatio = (faceBox.width * faceBox.height) / (imageWidth * imageHeight);
  if (areaRatio < 0.15) return "얼굴이 너무 작게 잡혔습니다. 얼굴이 프레임을 더 많이 채우게 다시 찍어주세요.";
  if (areaRatio > 0.82) return "얼굴이 너무 크게 잡혔습니다. 어깨까지 조금 더 여유 있게 찍어주세요.";
  if (faceBox.x < imageWidth * 0.03 || faceBox.y < imageHeight * 0.04) {
    return "얼굴이 프레임 바깥으로 잘렸습니다. 정면으로 다시 맞춰주세요.";
  }
  if (faceBox.x + faceBox.width > imageWidth * 0.97 || faceBox.y + faceBox.height > imageHeight * 0.96) {
    return "턱이나 이마가 프레임 끝에 걸렸습니다. 얼굴 전체가 보이게 다시 찍어주세요.";
  }
  return null;
}

function validateFrontalFace(
  faceBox: { x: number; y: number; width: number; height: number },
  points: Partial<Record<PhysioPointKey, RawPoint>>
) {
  const leftEye = points.leftEye;
  const rightEye = points.rightEye;
  const nose = points.nose;
  const mouth = points.mouth;

  if (!leftEye || !rightEye || !nose || !mouth) {
    return "눈·코·입 위치를 안정적으로 읽지 못했습니다. 정면 얼굴 사진으로 다시 찍어주세요.";
  }

  const eyeTilt = Math.abs(leftEye.y - rightEye.y) / faceBox.height;
  if (eyeTilt > 0.08) {
    return "고개가 많이 기울어져 있습니다. 얼굴을 곧게 세워 다시 찍어주세요.";
  }

  const eyeCenterX = (leftEye.x + rightEye.x) / 2;
  const noseOffset = Math.abs(nose.x - eyeCenterX) / faceBox.width;
  if (noseOffset > 0.11) {
    return "얼굴이 정면이 아니라 옆으로 돌아가 있습니다. 카메라를 정면으로 봐주세요.";
  }

  const mouthOffset = Math.abs(mouth.x - eyeCenterX) / faceBox.width;
  if (mouthOffset > 0.13) {
    return "입 중심이 크게 치우쳐 있어 정면 사진으로 보기 어렵습니다. 정면으로 다시 맞춰주세요.";
  }

  const leftDistance = nose.x - leftEye.x;
  const rightDistance = rightEye.x - nose.x;
  const balanceGap = Math.abs(leftDistance - rightDistance) / faceBox.width;
  if (balanceGap > 0.14) {
    return "얼굴 좌우 비율이 크게 치우쳐 있습니다. 정면 사진으로 다시 찍어주세요.";
  }

  return null;
}

async function analyzeWithMediaPipe(
  image: HTMLImageElement,
  imageWidth: number,
  imageHeight: number,
  fallbackGeometry: PhysioOverlayGeometry
): Promise<PhysioPhotoCheck | null> {
  const landmarker = await getMediaPipeLandmarker();
  if (!landmarker) return null;

  try {
    const result = landmarker.detect(image);
    const faces = result.faceLandmarks ?? [];

    if (faces.length === 0) {
      return {
        status: "retry_required",
        geometry: fallbackGeometry,
        reason: "정면 얼굴을 찾지 못했습니다. 얼굴 한 명이 선명하게 보이게 다시 찍어주세요.",
      };
    }

    if (faces.length > 1) {
      return {
        status: "retry_required",
        geometry: fallbackGeometry,
        reason: "여러 얼굴이 감지됐습니다. 한 명만 나온 정면 사진으로 다시 찍어주세요.",
      };
    }

    const landmarks = faces[0];
    const faceBox = getMediaPipeFaceBox(landmarks, imageWidth, imageHeight);
    if (!faceBox) {
      return {
        status: "retry_required",
        geometry: fallbackGeometry,
        reason: "얼굴 위치를 안정적으로 읽지 못했습니다. 정면 얼굴로 다시 찍어주세요.",
      };
    }

    const points: Partial<Record<PhysioPointKey, RawPoint>> = {
      forehead: pickMediaPipePoint(landmarks, imageWidth, imageHeight, [10]) ?? undefined,
      leftEye: pickMediaPipePoint(landmarks, imageWidth, imageHeight, [33, 133, 159, 145]) ?? undefined,
      rightEye: pickMediaPipePoint(landmarks, imageWidth, imageHeight, [263, 362, 386, 374]) ?? undefined,
      nose: pickMediaPipePoint(landmarks, imageWidth, imageHeight, [1, 4, 6]) ?? undefined,
      leftCheek: pickMediaPipePoint(landmarks, imageWidth, imageHeight, [234]) ?? undefined,
      rightCheek: pickMediaPipePoint(landmarks, imageWidth, imageHeight, [454]) ?? undefined,
      mouth: pickMediaPipePoint(landmarks, imageWidth, imageHeight, [13, 14, 78, 308]) ?? undefined,
      chin: pickMediaPipePoint(landmarks, imageWidth, imageHeight, [152]) ?? undefined,
    };

    const geometry = buildGeometry(imageWidth, imageHeight, faceBox, points);
    const faceError = validateFaceBox(geometry.faceBox, imageWidth, imageHeight);
    if (faceError) {
      return {
        status: "retry_required",
        geometry,
        reason: faceError,
      };
    }

    const frontalError = validateFrontalFace(geometry.faceBox, points);
    if (frontalError) {
      return {
        status: "retry_required",
        geometry,
        reason: frontalError,
      };
    }

    return {
      status: "ok",
      geometry,
    };
  } catch {
    return null;
  }
}

async function analyzeWithBrowserFaceDetector(
  image: HTMLImageElement,
  imageWidth: number,
  imageHeight: number,
  fallbackGeometry: PhysioOverlayGeometry
): Promise<PhysioPhotoCheck | null> {
  const FaceDetectorCtor = getFaceDetectorCtor();
  if (!FaceDetectorCtor) return null;

  try {
    const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 2 });
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

    const points: Partial<Record<PhysioPointKey, RawPoint>> = {
      leftEye: pickLandmarkPoint(face.landmarks, imageWidth, imageHeight, /left.*eye|eye.*left/) ?? undefined,
      rightEye: pickLandmarkPoint(face.landmarks, imageWidth, imageHeight, /right.*eye|eye.*right/) ?? undefined,
      nose: pickLandmarkPoint(face.landmarks, imageWidth, imageHeight, /nose/) ?? undefined,
      mouth: pickLandmarkPoint(face.landmarks, imageWidth, imageHeight, /mouth|lip/) ?? undefined,
    };

    const geometry = buildGeometry(
      imageWidth,
      imageHeight,
      { x: box.x, y: box.y, width: box.width, height: box.height },
      points
    );

    const validationError = validateFaceBox(geometry.faceBox, imageWidth, imageHeight);
    if (validationError) {
      return {
        status: "retry_required",
        geometry,
        reason: validationError,
      };
    }

    const frontalError = validateFrontalFace(geometry.faceBox, points);
    if (frontalError) {
      return {
        status: "retry_required",
        geometry,
        reason: frontalError,
      };
    }

    return {
      status: "ok",
      geometry,
    };
  } catch {
    return null;
  }
}

export async function analyzePhysioPhoto(src: string): Promise<PhysioPhotoCheck> {
  const image = await loadImage(src);
  const imageWidth = image.naturalWidth || image.width || 1000;
  const imageHeight = image.naturalHeight || image.height || 1250;
  const fallbackGeometry = buildFallbackGeometry(imageWidth, imageHeight);

  const mediaPipeResult = await analyzeWithMediaPipe(image, imageWidth, imageHeight, fallbackGeometry);
  if (mediaPipeResult) return mediaPipeResult;

  const browserResult = await analyzeWithBrowserFaceDetector(image, imageWidth, imageHeight, fallbackGeometry);
  if (browserResult) return browserResult;

  return {
    status: "unsupported",
    geometry: fallbackGeometry,
    reason: "이 브라우저는 로컬 얼굴 자동 판별을 지원하지 않아 서버에서 최종 판별합니다.",
  };
}

export function getPhysioPointMap(geometry: PhysioOverlayGeometry) {
  return Object.fromEntries(geometry.points.map((point) => [point.key, point])) as Record<PhysioPointKey, PhysioOverlayPoint>;
}
