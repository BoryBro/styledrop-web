"use client";

import { useEffect, useMemo, useState } from "react";
import { MOCK_BOARD_DATA } from "@/lib/magazine";

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
  meEntry: {
    comment: string;
    instagramHandle: string | null;
  } | null;
  meInstagramHandle: string | null;
};

function formatHandle(handle: string | null) {
  if (!handle) return null;
  return `@${handle.replace(/^@+/, "")}`;
}

export function MagazineCommunityBoard({
  styleId,
  label,
  fact,
  question,
  accent,
}: {
  styleId: string;
  label: string;
  fact: string;
  question: string;
  accent: string;
}) {
  const [payload, setPayload] = useState<BoardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [shareInstagram, setShareInstagram] = useState(false);
  const [instagramHandle, setInstagramHandle] = useState("");

  const encodedStyleId = useMemo(() => encodeURIComponent(styleId), [styleId]);

  const loadBoard = async () => {
    // 하드코딩: MOCK_BOARD_DATA 직접 사용 (디자인 UI 확인용)
    const mockItems = MOCK_BOARD_DATA[styleId as keyof typeof MOCK_BOARD_DATA] || [];
    const payload: BoardPayload = {
      count: mockItems.length,
      items: mockItems.map((item) => ({
        ...item,
        likedByMe: false,
      })),
      meEligible: false,
      meEntry: null,
      meInstagramHandle: null,
    };

    setPayload(payload);
    setMessage(null);
  };

  useEffect(() => {
    void loadBoard();
  }, [encodedStyleId]);

  const handleSubmit = async () => {
    if (!comment.trim()) {
      setMessage("짧은 한 줄 코멘트를 적어주세요.");
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
      if (!response.ok) {
        throw new Error(data?.error || "submit failed");
      }

      await loadBoard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "참여 저장에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/magazine-board?styleId=${encodedStyleId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "remove failed");
      }
      await loadBoard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "참여 삭제에 실패했어요.");
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
        .map((entry) =>
          entry.userId === item.userId
            ? {
                ...entry,
                likedByMe: nextLiked,
                likeCount: Math.max(0, entry.likeCount + (nextLiked ? 1 : -1)),
              }
            : entry,
        )
        .sort((a, b) => {
          if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }),
    });

    try {
      await fetch("/api/showcase-likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: item.userId,
          liked: nextLiked,
        }),
      });
    } catch {
      await loadBoard();
    }
  };

  return (
    <section className="mt-0 flex flex-col gap-2">
      {/* 참여 주제 - 질문 */}
      <div className="flex flex-col gap-2 pt-2 pb-1">
        <p className="text-[11px] text-white/40 leading-relaxed">{fact}</p>
        <p
          className="text-[20px] sm:text-[22px] font-bold leading-[1.35] tracking-tight"
          style={{ color: accent }}
        >
          {question}
        </p>
      </div>

      {/* 헤더 + 참여 수 */}
      {!loading && payload?.items.length && (
        <div className="flex items-center justify-between py-1.5">
          <p className="text-[11px] text-white/30 uppercase font-normal">{label}</p>
          <p className="text-[11px] text-white/30 font-normal">{payload.count}명 참여 중</p>
        </div>
      )}

      {/* 입력 영역 */}
      {!loading && (
        <div className="bg-white/[0.04] rounded-[12px] p-4 mb-2">
          {/* 상단: 아바타 + textarea */}
          <div className="flex items-start gap-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-white/[0.08] shrink-0" />
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value.slice(0, 100))}
              placeholder="나의 역할을 남겨보세요..."
              maxLength={100}
              className="flex-1 min-h-[36px] resize-none bg-transparent border-none text-[13px] text-white placeholder:text-white/40 outline-none"
            />
          </div>

          {/* 하단: 토글 + 버튼 */}
          <div className="flex items-center justify-between">
            {/* 인스타 토글 */}
            <button
              type="button"
              onClick={() => setShareInstagram(!shareInstagram)}
              className="flex items-center gap-2 text-[11px] text-white/30"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="20" height="20" rx="5"/>
                <path d="M12 7v4M9 10h6"/>
              </svg>
              <span>인스타그램 공개</span>
              <div
                className="w-[28px] h-[16px] rounded-full ml-1 transition-colors"
                style={{ backgroundColor: shareInstagram ? accent : "rgba(255,255,255,0.15)" }}
              />
            </button>

            {/* 공유 버튼 */}
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || !comment.trim()}
              className="px-4 h-8 rounded-full text-[12px] font-semibold text-black transition-all hover:opacity-90 disabled:opacity-40 shrink-0"
              style={{ backgroundColor: accent }}
            >
              {submitting ? "저장중" : "공유"}
            </button>
          </div>

          {/* 인스타 아이디 입력 - hidden */}
          {shareInstagram && (
            <input
              type="hidden"
              value={instagramHandle}
              onChange={(event) => {
                const raw = event.target.value;
                const cleaned = raw.replace(/^@+/, "").replace(/\s+/g, "");
                setInstagramHandle(cleaned ? `@${cleaned}` : "@");
              }}
            />
          )}

          {message && (
            <p className="text-[12px] text-white/60 mt-2">{message}</p>
          )}
        </div>
      )}

      {/* 참여자 코멘트 - 하트순 정렬 */}
      {loading ? (
        <p className="text-[12px] text-white/40">로드 중...</p>
      ) : payload?.items.length ? (
        <div className="flex flex-col gap-0">
          {payload.items.slice(0, 4).map((item, index) => (
            <div
              key={`${item.userId}-${item.createdAt}`}
              className="flex items-start gap-4 py-4 border-b border-white/[0.06] last:border-b-0"
            >
              {/* 아바타 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.nickname}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />

              {/* 코멘트 + 하트 */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-white">{item.nickname}</p>
                      {item.instagramHandle && (
                        <p className="text-[11px] text-white/25 font-medium">{formatHandle(item.instagramHandle)}</p>
                      )}
                    </div>
                    <p className="text-[13px] text-white/60 mt-1.5 leading-[1.4]">{item.comment}</p>
                  </div>

                  {/* 하트 - SVG */}
                  <button
                    type="button"
                    onClick={() => void toggleLike(item)}
                    className="flex flex-col items-center justify-center gap-1 shrink-0"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={item.likedByMe ? accent : "none"} stroke={item.likedByMe ? accent : "rgba(255,255,255,0.25)"} strokeWidth="1.5">
                      <path d="M12 21C12 21 3 14 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 12 5C12.09 3.81 13.76 3 15.5 3C18.58 3 21 5.42 21 8.5C21 14 12 21 12 21Z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-[11px]" style={{ color: item.likedByMe ? accent : "rgba(255,255,255,0.25)" }}>
                      {item.likeCount}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-white/40">첫 참여자가 되어보세요.</p>
      )}

    </section>
  );
}
