"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  meEntry: { comment: string; instagramHandle: string | null } | null;
  meInstagramHandle: string | null;
};

function formatHandle(handle: string | null) {
  if (!handle) return null;
  return `@${handle.replace(/^@+/, "")}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "방금";
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
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
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [shareInstagram, setShareInstagram] = useState(false);
  const [instagramHandle, setInstagramHandle] = useState("");

  const encodedStyleId = useMemo(() => encodeURIComponent(styleId), [styleId]);

  const loadBoard = useCallback(async () => {
    const mockItems = MOCK_BOARD_DATA[styleId as keyof typeof MOCK_BOARD_DATA] || [];
    setPayload({
      count: mockItems.length,
      items: mockItems.map((item) => ({ ...item, likedByMe: false })),
      meEligible: false,
      meEntry: null,
      meInstagramHandle: null,
    });
    setMessage(null);
  }, [styleId]);

  useEffect(() => {
    void loadBoard();
  }, [encodedStyleId, loadBoard]);

  const handleSubmit = async () => {
    if (!comment.trim()) {
      setMessage("한 줄 이야기를 남겨주세요.");
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
    <section className="flex flex-col gap-8">

      {/* 참여 질문 */}
      <div>
        <p className="text-[12px] text-gray-600 leading-relaxed mb-4">{fact}</p>
        <h2 className="text-[28px] sm:text-[36px] font-black leading-[1.15] tracking-[-0.03em] text-gray-950">
          {question}
        </h2>
        {payload && (
          <p className="mt-3 text-[13px] text-gray-600">
            {payload.count > 0 ? `${payload.count}명이 이야기를 남겼어요` : "첫 번째로 이야기를 남겨보세요"}
          </p>
        )}
      </div>

      {/* 입력 영역 */}
      {!submitted ? (
        <div className="border border-gray-300 rounded-xl p-4">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 100))}
            placeholder="내 이야기를 남겨보세요..."
            maxLength={100}
            rows={3}
            className="w-full resize-none text-[15px] text-gray-900 placeholder:text-gray-500 outline-none leading-[1.7] bg-transparent"
          />
          <div className="flex items-center justify-between pt-3 border-t border-gray-200 mt-2">
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
                <span>인스타그램 아이디 함께 공개</span>
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
              <span className="text-[11px] text-gray-500">{comment.length}/100</span>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || !comment.trim()}
                className="h-9 px-4 rounded-lg text-[13px] font-bold text-white transition-all disabled:opacity-30"
                style={{ backgroundColor: "#111" }}
              >
                {submitting ? "저장 중..." : "참여하기"}
              </button>
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
      {payload && payload.items.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 mb-4">{label}</p>
          <div className="grid grid-cols-2 gap-3">
            {payload.items.slice(0, 6).map((item) => (
              <div
                key={`${item.userId}-${item.createdAt}`}
                className="flex flex-col gap-2"
              >
                {/* 이미지 카드 */}
                <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: "3/4" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.nickname}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  {/* 하단 그라디언트 + 좋아요 */}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
                  <button
                    type="button"
                    onClick={() => void toggleLike(item)}
                    className="absolute bottom-2.5 right-2.5 flex flex-col items-center gap-0.5"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24"
                      fill={item.likedByMe ? accent : "none"}
                      stroke={item.likedByMe ? accent : "rgba(255,255,255,0.8)"}
                      strokeWidth="1.8">
                      <path d="M12 21C12 21 3 14 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 12 5C12.09 3.81 13.76 3 15.5 3C18.58 3 21 5.42 21 8.5C21 14 12 21 12 21Z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-[10px] font-semibold" style={{ color: item.likedByMe ? accent : "rgba(255,255,255,0.8)" }}>
                      {item.likeCount}
                    </span>
                  </button>
                </div>

                {/* 닉네임 + 코멘트 */}
                <div className="px-0.5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[12px] font-semibold text-gray-900 truncate">{item.nickname}</span>
                    {item.instagramHandle && (
                      <span className="text-[10px] text-gray-500 truncate">{formatHandle(item.instagramHandle)}</span>
                    )}
                  </div>
                  <p className="text-[12px] text-gray-600 leading-[1.5] line-clamp-2">{item.comment}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


    </section>
  );
}
