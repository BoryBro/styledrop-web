"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { trackClientEvent } from "@/lib/client-events";

// ── 팔레트 ────────────────────────────────────────────────────────
const G = { bg: "#F0FDF4", border: "#BBF7D0", light: "#DCFCE7", mid: "#22C55E", dark: "#16A34A", text: "#15803D", deep: "#166534" } as const;

// ── 타입 ─────────────────────────────────────────────────────────
type Step = "intro" | "setup" | "link" | "waiting" | "respondent-name" | "questions" | "results" | "single-result";
type AnsMap = Record<string, string | number>;
type NaboRoomViewPayload = {
  roomCode: string;
  role: "owner" | "respondent";
  ownerName: string;
  responseCount: number;
  responseTarget: number;
  resultAvailableAfter: string;
  canViewResults: boolean;
  premiumAccess: boolean;
  invitePath: string | null;
  ownerPath: string | null;
};

type KakaoShareSDK = {
  init?: (key: string | undefined) => void;
  isInitialized?: () => boolean;
  Share?: {
    sendDefault?: (options: {
      objectType: "text";
      text: string;
      link: {
        mobileWebUrl: string;
        webUrl: string;
      };
    }) => void;
  };
};

const LOCK_MS = 24 * 60 * 60 * 1000;
const BASIC_RESULT_COUNT = 3;
const FULL_RESULT_COUNT = 5;
const EARLY_RESULT_CREDIT_COST = 2;
const RESPONDENT_NAME_KEY = "_respondentName";
const SPACE_STARS = [
  ["7%", "9%", 2, "rgba(186,230,253,0.85)"],
  ["18%", "24%", 3, "rgba(125,211,252,0.7)"],
  ["29%", "13%", 2, "rgba(255,255,255,0.75)"],
  ["41%", "31%", 2, "rgba(196,181,253,0.8)"],
  ["58%", "11%", 3, "rgba(165,243,252,0.75)"],
  ["72%", "27%", 2, "rgba(255,255,255,0.7)"],
  ["88%", "8%", 2, "rgba(147,197,253,0.8)"],
  ["12%", "53%", 2, "rgba(216,180,254,0.75)"],
  ["33%", "68%", 3, "rgba(186,230,253,0.75)"],
  ["63%", "60%", 2, "rgba(255,255,255,0.7)"],
  ["83%", "77%", 3, "rgba(125,211,252,0.7)"],
  ["94%", "48%", 2, "rgba(196,181,253,0.75)"],
] as const;

// ── 15문항 정의 ───────────────────────────────────────────────────
const QS = [
  {
    id: "q0", emoji: "👀", short: "첫인상",
    text: (n: string) => `${n}의 첫인상은?`,
    type: "choice" as const,
    options: [
      "따뜻하고 편해 보여",
      "밝고 에너지 있어 보여",
      "조용하고 신비로워 보여",
      "시크하고 거리감 있어 보여",
      "까칠하고 예민해 보여",
      "싸가지 없어 보이는데 끌려",
      "웃기고 가벼워 보여",
      "똑똑하고 눈치 빨라 보여",
      "자기 세계가 강해 보여",
      "은근 만만치 않아 보여",
    ],
  },
  {
    id: "q1", emoji: "💎", short: "핵심 매력",
    text: (n: string) => `${n}의 가장 강한 매력은?`,
    type: "choice" as const,
    options: [
      "외모 / 스타일",
      "말솜씨 / 유머감각",
      "배려심 / 따뜻함",
      "능력 / 실력",
      "자신감 / 존재감",
      "순수함 / 솔직함",
      "재력 / 여유",
      "센스 / 눈치",
      "분위기 / 아우라",
      "성실함 / 책임감",
    ],
  },
  {
    id: "q2", emoji: "😅", short: "아쉬운 점",
    text: (n: string) => `솔직히 ${n}의 은근 거슬리는 점은?`,
    type: "choice" as const,
    options: [
      "말투가 가끔 날카로워",
      "감정 표현이 적어서 헷갈려",
      "자기 기준이 너무 강해",
      "답장이 느린 편이야",
      "장난이 가끔 선을 넘어",
      "생각보다 고집이 세",
      "괜찮다면서 티가 나",
      "관심 없는 척을 많이 해",
      "급할 때 주변을 못 봐",
      "딱히 크게 거슬리는 건 없어",
    ],
  },
  {
    id: "q3", emoji: "🎯", short: "케미 점수",
    text: (n: string) => `나와 ${n}의 케미 점수는?`,
    type: "slider" as const,
    labels: ["전혀 안 맞아", "완벽한 케미"] as [string, string],
  },
  {
    id: "q4", emoji: "🌟", short: "의외의 매력",
    text: (n: string) => `${n}이 모르는 자신의 의외의 매력은?`,
    type: "choice" as const,
    options: [
      "생각보다 다정한 순간이 있어",
      "말없이 챙기는 게 보여",
      "진지할 때 분위기가 달라져",
      "은근 허당인 점이 귀여워",
      "혼자 있을 때 멋있어 보여",
      "상대 기분을 잘 읽어",
      "자기 일에 집중할 때 매력 있어",
      "웃을 때 분위기가 풀려",
      "기대보다 훨씬 솔직해",
      "작은 디테일을 기억해",
    ],
  },
  {
    id: "q5", emoji: "😤", short: "화낼 때",
    text: (n: string) => `${n}이 화가 났을 때 어떨 것 같아?`,
    type: "choice" as const,
    options: [
      "혼자 조용히 삭히는 타입",
      "바로 직접 말하는 타입",
      "냉랭하게 거리 두는 타입",
      "표정만으로 다 티나는 타입",
      "한참 후에 한 번에 터지는 타입",
      "말수부터 확 줄어드는 타입",
      "농담처럼 돌려 말하는 타입",
      "상대가 사과할 때까지 기다리는 타입",
      "금방 풀리지만 티는 내는 타입",
      "논리로 끝까지 따지는 타입",
    ],
  },
  {
    id: "q6", emoji: "💘", short: "연애 스타일",
    text: (n: string) => `${n}의 연애 스타일은?`,
    type: "choice" as const,
    options: [
      "다정다감한 표현형",
      "묵묵히 챙겨주는 행동형",
      "자유롭고 쿨한 독립형",
      "올인하는 열정형",
      "친구처럼 편한 연애형",
      "밀당에 은근 강한 타입",
      "표현은 적지만 깊은 타입",
      "상대에게 맞춰주는 타입",
      "자존심 때문에 늦게 다가가는 타입",
      "아직 잘 모르겠어",
    ],
  },
  {
    id: "q7", emoji: "😂", short: "재미 지수",
    text: (n: string) => `솔직히 ${n}의 재미 지수는?`,
    type: "slider" as const,
    labels: ["개노잼", "개꿀잼"] as [string, string],
  },
  {
    id: "q8", emoji: "🧭", short: "관계 포지션",
    text: (n: string) => `${n}은 사람들 사이에서 어떤 포지션이야?`,
    type: "choice" as const,
    options: [
      "분위기를 살리는 사람",
      "조용히 중심을 잡는 사람",
      "은근 모두를 챙기는 사람",
      "필요할 때 딱 나타나는 사람",
      "장난으로 긴장을 푸는 사람",
      "한마디가 꽤 센 사람",
      "기억에 오래 남는 사람",
      "알수록 편해지는 사람",
      "쉽게 다가가기 어려운 사람",
      "없으면 허전한 사람",
    ],
  },
  {
    id: "q9", emoji: "🐾", short: "동물 유형",
    text: (n: string) => `${n}을 동물에 비유하면?`,
    type: "choice" as const,
    options: [
      "강아지", "고양이", "토끼", "여우", "사자",
      "호랑이", "곰", "늑대", "사슴", "말",
      "펭귄", "고래", "돌고래", "판다", "코알라",
      "부엉이", "독수리", "햄스터", "수달", "고슴도치",
      "알파카", "양", "치타", "기린", "다람쥐",
    ],
  },
  {
    id: "q10", emoji: "🎭", short: "드라마 캐릭터",
    text: (n: string) => `드라마 속 ${n}은 어떤 유형이야?`,
    type: "choice" as const,
    options: [
      "주인공형",
      "서브 주인공형",
      "빌런인데 인기 많은 형",
      "힐링 담당형",
      "미스터리형",
      "겉차속따형",
      "성장 서사형",
      "분위기 메이커형",
      "천재 조력자형",
      "마지막에 반전 주는 형",
    ],
  },
  {
    id: "q11", emoji: "💫", short: "친밀도",
    text: (n: string) => `${n}와 나의 친밀도는?`,
    type: "slider" as const,
    labels: ["거의 모르는 사이", "평생 찐친"] as [string, string],
  },
  {
    id: "q12", emoji: "💕", short: "연애 가능성",
    text: (n: string) => `${n}이 이성이었다면, 사귈 수 있어?`,
    type: "slider" as const,
    labels: ["절대 아님", "바로 가능"] as [string, string],
    step: 25,
    marks: ["절대 아님", "아마 어려워", "모르겠어", "꽤 가능", "바로 가능"],
  },
  {
    id: "q13", emoji: "🪞", short: "기억 방식",
    text: (n: string) => `사람들은 ${n}을 어떤 사람으로 기억할까?`,
    type: "choice" as const,
    options: [
      "계속 생각나는 사람",
      "편해서 다시 찾는 사람",
      "말보다 행동이 남는 사람",
      "첫인상보다 오래 괜찮은 사람",
      "가끔 문득 궁금한 사람",
      "친해질수록 다른 사람",
      "분위기 자체가 선명한 사람",
      "속을 알기 어려운 사람",
      "자기 색이 확실한 사람",
      "한 번쯤 더 보고 싶은 사람",
    ],
  },
  {
    id: "q14", emoji: "💬", short: "10글자 한마디",
    text: (n: string) => `10글자로 ${n}에게 한마디한다면?`,
    type: "text" as const,
    placeholder: "10글자 안으로만",
    maxLength: 10,
  },
];

// ── 시뮬레이션 응답 5개 ───────────────────────────────────────────
const MOCK: AnsMap[] = [
  { q0: "밝고 에너지 있어 보여", q1: "말솜씨 / 유머감각", q2: "장난이 가끔 선을 넘어", q3: 82, q4: "웃을 때 분위기가 풀려", q5: "혼자 조용히 삭히는 타입", q6: "묵묵히 챙겨주는 행동형", q7: 88, q8: "분위기를 살리는 사람", q9: "강아지", q10: "주인공형", q11: 78, q12: 75, q13: "계속 생각나는 사람", q14: "늘응원해" },
  { q0: "따뜻하고 편해 보여", q1: "배려심 / 따뜻함", q2: "괜찮다면서 티가 나", q3: 91, q4: "말없이 챙기는 게 보여", q5: "표정만으로 다 티나는 타입", q6: "다정다감한 표현형", q7: 74, q8: "은근 모두를 챙기는 사람", q9: "판다", q10: "힐링 담당형", q11: 88, q12: 50, q13: "편해서 다시 찾는 사람", q14: "편해서좋아" },
  { q0: "은근 만만치 않아 보여", q1: "센스 / 눈치", q2: "생각보다 고집이 세", q3: 76, q4: "진지할 때 분위기가 달라져", q5: "바로 직접 말하는 타입", q6: "자유롭고 쿨한 독립형", q7: 95, q8: "한마디가 꽤 센 사람", q9: "여우", q10: "빌런인데 인기 많은 형", q11: 82, q12: 25, q13: "자기 색이 확실한 사람", q14: "계속웃자" },
  { q0: "조용하고 신비로워 보여", q1: "순수함 / 솔직함", q2: "감정 표현이 적어서 헷갈려", q3: 68, q4: "기대보다 훨씬 솔직해", q5: "냉랭하게 거리 두는 타입", q6: "표현은 적지만 깊은 타입", q7: 72, q8: "알수록 편해지는 사람", q9: "고양이", q10: "미스터리형", q11: 65, q12: 50, q13: "친해질수록 다른 사람", q14: "더친해지자" },
  { q0: "시크하고 거리감 있어 보여", q1: "자신감 / 존재감", q2: "자기 기준이 너무 강해", q3: 74, q4: "자기 일에 집중할 때 매력 있어", q5: "논리로 끝까지 따지는 타입", q6: "올인하는 열정형", q7: 80, q8: "기억에 오래 남는 사람", q9: "늑대", q10: "마지막에 반전 주는 형", q11: 70, q12: 75, q13: "분위기 자체가 선명한 사람", q14: "고마운사람" },
];

// ── 집계 ─────────────────────────────────────────────────────────
const avg = (key: string, rs: AnsMap[]) => {
  const ns = rs
    .map(r => r[key])
    .filter(v => typeof v !== "undefined" && v !== "")
    .map(v => Number(v))
    .filter(n => !isNaN(n));
  return ns.length ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : 0;
};
const top = (key: string, rs: AnsMap[]) => {
  const cnt: Record<string, number> = {};
  rs.forEach(r => { const v = String(r[key] || ""); if (v) cnt[v] = (cnt[v] || 0) + 1; });
  return Object.entries(cnt).sort((a, b) => b[1] - a[1]);
};
const texts = (key: string, rs: AnsMap[]) => rs.map(r => String(r[key] || "")).filter(Boolean);

// ── 시간 포맷 ─────────────────────────────────────────────────────
const fmtCountdown = (ms: number) => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const getNaboClientFingerprint = () => {
  if (typeof window === "undefined") return "";

  const saved = localStorage.getItem("nabo_client_fingerprint");
  if (saved) return saved;

  const next = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem("nabo_client_fingerprint", next);
  return next;
};

const getRespondentNameStorageKey = (roomCode: string) => `nabo_respondent_name:${roomCode}`;
const getRespondedStorageKey = (roomCode: string) => `nabo_responded:${roomCode}`;
const getRespondentName = (answer: AnsMap | null | undefined, index: number) => {
  const savedName = typeof answer?.[RESPONDENT_NAME_KEY] === "string" ? String(answer[RESPONDENT_NAME_KEY]).trim() : "";
  return savedName || `익명 ${index + 1}`;
};

// ── ScoreRing ─────────────────────────────────────────────────────
function ScoreRing({ score, size = 130, color = G.mid }: { score: number; size?: number; color?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let c = 0; const step = score / 60;
    const t = setInterval(() => { c = Math.min(c + step, score); setShown(Math.round(c)); if (c >= score) clearInterval(t); }, 16);
    return () => clearInterval(t);
  }, [score]);
  const R = size * 0.37; const circ = 2 * Math.PI * R; const cx = size / 2;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={R} fill="none" stroke="#E5E7EB" strokeWidth="9" />
        <circle cx={cx} cy={cx} r={R} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - (shown / 100) * circ} transform={`rotate(-90 ${cx} ${cx})`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black text-gray-900 leading-none" style={{ fontSize: size * 0.26 }}>{shown}</span>
        <span className="font-bold text-gray-400" style={{ fontSize: size * 0.09 }}>/ 100</span>
      </div>
    </div>
  );
}

// ── BarRow ────────────────────────────────────────────────────────
function BarRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[12px]">
        <span className="font-semibold text-gray-700">{label}</span>
        <span className="font-black" style={{ color: G.mid }}>{count}명 ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: G.mid, transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

function PixelSpaceBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(rgba(125,211,252,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,0.09) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-72"
        style={{
          background:
            "linear-gradient(180deg, rgba(37,99,235,0.34) 0%, rgba(15,23,42,0.12) 54%, transparent 100%)",
        }}
      />
      {SPACE_STARS.map(([left, top, size, color], index) => (
        <span
          key={`${left}-${top}-${index}`}
          className="absolute block"
          style={{ left, top, width: size, height: size, background: color, boxShadow: `0 0 ${size * 5}px ${color}` }}
        />
      ))}
      <div className="absolute -right-16 top-24 h-52 w-52 border border-cyan-300/10" />
      <div className="absolute left-8 top-28 h-10 w-10 border border-violet-300/20" />
      <div className="absolute bottom-10 left-1/2 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-200/25 to-transparent" />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Main
// ═════════════════════════════════════════════════════════════════
export default function NaboPage() {
  const { user, loading: authLoading, login } = useAuth();
  const [step, setStep]               = useState<Step>("intro");
  const [stepHistory, setStepHistory] = useState<Step[]>(["intro"]);
  const [myName, setMyName]           = useState("");
  const [respondentName, setRespondentName] = useState("");
  const [agreed, setAgreed]           = useState(false);
  const [copied, setCopied]           = useState(false);
  const [createdAt, setCreatedAt]     = useState<number>(0);
  const [responses, setResponses]     = useState<AnsMap[]>([]);
  const [qIdx, setQIdx]               = useState(0);
  const [curAns, setCurAns]           = useState<string | number>("");
  const [slider, setSlider]           = useState(50);
  const [curResp, setCurResp]         = useState<AnsMap>({});
  const [now, setNow]                 = useState(Date.now());
  const [roomCode, setRoomCode]       = useState("");
  const [ownerToken, setOwnerToken]   = useState("");
  const [respondentToken, setRespondentToken] = useState("");
  const [viewerRole, setViewerRole]   = useState<"owner" | "respondent" | null>(null);
  const [invitePath, setInvitePath]   = useState("");
  const [shareOrigin, setShareOrigin] = useState("https://www.styledrop.cloud");
  const [resultAvailableAfter, setResultAvailableAfter] = useState("");
  const [serverResponseCount, setServerResponseCount] = useState(0);
  const [serverAnswers, setServerAnswers] = useState<AnsMap[]>([]);
  const [premiumAccess, setPremiumAccess] = useState(false);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState(0);
  const [isFetchingAnswers, setIsFetchingAnswers] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [isSharingKakao, setIsSharingKakao] = useState(false);
  const [isUnlockingEarly, setIsUnlockingEarly] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const handleLogin = useCallback(() => {
    if (typeof window === "undefined") {
      login("/nabo");
      return;
    }
    login(`${window.location.pathname}${window.location.search}`);
  }, [login]);

  const applyRoomView = useCallback((
    view: NaboRoomViewPayload,
    tokens?: { ownerToken?: string | null; respondentToken?: string | null; invitePath?: string | null },
  ) => {
    setRoomCode(view.roomCode);
    setViewerRole(view.role);
    setMyName(view.ownerName);
    setServerResponseCount(view.responseCount);
    setResultAvailableAfter(view.resultAvailableAfter);
    setPremiumAccess(view.premiumAccess);
    if (tokens && "ownerToken" in tokens) setOwnerToken(tokens.ownerToken ?? "");
    if (tokens && "respondentToken" in tokens) setRespondentToken(tokens.respondentToken ?? "");
    if (tokens && "invitePath" in tokens) setInvitePath(tokens.invitePath ?? "");

    try {
      localStorage.setItem("nabo_room_code", view.roomCode);
      localStorage.setItem("nabo_name", view.ownerName);
      localStorage.setItem("nabo_result_available_after", view.resultAvailableAfter);
      if (tokens && "ownerToken" in tokens) {
        tokens.ownerToken ? localStorage.setItem("nabo_owner_token", tokens.ownerToken) : localStorage.removeItem("nabo_owner_token");
      }
      if (tokens && "respondentToken" in tokens) {
        tokens.respondentToken ? localStorage.setItem("nabo_respondent_token", tokens.respondentToken) : localStorage.removeItem("nabo_respondent_token");
      }
      if (tokens && "invitePath" in tokens) {
        tokens.invitePath ? localStorage.setItem("nabo_invite_path", tokens.invitePath) : localStorage.removeItem("nabo_invite_path");
      }
    } catch {}
  }, []);

  // ── 1초 ticker ───────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareOrigin(window.location.origin);
    }
  }, []);

  // ── localStorage 복원 ─────────────────────────────────────────
  useEffect(() => {
    try {
      const n  = localStorage.getItem("nabo_name");
      const at = localStorage.getItem("nabo_created_at");
      const rs = localStorage.getItem("nabo_responses");
      const st = localStorage.getItem("nabo_step") as Step | null;
      const savedRoomCode = localStorage.getItem("nabo_room_code");
      const savedOwnerToken = localStorage.getItem("nabo_owner_token");
      const savedRespondentToken = localStorage.getItem("nabo_respondent_token");
      const savedInvitePath = localStorage.getItem("nabo_invite_path");
      const savedAvailableAfter = localStorage.getItem("nabo_result_available_after");
      if (n)  setMyName(n);
      if (at) setCreatedAt(Number(at));
      if (rs) { try { setResponses(JSON.parse(rs)); } catch {} }
      if (savedRoomCode) setRoomCode(savedRoomCode);
      if (savedOwnerToken) setOwnerToken(savedOwnerToken);
      if (savedRespondentToken) setRespondentToken(savedRespondentToken);
      if (savedInvitePath) setInvitePath(savedInvitePath);
      if (savedAvailableAfter) setResultAvailableAfter(savedAvailableAfter);
      if (savedRoomCode && savedOwnerToken) {
        setViewerRole("owner");
        setStep("waiting");
        setStepHistory(["intro", "waiting"]);
      } else if (st && st !== "intro") {
        setStep(st);
        setStepHistory(["intro", st]);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const nextRoomCode = params.get("room");
    const nextOwnerToken = params.get("owner");
    const nextRespondentToken = params.get("token");

    if (!nextRoomCode) return;

    const query = nextOwnerToken
      ? `owner=${encodeURIComponent(nextOwnerToken)}`
      : nextRespondentToken
        ? `token=${encodeURIComponent(nextRespondentToken)}`
        : "";

    let cancelled = false;

    fetch(`/api/nabo/room/${encodeURIComponent(nextRoomCode)}${query ? `?${query}` : ""}`)
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error ?? "방 정보를 불러오지 못했습니다.");
        return payload as { view?: NaboRoomViewPayload };
      })
      .then(payload => {
        if (cancelled || !payload.view) return;
        applyRoomView(payload.view, {
          ownerToken: nextOwnerToken,
          respondentToken: nextRespondentToken,
          invitePath: payload.view.invitePath,
        });
        if (payload.view.role === "owner") {
          setStep("waiting");
          setStepHistory(["intro", "waiting"]);
          return;
        }

        const savedName = localStorage.getItem(getRespondentNameStorageKey(payload.view.roomCode)) ?? "";
        const alreadyResponded = localStorage.getItem(getRespondedStorageKey(payload.view.roomCode)) === "1";
        if (savedName) setRespondentName(savedName);
        const nextStep: Step = alreadyResponded ? "waiting" : savedName ? "questions" : "respondent-name";
        setStep(nextStep);
        setStepHistory(["intro", nextStep]);
      })
      .catch(error => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "방 정보를 불러오지 못했습니다.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyRoomView]);

  useEffect(() => {
    if (!roomCode || viewerRole !== "owner") return;

    let cancelled = false;
    const refreshOwnerRoom = () => {
      const query = ownerToken ? `?owner=${encodeURIComponent(ownerToken)}` : "";
      fetch(`/api/nabo/room/${encodeURIComponent(roomCode)}${query}`)
        .then(async response => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload?.error ?? "방 정보를 불러오지 못했습니다.");
          return payload as { view?: NaboRoomViewPayload };
        })
        .then(payload => {
          if (cancelled || !payload.view) return;
          applyRoomView(payload.view, {
            ownerToken,
            invitePath: payload.view.invitePath,
          });
        })
        .catch(() => {});
    };

    refreshOwnerRoom();
    const timer = window.setInterval(refreshOwnerRoom, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applyRoomView, ownerToken, roomCode, viewerRole]);

  // ── 응답 저장 ─────────────────────────────────────────────────
  useEffect(() => {
    if (responses.length > 0) {
      try { localStorage.setItem("nabo_responses", JSON.stringify(responses)); } catch {}
    }
  }, [responses]);

  const responseCount = serverResponseCount;
  const resultAvailableTime = resultAvailableAfter
    ? new Date(resultAvailableAfter).getTime()
    : createdAt
      ? createdAt + LOCK_MS
      : 0;
  const timeLeft = resultAvailableTime ? Math.max(0, resultAvailableTime - now) : LOCK_MS;
  const hasBasicResult = serverResponseCount >= BASIC_RESULT_COUNT;
  const hasFullResult = serverResponseCount >= FULL_RESULT_COUNT;
  const canShowFullResult = premiumAccess || hasFullResult;
  const canSeeResults = hasBasicResult || (premiumAccess && serverResponseCount >= 1);
  const canStartNewRoom = !roomCode || timeLeft === 0;
  const canUnlockEarly = viewerRole === "owner" && serverResponseCount > 0 && serverResponseCount < BASIC_RESULT_COUNT && !premiumAccess;
  const hasGeneratedOwnerRoom = viewerRole === "owner" && Boolean(roomCode);
  const inviteLink = invitePath ? `${shareOrigin}${invitePath}` : `${shareOrigin}/nabo`;
  const isSpaceTheme = step === "link" || step === "waiting";

  const goTo = useCallback((s: Step) => {
    setStepHistory(h => [...h, s]);
    setStep(s);
    try { localStorage.setItem("nabo_step", s); } catch {}
  }, []);

  const goBack = () => {
    const h = [...stepHistory];
    h.pop();
    const prev = h[h.length - 1] ?? "intro";
    setStepHistory(h);
    setStep(prev);
  };

  const handleReset = () => {
    ["nabo_name","nabo_created_at","nabo_responses","nabo_step","nabo_room_code",
     "nabo_owner_token","nabo_respondent_token","nabo_invite_path",
     "nabo_result_available_after"].forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/nabo");
    }
    setStep("intro");
    setStepHistory(["intro"]);
    setMyName("");
    setRespondentName("");
    setAgreed(false);
    setCopied(false);
    setQIdx(0);
    setCurAns("");
    setSlider(50);
    setCurResp({});
    setRoomCode("");
    setOwnerToken("");
    setRespondentToken("");
    setInvitePath("");
    setResultAvailableAfter("");
    setResponses([]);
    setServerAnswers([]);
    setServerResponseCount(0);
    setPremiumAccess(false);
    setSelectedAnswerIndex(0);
    setCreatedAt(0);
    setViewerRole(null);
    setErrorMessage("");
  };

  const createRoom = async () => {
    if (isCreatingRoom) return;

    setIsCreatingRoom(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/nabo/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerName: myName.trim() }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.view) {
        throw new Error(payload?.error ?? "초대 링크 생성에 실패했습니다.");
      }

      const at = Date.now();
      setCreatedAt(at);
      applyRoomView(payload.view as NaboRoomViewPayload, {
        ownerToken: payload.ownerToken,
        invitePath: payload.invitePath,
      });

      try {
        localStorage.setItem("nabo_created_at", String(at));
      } catch {}

      void trackClientEvent("lab_nabo_room_created");
      goTo("link");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "초대 링크 생성에 실패했습니다.");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleKakaoShareLink = async () => {
    if (!invitePath || isSharingKakao) return;

    setIsSharingKakao(true);
    setErrorMessage("");

    try {
      const Kakao = (window as Window & { Kakao?: KakaoShareSDK }).Kakao;
      const isInitialized = Kakao?.isInitialized?.() ?? false;
      if (!isInitialized) {
        Kakao?.init?.(process.env.NEXT_PUBLIC_KAKAO_JS_KEY);
      }

      const sendDefault = Kakao?.Share?.sendDefault;
      if (!sendDefault) throw new Error("Kakao SDK unavailable");

      sendDefault({
        objectType: "text",
        text: `${myName || "친구"}님이 익명 관계 분석 링크를 보냈어요.\n나는 어떤 사람으로 보일까요? 익명으로 답해주세요.`,
        link: {
          mobileWebUrl: inviteLink,
          webUrl: inviteLink,
        },
      });
      void trackClientEvent("lab_nabo_share_kakao");
    } catch {
      copyLink();
      setErrorMessage("카카오 공유가 열리지 않아 링크를 복사했어요.");
    } finally {
      setTimeout(() => setIsSharingKakao(false), 1200);
    }
  };

  const fetchServerAnswers = useCallback(async () => {
    if (!roomCode || isFetchingAnswers) return null;

    setIsFetchingAnswers(true);
    setErrorMessage("");

    try {
      const query = ownerToken ? `?owner=${encodeURIComponent(ownerToken)}` : "";
      const response = await fetch(`/api/nabo/room/${encodeURIComponent(roomCode)}/answers${query}`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(payload?.error ?? "응답 데이터를 불러오지 못했습니다.");

      const answers = (payload.answers as AnsMap[]) ?? [];
      setServerAnswers(answers);
      return answers;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "응답 데이터를 불러오지 못했습니다.");
      return null;
    } finally {
      setIsFetchingAnswers(false);
    }
  }, [roomCode, ownerToken, isFetchingAnswers]);

  const openResults = async () => {
    if (!canSeeResults || viewerRole !== "owner") return;
    if (!user) {
      goTo("results");
      return;
    }

    const answers = serverAnswers.length > 0 ? serverAnswers : await fetchServerAnswers();
    const resultAnswers = answers ?? serverAnswers;
    if (premiumAccess && resultAnswers.length === 1) {
      setSelectedAnswerIndex(0);
      goTo("single-result");
      return;
    }

    goTo("results");
  };

  const unlockEarlyResults = async () => {
    if (!roomCode || isUnlockingEarly) return;
    if (!user) {
      handleLogin();
      return;
    }

    setIsUnlockingEarly(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/nabo/room/${encodeURIComponent(roomCode)}/premium-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.view) {
        throw new Error(payload?.error ?? "결과를 열지 못했습니다.");
      }

      applyRoomView(payload.view as NaboRoomViewPayload, {
        ownerToken,
        invitePath,
      });
      void trackClientEvent("lab_nabo_premium_access", {
        credits: payload.chargedCredits ?? EARLY_RESULT_CREDIT_COST,
        responseCount,
      });

      const answers = await fetchServerAnswers();
      if ((answers ?? []).length === 1) {
        setSelectedAnswerIndex(0);
        goTo("single-result");
      } else {
        goTo("results");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "결과를 열지 못했습니다.");
    } finally {
      setIsUnlockingEarly(false);
    }
  };

  // ── 질문 표시 helper ─────────────────────────────────────────
  const getOptions = (q: typeof QS[0]) => {
    if (q.type !== "choice") return [];
    return (q as { options?: string[] }).options ?? [];
  };

  const getPlaceholder = (q: typeof QS[0]) =>
    q.type === "text" ? ((q as { placeholder?: string }).placeholder ?? "") : "";

  const getTextMaxLength = (q: typeof QS[0]) =>
    q.type === "text" ? ((q as { maxLength?: number }).maxLength ?? undefined) : undefined;

  const getSliderStep = (q: typeof QS[0]) =>
    q.type === "slider" ? ((q as { step?: number }).step ?? 1) : 1;

  const getSliderMarks = (q: typeof QS[0]) =>
    q.type === "slider" ? ((q as { marks?: string[] }).marks ?? null) : null;

  const getSliderMarkLabel = (q: typeof QS[0], value: number) => {
    const marks = getSliderMarks(q);
    if (!marks?.length) return "";

    const stepSize = 100 / (marks.length - 1);
    const index = Math.min(marks.length - 1, Math.max(0, Math.round(value / stepSize)));
    return marks[index] ?? "";
  };

  const formatAnswerValue = (question: typeof QS[0], value: string | number) => {
    if (question.type !== "slider") return String(value);

    const numeric = Number(value);
    if (Number.isNaN(numeric)) return String(value);

    const mark = getSliderMarkLabel(question, numeric);
    return mark ? `${mark} · ${numeric} / 100` : `${numeric} / 100`;
  };

  // ── 질문 진행 ─────────────────────────────────────────────────
  const Q = QS[qIdx];
  const isSlider  = Q?.type === "slider";
  const textMaxLength = Q ? getTextMaxLength(Q) : undefined;
  const effectiveAns = isSlider ? slider : curAns;
  const canNext = !isSubmittingResponse && (isSlider ? true : String(curAns).trim().length > 0);

  const submitResponseToServer = async (answers: AnsMap) => {
    if (!roomCode || !respondentToken || viewerRole !== "respondent") return false;

    setIsSubmittingResponse(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/nabo/room/${encodeURIComponent(roomCode)}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: respondentToken,
          answers,
          respondentName: respondentName.trim(),
          clientFingerprint: getNaboClientFingerprint(),
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (response.status === 409) {
        setErrorMessage("이미 응답하셨어요. 한 기기에서 한 번만 참여할 수 있어요.");
        return false;
      }

      if (!response.ok || !payload?.view) {
        throw new Error(payload?.error ?? "응답 저장에 실패했습니다.");
      }

      applyRoomView(payload.view as NaboRoomViewPayload, {
        respondentToken,
      });
      try {
        localStorage.setItem(getRespondentNameStorageKey(roomCode), respondentName.trim());
        localStorage.setItem(getRespondedStorageKey(roomCode), "1");
      } catch {}
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "응답 저장에 실패했습니다.");
      return false;
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  const advance = async () => {
    const rawStored = effectiveAns;
    const stored = Q.type === "text" && textMaxLength ? String(rawStored).slice(0, textMaxLength) : rawStored;
    const updated = { ...curResp, [Q.id]: stored };
    setCurResp(updated);
    if (qIdx < QS.length - 1) {
      setQIdx(i => i + 1);
      setCurAns(""); setSlider(50);
    } else {
      const savedToServer = await submitResponseToServer(updated);
      if (viewerRole === "respondent" && !savedToServer) return;

      setResponses(rs => [...rs, updated]);
      setCurResp({}); setQIdx(0); setCurAns(""); setSlider(50);
      void trackClientEvent("lab_nabo_response_completed");
      goTo("waiting");
    }
  };

  // ── 결과 진입 시 서버 answers 자동 fetch ──────────────────────
  useEffect(() => {
    if ((step === "results" || step === "single-result") && user && canSeeResults && serverAnswers.length === 0 && !isFetchingAnswers) {
      void fetchServerAnswers();
    }
  }, [step, user, canSeeResults, serverAnswers.length, isFetchingAnswers, fetchServerAnswers]);

  // ── Results data ──────────────────────────────────────────────
  // 우선순위: 서버 answers → 로컬 responses → MOCK(잠금 상태 미리보기용)
  const actualAnswers = serverAnswers.length > 0 ? serverAnswers : responses;
  const R = actualAnswers.length > 0 ? actualAnswers : canSeeResults ? [] : MOCK;
  const reportCount = Math.max(serverResponseCount, actualAnswers.length);
  const fullResultRemaining = Math.max(0, FULL_RESULT_COUNT - reportCount);
  const selectedAnswer = actualAnswers[selectedAnswerIndex] ?? null;
  const selectedRespondentName = getRespondentName(selectedAnswer, selectedAnswerIndex);
  const chemAvg     = avg("q3", R);
  const funAvg      = avg("q7", R);
  const intimAvg    = avg("q11", R);
  const romanceAvg  = avg("q12", R);
  const overallScore = Math.round((chemAvg + funAvg + intimAvg) / 3);
  const topDrama    = top("q10", R)[0]?.[0] ?? "";
  const imprDist    = top("q0", R);
  const charmDist   = top("q1", R);
  const annoyanceDist = top("q2", R);
  const surpriseDist  = top("q4", R);
  const topAnimal   = top("q9", R)[0]?.[0] ?? "";
  const topAnger    = top("q5", R)[0]?.[0] ?? "";
  const topDating   = top("q6", R)[0]?.[0] ?? "";
  const topPosition = top("q8", R)[0]?.[0] ?? "";
  const topMemory   = top("q13", R)[0]?.[0] ?? "";
  const oneLiners   = texts("q14", R);

  // ─────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <span className="h-8 w-8 rounded-full border-2 border-[#DCFCE7] border-t-[#22C55E]" style={{ animation: "spin 0.9s linear infinite" }} />
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen flex flex-col ${isSpaceTheme ? "bg-[#050712]" : "bg-white"}`}
      style={{
        fontFamily: '"Pretendard", "SUIT Variable", sans-serif',
        background: isSpaceTheme
          ? "linear-gradient(180deg, #182F75 0%, #071022 38%, #04050B 100%)"
          : undefined,
      }}
    >

      {/* ── Header ── */}
      <header className={`sticky top-0 z-40 flex h-14 items-center justify-between border-b px-5 backdrop-blur ${isSpaceTheme ? "border-white/10 bg-[#071022]/80" : "border-gray-100 bg-white/90"}`}>
        {step === "intro" || hasGeneratedOwnerRoom ? (
          <Link href="/studio" className={`flex items-center gap-1.5 transition-colors ${isSpaceTheme ? "text-slate-300 hover:text-white" : "text-gray-400 hover:text-gray-900"}`}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 14l-5-5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="text-[14px] font-semibold">{step === "intro" ? "돌아가기" : "이전"}</span>
          </Link>
        ) : (
          <button onClick={goBack} className={`flex items-center gap-1.5 transition-colors ${isSpaceTheme ? "text-slate-300 hover:text-white" : "text-gray-400 hover:text-gray-900"}`}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 14l-5-5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="text-[14px] font-semibold">이전</span>
          </button>
        )}
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1"
          style={{
            background: isSpaceTheme ? "rgba(15,23,42,0.72)" : G.bg,
            border: isSpaceTheme ? "1px solid rgba(125,211,252,0.38)" : `1px solid ${G.border}`,
            boxShadow: isSpaceTheme ? "0 0 24px rgba(34,211,238,0.12)" : undefined,
          }}
        >
          <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: isSpaceTheme ? "#BAE6FD" : G.text }}>내가 보는 너</span>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: isSpaceTheme ? "#22D3EE" : G.mid }} />
          <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isSpaceTheme ? "text-violet-200" : "text-gray-400"}`}>Beta</span>
        </div>
        <div className="w-[60px]" />
      </header>

      {/* ════════════════════ INTRO ════════════════════ */}
      {step === "intro" && (
        <div className="flex flex-col pb-36">
          <section className="flex flex-col items-center px-6 pt-14 pb-8 text-center">
            <div className="relative mb-10 flex items-center justify-center" style={{ height: 100 }}>
              {["😊","😏","🤩","🧐","😌"].map((em, i) => {
                const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
                const r = 38;
                return (
                  <div key={i} className="absolute w-11 h-11 rounded-full flex items-center justify-center text-[18px] shadow-sm"
                    style={{ transform: `translate(${Math.cos(a)*r}px, ${Math.sin(a)*r}px)`, background: G.bg, border: `1.5px solid ${G.border}` }}>
                    {em}
                  </div>
                );
              })}
              <div className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center text-[24px] shadow-md" style={{ background: G.mid }}>🪞</div>
            </div>
            <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-4" style={{ color: G.mid }}>익명 관계 분석</p>
            <h1 className="text-[34px] font-black text-gray-900 leading-[1.12] mb-5">나는 친구들 눈에<br />어떻게 보일까?</h1>
            <p className="text-[16px] text-gray-500 leading-relaxed max-w-[280px]">
              3명이 답하면 기본 결과가 열리고<br />
              <span className="text-[14px]" style={{ color: G.text }}>5명이 답하면 10글자 한마디까지 보여요</span>
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["3명 기본 공개", "5명 전체 공개", "24시간 후 공개"].map(tag => (
                <span key={tag} className="text-[12px] font-bold rounded-full px-3 py-1"
                  style={{ background: G.bg, color: G.deep, border: `1px solid ${G.border}` }}>{tag}</span>
              ))}
            </div>
          </section>

          <section className="px-6 py-8 flex flex-col gap-7 border-t border-gray-50">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">How it works</p>
            {[
              { num: "01", en: "CREATE",   ko: "링크를 만들어요",        desc: "닉네임을 설정하고\n익명 초대 링크를 생성해요." },
              { num: "02", en: "SHARE",    ko: "친구에게 보내요",          desc: "친구, 동료, 지인 누구에게나 공유해요.\n3명 이상 모이면 익명성이 더 안전해져요." },
              { num: "03", en: "ANSWER",   ko: "15가지 질문에 답해요",   desc: "첫인상·매력·단점·연애 스타일까지\n솔직하게 답해요." },
              { num: "04", en: "WAIT 24H", ko: "24시간 후 결과 공개",    desc: "3명부터 기본 결과,\n5명부터 전체 익명 리포트가 열려요." },
            ].map(f => (
              <div key={f.num} className="flex gap-4 items-start">
                <span className="text-[26px] font-black text-gray-200 leading-none flex-shrink-0 w-10 text-right tabular-nums">{f.num}</span>
                <div className="flex-1 border-l-2 pl-4" style={{ borderColor: G.border }}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: G.mid }}>{f.en}</p>
                  <p className="text-[20px] font-black text-gray-900 leading-tight mb-1">{f.ko}</p>
                  <p className="text-[14px] text-gray-500 leading-relaxed whitespace-pre-line">{f.desc}</p>
                </div>
              </div>
            ))}
          </section>

          <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-5 bg-gradient-to-t from-white via-white/95 to-transparent z-50">
            <label className="flex items-center gap-2.5 mb-3 cursor-pointer" onClick={() => setAgreed(v => !v)}>
              <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all"
                style={{ background: agreed ? G.mid : "white", borderColor: agreed ? G.mid : "#D1D5DB" }}>
                {agreed && <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <p className="text-[13px] text-gray-600">이용약관 및 개인정보처리방침에 동의합니다</p>
            </label>
            <button onClick={() => agreed && goTo("setup")}
              className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]"
              style={{ background: agreed ? "#111" : "#F3F4F6", color: agreed ? "#fff" : "#9CA3AF" }}>
              내 링크 만들기
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════ SETUP ════════════════════ */}
      {step === "setup" && (
        <div className="flex flex-col pb-36">
          <section className="px-6 pt-10 pb-6">
            <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-3" style={{ color: G.mid }}>Step 1 · 설정</p>
            <h2 className="text-[28px] font-black text-gray-900 leading-tight mb-2">닉네임을 정해요</h2>
            <p className="text-[14px] text-gray-500">응답자에게 보여질 이름이에요</p>
          </section>

          <section className="px-6 flex flex-col gap-5 pb-8">
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-black uppercase tracking-widest text-gray-400">내 닉네임 *</label>
              <input
                value={myName} onChange={e => setMyName(e.target.value)}
                placeholder="예: 지환, 민지, 팀장님"
                className="w-full rounded-2xl border px-4 py-4 text-[16px] font-semibold text-gray-900 bg-white outline-none transition-all"
                style={{ borderColor: myName ? G.mid : "#E5E7EB", boxShadow: myName ? `0 0 0 3px ${G.bg}` : undefined }}
              />
            </div>

            <div className="rounded-2xl p-4 flex gap-3" style={{ background: G.bg, border: `1px solid ${G.border}` }}>
              <span className="text-xl flex-shrink-0">🔒</span>
              <div>
                <p className="text-[13px] font-black text-gray-900 mb-1">익명 보호 기준</p>
                <p className="text-[12px] text-gray-500 leading-relaxed">응답이 적으면 누군지 추측될 수 있어요. 그래서 3명부터 결과를 열어요.</p>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-600">
                {errorMessage}
              </div>
            )}
          </section>

          <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-5 bg-gradient-to-t from-white via-white/95 to-transparent z-50">
            <button onClick={() => myName.trim() && void createRoom()}
              className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]"
              style={{ background: myName.trim() && !isCreatingRoom ? "#111" : "#F3F4F6", color: myName.trim() && !isCreatingRoom ? "#fff" : "#9CA3AF" }}>
              {isCreatingRoom ? "링크 만드는 중..." : "무료로 링크 생성 →"}
            </button>
            {!myName.trim() && <p className="text-center text-[12px] text-gray-400 mt-2">닉네임을 입력해주세요</p>}
          </div>
        </div>
      )}

      {/* ════════════════════ LINK ════════════════════ */}
      {step === "link" && (
        <div className="relative isolate flex min-h-[calc(100vh-3.5rem)] flex-col overflow-hidden px-6 pb-12 pt-10 text-white">
          <PixelSpaceBackdrop />

          <section className="relative z-10 pb-6">
            <div className="mb-5 inline-flex items-center gap-2 border border-cyan-300/25 bg-white/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">
              <span className="h-1.5 w-1.5 bg-cyan-300" />
              Step 2 · Link Online
            </div>
            <h2 className="text-[36px] font-black leading-[1.04] tracking-[-0.01em] text-white">
              {myName}의 링크가
              <br />
              생성됐어요!
            </h2>
            <p className="mt-4 max-w-[290px] text-[15px] leading-6 text-slate-300">
              3명부터 기본 결과, 5명부터 전체 결과가 열려요
            </p>
          </section>

          <section className="relative z-10 flex flex-col gap-4 pb-6">
            <div className="border border-cyan-200/25 bg-white/[0.075] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">익명 초대 링크</p>
                <span className="border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-200">
                  Live
                </span>
              </div>
              <div className="flex items-center gap-3">
                <p className="min-w-0 flex-1 truncate font-mono text-[13px] font-bold text-slate-100">
                  {inviteLink.replace(/^https?:\/\//, "")}
                </p>
                <button
                  onClick={copyLink}
                  className="flex-shrink-0 border border-cyan-200/30 px-4 py-2 text-[13px] font-black text-white transition-all active:scale-[0.97]"
                  style={{ background: copied ? "rgba(34,211,238,0.28)" : "rgba(15,23,42,0.92)" }}
                >
                  {copied ? "복사됨 ✓" : "복사"}
                </button>
              </div>
            </div>

            <button
              onClick={() => void handleKakaoShareLink()}
              disabled={isSharingKakao}
              className="flex w-full items-center justify-center gap-2 rounded-[22px] py-3.5 text-[15px] font-black shadow-[0_18px_45px_rgba(254,229,0,0.18)] transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: "#FEE500", color: "#191919" }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#191919"/></svg>
              {isSharingKakao ? "카카오 여는 중..." : "카카오톡으로 보내기"}
            </button>

            <div className="border border-white/10 bg-slate-950/[0.42] px-5 py-5 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-[13px] font-black text-white">결과 공개 조건</p>
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">Unlock Rules</p>
              </div>
              <div className="flex flex-col gap-3">
                {[
                  { code: "01", text: "3명이 답하면 기본 결과가 열려요" },
                  { code: "02", text: "5명이 답하면 10글자 한마디까지 보여요" },
                  { code: "03", text: "새 링크는 24시간 후 다시 만들 수 있어요" },
                  { code: "04", text: "응답이 적을 땐 추측 방지를 위해 일부를 숨겨요" },
                ].map(({ code, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <span className="flex h-7 w-8 items-center justify-center border border-cyan-300/25 bg-cyan-300/10 font-mono text-[10px] font-black text-cyan-200">
                      {code}
                    </span>
                    <span className="text-[13px] leading-5 text-slate-300">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => goTo("waiting")}
              className="w-full rounded-[22px] border border-cyan-200/20 bg-white py-4 text-[17px] font-black text-[#071022] shadow-[0_18px_55px_rgba(125,211,252,0.18)] transition-all active:scale-[0.97]"
            >
              응답 대기 화면으로 →
            </button>

            {canStartNewRoom && (
              <button
                type="button"
                onClick={handleReset}
                className="w-full rounded-[22px] border border-white/[0.15] bg-white/[0.06] py-3.5 text-[15px] font-black text-slate-300 transition-all active:scale-[0.98]"
              >
                새로 시작하기
              </button>
            )}
          </section>
        </div>
      )}

      {/* ════════════════════ WAITING ════════════════════ */}
      {step === "waiting" && (
        <div className="relative isolate flex min-h-[calc(100vh-3.5rem)] flex-col items-center overflow-hidden px-7 pb-12 pt-12 text-center text-white">
          <PixelSpaceBackdrop />

          <div className="relative z-10 flex w-full max-w-[360px] flex-col items-center">
            <div className="mb-6 inline-flex items-center gap-2 border border-cyan-300/25 bg-white/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">
              <span className="h-1.5 w-1.5 bg-cyan-300" />
              {viewerRole === "respondent" ? "Signal Saved" : "Waiting Signal"}
            </div>
            <h2 className="text-[40px] font-black leading-[1.02] tracking-[-0.015em] text-white">
              {viewerRole === "respondent" ? "응답이 저장됐어요" : "응답을 기다리는 중"}
            </h2>
            <p className="mt-4 text-[15px] leading-6 text-slate-300">
              {viewerRole === "respondent" ? `${myName || "친구"}님에게 익명으로 전달돼요` : "3명부터 기본 결과, 5명부터 전체 결과가 열려요"}
            </p>
          </div>

          <div className="relative z-10 mt-12 flex w-full max-w-[360px] flex-col items-center">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-cyan-200">Response Pack</p>
            <p className="mt-3 font-mono text-[72px] font-black leading-none text-cyan-200">
              {responseCount}
              <span className="ml-1 text-[28px] text-slate-500">/{FULL_RESULT_COUNT}</span>
            </p>
            <div className="mt-6 grid w-full grid-cols-5 gap-2">
              {Array.from({ length: FULL_RESULT_COUNT }).map((_, i) => (
                <div
                  key={i}
                  className="h-2.5 transition-all duration-500"
                  style={{
                    background: i < responseCount ? "rgba(34,211,238,0.82)" : "rgba(15,23,42,0.82)",
                    boxShadow: i < responseCount ? "0 0 18px rgba(34,211,238,0.24)" : undefined,
                  }}
                />
              ))}
            </div>
            <p className="mt-4 min-h-[20px] text-[13px] leading-5 text-slate-400">
              {responseCount === 0 && "아직 아무도 응답하지 않았어요"}
              {responseCount > 0 && responseCount < BASIC_RESULT_COUNT && `${responseCount}명이 응답했어요 · 기본 결과까지 ${BASIC_RESULT_COUNT - responseCount}명 남았어요`}
              {responseCount >= BASIC_RESULT_COUNT && responseCount < FULL_RESULT_COUNT && `기본 결과 조건 달성 · 전체 결과까지 ${FULL_RESULT_COUNT - responseCount}명 남았어요`}
              {responseCount >= FULL_RESULT_COUNT && "전체 결과 조건 달성!"}
            </p>
          </div>

          {viewerRole === "owner" && (
            <div className="relative z-10 mt-12 flex w-full max-w-[360px] flex-col items-center">
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-violet-200">Next Launch</p>
              {timeLeft > 0 ? (
                <>
                  <p className="mt-3 font-mono text-[44px] font-black leading-none text-white tabular-nums">
                    {fmtCountdown(timeLeft)}
                  </p>
                  <p className="mt-3 text-[13px] leading-5 text-slate-400">
                    24시간 안에는 기존 링크의 응답을 계속 모아요.
                  </p>
                </>
              ) : (
                <div className="mt-3">
                  <p className="text-[20px] font-black text-cyan-200">새로 시작할 수 있어요</p>
                  <p className="mt-2 text-[13px] text-slate-400">기존 결과는 유지되고 새 링크를 만들 수 있어요.</p>
                </div>
              )}
            </div>
          )}

          {viewerRole === "owner" && canSeeResults && (
            <button
              onClick={() => void openResults()}
              className="relative z-10 mt-10 w-full max-w-[360px] rounded-[22px] border border-cyan-200/20 bg-cyan-300 py-4 text-[17px] font-black text-[#06101f] shadow-[0_18px_55px_rgba(34,211,238,0.22)] transition-all active:scale-[0.97]"
            >
              결과 확인하기
            </button>
          )}

          {canUnlockEarly && (
            <button
              type="button"
              onClick={() => void unlockEarlyResults()}
              disabled={isUnlockingEarly}
              className="relative z-10 mt-4 w-full max-w-[360px] rounded-[22px] border border-violet-200/20 bg-violet-400 py-4 text-[17px] font-black text-[#090B16] shadow-[0_18px_55px_rgba(167,139,250,0.2)] transition-all active:scale-[0.97] disabled:opacity-60"
            >
              {isUnlockingEarly ? "여는 중..." : `1명 결과부터 보기 · ${EARLY_RESULT_CREDIT_COST}크레딧`}
            </button>
          )}

          {errorMessage && (
            <div className="relative z-10 mt-5 w-full max-w-[360px] border border-red-300/25 bg-red-500/[0.12] px-4 py-3 text-[13px] font-bold text-red-100">
              {errorMessage}
            </div>
          )}

          <div className="relative z-10 mt-12 w-full max-w-[320px]">
            <p className="mb-2 text-[13px] font-black text-slate-200">왜 3명부터 열리나요?</p>
            <p className="text-[12px] leading-relaxed text-slate-500">
              1명이나 2명 응답은 누가 썼는지 쉽게 추측될 수 있어요.
            </p>
          </div>

          {viewerRole === "owner" && canStartNewRoom && (
            <button
              type="button"
              onClick={handleReset}
              className="relative z-10 mt-8 w-full max-w-[360px] rounded-[22px] border border-white/[0.15] bg-white/[0.06] py-3.5 text-[15px] font-black text-slate-300 transition-all active:scale-[0.98]"
            >
              새로 시작하기
            </button>
          )}

          {viewerRole === "respondent" && (
            <Link
              href="/nabo"
              className="relative z-10 mt-10 flex w-full max-w-[360px] items-center justify-center rounded-[22px] border border-cyan-200/20 bg-white py-4 text-[17px] font-black text-[#071022]"
            >
              내 링크도 만들기
            </Link>
          )}
        </div>
      )}

      {/* ════════════════════ RESPONDENT NAME ════════════════════ */}
      {step === "respondent-name" && (
        <div className="flex flex-col pb-36">
          <section className="px-6 pt-10 pb-6">
            <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-3" style={{ color: G.mid }}>익명 참여</p>
            <h2 className="break-keep text-[30px] font-black leading-tight text-gray-900">
              어떤 이름으로
              <br />
              남겨질까요?
            </h2>
            <p className="mt-3 break-keep text-[14px] leading-6 text-gray-500">
              결과 화면에는 이 닉네임으로 보여요. 카카오 로그인 없이도 참여할 수 있어요.
            </p>
          </section>

          <section className="px-6">
            <label htmlFor="nabo-respondent-name" className="text-[12px] font-black uppercase tracking-widest text-gray-400">
              내 닉네임
            </label>
            <input
              id="nabo-respondent-name"
              value={respondentName}
              onChange={(event) => setRespondentName(event.target.value.slice(0, 20))}
              placeholder="예: 친한 친구, 유공님, 익명 A"
              className="mt-2 w-full rounded-2xl border px-4 py-4 text-[16px] font-semibold text-gray-900 outline-none transition-all"
              style={{ borderColor: respondentName.trim() ? G.mid : "#E5E7EB", boxShadow: respondentName.trim() ? `0 0 0 3px ${G.bg}` : undefined }}
            />
            <div className="mt-5 rounded-2xl px-4 py-4" style={{ background: G.bg, border: `1px solid ${G.border}` }}>
              <p className="text-[13px] font-black text-gray-900">응답 대상</p>
              <p className="mt-1 text-[18px] font-black" style={{ color: G.text }}>{myName || "친구"}님</p>
            </div>
          </section>

          <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-white via-white/95 to-transparent px-5 pb-8 pt-5">
            <button
              type="button"
              onClick={() => {
                const name = respondentName.trim();
                if (!name || !roomCode) return;
                try { localStorage.setItem(getRespondentNameStorageKey(roomCode), name); } catch {}
                goTo("questions");
              }}
              className="w-full rounded-2xl py-4 text-[17px] font-black transition-all active:scale-[0.97]"
              style={{ background: respondentName.trim() ? "#111" : "#F3F4F6", color: respondentName.trim() ? "#fff" : "#9CA3AF" }}
            >
              익명으로 답변하기 →
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════ QUESTIONS ════════════════════ */}
      {step === "questions" && Q && (
        <div className="flex flex-col pb-32 flex-1">
          <div className="px-5 py-2.5 text-center" style={{ background: G.bg, borderBottom: `1px solid ${G.border}` }}>
            <p className="text-[12px] font-bold" style={{ color: G.text }}>
              지금 <strong>{myName}</strong>에 대해 익명으로 답변 중이에요
            </p>
          </div>
          <div className="px-6 pt-5 pb-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold text-gray-400">{qIdx + 1} / {QS.length}</p>
              <p className="text-[12px] font-bold" style={{ color: G.mid }}>{Q.short}</p>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: G.light }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${((qIdx + 1) / QS.length) * 100}%`, background: G.mid }} />
            </div>
            {errorMessage && (
              <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-600">
                {errorMessage}
              </div>
            )}
          </div>

          <section className="px-6 pt-7 pb-4 flex flex-col gap-5 flex-1">
            <div className="flex flex-col gap-3">
              <span className="text-[42px] leading-none">{Q.emoji}</span>
              <h2 className="text-[24px] font-black text-gray-900 leading-tight">{Q.text(myName || "이 분")}</h2>
            </div>

            {Q.type === "choice" && (
              (() => {
                const isAnimalQuestion = Q.id === "q9";
                return (
                  <div className={isAnimalQuestion ? "grid grid-cols-5 gap-2" : "flex flex-col gap-2"}>
                    {getOptions(Q).map(opt => (
                      <button
                        key={opt}
                        onClick={() => setCurAns(opt)}
                        className={
                          isAnimalQuestion
                            ? "min-h-[52px] w-full rounded-xl border px-1.5 py-2.5 text-center text-[12px] font-black leading-tight break-keep transition-all"
                            : "w-full rounded-2xl border px-4 py-3.5 text-left text-[15px] font-semibold transition-all"
                        }
                        style={{
                          borderColor: curAns === opt ? G.mid : "#E5E7EB",
                          background: curAns === opt ? G.bg : "white",
                          color: curAns === opt ? G.text : "#374151",
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                );
              })()
            )}

            {Q.type === "text" && (
              <div className="flex flex-col gap-2">
                <textarea
                  value={String(curAns)}
                  onChange={e => setCurAns(textMaxLength ? e.target.value.slice(0, textMaxLength) : e.target.value)}
                  placeholder={getPlaceholder(Q)}
                  rows={2}
                  maxLength={textMaxLength}
                  className="w-full rounded-2xl border px-4 py-4 text-[15px] font-semibold text-gray-900 bg-white outline-none resize-none"
                  style={{ borderColor: curAns ? G.mid : "#E5E7EB" }}
                />
                {textMaxLength && (
                  <p className="text-right text-[12px] font-bold text-gray-400">
                    {String(curAns).length}/{textMaxLength}
                  </p>
                )}
              </div>
            )}

            {Q.type === "slider" && (
              <div className="flex flex-col gap-5">
                <style>{`.nabo-sl::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;border-radius:50%;background:${G.mid};cursor:pointer;box-shadow:0 2px 8px rgba(34,197,94,0.45)}.nabo-sl::-webkit-slider-runnable-track{height:7px;border-radius:4px;background:linear-gradient(to right,${G.mid} var(--v,50%),#E5E7EB var(--v,50%))}.nabo-sl{-webkit-appearance:none;appearance:none;outline:none}`}</style>
                <input type="range" min={0} max={100} step={getSliderStep(Q)} value={slider} onChange={e => setSlider(Number(e.target.value))}
                  className="w-full nabo-sl" style={{ "--v": `${slider}%` } as React.CSSProperties} />
                <div className="flex justify-between text-[12px] font-bold text-gray-400">
                  <span>{Q.labels![0]}</span><span>{Q.labels![1]}</span>
                </div>
                <div className="flex items-center justify-center">
                  <div className="px-8 py-3 rounded-2xl text-center" style={{ background: G.bg, border: `1px solid ${G.border}` }}>
                    {getSliderMarkLabel(Q, slider) && (
                      <p className="mb-1 text-[13px] font-black" style={{ color: G.text }}>{getSliderMarkLabel(Q, slider)}</p>
                    )}
                    <span className="text-[40px] font-black leading-none" style={{ color: G.mid }}>{slider}</span>
                    <span className="text-[14px] text-gray-400 ml-1">/ 100</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-5 bg-gradient-to-t from-white via-white/95 to-transparent z-50">
            <button onClick={canNext ? () => void advance() : undefined}
              className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]"
              style={{ background: canNext ? "#111" : "#F3F4F6", color: canNext ? "#fff" : "#9CA3AF" }}>
              {isSubmittingResponse ? "저장 중..." : qIdx < QS.length - 1 ? "다음 →" : "익명 제출 완료 →"}
            </button>
            {!canNext && <p className="text-center text-[12px] text-gray-400 mt-2">답변을 입력해주세요</p>}
          </div>
        </div>
      )}

      {/* ════════════════════ RESULTS ════════════════════ */}
      {step === "results" && !user && (
        <div className="flex flex-1 flex-col justify-center px-6 pb-20">
          <p className="text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: G.mid }}>결과 확인</p>
          <h2 className="mt-4 break-keep text-[34px] font-black leading-tight text-gray-950">
            카카오로 가입하면
            <br />
            결과가 열려요
          </h2>
          <p className="mt-4 break-keep text-[15px] leading-7 text-gray-500">
            응답자는 비회원도 참여할 수 있지만, 만든 사람이 결과를 확인할 때는 계정 연결이 필요해요.
          </p>
          <button
            type="button"
            onClick={handleLogin}
            className="mt-8 h-14 rounded-2xl bg-[#FEE500] text-[16px] font-black text-[#191919]"
          >
            카카오로 결과 보기
          </button>
        </div>
      )}

      {step === "results" && user && (
        <div className="flex flex-col pb-16">
          <section className="px-6 pt-10 pb-6 text-center">
            <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-3" style={{ color: G.mid }}>관계 분석 완료</p>
            <h2 className="text-[28px] font-black text-gray-900 leading-tight mb-1">{reportCount}명이 본 {myName}</h2>
            <p className="text-[13px] text-gray-400">익명 응답자 {reportCount}명의 결과 · {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}</p>
          </section>

          {actualAnswers.length > 0 && (
            <section className="mx-6 mb-4 rounded-2xl border border-gray-100 bg-white px-5 py-5">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.25em] text-gray-400">응답자별 결과</p>
              <div className="flex flex-col gap-2">
                {actualAnswers.map((answer, index) => (
                  <button
                    key={`${getRespondentName(answer, index)}-${index}`}
                    type="button"
                    onClick={() => {
                      setSelectedAnswerIndex(index);
                      goTo("single-result");
                    }}
                    className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-3 text-left transition-all active:scale-[0.99]"
                  >
                    <span className="text-[15px] font-black text-gray-900">{getRespondentName(answer, index)}님의 결과</span>
                    <span className="text-[20px] font-black text-gray-300">›</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── 종합 점수 (항상 공개) ── */}
          <section className="mx-6 rounded-3xl p-6 mb-4" style={{ background: G.bg, border: `1px solid ${G.border}` }}>
            <div className="flex flex-col items-center gap-4">
              <ScoreRing score={overallScore} size={148} />
              <div className="text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-2">종합 매력 지수</p>
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[14px] font-black text-white" style={{ background: G.mid }}>
                  {topDrama.split(" (")[0]}
                </span>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {[["케미", chemAvg], ["재미", funAvg], ["친밀도", intimAvg], ["연애 가능성", romanceAvg]].map(([k, v]) => (
                <div key={k} className="bg-white rounded-2xl py-3 text-center">
                  <p className="text-[10px] font-bold text-gray-400">{k}</p>
                  <p className="text-[22px] font-black" style={{ color: G.mid }}>{v}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── 첫인상 Top 1 (항상 공개) ── */}
          <section className="mx-6 rounded-2xl border border-gray-100 bg-white px-5 py-5 mb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-3">👀 첫인상 (가장 많은 응답)</p>
            {imprDist[0] && (
              <div className="flex items-center justify-between">
                <span className="text-[16px] font-black text-gray-900">{imprDist[0][0]}</span>
                <span className="text-[14px] font-black px-3 py-1 rounded-full" style={{ background: G.bg, color: G.mid }}>{imprDist[0][1]}명</span>
              </div>
            )}
          </section>

          {/* ── 상세 결과 공개 상태 ── */}
          {isFetchingAnswers && actualAnswers.length === 0 ? (
            <div className="mx-6 mb-4 flex items-center justify-center gap-3 py-10">
              <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-green-500 animate-spin" />
              <span className="text-[14px] text-gray-500 font-semibold">응답 데이터 불러오는 중...</span>
            </div>
          ) : (
            <>
              {/* 첫인상 전체 분포 */}
              <section className="mx-6 rounded-2xl border border-gray-100 bg-white px-5 py-5 mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-4">첫인상 전체 분포</p>
                <div className="flex flex-col gap-3">
                  {imprDist.map(([label, cnt]) => <BarRow key={label} label={label} count={cnt} total={R.length} />)}
                </div>
              </section>

              {/* 핵심 매력 */}
              <section className="mx-6 rounded-2xl border border-gray-100 bg-white px-5 py-5 mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-4">💎 핵심 매력</p>
                <div className="flex flex-col gap-3">
                  {charmDist.map(([label, cnt]) => <BarRow key={label} label={label} count={cnt} total={R.length} />)}
                </div>
              </section>

              {/* 유형 카드 */}
              <section className="mx-6 grid grid-cols-2 gap-3 mb-4">
                {[
                  { title: "동물 유형",   val: topAnimal,   emoji: "🐾" },
                  { title: "화낼 때",     val: topAnger,    emoji: "😤" },
                  { title: "연애 스타일", val: topDating,   emoji: "💘" },
                  { title: "드라마 유형", val: topDrama,    emoji: "🎭" },
                  { title: "관계 포지션", val: topPosition, emoji: "🧭" },
                  { title: "기억 방식",   val: topMemory,   emoji: "🪞" },
                ].map(({ title, val, emoji }) => (
                  <div key={title} className="rounded-2xl border border-gray-100 bg-white px-4 py-4">
                    <p className="text-[10px] font-bold text-gray-400 mb-1">{emoji} {title}</p>
                    <p className="text-[13px] font-black text-gray-900 leading-tight">{val}</p>
                  </div>
                ))}
              </section>

              {canShowFullResult ? (
                <>
                  {/* 의외의 매력 */}
                  <section className="mx-6 rounded-2xl border border-gray-100 bg-white px-5 py-5 mb-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-4">🌟 의외의 매력 분포</p>
                    <div className="flex flex-col gap-3">
                      {surpriseDist.map(([label, cnt]) => <BarRow key={label} label={label} count={cnt} total={R.length} />)}
                    </div>
                  </section>

                  {/* 아쉬운 점 */}
                  <section className="mx-6 rounded-2xl border border-gray-100 bg-white px-5 py-5 mb-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-4">😅 은근 거슬리는 점</p>
                    <div className="flex flex-col gap-3">
                      {annoyanceDist.map(([label, cnt]) => <BarRow key={label} label={label} count={cnt} total={R.length} />)}
                    </div>
                  </section>

                  {/* 10글자 한마디 */}
                  <section className="mx-6 rounded-2xl border border-gray-100 bg-white px-5 py-5 mb-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 mb-3">✉️ 10글자 한마디</p>
                    <div className="flex flex-col gap-2">
                      {oneLiners.map((msg, i) => (
                        <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                          <p className="text-[14px] text-gray-800 leading-relaxed italic">&ldquo;{msg}&rdquo;</p>
                          <p className="text-[11px] text-gray-400 mt-1">— 익명</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <section className="mx-6 mb-4 rounded-3xl overflow-hidden" style={{ background: "linear-gradient(135deg, #052e16 0%, #14532d 100%)", border: `1px solid ${G.dark}` }}>
                  <div className="px-6 py-7 flex flex-col items-center text-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
                      🔒
                    </div>
                    <div>
                      <p className="text-[11px] font-black tracking-[0.25em] uppercase mb-2" style={{ color: G.mid }}>익명 보호 중</p>
                      <p className="text-[22px] font-black text-white leading-tight mb-2">현재 {reportCount}명 / {FULL_RESULT_COUNT}명</p>
                      <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                        의외의 매력 · 아쉬운 점 · 10글자 한마디는<br />
                        누가 썼는지 추측될 수 있어 아직 숨겨둘게요.
                      </p>
                    </div>
                    <button
                      onClick={copyLink}
                      className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97]"
                      style={{ background: G.mid, color: "white" }}
                    >
                      친구 더 초대하기
                    </button>
                    <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>{fullResultRemaining}명만 더 답하면 전체 결과가 열려요</p>
                  </div>
                </section>
              )}

              <div className="px-6 mb-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void handleKakaoShareLink()}
                  disabled={isSharingKakao}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-black text-[#191919] transition-all active:scale-[0.98] disabled:opacity-60"
                  style={{ background: "#FEE500" }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#191919"/></svg>
                  {isSharingKakao ? "카카오 여는 중..." : "카카오로 공유하기"}
                </button>
                {copied && (
                  <p className="text-center text-[12px] font-bold" style={{ color: G.mid }}>
                    링크가 복사되었습니다.
                  </p>
                )}
              </div>

              {canStartNewRoom && (
                <div className="mx-6 mb-8">
                  <button
                    onClick={handleReset}
                    className="w-full py-4 rounded-2xl font-black text-[17px] transition-all active:scale-[0.97] text-white"
                    style={{ background: "#111827" }}
                  >
                    새로 시작하기
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ════════════════════ SINGLE RESULT ════════════════════ */}
      {step === "single-result" && user && (
        <div className="flex flex-col pb-16">
          <section className="px-6 pt-10 pb-6">
            <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-3" style={{ color: G.mid }}>응답자 결과</p>
            <h2 className="break-keep text-[32px] font-black leading-tight text-gray-900">
              {selectedRespondentName}님의 결과
            </h2>
            <p className="mt-2 text-[14px] text-gray-500">{myName || "나"}를 이렇게 봤어요</p>
          </section>

          {!selectedAnswer ? (
            <section className="mx-6 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-8 text-center">
              <p className="text-[14px] font-bold text-gray-500">응답 데이터를 불러오는 중이에요.</p>
              <button
                type="button"
                onClick={() => void fetchServerAnswers()}
                className="mt-4 rounded-xl px-4 py-2 text-[13px] font-black text-white"
                style={{ background: G.mid }}
              >
                다시 불러오기
              </button>
            </section>
          ) : (
            <>
              <section className="mx-6 flex flex-col gap-3">
                {QS.map((question) => {
                  const value = selectedAnswer[question.id];
                  if (typeof value === "undefined" || value === "") return null;
                  return (
                    <article key={question.id} className="rounded-2xl border border-gray-100 bg-white px-5 py-4">
                      <p className="text-[12px] font-black text-gray-400">{question.emoji} {question.short}</p>
                      <p className="mt-2 break-keep text-[16px] font-black leading-7 text-gray-900">
                        {formatAnswerValue(question, value)}
                      </p>
                    </article>
                  );
                })}
              </section>

              <div className="mx-6 mt-5 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => goTo("results")}
                  className="w-full rounded-2xl py-4 text-[17px] font-black text-white"
                  style={{ background: G.mid }}
                >
                  전체 결과로 돌아가기
                </button>
                {canStartNewRoom && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="w-full rounded-2xl border border-gray-200 bg-white py-3.5 text-[15px] font-black text-gray-500"
                  >
                    새로 시작하기
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}
