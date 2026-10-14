# PROCESS STUDIO 인스타 자동 제작

매일 아침 Claude 가 그날의 인스타 게시물(캐러셀 PNG + 스토리 + 캡션)을 만들어 Claude 앱으로 보내 줍니다. **게시는 사람이 합니다** — 받은 그림을 저장해 인스타에 올리면 끝입니다.

이 폴더는 사이트에 배포되지 않습니다(`scripts/package-site.mjs` 의 배포 대상이 아님). 앱 코드와 독립입니다.

## 요일별 게시물

| 요일 | 종류 | 내용 |
| --- | --- | --- |
| 월 | 장점 소개 | `topics.json` 의 feature 를 차례로 |
| 화 · 금 | 오늘의 축구 용어 | 앱 사전(`studio/football-language.js`, 90개)에서 |
| 수 · 토 | 이번 주 업데이트 | 앞선 며칠의 배포 안내(origin/main `studio/release-notes.js`). 없으면 장점 소개 |
| 목 · 일 | 사용법 | `topics.json` 의 howto 를 차례로 |

같은 날짜면 언제 돌려도 같은 주제가 나옵니다(기억해 둘 상태가 없음). 주제를 더하거나 고치려면 `topics.json` 을 고치면 됩니다 — `facts` 에는 앱에 실제로 있는 것만 적어 주세요. 게시물 문구는 그 사실만 씁니다.

## 받은 뒤 올리는 법

1. Claude 앱에서 `01.png`부터 마지막 장까지, `story.png` 를 저장합니다(`preview.png` 는 한눈에 보기용이라 올리지 않습니다).
2. 피드: 새 게시물 → 사진 여러 장을 **01부터 순서대로** 선택 → `caption.txt` 내용 붙여넣기 → 공유.
3. 스토리: `story.png` → 링크 스티커에 `https://processstudio.netlify.app`.

## 손으로 돌리기

```bash
npm ci
node instagram/plan.mjs [YYYY-MM-DD] [--kind update|feature|howto|term]   # 브리프
#   → instagram/out/<날짜>/post.json 을 씁니다 (형식: PLAYBOOK.md)
node instagram/render.mjs [YYYY-MM-DD]                                      # PNG·캡션
node instagram/capture.mjs board-3d board-flat --out /tmp/shots            # 앱 화면만 찍기
```

결과는 `instagram/out/<날짜>/` 에 생기고 커밋되지 않습니다.

## 파일

- `PLAYBOOK.md` — 매일 도는 세션의 작업 지침(구성·글쓰기·금지·전달). 톤이나 구성을 바꾸고 싶으면 여기를 고칩니다.
- `plan.mjs` — 날짜 → 브리프(종류·주제·사실·쓸 수 있는 그림).
- `topics.json` — 장점·사용법 주제 은행과 해시태그 후보.
- `capture.mjs` — 가상 자료로 작전판(평면·3D)을 찍습니다. 실제 팀 자료는 쓰지 않습니다.
- `template.html` · `render.mjs` — post.json → 1080×1350 캐러셀, 1080×1920 스토리, caption.txt, preview.png. 글이 넘치거나 해시태그가 5개를 넘으면 실패로 알립니다.
