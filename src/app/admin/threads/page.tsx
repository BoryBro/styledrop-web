"use client";

import { useState, useEffect } from "react";

type PostStatus = "draft" | "approved" | "published" | "failed";
type ThreadsPost = {
  id: string; content: string; image_url: string | null;
  scheduled_at: string; status: PostStatus; thread_id: string | null;
  error_message: string | null; published_at: string | null; created_at: string;
};

const STATUS_STYLE: Record<PostStatus, { label: string; bg: string; color: string }> = {
  draft:     { label: "초안",   bg: "#F3F4F6", color: "#6B7280" },
  approved:  { label: "승인됨", bg: "#DCFCE7", color: "#16A34A" },
  published: { label: "발행됨", bg: "#DBEAFE", color: "#1D4ED8" },
  failed:    { label: "실패",   bg: "#FEE2E2", color: "#DC2626" },
};

const fmt = (iso: string) =>
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
    }).then(r => r.json()).then(d => { if (d.metrics) setMetrics(d.metrics); }).catch(() => {});
  }, [postId, password]);
  if (!metrics) return <span className="text-[11px] text-white/20">로딩 중...</span>;
  return (
    <div className="flex gap-3 text-[12px]">
      <span className="text-white/50">👁 {(metrics.views ?? 0).toLocaleString()}</span>
      <span className="text-white/50">♥ {(metrics.likes ?? 0).toLocaleString()}</span>
      <span className="text-white/50">💬 {(metrics.replies ?? 0).toLocaleString()}</span>
      <span className="text-white/50">🔁 {(metrics.reposts ?? 0).toLocaleString()}</span>
    </div>
  );
}

const STORAGE_KEY = "threads_admin_pw";

export default function ThreadsAdminPage() {
  const [pw, setPw]           = useState("");
  const [authed, setAuthed]   = useState(false);
  const [posts, setPosts]     = useState<ThreadsPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft]     = useState({ content: "", image_url: "", scheduled_at: "" });
  const [toast, setToast]     = useState<string | null>(null);
  const [tab, setTab]         = useState<"pending" | "published" | "failed">("pending");
  const [logging, setLogging] = useState(false);

  const toast$ = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const h = (p: string) => ({ "Content-Type": "application/json", "x-admin-password": p });

  const fetchPosts = async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/threads/queue", { headers: h(p) });
      if (!res.ok) return;
      const data = await res.json();
      setPosts(data.posts ?? []);
    } finally { setLoading(false); }
  };

  // 자동 로그인
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      setPw(saved);
      fetch("/api/threads/queue", { headers: h(saved) }).then(res => {
        if (res.ok) {
          setAuthed(true);
          return res.json().then(d => setPosts(d.posts ?? []));
        }
      }).catch(() => {});
    } catch {}
  }, []);

  const login = async () => {
    if (!pw) { toast$("비밀번호 입력해주세요"); return; }
    setLogging(true);
    try {
      const res = await fetch("/api/threads/queue", { headers: h(pw) });
      if (res.ok) {
        try { localStorage.setItem(STORAGE_KEY, pw); } catch {}
        const data = await res.json();
        setPosts(data.posts ?? []);
        setAuthed(true);
      } else {
        toast$("비밀번호가 틀렸어요");
      }
    } catch { toast$("네트워크 오류"); }
    finally { setLogging(false); }
  };

  const approve = async (id: string) => {
    setActionId(id);
    await fetch(`/api/threads/${id}/approve`, { method: "PATCH", headers: h(pw) });
    await fetchPosts(pw); setActionId(null); toast$("상태 변경됨");
  };

  const approveAll = async () => {
    const drafts = posts.filter(p => p.status === "draft");
    if (!drafts.length) { toast$("승인할 초안 없음"); return; }
    if (!confirm(`${drafts.length}개 전체 승인?`)) return;
    await Promise.all(drafts.map(p => fetch(`/api/threads/${p.id}/approve`, { method: "PATCH", headers: h(pw) })));
    await fetchPosts(pw); toast$(`${drafts.length}개 승인 완료`);
  };

  const publish = async (id: string) => {
    if (!confirm("지금 발행할까요?")) return;
    setActionId(id);
    const res = await fetch(`/api/threads/${id}/publish`, { method: "POST", headers: h(pw) });
    const data = await res.json();
    await fetchPosts(pw); setActionId(null);
    toast$(res.ok ? `발행 완료 ${data.threadId}` : `실패: ${data.error}`);
  };

  const del = async (id: string) => {
    if (!confirm("삭제?")) return;
    setActionId(id);
    await fetch(`/api/threads/${id}/approve`, { method: "DELETE", headers: h(pw) });
    await fetchPosts(pw); setActionId(null); toast$("삭제됨");
  };

  const create = async () => {
    if (!draft.content || !draft.scheduled_at) { toast$("내용과 시간 입력 필요"); return; }
    const res = await fetch("/api/threads/queue", {
      method: "POST", headers: h(pw),
      body: JSON.stringify({ content: draft.content, image_url: draft.image_url || null, scheduled_at: new Date(draft.scheduled_at).toISOString() }),
    });
    if (res.ok) { setDraft({ content: "", image_url: "", scheduled_at: "" }); setShowForm(false); await fetchPosts(pw); toast$("저장됨"); }
    else { const d = await res.json(); toast$(`오류: ${d.error}`); }
  };

  const pending   = posts.filter(p => p.status === "draft" || p.status === "approved");
  const published = posts.filter(p => p.status === "published");
  const failed    = posts.filter(p => p.status === "failed");
  const tabPosts  = tab === "pending" ? pending : tab === "published" ? published : failed;
  const charOver  = draft.content.length > 500;

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-6 gap-4">
        <p className="text-white font-bold text-xl">Threads 어드민</p>
        <input
          type="password"
          placeholder="비밀번호"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === "Enter" && void login()}
          className="w-full max-w-xs bg-[#1A1A1A] border border-white/20 rounded-2xl px-5 py-4 text-white text-base outline-none"
        />
        <button
          onClick={() => void login()}
          disabled={logging}
          className="w-full max-w-xs py-4 rounded-2xl text-base font-bold text-black disabled:opacity-50"
          style={{ backgroundColor: "#ffffff" }}
        >
          {logging ? "확인 중..." : "로그인"}
        </button>
        {toast && (
          <p className="text-red-400 text-sm">{toast}</p>
        )}
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

      <header className="border-b border-white/10 px-5 py-4 flex items-center justify-between">
        <p className="font-black text-base">Threads 관리</p>
        <div className="flex items-center gap-2">
          <a href="/admin" className="px-3 py-2 rounded-xl text-sm font-bold text-white/50 border border-white/10">← 어드민</a>
          <button onClick={() => setShowForm(v => !v)}
            className="px-4 py-2 rounded-xl font-bold text-sm"
            style={{ background: showForm ? "#333" : "#22C55E", color: showForm ? "#fff" : "#000" }}>
            {showForm ? "취소" : "+ 새 글"}
          </button>
        </div>
      </header>

      {showForm && (
        <div className="border-b border-white/10 px-5 py-5 bg-[#111]">
          <div className="flex flex-col gap-3 max-w-2xl">
            <div className="relative">
              <textarea value={draft.content} onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
                placeholder="마케팅 문구 작성..." rows={5}
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none resize-none"
                style={{ borderColor: charOver ? "#EF4444" : undefined }} />
              <span className="absolute bottom-3 right-4 text-[11px]" style={{ color: charOver ? "#EF4444" : "#555" }}>
                {draft.content.length}/500
              </span>
            </div>
            <input type="text" value={draft.image_url} onChange={e => setDraft(d => ({ ...d, image_url: e.target.value }))}
              placeholder="이미지 URL (선택)"
              className="bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none" />
            <div className="flex gap-3 items-end">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[11px] text-white/40 font-bold uppercase tracking-wider">예약 시간</label>
                <input type="datetime-local" value={draft.scheduled_at} onChange={e => setDraft(d => ({ ...d, scheduled_at: e.target.value }))}
                  className="bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none" />
              </div>
              <button onClick={() => void create()} disabled={charOver}
                className="px-5 py-3 rounded-xl font-bold text-sm disabled:opacity-40"
                style={{ background: "#22C55E", color: "#000" }}>저장</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {[{ label: "오늘 12시", h: 12, t: false }, { label: "오늘 17시", h: 17, t: false }, { label: "오늘 21시", h: 21, t: false },
                { label: "내일 12시", h: 12, t: true }, { label: "내일 17시", h: 17, t: true }, { label: "내일 21시", h: 21, t: true }]
                .map(({ label, h: hour, t }) => (
                  <button key={label} type="button" onClick={() => {
                    const d = new Date(); if (t) d.setDate(d.getDate() + 1);
                    d.setHours(hour - 9, 0, 0, 0);
                    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
                    setDraft(v => ({ ...v, scheduled_at: local.toISOString().slice(0, 16) }));
                  }} className="text-[11px] px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white">
                    {label}
                  </button>
                ))}
            </div>
            <div className="grid grid-cols-1 gap-2 mt-1">
              {TEMPLATES.map((tpl, i) => (
                <button key={i} type="button" onClick={() => setDraft(d => ({ ...d, content: tpl.content }))}
                  className="text-left p-3 rounded-xl border border-white/10 hover:border-white/30">
                  <p className="text-[10px] font-black text-white/30 mb-1 uppercase tracking-wider">{tpl.tag}</p>
                  <p className="text-[12px] text-white/60 leading-relaxed whitespace-pre-wrap line-clamp-2">{tpl.content}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-white/10 px-5 flex items-center gap-3">
        {(["pending", "published", "failed"] as const).map(key => (
          <button key={key} onClick={() => setTab(key)}
            className="py-3 text-sm font-bold border-b-2 transition-colors"
            style={{ borderColor: tab === key ? "#22C55E" : "transparent", color: tab === key ? "#fff" : "#555" }}>
            {key === "pending" ? `대기(${pending.length})` : key === "published" ? `발행(${published.length})` : `실패(${failed.length})`}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {tab === "pending" && pending.filter(p => p.status === "draft").length > 0 && (
            <button onClick={() => void approveAll()}
              className="px-3 py-1.5 rounded-xl text-[12px] font-bold"
              style={{ background: "#22C55E", color: "#000" }}>
              전체승인({pending.filter(p => p.status === "draft").length})
            </button>
          )}
          <button onClick={() => void fetchPosts(pw)} className="py-3 text-[13px] text-white/30">
            {loading ? "..." : "↻"}
          </button>
        </div>
      </div>

      <div className="px-5 py-4 flex flex-col gap-3 max-w-3xl">
        {tabPosts.length === 0 && <div className="py-16 text-center text-white/30 text-sm">포스트 없음</div>}
        {tabPosts.map(post => {
          const s = STATUS_STYLE[post.status];
          const busy = actionId === post.id;
          return (
            <div key={post.id} className="bg-[#111] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black rounded-full px-2.5 py-0.5" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                <div className="text-right">
                  <p className="text-[11px] text-white/30">예약: {fmt(post.scheduled_at)}</p>
                  {post.published_at && <p className="text-[11px] text-white/20">발행: {fmt(post.published_at)}</p>}
                </div>
              </div>
              <p className="text-[14px] text-white/80 leading-relaxed whitespace-pre-wrap">{post.content}</p>
              {post.error_message && <p className="text-[12px] text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{post.error_message}</p>}
              {post.status === "published" && post.thread_id && (
                <div className="border-t border-white/[0.06] pt-3">
                  <InsightsBadge postId={post.id} password={pw} />
                </div>
              )}
              {post.status !== "published" && (
                <div className="flex gap-2 pt-1 border-t border-white/[0.06]">
                  {(post.status === "draft" || post.status === "approved") && (
                    <button onClick={() => void approve(post.id)} disabled={busy}
                      className="flex-1 py-2 rounded-xl text-[13px] font-bold disabled:opacity-40"
                      style={{ background: post.status === "approved" ? "#1A1A1A" : "#22C55E", color: post.status === "approved" ? "#6B7280" : "#000", border: post.status === "approved" ? "1px solid #333" : "none" }}>
                      {post.status === "approved" ? "승인취소" : "✓ 승인"}
                    </button>
                  )}
                  {post.status === "approved" && (
                    <button onClick={() => void publish(post.id)} disabled={busy}
                      className="flex-1 py-2 rounded-xl text-[13px] font-bold bg-white text-black disabled:opacity-40">
                      {busy ? "발행 중..." : "지금 발행 →"}
                    </button>
                  )}
                  <button onClick={() => void del(post.id)} disabled={busy}
                    className="px-4 py-2 rounded-xl text-[13px] font-bold text-red-400 disabled:opacity-40">삭제</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
