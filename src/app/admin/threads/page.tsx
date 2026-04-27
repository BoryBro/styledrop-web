"use client";

import { useState, useEffect } from "react";
import { MAX_THREADS_IMAGE_COUNT, parseThreadsImageUrls } from "@/lib/threads-images";

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
  image_urls: string[];
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
  image_urls: [],
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
  const now = Date.now();
  const csvSuggestions = posts
    .filter((post) =>
      post.status !== "published" &&
      post.content.trim() &&
      !(post.status === "draft" && new Date(post.scheduled_at).getTime() <= now)
    )
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
  if (!metrics) return <span className="text-[11px] text-[#9CA3AF]">로딩 중...</span>;
  return (
    <div className="flex gap-3 text-[12px]">
      <span className="text-[#6B7280]">👁 {(metrics.views ?? 0).toLocaleString()}</span>
      <span className="text-[#6B7280]">♥ {(metrics.likes ?? 0).toLocaleString()}</span>
      <span className="text-[#6B7280]">💬 {(metrics.replies ?? 0).toLocaleString()}</span>
      <span className="text-[#6B7280]">🔁 {(metrics.reposts ?? 0).toLocaleString()}</span>
    </div>
  );
}

const STORAGE_KEY = "threads_admin_pw";
const SHARED_KEY = "sd_admin_pw";
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

function toFileArray(files: FileList | File[] | null | undefined): File[] {
  if (!files) return [];
  return Array.from(files);
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
  const [nowMs, setNowMs] = useState(() => Date.now());

  const toast$ = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const h = (p: string) => ({ "Content-Type": "application/json", "x-admin-password": p });
  const getPostImageUrls = (post: ThreadsPost) => parseThreadsImageUrls(post.image_url);

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

  // 자동 로그인 (두 어드민 페이지 SSO)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(SHARED_KEY);
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

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const login = async () => {
    if (!pw) { toast$("비밀번호 입력해주세요"); return; }
    setLogging(true);
    try {
      const res = await fetch("/api/threads/queue", { headers: h(pw) });
      if (res.ok) {
        try { localStorage.setItem(STORAGE_KEY, pw); localStorage.setItem(SHARED_KEY, pw); } catch {}
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
      !(p.image_upload_recommended && getPostImageUrls(p).length === 0) &&
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

  const updatePostImages = async (id: string, imageUrls: string[]) => {
    setActionId(id);
    try {
      const res = await fetch(`/api/threads/${id}`, {
        method: "PATCH",
        headers: h(pw),
        body: JSON.stringify({ image_urls: imageUrls }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast$(`이미지 수정 실패: ${data.error}`);
        return;
      }
      await fetchPosts(pw);
      toast$("이미지 수정 완료");
    } catch {
      toast$("이미지 수정 실패");
    } finally {
      setActionId(null);
    }
  };

  const uploadImage = async (id: string, files: File[] | FileList | null) => {
    const nextFiles = toFileArray(files);
    if (!nextFiles.length) return;
    setUploadingId(id);
    try {
      const form = new FormData();
      nextFiles.forEach((file) => form.append("files", file));
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
      toast$(`${data.imageUrls?.length ?? nextFiles.length}장 기준으로 이미지 반영 완료`);
    } catch {
      toast$("이미지 업로드 실패");
    } finally {
      setUploadingId(null);
      setDraggingPostId(null);
    }
  };

  const uploadDraftImage = async (files: File[] | FileList | null) => {
    const nextFiles = toFileArray(files);
    if (!nextFiles.length) return;
    setDraftUploading(true);
    try {
      const form = new FormData();
      nextFiles.forEach((file) => form.append("files", file));
      form.append("existingUrls", JSON.stringify(draft.image_urls));
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
      setDraft((current) => ({ ...current, image_urls: data.imageUrls ?? [] }));
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
        image_urls: draft.image_urls,
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

  const isExpiredDraft = (post: ThreadsPost) =>
    post.status === "draft" && new Date(post.scheduled_at).getTime() <= nowMs;
  const pending   = posts.filter(p => (p.status === "draft" || p.status === "approved") && !isExpiredDraft(p));
  const needsImage = pending.filter((p) => p.image_upload_recommended && getPostImageUrls(p).length === 0);
  const published = posts.filter(p => p.status === "published");
  const failed    = posts.filter(p => p.status === "failed");
  const tabPosts  = tab === "pending" ? pending : tab === "needsImage" ? needsImage : tab === "published" ? published : failed;
  const approvableDrafts = pending.filter(p =>
    p.status === "draft" &&
    !(p.image_upload_recommended && getPostImageUrls(p).length === 0) &&
    new Date(p.scheduled_at).getTime() > Date.now()
  );
  const charOver  = draft.content.length > 500;
  const selectedSchedule = draft.scheduled_at ? new Date(draft.scheduled_at) : null;
  const selectedScheduleIsPast = Boolean(selectedSchedule && selectedSchedule.getTime() <= Date.now());
  const minSchedule = toDatetimeLocalValue(new Date(Date.now() + 60_000));
  const todayLabel = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  if (!authed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F5F6F8] px-6">
        <div className="w-full max-w-sm rounded-[18px] border border-[#E5E7EB] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <p className="text-[12px] font-black text-[#9CA3AF]">StyleDrop Admin</p>
        <p className="mt-1 text-2xl font-black tracking-[-0.05em] text-[#111827]">Threads 관리</p>
        <p className="mt-2 text-[13px] text-[#6B7280]">자동 발행 큐를 관리하려면 비밀번호를 입력하세요.</p>
        <input
          type="password"
          placeholder="비밀번호"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === "Enter" && void login()}
          className="mt-5 w-full rounded-md border border-[#D1D5DB] bg-white px-4 py-3 text-base text-[#111827] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#F06B35]"
        />
        <button
          onClick={() => void login()}
          disabled={logging}
          className="mt-3 w-full rounded-md bg-[#273142] py-3 text-base font-black text-white transition-colors hover:bg-[#1F2937] disabled:opacity-50"
        >
          {logging ? "확인 중..." : "로그인"}
        </button>
        {toast && (
          <p className="mt-3 text-sm font-bold text-red-500">{toast}</p>
        )}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F5F6F8] text-[#111827]">
      {toast && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-black text-[#111827] shadow-xl">
          {toast}
        </div>
      )}

      <div className="min-h-screen overflow-x-hidden">
        <aside className="hidden w-[220px] shrink-0 border-r border-[#E5E7EB] bg-[#F1F3F5] lg:fixed lg:inset-y-0 lg:flex lg:flex-col">
          <div className="border-b border-[#E5E7EB] px-5 py-5">
            <p className="text-[12px] font-bold text-[#6B7280]">StyleDrop</p>
            <p className="mt-1 text-[15px] font-black tracking-[-0.03em] text-[#111827]">관리자 콘솔</p>
            <p className="mt-1 text-[10px] font-bold text-[#9CA3AF]">Threads Queue</p>
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
            <a
              href="/admin"
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[#4B5563] transition-colors hover:bg-white/70 hover:text-[#111827]"
            >
              <span className="h-2 w-2 rounded-full bg-[#CBD5E1]" />
              <span>
                <span className="block text-[14px] font-extrabold tracking-[-0.02em]">메인 어드민</span>
                <span className="mt-0.5 block text-[11px] text-[#9CA3AF]">운영 · 지표 · 매출</span>
              </span>
            </a>
            <div className="group flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 text-left text-[#111827] shadow-sm ring-1 ring-[#E5E7EB]">
              <span className="h-2 w-2 rounded-full bg-[#F06B35]" />
              <span>
                <span className="block text-[14px] font-extrabold tracking-[-0.02em]">Threads 관리</span>
                <span className="mt-0.5 block text-[11px] text-[#6B7280]">자동 발행 큐</span>
              </span>
            </div>
            <div className="my-3 h-px bg-[#E5E7EB]" />
            <button
              onClick={() => setTab("pending")}
              className={`rounded-lg px-3 py-2 text-left text-[13px] font-bold transition-colors ${tab === "pending" ? "bg-white text-[#111827]" : "text-[#6B7280] hover:bg-white/70"}`}
            >
              대기 {pending.length}
            </button>
            <button
              onClick={() => setTab("needsImage")}
              className={`rounded-lg px-3 py-2 text-left text-[13px] font-bold transition-colors ${tab === "needsImage" ? "bg-white text-[#111827]" : "text-[#6B7280] hover:bg-white/70"}`}
            >
              이미지 필요 {needsImage.length}
            </button>
            <button
              onClick={() => setTab("published")}
              className={`rounded-lg px-3 py-2 text-left text-[13px] font-bold transition-colors ${tab === "published" ? "bg-white text-[#111827]" : "text-[#6B7280] hover:bg-white/70"}`}
            >
              발행 {published.length}
            </button>
            <button
              onClick={() => setTab("failed")}
              className={`rounded-lg px-3 py-2 text-left text-[13px] font-bold transition-colors ${tab === "failed" ? "bg-white text-[#111827]" : "text-[#6B7280] hover:bg-white/70"}`}
            >
              실패 {failed.length}
            </button>
          </nav>

          <div className="border-t border-[#E5E7EB] p-3">
            <button
              onClick={() => setShowForm(v => !v)}
              className={`mb-2 w-full rounded-md px-3 py-3 text-[13px] font-black transition-colors ${
                showForm ? "border border-[#D1D5DB] bg-white text-[#4B5563]" : "bg-[#273142] text-white hover:bg-[#1F2937]"
              }`}
            >
              {showForm ? "새 글 닫기" : "+ 새 글"}
            </button>
            <label className="block w-full cursor-pointer rounded-md border border-[#D1D5DB] bg-white px-3 py-2.5 text-center text-[12px] font-bold text-[#4B5563] transition-colors hover:text-[#111827]">
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
        </aside>

        <div className="min-h-screen min-w-0 lg:ml-[220px]">
          <header className="sticky top-0 z-40 border-b border-[#E5E7EB] bg-white">
            <div className="flex min-h-[58px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <div className="flex min-w-0 items-center gap-4">
                <span className="text-[13px] font-black text-[#111827]">Threads 관리</span>
                <div className="h-4 w-px bg-[#E5E7EB]" />
                <span className="truncate text-[13px] font-bold text-[#9CA3AF]">{todayLabel}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a href="/admin" className="rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-[12px] font-black text-[#111827] transition-colors hover:bg-[#F9FAFB]">
                  메인 어드민
                </a>
                <button onClick={() => setShowForm(v => !v)}
                  className={`rounded-md px-3 py-2 text-[12px] font-black transition-colors ${
                    showForm ? "border border-[#D1D5DB] bg-white text-[#4B5563]" : "bg-[#273142] text-white hover:bg-[#1F2937]"
                  }`}>
                  {showForm ? "취소" : "+ 새 글"}
                </button>
                <label className="cursor-pointer rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-[12px] font-black text-[#111827] transition-colors hover:bg-[#F9FAFB]">
                  {importing ? "Import..." : "CSV Import"}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    disabled={importing}
                    onChange={(event) => void importCsv(event.target.files?.[0] ?? null)}
                  />
                </label>
                <button onClick={() => void fetchPosts(pw)} className="rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-[12px] font-black text-[#111827] transition-colors hover:bg-[#F9FAFB]">
                  {loading ? "..." : "새로고침"}
                </button>
              </div>
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-[1760px] min-w-0 flex-col gap-4 px-4 py-5 lg:px-6">
            <section className="rounded-[18px] border border-[#EAECF0] bg-white px-6 py-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="mb-6 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div className="bg-white px-4 py-4">
                  <p className="text-[12px] font-black text-[#9CA3AF]">자동 발행 큐</p>
                  <h1 className="mt-1 text-[28px] font-black tracking-[-0.05em] text-[#111827]">Threads 관리</h1>
                </div>
                <p className="max-w-xl text-[13px] leading-5 text-[#6B7280]">
                  글 작성, 이미지 업로드, 승인, 예약 발행을 한 화면에서 처리합니다.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-px overflow-hidden border border-[#EEF0F2] bg-[#EEF0F2] md:grid-cols-4">
                <div className="bg-white px-4 py-4">
                  <p className="text-[12px] font-bold text-[#6B7280]">대기</p>
                  <p className="mt-2 text-[30px] font-black tracking-[-0.05em] text-[#111827] tabular-nums">{pending.length}</p>
                </div>
                <div className="bg-white px-4 py-4">
                  <p className="text-[12px] font-bold text-[#6B7280]">이미지 필요</p>
                  <p className="mt-2 text-[30px] font-black tracking-[-0.05em] text-[#F06B35] tabular-nums">{needsImage.length}</p>
                </div>
                <div className="bg-white px-4 py-4">
                  <p className="text-[12px] font-bold text-[#6B7280]">발행</p>
                  <p className="mt-2 text-[30px] font-black tracking-[-0.05em] text-[#111827] tabular-nums">{published.length}</p>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-[#6B7280]">실패</p>
                  <p className={`mt-2 text-[30px] font-black tracking-[-0.05em] tabular-nums ${failed.length > 0 ? "text-red-600" : "text-[#111827]"}`}>
                    {failed.length}
                  </p>
                </div>
              </div>
            </section>

      {showForm && (
        <section className="rounded-[18px] border border-[#EAECF0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] [&>*]:min-w-0">
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <div className="relative">
                <textarea value={draft.content} onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
                  placeholder="마케팅 문구 작성..." rows={9}
                  className="w-full resize-none rounded-xl border border-[#D1D5DB] bg-white px-5 py-4 text-base leading-relaxed text-[#111827] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#F06B35]"
                  style={{ borderColor: charOver ? "#EF4444" : undefined }} />
                <span className="absolute bottom-4 right-5 text-[11px]" style={{ color: charOver ? "#EF4444" : "#9CA3AF" }}>
                  {draft.content.length}/500
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] [&>*]:min-w-0">
                <div
                  onDragOver={(event) => { event.preventDefault(); setDraftDragActive(true); }}
                  onDragLeave={() => setDraftDragActive(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDraftDragActive(false);
                    void uploadDraftImage(event.dataTransfer.files);
                  }}
                  className="min-h-32 rounded-2xl border border-dashed px-5 py-5 transition-colors"
                  style={{
                    borderColor: draftDragActive ? "#F06B35" : "#D1D5DB",
                    background: draftDragActive ? "#FFF7F2" : "#F9FAFB",
                  }}
                >
                  {draft.image_urls.length > 0 ? (
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {draft.image_urls.map((imageUrl, index) => (
                          <div key={`${imageUrl}-${index}`} className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F3F4F6]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={imageUrl} alt="" className="h-28 w-full object-cover" />
                            <div className="flex items-center justify-between gap-2 border-t border-[#E5E7EB] bg-white px-3 py-2">
                              <span className="truncate text-[11px] font-bold text-[#6B7280]">이미지 {index + 1}</span>
                              <button
                                type="button"
                                onClick={() => setDraft((current) => ({
                                  ...current,
                                  image_urls: current.image_urls.filter((_, imageIndex) => imageIndex !== index),
                                }))}
                                className="text-[11px] font-black text-red-500"
                              >
                                제거
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-[12px] font-black text-[#4B5563] transition-colors hover:text-[#111827]">
                          {draftUploading ? "업로드 중..." : "사진 추가"}
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={draftUploading || draft.image_urls.length >= MAX_THREADS_IMAGE_COUNT}
                            onChange={(event) => void uploadDraftImage(event.target.files)}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setDraft((current) => ({ ...current, image_urls: [] }))}
                          className="rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-[12px] font-black text-red-500"
                        >
                          전체 제거
                        </button>
                        <span className="text-[11px] font-bold text-[#9CA3AF]">
                          {draft.image_urls.length}/{MAX_THREADS_IMAGE_COUNT}장
                        </span>
                      </div>
                    </div>
                  ) : (
                    <label className="flex h-full min-h-24 cursor-pointer flex-col items-center justify-center gap-2 text-center">
                      <span className="text-sm font-black text-[#111827]">{draftUploading ? "업로드 중..." : "사진을 드래그하거나 클릭해서 업로드"}</span>
                      <span className="text-[11px] text-[#9CA3AF]">JPG, PNG, WEBP · 최대 20장 · 각 8MB 이하</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={draftUploading}
                        onChange={(event) => void uploadDraftImage(event.target.files)}
                      />
                    </label>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">예약 시간</label>
                    <input type="datetime-local" value={draft.scheduled_at} min={minSchedule} onChange={e => setDraft(d => ({ ...d, scheduled_at: e.target.value }))}
                      className="rounded-md border border-[#D1D5DB] bg-white px-4 py-3 text-sm text-[#111827] outline-none transition-colors focus:border-[#F06B35]" />
                  </div>
                  <button onClick={() => void create()} disabled={charOver || selectedScheduleIsPast}
                    className="rounded-md bg-[#273142] py-3 text-sm font-black text-white transition-colors hover:bg-[#1F2937] disabled:opacity-40">저장</button>
                </div>
              </div>
              {selectedScheduleIsPast && (
                <p className="mt-3 text-[12px] font-bold text-red-500">
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
                      }} className="rounded-md border px-3 py-1.5 text-[11px] font-bold transition-colors"
                        style={{
                          borderColor: presetIsPast ? "#F3F4F6" : "#D1D5DB",
                          color: presetIsPast ? "#D1D5DB" : "#4B5563",
                          background: presetIsPast ? "#F9FAFB" : "#FFFFFF",
                        }}>
                        {label}{presetIsPast ? " · 지남" : ""}
                      </button>
                    );
                  })}
              </div>
              {draft.image_upload_recommended && (
                <p className="mt-3 text-[12px] font-bold text-[#F06B35]">
                  이 문구는 이미지 필요 글로 저장됩니다. 이미지 없으면 승인 단계에서 막혀요.
                </p>
              )}
            </section>
            <aside className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-black text-[#111827]">추천 문구</p>
                  <p className="mt-1 text-[11px] text-[#9CA3AF]">CSV 글 기준 랜덤 복붙용</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTemplateSuggestions(buildTemplateSuggestions(posts))}
                  className="rounded-md border border-[#D1D5DB] bg-white px-3 py-1.5 text-[11px] font-black text-[#4B5563] hover:text-[#111827]"
                >
                  다른 문구
                </button>
              </div>
              <div className="mt-4 grid max-h-[560px] grid-cols-1 gap-2 overflow-y-auto pr-1 2xl:grid-cols-2">
                {templateSuggestions.map((tpl) => (
                  <button key={tpl.id} type="button" onClick={() => applySuggestion(tpl)}
                    className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-left transition-colors hover:border-[#F06B35]">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#9CA3AF]">{tpl.tag}</span>
                      {tpl.imageRequired && (
                        <span className="rounded-full bg-[#FFF1E8] px-2 py-0.5 text-[10px] font-black text-[#F06B35]">이미지 필요</span>
                      )}
                      {tpl.styles && tpl.styles.length > 0 && (
                        <span className="rounded-full bg-[#EAF6FF] px-2 py-0.5 text-[10px] font-bold text-[#0369A1]">
                          {tpl.styles.slice(0, 2).join(" · ")}
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 whitespace-pre-wrap text-[12px] leading-relaxed text-[#4B5563]">{tpl.content}</p>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        </section>
      )}
      <section className="rounded-[18px] border border-[#EAECF0] bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-2">
          {(["pending", "needsImage", "published", "failed"] as const).map(key => (
            <button key={key} onClick={() => setTab(key)}
              className={`rounded-md px-4 py-2.5 text-sm font-black transition-colors ${
                tab === key ? "bg-[#273142] text-white" : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
              }`}>
              {key === "pending" ? `대기(${pending.length})` : key === "needsImage" ? `이미지필요(${needsImage.length})` : key === "published" ? `발행(${published.length})` : `실패(${failed.length})`}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {tab === "pending" && approvableDrafts.length > 0 && (
              <button onClick={() => void approveAll()}
                className="rounded-md bg-[#6ED26A] px-4 py-2 text-[12px] font-black text-[#111827] transition-opacity hover:opacity-90">
                전체 승인({approvableDrafts.length})
              </button>
            )}
            <button onClick={() => void fetchPosts(pw)} className="rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-[12px] font-black text-[#4B5563] transition-colors hover:text-[#111827]">
              {loading ? "..." : "↻"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[repeat(auto-fit,minmax(300px,1fr))] [&>*]:min-w-0">
        {tabPosts.length === 0 && <div className="py-16 text-center text-sm font-bold text-[#9CA3AF] xl:col-span-2">포스트 없음</div>}
        {tabPosts.map(post => {
          const s = STATUS_STYLE[post.status];
          const busy = actionId === post.id;
          const postImageUrls = getPostImageUrls(post);
          const missingRequiredImage = Boolean(post.image_upload_recommended && postImageUrls.length === 0);
          const scheduledPassed = new Date(post.scheduled_at).getTime() <= Date.now();
          const isEditing = editingPostId === post.id;
          const editOver = editDraft.content.length > 500;
          const linkOn = hasStyledropLink(isEditing ? editDraft.content : post.content);
          return (
            <div key={post.id} className="flex flex-col gap-3 rounded-xl border border-[#EAECF0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black rounded-full px-2.5 py-0.5" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                <div className="text-right">
                  <p className="text-[11px] text-[#6B7280]">예약: {fmt(post.scheduled_at)}</p>
                  {post.published_at && <p className="text-[11px] text-[#9CA3AF]">발행: {fmt(post.published_at)}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {post.category && <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] font-bold text-[#6B7280]">{post.category}</span>}
                {post.cta_type && <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] font-bold text-[#6B7280]">CTA {post.cta_type}</span>}
                {post.image_upload_recommended && <span className="rounded-full bg-[#FFF1E8] px-2 py-1 text-[10px] font-bold text-[#F06B35]">이미지 권장</span>}
                {post.status === "draft" && scheduledPassed && <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">시간 지남</span>}
                {post.recommended_styles?.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => void copyStylePrompt(style)}
                    className="rounded-full bg-[#EAF6FF] px-2 py-1 text-left text-[10px] font-bold text-[#0369A1] transition-colors hover:bg-[#DFF0FF]"
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
                      className="w-full resize-none rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-sm leading-relaxed text-[#111827] outline-none transition-colors focus:border-[#F06B35]"
                      style={{ borderColor: editOver ? "#EF4444" : undefined }}
                    />
                    <span className="absolute bottom-3 right-4 text-[11px]" style={{ color: editOver ? "#EF4444" : "#9CA3AF" }}>
                      {editDraft.content.length}/500
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9CA3AF]">
                    스튜디오 링크: {linkOn ? "ON" : "OFF"}
                  </p>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#111827]">{post.content}</p>
              )}
              {post.status !== "published" && (
                <div
                  onDragOver={(event) => { event.preventDefault(); setDraggingPostId(post.id); }}
                  onDragLeave={() => setDraggingPostId((current) => current === post.id ? null : current)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDraggingPostId(null);
                    void uploadImage(post.id, event.dataTransfer.files);
                  }}
                  className="rounded-xl border border-dashed px-4 py-4 transition-colors"
                  style={{
                    borderColor: draggingPostId === post.id ? "#F06B35" : "#D1D5DB",
                    background: draggingPostId === post.id ? "#FFF7F2" : "#F9FAFB",
                  }}
                >
                  {postImageUrls.length > 0 ? (
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {postImageUrls.map((imageUrl, index) => (
                          <div key={`${imageUrl}-${index}`} className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F3F4F6]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={imageUrl} alt="" className="h-28 w-full object-cover" />
                            <div className="flex items-center justify-between gap-2 border-t border-[#E5E7EB] bg-white px-3 py-2">
                              <span className="truncate text-[11px] font-bold text-[#6B7280]">이미지 {index + 1}</span>
                              <button
                                type="button"
                                onClick={() => void updatePostImages(post.id, postImageUrls.filter((_, imageIndex) => imageIndex !== index))}
                                className="text-[11px] font-black text-red-500"
                              >
                                제거
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-[12px] font-black text-[#4B5563] transition-colors hover:text-[#111827]">
                          {uploadingId === post.id ? "업로드 중..." : "사진 추가"}
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={uploadingId === post.id || busy || postImageUrls.length >= MAX_THREADS_IMAGE_COUNT}
                            onChange={(event) => void uploadImage(post.id, event.target.files)}
                          />
                        </label>
                        <span className="text-[11px] font-bold text-[#9CA3AF]">
                          {postImageUrls.length}/{MAX_THREADS_IMAGE_COUNT}장
                        </span>
                        <span className="text-[11px] text-[#9CA3AF]">추가 업로드 시 뒤에 이어 붙습니다.</span>
                      </div>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 py-2 text-center">
                      <span className="text-sm font-black text-[#111827]">
                        {uploadingId === post.id ? "업로드 중..." : "이미지를 드래그하거나 클릭해서 업로드"}
                      </span>
                      <span className="text-[11px] text-[#9CA3AF]">
                        {post.image_upload_recommended ? "이 글은 이미지가 있어야 승인됩니다." : "선택 사항 · JPG, PNG, WEBP"} · 최대 20장
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={uploadingId === post.id || busy}
                        onChange={(event) => void uploadImage(post.id, event.target.files)}
                      />
                    </label>
                  )}
                </div>
              )}
              {post.status === "published" && postImageUrls.length > 0 && (
                <div className="grid grid-cols-2 gap-3 overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-3 sm:grid-cols-3">
                  {postImageUrls.map((imageUrl, index) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={`${imageUrl}-${index}`} src={imageUrl} alt="" className="h-40 w-full rounded-lg object-cover" />
                  ))}
                </div>
              )}
              {post.quality_note && <p className="rounded-lg bg-[#F9FAFB] px-3 py-2 text-[12px] text-[#6B7280]">{post.quality_note}</p>}
              {post.error_message && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">{post.error_message}</p>}
              {post.status === "published" && post.thread_id && (
                <div className="border-t border-[#E5E7EB] pt-3">
                  <InsightsBadge postId={post.id} password={pw} />
                </div>
              )}
              {post.status !== "published" && (
                <div className="flex flex-wrap gap-2 border-t border-[#E5E7EB] pt-3">
                  {isEditing ? (
                    <>
                      <button onClick={() => void saveEdit(post)} disabled={busy || editOver}
                        className="flex-1 rounded-md bg-[#273142] px-3 py-2 text-[13px] font-black text-white disabled:opacity-40">저장</button>
                      <button onClick={() => { setEditingPostId(null); setEditDraft({ content: "" }); }} disabled={busy}
                        className="rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-[13px] font-black text-[#4B5563] disabled:opacity-40">취소</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(post)} disabled={busy}
                        className="rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-[13px] font-black text-[#4B5563] disabled:opacity-40">수정</button>
                      <button onClick={() => void toggleStudioLink(post)} disabled={busy}
                        className="rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-[13px] font-black disabled:opacity-40"
                        style={{ color: linkOn ? "#15803D" : "#4B5563" }}>
                        링크 {linkOn ? "ON" : "OFF"}
                      </button>
                      {(post.status === "draft" || post.status === "approved") && (
                        <button onClick={() => void approve(post.id)} disabled={busy || (post.status === "draft" && (missingRequiredImage || scheduledPassed))}
                          className="flex-1 rounded-md py-2 text-[13px] font-black disabled:opacity-40"
                          style={{ background: post.status === "approved" ? "#F3F4F6" : "#6ED26A", color: post.status === "approved" ? "#6B7280" : "#111827", border: post.status === "approved" ? "1px solid #D1D5DB" : "none" }}>
                          {post.status === "draft" && missingRequiredImage ? "이미지 필요" : post.status === "draft" && scheduledPassed ? "시간 지남" : post.status === "approved" ? "승인취소" : "✓ 승인"}
                        </button>
                      )}
                      {post.status === "approved" && (
                        <button onClick={() => void publish(post.id)} disabled={busy || missingRequiredImage}
                          className="flex-1 rounded-md bg-[#273142] py-2 text-[13px] font-black text-white disabled:opacity-40">
                          {missingRequiredImage ? "이미지 필요" : busy ? "발행 중..." : "지금 발행 →"}
                        </button>
                      )}
                      <button onClick={() => void del(post.id)} disabled={busy}
                        className="rounded-md px-4 py-2 text-[13px] font-black text-red-500 disabled:opacity-40">삭제</button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
          </div>
        </div>
      </div>
    </main>
  );
}
