# 프로세스 레터 — 원고 한 번 발행, 두 사이트 반영

2026-10-28 사용자 결정: 레터 46호 전체와 모든 글·훈련을 항상 공개한다. 공개 날짜와 단톡방 소개 일정을 분리한다. 단톡방은 월요일 09:00 KST에 4호부터 한 호씩 소개하며, 별도 자동화에서 관리한다.

정본은 기존 레터 사이트의 `site/src/issues/NN.json`이다. 스튜디오의 `studio/letters`는 배포 사본이며 직접 편집하지 않는다. 원본 `date`·`days`는 과거 편집 일정으로 보존한다.

## 발행

원본을 저장한 뒤 한 번 실행한다:

```sh
node scripts/publish-letters.mjs --source '/Users/scua/Claude/Projects/프로세스/프로세스레터/site' --workspace '/Users/scua/Documents/ChatGPT/프로세스 스튜디오/outputs/letter-publications'
```

사용자의 기존 GitHub CLI 로그인과 Netlify CLI 로그인을 사용한다. 새 자격 증명이나 서버는 만들지 않는다. 원고 준비만 확인하려면 `--prepare`를 덧붙인다. Mac의 Python 3·Node·Git·gh가 필요하다.

1. 원본을 별도 스냅샷으로 복사하고, 복사 도중 변경되지 않았는지 확인한다.
2. 모든 원고·기존 호 누락·훈련 팩 연결을 검증하고 스튜디오 원고, 검색 색인, 리비전을 갱신한다. 깨진 원고나 새 훈련 팩 누락이 있으면 발행을 중단한다.
3. 공개 레터 전체를 빌드하고 예약 제한이 없는지 확인한 뒤 Netlify 미리보기를 검증한다.
4. 원고가 바뀌었으면 스튜디오의 캐시 버전을 올리고 Node·SQL 검사, PR의 필수 CI, staging 배포 확인을 거쳐 main으로 승격한다. 로그인·저장 코드나 다른 작업이 staging에 섞여 있으면 자동 승격하지 않는다.
5. 스튜디오 운영 원고가 확인되면 같은 원고의 공개 레터 미리보기를 운영에 게시한다. 양쪽 리비전이 일치해야 완료로 기록한다.

원고 저장만으로 외부 게시하지 않는다. 사용자가 선택한 발행 명령을 실행해야 반영된다. 두 사이트는 순서대로 게시하므로 잠시 다른 판이 보일 수 있다. 실패하면 오류를 해결한 뒤 같은 명령을 다시 실행한다. 이미 게시된 리비전은 재발행하지 않고, 진행 중 PR·배포를 확인해 이어간다. 원고를 계속 수정했으면 완료 기록의 `newerEditsPending`을 확인하고 다음 발행을 실행한다.

## 확인과 복구

- 스튜디오: `/studio/letters/revision.json`
- 공개 레터: `/letters/revision.json`
- 각 리비전은 원본 호별 파일의 SHA-256을 합산한 값이다. 원고 본문은 두 사이트의 위 경로 아래 `NN.json`으로 확인한다.
- 실행 기록과 스냅샷은 지정한 workspace에 남는다. `running.lock`이 남으면 실행 중인 발행 프로세스가 없는지 확인한 뒤에만 지운다.
- 원고 삭제는 자동 반영하지 않는다. 기존 호가 사라지면 오류로 중단해 의도치 않은 공개 자료 손실을 막는다.
- 새 호에 훈련이 있으면 스튜디오 훈련 팩과 썸네일을 먼저 준비한다. 세션 장면 변경은 기존 팩 제작 절차도 함께 따른다.

`import-community-letters.mjs <source> --check`는 원본을 수정하지 않고 반영될 파일을 보여 준다. 일반 실행도 전체를 검증한 후에만 배포 사본을 쓴다.

검증: `letter-source-import.test.cjs`, `letter-publish.test.cjs`, `community-letters.test.cjs`, `letter-social.test.cjs` 및 기존 전체 CI.
