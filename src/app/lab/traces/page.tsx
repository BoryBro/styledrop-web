"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { SIDO_OPTIONS } from "@/lib/lab-traces";

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
  x: number;
  y: number;
  count: number;
};

const KOREA_MAIN_PATH =
  "M47 8C59 6 70 9 78 16C84 23 87 32 86 43C89 54 85 65 79 73C81 82 78 89 72 94C64 98 54 98 47 92C38 92 30 88 24 80C19 73 18 64 22 56C18 47 18 39 23 30C25 22 31 15 39 11C42 10 45 9 47 8Z";
const KOREA_JEJU_PATH =
  "M23 105C26 102 31 101 36 102C39 104 39 108 36 110C32 112 26 112 22 110C20 108 20 106 23 105Z";

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

function buildClusters(traces: Trace[]): TraceCluster[] {
  const clusters = new Map<string, TraceCluster>();

  traces.forEach((trace) => {
    const current = clusters.get(trace.regionKey);
    if (current) {
      current.count += 1;
      current.x = Number(((current.x + trace.x) / 2).toFixed(2));
      current.y = Number(((current.y + trace.y) / 2).toFixed(2));
      return;
    }
    clusters.set(trace.regionKey, {
      key: trace.regionKey,
      label: trace.regionLabel,
      x: trace.x,
      y: trace.y,
      count: 1,
    });
  });

  return [...clusters.values()].sort((left, right) => right.count - left.count);
}

function TraceMap({
  traces,
  clusters,
  activeTrace,
  onPickTrace,
}: {
  traces: Trace[];
  clusters: TraceCluster[];
  activeTrace: Trace | null;
  onPickTrace: (trace: Trace) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ id: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const clampPan = useCallback((nextZoom: number, nextPan: { x: number; y: number }) => {
    const limitX = (nextZoom - 1) * 140;
    const limitY = (nextZoom - 1) * 175;
    return {
      x: clamp(nextPan.x, -limitX, limitX),
      y: clamp(nextPan.y, -limitY, limitY),
    };
  }, []);

  const updateZoom = useCallback((delta: number) => {
    setZoom((current) => {
      const next = clamp(Number((current + delta).toFixed(2)), 1, 2.6);
      setPan((prev) => clampPan(next, prev));
      return next;
    });
  }, [clampPan]);

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
          backgroundSize: "38px 38px",
        }}
      />

      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <button
          onClick={() => updateZoom(0.2)}
          className="h-10 w-10 rounded-2xl border border-white/10 bg-white/6 text-white text-xl shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
          aria-label="지도 확대"
        >
          +
        </button>
        <button
          onClick={() => updateZoom(-0.2)}
          className="h-10 w-10 rounded-2xl border border-white/10 bg-white/6 text-white text-xl shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
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
          viewBox="0 0 100 120"
          className="absolute inset-0 h-full w-full transition-transform duration-200"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <defs>
            <filter id="trace-blur">
              <feGaussianBlur stdDeviation="3.6" />
            </filter>
          </defs>

          <path d={KOREA_MAIN_PATH} fill="rgba(16,20,28,0.96)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.65" />
          <path d={KOREA_JEJU_PATH} fill="rgba(16,20,28,0.96)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.55" />

          {clusters.map((cluster) => {
            const glowSize = 5 + Math.min(cluster.count, 9) * 1.9;
            const opacity = Math.min(0.62, 0.16 + cluster.count * 0.08);

            return (
              <g key={`${cluster.key}-glow`}>
                <circle cx={cluster.x} cy={cluster.y} r={glowSize * 2.1} fill={`rgba(79, 151, 255, ${opacity * 0.28})`} filter="url(#trace-blur)" />
                <circle cx={cluster.x} cy={cluster.y} r={glowSize * 1.15} fill={`rgba(67, 231, 184, ${opacity * 0.36})`} filter="url(#trace-blur)" />
              </g>
            );
          })}

          {SIDO_OPTIONS.map((region) => (
            <g key={region.id} opacity="0.8">
              <circle cx={region.anchor.x} cy={region.anchor.y} r="0.75" fill="rgba(255,255,255,0.18)" />
              <text
                x={region.anchor.x + 1.8}
                y={region.anchor.y - 1.6}
                fill="rgba(255,255,255,0.34)"
                fontSize="3.2"
                fontWeight="700"
                letterSpacing="0.05em"
              >
                {region.shortLabel}
              </text>
            </g>
          ))}

          {traces.map((trace) => {
            const isActive = activeTrace?.user_id === trace.user_id;

            return (
              <g key={`${trace.user_id}-${trace.regionKey}`} onClick={() => onPickTrace(trace)} style={{ cursor: "pointer" }}>
                <circle cx={trace.x} cy={trace.y} r={isActive ? 2.6 : 1.65} fill={isActive ? "rgba(255,196,79,0.95)" : "rgba(255,255,255,0.88)"} />
                {isActive && <circle cx={trace.x} cy={trace.y} r={4.1} fill="none" stroke="rgba(255,196,79,0.45)" strokeWidth="0.75" />}
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

  const traces = payload?.traces ?? [];
  const clusters = useMemo(() => buildClusters(traces), [traces]);
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

      const nextTraces = data.alreadyJoined
        ? traces
        : [{ ...data.trace }, ...traces];
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
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[#6BE2C5]/80">People Leave Traces</p>
              <h2 className="mt-3 text-[34px] font-black leading-[0.96] tracking-[-0.05em] text-white sm:text-[48px]">
                StyleDrop에
                <br />
                사람들이 남긴 흔적
              </h2>
              <p className="mt-4 max-w-xl text-[15px] leading-7 text-white/62 sm:text-[16px]">
                한 번이라도 이미지를 만든 카카오 로그인 유저만 점 하나를 남길 수 있어요.
                이 지도는 방문 수가 아니라, <span className="font-bold text-white/86">누적 참여자 수</span>를 보여줍니다.
              </p>
            </div>

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
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {["얼굴 공개 없음", "계정당 1회", "점 1개 = 참여자 1명"].map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/6 px-3 py-2 text-[12px] font-bold text-white/70">
                {item}
              </span>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <section>
            {loadingState ? (
              <div className="flex aspect-[3/4] items-center justify-center rounded-[34px] border border-white/10 bg-white/5 text-white/55">
                흔적 지도를 불러오는 중...
              </div>
            ) : (
              <TraceMap traces={traces} clusters={clusters} activeTrace={activeTrace} onPickTrace={setActiveTrace} />
            )}
          </section>

          <aside className="flex flex-col gap-4">
            <div className="rounded-[30px] border border-white/10 bg-white/5 p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">참여하기</p>
              <h3 className="mt-2 text-[24px] font-black tracking-[-0.04em] text-white">내 흔적 남기기</h3>
              <p className="mt-3 text-[14px] leading-6 text-white/58">
                별도 동의 페이지는 없어요. 여기서 버튼을 누르면 지도에 점 하나가 남습니다.
              </p>

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
                {hotspotList.length === 0 && (
                  <p className="text-[14px] leading-6 text-white/50">아직 첫 참여자를 기다리는 중이에요.</p>
                )}
                {hotspotList.map((cluster, index) => (
                  <button
                    key={cluster.key}
                    onClick={() => {
                      const picked = traces.find((trace) => trace.regionKey === cluster.key) ?? null;
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
