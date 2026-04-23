"use client";

import { useState, useEffect } from "react";

type PostStatus = "draft" | "approved" | "published" | "failed";
type ThreadsPost = {
  id: string; content: string; image_url: string | null;
  scheduled_at: string; status: PostStatus; thread_id: string | null;
  error_message: string | null; published_at: string | null; created_at: string;
  template_id?: string | null; category?: string | null; cta_type?: string | null;
  link_included?: boolean | null; image_upload_recommended?: boolean | null;
  recommended_styles?: string[] | null; quality_note?: string | null;
};

type ThreadDraft = {
  content: string;
  image_url: string;
  scheduled_at: string;
  category: string;
  cta_type: "none" | "soft" | "direct";
  link_included: boolean;
  image_upload_recommended: boolean;
  recommended_styles: string[];
};

type TemplateSuggestion = {
  id: string;
  tag: string;
  content: string;
  imageRequired: boolean;
  category?: string | null;
  ctaType?: "none" | "soft" | "direct";
  linkIncluded?: boolean;
  styles?: string[];
};

type EditDraft = {
  content: string;
};

const STATUS_STYLE: Record<PostStatus, { label: string; bg: string; color: string }> = {
  draft:     { label: "초안",   bg: "#F3F4F6", color: "#6B7280" },
  approved:  { label: "승인됨", bg: "#DCFCE7", color: "#16A34A" },
  published: { label: "발행됨", bg: "#DBEAFE", color: "#1D4ED8" },
  failed:    { label: "실패",   bg: "#FEE2E2", color: "#DC2626" },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

function toDatetimeLocalValue(date: Date): string {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function buildPresetDate(hour: number, tomorrow: boolean): Date {
  const date = new Date();
  if (tomorrow) date.setDate(date.getDate() + 1);
  date.setHours(hour, 0, 0, 0);
  return date;
}

const EMPTY_DRAFT: ThreadDraft = {
  content: "",
  image_url: "",
  scheduled_at: "",
  category: "",
  cta_type: "none",
  link_included: false,
  image_upload_recommended: false,
  recommended_styles: [],
};

const FALLBACK_TEMPLATES: TemplateSuggestion[] = [
  { id: "fallback-1", tag: "기본 · 이미지 권장", imageRequired: true, category: "image_recommended", ctaType: "soft", content: "AI한테 내 사진 맡겼더니\n몽골 초원을 달리는 전사가 됐어요\n\n근데 진짜 소름인 건,\n나랑 닮았다는 거 🐴\n\n→ styledrop.cloud" },
  { id: "fallback-2", tag: "기본 · 질문형", imageRequired: false, category: "conversation", ctaType: "none", content: "만약 전생이 있다면 나는 뭐였을까요?\n\nAI한테 물어봤는데\n사진 한 장 올렸더니 바로 답해줌 😂\n\n생각보다 진지해서 놀랐어요" },
  { id: "fallback-3", tag: "기본 · 감성", imageRequired: true, category: "image_recommended", ctaType: "soft", content: "오늘 퇴근하고 이거 해봤는데\n\n내 사진이 AI 손을 거치면\n이렇게 달라짐\n\n프사 바꾸고 싶어서 저장해뒀어요 📲" },
  { id: "fallback-4", tag: "기본 · 친구 추천", imageRequired: false, category: "soft_cta", ctaType: "soft", content: "친구한테 보내주고 싶어서 올림\n\n사진 올리면 AI가\n감성 카드로 만들어주는 서비스인데\n결과물이 생각보다 훨씬 잘 나옴" },
  { id: "fallback-5", tag: "기본 · 밤 감성", imageRequired: true, category: "image_recommended", ctaType: "soft", content: "밤에 혼자 해봤는데\n\n내가 우주비행사였다면\n이런 모습이었을 것 같다는 결과 받음\n\n진짜 저장하고 싶었음" },
  { id: "fallback-6", tag: "기본 · 오디션", imageRequired: false, category: "direct_cta", ctaType: "direct", linkIncluded: true, content: "AI 감독한테 오디션 봤음\n\n\"눈빛에 서사가 있다\"\n\"이 얼굴은 주연 감이다\"\n\n기분 좋아지는 평가 받고 싶으면\n→ styledrop.cloud/ai-audition" },
];

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildTemplateSuggestions(posts: ThreadsPost[]): TemplateSuggestion[] {
  const csvSuggestions = posts
    .filter((post) => post.status !== "published" && post.content.trim())
    .map((post): TemplateSuggestion => {
      const ctaType: TemplateSuggestion["ctaType"] =
        post.cta_type === "soft" || post.cta_type === "direct" ? post.cta_type : "none";

      return {
        id: post.id,
        tag: [post.category ?? "CSV", post.cta_type ? `CTA ${post.cta_type}` : null].filter(Boolean).join(" · "),
        content: post.content,
        imageRequired: Boolean(post.image_upload_recommended),
        category: post.category,
        ctaType,
        linkIncluded: Boolean(post.link_included),
        styles: post.recommended_styles ?? [],
      };
    });

  return shuffle(csvSuggestions.length > 0 ? csvSuggestions : FALLBACK_TEMPLATES).slice(0, 8);
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }

  const [headers, ...body] = rows;
  if (!headers) return [];

  return body.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), values[index] ?? ""]))
  );
}

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
const STUDIO_LINK = "https://www.styledrop.cloud/studio";
const STYLEDROP_LINK_RE = /https?:\/\/(?:www\.)?styledrop\.cloud\/?(?:[\w/-]*)?/g;
const STYLEDROP_LINK_TEST_RE = /https?:\/\/(?:www\.)?styledrop\.cloud\/?(?:[\w/-]*)?/;

function hasStyledropLink(content: string): boolean {
  return STYLEDROP_LINK_TEST_RE.test(content);
}

function withStudioLink(content: string): string {
  const normalized = content.replace(STYLEDROP_LINK_RE, STUDIO_LINK);
  if (!normalized.includes(STUDIO_LINK)) return `${normalized.trim()}\n\n${STUDIO_LINK}`;

  let seen = false;
  return normalized
    .split("\n")
    .map((line) => {
      if (!line.includes(STUDIO_LINK)) return line;
      if (seen) return line.replace(STUDIO_LINK, "").trimEnd();
      seen = true;
      return line;
    })
    .filter((line, index, lines) => line.trim() !== "" || lines[index - 1]?.trim() !== "")
    .join("\n")
    .trim();
}

function withoutStudioLink(content: string): string {
  return content
    .replace(STYLEDROP_LINK_RE, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => line.trim() !== "" || lines[index - 1]?.trim() !== "")
    .join("\n")
    .trim();
}

export default function ThreadsAdminPage() {
  const [pw, setPw]           = useState("");
  const [authed, setAuthed]   = useState(false);
  const [posts, setPosts]     = useState<ThreadsPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft]     = useState<ThreadDraft>(EMPTY_DRAFT);
  const [toast, setToast]     = useState<string | null>(null);
  const [tab, setTab]         = useState<"pending" | "needsImage" | "published" | "failed">("pending");
  const [logging, setLogging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [draggingPostId, setDraggingPostId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ content: "" });
  const [draftUploading, setDraftUploading] = useState(false);
  const [draftDragActive, setDraftDragActive] = useState(false);
  const [templateSuggestions, setTemplateSuggestions] = useState<TemplateSuggestion[]>(() => buildTemplateSuggestions([]));

  const toast$ = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const h = (p: string) => ({ "Content-Type": "application/json", "x-admin-password": p });

  const fetchPosts = async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/threads/queue", { headers: h(p) });
      if (!res.ok) return;
      const data = await res.json();
      const nextPosts = data.posts ?? [];
      setPosts(nextPosts);
      setTemplateSuggestions(buildTemplateSuggestions(nextPosts));
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
          return res.json().then(d => {
            const nextPosts = d.posts ?? [];
            setPosts(nextPosts);
            setTemplateSuggestions(buildTemplateSuggestions(nextPosts));
          });
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
        const nextPosts = data.posts ?? [];
        setPosts(nextPosts);
        setTemplateSuggestions(buildTemplateSuggestions(nextPosts));
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
    const now = Date.now();
    const drafts = posts.filter(p =>
      p.status === "draft" &&
      !(p.image_upload_recommended && !p.image_url) &&
      new Date(p.scheduled_at).getTime() > now
    );
    if (!drafts.length) { toast$("승인할 초안 없음"); return; }
    if (!confirm(`${drafts.length}개 전체 승인? 이미지가 없거나 시간이 지난 글은 제외됩니다.`)) return;
    await Promise.all(drafts.map(p => fetch(`/api/threads/${p.id}/approve`, { method: "PATCH", headers: h(pw) })));
    await fetchPosts(pw); toast$(`${drafts.length}개 승인 완료`);
  };

  const importCsv = async (file: File | null) => {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) { toast$("CSV를 읽지 못했어요"); return; }
      const res = await fetch("/api/threads/import", {
        method: "POST",
        headers: h(pw),
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast$(`Import 실패: ${data.error}`);
        return;
      }
      await fetchPosts(pw);
      toast$(`${data.imported}개 import 완료 · 제외 ${data.skipped}개`);
    } catch {
      toast$("CSV import 실패");
    } finally {
      setImporting(false);
    }
  };

  const uploadImage = async (id: string, file: File | null) => {
    if (!file) return;
    setUploadingId(id);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/threads/${id}/image`, {
        method: "POST",
        headers: { "x-admin-password": pw },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        toast$(`업로드 실패: ${data.error}`);
        return;
      }
      await fetchPosts(pw);
      toast$("이미지 업로드 완료");
    } catch {
      toast$("이미지 업로드 실패");
    } finally {
      setUploadingId(null);
      setDraggingPostId(null);
    }
  };

  const uploadDraftImage = async (file: File | null) => {
    if (!file) return;
    setDraftUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/threads/image", {
        method: "POST",
        headers: { "x-admin-password": pw },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        toast$(`업로드 실패: ${data.error}`);
        return;
      }
      setDraft((current) => ({ ...current, image_url: data.imageUrl }));
      toast$("이미지 업로드 완료");
    } catch {
      toast$("이미지 업로드 실패");
    } finally {
      setDraftUploading(false);
    }
  };

  const applySuggestion = (suggestion: TemplateSuggestion) => {
    setDraft((current) => ({
      ...current,
      content: suggestion.content,
      category: suggestion.category ?? "",
      cta_type: suggestion.ctaType ?? "none",
      link_included: suggestion.linkIncluded ?? suggestion.content.includes("styledrop.cloud"),
      image_upload_recommended: suggestion.imageRequired,
      recommended_styles: suggestion.styles ?? [],
    }));
  };

  const startEdit = (post: ThreadsPost) => {
    setEditingPostId(post.id);
    setEditDraft({ content: post.content });
  };

  const saveEdit = async (post: ThreadsPost) => {
    const content = editDraft.content.trim();
    if (!content) { toast$("글 내용을 입력해주세요"); return; }
    if (content.length > 500) { toast$("500자를 넘었어요"); return; }
    setActionId(post.id);
    const res = await fetch(`/api/threads/${post.id}`, {
      method: "PATCH",
      headers: h(pw),
      body: JSON.stringify({ content, link_included: hasStyledropLink(content) }),
    });
    const data = await res.json();
    await fetchPosts(pw);
    setActionId(null);
    if (res.ok) {
      setEditingPostId(null);
      setEditDraft({ content: "" });
    }
    toast$(res.ok ? "글 수정 완료" : `실패: ${data.error}`);
  };

  const toggleStudioLink = async (post: ThreadsPost) => {
    const linkOn = hasStyledropLink(post.content);
    const nextContent = linkOn ? withoutStudioLink(post.content) : withStudioLink(post.content);
    if (nextContent.length > 500) {
      toast$("스튜디오 링크를 넣으면 500자를 넘어요");
      return;
    }
    setActionId(post.id);
    const res = await fetch(`/api/threads/${post.id}`, {
      method: "PATCH",
      headers: h(pw),
      body: JSON.stringify({ content: nextContent, link_included: !linkOn }),
    });
    const data = await res.json();
    await fetchPosts(pw);
    setActionId(null);
    toast$(res.ok ? (linkOn ? "스튜디오 링크 제거됨" : "스튜디오 링크 추가됨") : `실패: ${data.error}`);
  };

  const copyStylePrompt = async (style: string) => {
    try {
      const res = await fetch("/api/threads/style-prompts", {
        method: "POST",
        headers: h(pw),
        body: JSON.stringify({ styles: [style] }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast$(`복사 실패: ${data.error}`);
        return;
      }
      await navigator.clipboard.writeText(data.prompt);
      toast$(`${style} 프롬프트 복사됨`);
    } catch {
      toast$("프롬프트 복사 실패");
    }
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
    const scheduledDate = new Date(draft.scheduled_at);
    if (Number.isNaN(scheduledDate.getTime())) { toast$("예약 시간이 올바르지 않아요"); return; }
    if (scheduledDate.getTime() <= Date.now()) { toast$("이미 지난 시간입니다. 미래 시간으로 선택해주세요"); return; }
    const res = await fetch("/api/threads/queue", {
      method: "POST", headers: h(pw),
      body: JSON.stringify({
        content: draft.content,
        image_url: draft.image_url || null,
        scheduled_at: scheduledDate.toISOString(),
        category: draft.category || null,
        cta_type: draft.cta_type,
        link_included: draft.link_included,
        image_upload_recommended: draft.image_upload_recommended,
        recommended_styles: draft.recommended_styles,
      }),
    });
    if (res.ok) { setDraft(EMPTY_DRAFT); setShowForm(false); await fetchPosts(pw); toast$("저장됨"); }
    else { const d = await res.json(); toast$(`오류: ${d.error}`); }
  };

  const pending   = posts.filter(p => p.status === "draft" || p.status === "approved");
  const needsImage = pending.filter(p => p.image_upload_recommended && !p.image_url);
  const published = posts.filter(p => p.status === "published");
  const failed    = posts.filter(p => p.status === "failed");
  const tabPosts  = tab === "pending" ? pending : tab === "needsImage" ? needsImage : tab === "published" ? published : failed;
  const approvableDrafts = pending.filter(p =>
    p.status === "draft" &&
    !(p.image_upload_recommended && !p.image_url) &&
    new Date(p.scheduled_at).getTime() > Date.now()
  );
  const charOver  = draft.content.length > 500;
  const selectedSchedule = draft.scheduled_at ? new Date(draft.scheduled_at) : null;
  const selectedScheduleIsPast = Boolean(selectedSchedule && selectedSchedule.getTime() <= Date.now());
  const minSchedule = toDatetimeLocalValue(new Date(Date.now() + 60_000));

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

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0A0A]/95 px-8 py-5 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6">
          <div>
            <p className="text-2xl font-black tracking-tight">Threads 관리</p>
            <p className="mt-1 text-[12px] font-bold text-white/30">
              대기 {pending.length} · 이미지 필요 {needsImage.length} · 발행 {published.length} · 실패 {failed.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/admin" className="px-4 py-2.5 rounded-xl text-sm font-bold text-white/50 border border-white/10">← 어드민</a>
            <button onClick={() => setShowForm(v => !v)}
              className="px-5 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: showForm ? "#333" : "#22C55E", color: showForm ? "#fff" : "#000" }}>
              {showForm ? "취소" : "+ 새 글"}
            </button>
            <label className="cursor-pointer px-5 py-2.5 rounded-xl font-bold text-sm bg-white text-black">
              {importing ? "Import..." : "CSV Import"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={importing}
                onChange={(event) => void importCsv(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>
      </header>

      {showForm && (
        <div className="border-b border-white/10 bg-[#111] px-8 py-6">
          <div className="mx-auto grid max-w-[1600px] grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)] gap-6">
            <section className="rounded-3xl border border-white/[0.07] bg-[#0D0D0D] p-5">
              <div className="relative">
                <textarea value={draft.content} onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
                  placeholder="마케팅 문구 작성..." rows={9}
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-2xl px-5 py-4 text-base leading-relaxed text-white outline-none resize-none"
                  style={{ borderColor: charOver ? "#EF4444" : undefined }} />
                <span className="absolute bottom-4 right-5 text-[11px]" style={{ color: charOver ? "#EF4444" : "#555" }}>
                  {draft.content.length}/500
                </span>
              </div>
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_340px] gap-4">
                <div
                  onDragOver={(event) => { event.preventDefault(); setDraftDragActive(true); }}
                  onDragLeave={() => setDraftDragActive(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDraftDragActive(false);
                    void uploadDraftImage(event.dataTransfer.files?.[0] ?? null);
                  }}
                  className="min-h-32 rounded-2xl border border-dashed px-5 py-5 transition-colors"
                  style={{
                    borderColor: draftDragActive ? "#22C55E" : "rgba(255,255,255,0.16)",
                    background: draftDragActive ? "rgba(34,197,94,0.08)" : "#1A1A1A",
                  }}
                >
                  {draft.image_url ? (
                    <div className="flex gap-4 items-center">
                      <div className="h-24 w-24 overflow-hidden rounded-2xl bg-black/30 border border-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={draft.image_url} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">이미지 첨부됨</p>
                        <p className="text-[11px] text-white/35 truncate">{draft.image_url}</p>
                        <button
                          type="button"
                          onClick={() => setDraft((current) => ({ ...current, image_url: "" }))}
                          className="mt-2 text-[12px] font-bold text-red-300"
                        >
                          이미지 제거
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex h-full min-h-24 cursor-pointer flex-col items-center justify-center gap-2 text-center">
                      <span className="text-sm font-bold text-white">{draftUploading ? "업로드 중..." : "사진을 드래그하거나 클릭해서 업로드"}</span>
                      <span className="text-[11px] text-white/35">JPG, PNG, WEBP · 8MB 이하</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={draftUploading}
                        onChange={(event) => void uploadDraftImage(event.target.files?.[0] ?? null)}
                      />
                    </label>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-white/40 font-bold uppercase tracking-wider">예약 시간</label>
                    <input type="datetime-local" value={draft.scheduled_at} min={minSchedule} onChange={e => setDraft(d => ({ ...d, scheduled_at: e.target.value }))}
                      className="bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none" />
                  </div>
                  <button onClick={() => void create()} disabled={charOver || selectedScheduleIsPast}
                    className="py-3 rounded-xl font-bold text-sm disabled:opacity-40"
                    style={{ background: "#22C55E", color: "#000" }}>저장</button>
                </div>
              </div>
              {selectedScheduleIsPast && (
                <p className="mt-3 text-[12px] font-bold text-red-300">
                  이미 지난 예약 시간입니다. 미래 시간으로 다시 선택해주세요.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {[{ label: "오늘 12시", h: 12, t: false }, { label: "오늘 17시", h: 17, t: false }, { label: "오늘 21시", h: 21, t: false },
                  { label: "내일 12시", h: 12, t: true }, { label: "내일 17시", h: 17, t: true }, { label: "내일 21시", h: 21, t: true }]
                  .map(({ label, h: hour, t }) => {
                    const presetDate = buildPresetDate(hour, t);
                    const presetIsPast = presetDate.getTime() <= Date.now();
                    return (
                      <button key={label} type="button" onClick={() => {
                        if (presetIsPast) {
                          toast$("이미 지난 시간입니다. 내일 시간으로 선택해주세요");
                          return;
                        }
                        setDraft(v => ({ ...v, scheduled_at: toDatetimeLocalValue(presetDate) }));
                      }} className="text-[11px] px-3 py-1.5 rounded-lg border transition-colors"
                        style={{
                          borderColor: presetIsPast ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)",
                          color: presetIsPast ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.5)",
                          background: presetIsPast ? "rgba(255,255,255,0.02)" : "transparent",
                        }}>
                        {label}{presetIsPast ? " · 지남" : ""}
                      </button>
                    );
                  })}
              </div>
              {draft.image_upload_recommended && (
                <p className="mt-3 text-[12px] font-bold text-[#FDBA74]">
                  이 문구는 이미지 필요 글로 저장됩니다. 이미지 없으면 승인 단계에서 막혀요.
                </p>
              )}
            </section>
            <aside className="rounded-3xl border border-white/[0.07] bg-[#0D0D0D] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-black text-white/65">추천 문구</p>
                  <p className="mt-1 text-[11px] text-white/25">CSV 글 기준 랜덤 복붙용</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTemplateSuggestions(buildTemplateSuggestions(posts))}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold text-white/45 hover:text-white"
                >
                  다른 문구
                </button>
              </div>
              <div className="mt-4 grid max-h-[560px] grid-cols-1 gap-2 overflow-y-auto pr-1">
                {templateSuggestions.map((tpl) => (
                  <button key={tpl.id} type="button" onClick={() => applySuggestion(tpl)}
                    className="text-left p-3 rounded-xl border border-white/10 hover:border-white/30">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-black text-white/30 uppercase tracking-wider">{tpl.tag}</span>
                      {tpl.imageRequired && (
                        <span className="rounded-full bg-[#F97316]/15 px-2 py-0.5 text-[10px] font-black text-[#FDBA74]">이미지 필요</span>
                      )}
                      {tpl.styles && tpl.styles.length > 0 && (
                        <span className="rounded-full bg-[#38BDF8]/10 px-2 py-0.5 text-[10px] font-bold text-[#7DD3FC]">
                          {tpl.styles.slice(0, 2).join(" · ")}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-white/60 leading-relaxed whitespace-pre-wrap line-clamp-2">{tpl.content}</p>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        </div>
      )}
      <div className="sticky top-[89px] z-30 border-b border-white/10 bg-[#0A0A0A]/95 px-8 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-5">
          {(["pending", "needsImage", "published", "failed"] as const).map(key => (
            <button key={key} onClick={() => setTab(key)}
              className="py-4 text-sm font-bold border-b-2 transition-colors"
              style={{ borderColor: tab === key ? "#22C55E" : "transparent", color: tab === key ? "#fff" : "#555" }}>
              {key === "pending" ? `대기(${pending.length})` : key === "needsImage" ? `이미지필요(${needsImage.length})` : key === "published" ? `발행(${published.length})` : `실패(${failed.length})`}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {tab === "pending" && approvableDrafts.length > 0 && (
              <button onClick={() => void approveAll()}
                className="px-4 py-2 rounded-xl text-[12px] font-bold"
                style={{ background: "#22C55E", color: "#000" }}>
                전체승인({approvableDrafts.length})
              </button>
            )}
            <button onClick={() => void fetchPosts(pw)} className="py-3 text-[13px] text-white/30">
              {loading ? "..." : "↻"}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-5 px-8 py-6">
        {tabPosts.length === 0 && <div className="col-span-2 py-16 text-center text-white/30 text-sm">포스트 없음</div>}
        {tabPosts.map(post => {
          const s = STATUS_STYLE[post.status];
          const busy = actionId === post.id;
          const missingRequiredImage = Boolean(post.image_upload_recommended && !post.image_url);
          const scheduledPassed = new Date(post.scheduled_at).getTime() <= Date.now();
          const isEditing = editingPostId === post.id;
          const editOver = editDraft.content.length > 500;
          const linkOn = hasStyledropLink(isEditing ? editDraft.content : post.content);
          return (
            <div key={post.id} className="bg-[#111] border border-white/[0.07] rounded-3xl p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black rounded-full px-2.5 py-0.5" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                <div className="text-right">
                  <p className="text-[11px] text-white/30">예약: {fmt(post.scheduled_at)}</p>
                  {post.published_at && <p className="text-[11px] text-white/20">발행: {fmt(post.published_at)}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {post.category && <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-white/45">{post.category}</span>}
                {post.cta_type && <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-white/45">CTA {post.cta_type}</span>}
                {post.image_upload_recommended && <span className="rounded-full bg-[#F97316]/15 px-2 py-1 text-[10px] font-bold text-[#FDBA74]">이미지 권장</span>}
                {post.status === "draft" && scheduledPassed && <span className="rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-bold text-red-300">시간 지남</span>}
                {post.recommended_styles?.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => void copyStylePrompt(style)}
                    className="rounded-full bg-[#38BDF8]/10 px-2 py-1 text-left text-[10px] font-bold text-[#7DD3FC] transition-colors hover:bg-[#38BDF8]/20"
                    title={`${style} 프롬프트 복사`}
                  >
                    {style}
                  </button>
                ))}
              </div>
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <textarea
                      value={editDraft.content}
                      onChange={(event) => setEditDraft({ content: event.target.value })}
                      rows={6}
                      className="w-full resize-none rounded-xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-sm leading-relaxed text-white outline-none"
                      style={{ borderColor: editOver ? "#EF4444" : undefined }}
                    />
                    <span className="absolute bottom-3 right-4 text-[11px]" style={{ color: editOver ? "#EF4444" : "#555" }}>
                      {editDraft.content.length}/500
                    </span>
                  </div>
                  <p className="text-[11px] text-white/30">
                    스튜디오 링크: {linkOn ? "ON" : "OFF"}
                  </p>
                </div>
              ) : (
                <p className="text-[14px] text-white/80 leading-relaxed whitespace-pre-wrap">{post.content}</p>
              )}
              {post.status !== "published" && (
                <div
                  onDragOver={(event) => { event.preventDefault(); setDraggingPostId(post.id); }}
                  onDragLeave={() => setDraggingPostId((current) => current === post.id ? null : current)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDraggingPostId(null);
                    void uploadImage(post.id, event.dataTransfer.files?.[0] ?? null);
                  }}
                  className="rounded-xl border border-dashed px-4 py-4 transition-colors"
                  style={{
                    borderColor: draggingPostId === post.id ? "#22C55E" : "rgba(255,255,255,0.14)",
                    background: draggingPostId === post.id ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.025)",
                  }}
                >
                  {post.image_url ? (
                    <div className="flex gap-3 items-center">
                      <div className="h-24 w-24 overflow-hidden rounded-xl bg-black/30 border border-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={post.image_url} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white">이미지 첨부됨</p>
                        <p className="mt-1 truncate text-[11px] text-white/35">{post.image_url}</p>
                        <p className="mt-2 text-[11px] text-white/25">교체하려면 새 이미지를 여기로 드래그하세요.</p>
                      </div>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 py-2 text-center">
                      <span className="text-sm font-bold text-white/70">
                        {uploadingId === post.id ? "업로드 중..." : "이미지를 드래그하거나 클릭해서 업로드"}
                      </span>
                      <span className="text-[11px] text-white/30">
                        {post.image_upload_recommended ? "이 글은 이미지가 있어야 승인됩니다." : "선택 사항 · JPG, PNG, WEBP"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingId === post.id || busy}
                        onChange={(event) => void uploadImage(post.id, event.target.files?.[0] ?? null)}
                      />
                    </label>
                  )}
                </div>
              )}
              {post.status === "published" && post.image_url && (
                <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={post.image_url} alt="" className="max-h-72 w-full object-cover" />
                </div>
              )}
              {post.quality_note && <p className="text-[12px] text-white/35 bg-white/[0.04] rounded-lg px-3 py-2">{post.quality_note}</p>}
              {post.error_message && <p className="text-[12px] text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{post.error_message}</p>}
              {post.status === "published" && post.thread_id && (
                <div className="border-t border-white/[0.06] pt-3">
                  <InsightsBadge postId={post.id} password={pw} />
                </div>
              )}
              {post.status !== "published" && (
                <div className="flex gap-2 pt-1 border-t border-white/[0.06]">
                  {isEditing ? (
                    <>
                      <button onClick={() => void saveEdit(post)} disabled={busy || editOver}
                        className="flex-1 rounded-xl bg-white px-3 py-2 text-[13px] font-bold text-black disabled:opacity-40">저장</button>
                      <button onClick={() => { setEditingPostId(null); setEditDraft({ content: "" }); }} disabled={busy}
                        className="rounded-xl border border-white/10 px-3 py-2 text-[13px] font-bold text-white/50 disabled:opacity-40">취소</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(post)} disabled={busy}
                        className="px-3 py-2 rounded-xl text-[13px] font-bold text-white/50 border border-white/10 disabled:opacity-40">수정</button>
                      <button onClick={() => void toggleStudioLink(post)} disabled={busy}
                        className="px-3 py-2 rounded-xl text-[13px] font-bold border border-white/10 disabled:opacity-40"
                        style={{ color: linkOn ? "#86EFAC" : "rgba(255,255,255,0.5)" }}>
                        링크 {linkOn ? "ON" : "OFF"}
                      </button>
                      {(post.status === "draft" || post.status === "approved") && (
                        <button onClick={() => void approve(post.id)} disabled={busy || (post.status === "draft" && (missingRequiredImage || scheduledPassed))}
                          className="flex-1 py-2 rounded-xl text-[13px] font-bold disabled:opacity-40"
                          style={{ background: post.status === "approved" ? "#1A1A1A" : "#22C55E", color: post.status === "approved" ? "#6B7280" : "#000", border: post.status === "approved" ? "1px solid #333" : "none" }}>
                          {post.status === "draft" && missingRequiredImage ? "이미지 필요" : post.status === "draft" && scheduledPassed ? "시간 지남" : post.status === "approved" ? "승인취소" : "✓ 승인"}
                        </button>
                      )}
                      {post.status === "approved" && (
                        <button onClick={() => void publish(post.id)} disabled={busy || missingRequiredImage}
                          className="flex-1 py-2 rounded-xl text-[13px] font-bold bg-white text-black disabled:opacity-40">
                          {missingRequiredImage ? "이미지 필요" : busy ? "발행 중..." : "지금 발행 →"}
                        </button>
                      )}
                      <button onClick={() => void del(post.id)} disabled={busy}
                        className="px-4 py-2 rounded-xl text-[13px] font-bold text-red-400 disabled:opacity-40">삭제</button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
