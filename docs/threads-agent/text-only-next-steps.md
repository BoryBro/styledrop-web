# Text Only Threads Automation Next Steps

이제 Flow/이미지 생성은 Agent에게 맡기지 않는다.

## 새 역할 분리

Agent가 하는 일:

- md 글 템플릿 읽기
- 중복/광고성/500자 초과 글 제거
- 글 카테고리 분류
- CTA 분류
- 이미지 업로드 권장 여부 표시
- 추천 StyleDrop 스타일 표시
- 예약 시간 생성
- CSV 생성

사람이 하는 일:

- 이미지 업로드 권장 글만 필터링
- Flow에서 마음에 드는 이미지만 직접 생성
- 어드민에서 해당 글에 이미지 직접 업로드
- 최종 승인

StyleDrop 서버가 하는 일:

- 승인된 글 자동 발행
- 이미지가 붙은 글은 이미지와 함께 발행
- 텍스트 글은 텍스트만 발행

## Agent에 넣을 파일

- 글 md 템플릿 파일들
- `docs/threads-agent/text-only-agent-prompt.md`

이미지 프롬프트 파일은 이번 단계에서는 넣지 않아도 된다.

## Agent에게 말할 문장

```md
text-only-agent-prompt.md 지시대로 진행해줘.
Flow, Nano Banana, 이미지 생성, 이미지 ZIP 생성은 하지 마.
글만 정리하고, 이미지가 있으면 좋은 글에는 image_upload_recommended=yes와 recommended_styles만 표시해줘.
최종 결과는 styledrop_threads_text_queue.csv로 만들어줘.
```

