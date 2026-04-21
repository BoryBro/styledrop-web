import type { DuoBattleScene } from "@/lib/audition-duo";

export const DUO_BATTLE_SCENES: DuoBattleScene[] = [
  {
    id: "crime-interrogation",
    genre: "범죄",
    title: "심문실 마지막 한마디",
    direction: "상대가 끝까지 발뺌하고 있지만, 당신은 이미 진실을 알고 있다. 차갑게 몰아붙이면서도 확신을 숨기지 마세요.",
    dialogue: "마지막으로 묻죠. 지금도 모른다고 할 건가요?",
    soundCue: "형광등 울림, 의자 끄는 소리, 짧은 정적",
    durationSec: 3,
  },
  {
    id: "romance-confession",
    genre: "로맨스",
    title: "비 오는 날의 고백 직전",
    direction: "젖은 숨을 고르며 마음을 꺼내야 하는 순간이다. 떨리지만 숨기지 못하는 감정을 얼굴에 남겨야 한다.",
    dialogue: "이 말 오늘 안 하면, 나 진짜 후회할 것 같아.",
    soundCue: "빗소리, 우산 접히는 소리, 숨 고르는 소리",
    durationSec: 3,
  },
  {
    id: "thriller-door",
    genre: "스릴러",
    title: "문밖의 정체",
    direction: "문밖에서 누군가 거칠게 두드린다. 겁먹었지만 눈은 끝까지 확인하려는 방향으로 살아 있어야 한다.",
    dialogue: "누구세요... 거기 누구냐고요.",
    soundCue: "문 두드리는 큰 소리, 발소리 멈춤, 낮은 숨소리",
    durationSec: 3,
  },
  {
    id: "comedy-live",
    genre: "코미디",
    title: "생방송 사고 직전",
    direction: "실수한 걸 알았지만 이미 카메라는 켜져 있다. 민망함과 억지 쿨함이 동시에 보여야 한다.",
    dialogue: "아니, 이건 진짜 오해라니까요?",
    soundCue: "짧은 효과음, 사람들 웃음, 어색한 정적",
    durationSec: 3,
  },
  {
    id: "action-betrayal",
    genre: "액션",
    title: "배신 직후 옥상",
    direction: "믿었던 사람이 돌아섰다는 걸 알아챘다. 분노, 경계, 바로 덤빌 준비가 한 표정 안에 들어가야 한다.",
    dialogue: "지금 네가 한 말, 책임질 수 있어?",
    soundCue: "거센 바람, 금속 마찰음, 발 멈추는 소리",
    durationSec: 3,
  },
  {
    id: "horror-whisper",
    genre: "공포",
    title: "빈집의 속삭임",
    direction: "아무도 없는 집에서 내 이름을 들었다. 도망가고 싶지만 시선은 소리의 방향을 놓치지 못한다.",
    dialogue: "방금... 내 이름 부른 거 누구야.",
    soundCue: "낡은 바닥 삐걱임, 낮은 속삭임, 멀리서 울리는 소리",
    durationSec: 3,
  },
];

export function pickRandomDuoBattleScene() {
  return DUO_BATTLE_SCENES[Math.floor(Math.random() * DUO_BATTLE_SCENES.length)];
}
