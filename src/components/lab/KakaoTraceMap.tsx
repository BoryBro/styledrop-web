"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

type GeoDisplayTrace = {
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
  displayX: number;
  displayY: number;
  lat: number;
  lng: number;
};

declare global {
  interface Window {
    kakao?: any;
  }
}

const MAP_APP_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
const DEFAULT_CENTER = { lat: 36.35, lng: 127.8 };

function sliderToLevel(value: number) {
  const bounded = Math.min(20, Math.max(1, value));
  return Math.max(1, Math.min(14, Math.round(14 - ((bounded - 1) / 19) * 13)));
}

function levelToSlider(level: number) {
  const bounded = Math.max(1, Math.min(14, level));
  return Number((1 + ((14 - bounded) / 13) * 19).toFixed(1));
}

function loadKakaoMapsSdk(appKey: string) {
  return new Promise<any>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("브라우저 환경이 아니에요."));
      return;
    }

    const finish = () => {
      if (!window.kakao?.maps?.load) {
        reject(new Error("카카오 지도 SDK를 불러오지 못했어요."));
        return;
      }

      window.kakao.maps.load(() => {
        if (!window.kakao?.maps?.services) {
          reject(new Error("카카오 지도 services 라이브러리를 불러오지 못했어요."));
          return;
        }
        resolve(window.kakao.maps);
      });
    };

    if (window.kakao?.maps?.services) {
      finish();
      return;
    }

    const existing = document.getElementById("kakao-maps-sdk") as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") {
        finish();
        return;
      }
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("카카오 지도 SDK 로드에 실패했어요.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = "kakao-maps-sdk";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      finish();
    };
    script.onerror = () => reject(new Error("카카오 지도 SDK 로드에 실패했어요."));
    document.head.appendChild(script);
  });
}

function buildNearbyPublicTraces(activeTrace: GeoDisplayTrace | null, traces: GeoDisplayTrace[]) {
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
}

export default function KakaoTraceMap({
  traces,
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
  onLocateCurrent,
  locating,
}: {
  traces: GeoDisplayTrace[];
  activeTrace: GeoDisplayTrace | null;
  previewTrace: GeoDisplayTrace | null;
  pulseUserId: string | null;
  onPickTrace: (trace: GeoDisplayTrace | null) => void;
  onSelectLocation: (region: { sido: string; sigungu: string; dong: string }) => void;
  canFocusMyTrace: boolean;
  onFocusMyTrace: () => void;
  canRemoveMyTrace: boolean;
  removing: boolean;
  onRemoveMyTrace: () => void;
  onLocateCurrent: () => void;
  locating: boolean;
}) {
  const mapRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const tracesRef = useRef(traces);
  const previewTraceRef = useRef(previewTrace);
  const updatePositionsRef = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoomValue, setZoomValue] = useState(1);
  const zoomValueRef = useRef(zoomValue);
  const [dotPositions, setDotPositions] = useState<Array<{ trace: GeoDisplayTrace; x: number; y: number }>>([]);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const nearbyPublicTraces = useMemo(() => buildNearbyPublicTraces(activeTrace, traces), [activeTrace, traces]);

  // 지역별 밀도 계산
  const regionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    traces.forEach((t) => counts.set(t.regionKey, (counts.get(t.regionKey) ?? 0) + 1));
    return counts;
  }, [traces]);

  // 축소 시 hotspot glow: 5개 이상 닷이 있는 지역의 클러스터 중심
  const hotspots = useMemo(() => {
    const map = new Map<string, { x: number; y: number; count: number; key: string }>();
    dotPositions.forEach(({ trace, x, y }) => {
      const count = regionCounts.get(trace.regionKey) ?? 1;
      if (count < 5) return;
      const existing = map.get(trace.regionKey);
      if (existing) {
        existing.x = (existing.x + x) / 2;
        existing.y = (existing.y + y) / 2;
      } else {
        map.set(trace.regionKey, { x, y, count, key: trace.regionKey });
      }
    });
    return [...map.values()];
  }, [dotPositions, regionCounts]);

  useEffect(() => {
    zoomValueRef.current = zoomValue;
  }, [zoomValue]);

  useEffect(() => {
    if (!MAP_APP_KEY) {
      setLoadError("카카오 지도 앱키가 없어요.");
      return;
    }

    let cancelled = false;

    loadKakaoMapsSdk(MAP_APP_KEY)
      .then(() => {
        if (cancelled) return;
        setReady(true);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "카카오 지도를 불러오지 못했어요.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const resolveRegionFromLatLng = useCallback(
    (lat: number, lng: number) =>
      new Promise<{ sido: string; sigungu: string; dong: string } | null>((resolve) => {
        const geocoder = geocoderRef.current;
        const kakao = window.kakao;
        if (!geocoder || !kakao?.maps?.services) {
          resolve(null);
          return;
        }

        geocoder.coord2RegionCode(lng, lat, (result: any[], status: string) => {
          if (status !== kakao.maps.services.Status.OK || !Array.isArray(result)) {
            resolve(null);
            return;
          }

          const admin = result.find((item) => item.region_type === "H") ?? result[0];
          if (!admin) {
            resolve(null);
            return;
          }

          resolve({
            sido: admin.region_1depth_name ?? "",
            sigungu: admin.region_2depth_name ?? "",
            dong: admin.region_3depth_name ?? "",
          });
        });
      }),
    [],
  );

  useEffect(() => {
    if (!ready || mapRef.current || !mapContainerRef.current) return;
    const kakao = window.kakao;
    if (!kakao?.maps?.Map) return;

    const map = new kakao.maps.Map(mapContainerRef.current, {
      center: new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
      level: sliderToLevel(1),
      draggable: true,
      scrollwheel: true,
      disableDoubleClick: false,
      disableDoubleClickZoom: false,
    });
    map.setZoomable(true);
    map.setMapTypeId(kakao.maps.MapTypeId.ROADMAP);

    geocoderRef.current = new kakao.maps.services.Geocoder();
    mapRef.current = map;
    setZoomValue(levelToSlider(map.getLevel()));

    kakao.maps.event.addListener(map, "zoom_changed", () => {
      setZoomValue(levelToSlider(map.getLevel()));
    });

    const updatePositions = () => {
      const projection = map.getProjection();
      if (!projection) return;
      const dots = tracesRef.current.map((trace) => {
        const pt = projection.containerPointFromCoords(new kakao.maps.LatLng(trace.lat, trace.lng));
        return { trace, x: pt.x, y: pt.y };
      });
      setDotPositions(dots);
      const prev = previewTraceRef.current;
      if (prev) {
        const pt = projection.containerPointFromCoords(new kakao.maps.LatLng(prev.lat, prev.lng));
        setPreviewPos({ x: pt.x, y: pt.y });
      } else {
        setPreviewPos(null);
      }
    };
    updatePositionsRef.current = updatePositions;
    kakao.maps.event.addListener(map, "center_changed", () => updatePositionsRef.current());
    kakao.maps.event.addListener(map, "zoom_changed", () => updatePositionsRef.current());

    kakao.maps.event.addListener(map, "click", async (mouseEvent: any) => {
      if (activeTrace) {
        onPickTrace(null);
        return;
      }

      const latLng = mouseEvent.latLng;
      if (!latLng) return;
      const region = await resolveRegionFromLatLng(latLng.getLat(), latLng.getLng());
      if (!region) return;
      onSelectLocation(region);
    });
  }, [activeTrace, onPickTrace, onSelectLocation, ready, resolveRegionFromLatLng]);

  useEffect(() => {
    tracesRef.current = traces;
    updatePositionsRef.current();
  }, [traces]);

  useEffect(() => {
    previewTraceRef.current = previewTrace;
    updatePositionsRef.current();
  }, [previewTrace]);

  useEffect(() => {
    const map = mapRef.current;
    const kakao = window.kakao;
    if (!map || !kakao?.maps?.LatLng) return;

    const target = previewTrace ?? activeTrace;
    if (!target) return;

    const targetZoom = previewTrace ? Math.max(zoomValueRef.current, 15) : Math.max(zoomValueRef.current, 12);
    map.setLevel(sliderToLevel(targetZoom));
    map.panTo(new kakao.maps.LatLng(target.lat, target.lng));
  }, [activeTrace?.user_id, previewTrace?.regionKey, ready]);

  return (
    <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[#05070B] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
      <div ref={mapContainerRef} className="relative z-0 aspect-square w-full" style={{ filter: "saturate(0.18) brightness(0.72) contrast(0.88)" }} />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(2,4,7,0.28)_0%,rgba(3,5,8,0.18)_48%,rgba(2,4,7,0.32)_100%)]" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_18%_16%,rgba(86,145,255,0.07),transparent_24%),radial-gradient(circle_at_82%_84%,rgba(77,227,197,0.05),transparent_26%)] opacity-80" />

      {/* 축소 시 밀도 hotspot glow */}
      <div className="pointer-events-none absolute inset-0 z-[19] overflow-hidden">
        {zoomValue < 12 && hotspots.map((spot) => {
          const size = Math.min(48 + spot.count * 14, 220);
          const inner = Math.min(0.18 + spot.count * 0.03, 0.55);
          const outer = Math.min(0.06 + spot.count * 0.012, 0.22);
          const dur = Math.max(1.2, 2.2 - spot.count * 0.08);
          return (
            <div
              key={spot.key}
              style={{
                position: "absolute",
                left: spot.x,
                top: spot.y,
                width: size,
                height: size,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                background: `radial-gradient(circle, rgba(0,255,200,${inner}) 0%, rgba(0,255,200,${outer}) 45%, transparent 72%)`,
                animation: `hotspotPulse ${dur}s ease-in-out infinite`,
              }}
            />
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        <style>{`
          @keyframes traceDotPulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            50% { transform: translate(-50%, -50%) scale(1.9); opacity: 0.4; }
          }
          /* tier 0: 1~4개 — 작은 원점 */
          @keyframes dotGlow {
            0%, 100% { box-shadow: 0 0 3px 1px rgba(0,255,200,0.7), 0 0 8px 2px rgba(0,255,200,0.28); }
            50%       { box-shadow: 0 0 6px 2px rgba(0,255,200,0.95), 0 0 14px 4px rgba(0,255,200,0.45); }
          }
          /* tier 1: 5~14개 — 원점 + 얇은 링 */
          @keyframes dotGlowMed {
            0%, 100% { box-shadow: 0 0 5px 2px rgba(0,255,200,1), 0 0 14px 4px rgba(0,255,200,0.5); }
            50%       { box-shadow: 0 0 9px 3px rgba(0,255,200,1), 0 0 26px 7px rgba(0,255,200,0.75); }
          }
          /* tier 2: 15~29개 — 원점 + 굵은 링 */
          @keyframes dotGlowHigh {
            0%, 100% { box-shadow: 0 0 7px 3px rgba(0,255,200,1), 0 0 20px 6px rgba(0,255,200,0.6); }
            50%       { box-shadow: 0 0 14px 5px rgba(0,255,200,1), 0 0 40px 12px rgba(0,255,200,0.88); }
          }
          /* tier 3: 30개 이상 — 다이아몬드 */
          @keyframes dotGlowMax {
            0%, 100% { box-shadow: 0 0 9px 4px rgba(0,255,200,1), 0 0 24px 8px rgba(0,255,200,0.7), 0 0 50px 14px rgba(0,255,200,0.3); }
            50%       { box-shadow: 0 0 16px 6px rgba(0,255,200,1), 0 0 50px 16px rgba(0,255,200,0.95), 0 0 80px 26px rgba(0,255,200,0.5); }
          }
          @keyframes dotGlowActive {
            0%, 100% { box-shadow: 0 0 5px 1px rgba(255,230,0,0.9), 0 0 14px 2px rgba(255,230,0,0.45); }
            50%       { box-shadow: 0 0 9px 3px rgba(255,230,0,1),   0 0 24px 6px rgba(255,230,0,0.7); }
          }
          @keyframes hotspotPulse {
            0%, 100% { opacity: 0.75; transform: translate(-50%, -50%) scale(1); }
            50%       { opacity: 1;    transform: translate(-50%, -50%) scale(1.12); }
          }
        `}</style>
        {dotPositions.map(({ trace, x, y }) => {
          const isActive = activeTrace?.user_id === trace.user_id;
          const isPulse = pulseUserId === trace.user_id;
          const count = regionCounts.get(trace.regionKey) ?? 1;
          // 새 티어 기준: 1~4 / 5~14 / 15~29 / 30+
          const tier = count >= 30 ? 3 : count >= 15 ? 2 : count >= 5 ? 1 : 0;
          const color = isActive ? "#FFE600" : "#00FFC8";
          const glowRGB = isActive ? "255,230,0" : "0,255,200";
          const glowAnim = isPulse
            ? "traceDotPulse 1.1s ease-out 1"
            : isActive
              ? "dotGlowActive 1.4s ease-in-out infinite"
              : tier === 3
                ? "dotGlowMax 0.9s ease-in-out infinite"
                : tier === 2
                  ? "dotGlowHigh 1.2s ease-in-out infinite"
                  : tier === 1
                    ? "dotGlowMed 1.7s ease-in-out infinite"
                    : "dotGlow 2.5s ease-in-out infinite";

          // 티어별 닷 모양
          let dotContent: ReactNode;
          if (tier === 3) {
            // 다이아몬드 (30개+)
            dotContent = (
              <span style={{
                display: "block",
                width: isActive ? 12 : 10,
                height: isActive ? 12 : 10,
                background: color,
                transform: "rotate(45deg)",
                outline: "1px solid rgba(0,0,0,0.55)",
                outlineOffset: "0px",
                animation: glowAnim,
              }} />
            );
          } else if (tier === 2) {
            // 굵은 링 + 원점 (15~29개)
            dotContent = (
              <span style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: `2px solid rgba(${glowRGB},0.65)`,
                flexShrink: 0,
              }}>
                <span style={{
                  display: "block",
                  width: isActive ? 9 : 7,
                  height: isActive ? 9 : 7,
                  background: color,
                  borderRadius: "50%",
                  outline: "1px solid rgba(0,0,0,0.45)",
                  outlineOffset: "0px",
                  animation: glowAnim,
                }} />
              </span>
            );
          } else if (tier === 1) {
            // 얇은 링 + 원점 (5~14개)
            dotContent = (
              <span style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: `1px solid rgba(${glowRGB},0.35)`,
                flexShrink: 0,
              }}>
                <span style={{
                  display: "block",
                  width: isActive ? 8 : 6,
                  height: isActive ? 8 : 6,
                  background: color,
                  borderRadius: "50%",
                  outline: "1px solid rgba(0,0,0,0.45)",
                  outlineOffset: "0px",
                  animation: glowAnim,
                }} />
              </span>
            );
          } else {
            // 작은 원점 (1~4개)
            dotContent = (
              <span style={{
                display: "block",
                width: isActive ? 8 : 5,
                height: isActive ? 8 : 5,
                background: color,
                borderRadius: "50%",
                outline: "1px solid rgba(0,0,0,0.45)",
                outlineOffset: "0px",
                animation: glowAnim,
              }} />
            );
          }

          return (
            <button
              key={trace.user_id}
              type="button"
              aria-label="흔적 보기"
              className="pointer-events-auto absolute"
              style={{
                left: x,
                top: y,
                width: 28,
                height: 28,
                transform: "translate(-50%, -50%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: 0,
                padding: 0,
                cursor: "pointer",
              }}
              onClick={() => onPickTrace(isActive ? null : trace)}
            >
              {dotContent}
            </button>
          );
        })}
        {previewPos && (
          <span
            style={{
              position: "absolute",
              left: previewPos.x,
              top: previewPos.y,
              width: 8,
              height: 8,
              background: "#FFE600",
              borderRadius: "50%",
              outline: "1px solid rgba(0,0,0,0.5)",
              outlineOffset: "0px",
              animation: "dotGlowActive 1.4s ease-in-out infinite",
            }}
          />
        )}
      </div>

      <div className="absolute right-4 top-4 z-30 flex items-center gap-2">
        {canFocusMyTrace && (
          <button
            onClick={onFocusMyTrace}
            className="rounded-2xl border border-white/10 bg-[rgba(8,11,16,0.72)] px-3 py-2 text-[12px] font-bold text-white/80 backdrop-blur"
          >
            내 흔적
          </button>
        )}
        {canRemoveMyTrace && (
          <button
            onClick={onRemoveMyTrace}
            disabled={removing}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-[rgba(8,11,16,0.72)] text-white/80 backdrop-blur disabled:opacity-60"
            aria-label="내 흔적 삭제"
            title="내 흔적 삭제"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3.6 4.3h8.8M6.2 2.7h3.6M5.1 4.3l.5 7.1a1 1 0 0 0 1 .9h2.8a1 1 0 0 0 1-.9l.5-7.1M6.7 6.4v4.1M9.3 6.4v4.1" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[rgba(8,11,16,0.72)] px-3 py-2 backdrop-blur">
          <span className="text-[11px] font-bold text-white/38">1x</span>
          <input
            type="range"
            min="1"
            max="20"
            step="0.1"
            value={zoomValue}
            onChange={(event) => {
              const map = mapRef.current;
              if (!map) return;
              const nextValue = Number(event.target.value);
              setZoomValue(nextValue);
              map.setLevel(sliderToLevel(nextValue));
            }}
            className="h-2 w-24 accent-white"
            aria-label="지도 확대 슬라이더"
          />
          <span className="text-[11px] font-bold text-white/72">{zoomValue.toFixed(1)}x</span>
        </div>
        <button
          onClick={() => {
            const map = mapRef.current;
            if (!map || !window.kakao?.maps?.LatLng) return;
            map.setLevel(sliderToLevel(1));
            map.panTo(new window.kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng));
          }}
          className="rounded-2xl border border-white/10 bg-[rgba(8,11,16,0.72)] px-3 py-2 text-[12px] font-bold text-white/80 backdrop-blur"
        >
          원위치
        </button>
      </div>

      <div className="absolute left-4 top-4 z-30">
        <button
          onClick={onLocateCurrent}
          disabled={locating}
          className="rounded-2xl border border-white/10 bg-[rgba(8,11,16,0.72)] px-3 py-2 text-[12px] font-bold text-white/80 backdrop-blur disabled:opacity-60"
        >
          {locating ? "위치 찾는 중..." : "현재 위치"}
        </button>
      </div>

      {nearbyPublicTraces.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center px-3">
          <div className="pointer-events-auto flex max-w-[calc(100%-24px)] gap-2 overflow-x-auto rounded-[18px] border border-white/10 bg-[rgba(8,11,16,0.84)] px-2.5 py-2 shadow-[0_18px_40px_rgba(0,0,0,0.34)] backdrop-blur-xl">
            {nearbyPublicTraces.map((trace) => {
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

      {loadError && (
        <div className="absolute inset-x-4 bottom-4 z-40 rounded-2xl border border-[#FF7A6A]/20 bg-[#FF7A6A]/10 px-3 py-2 text-[12px] font-semibold text-[#FFB2A8] backdrop-blur">
          {loadError}
        </div>
      )}
    </div>
  );
}
