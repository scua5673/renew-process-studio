# 엘미하 전술노트의 유튜브 연결

카드의 전술 자료 열기·애니메이션·보관함 담기는 기존 경로를 사용한다. 유튜브 영상은 카드의 `유튜브 보기 ↗` 링크로 별도 탭에서 연다.

- 구현: `studio/community-youtube.js`, `community-youtube.css`.
- 엘미하 작성자만 올리기 창에 선택 입력칸이 보인다. 검증된 영상 URL을 기존 `ps_community.item.youtubeUrl`에 저장한다. DB 스키마 변경은 없다.
- 엘미하 목록은 `youtubeUrl:item->>youtubeUrl`만 투영해서 가져온다. 카드 썸네일을 위해 전체 작전판 JSON을 요청하지 않는다.
- 기존 작전판 SVG와 JSON은 보존한다. 카드만 유튜브 썸네일을 사용하며 maxresdefault → hqdefault → 원래 작전판 그림 순으로 대체한다. 120px 이하의 유튜브 자리표시자도 실패로 처리한다.
- 작전판 편집 반영 때 `preserve`가 원글의 영상 메타데이터를 유지한다. 영상 ID는 11자리이고 정확한 YouTube 호스트만 허용한다. 임의 URL·HTML은 이미지나 링크로 사용하지 않는다.
- 기존 글은 작성자 ID와 글 ID가 정확히 일치할 때만 아래 영상을 사용한다. 새 글의 제목을 추측해서 자동 연결하지 않는다. 저장된 메타데이터가 있으면 아래 초기 연결보다 우선한다.

## 기존 공개 글과 원본 영상

2026-10-30 공개 커뮤니티 응답과 [엘미하 채널](https://www.youtube.com/@ELMIHA_TacticalNote/videos)을 대조했다. 공개 글의 제목·스코어는 수정하지 않았다. ATM–맨유 글은 제목의 스코어 표기와 영상 썸네일의 표기가 다르지만, 원자료의 아틀레티코 빌드업 1~3·미들써드·카운터프레싱 등 페이지 구성, 해당 영상의 제목·상대 팀·챔피언스리그 표기를 대조해 연결했다. 스코어 불일치는 원자료 작성자가 확인할 항목이다.

| 공개 글 ID | 카드 | 원본 영상 |
|---|---|---|
| Cmvrx0ojpstsx | 첼시–토트넘 | https://www.youtube.com/watch?v=c5qzlz7t8hI |
| Cmvquqwqvag2b | 바르셀로나–레알 마드리드 | https://www.youtube.com/watch?v=zVXyNQeFE5U |
| Cmvjm1wl966iv | PSG–바르셀로나 | https://www.youtube.com/watch?v=DEENs8TVPGY |
| Cmvat5mje0gnu | ATM–맨유 | https://www.youtube.com/watch?v=MMG4OQ8EFgM |
| Cmvat3c6ssazc | 리버풀–맨시티 | https://www.youtube.com/watch?v=1fGEsnvyTdU |

## 검증

`tests/community-youtube.test.cjs`: URL 형식·안전한 호스트·5개 연결·편집 시 메타데이터 유지.

`tests/browser/community-youtube.mjs`: 실제 카드 DOM·다섯 개 영상 링크·팝업 이동·그림 두 단계 실패·업로드 URL 검증·저장 및 다시 불러오기. 가상 서버가 모든 쓰기를 가로챈다. 공개 응답과 다운로드한 썸네일로 시각 확인할 때만 `PS_YOUTUBE_PREVIEW_POSTS`를 지정한다. 기본 CI는 자체 가상 자료로 실행한다.

`tests/browser/community-elmiha.mjs`: 기존 자료 열기·애니메이션·보관함 담기 회귀 확인.
