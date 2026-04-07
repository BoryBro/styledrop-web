"use client";

import { geoMercator, geoPath } from "d3-geo";
import Link from "next/link";
import { feature } from "topojson-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import koreaEmdTopology from "@tenqube/react-korea-bubble-map/dist/esm/emd-64475e77.js";
import koreaSidoTopology from "@tenqube/react-korea-bubble-map/dist/esm/sido-0af932a3.js";
import koreaSigunguTopology from "@tenqube/react-korea-bubble-map/dist/esm/sigungu-3878911c.js";
import { useAuth } from "@/hooks/useAuth";
import {
  buildTraceJitter,
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
  created_at: string | null;
};

type DisplayTrace = Trace & {
  displayX: number;
  displayY: number;
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
  const fallbackLabels = new Set(["서울특별시", "경기도", "강원특별자치도", "충청북도", "경상북도", "전북특별자치도", "전라남도", "경상남도", "제주특별자치도", "부산광역시"]);

  return provinceMap
    .filter((region) => activeSidos.has(region.label) || fallbackLabels.has(region.label))
    .map((region) => ({
      id: region.code,
      x: region.centroid.x,
      y: region.centroid.y,
      shortLabel: region.shortLabel,
    }));
}

function TraceMap({
  traces,
  clusters,
  activeTrace,
  onPickTrace,
}: {
  traces: DisplayTrace[];
  clusters: TraceCluster[];
  activeTrace: DisplayTrace | null;
  onPickTrace: (trace: DisplayTrace) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ id: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const regionLabels = useMemo(() => buildVisibleRegionLabels(clusters), [clusters]);
  const detailLevel = zoom >= 4 ? "emd" : zoom >= 1.9 ? "sigungu" : "sido";

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

  const dongCounts = useMemo(() => {
    const counts = new Map<string, number>();

    traces.forEach((trace) => {
      counts.set(trace.regionKey, (counts.get(trace.regionKey) ?? 0) + 1);
    });

    return counts;
  }, [traces]);

  const clampPan = useCallback((nextZoom: number, nextPan: { x: number; y: number }) => {
    const limitX = (nextZoom - 1) * 120;
    const limitY = (nextZoom - 1) * 160;
    return {
      x: clamp(nextPan.x, -limitX, limitX),
      y: clamp(nextPan.y, -limitY, limitY),
    };
  }, []);

  const updateZoom = useCallback(
    (delta: number) => {
      setZoom((current) => {
        const next = clamp(Number((current + delta).toFixed(2)), 1, 6);
        setPan((prev) => clampPan(next, prev));
        return next;
      });
    },
    [clampPan],
  );

  return (
    <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[#05070B] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 22% 18%, rgba(73,140,255,0.18) 0%, transparent 28%), radial-gradient(circle at 78% 80%, rgba(84,255,196,0.12) 0%, transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        }}
      />

      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <button
          onClick={() => updateZoom(0.22)}
          className="h-10 w-10 rounded-2xl border border-white/10 bg-white/6 text-xl text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
          aria-label="지도 확대"
        >
          +
        </button>
        <button
          onClick={() => updateZoom(-0.22)}
          className="h-10 w-10 rounded-2xl border border-white/10 bg-white/6 text-xl text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
          aria-label="지도 축소"
        >
          -
        </button>
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
        className="relative aspect-[3/4] w-full touch-none cursor-grab active:cursor-grabbing"
        onWheel={(event) => {
          event.preventDefault();
          updateZoom(event.deltaY < 0 ? 0.16 : -0.16);
        }}
        onPointerDown={(event) => {
          dragRef.current = {
            id: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            baseX: pan.x,
            baseY: pan.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.id !== event.pointerId) return;
          setPan(
            clampPan(zoom, {
              x: drag.baseX + (event.clientX - drag.startX),
              y: drag.baseY + (event.clientY - drag.startY),
            }),
          );
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.id === event.pointerId) {
            dragRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      >
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="absolute inset-0 h-full w-full transition-transform duration-200"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <defs>
            <filter id="trace-blur">
              <feGaussianBlur stdDeviation="2.2" />
            </filter>
          </defs>

          {detailLevel === "sido" &&
            provinceMap.map((region) => {
              const count = provinceCounts.get(region.label) ?? 0;
              const activeAlpha = count === 0 ? 0 : Math.min(0.18 + count * 0.04, 0.42);

              return (
                <g key={region.code}>
                <path d={region.path} fill="rgba(12,17,24,0.98)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.42" />
                {count > 0 && (
                  <path
                    d={region.path}
                    fill={`rgba(91, 224, 197, ${activeAlpha})`}
                    stroke={`rgba(126, 245, 220, ${Math.min(activeAlpha + 0.1, 0.5)})`}
                    strokeWidth="0.32"
                  />
                )}
              </g>
              );
            })}

          {detailLevel === "sigungu" &&
            districtMap.map((region) => {
              const province = provinceMap.find((item) => item.code.slice(0, 2) === region.code.slice(0, 2));
              const count = districtCounts.get(`${province?.label ?? ""}|${region.normalizedLabel}`) ?? 0;
              const activeAlpha = count === 0 ? 0 : Math.min(0.14 + count * 0.05, 0.38);

              return (
                <g key={region.code}>
                  <path d={region.path} fill="rgba(11,15,21,0.98)" stroke="rgba(255,255,255,0.10)" strokeWidth="0.18" />
                  {count > 0 && (
                    <path
                      d={region.path}
                      fill={`rgba(91, 224, 197, ${activeAlpha})`}
                      stroke={`rgba(126, 245, 220, ${Math.min(activeAlpha + 0.08, 0.44)})`}
                      strokeWidth="0.14"
                    />
                  )}
                </g>
              );
            })}

          {detailLevel === "emd" &&
            dongMap.map((region) => {
              const count = [...dongCounts.entries()].find(([key]) => {
                const parts = key.split("|");
                return parts.at(-1) === region.normalizedLabel && parts[0].slice(0, 2) === region.code.slice(0, 2);
              })?.[1] ?? 0;
              const activeAlpha = count === 0 ? 0 : Math.min(0.12 + count * 0.06, 0.34);

              return (
                <g key={region.code}>
                  <path d={region.path} fill="rgba(10,13,18,0.98)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.06" />
                  {count > 0 && (
                    <path
                      d={region.path}
                      fill={`rgba(91, 224, 197, ${activeAlpha})`}
                      stroke={`rgba(126, 245, 220, ${Math.min(activeAlpha + 0.06, 0.38)})`}
                      strokeWidth="0.05"
                    />
                  )}
                </g>
              );
            })}

          {clusters.map((cluster) => {
            const glowSize = 1.8 + Math.min(cluster.count, 9) * 0.9;
            const opacity = Math.min(0.45, 0.14 + cluster.count * 0.05);

            return (
              <g key={`${cluster.key}-glow`}>
                <circle cx={cluster.x} cy={cluster.y} r={glowSize * 2.2} fill={`rgba(79, 151, 255, ${opacity * 0.18})`} filter="url(#trace-blur)" />
                <circle cx={cluster.x} cy={cluster.y} r={glowSize * 1.18} fill={`rgba(67, 231, 184, ${opacity * 0.24})`} filter="url(#trace-blur)" />
              </g>
            );
          })}

          {detailLevel === "sido" &&
            regionLabels.map((region) => (
              <g key={region.id} opacity="0.82">
                <circle cx={region.x} cy={region.y} r="0.42" fill="rgba(255,255,255,0.18)" />
                <text
                  x={region.x + 1}
                  y={region.y - 1}
                  fill="rgba(255,255,255,0.28)"
                  fontSize="2.6"
                  fontWeight="700"
                  letterSpacing="0.04em"
                >
                  {region.shortLabel}
                </text>
              </g>
            ))}

          {traces.map((trace) => {
            const isActive = activeTrace?.user_id === trace.user_id;

            return (
              <g key={`${trace.user_id}-${trace.regionKey}`} onClick={() => onPickTrace(trace)} style={{ cursor: "pointer" }}>
                <circle
                  cx={trace.displayX}
                  cy={trace.displayY}
                  r={isActive ? 1.25 : 0.44}
                  fill={isActive ? "rgba(255,196,79,0.98)" : "rgba(255,255,255,0.92)"}
                />
                {isActive && (
                  <circle
                    cx={trace.displayX}
                    cy={trace.displayY}
                    r={2.2}
                    fill="none"
                    stroke="rgba(255,196,79,0.44)"
                    strokeWidth="0.34"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-20 rounded-[24px] border border-white/10 bg-black/36 px-4 py-3 backdrop-blur-xl">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Trace Focus</p>
        <p className="mt-1 text-[18px] font-bold text-white">{activeTrace?.regionLabel ?? "사람들이 남긴 흔적을 눌러보세요"}</p>
        <p className="mt-1 text-[13px] leading-6 text-white/55">
          {activeTrace ? `${formatRelativeDate(activeTrace.created_at)} 실험실에 점 하나를 남겼어요.` : "작은 점 하나는 한 사람의 참여를 뜻해요."}
        </p>
      </div>
    </div>
  );
}

export default function TraceLabPage() {
  const { user, loading, login } = useAuth();
  const [payload, setPayload] = useState<TracePayload | null>(null);
  const [loadingState, setLoadingState] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTrace, setActiveTrace] = useState<Trace | null>(null);
  const [form, setForm] = useState({
    sido: "서울특별시",
    sigungu: "",
    dong: "",
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

  const displayTraces = useMemo(() => (payload?.traces ?? []).map(buildDisplayTrace), [payload?.traces]);
  const activeDisplayTrace = useMemo(
    () => displayTraces.find((trace) => trace.user_id === activeTrace?.user_id) ?? displayTraces[0] ?? null,
    [activeTrace?.user_id, displayTraces],
  );
  const clusters = useMemo(() => buildClusters(displayTraces), [displayTraces]);
  const hotspotList = useMemo(() => [...clusters].sort((left, right) => right.count - left.count).slice(0, 5), [clusters]);

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/lab/traces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
        },
      };

      setPayload(nextPayload);
      setActiveTrace(data.trace);
      setForm((current) => ({ ...current, sigungu: "", dong: "" }));
    } catch {
      setError("흔적을 남기지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06070A] text-white">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#06070A]/88 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#6BE2C5]">StyleDrop Lab</p>
            <h1 className="mt-1 text-[22px] font-black tracking-[-0.04em] text-white">실험실 흔적 지도</h1>
          </div>
          <Link href="/studio" className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-[13px] font-bold text-white/80">
            실험실로 돌아가기
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <section className="mb-6 rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,#0A0D12_0%,#101720_100%)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)] sm:p-8">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/38">참여자</p>
              <p className="mt-2 text-[28px] font-black tracking-[-0.04em] text-white">{payload?.summary.totalParticipants ?? 0}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/38">지역</p>
              <p className="mt-2 text-[28px] font-black tracking-[-0.04em] text-white">{payload?.summary.totalRegions ?? 0}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/38">가장 밝은 흔적</p>
              <p className="mt-2 text-[18px] font-black leading-6 tracking-[-0.04em] text-white">
                {payload?.summary.hottestRegion?.label ?? "아직 첫 흔적을 기다리는 중"}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <section>
            {loadingState ? (
              <div className="flex aspect-[3/4] items-center justify-center rounded-[34px] border border-white/10 bg-white/5 text-white/55">
                흔적 지도를 불러오는 중...
              </div>
            ) : (
              <TraceMap traces={displayTraces} clusters={clusters} activeTrace={activeDisplayTrace} onPickTrace={setActiveTrace} />
            )}
          </section>

          <aside className="flex flex-col gap-4">
            <div className="rounded-[30px] border border-white/10 bg-white/5 p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">참여하기</p>
              <h3 className="mt-2 text-[24px] font-black tracking-[-0.04em] text-white">내 흔적 남기기</h3>
              <p className="mt-3 text-[14px] leading-6 text-white/58">별도 동의 페이지는 없어요. 여기서 버튼을 누르면 지도에 점 하나가 남습니다.</p>

              {error && (
                <div className="mt-4 rounded-[20px] border border-[#FF7A6A]/20 bg-[#FF7A6A]/10 px-4 py-3 text-[13px] font-semibold text-[#FFB2A8]">
                  {error}
                </div>
              )}

              {!loading && !user && (
                <div className="mt-5 rounded-[24px] border border-[#FEE500]/15 bg-[#FEE500]/8 p-4">
                  <p className="text-[14px] font-bold text-white">카카오 로그인 후 참여할 수 있어요.</p>
                  <button
                    onClick={login}
                    className="mt-4 w-full rounded-[18px] bg-[#FEE500] px-4 py-3 text-[14px] font-black text-[#231815]"
                  >
                    카카오 로그인
                  </button>
                </div>
              )}

              {!loading && user && payload && !payload.me.eligible && (
                <div className="mt-5 rounded-[24px] border border-white/10 bg-black/28 p-4">
                  <p className="text-[14px] font-bold text-white">이미지를 한 번 만든 계정만 참여할 수 있어요.</p>
                  <p className="mt-2 text-[13px] leading-6 text-white/55">일반 카드나 오디션 결과를 한 번이라도 만들면 여기 흔적을 남길 수 있습니다.</p>
                  <Link
                    href="/studio"
                    className="mt-4 inline-flex rounded-[16px] border border-white/10 bg-white/8 px-4 py-2.5 text-[13px] font-bold text-white/82"
                  >
                    생성하러 가기
                  </Link>
                </div>
              )}

              {!loading && user && payload?.me.alreadyJoined && payload.me.trace && (
                <div className="mt-5 rounded-[24px] border border-[#6BE2C5]/20 bg-[#6BE2C5]/8 p-4">
                  <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#89F2D8]">Joined</p>
                  <p className="mt-2 text-[18px] font-black tracking-[-0.04em] text-white">이미 흔적을 남겼어요</p>
                  <p className="mt-2 text-[14px] leading-6 text-white/68">{payload.me.trace.regionLabel}</p>
                  <p className="mt-1 text-[12px] text-white/40">{formatRelativeDate(payload.me.trace.created_at)}</p>
                </div>
              )}

              {!loading && user && payload && payload.me.eligible && !payload.me.alreadyJoined && (
                <div className="mt-5 space-y-3">
                  <div>
                    <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.16em] text-white/42">시 / 도</label>
                    <select
                      value={form.sido}
                      onChange={(event) => setForm((current) => ({ ...current, sido: event.target.value }))}
                      className="h-12 w-full rounded-[18px] border border-white/10 bg-[#0D1117] px-4 text-[14px] font-semibold text-white outline-none"
                    >
                      {SIDO_OPTIONS.map((option) => (
                        <option key={option.id} value={option.label}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.16em] text-white/42">시 / 구 / 군</label>
                    <input
                      value={form.sigungu}
                      onChange={(event) => setForm((current) => ({ ...current, sigungu: event.target.value }))}
                      placeholder="예: 마포구 / 전주시 덕진구 / 제주시"
                      className="h-12 w-full rounded-[18px] border border-white/10 bg-[#0D1117] px-4 text-[14px] font-semibold text-white placeholder:text-white/26 outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.16em] text-white/42">동 / 읍 / 면</label>
                    <input
                      value={form.dong}
                      onChange={(event) => setForm((current) => ({ ...current, dong: event.target.value }))}
                      placeholder="예: 연남동 / 금암동 / 애월읍"
                      className="h-12 w-full rounded-[18px] border border-white/10 bg-[#0D1117] px-4 text-[14px] font-semibold text-white placeholder:text-white/26 outline-none"
                    />
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="mt-2 w-full rounded-[20px] bg-[#6BE2C5] px-4 py-3.5 text-[15px] font-black text-[#05110E] disabled:opacity-70"
                  >
                    {saving ? "점을 남기는 중..." : "내 흔적 남기기"}
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-[30px] border border-white/10 bg-white/5 p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Hotspots</p>
              <h3 className="mt-2 text-[20px] font-black tracking-[-0.04em] text-white">가장 밝은 흔적</h3>
              <div className="mt-4 space-y-2">
                {hotspotList.length === 0 && <p className="text-[14px] leading-6 text-white/50">아직 첫 참여자를 기다리는 중이에요.</p>}
                {hotspotList.map((cluster, index) => (
                  <button
                    key={cluster.key}
                    onClick={() => {
                      const picked = displayTraces.find((trace) => trace.regionKey === cluster.key) ?? null;
                      if (picked) setActiveTrace(picked);
                    }}
                    className="flex w-full items-center justify-between rounded-[18px] border border-white/8 bg-black/18 px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-[12px] font-black text-white/70">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-[14px] font-bold text-white">{cluster.label}</p>
                        <p className="text-[12px] text-white/42">빛나는 흔적이 많은 지역</p>
                      </div>
                    </div>
                    <span className="text-[13px] font-black text-[#6BE2C5]">{cluster.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
