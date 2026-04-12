"use client";

import { geoContains, geoMercator, geoPath } from "d3-geo";
import Link from "next/link";
import { feature, mesh } from "topojson-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import koreaEmdTopology from "@tenqube/react-korea-bubble-map/dist/esm/emd-64475e77.js";
import koreaSidoTopology from "@tenqube/react-korea-bubble-map/dist/esm/sido-0af932a3.js";
import koreaSigunguTopology from "@tenqube/react-korea-bubble-map/dist/esm/sigungu-3878911c.js";
import KakaoTraceMap from "@/components/lab/KakaoTraceMap";
import { useAuth } from "@/hooks/useAuth";
import {
  buildTraceJitter,
  buildTraceRegionKey,
  formatTraceRegion,
  getSidoOption,
  normalizeRegionPart,
  normalizeSido,
  SIDO_OPTIONS,
} from "@/lib/lab-traces";

type Trace = {
  user_id: string;
  sido: string;
  sigungu: string;
  dong: string;
  x: number;
  y: number;
  regionKey: string;
  regionLabel: string;
  publicImageUrl: string | null;
  instagramHandle: string | null;
  created_at: string | null;
};

type DisplayTrace = Trace & {
  displayX: number;
  displayY: number;
};

type GeoDisplayTrace = DisplayTrace & {
  lat: number;
  lng: number;
};

type SelectableImage = {
  id: string;
  style_id: string;
  result_image_url: string;
  created_at: string;
};

type TracePayload = {
  traces: Trace[];
  summary: {
    totalParticipants: number;
    totalRegions: number;
    hottestRegion: { label: string; count: number } | null;
  };
  me: {
    loggedIn: boolean;
    eligible: boolean;
    alreadyJoined: boolean;
    trace: Trace | null;
    latestImageUrl: string | null;
    selectableImages: SelectableImage[];
  };
};

type TraceCluster = {
  key: string;
  label: string;
  sido: string;
  x: number;
  y: number;
  count: number;
};

type RegionLabel = {
  id: string;
  x: number;
  y: number;
  shortLabel: string;
};

type KoreaFeature = {
  geometry: unknown;
  properties: {
    CODE: string;
    KOR_NM: string;
  };
};

type KoreaTopology = {
  objects: {
    [key: string]: unknown;
  };
};

type RegionShape = {
  code: string;
  label: string;
  normalizedLabel: string;
  shortLabel: string;
  path: string;
  centroid: {
    x: number;
    y: number;
  };
};

const MAP_WIDTH = 100;
const MAP_HEIGHT = 140;
const MAP_PADDING = 8;

const typedKoreaSidoTopology = koreaSidoTopology as KoreaTopology;
const typedKoreaSigunguTopology = koreaSigunguTopology as KoreaTopology;
const typedKoreaEmdTopology = koreaEmdTopology as KoreaTopology;

const koreaFeatureCollection = feature(
  typedKoreaSidoTopology as never,
  typedKoreaSidoTopology.objects.sido as never,
) as unknown as { features: KoreaFeature[] };

const koreaSigunguFeatureCollection = feature(
  typedKoreaSigunguTopology as never,
  typedKoreaSigunguTopology.objects.sigungu as never,
) as unknown as { features: KoreaFeature[] };

const koreaEmdFeatureCollection = feature(
  typedKoreaEmdTopology as never,
  typedKoreaEmdTopology.objects.emd as never,
) as unknown as { features: KoreaFeature[] };

const koreaSidoMesh = mesh(
  typedKoreaSidoTopology as never,
  typedKoreaSidoTopology.objects.sido as never,
  (left, right) => left !== right,
) as never;

const koreaSigunguMesh = mesh(
  typedKoreaSigunguTopology as never,
  typedKoreaSigunguTopology.objects.sigungu as never,
  (left, right) => left !== right,
) as never;

const koreaEmdMesh = mesh(
  typedKoreaEmdTopology as never,
  typedKoreaEmdTopology.objects.emd as never,
  (left, right) => left !== right,
) as never;

const projection = geoMercator().fitExtent(
  [
    [MAP_PADDING, MAP_PADDING],
    [MAP_WIDTH - MAP_PADDING, MAP_HEIGHT - MAP_PADDING],
  ],
  {
    type: "FeatureCollection",
    features: koreaFeatureCollection.features as never[],
  } as never,
);

const pathBuilder = geoPath(projection);
const koreaLandPath =
  pathBuilder(
    {
      type: "FeatureCollection",
      features: koreaFeatureCollection.features as never[],
    } as never,
  ) ?? "";
const koreaSidoMeshPath = pathBuilder(koreaSidoMesh) ?? "";
const koreaSigunguMeshPath = pathBuilder(koreaSigunguMesh) ?? "";
const koreaEmdMeshPath = pathBuilder(koreaEmdMesh) ?? "";

function buildRegionShape(featureItem: KoreaFeature) {
  const option = getSidoOption(featureItem.properties.KOR_NM);
  const centroid = pathBuilder.centroid(featureItem as never);

  return {
    code: featureItem.properties.CODE,
    label: featureItem.properties.KOR_NM,
    normalizedLabel: normalizeRegionPart(featureItem.properties.KOR_NM),
    shortLabel: option?.shortLabel ?? featureItem.properties.KOR_NM.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/g, ""),
    path: pathBuilder(featureItem as never) ?? "",
    centroid: {
      x: Number(centroid[0].toFixed(2)),
      y: Number(centroid[1].toFixed(2)),
    },
  };
}

const provinceMap = koreaFeatureCollection.features.map(buildRegionShape);
const districtMap = koreaSigunguFeatureCollection.features.map(buildRegionShape);
const dongMap = koreaEmdFeatureCollection.features.map(buildRegionShape);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatRelativeDate(iso: string | null) {
  if (!iso) return "방금 전";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

function getCurrentPositionWithFallback() {
  const attempt = (options: PositionOptions) =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

  return attempt({
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 0,
  }).catch(() =>
    attempt({
      enableHighAccuracy: false,
      timeout: 18000,
      maximumAge: 300000,
    }),
  );
}

function recomputeSummary(traces: Trace[]) {
  const counts = new Map<string, { label: string; count: number }>();

  traces.forEach((trace) => {
    const current = counts.get(trace.regionKey);
    if (current) {
      current.count += 1;
      return;
    }
    counts.set(trace.regionKey, { label: trace.regionLabel, count: 1 });
  });

  const hottestRegion = [...counts.values()].sort((left, right) => right.count - left.count)[0] ?? null;

  return {
    totalParticipants: traces.length,
    totalRegions: counts.size,
    hottestRegion,
  };
}

function getProvinceSpread(sido: string) {
  const normalized = normalizeSido(sido);
  if (normalized === "서울특별시") return { x: 1.2, y: 1.4 };
  if (normalized === "경기도") return { x: 2.2, y: 2.6 };
  if (normalized === "강원특별자치도") return { x: 2.6, y: 3.1 };
  if (normalized === "제주특별자치도") return { x: 1.1, y: 0.8 };
  return { x: 1.8, y: 2.1 };
}

function findProvinceShape(sido: string) {
  const normalizedSido = normalizeSido(sido);
  return provinceMap.find((item) => item.label === normalizedSido) ?? null;
}

function findDistrictShape(sido: string, sigungu: string) {
  const province = findProvinceShape(sido);
  const normalizedSigungu = normalizeRegionPart(sigungu);
  if (!province || !normalizedSigungu) return null;

  const provincePrefix = province.code.slice(0, 2);
  return (
    districtMap.find(
      (item) => item.normalizedLabel === normalizedSigungu && item.code.slice(0, 2) === provincePrefix,
    ) ?? null
  );
}

function findDongShape(sido: string, sigungu: string, dong: string) {
  const district = findDistrictShape(sido, sigungu);
  const province = findProvinceShape(sido);
  const normalizedDong = normalizeRegionPart(dong);
  if (!normalizedDong) return null;

  if (district) {
    const districtPrefix = district.code.slice(0, 5);
    const matched = dongMap.find(
      (item) => item.normalizedLabel === normalizedDong && item.code.slice(0, 5) === districtPrefix,
    );
    if (matched) return matched;
  }

  if (!province) return null;
  const provincePrefix = province.code.slice(0, 2);
  return dongMap.find(
    (item) => item.normalizedLabel === normalizedDong && item.code.slice(0, 2) === provincePrefix,
  ) ?? null;
}

function uniqueSortedLabels(labels: string[]) {
  return [...new Set(labels.filter(Boolean))].sort((left, right) => left.localeCompare(right, "ko"));
}

function getDistrictSuggestions(sido: string) {
  const province = findProvinceShape(sido);
  if (!province) return [];

  const provincePrefix = province.code.slice(0, 2);
  return uniqueSortedLabels(
    districtMap
      .filter((item) => item.code.slice(0, 2) === provincePrefix)
      .map((item) => item.normalizedLabel),
  );
}

function getDongSuggestions(sido: string, sigungu: string) {
  const district = findDistrictShape(sido, sigungu);
  if (!district) return [];

  const districtPrefix = district.code.slice(0, 5);
  return uniqueSortedLabels(
    dongMap
      .filter((item) => item.code.slice(0, 5) === districtPrefix)
      .map((item) => item.normalizedLabel),
  );
}

function buildDisplayTrace(trace: Trace): DisplayTrace {
  const normalizedSido = normalizeSido(trace.sido);
  const province = findProvinceShape(normalizedSido);
  const district = findDistrictShape(normalizedSido, trace.sigungu);
  const dong = findDongShape(normalizedSido, trace.sigungu, trace.dong);
  const option = getSidoOption(normalizedSido);
  const fallback = option?.anchor ?? { x: 50, y: 60 };
  const exactBase = dong?.centroid ?? district?.centroid ?? province?.centroid ?? fallback;
  const baseX = exactBase.x;
  const baseY = exactBase.y;
  const spread = getProvinceSpread(normalizedSido);
  const jitter = buildTraceJitter({
    sido: trace.sido,
    sigungu: trace.sigungu,
    dong: trace.dong,
    userId: trace.user_id,
  });
  const useJitter = !dong;

  return {
    ...trace,
    displayX: Number(clamp(baseX + (useJitter ? jitter.x * spread.x : 0), 6, MAP_WIDTH - 6).toFixed(2)),
    displayY: Number(clamp(baseY + (useJitter ? jitter.y * spread.y : 0), 8, MAP_HEIGHT - 8).toFixed(2)),
  };
}

function buildClusters(traces: DisplayTrace[]): TraceCluster[] {
  const clusters = new Map<string, TraceCluster>();

  traces.forEach((trace) => {
    const current = clusters.get(trace.regionKey);
    if (current) {
      current.count += 1;
      current.x = Number(((current.x + trace.displayX) / 2).toFixed(2));
      current.y = Number(((current.y + trace.displayY) / 2).toFixed(2));
      return;
    }

    clusters.set(trace.regionKey, {
      key: trace.regionKey,
      label: trace.regionLabel,
      sido: normalizeSido(trace.sido),
      x: trace.displayX,
      y: trace.displayY,
      count: 1,
    });
  });

  return [...clusters.values()].sort((left, right) => right.count - left.count);
}

function buildVisibleRegionLabels(clusters: TraceCluster[]): RegionLabel[] {
  const activeSidos = new Set(clusters.map((cluster) => cluster.sido));
  const fallbackLabels = new Set([
    "서울특별시",
    "부산광역시",
    "대구광역시",
    "인천광역시",
    "광주광역시",
    "대전광역시",
    "울산광역시",
    "제주특별자치도",
  ]);

  return provinceMap
    .filter((region) => activeSidos.has(region.label) || fallbackLabels.has(region.label))
    .map((region) => ({
      id: region.code,
      x: region.centroid.x,
      y: region.centroid.y,
      shortLabel: region.shortLabel,
    }));
}

function isInVisibleBounds(
  point: { x: number; y: number },
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  padding = 0,
) {
  return (
    point.x >= bounds.minX - padding &&
    point.x <= bounds.maxX + padding &&
    point.y >= bounds.minY - padding &&
    point.y <= bounds.maxY + padding
  );
}

function buildVisibleDistrictLabels(
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  zoom: number,
) {
  if (zoom < 4.5) return [];

  const visible = districtMap.filter((region) => isInVisibleBounds(region.centroid, bounds, 3));
  const step = zoom >= 7.2 ? 1 : zoom >= 6 ? 2 : 3;
  const maxCount = zoom >= 7.2 ? 22 : zoom >= 6 ? 16 : 10;
  const minDistance = zoom >= 7.2 ? 4.5 : zoom >= 6 ? 5.8 : 7.2;

  const selected: RegionLabel[] = [];

  visible
    .filter((_, index) => index % step === 0)
    .forEach((region) => {
      if (selected.length >= maxCount) return;

      const overlapped = selected.some(
        (item) => Math.hypot(item.x - region.centroid.x, item.y - region.centroid.y) < minDistance,
      );
      if (overlapped) return;

      selected.push({
        id: region.code,
        x: region.centroid.x,
        y: region.centroid.y,
        shortLabel: region.shortLabel,
      });
    });

  return selected;
}

function buildVisibleDongLabels(
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  zoom: number,
) {
  if (zoom < 10.5) return [];

  const visible = dongMap.filter((region) => isInVisibleBounds(region.centroid, bounds, 1.2));
  const step = zoom >= 15 ? 1 : zoom >= 12.5 ? 2 : 3;
  const maxCount = zoom >= 15 ? 34 : zoom >= 12.5 ? 24 : 16;
  const minDistance = zoom >= 15 ? 2.4 : zoom >= 12.5 ? 3 : 3.8;

  const selected: RegionLabel[] = [];

  visible
    .filter((_, index) => index % step === 0)
    .forEach((region) => {
      if (selected.length >= maxCount) return;

      const overlapped = selected.some(
        (item) => Math.hypot(item.x - region.centroid.x, item.y - region.centroid.y) < minDistance,
      );
      if (overlapped) return;

      selected.push({
        id: region.code,
        x: region.centroid.x,
        y: region.centroid.y,
        shortLabel: region.shortLabel,
      });
    });

  return selected;
}

function formatOrdinalRank(value: number) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = value % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}

function findContainingProvince(coordinates: [number, number]) {
  const featureItem = koreaFeatureCollection.features.find((item) => geoContains(item as never, coordinates));
  if (!featureItem) return null;
  return provinceMap.find((item) => item.code === featureItem.properties.CODE) ?? null;
}

function findContainingDistrict(coordinates: [number, number]) {
  const featureItem = koreaSigunguFeatureCollection.features.find((item) => geoContains(item as never, coordinates));
  if (!featureItem) return null;
  return districtMap.find((item) => item.code === featureItem.properties.CODE) ?? null;
}

function findContainingDong(coordinates: [number, number]) {
  const featureItem = koreaEmdFeatureCollection.features.find((item) => geoContains(item as never, coordinates));
  if (!featureItem) return null;
  return dongMap.find((item) => item.code === featureItem.properties.CODE) ?? null;
}

function buildRegionFromCoordinates(latitude: number, longitude: number) {
  const coordinates: [number, number] = [longitude, latitude];
  const dong = findContainingDong(coordinates);
  const district = dong
    ? districtMap.find((item) => item.code.slice(0, 5) === dong.code.slice(0, 5)) ?? null
    : findContainingDistrict(coordinates);
  const province = district
    ? provinceMap.find((item) => item.code.slice(0, 2) === district.code.slice(0, 2)) ?? null
    : findContainingProvince(coordinates);

  if (!province || !district) return null;

  return {
    sido: province.label,
    sigungu: district.label,
    dong: dong?.label ?? "",
  };
}

function TraceMap({
  traces,
  clusters,
  activeTrace,
  previewTrace,
  pulseUserId,
  onPickTrace,
  onSelectLocation,
  canFocusMyTrace,
  onFocusMyTrace,
  canRemoveMyTrace,
  removing,
  onRemoveMyTrace,
}: {
  traces: DisplayTrace[];
  clusters: TraceCluster[];
  activeTrace: DisplayTrace | null;
  previewTrace: DisplayTrace | null;
  pulseUserId: string | null;
  onPickTrace: (trace: DisplayTrace | null) => void;
  onSelectLocation: (region: { sido: string; sigungu: string; dong: string }) => void;
  canFocusMyTrace: boolean;
  onFocusMyTrace: () => void;
  canRemoveMyTrace: boolean;
  removing: boolean;
  onRemoveMyTrace: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const dragRef = useRef<{ id: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const touchDragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const touchPinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const mapFrameRef = useRef<HTMLDivElement | null>(null);
  const draggedRef = useRef(false);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const detailLevel = zoom >= 4.5 ? "sigungu" : "sido";
  const showProvinceLabels = zoom < 5;
  const showDistrictLabels = zoom >= 5;
  const getRenderMetrics = useCallback((rect: { width: number; height: number }) => {
    if (!rect.width || !rect.height) {
      return {
        contentWidth: rect.width,
        contentHeight: rect.height,
        offsetX: 0,
        offsetY: 0,
      };
    }

    const viewRatio = MAP_WIDTH / MAP_HEIGHT;
    const frameRatio = rect.width / rect.height;

    if (frameRatio > viewRatio) {
      const contentHeight = rect.height;
      const contentWidth = rect.height * viewRatio;
      return {
        contentWidth,
        contentHeight,
        offsetX: (rect.width - contentWidth) / 2,
        offsetY: 0,
      };
    }

    const contentWidth = rect.width;
    const contentHeight = rect.width / viewRatio;
    return {
      contentWidth,
      contentHeight,
      offsetX: 0,
      offsetY: (rect.height - contentHeight) / 2,
    };
  }, []);
  const visibleBounds = useMemo(() => {
    const frame = mapFrameRef.current;
    if (!frame) {
      return { minX: 0, maxX: MAP_WIDTH, minY: 0, maxY: MAP_HEIGHT };
    }

    const rect = frame.getBoundingClientRect();
    const { contentWidth, contentHeight, offsetX, offsetY } = getRenderMetrics(rect);
    return {
      minX: clamp((((0 - pan.x) / zoom) - offsetX) / contentWidth * MAP_WIDTH, 0, MAP_WIDTH),
      maxX: clamp((((rect.width - pan.x) / zoom) - offsetX) / contentWidth * MAP_WIDTH, 0, MAP_WIDTH),
      minY: clamp((((0 - pan.y) / zoom) - offsetY) / contentHeight * MAP_HEIGHT, 0, MAP_HEIGHT),
      maxY: clamp((((rect.height - pan.y) / zoom) - offsetY) / contentHeight * MAP_HEIGHT, 0, MAP_HEIGHT),
    };
  }, [getRenderMetrics, pan.x, pan.y, zoom]);
  const provinceLabels = useMemo(() => buildVisibleRegionLabels(clusters), [clusters]);
  const districtLabels = useMemo(() => buildVisibleDistrictLabels(visibleBounds, zoom), [visibleBounds, zoom]);
  const screenPxToSvg = useCallback(
    (screenPx: number) => {
      if (!frameSize.width || !frameSize.height || !zoom) return 0.3;
      const { contentWidth } = getRenderMetrics(frameSize);
      return (screenPx * MAP_WIDTH) / (contentWidth * zoom);
    },
    [frameSize, getRenderMetrics, zoom],
  );
  const provinceFontSize = useMemo(() => {
    const px = zoom < 1.8 ? 22 : zoom < 2.6 ? 19 : zoom < 3.4 ? 16 : 13;
    return screenPxToSvg(px).toFixed(2);
  }, [screenPxToSvg, zoom]);
  const districtFontSize = useMemo(() => {
    const px = zoom < 7 ? 15 : zoom < 9.5 ? 13 : 11;
    return screenPxToSvg(px).toFixed(2);
  }, [screenPxToSvg, zoom]);
  const provinceCounts = useMemo(() => {
    const counts = new Map<string, number>();

    traces.forEach((trace) => {
      const key = normalizeSido(trace.sido);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return counts;
  }, [traces]);

  const districtCounts = useMemo(() => {
    const counts = new Map<string, number>();

    traces.forEach((trace) => {
      const key = `${normalizeSido(trace.sido)}|${normalizeRegionPart(trace.sigungu)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return counts;
  }, [traces]);
  const nearbyTraceCards = useMemo(() => {
    if (!activeTrace) return [];

    const nearby = traces
      .filter((trace) => trace.publicImageUrl || trace.instagramHandle)
      .map((trace) => ({
        trace,
        distance: Math.hypot(trace.displayX - activeTrace.displayX, trace.displayY - activeTrace.displayY),
      }))
      .filter(({ distance }) => distance <= 18 || distance === 0)
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 12)
      .map(({ trace }) => trace);

    if (nearby.length > 0) return nearby;

    return activeTrace.publicImageUrl || activeTrace.instagramHandle ? [activeTrace] : [];
  }, [activeTrace, traces]);

  const clampPan = useCallback((nextZoom: number, nextPan: { x: number; y: number }) => {
    const frame = mapFrameRef.current;
    if (!frame) return nextPan;

    const rect = frame.getBoundingClientRect();
    const scaledWidth = rect.width * nextZoom;
    const scaledHeight = rect.height * nextZoom;
    const minX = Math.min(0, rect.width - scaledWidth);
    const minY = Math.min(0, rect.height - scaledHeight);

    return {
      x: clamp(nextPan.x, minX, 0),
      y: clamp(nextPan.y, minY, 0),
    };
  }, []);

  const computeCenteredPan = useCallback(
    (targetX: number, targetY: number, nextZoom: number) => {
      const frame = mapFrameRef.current;
      if (!frame) return null;

      const rect = frame.getBoundingClientRect();
      const { contentWidth, contentHeight, offsetX, offsetY } = getRenderMetrics(rect);
      return clampPan(nextZoom, {
        x: rect.width / 2 - nextZoom * (offsetX + (targetX / MAP_WIDTH) * contentWidth),
        y: rect.height / 2 - nextZoom * (offsetY + (targetY / MAP_HEIGHT) * contentHeight),
      });
    },
    [clampPan, getRenderMetrics],
  );

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    const frame = mapFrameRef.current;
    if (!frame) return;

    const syncSize = () => {
      setFrameSize({
        width: frame.clientWidth,
        height: frame.clientHeight,
      });
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  const applyZoomAtPoint = useCallback(
    (targetZoom: number, clientX?: number, clientY?: number) => {
      const frame = mapFrameRef.current;
      const boundedZoom = clamp(Number(targetZoom.toFixed(2)), 1, 20);

      if (!frame) {
        setZoom(boundedZoom);
        setPan((prev) => clampPan(boundedZoom, prev));
        return;
      }

      const rect = frame.getBoundingClientRect();
      const { contentWidth, contentHeight, offsetX, offsetY } = getRenderMetrics(rect);
      const focalX = clientX !== undefined ? clientX - rect.left : rect.width / 2;
      const focalY = clientY !== undefined ? clientY - rect.top : rect.height / 2;
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      const svgX = ((((focalX - currentPan.x) / currentZoom) - offsetX) / contentWidth) * MAP_WIDTH;
      const svgY = ((((focalY - currentPan.y) / currentZoom) - offsetY) / contentHeight) * MAP_HEIGHT;

      setZoom(boundedZoom);
      setPan(
        clampPan(boundedZoom, {
          x: focalX - boundedZoom * (offsetX + (svgX / MAP_WIDTH) * contentWidth),
          y: focalY - boundedZoom * (offsetY + (svgY / MAP_HEIGHT) * contentHeight),
        }),
      );
    },
    [clampPan, getRenderMetrics],
  );

  const updateZoom = useCallback(
    (delta: number, clientX?: number, clientY?: number) => {
      applyZoomAtPoint(zoomRef.current + delta, clientX, clientY);
    },
    [applyZoomAtPoint],
  );

  useEffect(() => {
    if (!previewTrace) return;
    const currentZoom = zoomRef.current;
    const nextZoom = currentZoom < 2.2 ? 2.2 : currentZoom;
    const centeredPan = computeCenteredPan(previewTrace.displayX, previewTrace.displayY, nextZoom);
    if (!centeredPan) return;
    setZoom(nextZoom);
    setPan(centeredPan);
  }, [computeCenteredPan, previewTrace?.displayX, previewTrace?.displayY, previewTrace?.regionKey]);

  useEffect(() => {
    if (previewTrace || !activeTrace) return;
    const currentZoom = zoomRef.current;
    const nextZoom = currentZoom < 2 ? 2 : currentZoom;
    const centeredPan = computeCenteredPan(activeTrace.displayX, activeTrace.displayY, nextZoom);
    if (!centeredPan) return;
    setZoom(nextZoom);
    setPan(centeredPan);
  }, [activeTrace?.displayX, activeTrace?.displayY, activeTrace?.user_id, computeCenteredPan, previewTrace]);

  return (
    <div
      className="relative select-none overflow-hidden rounded-[34px] border border-white/10 bg-[#05070B] shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
      style={{ userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 16%, rgba(60,120,255,0.22) 0%, transparent 32%), radial-gradient(circle at 80% 82%, rgba(67,231,184,0.16) 0%, transparent 34%), radial-gradient(circle at 50% 50%, rgba(10,14,22,0.6) 0%, transparent 70%)",
        }}
      />

      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        {canFocusMyTrace && (
          <button
            onClick={onFocusMyTrace}
            className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-[12px] font-bold text-white/80 shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
          >
            내 흔적
          </button>
        )}
        {canRemoveMyTrace && (
          <button
            onClick={onRemoveMyTrace}
            disabled={removing}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-white/78 shadow-[0_8px_24px_rgba(0,0,0,0.18)] disabled:opacity-60"
            aria-label="내 흔적 삭제"
            title="내 흔적 삭제"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3.6 4.3h8.8M6.2 2.7h3.6M5.1 4.3l.5 7.1a1 1 0 0 0 1 .9h2.8a1 1 0 0 0 1-.9l.5-7.1M6.7 6.4v4.1M9.3 6.4v4.1" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <span className="text-[11px] font-bold text-white/38">1x</span>
          <input
            type="range"
            min="1"
            max="20"
            step="0.1"
            value={zoom}
            onChange={(event) => applyZoomAtPoint(Number(event.target.value))}
            className="h-2 w-24 accent-white"
            aria-label="지도 확대 슬라이더"
          />
          <span className="text-[11px] font-bold text-white/72">{zoom.toFixed(1)}x</span>
        </div>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-[12px] font-bold text-white/80 shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
        >
          원위치
        </button>
      </div>

      <div
        ref={mapFrameRef}
        className="relative aspect-square w-full touch-none select-none cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
        onWheel={(event) => {
          event.preventDefault();
          updateZoom(event.deltaY < 0 ? 0.55 : -0.55, event.clientX, event.clientY);
        }}
        onTouchStart={(event) => {
          if (event.touches.length === 1) {
            const [touch] = Array.from(event.touches);
            touchDragRef.current = {
              startX: touch.clientX,
              startY: touch.clientY,
              baseX: panRef.current.x,
              baseY: panRef.current.y,
            };
            draggedRef.current = false;
          }
          if (event.touches.length === 2) {
            const [first, second] = Array.from(event.touches);
            touchPinchRef.current = {
              distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
              zoom: zoomRef.current,
            };
            touchDragRef.current = null;
            draggedRef.current = true;
          }
        }}
        onTouchMove={(event) => {
          if (event.touches.length !== 2 || !touchPinchRef.current) return;
          if (event.touches.length === 2) {
            if (event.cancelable) event.preventDefault();
            const [first, second] = Array.from(event.touches);
            const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
            const midX = (first.clientX + second.clientX) / 2;
            const midY = (first.clientY + second.clientY) / 2;
            const scale = distance / touchPinchRef.current.distance;
            applyZoomAtPoint(touchPinchRef.current.zoom * scale, midX, midY);
            return;
          }
        }}
        onTouchMoveCapture={(event) => {
          if (event.touches.length !== 1 || touchPinchRef.current || !touchDragRef.current) return;
          const [touch] = Array.from(event.touches);
          if (event.cancelable) event.preventDefault();
          if (Math.abs(touch.clientX - touchDragRef.current.startX) > 4 || Math.abs(touch.clientY - touchDragRef.current.startY) > 4) {
            draggedRef.current = true;
          }
          setPan(
            clampPan(zoomRef.current, {
              x: touchDragRef.current.baseX + (touch.clientX - touchDragRef.current.startX),
              y: touchDragRef.current.baseY + (touch.clientY - touchDragRef.current.startY),
            }),
          );
        }}
        onTouchEnd={(event) => {
          if (event.touches.length < 2) {
            touchPinchRef.current = null;
          }
          if (event.touches.length === 1) {
            const [touch] = Array.from(event.touches);
            touchDragRef.current = {
              startX: touch.clientX,
              startY: touch.clientY,
              baseX: panRef.current.x,
              baseY: panRef.current.y,
            };
          } else if (event.touches.length === 0) {
            touchDragRef.current = null;
          }
        }}
        onPointerDown={(event) => {
          if (event.pointerType === "touch") return;
          pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pointersRef.current.size === 2) {
            const [first, second] = [...pointersRef.current.values()];
            pinchRef.current = {
              distance: Math.hypot(second.x - first.x, second.y - first.y),
              zoom: zoomRef.current,
            };
            dragRef.current = null;
            draggedRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            return;
          }
          dragRef.current = {
            id: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            baseX: pan.x,
            baseY: pan.y,
          };
          draggedRef.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (event.pointerType === "touch") return;
          if (pointersRef.current.has(event.pointerId)) {
            pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          }
          if (pointersRef.current.size === 2 && pinchRef.current) {
            const [first, second] = [...pointersRef.current.values()];
            const distance = Math.hypot(second.x - first.x, second.y - first.y);
            const midX = (first.x + second.x) / 2;
            const midY = (first.y + second.y) / 2;
            const scale = distance / pinchRef.current.distance;
            applyZoomAtPoint(pinchRef.current.zoom * scale, midX, midY);
            return;
          }
          const drag = dragRef.current;
          if (!drag || drag.id !== event.pointerId) return;
          if (Math.abs(event.clientX - drag.startX) > 4 || Math.abs(event.clientY - drag.startY) > 4) {
            draggedRef.current = true;
          }
          setPan(
            clampPan(zoom, {
              x: drag.baseX + (event.clientX - drag.startX),
              y: drag.baseY + (event.clientY - drag.startY),
            }),
          );
        }}
        onPointerUp={(event) => {
          if (event.pointerType === "touch") return;
          pointersRef.current.delete(event.pointerId);
          if (pointersRef.current.size < 2) {
            pinchRef.current = null;
          }
          if (dragRef.current?.id === event.pointerId) {
            dragRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          pointersRef.current.clear();
          pinchRef.current = null;
          dragRef.current = null;
        }}
        onClick={(event) => {
          if (draggedRef.current) {
            draggedRef.current = false;
            return;
          }

          if (activeTrace) {
            onPickTrace(null);
            return;
          }

          const frame = mapFrameRef.current;
          if (!frame) return;

          const rect = frame.getBoundingClientRect();
          const { contentWidth, contentHeight, offsetX, offsetY } = getRenderMetrics(rect);
          const localX = event.clientX - rect.left;
          const localY = event.clientY - rect.top;
          const svgX = ((((localX - pan.x) / zoom) - offsetX) / contentWidth) * MAP_WIDTH;
          const svgY = ((((localY - pan.y) / zoom) - offsetY) / contentHeight) * MAP_HEIGHT;
          const invert = projection.invert;
          if (!invert) return;
          const coordinates = invert([svgX, svgY]);

          if (!coordinates) return;

          const region = buildRegionFromCoordinates(coordinates[1], coordinates[0]);
          if (!region) return;
          onSelectLocation(region);
        }}
      >
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
          }}
        >

          <path d={koreaLandPath} fill="rgba(7,10,16,0.99)" />

          {detailLevel === "sido" &&
            provinceMap.map((region) => {
              const count = provinceCounts.get(region.label) ?? 0;
              if (count === 0) return null;
              const fillAlpha = Math.min(0.24 + count * 0.06, 0.62);

              return (
                <path key={region.code} d={region.path} fill={`rgba(91, 224, 197, ${fillAlpha})`} />
              );
            })}

          {detailLevel === "sigungu" &&
            districtMap.map((region) => {
              const province = provinceMap.find((item) => item.code.slice(0, 2) === region.code.slice(0, 2));
              const count = districtCounts.get(`${province?.label ?? ""}|${region.normalizedLabel}`) ?? 0;
              if (count === 0) return null;
              const fillAlpha = Math.min(0.18 + count * 0.065, 0.58);

              return (
                <path key={region.code} d={region.path} fill={`rgba(91, 224, 197, ${fillAlpha})`} />
              );
            })}


          {detailLevel === "sido" && (
            <path
              d={koreaSidoMeshPath}
              fill="none"
              stroke="rgba(120,200,180,0.5)"
              strokeWidth="0.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              shapeRendering="geometricPrecision"
            />
          )}

          {detailLevel === "sigungu" && (
            <path
              d={koreaSigunguMeshPath}
              fill="none"
              stroke="rgba(120,200,180,0.38)"
              strokeWidth="0.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              shapeRendering="geometricPrecision"
            />
          )}



          {showProvinceLabels &&
            provinceLabels.map((region) => (
              <g key={region.id} opacity="0.82" pointerEvents="none">
                <circle cx={region.x} cy={region.y} r="0.42" fill="rgba(255,255,255,0.18)" />
                <text
                  x={region.x + 1}
                  y={region.y - 1}
                  fill="rgba(255,255,255,0.28)"
                  fontSize={provinceFontSize}
                  fontWeight="700"
                  letterSpacing="0.04em"
                  style={{ userSelect: "none", WebkitUserSelect: "none" }}
                >
                  {region.shortLabel}
                </text>
              </g>
            ))}

          {showDistrictLabels &&
            districtLabels.map((region) => (
              <g key={region.id} opacity="0.76" pointerEvents="none">
                <circle cx={region.x} cy={region.y} r="0.22" fill="rgba(255,255,255,0.15)" />
                <text
                  x={region.x + 0.55}
                  y={region.y - 0.55}
                  fill="rgba(255,255,255,0.24)"
                  fontSize={districtFontSize}
                  fontWeight="700"
                  letterSpacing="0.03em"
                  style={{ userSelect: "none", WebkitUserSelect: "none" }}
                >
                  {region.shortLabel}
                </text>
              </g>
            ))}

          {traces.map((trace) => {
            const isActive = !previewTrace && activeTrace?.user_id === trace.user_id;
            const shouldPulse = pulseUserId === trace.user_id;
            const squareSize = screenPxToSvg(isActive ? 7 : 5);
            const hitAreaSize = screenPxToSvg(26);
            const ringSize = screenPxToSvg(12);

            return (
              <g
                key={`${trace.user_id}-${trace.regionKey}`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onTouchStart={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onPickTrace(isActive ? null : trace);
                }}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={trace.displayX - hitAreaSize / 2}
                  y={trace.displayY - hitAreaSize / 2}
                  width={hitAreaSize}
                  height={hitAreaSize}
                  fill="transparent"
                />
                <rect
                  x={trace.displayX - squareSize / 2}
                  y={trace.displayY - squareSize / 2}
                  width={squareSize}
                  height={squareSize}
                  fill={isActive ? "rgba(255,196,79,1)" : "rgba(255,255,255,0.97)"}
                >
                  {!isActive && (
                    <animate
                      attributeName="opacity"
                      values="0.55;1;0.7;1;0.55"
                      dur={`${2.4 + ((Math.round(trace.displayX * 17 + trace.displayY * 23)) % 100) / 100 * 2.4}s`}
                      begin={`-${((Math.round(trace.displayX * 13 + trace.displayY * 19)) % 100) / 100 * 2.2}s`}
                      repeatCount="indefinite"
                    />
                  )}
                </rect>
                {shouldPulse && (
                  <rect
                    x={trace.displayX - screenPxToSvg(4)}
                    y={trace.displayY - screenPxToSvg(4)}
                    width={screenPxToSvg(8)}
                    height={screenPxToSvg(8)}
                    fill="rgba(255,196,79,0.28)"
                  >
                    <animate
                      attributeName="x"
                      values={`${trace.displayX - screenPxToSvg(4)};${trace.displayX - screenPxToSvg(13)};${trace.displayX - screenPxToSvg(4)}`}
                      dur="1.15s"
                      repeatCount="1"
                    />
                    <animate
                      attributeName="y"
                      values={`${trace.displayY - screenPxToSvg(4)};${trace.displayY - screenPxToSvg(13)};${trace.displayY - screenPxToSvg(4)}`}
                      dur="1.15s"
                      repeatCount="1"
                    />
                    <animate
                      attributeName="width"
                      values={`${screenPxToSvg(8)};${screenPxToSvg(26)};${screenPxToSvg(8)}`}
                      dur="1.15s"
                      repeatCount="1"
                    />
                    <animate
                      attributeName="height"
                      values={`${screenPxToSvg(8)};${screenPxToSvg(26)};${screenPxToSvg(8)}`}
                      dur="1.15s"
                      repeatCount="1"
                    />
                    <animate attributeName="opacity" values="0.42;0;0" dur="1.15s" repeatCount="1" />
                  </rect>
                )}
                {isActive && (
                  <rect
                    x={trace.displayX - ringSize / 2}
                    y={trace.displayY - ringSize / 2}
                    width={ringSize}
                    height={ringSize}
                    fill="none"
                    stroke="rgba(255,196,79,0.44)"
                    strokeWidth="0.12"
                  />
                )}
              </g>
            );
          })}

          {previewTrace && (
            <g key={`preview-${previewTrace.regionKey}`} style={{ pointerEvents: "none" }}>
              <rect
                x={previewTrace.displayX - screenPxToSvg(3.5)}
                y={previewTrace.displayY - screenPxToSvg(3.5)}
                width={screenPxToSvg(7)}
                height={screenPxToSvg(7)}
                fill="rgba(255,196,79,0.98)"
              />
              <rect
                x={previewTrace.displayX - screenPxToSvg(4.5)}
                y={previewTrace.displayY - screenPxToSvg(4.5)}
                width={screenPxToSvg(9)}
                height={screenPxToSvg(9)}
                fill="rgba(255,196,79,0.22)"
              >
                <animate
                  attributeName="x"
                  values={`${previewTrace.displayX - screenPxToSvg(4.5)};${previewTrace.displayX - screenPxToSvg(13)};${previewTrace.displayX - screenPxToSvg(4.5)}`}
                  dur="1.1s"
                  repeatCount="1"
                />
                <animate
                  attributeName="y"
                  values={`${previewTrace.displayY - screenPxToSvg(4.5)};${previewTrace.displayY - screenPxToSvg(13)};${previewTrace.displayY - screenPxToSvg(4.5)}`}
                  dur="1.1s"
                  repeatCount="1"
                />
                <animate
                  attributeName="width"
                  values={`${screenPxToSvg(9)};${screenPxToSvg(26)};${screenPxToSvg(9)}`}
                  dur="1.1s"
                  repeatCount="1"
                />
                <animate
                  attributeName="height"
                  values={`${screenPxToSvg(9)};${screenPxToSvg(26)};${screenPxToSvg(9)}`}
                  dur="1.1s"
                  repeatCount="1"
                />
                <animate attributeName="opacity" values="0.38;0;0" dur="1.1s" repeatCount="1" />
              </rect>
              <rect
                x={previewTrace.displayX - screenPxToSvg(6)}
                y={previewTrace.displayY - screenPxToSvg(6)}
                width={screenPxToSvg(12)}
                height={screenPxToSvg(12)}
                fill="none"
                stroke="rgba(255,196,79,0.44)"
                strokeWidth="0.12"
              />
            </g>
          )}
        </svg>
      </div>

      {nearbyTraceCards.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
          <div className="pointer-events-auto flex max-w-[calc(100%-24px)] gap-2 overflow-x-auto rounded-[18px] border border-white/10 bg-[rgba(8,11,16,0.84)] px-2.5 py-2 shadow-[0_18px_40px_rgba(0,0,0,0.34)] backdrop-blur-xl">
            {nearbyTraceCards.map((trace) => {
              const selected = activeTrace?.user_id === trace.user_id;
              return (
                <button
                  key={`${trace.user_id}-${trace.regionKey}-card`}
                  type="button"
                  onClick={() => onPickTrace(selected ? null : trace)}
                  className={`shrink-0 overflow-hidden rounded-[14px] border transition ${
                    selected ? "border-[#FFC44F] shadow-[0_0_0_1px_rgba(255,196,79,0.24)]" : "border-white/10"
                  }`}
                  aria-label="흔적 보기"
                >
                  {trace.publicImageUrl ? (
                    <img src={trace.publicImageUrl} alt="" className="h-[64px] w-[64px] object-cover" />
                  ) : (
                    <div className="flex h-[64px] w-[64px] items-center justify-center bg-white/[0.04] px-2 text-center text-[10px] font-bold text-[#6BE2C5]">
                      @{trace.instagramHandle}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

export default function TraceLabPage() {
  const { user, loading, login } = useAuth();
  const [payload, setPayload] = useState<TracePayload | null>(null);
  const [loadingState, setLoadingState] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [clickedLatLng, setClickedLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pulseUserId, setPulseUserId] = useState<string | null>(null);
  const [activeTrace, setActiveTrace] = useState<Trace | null>(null);
  const [form, setForm] = useState({
    sido: "서울특별시",
    sigungu: "",
    dong: "",
    shareImage: false,
    selectedImageId: "",
    shareInstagram: false,
    instagramHandle: "",
  });

  const fetchPayload = useCallback(async () => {
    setLoadingState(true);
    try {
      const response = await fetch("/api/lab/traces", { cache: "no-store" });
      const data = await response.json();
      setPayload(data);
      setActiveTrace(data.me?.trace ?? data.traces?.[0] ?? null);
      setError(null);
    } catch {
      setError("흔적 지도를 불러오지 못했어요.");
    } finally {
      setLoadingState(false);
    }
  }, []);

  useEffect(() => {
    fetchPayload();
  }, [fetchPayload]);

  useEffect(() => {
    if (error) setPanelExpanded(true);
  }, [error]);

  useEffect(() => {
    const images = payload?.me.selectableImages ?? [];
    if (images.length === 0) {
      setForm((current) => (current.selectedImageId ? { ...current, selectedImageId: "" } : current));
      return;
    }

    setForm((current) => {
      if (images.some((image) => image.id === current.selectedImageId)) return current;
      return { ...current, selectedImageId: images[0]?.id ?? "" };
    });
  }, [payload?.me.selectableImages]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (!pulseUserId) return;
    const timer = window.setTimeout(() => setPulseUserId(null), 1300);
    return () => window.clearTimeout(timer);
  }, [pulseUserId]);

  const displayTraces = useMemo(() => (payload?.traces ?? []).map(buildDisplayTrace), [payload?.traces]);
  const geoDisplayTraces = useMemo<GeoDisplayTrace[]>(
    () =>
      displayTraces.map((trace) => {
        const inverted = projection.invert?.([trace.displayX, trace.displayY]);
        return {
          ...trace,
          lng: inverted?.[0] ?? 127.8,
          lat: inverted?.[1] ?? 36.4,
        };
      }),
    [displayTraces],
  );
  const activeDisplayTrace = useMemo(
    () => geoDisplayTraces.find((trace) => trace.user_id === activeTrace?.user_id) ?? null,
    [activeTrace?.user_id, geoDisplayTraces],
  );
  const selectedImage = useMemo(
    () => payload?.me.selectableImages.find((image) => image.id === form.selectedImageId) ?? null,
    [form.selectedImageId, payload?.me.selectableImages],
  );
  const previewDisplayTrace = useMemo<GeoDisplayTrace | null>(() => {
    if (!user || payload?.me.alreadyJoined) return null;
    const normalizedSido = normalizeSido(form.sido);
    const normalizedSigungu = normalizeRegionPart(form.sigungu);
    const normalizedDong = normalizeRegionPart(form.dong);

    if (!normalizedSido || !normalizedSigungu) return null;

    const built = buildDisplayTrace({
      user_id: user.id,
      sido: normalizedSido,
      sigungu: normalizedSigungu,
      dong: normalizedDong,
      x: 0,
      y: 0,
      regionKey: buildTraceRegionKey(normalizedSido, normalizedSigungu, normalizedDong),
      regionLabel: formatTraceRegion(normalizedSido, normalizedSigungu, normalizedDong),
      publicImageUrl: form.shareImage ? selectedImage?.result_image_url ?? null : null,
      instagramHandle: form.shareInstagram ? form.instagramHandle.trim().replace(/^@+/, "") || null : null,
      created_at: null,
    });
    const inverted = projection.invert?.([built.displayX, built.displayY]);
    return {
      ...built,
      lng: clickedLatLng?.lng ?? inverted?.[0] ?? 127.8,
      lat: clickedLatLng?.lat ?? inverted?.[1] ?? 36.4,
    };
  }, [clickedLatLng, form.dong, form.instagramHandle, form.shareImage, form.shareInstagram, form.sido, form.sigungu, payload?.me.alreadyJoined, selectedImage?.result_image_url, user]);
  const clusters = useMemo(() => buildClusters(geoDisplayTraces), [geoDisplayTraces]);
  const cityHotspots = useMemo(() => {
    const counts = new Map<string, { sido: string; label: string; count: number }>();

    displayTraces.forEach((trace) => {
      const sido = normalizeSido(trace.sido);
      const label = getSidoOption(sido)?.shortLabel ?? sido;
      const current = counts.get(sido);
      if (current) {
        current.count += 1;
        return;
      }
      counts.set(sido, { sido, label, count: 1 });
    });

    return [...counts.values()].sort((left, right) => right.count - left.count).slice(0, 3);
  }, [displayTraces]);
  const districtSuggestions = useMemo(() => getDistrictSuggestions(form.sido), [form.sido]);
  const dongSuggestions = useMemo(() => getDongSuggestions(form.sido, form.sigungu), [form.sido, form.sigungu]);

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/lab/traces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sido: form.sido,
          sigungu: form.sigungu,
          dong: form.dong,
          shareImage: form.shareImage,
          selectedImageId: form.shareImage ? form.selectedImageId : "",
          instagramHandle: form.shareInstagram ? form.instagramHandle : "",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "흔적을 남기지 못했어요.");
        return;
      }

      const nextTraces = data.alreadyJoined ? payload?.traces ?? [] : [{ ...data.trace }, ...(payload?.traces ?? [])];
      const nextPayload: TracePayload = {
        traces: nextTraces,
        summary: recomputeSummary(nextTraces),
        me: {
          loggedIn: true,
          eligible: true,
          alreadyJoined: true,
          trace: data.trace,
          latestImageUrl: payload?.me.latestImageUrl ?? null,
          selectableImages: payload?.me.selectableImages ?? [],
        },
      };

      setPayload(nextPayload);
      setActiveTrace(data.trace);
      setPulseUserId(data.trace.user_id);
      setPanelExpanded(false);
      setToastMessage("흔적을 남겼어요");
    } catch {
      setError("흔적을 남기지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMyTrace = async () => {
    if (removing) return;
    const confirmed = window.confirm("흔적을 삭제하시겠습니까?");
    if (!confirmed) return;
    setRemoving(true);
    setError(null);

    try {
      const response = await fetch("/api/lab/traces", {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "내 흔적을 삭제하지 못했어요.");
        return;
      }

      const myUserId = payload?.me.trace?.user_id ?? user?.id ?? null;
      const nextTraces = (payload?.traces ?? []).filter((trace) => trace.user_id !== myUserId);
      const nextPayload: TracePayload = {
        traces: nextTraces,
        summary: recomputeSummary(nextTraces),
        me: {
          loggedIn: Boolean(user),
          eligible: payload?.me.eligible ?? false,
          alreadyJoined: false,
          trace: null,
          latestImageUrl: payload?.me.latestImageUrl ?? null,
          selectableImages: payload?.me.selectableImages ?? [],
        },
      };

      setPayload(nextPayload);
      setActiveTrace(nextTraces[0] ?? null);
      setToastMessage("내 흔적을 지웠어요");
    } catch {
      setError("내 흔적을 삭제하지 못했어요.");
    } finally {
      setRemoving(false);
    }
  };

  const handleSelectLocation = useCallback((region: { sido: string; sigungu: string; dong: string; lat: number; lng: number }) => {
    setError(null);
    setActiveTrace(null);
    setPanelExpanded(true);
    setClickedLatLng({ lat: region.lat, lng: region.lng });
    setForm((current) => ({
      ...current,
      sido: normalizeSido(region.sido),
      sigungu: normalizeRegionPart(region.sigungu),
      dong: normalizeRegionPart(region.dong),
    }));
  }, []);

  const fillFromCurrentLocation = async () => {
    if (locating) return;
    setLocating(true);
    setError(null);

    try {
      if (!window.isSecureContext) {
        throw new Error("현재 위치 자동 입력은 HTTPS 또는 localhost에서만 작동해요.");
      }

      if (!navigator.geolocation) {
        throw new Error("현재 위치를 지원하지 않는 기기예요.");
      }

      const position = await getCurrentPositionWithFallback();

      const region = buildRegionFromCoordinates(position.coords.latitude, position.coords.longitude);
      if (!region) {
        throw new Error("현재 위치 지역 변환에 실패했어요.");
      }

      setActiveTrace(null);
      setForm((current) => ({
        ...current,
        sido: normalizeSido(region.sido),
        sigungu: normalizeRegionPart(region.sigungu),
        dong: normalizeRegionPart(region.dong),
      }));
    } catch (caught) {
      const geolocationError =
        typeof caught === "object" && caught !== null && "code" in caught
          ? (caught as { code?: number }).code
          : null;
      const message =
        geolocationError !== null
          ? geolocationError === 1
            ? "브라우저에서 위치 권한이 꺼져 있어요. 사이트 설정에서 위치를 허용해 주세요."
            : geolocationError === 2
              ? "기기에서 현재 위치를 찾지 못했어요. GPS나 네트워크 상태를 확인해 주세요."
              : geolocationError === 3
                ? "위치 확인 시간이 초과됐어요. 다시 시도하거나 아래에서 직접 입력해 주세요."
                : "현재 위치를 가져오지 못했어요."
          : caught instanceof Error
            ? caught.message
            : "현재 위치를 불러오지 못했어요.";
      setError(message);
    } finally {
      setLocating(false);
    }
  };

  const panelTitle = payload?.me.alreadyJoined
    ? "이미 흔적을 남겼어요"
    : previewDisplayTrace?.regionLabel
      ? "이 위치에 남길까요?"
      : "내 흔적 남기기";
  const panelSubtitle = !user
    ? "로그인 후 참여 가능"
    : payload && !payload.me.eligible
      ? "이미지를 한 번 만들면 참여 가능"
      : payload?.me.alreadyJoined && payload.me.trace
        ? payload.me.trace.regionLabel
        : previewDisplayTrace?.regionLabel ?? "시 / 구 / 동을 고르거나 자동 입력";
  const canQuickSubmit = Boolean(user && payload?.me.eligible && !payload?.me.alreadyJoined && previewDisplayTrace);
  const myDisplayTrace = useMemo(
    () => geoDisplayTraces.find((trace) => trace.user_id === payload?.me.trace?.user_id) ?? null,
    [geoDisplayTraces, payload?.me.trace?.user_id],
  );

  const participationOverlay = !loading ? (
    <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,11,16,0.9)_0%,rgba(10,13,18,0.72)_100%)] p-3 shadow-[0_18px_36px_rgba(0,0,0,0.26)] backdrop-blur-2xl">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPanelExpanded((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-[16px] bg-white/[0.03] px-3 py-2 text-left"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/34">참여하기</p>
            <p className="mt-0.5 truncate text-[15px] font-black tracking-[-0.03em] text-white">{panelTitle}</p>
            <p className="truncate text-[11px] text-white/48">{panelSubtitle}</p>
          </div>
          <svg
            className={`shrink-0 transition-transform duration-200 ${panelExpanded ? "rotate-180" : ""}`}
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path d="M4 6.5L8 10l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {canQuickSubmit ? (
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="shrink-0 rounded-[16px] bg-[#6BE2C5] px-3.5 py-3 text-[12px] font-black text-[#05110E] disabled:opacity-70"
          >
            {saving ? "남기는 중..." : "남기기"}
          </button>
        ) : null}
        {!payload?.me.alreadyJoined && user && payload?.me.eligible ? (
          <button
            onClick={fillFromCurrentLocation}
            disabled={locating}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.05] text-white/80 disabled:opacity-60"
            aria-label="현재 위치로 자동 입력"
            title="현재 위치로 자동 입력"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2.2V4M8 12v1.8M2.2 8H4M12 8h1.8M4.4 4.4l1.2 1.2M10.4 10.4l1.2 1.2M11.6 4.4l-1.2 1.2M5.6 10.4l-1.2 1.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="8" cy="8" r="2.35" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
          </button>
        ) : null}
      </div>

      {panelExpanded && (
        <div className="mt-2.5 space-y-2">
          {error ? (
            <div className="rounded-[14px] border border-[#FF7A6A]/20 bg-[#FF7A6A]/10 px-3 py-2 text-[12px] font-semibold text-[#FFB2A8]">
              {error}
            </div>
          ) : null}

          {!user ? (
            <button
              onClick={login}
              className="w-full rounded-[14px] bg-[#FEE500] px-3 py-2.5 text-[12px] font-black text-[#231815]"
            >
              카카오 로그인
            </button>
          ) : payload && !payload.me.eligible ? (
            <Link
              href="/studio"
              className="block w-full rounded-[14px] border border-white/10 bg-white/8 px-3 py-2.5 text-center text-[12px] font-black text-white/82"
            >
              생성하러 가기
            </Link>
          ) : payload?.me.alreadyJoined && payload.me.trace ? (
            <div className="space-y-2 rounded-[14px] border border-white/8 bg-white/[0.04] px-3 py-2.5 text-[12px] text-white/62">
              <div>{formatRelativeDate(payload.me.trace.created_at)}</div>
              {(payload.me.trace.publicImageUrl || payload.me.trace.instagramHandle) && (
                <div className="flex flex-wrap gap-1.5">
                  {payload.me.trace.publicImageUrl && (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/66">
                      이미지 공개중
                    </span>
                  )}
                  {payload.me.trace.instagramHandle && (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/66">
                      @{payload.me.trace.instagramHandle}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[0.9fr_0.86fr_0.9fr] gap-2">
                <select
                  value={form.sido}
                  onChange={(event) => {
                    setActiveTrace(null);
                    setClickedLatLng(null);
                    setForm((current) => ({
                      ...current,
                      sido: event.target.value,
                      sigungu: "",
                      dong: "",
                    }));
                  }}
                  className="h-10 min-w-0 rounded-[14px] border border-white/10 bg-[#0D1117]/88 px-3 text-[12px] font-semibold text-white outline-none"
                >
                  {SIDO_OPTIONS.map((option) => (
                    <option key={option.id} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={form.sigungu}
                  onChange={(event) => {
                    setActiveTrace(null);
                    setClickedLatLng(null);
                    setForm((current) => ({
                      ...current,
                      sigungu: event.target.value,
                      dong: "",
                    }));
                  }}
                  list="lab-trace-sigungu-list"
                  autoComplete="off"
                  placeholder="시 / 구 / 군"
                  className="h-10 min-w-0 rounded-[14px] border border-white/10 bg-[#0D1117]/88 px-3 text-[12px] font-semibold text-white placeholder:text-white/24 outline-none"
                />
                <input
                  value={form.dong}
                  onChange={(event) => {
                    setActiveTrace(null);
                    setClickedLatLng(null);
                    setForm((current) => ({ ...current, dong: event.target.value }));
                  }}
                  list="lab-trace-dong-list"
                  autoComplete="off"
                  placeholder="동 / 읍 / 면"
                  className="h-10 min-w-0 rounded-[14px] border border-white/10 bg-[#0D1117]/88 px-3 text-[12px] font-semibold text-white placeholder:text-white/24 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-between gap-3 rounded-[14px] border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] text-white/68">
                  <span className="font-bold text-white/86">이미지 공개</span>
                  <input
                    type="checkbox"
                    checked={form.shareImage}
                    disabled={!payload?.me.selectableImages.length}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        shareImage: event.target.checked && Boolean(payload?.me.selectableImages.length),
                        selectedImageId:
                          event.target.checked
                            ? current.selectedImageId || payload?.me.selectableImages[0]?.id || ""
                            : current.selectedImageId,
                      }))
                    }
                    className="h-4 w-4 accent-[#6BE2C5]"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-[14px] border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] text-white/68">
                  <span className="font-bold text-white/86">인스타 공개</span>
                  <input
                    type="checkbox"
                    checked={form.shareInstagram}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        shareInstagram: event.target.checked,
                        instagramHandle: event.target.checked
                          ? current.instagramHandle.startsWith("@")
                            ? current.instagramHandle
                            : current.instagramHandle
                              ? `@${current.instagramHandle.replace(/^@+/, "")}`
                              : "@"
                          : "",
                      }))
                    }
                    className="h-4 w-4 accent-[#6BE2C5]"
                  />
                </label>
              </div>

              {form.shareImage && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-white/48">
                    {payload?.me.selectableImages.length
                      ? "원하는 스타일드롭 결과를 골라서 흔적 카드에 남길 수 있어요."
                      : "아직 선택할 수 있는 결과 이미지가 없어요."}
                  </p>
                  {payload?.me.selectableImages.length ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {payload.me.selectableImages.map((image) => {
                        const selected = image.id === form.selectedImageId;
                        return (
                          <button
                            key={image.id}
                            type="button"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                shareImage: true,
                                selectedImageId: image.id,
                              }))
                            }
                            className={`relative w-[78px] shrink-0 overflow-hidden rounded-[16px] border transition ${
                              selected
                                ? "border-[#6BE2C5] shadow-[0_0_0_1px_rgba(107,226,197,0.28)]"
                                : "border-white/10"
                            }`}
                          >
                            <img src={image.result_image_url} alt="" className="aspect-[4/5] w-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6 text-left">
                              <p className="truncate text-[10px] font-black text-white/92">{image.style_id}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              )}

              {form.shareInstagram && (
                <input
                  value={form.instagramHandle}
                  onChange={(event) =>
                    setForm((current) => {
                      const raw = event.target.value.replace(/\s+/g, "");
                      const cleaned = raw.replace(/^@+/, "");
                      return {
                        ...current,
                        instagramHandle: raw === "" ? "@" : `@${cleaned}`,
                      };
                    })
                  }
                  autoComplete="off"
                  className="h-10 w-full rounded-[14px] border border-white/10 bg-[#0D1117]/88 px-3 text-[12px] font-semibold text-white placeholder:text-white/24 outline-none"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-[#06070A] text-white">
      <header className="sticky top-0 z-40 border-b border-white/6 bg-[#06070A]/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/studio" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:text-white/90">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <p className="text-[14px] font-bold tracking-[-0.02em] text-white/80">흔적 지도</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-5">
        <datalist id="lab-trace-sigungu-list">
          {districtSuggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <datalist id="lab-trace-dong-list">
          {dongSuggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>

        <section className="mb-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="flex items-baseline gap-1">
              <span className="text-[20px] font-black leading-none tracking-tight text-[#C9571A]">
                {payload?.summary.totalParticipants ?? 0}
              </span>
              <span className="text-[11px] text-white/38">명</span>
            </div>
            <div className="h-3 w-px bg-white/10" />
            <div className="flex items-baseline gap-1">
              <span className="text-[20px] font-black leading-none tracking-tight text-[#C9571A]">
                {payload?.summary.totalRegions ?? 0}
              </span>
              <span className="text-[11px] text-white/38">곳</span>
            </div>
            <div className="h-3 w-px bg-white/10" />
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
              <span className="shrink-0 text-[10px] text-white/32">가장 밝은</span>
              <span className="truncate text-[12px] font-medium tracking-[-0.02em] text-white/75">
                {payload?.summary.hottestRegion?.label ?? "—"}
              </span>
            </div>
          </div>

          {cityHotspots.length > 0 && (
            <div className="mt-2.5 overflow-x-auto border-t border-white/8 pt-2.5">
              <div className="flex min-w-max items-center gap-2">
                {cityHotspots.map((hotspot, index) => (
                  <button
                    key={hotspot.sido}
                    onClick={() => {
                      const picked = geoDisplayTraces.find((trace) => normalizeSido(trace.sido) === hotspot.sido) ?? null;
                      if (picked) {
                        setActiveTrace(picked);
                        setPulseUserId(picked.user_id);
                      }
                    }}
                    className="flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-0.5 text-left transition hover:border-white/14 hover:bg-white/[0.07]"
                  >
                    <span className="text-[10px] font-bold text-[#6BE2C5]">{formatOrdinalRank(index + 1)}</span>
                    <span className="text-[11px] text-white/70">{hotspot.label}</span>
                    <span className="text-[10px] text-white/32">{hotspot.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="grid gap-3">
          <section className="mx-auto w-full max-w-[390px]">
            {loadingState ? (
              <div className="flex aspect-[0.76] items-center justify-center rounded-[28px] border border-white/10 bg-white/5 text-white/55 sm:aspect-square">
                흔적 지도를 불러오는 중...
              </div>
            ) : (
              <KakaoTraceMap
                traces={geoDisplayTraces}
                activeTrace={activeDisplayTrace}
                previewTrace={previewDisplayTrace}
                pulseUserId={pulseUserId}
                onPickTrace={setActiveTrace}
                onSelectLocation={handleSelectLocation}
                canFocusMyTrace={Boolean(myDisplayTrace)}
                onFocusMyTrace={() => {
                  if (!myDisplayTrace) return;
                  setActiveTrace(myDisplayTrace);
                  setPulseUserId(myDisplayTrace.user_id);
                }}
                canRemoveMyTrace={Boolean(!loading && user && payload?.me.alreadyJoined)}
                removing={removing}
                onRemoveMyTrace={handleRemoveMyTrace}
                onLocateCurrent={fillFromCurrentLocation}
                locating={locating}
              />
            )}
            {participationOverlay && <div className="mt-4">{participationOverlay}</div>}
          </section>
        </div>

        {toastMessage && (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-[rgba(8,11,16,0.86)] px-4 py-2 text-[13px] font-bold text-white shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            {toastMessage}
          </div>
        )}
      </main>
    </div>
  );
}
