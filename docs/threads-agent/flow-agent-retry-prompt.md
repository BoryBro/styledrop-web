# Flow Agent Retry Prompt

방금 결과는 폐기한다.

이전 출력의 문제:

- 이미지 ZIP에 16장밖에 없었다.
- CSV의 240개 이미지 글에 같은 16장을 반복 매칭했다.
- 이미지가 StyleDrop 결과물이 아니라 CSV 화면/상품 사진/무관한 이미지였다.
- Flow에서 실제 StyleDrop 카드 프롬프트 기반 이미지를 생성했다는 증거가 없다.

이번에는 전체 작업을 하지 말고 테스트 배치만 진행한다.

## 목표

`styledrop_threads_queue.csv`에서 `image_required=yes` 행 8~12개만 골라 Flow에서 실제 이미지를 생성한다.

## 절대 조건

1. Threads에 직접 발행하지 않는다.
2. 전체 240장을 만들지 않는다.
3. 먼저 8~12장 테스트 배치만 만든다.
4. CSV/스프레드시트/표 화면 이미지를 만들면 실패다.
5. 의류, 신발, 가방 제품 사진을 만들면 실패다.
6. StyleDrop과 관계없는 스톡 사진을 만들면 실패다.
7. 반드시 `src/lib/styles/general-card-prompts/*.txt`의 실제 StyleDrop 프롬프트를 사용한다.
8. 원본 인물 사진 또는 StyleDrop 레퍼런스 이미지가 없으면 작업을 시작하지 말고 요청한다.
9. 각 이미지 파일명은 CSV의 `image_filename`과 정확히 매칭한다.
10. 테스트 배치 이미지는 모두 서로 달라야 한다.

## 진행 순서

1. `styledrop_threads_queue.csv`를 읽는다.
2. `image_required=yes`인 행 중 8~12개만 선택한다.
3. `style-prompt-mapping.json`에 따라 `style_id`를 배정한다.
4. 해당 `style_id`의 프롬프트 파일을 읽는다.
5. Flow에 접속한다.
6. 내가 직접 로그인하면 진행한다.
7. Nano Banana 2 모델을 선택한다.
8. StyleDrop 프롬프트와 원본/레퍼런스 이미지를 사용해 이미지를 생성한다.
9. 한 번 실행에 4개 이미지가 나오면, 그중 품질 좋은 것만 선택한다.
10. 다음 실행 전 60~120초 기다린다.
11. 8~12장 생성 후 멈춘다.

## 산출물

- `styledrop_threads_queue_test_batch.csv`
- `styledrop_image_test_batch.zip`
- 생성된 이미지 미리보기

사람이 테스트 배치를 승인하기 전에는 전체 배치로 넘어가지 마라.
