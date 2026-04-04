"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

// SSR 비활성화 — react-webcam은 브라우저 전용
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Webcam = dynamic(() => import("react-webcam") as any, { ssr: false }) as React.ComponentType<any>;

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

function pickRandomCue(genreId: GenreId): string {
  const pool = CUES[genreId];
  return pool[Math.floor(Math.random() * pool.length)];
}

const VIDEO_CONSTRAINTS = { width: 720, height: 720, facingMode: "user" };

type CaptureItem = { base64: string; dataUrl: string };
type Phase = "loading" | "login_required" | "no_credits" | "intro" | "genre_select" | "capture" | "flavor_select" | "analyzing" | "error";
type Flavor = "spicy" | "mild";

// ── 컴포넌트 ──────────────────────────────────────────────────────────
export default function AuditionSolo() {
  const searchParams = useSearchParams();
  const fromIntro = searchParams?.get("from_intro") === "1";
  const [phase, setPhase] = useState<Phase>("loading");
  const [selectedGenres, setSelectedGenres] = useState<GenreId[]>([]);
  const [stepCues, setStepCues] = useState<string[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [flavor, setFlavor] = useState<Flavor>("spicy");
  const [bubbleIdx, setBubbleIdx] = useState(0);
  const webcamRef = useRef<{ getScreenshot: () => string | null }>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const { user, loading: authLoading, login } = useAuth();

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  // 인증 + 크레딧 체크
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setPhase("login_required"); return; }
    fetch("/api/credits")
      .then(r => r.json())
      .then(data => {
        const c = data.credits ?? 0;
        setCredits(c);
        if (c < 3) setPhase("no_credits");
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
    setBubbleIdx(0);

    const images = captures.map(c => c.base64);
    const previewDataUrl = captures[2].dataUrl;
    const genreLabels = selectedGenres.map(g => GENRES.find(x => x.id === g)?.label ?? g);
    const genreMeta = selectedGenres.map((g, i) => ({
      genre: GENRES.find(x => x.id === g)?.label ?? g,
      cue: stepCues[i],
    }));

    fetch("/api/audition/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images, genres: genreLabels, cues: stepCues, flavor }),
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "분석 실패");
        sessionStorage.setItem("sd_au_result", JSON.stringify(data));
        sessionStorage.setItem("sd_au_preview", previewDataUrl);
        sessionStorage.setItem("sd_au_genres", JSON.stringify(genreMeta));
        sessionStorage.setItem("sd_au_images", JSON.stringify(captures.map(c => c.dataUrl)));
        router.push("/audition/result");
      })
      .catch(err => {
        setErrorMsg(err.message ?? "감독님이 자리를 비웠습니다. 다시 시도해주세요.");
        setPhase("error");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captures]);

  // 말풍선 메시지 순환
  useEffect(() => {
    if (phase !== "analyzing") return;
    const timer = setInterval(() => setBubbleIdx(i => (i + 1) % 9), 2200);
    return () => clearInterval(timer);
  }, [phase]);

  const handleFlavorAndCapture = (f: Flavor) => {
    setFlavor(f);
    const cues = selectedGenres.map(g => pickRandomCue(g));
    setStepCues(cues);
    setCaptures([]);
    setStepIdx(0);
    setPhase("capture");
  };

  const doCapture = useCallback(() => {
    const screenshot = webcamRef.current?.getScreenshot();
    if (!screenshot) return;
    setCaptures(prev => [...prev, { base64: screenshot.split(",")[1], dataUrl: screenshot }]);
  }, []);

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
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#C9571A]" style={{ animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  // ── 로그인 필요 ──────────────────────────────────────────────────
  if (phase === "login_required") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
        <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center px-4">
          <Link href="/studio" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6 max-w-sm mx-auto w-full">
          <div className="text-[52px]">🎬</div>
          <div>
            <p className="text-[11px] font-bold text-[#C9571A] tracking-[0.2em] uppercase mb-2">AI 오디션</p>
            <h2 className="text-[22px] font-extrabold text-white leading-tight">로그인이 필요한 기능이에요</h2>
            <p className="text-[13px] text-[#555] mt-2 leading-relaxed">
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
          <Link href="/studio" className="text-[13px] text-[#444] hover:text-white transition-colors">돌아가기</Link>
        </main>
      </div>
    );
  }

  // ── 크레딧 부족 ──────────────────────────────────────────────────
  if (phase === "no_credits") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
        <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center px-4">
          <Link href="/studio" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6 max-w-sm mx-auto w-full">
          <div className="text-[52px]">💳</div>
          <div>
            <p className="text-[11px] font-bold text-[#C9571A] tracking-[0.2em] uppercase mb-2">AI 오디션</p>
            <h2 className="text-[22px] font-extrabold text-white leading-tight">크레딧이 부족해요</h2>
            <p className="text-[13px] text-[#555] mt-2 leading-relaxed">
              AI 오디션은 <span className="text-white font-bold">3크레딧</span>이 필요해요.<br />
              현재 보유: <span className="text-[#C9571A] font-bold">{credits}크레딧</span>
            </p>
          </div>
          <Link href="/shop" className="w-full h-[52px] bg-[#C9571A] hover:bg-[#B34A12] text-white font-bold text-[15px] rounded-full transition-colors flex items-center justify-center">
            크레딧 충전하기
          </Link>
          <Link href="/studio" className="text-[13px] text-[#444] hover:text-white transition-colors">돌아가기</Link>
        </main>
      </div>
    );
  }

  // ── INTRO ────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
        <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center justify-between px-4 sticky top-0 z-40">
          <Link href="/studio" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1">
            <span className="text-[11px] text-[#666]">보유</span>
            <span className="text-[15px] font-extrabold text-white">{credits}</span>
            <span className="text-[11px] text-[#666]">크레딧</span>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-5 text-center gap-6 max-w-sm mx-auto w-full py-10">
          <div className="text-[52px]">🎬</div>
          <div>
            <p className="text-[11px] font-bold text-[#C9571A] tracking-[0.2em] uppercase mb-2">AI 오디션</p>
            <h1 className="text-[28px] font-extrabold text-white leading-tight">AI 오디션</h1>
            <p className="text-[13px] text-[#555] mt-2 leading-relaxed">
              장르 3개를 고르고 표정 연기를 해봐요.<br />
              AI 감독이 냉혹하게 심사합니다.
            </p>
          </div>

          <div className="bg-[#111] border border-white/8 rounded-2xl px-5 py-4 w-full flex flex-col items-center gap-1.5 text-center">
            <span className="text-[22px]">🎭</span>
            <p className="text-[14px] text-white font-bold leading-snug">
              미션 큐는 촬영 직전에 공개됩니다
            </p>
          </div>

          {/* 동의 사항 */}
          <div className="w-full bg-[#111] border border-white/8 rounded-2xl px-5 py-4 flex flex-col gap-3">
            <p className="text-[11px] font-bold text-[#555] tracking-widest uppercase">오디션 전 확인사항</p>
            <ul className="flex flex-col gap-2.5">
              <li className="flex items-start gap-2.5">
                <span className="text-[#C9571A] text-[14px] shrink-0 mt-0.5">🌶️</span>
                <p className="text-[12px] text-[#888] leading-snug">매운맛/순한맛에 따라 평가 강도가 달라집니다. 상처받지 말고 재미로 봐주세요</p>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-[#C9571A] text-[14px] shrink-0 mt-0.5">📸</span>
                <p className="text-[12px] text-[#888] leading-snug">한번 촬영한 컷은 다시 찍을 수 없으니 이점 유의해주세요</p>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-[#C9571A] text-[14px] shrink-0 mt-0.5">💳</span>
                <p className="text-[12px] text-[#888] leading-snug">크레딧 3개가 소모되며, 이 서비스는 환불이 어렵습니다</p>
              </li>
            </ul>
            <label className="flex items-center gap-3 mt-1 cursor-pointer select-none" onClick={() => setAgreed(v => !v)}>
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${agreed ? "bg-[#C9571A] border-[#C9571A]" : "border-white/20 bg-transparent"}`}>
                {agreed && <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <p className="text-[13px] text-white font-bold">위 내용을 모두 확인했습니다</p>
            </label>
          </div>

          <div className="w-full flex flex-col gap-2">
            <button
              onClick={() => setPhase("genre_select")}
              disabled={!agreed}
              className="w-full bg-[#C9571A] hover:bg-[#B34A12] disabled:bg-[#2A2A2A] disabled:text-white/30 text-white font-bold py-4 rounded-2xl text-[16px] transition-colors flex items-center justify-center gap-2.5"
            >
              <span className="text-[12px] font-extrabold bg-white/20 rounded-lg px-2 py-0.5">3크레딧</span>
              시작하기
            </button>
          </div>

          <Link href="/studio" className="text-[13px] text-[#444] hover:text-white transition-colors">돌아가기</Link>
        </main>
      </div>
    );
  }

  // ── 장르 선택 ────────────────────────────────────────────────────
  if (phase === "genre_select") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
        <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center justify-between px-4 sticky top-0 z-40">
          <Link href="/studio" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
          <span className="text-[12px] text-[#555]">{selectedGenres.length} / 3 선택</span>
        </header>
        <main className="flex-1 flex flex-col px-5 py-8 gap-6 max-w-sm mx-auto w-full">
          <div className="text-center">
            <p className="text-[11px] font-bold text-[#C9571A] tracking-[0.2em] uppercase mb-2">STEP 1</p>
            <h2 className="text-[22px] font-extrabold text-white leading-tight">연기할 장르를 골라요</h2>
            <p className="text-[13px] text-[#555] mt-1.5">3가지를 선택하면 시작됩니다</p>
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
                      ? "bg-[#C9571A]/15 border-[#C9571A] text-white"
                      : disabled
                      ? "bg-[#111] border-white/5 text-white/20 cursor-not-allowed"
                      : "bg-[#111] border-white/10 text-white/70 hover:border-white/30"
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
              onClick={() => setPhase("flavor_select")}
              disabled={selectedGenres.length < 3}
              className="w-full bg-[#C9571A] hover:bg-[#B34A12] disabled:bg-[#2A2A2A] disabled:text-white/30 text-white font-bold py-4 rounded-2xl text-[16px] transition-colors"
            >
              {selectedGenres.length < 3 ? `${3 - selectedGenres.length}개 더 선택해요` : "다음 →"}
            </button>
            <button onClick={() => setPhase("intro")} className="text-[13px] text-[#444] hover:text-white transition-colors py-1">
              이전으로
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── ANALYZING ────────────────────────────────────────────────────
  const BUBBLE_MESSAGES = [
    "뭘봐 이자식아 👁️", "좀만 기다려라 ☕", "너 표정 다보여 😏",
    "기다려! 🐾", "왜냐고? 난 감독이니까 🎬", "심사 중이거든? 📋",
    "눈치채지 마라 🤫", "조금만 더... 😤", "내 시간도 소중해 ⏰",
  ];
  const PIXEL_ANIMALS = ["🐶", "🐱", "🐸", "🦊", "🐨", "🐯", "🐻", "🦁", "🐼"];
  const lastPhoto = captures[2]?.dataUrl ?? captures[captures.length - 1]?.dataUrl;

  if (phase === "flavor_select") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
        <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center justify-between px-4 sticky top-0 z-40">
          <Link href="/studio" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
          <span className="text-[12px] text-[#555]">STEP 2</span>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-5 text-center gap-8 max-w-sm mx-auto w-full py-10">
          <div>
            <p className="text-[11px] font-bold text-[#C9571A] uppercase tracking-widest mb-3">평가 강도 선택</p>
            <h2 className="text-[28px] font-extrabold text-white leading-tight mb-2">
              어떤 맛으로<br />드릴까요?
            </h2>
            <p className="text-[13px] text-[#555] leading-snug">촬영 전에 미리 선택해두세요<br />선택 후엔 변경이 안 됩니다</p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => handleFlavorAndCapture("spicy")}
              className="w-full py-5 rounded-2xl relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)" }}
            >
              <p className="text-white font-extrabold text-[22px]">🌶️ 매운맛</p>
              <p className="text-white/60 text-[12px] mt-0.5">욕 포함 진짜 독설 · 뒤통수 맞을 각오</p>
            </button>
            <button
              onClick={() => handleFlavorAndCapture("mild")}
              className="w-full py-5 rounded-2xl border border-white/15"
              style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #252540 100%)" }}
            >
              <p className="text-white font-extrabold text-[22px]">🥛 순한맛</p>
              <p className="text-white/50 text-[12px] mt-0.5">욕 없는 독설 · 그래도 뼈는 때림</p>
            </button>
          </div>
          <button onClick={() => setPhase("genre_select")} className="text-[13px] text-[#444] hover:text-white transition-colors">
            이전으로
          </button>
        </main>
      </div>
    );
  }

  if (phase === "analyzing") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] relative overflow-hidden flex flex-col items-center justify-center">
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes dot-bounce { 0%,80%,100%{opacity:0.3;transform:scale(0.8)} 40%{opacity:1;transform:scale(1.2)} }
          @keyframes bubble-fade { 0%{opacity:0;transform:scale(0.8) translateY(6px)} 15%{opacity:1;transform:scale(1) translateY(0)} 75%{opacity:1} 100%{opacity:0} }
        `}</style>
        {lastPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lastPhoto} alt="" className="absolute inset-0 w-full h-full object-cover opacity-35" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/50 to-black/85" />

        <div className="relative z-10 flex flex-col items-center gap-7 text-center px-6">
          {/* 픽셀 동물 + 스피너 + 말풍선 */}
          <div className="relative flex items-center justify-center w-44 h-44">
            {/* 말풍선 */}
            <div key={bubbleIdx} className="absolute -top-14 bg-white text-[#111] text-[13px] font-extrabold px-3.5 py-2 rounded-2xl whitespace-nowrap shadow-lg"
              style={{ animation: "bubble-fade 2.2s ease-in-out forwards" }}>
              {BUBBLE_MESSAGES[bubbleIdx]}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0"
                style={{ borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "8px solid white" }} />
            </div>
            {/* 동물 이모지 */}
            <span className="text-[72px] select-none">{PIXEL_ANIMALS[bubbleIdx % PIXEL_ANIMALS.length]}</span>
            {/* 스피너 링 */}
            <div className="absolute inset-0 rounded-full border-[5px] border-transparent border-t-[#C9571A] border-r-[#C9571A]/40"
              style={{ animation: "spin 1.2s linear infinite" }} />
          </div>

          <div>
            <p className="text-[#C9571A] text-[12px] font-bold tracking-widest uppercase mb-2">
              {flavor === "spicy" ? "🌶️ 매운맛 심사 중" : "🥛 순한맛 심사 중"}
            </p>
            <p className="text-white font-bold text-[20px] leading-snug">
              감독이 심사 중입니다...
            </p>
            <div className="flex items-center justify-center gap-2 mt-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-[#C9571A]"
                  style={{ animation: `dot-bounce 1.4s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="text-[40px]">😵</p>
        <p className="text-white font-bold text-[18px]">오디션이 중단됐습니다</p>
        <p className="text-[#888] text-[14px]">{errorMsg}</p>
        <Link href="/studio" className="text-[13px] text-[#444] hover:text-white transition-colors">
          밖으로 나가기
        </Link>
      </div>
    );
  }

  // ── CAPTURE ──────────────────────────────────────────────────────
  return (
    <div className="bg-[#0A0A0A] flex flex-col" style={{ height: "100dvh" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <header className="h-[52px] bg-[#0A0A0A] border-b border-[#1a1a1a] flex items-center justify-between px-4 flex-shrink-0 z-40">
        <Link href="/studio" className="font-[family-name:var(--font-boldonse)] text-base tracking-[0.04em] text-[#C9571A]">StyleDrop</Link>
        <div className="flex items-center gap-1.5">
          {selectedGenres.map((g, i) => (
            <div
              key={g}
              className={`rounded-full transition-all ${
                i < captures.length
                  ? "w-2 h-2 bg-[#C9571A]"
                  : i === stepIdx
                  ? "w-3 h-2 bg-white"
                  : "w-2 h-2 bg-white/20"
              }`}
            />
          ))}
        </div>
      </header>

      <main className="flex-1 flex flex-col px-4 py-3 gap-3 min-h-0">

        {/* 웹캠 */}
        <div className="relative flex-1 rounded-2xl overflow-hidden bg-[#111] border border-white/10 min-h-0">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.85}
            videoConstraints={VIDEO_CONSTRAINTS}
            mirrored
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />

          {/* 미션 큐 오버레이 — 카운트다운 중엔 숨김 */}
          {countdown === null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-5"
              style={{ background: "rgba(0,0,0,0.45)" }}
            >
              <div className="text-center px-4">
                <p className="text-[11px] font-bold text-[#C9571A] tracking-[0.2em] uppercase mb-3">
                  {GENRES.find(g => g.id === selectedGenres[stepIdx])?.emoji}{" "}
                  {GENRES.find(g => g.id === selectedGenres[stepIdx])?.label} · STEP {stepIdx + 1} / 3
                </p>
                <p className="text-white font-extrabold leading-snug"
                  style={{ fontSize: "clamp(18px, 6vw, 26px)", textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}
                >
                  &quot;{stepCues[stepIdx]}&quot;
                </p>
              </div>
            </div>
          )}

          {/* 카운트다운 오버레이 */}
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <span
                className="text-white font-extrabold leading-none"
                style={{ fontSize: "25vw", textShadow: "0 0 40px rgba(201,87,26,0.9)" }}
              >
                {countdown}
              </span>
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
                <img src={item.dataUrl} alt={`컷 ${i + 1}`} className="w-14 h-14 rounded-xl object-cover border-2 border-[#C9571A]" />
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
