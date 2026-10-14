# 인스타 하루 게시물 — 작업 지침 (매일 도는 Claude 세션용)

이 문서는 매일 아침 자동으로 뜨는 세션이 그대로 따라 하는 순서다. 결과물은 **올릴 준비가 끝난 PNG + 캡션**이고, 인스타에 올리는 것은 사람이 한다.

## 하지 말 것

- 인스타·페이스북·다른 곳에 **게시하지 않는다**. 만들어서 전달까지만 한다.
- `instagram/out/` 결과물을 **커밋하지 않는다**(.gitignore). main·staging 에 **푸시하지 않는다**. 이 작업은 앱 코드를 고치지 않는다.
- 실제 팀·선수·코치 이름, 얼굴, 평가 내용, 이메일을 그림이나 글에 넣지 않는다. 앱 화면은 `capture.mjs`(가상 자료)·`guide/img`·`social/…/assets` 만 쓴다.
- 앱에 없는 기능, 배포 안내·`topics.json` 에 없는 숫자, 다른 앱과의 비교, "최초·유일·무료" 같은 단정은 쓰지 않는다.
- 해시태그는 **본문 포함 5개까지**(인스타 제한). `#프로세스스튜디오` 하나는 꼭 넣는다.

## 순서

```bash
cd <저장소>
git fetch origin main            # 배포 안내(studio/release-notes.js)는 origin/main 판을 읽는다
npm ci --no-audit --no-fund      # playwright (브라우저는 /opt/pw-browsers/chromium 을 쓴다 — 설치하지 않는다)
node instagram/plan.mjs          # 오늘(한국 시간) 브리프 → instagram/out/<날짜>/brief.json
```

1. 브리프의 `kind` 에 맞춰 아래 «종류별 구성»대로 `instagram/out/<날짜>/post.json` 을 쓴다.
2. `node instagram/render.mjs` — 앱 화면을 찍고 슬라이드를 그린다. 실패하면 메시지대로 고친다(글 줄이기·장 나누기·그림 바꾸기). `problems` 가 빌 때까지 반복한다.
3. `instagram/out/<날짜>/preview.png` 를 Read 로 열어 본다. 그다음 장마다 PNG 를 열어 확인한다:
   - 글자가 잘리거나 한 글자만 다음 줄로 떨어진 곳(«다» 하나만 남은 줄 등) → 줄바꿈(`\n`)이나 낱말을 고친다.
   - 그림이 그 장의 말과 맞는지(3D 이야기에 평면 그림 X). 안 맞으면 그림을 빼고 `list`/`statement` 로.
   - 같은 장이 너무 비거나 꽉 찼는지.
4. 전달한다(아래 «전달»).

## 종류별 구성

브리프는 `update` · `feature` · `howto` · `term` 중 하나다. 모든 게시물은 캐러셀 3~8장 + 스토리 1장 + 캡션이다. 마지막 장은 `cta`.

### update — 이번 주 바뀐 것

- 브리프의 `update.entries` 에서 **코치가 화면에서 느끼는 변화**만 고른다(3~6개). 저장 안정화·CI·내부 정리·드문 오류 수정은 넣지 않는다. 단, 사용자가 제보한 불편을 고친 것은 "제보해 주신 ○○ 고쳤어요" 한 줄로 넣어도 좋다.
- 가장 눈에 띄는 하나를 표지·스토리의 주인공으로. 나머지는 `shot`(앱 화면이 있는 것) 또는 `list`(묶음)로.
- 그림: 작전판·3D 관련이면 `shot:` 장면. 그 밖의 새 기능은 그 기능을 실제로 보여 주는 그림이 없으면 **그림 없이** `list` 로 쓴다. 옛 화면(guide)을 새 기능 그림처럼 쓰지 않는다.
- 판 번호(v3.0xx)는 제목에 쓰지 않는다. 날짜는 "이번 주"로.

### feature — 장점 소개

- 브리프의 `topic`(title·angle·facts·images). 표지는 `angle` 을 코치의 말로 바꾼 훅. 2~4장은 facts 하나씩 또는 묶어서. facts 에 없는 것을 약속하지 않는다.

### howto — 사용법

- 표지(무엇을 몇 단계로) → `steps` 한 장(브리프의 steps, 4개 넘으면 두 장) → 필요하면 그 결과 화면 `shot` → `cta`.

### term — 오늘의 축구 용어

- 브리프의 `term` 을 그대로 쓴다: `ko`(괄호 풀이는 빼도 됨)·`en`·`def`·`cue` 는 **앱 사전 문장 그대로**(앱의 공용어에 들어 있는 같은 사전이다). `cat` 에는 `catName`.
- 2장: 이 개념을 작전판으로 보여 주는 팁(`shot:` 판 그림 + 짧은 말). 3장: `cta` — 공용어에서 우리 팀 말로 정리할 수 있다는 것.

## 글쓰기

- 한국어, 본문은 해요체. 코치에게 말하듯 짧게. 기능 이름보다 현장의 상황으로 시작한다("말로 세 번 설명할 움직임, 한 번 보여 주세요").
- 제목은 2~3줄, 줄마다 짧게(표지 `xl` 은 한 줄 8자 안팎). `*강조*` 는 제목에 한 군데.
- 본문(body)은 한 줄 30자 안팎이다. 넘으면 `\n` 으로 뜻 단위에서 직접 끊는다 — 끝줄에 «남겨요.» 같은 낱말 하나만 남으면 render 가 실패로 알린다.
- 캡션: 첫 줄이 미리보기에 보이는 훅(30자 안팎) → 빈 줄 → 3~6줄 → `👉 프로필 링크에서 열기`. 이모지는 2~3개까지.
- 해시태그: `#프로세스스튜디오` + `topics.json` 의 pool 에서 주제에 맞는 4개(용어 게시물은 `#축구용어` 를 넣는다).

## post.json

```jsonc
{
  "kind": "update",
  "slides": [ /* 1~10장 */ ],
  "story": { "eyebrow": "…", "title": "…", "body": "…", "image": "shot:board-3d", "cta": "프로필 링크에서 열기 ↗" },
  "caption": "첫 줄 훅\n\n…\n\n👉 프로필 링크에서 열기",
  "hashtags": ["#프로세스스튜디오", "#축구전술", "#축구코칭", "#작전판", "#유소년축구"]
}
```

장(slide) 모양 — 공통: `eyebrow`(작은 머리말), `title`(`\n` 줄바꿈, `*강조*`), `body`, `image`, `theme`(`""`·`"dark"`·`"green"`).

| layout | 쓰임 | 필드 |
| --- | --- | --- |
| `cover` | 1장(어두운 바탕, 큰 제목, 그림이 아래로 기울어 깔림) | eyebrow · title · body · image |
| `shot` | 앱 화면 한 장 + 설명 | eyebrow · title · body · chips[] · image · badge("01") · tag(그림 위 글) |
| `list` | 2~4개 묶음 | eyebrow · title · body · items[{head,text,mark?}] · image(있으면 작게) |
| `steps` | 순서 | eyebrow · title · steps[{head,text}] · image |
| `term` | 용어 카드 | cat · ko · en · def · cue · note |
| `statement` | 큰 문장 하나 | eyebrow · title · body |
| `cta` | 마지막 장 | title · body · hint |

그림 참조: `shot:<장면>`(capture.mjs — `board-flat`·`board-flat-navy`·`board-flat-white`·`board-3d`·`board-3d-low`·`board-3d-high`·`board-3d-team`), `guide:<guide/img 파일>`, `social:<social/instagram-carousel/assets 파일>`. 옵션: `"fit":"contain"`(잘리지 않게), `"fit":"auto"`(그림 비율 그대로, 잘라 낸 작은 그림에), `"focus":"center"`(잘리는 기준), `"chrome":false`(브라우저 틀 없이). `out:<파일>` 은 그날 폴더에 직접 만든 그림(예: 앱 화면에서 필요한 부분만 잘라 낸 것).

## 전달

1. `SendUserFile` 로 보낸다(`status: "proactive"`): `preview.png`, `01.png`…, `story.png`, `caption.txt`. 캡션 한 줄: `오늘(<날짜>, <요일>) 인스타 — <주제>`.
2. 이어서 메시지에 **캡션 전문**(복사해서 붙일 수 있게, 해시태그 포함)과 올리는 법을 짧게 적는다:
   - 피드: 01→마지막 순서로 사진 선택 → 캡션 붙여넣기 → 공유
   - 스토리: story.png → 링크 스티커에 `https://processstudio.netlify.app`
3. 렌더가 끝내 실패하면 실패한 단계·메시지를 그대로 알린다. 반쯤 된 결과를 다 된 것처럼 보내지 않는다.
