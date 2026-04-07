"use client";

import { useState, useRef, useCallback, useEffect, Suspense, useMemo, type ComponentClass } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type ReactWebcam from "react-webcam";
import type { WebcamProps } from "react-webcam";
import { useAuth } from "@/hooks/useAuth";
import { AUDITION_ENABLED } from "@/lib/feature-flags";
import { analyzePhysioPhoto, type PhysioPhotoCheck } from "@/lib/physio-face";

// SSR 비활성화 — react-webcam은 브라우저 전용
// react-webcam의 타입 선언이 next/dynamic ref 타입과 맞지 않아 loader 반환만 느슨하게 맞춘다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Webcam = dynamic(() => import("react-webcam") as any, {
  ssr: false,
  loading: () => <div style={{ position: "absolute", inset: 0, background: "#111" }} />,
}) as unknown as ComponentClass<WebcamProps>;

const PHYSIO_FRAME_CLASS = "relative w-full aspect-square rounded-2xl overflow-hidden bg-[#111] border border-white/10";
const PHYSIO_OVAL_STYLE = {
  width: "62%",
  aspectRatio: "3/4",
  borderRadius: "50%",
} as const;
const HANDLE_WEBCAM_READY: WebcamProps["onUserMedia"] = () => undefined;
const HANDLE_WEBCAM_ERROR: WebcamProps["onUserMediaError"] = () => undefined;

// ── 장르 & 큐 데이터 ────────────────────────────────────────────────
const GENRES = [
  { id: "melo",     label: "멜로",   emoji: "💔" },
  { id: "thriller", label: "스릴러", emoji: "🔪" },
  { id: "daily",    label: "일상",   emoji: "😐" },
  { id: "horror",   label: "공포",   emoji: "👻" },
  { id: "comedy",   label: "코미디", emoji: "😂" },
  { id: "action",   label: "액션",   emoji: "💥" },
  { id: "fantasy",  label: "판타지", emoji: "✨" },
  { id: "crime",    label: "범죄",   emoji: "🕵️" },
  { id: "romance",  label: "로맨스", emoji: "🌹" },
  { id: "psycho",   label: "심리",   emoji: "🧠" },
] as const;

type GenreId = typeof GENRES[number]["id"];

const CUES: Record<GenreId, string[]> = {
  melo: [
    "3년 사귄 애인이 이별 통보하는데 '나도 요즘 그런 생각 했어' 할 때",
    "짝사랑 상대가 다른 사람이랑 사귄다고 했는데 '아 진짜? 잘됐다~' 할 때",
    "고백했는데 '오빠(언니)는 친구로만 보여' 들었을 때 '나도 사실 그래' 할 때",
    "연인이 '나 살쪘어?' 물어봤을 때 '아니 전혀?' 라고 해야 하는 상황",
    "첫 만남에서 상대가 생각보다 너무 별로인데 '어 되게 좋으신 것 같아요' 할 때",
    "좋아하는 사람이 '넌 내 이상형이야'라고 했는데 친구한테 하는 말인 걸 알았을 때",
    "카페에서 전 애인 마주쳤는데 못 본 척하다 눈 마주쳤을 때",
    "톡 읽씹 당했는데 '어 나도 바빴어' 하며 태연한 척할 때",
    "연애 3개월 만에 부모님께 인사드리러 갔는데 부모님이 너무 좋아할 때",
    "상대가 '우리 그냥 친구로 지내자'고 했는데 '응 나도 그게 편해' 할 때",
    "좋아하는 사람 생일인데 선물 전달하면서 '그냥 지나치다 샀어' 할 때",
    "연인이 '요즘 나 좋아해?' 물어봤는데 SNS 보다가 들켰을 때",
    "썸 타다 상대방이 갑자기 군대 간다고 했을 때의 표정",
    "데이트 중 상대가 전 애인 얘기를 아무렇지 않게 꺼냈을 때",
    "같이 영화 보다 울고 싶은데 옆에서 보고 있어서 참는 표정",
    "좋아하는 사람이 '넌 나한테 특별해'라고 했는데 단톡에서 본 그 말을 다른 사람한테도 했을 때",
    "오래 사귄 연인이 갑자기 '우리 진짜 잘 맞는 것 같아'라고 했는데 어제 싸운 거 기억하면서",
    "친구가 소개팅 주선한다고 했는데 사진 보내줬는데 솔직히 별로일 때",
    "연인한테 '오늘 예쁘다/멋있다' 들었는데 오늘 아무것도 안 했을 때",
    "전 애인이 잘 살고 있다는 소식 들었는데 '잘됐네~' 할 때",
    "1년 만에 다시 연락 온 전 애인 톡 읽고 3시간째 뭐라고 답할지 고민할 때",
    "좋아하는 사람과 우연히 두 손이 닿았는데 아무렇지 않은 척할 때",
    "연인이랑 처음으로 크게 싸우고 나서 화해 문자 쓰려고 하는 표정",
    "짝사랑 상대가 나한테 고민 상담하면서 '넌 내 제일 친한 친구야'라고 할 때",
    "소개팅 자리에서 상대방 인스타 팔로워가 나보다 10배 많다는 걸 알았을 때",
    "연인이 '나 요즘 힘들어'라고 했는데 사실 나도 힘들어서 못 들어줄 것 같을 때",
    "드라마처럼 비 맞으면서 고백하러 갔더니 상대방이 우산 들고 나왔을 때",
    "'우리 그냥 친구야'라고 말하는데 왜 이렇게 떨리는 거야 싶을 때",
    "연인이 여행 중 찍어준 내 사진이 너무 못 나왔는데 '오 잘 나왔다~' 할 때",
    "헤어진 지 딱 100일 됐는데 전 애인이 새 연인 사진을 올렸을 때",
  ],
  thriller: [
    "지갑 잃어버린 줄 알고 경찰서 갔는데 내가 소매치기 용의자가 됐을 때",
    "엘리베이터 버튼 눌렀는데 안에서 모르는 사람이 뚫어지게 쳐다볼 때",
    "밤 12시에 집에 들어왔는데 불 켜놓은 기억이 없는데 불이 켜져 있을 때",
    "뒤에서 누가 계속 따라오는 것 같아서 골목 돌아 확인할 때",
    "핸드폰 위치가 켜진 채 누군가 내 위치를 보고 있다는 걸 알았을 때",
    "잠결에 문 잠갔나 확인하러 갔더니 문이 살짝 열려있을 때",
    "아무도 없는 집인데 위층에서 발소리가 들릴 때",
    "카메라에 찍힌 내 뒤에 분명 아무도 없었는데 사진엔 누군가가 있을 때",
    "탈출방(방탈출)에서 진짜 잠긴 줄 알고 패닉 오기 직전",
    "편의점 알바 중 새벽 3시에 처음 보는 손님이 '오랜만이에요' 했을 때",
    "비밀번호를 분명 바꿨는데 누군가 내 계정에 접속한 흔적이 있을 때",
    "배달 왔는데 내가 시킨 게 아닌 주소로 온 택배가 이미 뜯어진 상태일 때",
    "지하주차장에서 혼자 걸어가는데 저 멀리서 내 차 불이 켜졌다 꺼질 때",
    "전화 끊었는데 상대방이 아직 연결 중이라는 걸 알았을 때",
    "인터폰 화면에 찍힌 사람이 우리 집 앞에서 30분째 서 있을 때",
    "자고 일어났더니 내 물건 위치가 바뀌어 있는데 혼자 잤을 때",
    "연속으로 같은 번호에서 전화가 오는데 받으면 아무 말도 없을 때",
    "친구가 '어제 연락했잖아'라는데 나는 연락한 기억이 없을 때",
    "CCTV에 내가 걸어가는 게 찍혔는데 내 뒤에 뭔가 따라오는 것처럼 보일 때",
    "목격자로 경찰서 갔는데 형사가 오히려 나한테만 집중 질문할 때",
    "sns 비공개 계정인데 나도 모르는 내 사진이 누군가 올려놓은 것을 발견했을 때",
    "새벽에 문 잠갔는데 밖에서 열쇠 돌리는 소리가 날 때",
    "주차된 차 안에 누가 있는 것 같아서 창문 들여다보려는 순간",
    "처음 간 식당인데 사장님이 내 이름을 알고 있을 때",
    "지하철에서 분명 내 가방에 뭔가 넣는 것 같은 사람을 봤는데 확인하려는 찰나",
    "사무실에 퇴근하고 혼자 남았는데 분명 불 끄고 잠갔는데 다시 켜져 있을 때",
    "모르는 번호에서 '왜 계속 저 보세요?'라는 문자가 왔을 때",
    "아파트 복도에서 내 이름 부르는 소리가 들렸는데 아무도 없을 때",
    "내가 분명 삭제한 파일이 다시 살아나 있을 때",
    "내 생일을 모르는 사람이 생일 케이크를 들고 문 앞에 서 있을 때",
  ],
  daily: [
    "지하철에서 방귀 뀌었는데 옆사람이 나를 쳐다볼 때",
    "회식에서 상사가 '한 잔 더?' 물어보는데 진짜 마시기 싫을 때",
    "마트에서 계산하려는데 카드가 3번 연속 오류날 때",
    "이미 내린 지하철 문이 다시 열려서 승객들과 눈 마주칠 때",
    "친구 생일 파티에 갔는데 나만 선물 안 가져온 걸 알았을 때",
    "면접 보러 갔는데 면접관이 지난주에 클럽에서 만난 사람일 때",
    "줄 서서 기다리다 드디어 내 차례인데 '지금 마감됐어요' 들을 때",
    "무한리필 고기집에서 너무 많이 먹어서 일어날 수가 없을 때",
    "유튜브 광고 5초 기다리는데 4초에 앱이 꺼졌을 때",
    "배달 기사님한테 '감사합니다' 하고 문 닫았는데 영수증이 틀렸을 때",
    "카페에서 '아이스 아메리카노'라고 했는데 '네 따뜻한 아메리카노요~'라고 나왔을 때",
    "대형마트에서 카트 끌다가 진열대를 박았는데 모두가 쳐다볼 때",
    "엘리베이터 문 닫히기 직전에 '잠깐요!' 했는데 이미 닫혔을 때",
    "화상회의 중 음소거 안 한 채로 혼자 중얼거렸는데 다 들렸을 때",
    "약속 장소 잘못 알고 다른 지점에 혼자 앉아 20분 기다렸을 때",
    "편의점에서 계산하고 나왔는데 봉투에 물건 반이 빠져있을 때",
    "버스 탔는데 방금 충전한 교통카드 잔액이 0원일 때",
    "식당에서 주문 후 '아 죄송한데 그거 지금 품절이에요' 들을 때",
    "미팅 가서 명함 꺼내려는데 명함지갑이 없을 때",
    "카페 음료 받아서 입에 대는데 뚜껑이 안 닫혀 있었을 때",
    "이어폰 꽂고 음악 들으면서 혼자 흥얼거렸는데 이어폰이 안 꽂혀 있었을 때",
    "시험 당일 아침에 시험지 집에 두고 온 걸 교실 들어서면서 알았을 때",
    "택배 기사님이 문 앞에 두고 갔는데 이미 누가 가져간 것 같을 때",
    "헬스장에서 운동하다가 맞은 편 사람이랑 계속 눈 마주칠 때",
    "공중화장실에서 휴지 없다는 걸 이미 들어와서 문 닫고 알았을 때",
    "길 물어보러 갔더니 그분도 이 동네 처음이라고 할 때",
    "식당에서 주문했는데 옆 테이블에 내가 시킨 거 먼저 나올 때",
    "회의실에서 내 발표 차례인데 노트북 연결이 안 될 때",
    "점심시간에 혼밥하려고 갔더니 아는 사람과 눈 마주쳤는데 둘 다 혼자일 때",
    "노래방 기기가 이상해서 점수가 계속 0점 나올 때",
  ],
  horror: [
    "옆집 좀비가 문 두드리는데 숨 참는 연기",
    "귀신의 집 들어갔는데 앞사람이 갑자기 사라졌을 때",
    "새벽에 혼자 화장실 거울 보다가 내 뒤에 뭔가 지나간 것 같을 때",
    "공동묘지 옆 지름길로 가야 하는데 이미 들어와버렸을 때",
    "불 끄고 자려고 누웠는데 핸드폰에 '문 잠갔어?' 문자가 왔을 때",
    "오래된 엘리베이터 타고 올라가다 중간에 멈췄을 때",
    "심야에 아무도 없는 학교 복도를 지나야 할 때",
    "캠핑 중 텐트 밖에서 인기척이 나는데 일행은 다 안에 있을 때",
    "잠들기 직전 누군가 내 이름 부르는 소리가 들렸을 때",
    "숨바꼭질 하다가 숨어있는데 찾으러 오는 발소리가 멈췄을 때",
    "폐건물 탐험하다가 방문을 열었는데 안에 침대가 정리돼 있을 때",
    "혼자 야근하는데 분명 퇴근한 동료 자리에 불이 켜져 있을 때",
    "밤에 편의점 화장실 들어갔는데 안에서 잠겨있고 인기척도 없을 때",
    "새벽에 혼자 집에 있는데 갑자기 아이 웃음소리가 들릴 때",
    "버려진 집 지나가다 2층 커튼 뒤에서 누군가 쳐다보고 있는 것 같을 때",
    "자다가 일어났는데 내 발 밑에 뭔가 누워있는 것 같을 때",
    "공원 벤치에 앉아 있는데 옆에 아무도 없는데 벤치가 움직이는 것 같을 때",
    "가족사진 찍었는데 뒤에 처음 보는 사람이 찍혀 있을 때",
    "산속 길 잃어서 헤매다가 불 켜진 빈집을 발견했을 때",
    "지하철에서 조는데 내 어깨에 누군가 기댔는데 고개 들어보니 아무도 없을 때",
    "혼자 집에 있는데 아무도 없는 방에서 발소리가 들릴 때",
    "밤에 창문 바깥을 봤는데 아파트 건너편에 누가 이쪽을 보고 서 있을 때",
    "친구들이랑 무인도 캠핑 왔는데 모래사장에 발자국이 새로 생겨있을 때",
    "자정에 강아지가 방구석을 보며 계속 짖는데 아무것도 없을 때",
    "낡은 거울 앞에서 고개 돌렸는데 거울 속 내 모습이 0.5초 늦게 따라올 때",
    "탈출 공포 체험관인데 담당 직원이 이미 5분 전에 퇴근했다고 할 때",
    "폐역 근처 지나가다 분명 운행 종료된 기차 불이 켜진 걸 봤을 때",
    "혼자 늦게 귀가하다 내 그림자가 두 개인 걸 알아챘을 때",
    "캠핑장 화장실 다녀오다가 누군가 내 이름 불렀는데 텐트 친구들은 다 자고 있을 때",
    "새벽 3시에 핸드폰이 저절로 켜지면서 내가 저장 안 한 사진이 갤러리에 있을 때",
  ],
  comedy: [
    "내 주식이 상폐됐는데 애인 앞이라 쿨한 척할 때",
    "세상에서 제일 맛없는 걸 먹고 '이거 진짜 맛있다'고 구라 칠 때",
    "방금 내가 한 말이 생방송에 나간다는 걸 1초 후에 알았을 때",
    "길에서 혼자 넘어지고 아무도 못 봤나 주변 확인할 때",
    "카톡 단체방에 개인 문자 잘못 보내고 1초 후 삭제 누를 때",
    "노래방에서 혼자 신나게 부르다가 문 열리고 사장님이 쳐다봤을 때",
    "친구가 '야 저 사람이랑 닮았어'라는데 그 사람이 바로 옆에 있을 때",
    "발표하다 내용이 완전히 날아갔는데 '아 그게 아니고…'로 버티는 표정",
    "택시 기사님이랑 10분째 침묵인데 목적지가 아직 30분 남았을 때",
    "유튜버인 척했는데 상대방이 진짜로 알아봤을 때",
    "셀카 찍다가 전면 카메라인 줄 알았는데 후면 카메라였을 때",
    "친구 결혼식 주례사 중에 핸드폰이 갑자기 최대 볼륨으로 울렸을 때",
    "유명인이라고 사칭하다가 그 유명인 본인이 걸어오고 있을 때",
    "엄청 맛있는 거 먹는 척 연기해달라는데 그 음식이 사실 처음 먹어보는 거일 때",
    "헬스장에서 너무 무거운 아령 들다가 내려놓지를 못하는 상황",
    "친구랑 싸운 척하는 연기인데 진짜로 화가 나기 시작했을 때",
    "SNS 라이브 켜놓고 혼잣말로 욕을 엄청 했는데 1000명이 보고 있었을 때",
    "계단에서 폼 잡고 내려오다 마지막 계단에서 발 헛디뎠을 때",
    "마지막 남은 치킨 한 조각 두고 친구들이 서로 양보하는 척하는데 나는 진짜로 안 먹을 생각이 없을 때",
    "유행어 완벽하게 외워서 써먹으려는데 그 순간 기억이 안 날 때",
    "프로포즈 이벤트 준비해줬는데 파트너가 '뭐야 이게'라고 할 때",
    "복권 긁다가 1등인 줄 알았는데 보조 번호가 틀렸을 때",
    "친구들 앞에서 요리 잘한다고 자랑했는데 처음 해보는 레시피로 첫 도전일 때",
    "놀이기구 탔는데 무서워 죽겠는데 앞에 아이가 여유롭게 앉아있을 때",
    "이벤트 경품 발표하는데 내 이름 불릴 리 없다고 생각하다가 불렸을 때",
    "헤어스타일 망쳤는데 미용사가 '어때요 마음에 드시죠?'라고 물어볼 때",
    "다이어트 중인 척하다가 친구가 피자 시키자고 했는데 거절해야 할 때",
    "회의에서 지루해서 조는 척했는데 상사가 방금 한 말 다시 말해보래요 할 때",
    "인생 최고 댄스 보여주려고 폼 잡는데 음악이 안 나올 때",
    "에어팟 끼고 노래 따라 불렀는데 에어팟이 방전돼 있었을 때",
  ],
  action: [
    "폭발 직전 건물에서 쿨하게 걸어나오는데 뒤에서 뭔가 날아올 때",
    "총 겨눈 채로 '무기 버려'라고 해야 하는데 상대방이 3명일 때",
    "카 체이싱 중 핸들 잡고 '이 정도는 식은 죽 먹기지' 할 때",
    "10초 안에 폭탄 해제해야 하는데 빨간 선 파란 선 앞에서 고민할 때",
    "격투 끝에 이겼는데 사실 너무 아파서 쓰러질 것 같을 때",
    "낙하산 없이 뛰어내려야 하는데 '별거 아니야'라고 팀원 설득할 때",
    "적군에게 포위됐는데 '이 정도면 나한테 유리한 상황인데?' 할 때",
    "고속도로 차 위에 서서 '다 덤벼' 하는 표정",
    "미션 완료 직후 선글라스 쓰면서 한 마디 날릴 때",
    "사실 너무 무서운데 팀원들 앞에서 '나만 믿어' 할 때",
    "헬기에서 밧줄 타고 내려오다가 밧줄이 흔들릴 때",
    "비 오는 옥상에서 악당과 마지막 대결을 앞두고 있을 때",
    "몸에 작살이 박혔는데 '이 정도는 괜찮아'하며 뽑는 영웅 연기",
    "좁은 골목에서 오토바이로 쫓기면서 코너 돌 때",
    "마지막 총알 하나 남았는데 적은 열 명일 때 쏴야 할지 대화할지 고민",
    "손발이 다 묶였는데 혼자 탈출해야 하는 상황",
    "건물 옥상 끝에서 뛰어내릴 준비를 하는데 발 아래가 30층일 때",
    "같은 팀인 줄 알았던 동료가 배신자임을 알아챈 표정",
    "적이 트랩 설치했다는 걸 이미 밟고 난 다음에 알았을 때",
    "5초 후에 터지는 수류탄을 받아 들고 어디 던져야 할지 계산 중",
    "잠입 작전 중 마스크가 벗겨지려 할 때",
    "급류에 빠졌는데 강 저편으로 수영해야 할 때",
    "단 한 번의 저격 기회가 왔는데 바람이 너무 불어서 조준 힘들 때",
    "두 팔로 천장 파이프에 매달려 경비원 지나가기를 기다리는 상황",
    "설산에서 눈사태 피해 무릎까지 빠지는 눈밭을 달릴 때",
    "잠수함 안에서 산소가 10분밖에 남지 않았는데 탈출구를 찾아야 할 때",
    "한 손으로 절벽 끝에 매달리고 다른 손으로는 동료 잡고 있을 때",
    "빌딩 유리창 외벽을 기어오르는데 밑을 내려다봤을 때",
    "악당 두목과 마지막 협상 테이블에서 무기 없이 앉아있을 때",
    "폭발로 날아가면서도 옆 동료는 지키겠다는 표정",
  ],
  fantasy: [
    "마법이 갑자기 통제 안 돼서 주변이 다 불타고 있는데 '내가 한 거 아님' 할 때",
    "1000년 만에 봉인에서 풀려났는데 세상이 너무 많이 바뀌어서 당황할 때",
    "용사인 줄 알고 왔더니 '죄송한데 저희는 마왕 편이에요' 할 때",
    "마법 거울한테 '세상에서 제일 예쁜 사람이 누구야' 물어봤는데 다른 사람 이름 대줄 때",
    "전생의 적과 이생에서 재회했는데 현재 직업이 치킨집 배달부일 때",
    "사실 나 신이었는데 벌받아서 인간으로 환생했다는 걸 기억해낸 순간",
    "소환사가 가장 강한 몬스터 소환했는데 막상 나온 게 달팽이일 때",
    "타임리프 능력 써서 10년 전으로 돌아갔는데 어차피 또 같은 일 반복될 것 같을 때",
    "내가 주인공인 줄 알았는데 나는 조연이었다는 사실을 알게 됐을 때",
    "마법 약을 마셨는데 불로불사가 됐는데 사실 죽고 싶었던 거 아닌데 일 때",
    "전설의 검을 뽑았는데 생각보다 엄청 무거울 때",
    "용 등에 타서 날아가는데 용이 고소공포증 있다고 방금 말했을 때",
    "예언서에 '선택받은 자'라고 나와있는데 그게 나라는 걸 알게 됐을 때",
    "마법 학교 입학시험 보는데 이미 30살이라서 교수님이 당황할 때",
    "투명인간 마법 쓰고 남의 집 들어갔는데 마법이 갑자기 풀렸을 때",
    "축복의 마법을 받아야 하는데 저주의 마법이 걸렸다는 걸 이제 알았을 때",
    "드래곤볼 다 모아서 소원 빌었는데 '지금 서버 점검 중입니다' 메시지가 떴을 때",
    "500년 넘게 산 뱀파이어인데 아직도 수학 못 해서 계산기 쓸 때",
    "죽은 사람 영혼 보이는 능력 생겼는데 혼자 있는 공간에 영혼이 너무 많을 때",
    "요정들이 소원 들어준다고 해서 빌었는데 해석이 완전 다르게 됐을 때",
    "이세계 전생했는데 직업 뽑기에서 '돌멩이 굴리기' 스킬만 나왔을 때",
    "마지막 보스 잡으러 갔는데 보스가 '나 오늘 쉬는 날이야' 할 때",
    "마법진 그리다가 실수로 대마법사 소환했는데 그 마법사가 나보다 작을 때",
    "하늘을 나는 법 배웠는데 고도 2m에서 마법이 풀려서 떨어지기 직전",
    "정령과 계약했는데 정령이 '오늘 컨디션 안 좋아서 일 못 해'라고 할 때",
    "마법봉 지팡이 휘두르려는데 생각보다 너무 가벼워서 당황할 때",
    "영웅 파티에 들어갔는데 막내여서 설거지 맡게 됐을 때",
    "마물의 왕을 쓰러뜨렸는데 알고 보니 그냥 커다란 고양이였을 때",
    "마법 포션을 마셔서 잠시 무적이 됐는데 5초만에 풀렸을 때",
    "신에게 버림받은 영웅인데 신전 청소 아르바이트 하면서 생계 유지 중일 때",
  ],
  crime: [
    "경찰한테 완벽한 알리바이 댔는데 블랙박스에 내가 찍혀있다는 걸 들었을 때",
    "공범이라고 생각한 사람이 사실 잠복 형사였을 때",
    "범행 현장에서 지문 안 남기려고 장갑 꼈는데 장갑에 이름 새겨져 있을 때",
    "1억 횡령하고 도주하려는데 공항에서 신발 끈 풀렸을 때",
    "위조 신분증 만들었는데 신분증 사진이 생각보다 너무 잘 나왔을 때",
    "비밀 거래 장소로 갔는데 생각보다 너무 밝고 사람 많은 카페일 때",
    "암호 해독했더니 '니 엄마 밥 차려놨다' 였을 때",
    "해킹 다 했는데 해킹한 컴퓨터 안에 내 개인정보도 있었을 때",
    "완벽한 위조지폐 만들었는데 앞뒤가 같은 면일 때",
    "증거 없애러 갔는데 이미 경찰이 먼저 와 있을 때",
    "인질 협상가로 불려갔는데 인질범이 나보다 말을 더 잘할 때",
    "20년 만에 사기 피해자와 우연히 지하철에서 마주쳤을 때",
    "유명 금고 털었는데 안에 저금통이 하나 있을 때",
    "마스크 쓰고 은행 들어갔는데 알고 보니 은행 코스프레 이벤트 날일 때",
    "도주 중 뒤 돌아보니 쫓아오는 사람이 그냥 같은 방향으로 가는 아저씨일 때",
    "10년 걸려 세운 완벽한 범죄 계획이 날씨 때문에 틀어졌을 때",
    "범죄 현장 목격했는데 목격자인 나도 뭔가 잘못한 게 있을 때",
    "수사관인 척 들어갔는데 진짜 수사관한테 발각됐을 때",
    "명탐정처럼 사건 추리했는데 답이 완전히 달랐을 때",
    "범인을 잡았는데 범인이 '저도 피해자예요'라고 할 때",
    "압수수색 영장 없이 들어간 건물에서 예상 외로 귀중한 게 나왔을 때",
    "위협 전화 걸었는데 상대방이 오히려 더 무서울 때",
    "변장하고 파티 잠입했는데 파티 주인공이 나를 먼저 알아봤을 때",
    "보석 훔치러 박물관 들어갔는데 그날따라 경비가 두 배 늘었을 때",
    "내부 고발 하기로 마음먹었는데 내 상사가 이미 또 다른 내부 고발자였을 때",
    "알고 보니 나도 모르는 사이에 범행에 이용당했다는 걸 깨달았을 때",
    "도청기를 심었는데 정작 내 정보가 도청 당하고 있었을 때",
    "완벽하게 위장한 채 잠입했는데 세 번째 암호를 까먹었을 때",
    "용의자를 겨우 붙잡았는데 그 사람이 쌍둥이였을 때",
    "마지막 증거물을 인멸하려는데 그게 이미 복사본이라는 걸 알게 됐을 때",
  ],
  romance: [
    "첫눈에 반한 사람이 내 앞에서 프로포즈를 받고 있을 때",
    "10년 짝사랑하던 사람이 '너랑 결혼할 사람 만났어'라고 말할 때",
    "비 오는 날 우산 없는 상대에게 우산 씌워주다 나만 다 젖었을 때",
    "해외에서 우연히 만난 사람이 귀국하면 다시 못 볼 것 같아서 고백하려는 순간",
    "상대가 '나 좋아하는 사람 있어'라고 했는데 알고 보니 그게 나일 때",
    "카페 자리 없어서 합석했더니 이상형이 앉아있을 때",
    "무뚝뚝하던 사람이 갑자기 꽃을 건네줄 때 놀란 표정",
    "잠깐 눈 마주쳤는데 심장이 멈출 것 같았던 그 찰나의 표정",
    "'그냥 친구야'라고 소개했는데 내 심장이 그걸 거부하고 있을 때",
    "상대방의 실수를 봐주면서 오히려 더 좋아지고 있다는 걸 느낄 때",
    "환자로 입원했는데 담당 의사가 너무 멋있어서 퇴원하기 싫을 때",
    "맞선 자리였는데 분위기가 생각보다 너무 좋아서 당황할 때",
    "상대방이 내 생일을 기억하고 있다는 걸 알게 됐을 때",
    "같은 취미가 있는 걸 갑자기 발견하고 흥분을 숨기려는 표정",
    "분명 관심 없었는데 그 사람이 웃을 때마다 심쿵하는 자신을 발견할 때",
    "싸우려고 했는데 상대 얼굴 보는 순간 뭔 말 하려 했는지 잊어버렸을 때",
    "친구로만 보던 사람이 오늘따라 이상하게 멋있어 보일 때",
    "헤어진 후 처음 만나는 자리인데 여전히 설레는 걸 숨겨야 할 때",
    "분위기 좋은 카페에서 둘이 마주앉아 대화가 끊겼는데 어색하지 않은 그 순간",
    "상대방이 힘들다고 하는데 안아줘도 될지 말지 고민 중인 표정",
    "눈 마주치다가 동시에 빨개진 걸 서로 알아챘을 때",
    "유독 나한테만 다정하게 굴어서 오해하지 않으려고 애쓰는 표정",
    "갑자기 손을 잡혔는데 놓기도 잡고 있기도 애매한 그 순간",
    "늦은 밤 집 앞까지 데려다줬는데 헤어지기 싫은 표정을 숨기는 중",
    "오랫동안 연락 없던 사람한테 갑자기 연락왔는데 아직 설레는 나를 발견할 때",
    "같이 본 영화가 슬프게 끝났는데 상대방이 펑펑 울고 있을 때",
    "술 마시다 '나 사실 오래전부터 좋아했어'라고 하려다 못한 표정",
    "상대방 핸드폰 잠금화면이 나랑 같이 찍은 사진인 걸 봤을 때",
    "꿈에서 고백했는데 현실에서 그 사람 마주쳐서 얼굴이 빨개질 때",
    "밤 12시에 자려다 연락 왔는데 2시간 동안 통화하고 싶다는 표정 숨기기",
  ],
  psycho: [
    "아무것도 안 했는데 죄책감 느껴지는 표정",
    "진짜로 웃긴지 슬픈지 본인도 모르면서 웃고 있을 때",
    "'괜찮아'라고 말하는데 사실 하나도 안 괜찮을 때",
    "주변 사람들이 다 날 싫어하는 것 같은 기분이 드는 표정",
    "3일 동안 침대에서 못 일어나다가 겨우 일어나서 배달 시킨 직후 표정",
    "분명히 청소했는데 더 더러워진 것 같은 기분",
    "대화 중 갑자기 눈물이 나려는데 참으면서 웃는 표정",
    "모두가 잘 사는 것 같은데 나만 뒤처지는 것 같을 때",
    "정신과 처음 예약하려고 전화 받은 순간의 표정",
    "꿈인지 현실인지 모를 것 같은 멍한 표정",
    "누군가 '요즘 어때?'라고 물어봤을 때 진짜로 대답할 수 없을 때",
    "방 청소 하려고 일어났는데 30분째 침대에 앉아만 있을 때",
    "친구한테 문자 보내려다 '귀찮게 하는 거 아닐까' 싶어서 삭제할 때",
    "길 가다 갑자기 아무 이유 없이 눈물이 날 것 같을 때",
    "거울 속 내 모습이 낯설게 느껴지는 표정",
    "잠을 못 자서 멍하게 새벽 5시에 창문 밖을 보는 표정",
    "뭔가 잘못될 것 같은데 뭔지 모르는 불안감",
    "오늘도 별거 안 했는데 너무 지쳐서 일찍 자려는 표정",
    "혼자 밥 먹는데 갑자기 울컥했을 때",
    "오랜만에 연락 온 친구가 반가운데 답하기 힘든 표정",
    "잘 지내는 척하다가 갑자기 한계 온 표정",
    "생각이 너무 많아서 아무것도 못 하고 있는 표정",
    "다 잘 될 거라는 말 들으면서 '그럴 것 같지 않다'는 표정 숨기는 중",
    "기억을 지우고 싶은 것들이 오늘 갑자기 다 떠오를 때",
    "일부러 바쁜 척하면서 혼자인 것 들키지 않으려는 표정",
    "좋아하던 것들이 갑자기 다 의미없게 느껴질 때",
    "주변이 다 변했는데 나만 그대로인 것 같은 기분",
    "잘 지낸다고 했는데 실제로는 잘 못 지내고 있을 때",
    "자신을 믿어보려다가 또 의심하게 되는 그 표정",
    "완전히 지쳐있는데 아무도 모를 것 같아서 더 외로운 그 표정",
  ],
};

function AnalyzeStepItem({ label, delay }: { label: string; delay: number }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setActive(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div className={`flex items-center gap-3 transition-all duration-500 ${active ? "opacity-100" : "opacity-20"}`}>
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${active ? "border-[#C9571A] bg-[#C9571A]" : "border-white/20"}`}>
        {active && (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span className={`text-[14px] font-bold ${active ? "text-white" : "text-white/30"}`}>{label}</span>
    </div>
  );
}

function pickRandomCue(genreId: GenreId): string {
  const pool = CUES[genreId];
  return pool[Math.floor(Math.random() * pool.length)];
}

const VIDEO_CONSTRAINTS = { width: 720, height: 720, facingMode: "user" };

type CaptureItem = { base64: string; dataUrl: string };
type PersonalityAnswer = {
  category: string;
  question: string;
  choice: "A" | "B";
  answer: string;
};
type Phase = "loading" | "login_required" | "no_credits" | "intro" | "genre_select" | "personality_quiz" | "capture_physio_guide" | "capture_physio" | "capture" | "analyzing" | "error";

const QUIZ_QUESTIONS = [
  // 🎭 존재감
  { category: "🎭 존재감", q: "어떤 방식으로 기억되고 싶어?", a: "욕 먹어도 주목받기", b: "칭찬 못 받아도 조용히" },
  { category: "🎭 존재감", q: "낯선 사람들 앞에서 발표할 때", a: "떨어도 당당하게", b: "완벽히 준비될 때까지 미루기" },
  { category: "🎭 존재감", q: "내가 자리 뜬 후 사람들 반응이?", a: "어떤 얘기든 기억에 남기", b: "언급 없어도 괜찮아" },
  { category: "🎭 존재감", q: "파티에서 가장 먼저 하는 건?", a: "분위기 장악하기", b: "조용히 아는 사람 찾기" },
  { category: "🎭 존재감", q: "SNS에서 나는?", a: "반응이 신경 쓰임", b: "그냥 기록용으로만" },
  // 💬 소통
  { category: "💬 소통", q: "감정이 올라왔을 때", a: "그 자리에서 바로 말하기", b: "혼자 삭이다가 나중에 말하기" },
  { category: "💬 소통", q: "상대가 내 말을 오해했을 때", a: "바로 정정하고 설명함", b: "됐다, 나중에 이해하겠지" },
  { category: "💬 소통", q: "중요한 얘기는?", a: "직접 만나서 말하기", b: "메시지로 정리해서 보내기" },
  { category: "💬 소통", q: "갈등이 생겼을 때 나는?", a: "바로 대면해서 해결하기", b: "시간이 해결해주길 기다리기" },
  { category: "💬 소통", q: "칭찬을 받으면?", a: "솔직하게 기뻐하며 받아들임", b: "쑥스러워서 부정함" },
  // 👑 리더십
  { category: "👑 리더십", q: "파티에서 나의 포지션은?", a: "기획하고 이끄는 쪽", b: "초대받아 즐기는 쪽" },
  { category: "👑 리더십", q: "모임에서 누군가 결정을 못 내릴 때", a: "내가 먼저 나서서 결정함", b: "누군가 결정하길 기다림" },
  { category: "👑 리더십", q: "내 결정에 반대 의견이 나오면?", a: "설득해서 내 방향으로 가기", b: "다수 의견으로 수정하기" },
  { category: "👑 리더십", q: "팀 프로젝트에서 나는?", a: "기획하고 이끄는 쪽", b: "맡은 것만 잘 해내는 쪽" },
  { category: "👑 리더십", q: "리더 역할을 맡으면?", a: "짜릿하고 해보고 싶음", b: "부담스럽고 피하고 싶음" },
  // 🧠 사고방식
  { category: "🧠 사고", q: "뭔가 할 때 나의 방식은?", a: "계획 세우고 실행", b: "일단 저지르고 수습" },
  { category: "🧠 사고", q: "직관 vs 데이터, 뭘 더 믿어?", a: "이 느낌이 맞아, 직관", b: "수치와 근거 보고 판단" },
  { category: "🧠 사고", q: "선택지가 너무 많을 때", a: "맘에 드는 거 바로 고르기", b: "모든 경우의 수 따져보기" },
  { category: "🧠 사고", q: "실패했을 때 나는", a: "원인 분석하고 전략 수정", b: "털고 새 시작" },
  { category: "🧠 사고", q: "모호한 상황에서는?", a: "내가 기준 만들어서 정리", b: "흘러가는 대로 보기" },
  // ❤️ 관계
  { category: "❤️ 관계", q: "사람을 어떻게 믿어?", a: "첫인상 그냥 믿기", b: "시간 지나야 믿기" },
  { category: "❤️ 관계", q: "관계 방식은?", a: "소수 깊은 관계", b: "다양한 넓은 인맥" },
  { category: "❤️ 관계", q: "오래된 친구 vs 새 친구?", a: "오래된 친구, 말 안 해도 통함", b: "새 친구, 새로운 자극 있음" },
  { category: "❤️ 관계", q: "누군가 나를 이용했다는 걸 알았을 때?", a: "바로 끊어냄", b: "이유 들어보고 판단" },
  { category: "❤️ 관계", q: "아끼는 사람이 잘못된 길을 갈 때?", a: "직접적으로 말해줌", b: "스스로 깨달을 때까지 기다림" },
  // ⚡ 행동력
  { category: "⚡ 행동", q: "하고 싶은 것 생기면?", a: "당장 실행", b: "충분히 고민 후 실행" },
  { category: "⚡ 행동", q: "마감이 빠듯할 때?", a: "압박감에 오히려 집중됨", b: "미리 다 끝내야 불안 없음" },
  { category: "⚡ 행동", q: "낯선 도전 앞에서?", a: "일단 뛰어들고 배움", b: "준비 다 되면 뛰어듦" },
  { category: "⚡ 행동", q: "계획이 틀어졌을 때?", a: "즉흥적으로 대처함", b: "원래 계획으로 되돌리려 함" },
  { category: "⚡ 행동", q: "결과가 불확실한 기회가 생기면?", a: "일단 잡고 봄", b: "리스크 계산 후 결정" },
  // 🌙 감정 처리
  { category: "🌙 감정", q: "힘들 때 주로?", a: "혼자 조용히 해결", b: "누군가에게 털어놓기" },
  { category: "🌙 감정", q: "화가 머리끝까지 났을 때?", a: "그 자리서 표현함", b: "혼자 삭이고 넘어감" },
  { category: "🌙 감정", q: "실수했을 때 나는?", a: "금방 털고 앞으로 가기", b: "죄책감에 오래 괴로워하기" },
  { category: "🌙 감정", q: "기쁜 일이 생겼을 때?", a: "주변에 바로 공유함", b: "혼자 조용히 즐김" },
  { category: "🌙 감정", q: "감정을 숨기는 편 vs 드러내는 편?", a: "감정 드러내는 편", b: "감정 숨기는 편" },
  // 🎯 목표 의식
  { category: "🎯 목표", q: "목표를 세울 때?", a: "크게 잡고 달려감", b: "현실적으로 단계별로 잡음" },
  { category: "🎯 목표", q: "꿈이 아직 불확실할 때?", a: "일단 움직이며 찾아감", b: "확실해질 때까지 탐색" },
  { category: "🎯 목표", q: "목표 달성이 멀게 느껴질 때?", a: "더 세게 밀어붙임", b: "목표를 현실적으로 조정함" },
  { category: "🎯 목표", q: "성공보다 중요한 게 있다면?", a: "과정이 더 중요해", b: "결과가 다 말해줘" },
  { category: "🎯 목표", q: "나에게 경쟁은?", a: "성장의 자극", b: "스트레스의 원인" },
  // 🔥 야망
  { category: "🔥 야망", q: "나한테 상처 준 사람한테", a: "언젠가 복수할 기회 잡기", b: "무시하고 내 길 가기" },
  { category: "🔥 야망", q: "인정받는 것 vs 실력 있는 것?", a: "인정받는 게 더 중요", b: "실력이 있으면 언젠간 인정받음" },
  { category: "🔥 야망", q: "1등 vs 오래 가는 것?", a: "잠깐이라도 1등 해보기", b: "꾸준히 오래 가기" },
  { category: "🔥 야망", q: "원하는 걸 얻기 위해?", a: "수단 방법 안 가리는 편", b: "방식도 중요함" },
  { category: "🔥 야망", q: "내 재능을 인정 못 받을 때?", a: "더 증명해 보임", b: "이 환경이 안 맞는 거라 생각함" },
  // 🛡️ 자기보호
  { category: "🛡️ 자기보호", q: "말하면 안 될 걸 알면?", a: "비밀 지키다 속으로 터지기", b: "말해버리고 나중에 후회하기" },
  { category: "🛡️ 자기보호", q: "속마음과 겉모습 중 선택해야 한다면?", a: "속 착해도 나쁜 사람인 척", b: "속 복잡해도 좋은 사람인 척" },
  { category: "🛡️ 자기보호", q: "어려운 일이 생기면?", a: "혼자서 다 해결하기", b: "주변에 도움 요청하기" },
  { category: "🛡️ 자기보호", q: "내 약점을 누군가 건드렸을 때?", a: "바로 반응하고 표현함", b: "아무렇지 않은 척 넘김" },
  { category: "🛡️ 자기보호", q: "지금 나에게 가장 필요한 건?", a: "한 번쯤 제대로 폭발하기", b: "조용히 쉬면서 충전하기" },
];

// ── 컴포넌트 ──────────────────────────────────────────────────────────
function AuditionSoloInner() {
  const searchParams = useSearchParams();
  const fromIntro = searchParams?.get("from_intro") === "1";
  const [phase, setPhase] = useState<Phase>("loading");
  const [selectedGenres, setSelectedGenres] = useState<GenreId[]>([]);
  const [stepCues, setStepCues] = useState<string[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [personalityAnswers, setPersonalityAnswers] = useState<PersonalityAnswer[]>([]);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnim, setQuizAnim] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [physioCapture, setPhysioCapture] = useState<CaptureItem | null>(null);
  const [physioCountdown, setPhysioCountdown] = useState<number | null>(null);
  const [physioPreviewUrl, setPhysioPreviewUrl] = useState<string | null>(null);
  const [physioCheck, setPhysioCheck] = useState<PhysioPhotoCheck | null>(null);
  const [isPhysioChecking, setIsPhysioChecking] = useState(false);
  const [pendingCapture, setPendingCapture] = useState<CaptureItem | null>(null);
  const webcamRef = useRef<ReactWebcam | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const physioCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const { user, loading: authLoading, login } = useAuth();

  // 카테고리별 1문제씩 랜덤 추출 (총 10개)
  const quizQuestions = useMemo(() => {
    const categories = [...new Set(QUIZ_QUESTIONS.map(q => q.category))];
    return categories.map(cat => {
      const pool = QUIZ_QUESTIONS.filter(q => q.category === cat);
      return pool[Math.floor(Math.random() * pool.length)];
    });
  }, []);

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);
  useEffect(() => () => { if (physioCountdownRef.current) clearInterval(physioCountdownRef.current); }, []);
  useEffect(() => {
    if (!physioPreviewUrl) {
      setPhysioCheck(null);
      setIsPhysioChecking(false);
      return;
    }

    let cancelled = false;
    setIsPhysioChecking(true);

    analyzePhysioPhoto(physioPreviewUrl)
      .then((nextCheck) => {
        if (cancelled) return;
        setPhysioCheck(nextCheck);
      })
      .catch(() => {
        if (cancelled) return;
        setPhysioCheck({
          status: "unsupported",
          geometry: {
            imageWidth: 1000,
            imageHeight: 1250,
            faceBox: { x: 250, y: 140, width: 500, height: 720 },
            points: [],
            detected: false,
          },
          reason: "이 브라우저는 얼굴 자동 판별을 안정적으로 수행하지 못해 서버에서 최종 판별합니다.",
        });
      })
      .finally(() => {
        if (cancelled) return;
        setIsPhysioChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [physioPreviewUrl]);

  // 인증 + 크레딧 체크
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setPhase("login_required"); return; }
    fetch("/api/credits")
      .then(r => r.json())
      .then(data => {
        const c = data.credits ?? 0;
        setCredits(c);
        if (c < 5) setPhase("no_credits");
        else if (fromIntro) setPhase("genre_select");
        else setPhase("intro");
      })
      .catch(() => setPhase("no_credits"));
  }, [authLoading, user, fromIntro]);

  // 3장 모이면 바로 분석 시작
  useEffect(() => {
    if (captures.length === 0) return;
    if (captures.length < 3) { setStepIdx(captures.length); return; }

    setPhase("analyzing");

    const images = captures.map(c => c.base64);
    const previewDataUrl = captures[2].dataUrl;
    const genreLabels = selectedGenres.map(g => GENRES.find(x => x.id === g)?.label ?? g);
    const genreMeta = selectedGenres.map((g, i) => ({
      genre: GENRES.find(x => x.id === g)?.label ?? g,
      cue: stepCues[i],
    }));

    const MIN_LOADING_MS = 10000;
    const minWait = new Promise<void>(r => setTimeout(r, MIN_LOADING_MS));

    const fetchResult = fetch("/api/audition/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        images,
        physioImage: physioCapture?.base64 ?? images[0],
        genres: genreLabels,
        cues: stepCues,
        personality: personalityAnswers.map((item, idx) => `Q${idx + 1}. [${item.category}] ${item.question} -> ${item.choice}: ${item.answer}`),
      }),
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "분석 실패");
      return data;
    });

    Promise.all([fetchResult, minWait])
      .then(([data]) => {
        sessionStorage.setItem("sd_au_result", JSON.stringify(data));
        sessionStorage.setItem("sd_au_preview", previewDataUrl);
        sessionStorage.setItem("sd_au_genres", JSON.stringify(genreMeta));
        sessionStorage.setItem("sd_au_images", JSON.stringify(captures.map(c => c.dataUrl)));
        if (physioCapture) sessionStorage.setItem("sd_au_physio", physioCapture.dataUrl);
        sessionStorage.setItem("sd_au_personality", JSON.stringify(personalityAnswers));
        router.push("/audition/result");
      })
      .catch(err => {
        setErrorMsg(err.message ?? "감독님이 자리를 비웠습니다. 다시 시도해주세요.");
        setPhase("error");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captures]);

  const startCapture = useCallback(() => {
    const cues = selectedGenres.map(g => pickRandomCue(g));
    setStepCues(cues);
    setCaptures([]);
    setStepIdx(0);
    setPhysioCapture(null);
    setPhysioPreviewUrl(null);
    setPhysioCheck(null);
    setPhase("capture_physio_guide");
  }, [selectedGenres]);


  const doCapture = useCallback(() => {
    const screenshot = webcamRef.current?.getScreenshot();
    if (!screenshot) return;
    setPendingCapture({ base64: screenshot.split(",")[1], dataUrl: screenshot });
  }, []);

  const confirmCapture = useCallback(() => {
    if (!pendingCapture) return;
    setCaptures(prev => [...prev, pendingCapture]);
    setPendingCapture(null);
  }, [pendingCapture]);

  const retakePending = useCallback(() => {
    setPendingCapture(null);
  }, []);

  const startPhysioCountdown = useCallback(() => {
    if (physioCountdown !== null) return;
    let count = 3;
    setPhysioCountdown(count);
    physioCountdownRef.current = setInterval(() => {
      count--;
      if (count === 0) {
        clearInterval(physioCountdownRef.current!);
        setPhysioCountdown(null);
        const screenshot = webcamRef.current?.getScreenshot();
        if (screenshot) setPhysioPreviewUrl(screenshot);
      } else {
        setPhysioCountdown(count);
      }
    }, 1000);
  }, [physioCountdown]);

  const startCountdown = useCallback(() => {
    if (countdown !== null) return;
    let count = 3;
    setCountdown(count);
    countdownRef.current = setInterval(() => {
      count--;
      if (count === 0) {
        clearInterval(countdownRef.current!);
        setCountdown(null);
        doCapture();
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, [countdown, doCapture]);

  const retake = (idx: number) => {
    setCaptures(prev => prev.slice(0, idx));
    setStepIdx(idx);
  };

  const toggleGenre = (id: GenreId) => {
    setSelectedGenres(prev =>
      prev.includes(id)
        ? prev.filter(g => g !== id)
        : prev.length < 3 ? [...prev, id] : prev
    );
  };


  // ── LOADING ──────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#C9571A]" style={{ animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  // ── 로그인 필요 ──────────────────────────────────────────────────
  if (phase === "login_required") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="h-[52px] bg-white border-b border-gray-100 flex items-center px-4">
          <Link href="/studio" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6 max-w-sm mx-auto w-full">
          <div className="text-[52px]">🎬</div>
          <div>
            <p className="text-[11px] font-bold text-[#C9571A] tracking-[0.2em] uppercase mb-2">AI 오디션</p>
            <h2 className="text-[22px] font-extrabold text-gray-900 leading-tight">로그인이 필요한 기능이에요</h2>
            <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
              카카오 로그인 후 무료 크레딧으로<br />오디션에 도전해보세요
            </p>
          </div>
          <button
            onClick={login}
            className="w-full h-[52px] bg-[#FEE500] hover:bg-[#F0D900] text-[#191919] font-bold text-[15px] rounded-full transition-colors flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M9 0.5C4.306 0.5 0.5 3.462 0.5 7.1c0 2.302 1.528 4.325 3.84 5.497l-.98 3.657a.25.25 0 00.383.273L7.89 14.01A10.6 10.6 0 009 14.1c4.694 0 8.5-2.962 8.5-6.6S13.694.5 9 .5z" fill="#191919"/>
            </svg>
            카카오로 시작하기
          </button>
          <Link href="/studio" className="text-[13px] text-gray-400 hover:text-gray-900 transition-colors">돌아가기</Link>
        </main>
      </div>
    );
  }

  // ── 크레딧 부족 ──────────────────────────────────────────────────
  if (phase === "no_credits") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="h-[52px] bg-white border-b border-gray-100 flex items-center px-4">
          <Link href="/studio" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6 max-w-sm mx-auto w-full">
          <div className="text-[52px]">💳</div>
          <div>
            <p className="text-[11px] font-bold text-[#C9571A] tracking-[0.2em] uppercase mb-2">AI 오디션</p>
            <h2 className="text-[22px] font-extrabold text-gray-900 leading-tight">크레딧이 부족해요</h2>
            <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
              AI 오디션은 <span className="text-gray-900 font-bold">5크레딧</span>이 필요해요.<br />
              현재 보유: <span className="text-[#C9571A] font-bold">{credits}크레딧</span>
            </p>
          </div>
          <Link href="/shop" className="w-full h-[52px] bg-[#C9571A] hover:bg-[#B34A12] text-white font-bold text-[15px] rounded-full transition-colors flex items-center justify-center">
            크레딧 충전하기
          </Link>
          <Link href="/studio" className="text-[13px] text-gray-400 hover:text-gray-900 transition-colors">돌아가기</Link>
        </main>
      </div>
    );
  }

  // ── INTRO ────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="h-[52px] bg-white border-b border-gray-100 flex items-center justify-between px-4 sticky top-0 z-40">
          <Link href="/studio" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
          <div className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1">
            <span className="text-[11px] text-gray-500">보유</span>
            <span className="text-[15px] font-extrabold text-gray-900">{credits}</span>
            <span className="text-[11px] text-gray-500">크레딧</span>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-5 text-center gap-6 max-w-sm mx-auto w-full py-10">
          <div className="text-[52px]">🎬</div>
          <div>
            <p className="text-[11px] font-bold text-[#C9571A] tracking-[0.2em] uppercase mb-2">AI 오디션</p>
            <h1 className="text-[28px] font-extrabold text-gray-900 leading-tight">AI 오디션</h1>
            <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
              장르 3개를 고르고 표정 연기를 해봐요.<br />
              AI 감독이 냉혹하게 심사합니다.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 w-full flex flex-col items-center gap-1.5 text-center">
            <span className="text-[22px]">🎭</span>
            <p className="text-[14px] text-gray-900 font-bold leading-snug">
              미션 큐는 촬영 직전에 공개됩니다
            </p>
          </div>

          <div className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 flex flex-col gap-3">
            <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">오디션 전 확인사항</p>
            <ul className="flex flex-col gap-2.5">
              <li className="flex items-start gap-2.5">
                <span className="text-[14px] shrink-0 mt-0.5">🌶️</span>
                <p className="text-[13px] text-gray-600 leading-snug">매운맛/순한맛에 따라 평가 강도가 달라집니다. 상처받지 말고 재미로 봐주세요</p>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-[14px] shrink-0 mt-0.5">📸</span>
                <p className="text-[13px] text-gray-600 leading-snug">한번 촬영한 컷은 다시 찍을 수 없으니 이점 유의해주세요</p>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-[14px] shrink-0 mt-0.5">💳</span>
                <p className="text-[13px] text-gray-600 leading-snug">시작 시 5크레딧이 바로 소모되며, 스틸컷 생성까지 포함된 패키지입니다</p>
              </li>
            </ul>
            <label className="flex items-center gap-3 mt-1 cursor-pointer select-none" onClick={() => setAgreed(v => !v)}>
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${agreed ? "bg-black border-black" : "border-gray-300 bg-white"}`}>
                {agreed && <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <p className="text-[14px] text-gray-900 font-bold">위 내용을 모두 확인했습니다</p>
            </label>
          </div>

          <div className="w-full flex flex-col gap-2">
            <button
              onClick={() => setPhase("genre_select")}
              disabled={!agreed}
              className="w-full bg-black hover:bg-gray-900 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold py-4 rounded-2xl text-[16px] transition-colors flex items-center justify-center gap-2.5"
            >
              <span className="text-[12px] font-extrabold bg-white/20 rounded-lg px-2 py-0.5">5크레딧</span>
              시작하기
            </button>
          </div>

          <Link href="/studio" className="text-[13px] text-gray-400 hover:text-gray-900 transition-colors">돌아가기</Link>
        </main>
      </div>
    );
  }

  // ── 장르 선택 ────────────────────────────────────────────────────
  if (phase === "genre_select") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="h-[52px] bg-white border-b border-gray-100 flex items-center justify-between px-4 sticky top-0 z-40">
          <Link href="/studio" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
          <span className="text-[12px] font-bold text-gray-500">{selectedGenres.length} / 3 선택</span>
        </header>
        <main className="flex-1 flex flex-col px-5 py-8 gap-6 max-w-sm mx-auto w-full">
          <div className="text-center">
            <p className="text-[11px] font-bold text-[#C9571A] tracking-[0.2em] uppercase mb-2">STEP 1</p>
            <h2 className="text-[24px] font-black text-gray-900 leading-tight">연기할 장르를 골라요</h2>
            <p className="text-[14px] text-gray-500 mt-1.5">3가지를 선택하면 시작됩니다</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {GENRES.map(g => {
              const selected = selectedGenres.includes(g.id);
              const disabled = !selected && selectedGenres.length >= 3;
              return (
                <button
                  key={g.id}
                  onClick={() => toggleGenre(g.id)}
                  disabled={disabled}
                  className={`relative flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border-2 transition-all ${
                    selected
                      ? "bg-[#C9571A]/10 border-[#C9571A] text-gray-900"
                      : disabled
                      ? "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed"
                      : "bg-gray-50 border-gray-100 text-gray-700 hover:border-[#C9571A]/40"
                  }`}
                >
                  {selected && (
                    <div className="absolute top-2.5 right-2.5 w-5 h-5 bg-[#C9571A] rounded-full flex items-center justify-center">
                      <span className="text-[10px] text-white font-bold">{selectedGenres.indexOf(g.id) + 1}</span>
                    </div>
                  )}
                  <span className="text-[32px]">{g.emoji}</span>
                  <span className="text-[14px] font-bold">{g.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 mt-auto">
            <button
              onClick={() => { setQuizStep(0); setPersonalityAnswers([]); setPhase("personality_quiz"); }}
              disabled={selectedGenres.length < 3}
              className="w-full bg-black hover:bg-gray-900 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold py-4 rounded-2xl text-[16px] transition-colors"
            >
              {selectedGenres.length < 3 ? `${3 - selectedGenres.length}개 더 선택해요` : "다음 →"}
            </button>
            <button onClick={() => setPhase("intro")} className="text-[13px] text-gray-400 hover:text-gray-900 transition-colors py-1">
              이전으로
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── 성향 퀴즈 ────────────────────────────────────────────────────
  if (phase === "personality_quiz") {
    const current = quizQuestions[quizStep];
    const progress = ((quizStep + 1) / quizQuestions.length) * 100;

    const handleAnswer = (choice: "A" | "B") => {
      const next = [
        ...personalityAnswers,
        {
          category: current.category,
          question: current.q,
          choice,
          answer: choice === "A" ? current.a : current.b,
        },
      ];
      setPersonalityAnswers(next);
      setQuizAnim(true);
      setTimeout(() => {
        setQuizAnim(false);
        if (quizStep + 1 >= quizQuestions.length) {
          startCapture();
        } else {
          setQuizStep(s => s + 1);
        }
      }, 180);
    };

    return (
      <div className="min-h-screen bg-white flex flex-col" style={{ height: "100dvh" }}>
        <style>{`
          @keyframes quiz-in { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
          @keyframes quiz-out { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(-10px)} }
        `}</style>

        {/* 헤더 */}
        <header className="h-[52px] flex items-center justify-between px-5 border-b border-gray-100 flex-shrink-0">
          <button onClick={() => quizStep === 0 ? setPhase("genre_select") : setQuizStep(s => s - 1)}
            className="text-gray-400 hover:text-gray-900 transition-colors">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 16l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="text-[13px] font-bold text-gray-900">{quizStep + 1} / {quizQuestions.length}</span>
          <div className="w-5" />
        </header>

        {/* 진행 바 */}
        <div className="h-1.5 bg-gray-100 flex-shrink-0">
          <div className="h-full bg-[#C9571A] transition-all duration-500 rounded-r-full" style={{ width: `${progress}%` }} />
        </div>

        <main
          className="flex-1 flex flex-col px-5 pt-7 pb-8 gap-6 max-w-sm mx-auto w-full overflow-hidden"
          style={{ animation: quizAnim ? "quiz-out 0.18s ease-in forwards" : "quiz-in 0.25s ease-out" }}
        >
          {/* 카테고리 + 질문 */}
          <div>
            <p className="text-[11px] font-black text-[#C9571A] tracking-[0.3em] uppercase mb-2">{current.category}</p>
            <p className="text-[22px] font-black text-gray-900 leading-snug">{current.q}</p>
          </div>

          {/* 세로형 선택 카드 */}
          <div className="flex flex-col gap-3 flex-1">
            <button
              onClick={() => handleAnswer("A")}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-gray-100 bg-gray-50 hover:border-[#C9571A] hover:bg-orange-50 active:scale-[0.98] transition-all text-left"
            >
              <span className="text-[13px] font-black text-[#C9571A] tracking-[0.2em] uppercase flex-shrink-0 w-5">A</span>
              <span className="text-[22px] font-black text-gray-900 leading-tight">{current.a}</span>
            </button>
            <button
              onClick={() => handleAnswer("B")}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-gray-100 bg-gray-50 hover:border-[#C9571A] hover:bg-orange-50 active:scale-[0.98] transition-all text-left"
            >
              <span className="text-[13px] font-black text-[#C9571A] tracking-[0.2em] uppercase flex-shrink-0 w-5">B</span>
              <span className="text-[22px] font-black text-gray-900 leading-tight">{current.b}</span>
            </button>
          </div>

          <p className="text-center text-[12px] text-gray-400">직관적으로 선택하세요 — 정답은 없어요</p>
        </main>
      </div>
    );
  }

  // ── ANALYZING ────────────────────────────────────────────────────
  const lastPhoto = captures[2]?.dataUrl ?? captures[captures.length - 1]?.dataUrl;

  // ── 관상 촬영 가이드 ──────────────────────────────────────────────
  if (phase === "capture_physio_guide") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="h-[52px] bg-white border-b border-gray-100 flex items-center justify-between px-4 sticky top-0 z-40">
          <Link href="/studio" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
          <span className="text-[12px] font-bold text-gray-500">STEP 3</span>
        </header>
        <main className="flex-1 flex flex-col px-5 py-8 gap-6 max-w-sm mx-auto w-full">
          <div className="text-center">
            <p className="text-[11px] font-bold text-[#C9571A] tracking-[0.2em] uppercase mb-2">관상 분석용 사진</p>
            <h2 className="text-[24px] font-black text-gray-900 leading-tight">얼굴 정면 사진을<br />찍어주세요</h2>
            <p className="text-[13px] text-gray-500 mt-2">AI가 관상을 분석합니다. 아래 조건을 지켜주세요.</p>
          </div>

          {/* 타원 가이드 일러스트 */}
          <div className="flex items-center justify-center">
            <div className="relative w-[180px] h-[220px]">
              <div className="absolute inset-0 rounded-[50%] border-[3px] border-dashed border-[#C9571A]/60" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[64px]">🙂</span>
              </div>
              {/* 가이드 점 */}
              <div className="absolute top-[18%] left-[50%] -translate-x-1/2 w-2 h-2 rounded-full bg-[#C9571A]/70" />
              <div className="absolute top-[40%] left-[22%] w-1.5 h-1.5 rounded-full bg-[#C9571A]/50" />
              <div className="absolute top-[40%] right-[22%] w-1.5 h-1.5 rounded-full bg-[#C9571A]/50" />
              <div className="absolute top-[58%] left-[50%] -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#C9571A]/50" />
              <div className="absolute top-[72%] left-[50%] -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#C9571A]/50" />
            </div>
          </div>

          {/* 촬영 조건 */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col gap-3">
            <p className="text-[11px] font-black text-gray-400 tracking-widest uppercase">필수 촬영 조건</p>
            {[
              { icon: "☀️", text: "밝은 조명 아래에서 찍어주세요", bold: true },
              { icon: "👁️", text: "카메라를 정면으로 바라봐주세요", bold: true },
              { icon: "😐", text: "자연스러운 무표정으로 찍어주세요", bold: false },
              { icon: "🚫", text: "모자나 선글라스는 반드시 벗어주세요", bold: true },
              { icon: "📐", text: "얼굴이 화면 중앙에 오도록 해주세요", bold: false },
            ].map(({ icon, text, bold }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-[18px] shrink-0">{icon}</span>
                <p className={`text-[14px] leading-snug ${bold ? "font-bold text-gray-900" : "font-medium text-gray-600"}`}>{text}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 mt-auto">
            <button
              onClick={() => setPhase("capture_physio")}
              className="w-full bg-black hover:bg-gray-900 text-white font-bold py-4 rounded-2xl text-[16px] transition-colors"
            >
              촬영 시작 →
            </button>
            <button onClick={() => setPhase("personality_quiz")} className="text-[13px] text-gray-400 hover:text-gray-900 transition-colors py-1">
              이전으로
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── 관상용 셀카 촬영 ──────────────────────────────────────────────
  if (phase === "capture_physio") {
    // 프리뷰 모드
    if (physioPreviewUrl) {
      const needsRetry = physioCheck?.status === "retry_required";
      const canProceed = !isPhysioChecking && physioCheck?.status !== "retry_required";
      return (
        <div className="bg-[#0A0A0A] flex flex-col" style={{ height: "100dvh" }}>
          <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center justify-between px-4 flex-shrink-0">
            <span className="text-[13px] font-bold text-white/60">촬영 확인</span>
            <span className="text-[11px] font-bold text-[#C9571A] bg-[#C9571A]/15 px-3 py-1 rounded-full">관상 사진</span>
          </header>
          <main className="flex-1 flex flex-col px-4 py-4 gap-4">
            <p className="text-[14px] font-bold text-white text-center">이 사진으로 관상 분석을 진행할까요?</p>
            <div className={PHYSIO_FRAME_CLASS}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={physioPreviewUrl} alt="관상 사진" className="absolute inset-0 w-full h-full object-cover" />
              {/* 타원 오버레이 */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div style={{ ...PHYSIO_OVAL_STYLE, border: "2px solid rgba(201,87,26,0.6)" }} />
              </div>
            </div>
            <div className={`rounded-2xl border px-4 py-3 ${needsRetry ? "border-[#C9571A]/30 bg-[#2A140C]" : "border-white/10 bg-white/5"}`}>
              <p className={`text-[12px] font-bold ${needsRetry ? "text-[#FFB089]" : "text-white/85"}`}>
                {isPhysioChecking
                  ? "얼굴 위치를 확인하는 중입니다..."
                  : physioCheck?.status === "retry_required"
                    ? physioCheck.reason
                    : physioCheck?.status === "unsupported"
                      ? physioCheck.reason
                      : "정면 얼굴이 확인되었습니다. 이 사진으로 관상 분석을 진행할 수 있습니다."}
              </p>
            </div>
            <div className="mt-auto flex gap-3">
              <button
                onClick={() => {
                  setPhysioPreviewUrl(null);
                  setPhysioCheck(null);
                }}
                className="flex-1 bg-white/10 border border-white/20 text-white font-bold py-4 rounded-2xl text-[15px] transition-colors"
              >
                다시 찍기
              </button>
              <button
                onClick={() => {
                  if (!canProceed) return;
                  setPhysioCapture({ base64: physioPreviewUrl.split(",")[1], dataUrl: physioPreviewUrl });
                  setPhysioPreviewUrl(null);
                  setPhysioCheck(null);
                  setPhase("capture");
                }}
                disabled={!canProceed}
                className="flex-1 bg-[#C9571A] disabled:bg-[#2A2A2A] disabled:text-white/35 text-white font-bold py-4 rounded-2xl text-[15px] transition-colors"
              >
                {isPhysioChecking ? "얼굴 확인 중..." : needsRetry ? "정면 얼굴로 다시 찍기" : "이대로 진행하기"}
              </button>
            </div>
          </main>
        </div>
      );
    }

    // 카운트다운 + 웹캠
    return (
      <div className="bg-[#0A0A0A] flex flex-col" style={{ height: "100dvh" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center px-4 flex-shrink-0 z-40">
          <span className="text-[13px] font-bold text-white/60">관상 분석용 정면 사진</span>
        </header>

        <main className="flex-1 flex flex-col px-4 py-3 gap-3 min-h-0">
          {/* 웹캠 1:1 + 타원 오버레이 */}
          <div className={PHYSIO_FRAME_CLASS}>
            <Webcam
              ref={webcamRef}
              audio={false}
              disablePictureInPicture={true}
              forceScreenshotSourceSize={false}
              imageSmoothing={true}
              onUserMedia={HANDLE_WEBCAM_READY}
              onUserMediaError={HANDLE_WEBCAM_ERROR}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.9}
              videoConstraints={VIDEO_CONSTRAINTS}
              mirrored
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* 타원 가이드 오버레이 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div
                style={{
                  ...PHYSIO_OVAL_STYLE,
                  border: "2.5px dashed rgba(201,87,26,0.75)",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                }}
              />
            </div>
            {/* 카운트다운 오버레이 */}
            {physioCountdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                <span className="text-white font-extrabold leading-none" style={{ fontSize: "30vw", textShadow: "0 0 40px rgba(201,87,26,0.9)" }}>
                  {physioCountdown}
                </span>
              </div>
            )}
            {/* 안내 텍스트 */}
            {physioCountdown === null && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10">
                <p className="text-white/80 text-[12px] font-bold bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm">
                  얼굴을 타원 안에 맞춰주세요
                </p>
              </div>
            )}
          </div>

          {/* 촬영 버튼 */}
          <button
            onClick={startPhysioCountdown}
            disabled={physioCountdown !== null}
            className="w-full bg-[#C9571A] hover:bg-[#B34A12] disabled:bg-[#2A2A2A] disabled:text-white/30 text-white font-bold py-4 rounded-2xl text-[16px] transition-colors flex items-center justify-center gap-2 flex-shrink-0"
          >
            {physioCountdown !== null ? (
              <span className="text-[22px] font-extrabold tabular-nums">{physioCountdown}</span>
            ) : (
              <><span>📸</span><span>관상용 정면 찍기</span></>
            )}
          </button>
        </main>
      </div>
    );
  }

  if (phase === "analyzing") {
    const ANALYZE_STEPS = [
      { label: `씬 1 (${selectedGenres[0] ? GENRES.find(g => g.id === selectedGenres[0])?.label : ""}) 분석 중`, delay: 0 },
      { label: `씬 2 (${selectedGenres[1] ? GENRES.find(g => g.id === selectedGenres[1])?.label : ""}) 분석 중`, delay: 1700 },
      { label: `씬 3 (${selectedGenres[2] ? GENRES.find(g => g.id === selectedGenres[2])?.label : ""}) 분석 중`, delay: 3400 },
      { label: "관상 분석 중", delay: 5200 },
      { label: "성향 분석 중", delay: 7000 },
      { label: "결과 생성 중", delay: 8800 },
    ];
    return (
      <div className="min-h-screen bg-[#0A0A0A] relative overflow-hidden flex flex-col items-center justify-center">
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes step-in { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
        `}</style>
        {lastPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lastPhoto} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/90" />

        <div className="relative z-10 flex flex-col items-center gap-10 px-8 w-full max-w-sm">
          {/* 스피너 */}
          <div className="relative w-20 h-20 flex items-center justify-center">
            {lastPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lastPhoto} alt="" className="w-14 h-14 rounded-xl object-cover opacity-70" />
            )}
            <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#C9571A] border-r-[#C9571A]/30"
              style={{ animation: "spin 1s linear infinite" }} />
          </div>

          {/* 단계별 체크리스트 */}
          <div className="w-full flex flex-col gap-3">
            <p className="text-[10px] font-black text-[#C9571A] tracking-[0.3em] uppercase mb-1">
              🎬 AI 감독 심사 중
            </p>
            {ANALYZE_STEPS.map((step, i) => (
              <AnalyzeStepItem key={i} label={step.label} delay={step.delay} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="text-[40px]">😵</p>
        <p className="text-gray-900 font-bold text-[18px]">오디션이 중단됐습니다</p>
        <p className="text-gray-500 text-[14px]">{errorMsg}</p>
        <Link href="/studio" className="text-[13px] text-gray-400 hover:text-gray-900 transition-colors">
          밖으로 나가기
        </Link>
      </div>
    );
  }

  // ── CAPTURE ──────────────────────────────────────────────────────
  const currentGenre = GENRES.find(g => g.id === selectedGenres[stepIdx]);

  // pendingCapture 프리뷰 모드
  if (pendingCapture) {
    return (
      <div className="bg-[#0A0A0A] flex flex-col" style={{ height: "100dvh" }}>
        <header className="h-[44px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center justify-between px-4 flex-shrink-0">
          <span className="text-[12px] font-bold text-white/50">씬 {stepIdx + 1} 확인</span>
          <div className="flex items-center gap-1.5">
            {selectedGenres.map((g, i) => (
              <div key={g} className={`rounded-full ${i < captures.length ? "w-2 h-2 bg-[#C9571A]" : i === stepIdx ? "w-3 h-2 bg-white" : "w-2 h-2 bg-white/20"}`} />
            ))}
          </div>
        </header>
        <main className="flex-1 flex flex-col px-4 py-4 gap-4 min-h-0">
          <p className="text-[14px] font-bold text-white text-center">이 표정으로 찍을까요?</p>
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-[#111] border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingCapture.dataUrl} alt="촬영 확인" className="absolute inset-0 w-full h-full object-cover" />
            {/* 씬 지시문 오버레이 */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-8">
              <span className="text-[10px] font-black text-[#C9571A] uppercase tracking-widest">{currentGenre?.emoji} {currentGenre?.label}</span>
              <p className="text-[12px] font-bold text-white/90 leading-snug mt-1">{stepCues[stepIdx]}</p>
            </div>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button
              onClick={retakePending}
              className="flex-1 bg-white/10 border border-white/20 text-white font-bold py-4 rounded-2xl text-[15px]"
            >
              다시 찍기
            </button>
            <button
              onClick={confirmCapture}
              className="flex-1 bg-[#C9571A] text-white font-bold py-4 rounded-2xl text-[15px]"
            >
              이대로 찍기
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-[#0A0A0A] flex flex-col" style={{ height: "100dvh" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* 상단 바 */}
      <header className="bg-[#0A0A0A] border-b border-[#1a1a1a] flex-shrink-0 z-40">
        <div className="h-[44px] flex items-center justify-between px-4">
          <Link href="/studio" className="font-[family-name:var(--font-boldonse)] text-sm tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
          <div className="flex items-center gap-1.5">
            {selectedGenres.map((g, i) => (
              <div key={g} className={`rounded-full transition-all ${i < captures.length ? "w-2 h-2 bg-[#C9571A]" : i === stepIdx ? "w-3 h-2 bg-white" : "w-2 h-2 bg-white/20"}`} />
            ))}
          </div>
        </div>
        {/* 씬 타이틀 + 장르 + 지시문 */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[13px] font-black text-[#C9571A] tracking-widest uppercase">씬 {stepIdx + 1}</span>
            <span className="text-[13px] font-bold text-white/40">·</span>
            <span className="text-[13px] font-bold text-white/70">{currentGenre?.emoji} {currentGenre?.label}</span>
          </div>
          {stepCues[stepIdx] && (
            <p className="text-[17px] font-black text-white leading-snug" style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}>{stepCues[stepIdx]}</p>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col px-4 py-3 gap-3 min-h-0 overflow-hidden">

        {/* 웹캠 1:1 */}
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-[#111] border border-white/10 flex-shrink-0">
          <Webcam
            ref={webcamRef}
            audio={false}
            disablePictureInPicture={true}
            forceScreenshotSourceSize={false}
            imageSmoothing={true}
            onUserMedia={HANDLE_WEBCAM_READY}
            onUserMediaError={HANDLE_WEBCAM_ERROR}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.85}
            videoConstraints={VIDEO_CONSTRAINTS}
            mirrored
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />

          {/* 카운트다운 오버레이 — 씬 지시문 포함 */}
          {countdown !== null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10">
              <span className="text-white font-extrabold leading-none" style={{ fontSize: "28vw", textShadow: "0 0 40px rgba(201,87,26,0.9)" }}>
                {countdown}
              </span>
              {/* 씬 지시문 오버레이 */}
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white text-[13px] font-bold text-center bg-black/70 px-3 py-2 rounded-xl backdrop-blur-sm leading-snug">
                  {stepCues[stepIdx]}
                </p>
              </div>
            </div>
          )}

          {/* 스텝 뱃지 */}
          <div className="absolute top-3 left-3 z-10">
            <span className="text-[11px] font-bold text-white bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/20">
              {stepIdx + 1} / 3
            </span>
          </div>
        </div>

        {/* 촬영된 썸네일 */}
        {captures.length > 0 && (
          <div className="flex gap-2 flex-shrink-0">
            {captures.map((item, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.dataUrl} alt={`컷 ${i + 1}`} className="w-12 h-12 rounded-xl object-cover border-2 border-[#C9571A]" />
                <button
                  onClick={() => retake(i)}
                  className="absolute inset-0 bg-black/70 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <span className="text-white text-[9px] font-bold">재촬영</span>
                </button>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#C9571A] rounded-full flex items-center justify-center text-[9px] text-white font-bold pointer-events-none">
                  {i + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 촬영 버튼 */}
        <button
          onClick={startCountdown}
          disabled={countdown !== null}
          className="w-full bg-[#C9571A] hover:bg-[#B34A12] disabled:bg-[#2A2A2A] disabled:text-white/30 text-white font-bold py-4 rounded-2xl text-[16px] transition-colors flex items-center justify-center gap-2 flex-shrink-0"
        >
          {countdown !== null ? (
            <span className="text-[22px] font-extrabold tabular-nums">{countdown}</span>
          ) : (
            <><span>📸</span><span>이 표정으로 찍기</span></>
          )}
        </button>
      </main>
    </div>
  );
}

export default function AuditionSolo() {
  const router = useRouter();

  useEffect(() => {
    if (!AUDITION_ENABLED) {
      router.replace("/studio");
    }
  }, [router]);

  if (!AUDITION_ENABLED) return null;

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0A0A]" />}>
      <AuditionSoloInner />
    </Suspense>
  );
}
