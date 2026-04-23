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

const TEMPLATES = [
  { tag: "12시 · 가벼운 훅", content: "AI한테 내 사진 맡겼더니\n몽골 초원을 달리는 전사가 됐어요\n\n근데 진짜 소름인 건,\n나랑 닮았다는 거 🐴\n\n→ styledrop.cloud" },
  { tag: "12시 · 질문 형식", content: "만약 전생이 있다면 나는 뭐였을까요?\n\nAI한테 물어봤는데\n사진 한 장 올렸더니 바로 답해줌 😂\n\n생각보다 진지해서 놀랐어요\n→ styledrop.cloud" },
  { tag: "17시 · 퇴근 감성", content: "오늘 퇴근하고 이거 해봤는데\n\n내 사진이 AI 손을 거치면\n이렇게 달라짐\n\n프사 바꾸고 싶어서 저장해뒀어요 📲\n→ styledrop.cloud" },
  { tag: "17시 · 친구 추천", content: "친구한테 보내주고 싶어서 올림\n\n사진 올리면 AI가\n감성 카드로 만들어주는 서비스인데\n결과물이 생각보다 훨씬 잘 나옴\n\n무료야 → styledrop.cloud" },
  { tag: "21시 · FOMO",    content: "밤에 혼자 해봤는데\n\n내가 우주비행사였다면\n이런 모습이었을 것 같다는 결과 받음\n\n진짜 저장하고 싶었음\n→ styledrop.cloud" },
  { tag: "21시 · 감성",    content: "AI가 내 사진으로 만들어준 카드\n\n벽에 걸고 싶을 정도로 잘 나왔음\n이게 무료라는 게 말이 돼?\n\n→ styledrop.cloud" },
  { tag: "관상/오디션",    content: "AI 감독한테 오디션 봤음\n\n\"눈빛에 서사가 있다\"\n\"이 얼굴은 주연 감이다\"\n\n기분 좋아지는 평가 받고 싶으면\n→ styledrop.cloud/ai-audition" },
  { tag: "퍼스널컬러",     content: "퍼스널컬러 검사 비용 아깝다면\n\nAI한테 물어봐요\n사진 한 장으로 즉시 분석\n\n봄웜 / 여름쿨 / 가을웜 / 겨울쿨\n→ styledrop.cloud/personal-color-test" },
];

function InsightsBadge({ postId, password }: { postId: string; password: string }) {
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetch(`/api/threads/${postId}/insights`, {
      headers: { "Content-Type": "application/json", "x-admin-password": password },
    })
      .then(r => r.json())
      .then(d => { if (d.metrics) setMetrics(d.metrics); })
      .catch(() => {});
  }, [postId, password]);

  if (!metrics) return <span className="text-[11px] text-white/20">분석 로딩 중...</span>;
  return (
    <div className="flex gap-3 text-[12px]">
      <span className="text-white/50">👁 {(metrics.views ?? 0).toLocaleString()}</span>
      <span className="text-white/50">♥ {(metrics.likes ?? 0).toLocaleString()}</span>
      <span className="text-white/50">💬 {(metrics.replies ?? 0).toLocaleString()}</span>
      <span className="text-white/50">🔁 {(metrics.reposts ?? 0).toLocaleString()}</span>
    </div>
  );
}

export default function ThreadsAdminPage() {
  const [password, setPassword]         = useState("");
  const [authed, setAuthed]             = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [posts, setPosts]               = useState<ThreadsPost[]>([]);
  const [loading, setLoading]           = useState(false);
  const [actionId, setActionId]         = useState<string | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [draft, setDraft]               = useState({ content: "", image_url: "", scheduled_at: "" });
  const [toast, setToast]               = useState<string | null>(null);
  const [tab, setTab]                   = useState<"pending" | "published" | "failed">("pending");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const authHeaders = useCallback((pw: string) => ({
    "Content-Type": "application/json",
    "x-admin-password": pw,
  }), []);

  const loadPosts = useCallback(async (pw: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/threads/queue", { headers: authHeaders(pw) });
      if (res.status === 401) { setAuthed(false); return; }
      const data = await res.json();
      setPosts(data.posts ?? []);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const handleLogin = useCallback(async (pw: string) => {
    if (!pw) { showToast("비밀번호를 입력해주세요"); return false; }
    try {
      const res = await fetch("/api/threads/queue", { headers: authHeaders(pw) });
      if (res.ok) {
        try { localStorage.setItem("threads_admin_pw", pw); } catch {}
        setPassword(pw);
        setAuthed(true);
        return true;
      } else {
        try { localStorage.removeItem("threads_admin_pw"); } catch {}
        return false;
      }
    } catch {
      showToast("네트워크 오류. 다시 시도해주세요.");
      return false;
    }
  }, [authHeaders, showToast]);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("threads_admin_pw"); } catch {}
    if (saved) {
      handleLogin(saved).finally(() => setInitializing(false));
    } else {
      setInitializing(false);
    }
  }, [handleLogin]);

  useEffect(() => {
    if (authed) loadPosts(password);
  }, [authed, password, loadPosts]);

  const handleApprove = async (id: string) => {
    setActionId(id);
    await fetch(`/api/threads/${id}/approve`, { method: "PATCH", headers: authHeaders(password) });
    await loadPosts(password);
    setActionId(null);
    showToast("상태가 변경됐어요");
  };

  const handleApproveAll = async () => {
    const drafts = posts.filter(p => p.status === "draft");
    if (drafts.length === 0) { showToast("승인할 초안이 없어요"); return; }
    if (!confirm(`초안 ${drafts.length}개를 전체 승인할까요?`)) return;
    await Promise.all(drafts.map(p =>
      fetch(`/api/threads/${p.id}/approve`, { method: "PATCH", headers: authHeaders(password) })
    ));
    await loadPosts(password);
    showToast(`${drafts.length}개 전체 승인 완료`);
  };

  const handlePublish = async (id: string) => {
    if (!confirm("지금 바로 스레드에 발행할까요?")) return;
    setActionId(id);
    const res = await fetch(`/api/threads/${id}/publish`, { method: "POST", headers: authHeaders(password) });
    const data = await res.json();
    await loadPosts(password);
    setActionId(null);
    showToast(res.ok ? `발행 완료! Thread ID: ${data.threadId}` : `실패: ${data.error}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("삭제할까요?")) return;
    setActionId(id);
    await fetch(`/api/threads/${id}/approve`, { method: "DELETE", headers: authHeaders(password) });
    await loadPosts(password);
    setActionId(null);
    showToast("삭제됐어요");
  };

  const handleCreate = async () => {
    if (!draft.content || !draft.scheduled_at) { showToast("내용과 예약 시간을 입력해주세요"); return; }
    const res = await fetch("/api/threads/queue", {
      method: "POST",
      headers: authHeaders(password),
      body: JSON.stringify({
        content: draft.content,
        image_url: draft.image_url || null,
        scheduled_at: new Date(draft.scheduled_at).toISOString(),
      }),
    });
    if (res.ok) {
      setDraft({ content: "", image_url: "", scheduled_at: "" });
      setShowForm(false);
      await loadPosts(password);
      showToast("포스트가 초안으로 저장됐어요");
    } else {
      const d = await res.json();
      showToast(`오류: ${d.error}`);
    }
  };

  const charCount = draft.content.length;
  const charOver = charCount > 500;
  const pending   = posts.filter(p => p.status === "draft" || p.status === "approved");
  const published = posts.filter(p => p.status === "published");
  const failed    = posts.filter(p => p.status === "failed");
  const tabPosts  = tab === "pending" ? pending : tab === "published" ? published : failed;
  const draftCount = pending.filter(p => p.status === "draft").length;

  if (initializing) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white animate-spin" />
      </div>
    );
  }

  if (!authed) {
    const doLogin = async () => {
      const ok = await handleLogin(password);
      if (!ok) showToast("비밀번호가 틀렸어요");
    };
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
        <div className="bg-[#111] border border-white/10 rounded-2xl p-8 w-full max-w-sm flex flex-col gap-4">
          <p className="text-white font-bold text-lg">Threads 어드민</p>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") void doLogin(); }}
            autoComplete="current-password"
            className="bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none"
          />
          <button
            onClick={() => void doLogin()}
            onTouchEnd={e => { e.preventDefault(); void doLogin(); }}
            className="bg-white text-black font-bold py-4 rounded-xl text-base cursor-pointer select-none"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white text-black text-sm font-bold px-5 py-2.5 rounded-full shadow-xl">
          {toast}
        </div>
      )}

      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-0.5">StyleDrop</p>
          <p className="font-black text-lg">Threads 발행 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/admin"
            className="px-3 py-2 rounded-xl text-sm font-bold text-white/50 border border-white/10 hover:text-white hover:border-white/30 transition-colors"
          >
            ← 어드민
          </a>
          <button
            onClick={() => setShowForm(v => !v)}
            className="px-4 py-2 rounded-xl font-bold text-sm"
            style={{ background: showForm ? "#222" : "#22C55E", color: showForm ? "#fff" : "#000" }}
          >
            {showForm ? "취소" : "+ 새 포스트"}
          </button>
        </div>
      </header>

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
              placeholder="이미지 URL (선택)"
              className="bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none"
            />
            <div className="flex gap-3 items-end">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[11px] text-white/40 font-bold uppercase tracking-wider">예약 발행 시간</label>
                <input
                  type="datetime-local" value={draft.scheduled_at}
                  onChange={e => setDraft(d => ({ ...d, scheduled_at: e.target.value }))}
                  className="bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none"
                />
              </div>
              <button onClick={handleCreate} disabled={charOver}
                className="px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-40"
                style={{ background: "#22C55E", color: "#000" }}>
                초안 저장
              </button>
            </div>

            <div className="mt-1">
              <p className="text-[11px] text-white/30 font-bold uppercase tracking-wider mb-2">빠른 시간 선택 (KST)</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "오늘 12시", h: 12, tomorrow: false },
                  { label: "오늘 17시", h: 17, tomorrow: false },
                  { label: "오늘 21시", h: 21, tomorrow: false },
                  { label: "내일 12시", h: 12, tomorrow: true },
                  { label: "내일 17시", h: 17, tomorrow: true },
                  { label: "내일 21시", h: 21, tomorrow: true },
                ].map(({ label, h, tomorrow }) => (
                  <button key={label} type="button" onClick={() => {
                    const d = new Date();
                    if (tomorrow) d.setDate(d.getDate() + 1);
                    d.setHours(h - 9, 0, 0, 0);
                    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
                    setDraft(v => ({ ...v, scheduled_at: local.toISOString().slice(0, 16) }));
                  }}
                    className="text-[11px] px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/30">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2">
              <p className="text-[11px] text-white/30 font-bold uppercase tracking-wider mb-2">콘텐츠 템플릿</p>
              <div className="grid grid-cols-1 gap-2">
                {TEMPLATES.map((tpl, i) => (
                  <button key={i} type="button" onClick={() => setDraft(d => ({ ...d, content: tpl.content }))}
                    className="text-left p-3 rounded-xl border border-white/10 hover:border-white/30 group">
                    <p className="text-[10px] font-black text-white/30 group-hover:text-white/50 mb-1 uppercase tracking-wider">{tpl.tag}</p>
                    <p className="text-[12px] text-white/60 group-hover:text-white/80 leading-relaxed whitespace-pre-wrap line-clamp-3">{tpl.content}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-white/10 px-6 flex items-center gap-4">
        {(["pending", "published", "failed"] as const).map(key => (
          <button key={key} onClick={() => setTab(key)}
            className="py-3 text-sm font-bold border-b-2 transition-colors"
            style={{ borderColor: tab === key ? "#22C55E" : "transparent", color: tab === key ? "#fff" : "#555" }}>
            {key === "pending" ? `대기 (${pending.length})` : key === "published" ? `발행됨 (${published.length})` : `실패 (${failed.length})`}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {tab === "pending" && draftCount > 0 && (
            <button onClick={handleApproveAll}
              className="px-3 py-1.5 rounded-xl text-[12px] font-bold"
              style={{ background: "#22C55E", color: "#000" }}>
              전체 승인 ({draftCount})
            </button>
          )}
          <button onClick={() => loadPosts(password)} className="py-3 text-[12px] text-white/30 hover:text-white">
            {loading ? "..." : "↻"}
          </button>
        </div>
      </div>

      <div className="px-6 py-4 flex flex-col gap-3 max-w-3xl">
        {tabPosts.length === 0 && (
          <div className="py-16 text-center text-white/30 text-sm">포스트가 없어요</div>
        )}
        {tabPosts.map(post => {
          const s = STATUS_STYLE[post.status];
          const busy = actionId === post.id;
          return (
            <div key={post.id} className="bg-[#111] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-3">
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

              <p className="text-[14px] text-white/80 leading-relaxed whitespace-pre-wrap">{post.content}</p>

              {post.image_url && (
                <p className="text-[11px] text-white/30 truncate">🖼 {post.image_url}</p>
              )}
              {post.error_message && (
                <p className="text-[12px] text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{post.error_message}</p>
              )}

              {post.status === "published" && post.thread_id && (
                <div className="border-t border-white/[0.06] pt-3">
                  <InsightsBadge postId={post.id} password={password} />
                </div>
              )}

              {post.status !== "published" && (
                <div className="flex gap-2 pt-1 border-t border-white/[0.06]">
                  {(post.status === "draft" || post.status === "approved") && (
                    <button onClick={() => handleApprove(post.id)} disabled={busy}
                      className="flex-1 py-2 rounded-xl text-[13px] font-bold disabled:opacity-40"
                      style={{
                        background: post.status === "approved" ? "#1A1A1A" : "#22C55E",
                        color: post.status === "approved" ? "#6B7280" : "#000",
                        border: post.status === "approved" ? "1px solid #333" : "none",
                      }}>
                      {post.status === "approved" ? "승인 취소" : "✓ 승인"}
                    </button>
                  )}
                  {post.status === "approved" && (
                    <button onClick={() => handlePublish(post.id)} disabled={busy}
                      className="flex-1 py-2 rounded-xl text-[13px] font-bold bg-white text-black disabled:opacity-40">
                      {busy ? "발행 중..." : "지금 발행 →"}
                    </button>
                  )}
                  <button onClick={() => handleDelete(post.id)} disabled={busy}
                    className="px-4 py-2 rounded-xl text-[13px] font-bold text-red-400 disabled:opacity-40">
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
