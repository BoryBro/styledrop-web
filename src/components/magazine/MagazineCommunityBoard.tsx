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
    <section className="mt-5 flex flex-col gap-4">
      {/* 참여 주제 - 사실과 질문 */}
      <div className="flex flex-col gap-3 py-4 px-4 rounded-[16px] border border-white/[0.15] bg-gradient-to-br from-white/[0.08] to-white/[0.02]">
        <div className="flex items-start gap-2">
          <span className="text-[14px] mt-0.5 shrink-0">✨</span>
          <p className="text-[12px] font-medium text-white/65 leading-[1.3]">{fact}</p>
        </div>
        <p
          className="text-[15px] font-bold leading-[1.5]"
          style={{ color: accent }}
        >
          {question}
        </p>
      </div>

      {/* 헤더 + 참여 수 */}
      {!loading && payload?.items.length && (
        <div className="flex items-baseline justify-between pt-1">
          <p className="text-[11px] text-white/40 uppercase tracking-wide">{label}</p>
          <p className="text-[12px] font-semibold text-white">{payload.count}명 참여 중</p>
        </div>
      )}

      {/* 참여자 코멘트 - 하트순 정렬 */}
      {loading ? (
        <p className="text-[12px] text-white/40">로드 중...</p>
      ) : payload?.items.length ? (
        <div className="flex flex-col gap-3">
          {payload.items.slice(0, 4).map((item, index) => (
            <div
              key={`${item.userId}-${item.createdAt}`}
              className="group flex items-start gap-4 rounded-[16px] bg-white/[0.06] px-4 py-3.5 transition-colors hover:bg-white/[0.10] border border-white/[0.08]"
            >
              {/* 아바타 - 더 큼 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.nickname}
                className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-white/20"
              />

              {/* 코멘트 + 하트 */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-bold text-white">{item.nickname}</p>
                      {item.instagramHandle && (
                        <p className="text-[11px] text-white/50 font-medium">{formatHandle(item.instagramHandle)}</p>
                      )}
                    </div>
                    <p className="text-[14px] text-white/85 mt-1.5 leading-[1.4]">"{item.comment}"</p>
                  </div>

                  {/* 하트 - 더 눈에 띄게 */}
                  <button
                    type="button"
                    onClick={() => void toggleLike(item)}
                    className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-[12px] transition-all hover:scale-110 active:scale-95 shrink-0"
                    style={{
                      backgroundColor: item.likedByMe ? `${accent}30` : "white/[0.08]",
                    }}
                  >
                    <span className="text-[18px]">{item.likedByMe ? "❤️" : "♡"}</span>
                    <span className="text-[12px] font-bold" style={{ color: item.likedByMe ? accent : "white/70" }}>
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

      {/* 입력 - 참여하기 */}
      {!loading && payload?.meEligible && (
        <div className="flex flex-col gap-3 pt-2 border-t border-white/[0.08]">
          {/* 코멘트 입력 */}
          <div className="flex gap-2.5">
            <input
              value={comment}
              onChange={(event) => setComment(event.target.value.slice(0, 24))}
              placeholder="한 줄 코멘트"
              maxLength={24}
              className="flex-1 h-10 rounded-[10px] border border-white/[0.12] bg-white/[0.04] px-3.5 text-[13px] text-white placeholder:text-white/40 outline-none focus:border-white/30 focus:bg-white/[0.06] transition-colors"
            />
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || !comment.trim()}
              className="px-4 h-10 rounded-[10px] text-[12px] font-semibold text-black transition-all hover:opacity-90 disabled:opacity-40 shrink-0"
              style={{ backgroundColor: accent }}
            >
              {submitting ? "저장" : "공유"}
            </button>
          </div>

          {/* 인스타 공개 - 더 명확하게 */}
          <div className="flex items-center gap-3 px-1">
            <label className="flex items-center gap-2.5 text-[12px] text-white/70 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={shareInstagram}
                onChange={(event) => setShareInstagram(event.target.checked)}
                className="h-4 w-4 rounded border border-white/30 bg-transparent cursor-pointer accent-white"
              />
              <span className="font-medium">인스타그램 아이디 공개</span>
            </label>

            {shareInstagram && (
              <input
                value={instagramHandle}
                onChange={(event) => {
                  const raw = event.target.value;
                  const cleaned = raw.replace(/^@+/, "").replace(/\s+/g, "");
                  setInstagramHandle(cleaned ? `@${cleaned}` : "@");
                }}
                placeholder="@username"
                className="h-8 w-32 rounded-[8px] border border-white/[0.12] bg-white/[0.04] px-2.5 text-[12px] text-white placeholder:text-white/35 outline-none focus:border-white/30 focus:bg-white/[0.06] transition-colors shrink-0"
              />
            )}
          </div>

          {message && (
            <p className="text-[12px] text-white/60">{message}</p>
          )}
        </div>
      )}
    </section>
  );
}
