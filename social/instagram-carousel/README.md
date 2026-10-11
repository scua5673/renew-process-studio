# 인스타그램 캐러셀 · 훈련 애니메이션

- `index.html?slide=1`~`8` — 캐러셀 8장(1080×1350, 4:5). 화면을 그대로 찍어 PNG로 올린다.
- `caption-ko.txt` — 캐러셀 캡션.
- `export-pack.mjs` — 커뮤니티 «프로세스» 칸의 훈련 세션 팩(`packs/NN.json`)에서 훈련마다 애니메이션 영상을 뽑는다.
- `video.html` + `make-video.mjs` — 작전판에서 내보낸 훈련 애니메이션을 인스타 틀에 담는다.
  - 캐러셀 영상 장(1080×1350): 다른 장과 같은 머리글·제목·칩, 화면 자리에 애니메이션
  - 릴스(1080×1920): 제목·코칭 포인트 + 가운데 애니메이션 + 주소

## 1. 작전판에서 애니메이션 내보내기

작전판 › 애니메이션 › **MP4** → 아래처럼 고르고 저장.

| 항목 | 고를 것 | 이유 |
| --- | --- | --- |
| 방향 | 가로 16:9 | 세로(릴스) 틀은 `make-video.mjs`가 만든다 |
| 화면 | **훈련 구역** | 선수·장비가 있는 곳만 크게 담긴다 |
| 화질 | 1080p | |
| FPS | 30fps | |

브라우저에 따라 WebM으로 저장돼도 괜찮다(`make-video.mjs`가 MP4로 바꾼다).

## 2. 틀에 담기

저장소 맨 위에서 `npm ci` · `npx playwright install chromium` 한 번(ffmpeg 필요). 그다음:

```sh
# 캐러셀 2번 장(작전판)을 움직이는 훈련으로 — 페이지 번호·문구는 원래 2번 장과 같게
node social/instagram-carousel/make-video.mjs --in 론도.mp4 --out 02-board.mp4 \
  --eyebrow "TACTICS BOARD" --title "말보다 빠르게,\n작전판으로 보여주세요." \
  --lead "선수·볼·장비를 배치하고 동선을 그려 여러 장면의 움직임을 애니메이션으로 전달합니다." \
  --chips "곡선 움직임,장면 애니메이션,미팅 세트" --page "02 / 08" --badge 01

# 훈련 하나 = 릴스 하나
node social/instagram-carousel/make-video.mjs --mode reel --in 론도.mp4 --out 릴스-론도.mp4 \
  --title "4v2 론도\n압박을 벗어나는 첫 패스" \
  --lead "공 반대편 선수는 몸을 열고, 두 수비 사이로 각을 만든다." \
  --chips "U12,4v2,12m 정사각형,10분"
```

| 옵션 | 뜻 |
| --- | --- |
| `--mode` | `post`(기본, 캐러셀 4:5) · `reel`(9:16) |
| `--title` | 제목. `\n`으로 줄바꿈 |
| `--lead` | 한두 줄 설명 |
| `--chips` | 쉼표로 나눈 칩 |
| `--eyebrow` | 제목 위 작은 글(기본 `TRAINING ANIMATION`) |
| `--page` · `--badge` | 캐러셀 오른쪽 위 쪽번호 · 오른쪽 아래 동그라미 번호 |
| `--theme dark` | 캐러셀 장을 어두운 바탕으로 |
| `--url` | 릴스 아래 주소(기본 `processstudio.netlify.app`) |

영상 길이는 내보낸 애니메이션 그대로다. 소리는 없다 — 릴스 음악은 인스타 앱에서 고른다.

## 프로세스 훈련 세션을 한꺼번에

커뮤니티 «프로세스» 칸과 같은 자료(`https://process-letter-sessions.netlify.app/packs/NN.json`)를 받아,
앱의 영상 내보내기(가로 · 훈련 구역 · 1080p · 30fps)로 훈련마다 영상을 만든 뒤 틀에 담는다.
합성 팀 fixture(`tests/fixtures/team-app.mjs`)에서 돌아 운영 서버에는 닿지 않는다.

```sh
node social/instagram-carousel/export-pack.mjs --issue 3 --out ig-03      # 받아 둔 파일이면 --pack 03.json
node social/instagram-carousel/make-video.mjs --list ig-03/trainings.json
```

`ig-03/03-1-post.mp4`(캐러셀 장) · `03-1-reel.mp4`(릴스)처럼 훈련마다 둘. 제목은 훈련 이름, 설명은 코칭 포인트 첫 줄,
칩은 주제 · 분 · 레터 호. 장면이 하나뿐인 훈련은 영상 없이 건너뛴다.

## 3. 올리기

- 캐러셀은 사진·영상을 섞어 한 게시물에 올릴 수 있다. 첫 장 비율(4:5)에 나머지가 맞춰지니 첫 장은 `slide-01` 그대로 둔다.
- 영상 장은 같은 번호의 PNG 자리에 넣는다(예: 2번 PNG 대신 `02-board.mp4`).
- 릴스 미리보기(프로필 격자)는 가운데 3:4만 보인다 — 제목·애니메이션이 그 안에 들어가게 짜 두었다.
