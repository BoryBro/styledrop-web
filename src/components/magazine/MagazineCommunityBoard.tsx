"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type BoardItem = {
  userId: string;
  nickname: string;
  profileImage: string | null;
  imageUrl: string;
  comment: string;
  instagramHandle: string | null;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
};

type BoardPayload = {
  count: number;
  items: BoardItem[];
  meEligible: boolean;
  meEntry: { comment: string; instagramHandle: string | null } | null;
  meInstagramHandle: string | null;
};

function formatHandle(handle: string | null) {
  if (!handle) return null;
  return `@${handle.replace(/^@+/, "")}`;
}

function getInstagramUrl(handle: string | null) {
  if (!handle) return null;
  const normalized = handle.replace(/^@+/, "").replace(/[^A-Za-z0-9._]/g, "");
  return normalized ? `https://www.instagram.com/${normalized}` : null;
}

export function MagazineCommunityBoard({
  styleId,
  label,
  question,
  accent,
  placeholder = "나를 한 줄로 PR해보세요...",
  instagramPrompt = "인스타 공개하고 나를 알리기",
}: {
  styleId: string;
  label: string;
  question: string;
  accent: string;
  placeholder?: string;
  instagramPrompt?: string;
}) {
  const maxCommentLength = 60;
  const initialShowcaseLimit = 12;
  const [payload, setPayload] = useState<BoardPayload | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [shareInstagram, setShareInstagram] = useState(false);
  const [instagramHandle, setInstagramHandle] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(initialShowcaseLimit);

  const encodedStyleId = useMemo(() => encodeURIComponent(styleId), [styleId]);
  const visibleItems = payload?.items.slice(0, visibleLimit) ?? [];
  const hasMoreItems = Boolean(payload && payload.items.length > visibleLimit);

  const loadBoard = useCallback(async () => {
    try {
      const response = await fetch(`/api/magazine-board?styleId=${encodedStyleId}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "load failed");

      setPayload({
        count: typeof data?.count === "number" ? data.count : 0,
        items: Array.isArray(data?.items) ? data.items : [],
        meEligible: Boolean(data?.meEligible),
        meEntry: data?.meEntry ?? null,
        meInstagramHandle: data?.meInstagramHandle ?? null,
      });
      setMessage(null);
    } catch (error) {
      setPayload({
        count: 0,
        items: [],
        meEligible: false,
        meEntry: null,
        meInstagramHandle: null,
      });
      setMessage(error instanceof Error ? error.message : "참여 정보를 불러오지 못했어요.");
    }
  }, [encodedStyleId]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const handleSubmit = async () => {
    if (payload && !payload.meEligible) {
      setMessage("내 결과를 먼저 만들고 공개하면 쇼케이스에 올라갈 수 있어요.");
      return;
    }

    if (!comment.trim()) {
      setMessage("나를 소개할 한 줄을 남겨주세요.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/magazine-board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId,
          comment,
          instagramHandle: shareInstagram ? instagramHandle.trim().replace(/^@+/, "") : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "submit failed");
      setSubmitted(true);
      setComment("");
      await loadBoard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLike = async (item: BoardItem) => {
    if (!payload) return;
    const nextLiked = !item.likedByMe;
    setPayload({
      ...payload,
      items: payload.items
        .map((e) =>
          e.userId === item.userId
            ? { ...e, likedByMe: nextLiked, likeCount: Math.max(0, e.likeCount + (nextLiked ? 1 : -1)) }
            : e,
        )
        .sort((a, b) => b.likeCount !== a.likeCount
          ? b.likeCount - a.likeCount
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    });
    try {
      await fetch("/api/showcase-likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: item.userId, liked: nextLiked }),
      });
    } catch {
      await loadBoard();
    }
  };

  return (
    <section className="mx-4 flex flex-col gap-6 rounded-[22px] border border-gray-200 bg-white p-5 sm:mx-0 sm:p-6">

      {/* 참여 질문 */}
      <div>
        <h2 className="text-[28px] sm:text-[36px] font-black leading-[1.15] tracking-[-0.03em] text-gray-950">
          {question}
        </h2>
      </div>

      {/* 입력 영역 */}
      {!submitted ? (
        <div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, maxCommentLength))}
            placeholder={placeholder}
            maxLength={maxCommentLength}
            rows={3}
            className="w-full resize-none bg-transparent text-[18px] leading-[1.7] text-gray-900 outline-none placeholder:text-gray-400"
          />
          {payload && !payload.meEligible && (
            <p className="mt-2 text-[12px] font-medium text-gray-500">
              내 결과를 만들고 공개하면 얼굴 이미지와 인스타가 함께 노출됩니다.
            </p>
          )}
          <div className="mt-5 flex items-center justify-between border-t border-gray-200 pt-5">
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setShareInstagram(!shareInstagram)}
                className="flex items-center gap-2 text-[12px] text-gray-600 hover:text-gray-900 transition-colors"
              >
                <div
                  className="w-7 h-4 rounded-full transition-colors flex-shrink-0"
                  style={{ backgroundColor: shareInstagram ? accent : "#E5E7EB" }}
                />
                <span>{instagramPrompt}</span>
              </button>
              {shareInstagram && (
                <input
                  type="text"
                  value={instagramHandle}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/^@+/, "").replace(/\s+/g, "");
                    setInstagramHandle(raw ? `@${raw}` : "");
                  }}
                  placeholder="@username"
                  className="text-[13px] text-gray-700 border-b border-gray-200 outline-none py-1 bg-transparent w-40"
                />
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-500">{comment.length}/{maxCommentLength}</span>
              {payload && !payload.meEligible ? (
                <a
                  href={`/studio?style=${encodedStyleId}`}
                  className="flex h-9 items-center rounded-lg bg-black px-4 text-[13px] font-bold text-white transition-opacity hover:opacity-85"
                >
                  내 결과 만들기
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting || !comment.trim()}
                  className="h-9 px-4 rounded-lg text-[13px] font-bold text-white transition-all disabled:opacity-30"
                  style={{ backgroundColor: "#111" }}
                >
                  {submitting ? "저장 중..." : "참여하기"}
                </button>
              )}
            </div>
          </div>
          {message && <p className="text-[12px] text-red-500 mt-2">{message}</p>}
        </div>
      ) : (
        <div className="border border-gray-100 rounded-xl p-5 text-center bg-gray-50">
          <p className="text-[15px] font-bold text-gray-900 mb-1">이야기가 남겨졌어요 🎉</p>
          <p className="text-[13px] text-gray-500">다른 사람들의 이야기도 읽어보세요</p>
        </div>
      )}

      {/* 참여자 갤러리 */}
      {payload && visibleItems.length > 0 && (
        <div>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">{label}</p>
              <p className="mt-1 text-[12px] text-gray-500">하트를 많이 받은 공개 멤버가 먼저 보여요.</p>
            </div>
            <span className="shrink-0 rounded-full bg-gray-950 px-3 py-1 text-[11px] font-bold text-white">
              인기순
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {visibleItems.map((item, index) => {
              const instagramUrl = getInstagramUrl(item.instagramHandle);
              const handle = formatHandle(item.instagramHandle);

              return (
              <div
                key={`${item.userId}-${item.createdAt}`}
                className="flex flex-col gap-2"
              >
                {/* 이미지 카드 */}
                <div className="relative overflow-hidden rounded-[18px] bg-gray-100 shadow-[0_12px_30px_rgba(15,23,42,0.10)]" style={{ aspectRatio: "3/4" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.nickname}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div
                    className="absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[10px] font-black text-white shadow-[0_6px_18px_rgba(0,0,0,0.20)]"
                    style={{ backgroundColor: index === 0 ? accent : "rgba(17,24,39,0.78)" }}
                  >
                    TOP {index + 1}
                  </div>
                  {/* 하단 그라디언트 + 좋아요 */}
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/72 to-transparent" />
                  <button
                    type="button"
                    onClick={() => void toggleLike(item)}
                    className="absolute bottom-2.5 right-2.5 flex min-w-12 items-center justify-center gap-1 rounded-full bg-black/60 px-2.5 py-1.5 backdrop-blur-sm transition-transform active:scale-95"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24"
                      fill={item.likedByMe ? accent : "none"}
                      stroke={item.likedByMe ? accent : "rgba(255,255,255,0.8)"}
                      strokeWidth="1.8">
                      <path d="M12 21C12 21 3 14 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 12 5C12.09 3.81 13.76 3 15.5 3C18.58 3 21 5.42 21 8.5C21 14 12 21 12 21Z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-[11px] font-black" style={{ color: item.likedByMe ? accent : "rgba(255,255,255,0.92)" }}>
                      {item.likeCount}
                    </span>
                  </button>
                </div>

                {/* 닉네임 + 코멘트 */}
                <div className="px-0.5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[12px] font-semibold text-gray-900 truncate">{item.nickname}</span>
                    {instagramUrl && handle && (
                      <a
                        href={instagramUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-[10px] font-semibold text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline"
                      >
                        {handle}
                      </a>
                    )}
                  </div>
                  <p className="text-[12px] text-gray-600 leading-[1.5] line-clamp-2">{item.comment}</p>
                </div>
              </div>
              );
            })}
          </div>
          {hasMoreItems && (
            <button
              type="button"
              onClick={() => setVisibleLimit((current) => current + initialShowcaseLimit)}
              className="mt-5 h-12 w-full rounded-full bg-gray-950 text-[13px] font-black text-white transition-opacity hover:opacity-85"
            >
              더 보기
            </button>
          )}
        </div>
      )}


    </section>
  );
}
