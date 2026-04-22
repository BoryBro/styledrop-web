"use client";

import { useState, useEffect, useCallback } from "react";

type PostStatus = "draft" | "approved" | "published" | "failed";

type ThreadsPost = {
  id: string;
  content: string;
  image_url: string | null;
  scheduled_at: string;
  status: PostStatus;
  thread_id: string | null;
  error_message: string | null;
  published_at: string | null;
  created_at: string;
};

const STATUS_STYLE: Record<PostStatus, { label: string; bg: string; color: string }> = {
  draft:     { label: "초안",   bg: "#F3F4F6", color: "#6B7280" },
  approved:  { label: "승인됨", bg: "#DCFCE7", color: "#16A34A" },
  published: { label: "발행됨", bg: "#DBEAFE", color: "#1D4ED8" },
  failed:    { label: "실패",   bg: "#FEE2E2", color: "#DC2626" },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function ThreadsAdminPage() {
  const [password, setPassword]       = useState("");
  const [authed, setAuthed]           = useState(false);
  const [posts, setPosts]             = useState<ThreadsPost[]>([]);
  const [loading, setLoading]         = useState(false);
  const [actionId, setActionId]       = useState<string | null>(null);
  const [showForm, setShowForm]       = useState(false);
  const [draft, setDraft]             = useState({ content: "", image_url: "", scheduled_at: "" });
  const [toast, setToast]             = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const headers = useCallback(() => ({
    "Content-Type": "application/json",
    "x-admin-password": password,
  }), [password]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/threads/queue", { headers: headers() });
      if (res.status === 401) { setAuthed(false); return; }
      const data = await res.json();
      setPosts(data.posts ?? []);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const handleLogin = async () => {
    const res = await fetch("/api/threads/queue", { headers: headers() });
    if (res.ok) { setAuthed(true); }
    else showToast("비밀번호가 틀렸어요");
  };

  useEffect(() => {
    if (authed) loadPosts();
  }, [authed, loadPosts]);

  const handleApprove = async (id: string) => {
    setActionId(id);
    await fetch(`/api/threads/${id}/approve`, { method: "PATCH", headers: headers() });
    await loadPosts();
    setActionId(null);
    showToast("상태가 변경됐어요");
  };

  const handlePublish = async (id: string) => {
    if (!confirm("지금 바로 스레드에 발행할까요?")) return;
    setActionId(id);
    const res = await fetch(`/api/threads/${id}/publish`, { method: "POST", headers: headers() });
    const data = await res.json();
    await loadPosts();
    setActionId(null);
    showToast(res.ok ? `발행 완료! Thread ID: ${data.threadId}` : `실패: ${data.error}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("삭제할까요?")) return;
    setActionId(id);
    await fetch(`/api/threads/${id}/approve`, { method: "DELETE", headers: headers() });
    await loadPosts();
    setActionId(null);
    showToast("삭제됐어요");
  };

  const handleCreate = async () => {
    if (!draft.content || !draft.scheduled_at) { showToast("내용과 예약 시간을 입력해주세요"); return; }
    const res = await fetch("/api/threads/queue", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        content: draft.content,
        image_url: draft.image_url || null,
        scheduled_at: new Date(draft.scheduled_at).toISOString(),
      }),
    });
    if (res.ok) {
      setDraft({ content: "", image_url: "", scheduled_at: "" });
      setShowForm(false);
      await loadPosts();
      showToast("포스트가 초안으로 저장됐어요");
    } else {
      const d = await res.json();
      showToast(`오류: ${d.error}`);
    }
  };

  const charCount = draft.content.length;
  const charOver = charCount > 500;

  // 탭별 분류
  const pending   = posts.filter(p => p.status === "draft" || p.status === "approved");
  const published = posts.filter(p => p.status === "published");
  const failed    = posts.filter(p => p.status === "failed");
  const [tab, setTab] = useState<"pending" | "published" | "failed">("pending");
  const tabPosts = tab === "pending" ? pending : tab === "published" ? published : failed;

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
        <div className="bg-[#111] border border-white/10 rounded-2xl p-8 w-full max-w-sm flex flex-col gap-4">
          <p className="text-white font-bold text-lg">Threads 어드민</p>
          <input
            type="password" placeholder="Admin password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            className="bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none"
          />
          <button onClick={handleLogin}
            className="bg-white text-black font-bold py-3 rounded-xl text-sm hover:bg-white/90 transition-colors">
            로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* 토스트 */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white text-black text-sm font-bold px-5 py-2.5 rounded-full shadow-xl">
          {toast}
        </div>
      )}

      {/* 헤더 */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-0.5">StyleDrop</p>
          <p className="font-black text-lg">Threads 발행 관리</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="px-4 py-2 rounded-xl font-bold text-sm transition-all"
          style={{ background: showForm ? "#222" : "#22C55E", color: showForm ? "#fff" : "#000" }}>
          {showForm ? "취소" : "+ 새 포스트"}
        </button>
      </header>

      {/* 포스트 작성 폼 */}
      {showForm && (
        <div className="border-b border-white/10 px-6 py-6 bg-[#111]">
          <p className="text-[12px] font-black uppercase tracking-widest text-white/40 mb-4">새 포스트 작성</p>
          <div className="flex flex-col gap-3 max-w-2xl">
            <div className="relative">
              <textarea
                value={draft.content}
                onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
                placeholder="스레드에 올릴 마케팅 문구를 작성하세요..."
                rows={5}
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none resize-none"
                style={{ borderColor: charOver ? "#EF4444" : undefined }}
              />
              <span className="absolute bottom-3 right-4 text-[11px]" style={{ color: charOver ? "#EF4444" : "#555" }}>
                {charCount}/500
              </span>
            </div>
            <input
              type="text" value={draft.image_url}
              onChange={e => setDraft(d => ({ ...d, image_url: e.target.value }))}
              placeholder="이미지 URL (선택, 없으면 텍스트 포스트)"
              className="bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none"
            />
            <div className="flex gap-3 items-center">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[11px] text-white/40 font-bold uppercase tracking-wider">예약 발행 시간</label>
                <input
                  type="datetime-local" value={draft.scheduled_at}
                  onChange={e => setDraft(d => ({ ...d, scheduled_at: e.target.value }))}
                  className="bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none"
                />
              </div>
              <button onClick={handleCreate} disabled={charOver}
                className="mt-5 px-6 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
                style={{ background: "#22C55E", color: "#000" }}>
                초안 저장
              </button>
            </div>

            {/* 마케팅 카피 템플릿 */}
            <div className="mt-2">
              <p className="text-[11px] text-white/30 font-bold uppercase tracking-wider mb-2">빠른 템플릿</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "📸 사진 한 장으로 내 스타일 변신 완료\nStyleDrop AI가 감성 카드로 만들어드려요 ✨\n👉 styledrop.cloud",
                  "🎭 내가 오디션을 본다면?\nAI 감독이 나를 심사하는 색다른 경험\n📲 StyleDrop에서 무료 체험 → styledrop.cloud",
                  "🪞 친구 5명은 나를 어떻게 볼까?\n익명으로 솔직한 평가 받아보기\n내가 보는 너 → styledrop.cloud/nabo",
                  "🌈 내 퍼스널컬러, AI가 찾아드려요\n사진 한 장으로 즉시 분석\n→ styledrop.cloud",
                ].map((tpl, i) => (
                  <button key={i} onClick={() => setDraft(d => ({ ...d, content: tpl }))}
                    className="text-[11px] px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-colors text-left">
                    템플릿 {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="border-b border-white/10 px-6 flex gap-6">
        {([
          ["pending",   `대기 (${pending.length})`],
          ["published", `발행됨 (${published.length})`],
          ["failed",    `실패 (${failed.length})`],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className="py-3 text-sm font-bold border-b-2 transition-colors"
            style={{ borderColor: tab === key ? "#22C55E" : "transparent", color: tab === key ? "#fff" : "#555" }}>
            {label}
          </button>
        ))}
        <button onClick={loadPosts} className="ml-auto py-3 text-[12px] text-white/30 hover:text-white transition-colors">
          {loading ? "로딩 중..." : "새로고침 ↻"}
        </button>
      </div>

      {/* 포스트 목록 */}
      <div className="px-6 py-4 flex flex-col gap-3 max-w-3xl">
        {tabPosts.length === 0 && (
          <div className="py-16 text-center text-white/30 text-sm">포스트가 없어요</div>
        )}
        {tabPosts.map(post => {
          const s = STATUS_STYLE[post.status];
          const busy = actionId === post.id;
          return (
            <div key={post.id} className="bg-[#111] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-3">
              {/* 상태 + 시간 */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black rounded-full px-2.5 py-0.5"
                  style={{ background: s.bg, color: s.color }}>{s.label}</span>
                <div className="text-right">
                  <p className="text-[11px] text-white/30">예약: {fmtDate(post.scheduled_at)}</p>
                  {post.published_at && (
                    <p className="text-[11px] text-white/20">발행: {fmtDate(post.published_at)}</p>
                  )}
                </div>
              </div>

              {/* 본문 */}
              <p className="text-[14px] text-white/80 leading-relaxed whitespace-pre-wrap">{post.content}</p>

              {/* 이미지 URL */}
              {post.image_url && (
                <p className="text-[11px] text-white/30 truncate">🖼 {post.image_url}</p>
              )}

              {/* 에러 메시지 */}
              {post.error_message && (
                <p className="text-[12px] text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{post.error_message}</p>
              )}

              {/* Threads 링크 */}
              {post.thread_id && (
                <p className="text-[11px] text-blue-400">Thread ID: {post.thread_id}</p>
              )}

              {/* 액션 버튼 */}
              {post.status !== "published" && (
                <div className="flex gap-2 pt-1 border-t border-white/[0.06]">
                  {/* 승인 토글 */}
                  {(post.status === "draft" || post.status === "approved") && (
                    <button onClick={() => handleApprove(post.id)} disabled={busy}
                      className="flex-1 py-2 rounded-xl text-[13px] font-bold transition-all disabled:opacity-40"
                      style={{
                        background: post.status === "approved" ? "#1A1A1A" : "#22C55E",
                        color: post.status === "approved" ? "#6B7280" : "#000",
                        border: post.status === "approved" ? "1px solid #333" : "none",
                      }}>
                      {post.status === "approved" ? "승인 취소" : "✓ 승인"}
                    </button>
                  )}

                  {/* 지금 발행 (승인된 것만) */}
                  {post.status === "approved" && (
                    <button onClick={() => handlePublish(post.id)} disabled={busy}
                      className="flex-1 py-2 rounded-xl text-[13px] font-bold bg-white text-black transition-all disabled:opacity-40 hover:bg-white/90">
                      {busy ? "발행 중..." : "지금 발행 →"}
                    </button>
                  )}

                  {/* 삭제 */}
                  <button onClick={() => handleDelete(post.id)} disabled={busy}
                    className="px-4 py-2 rounded-xl text-[13px] font-bold text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40">
                    삭제
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
