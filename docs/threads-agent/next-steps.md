# Threads Automation Next Steps

현재 운영 방식은 이미지 자동 생성이 아니라, 글 자동화 + 이미지 수동 검수 방식이다.

## 역할 분리

Agent:

- md 템플릿 600개를 읽는다.
- 중복, 광고성 과함, 500자 초과 글을 제거한다.
- 카테고리, CTA, 이미지 업로드 권장 여부를 붙인다.
- 예약 시간을 만든다.
- 최종 CSV를 만든다.

StyleDrop 어드민:

- CSV를 import한다.
- `이미지필요` 탭에서 이미지가 있으면 좋은 글만 모아 보여준다.
- 사람이 만든 이미지를 직접 업로드한다.
- 이미지가 필요한데 비어있는 글은 승인되지 않게 막는다.
- 승인된 글만 예약 시간에 자동 발행한다.

사람:

- 이미지 필요한 글만 보고 Flow에서 직접 이미지를 만든다.
- 마음에 드는 이미지만 어드민에 올린다.
- 최종 승인한다.

## Agent에 넣을 파일

- `styledrop_threads_300_posts 1.md`
- `styledrop_threads_300_posts 2.md`
- `docs/threads-agent/text-only-agent-prompt.md`

이미지 프롬프트 파일, Flow 계정, Nano Banana 작업은 이번 자동화에 넣지 않는다.

## Agent에게 붙여넣을 문장

```md
text-only-agent-prompt.md 지시대로 진행해줘.
Flow, Nano Banana, 이미지 생성, 이미지 ZIP 생성은 하지 마.
글만 정리하고, 이미지가 있으면 좋은 글에는 image_upload_recommended=yes와 recommended_styles만 표시해줘.
최종 결과는 styledrop_threads_text_queue.csv로 만들어줘.
```

## 어드민 사용 순서

1. Supabase SQL editor에서 `supabase/threads_posts_enhancements.sql`을 1번 실행한다.
2. `/admin/threads`에 들어간다.
3. `CSV Import`로 Agent가 만든 CSV를 넣는다.
4. `이미지필요` 탭을 본다.
5. 이미지가 필요한 글에만 직접 만든 이미지를 업로드한다.
6. 전체승인을 누른다.
7. 서버가 예약 시간에 자동 발행한다.

