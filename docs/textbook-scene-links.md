# 교과서 · 심화 주제의 편집 장면

`studio/app.html#textbook=scene-<key>`는 `textbook-pack.js`에 등록된 71개 장면만 엽니다. 기존 `ch10`, `ch10-t1` 및 실패·코치 개입 링크도 유지합니다. 로그인 전 요청은 세션에 보관하고 로그인 후 현재 워크스페이스의 보관함에 새 사본을 담습니다. 같은 장면의 수정본이 있으면 이어 열며, 새 사본은 별도 항목으로 추가합니다. 편집 중인 자료가 있거나 가져오는 중 공간이 바뀌면 덮어쓰지 않습니다.

원본은 홈페이지 저장소의 `data-src/textbook/native-scenes-source.json`, `data-src/focus/series-scenes.json`, `data-src/focus/match-scenes.json`, `data-src/textbook/enrichment/{drills,boards}.mjs`입니다. 홈페이지 빌드 후 `node scripts/export-studio-scenes.mjs <Studio checkout>`으로 이 저장소의 `studio/textbook/packs/scenes/`를 갱신합니다. 홈페이지의 선수·공·화살표·단계 설명을 보존하며, 18개 훈련 도식은 같은 백분율 좌표를 실제 훈련 규격에 맞춘 네이티브 그리드로 변환합니다. 학습용 도식은 실측 경기 좌표가 아닙니다.

회귀 검증: `tests/textbook-pack.test.cjs`, `tests/textbook-scene-links.test.cjs`. 모든 자료의 등록 경로·카드 형식·좌표·자막을 확인하고, 첫 담기·수정본 재사용·새 사본·공간 변경 중단을 실행합니다. 실제 편집기는 실계정과 분리된 로컬 API fixture에서 경기 장면과 훈련 도식의 가져오기·이름 수정·저장·재열기를 확인했습니다.
# 2026-10-29 정정본

18개 공통 훈련은 교과서 정정본과 같은 출발 공·패스 관계·운영 규칙을 사용한다. 끝 구역·측면 통로·마무리 구역은 교과서의 미터 값을 실제 그리드 비율로 옮기며, 골키퍼 손 사용 구역은 6×12m이다. 이 훈련만 자료 판본 2로 올려 이전에 편집한 사본은 보존하고 보강판을 새 사본으로 담을 수 있게 한다.

