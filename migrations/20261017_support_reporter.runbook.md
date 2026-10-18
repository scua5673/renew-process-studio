# 20261017 — 오류 제보 «보낸 사람» (SQL 편집기에서 실행)

## 왜

관리자 «오류 제보» 접수함은 제보마다 «내 글인지»(`is_own`)만 받는다. 누가 보냈는지 알려면 SQL 로 `reporter_id` 를 찾아
«사람» 화면과 맞춰 봐야 했다(사용자 2026-10-17 «오류제보에 누가 올린건지 관리자화면에서 알고 싶다»).

## 바뀌는 것

- `ps_support_reporter(uuid)` — 새 내부 보조. `{user_id, name, email, teams:[{name, role}]}`.
  이름은 `ps_admin_people` 과 같은 차례(팀 멤버 이름 → 계정 이름), 팀은 `kind='team'` 만. 앱 역할(anon · authenticated)은 부르지 못한다.
- `ps_support_inbox` · `ps_support_get` — **관리자에게만** 제보마다 `reporter` 를 붙인다. 이름 · 인자 · 권한 그대로 몸만 바뀐다.
  일반 계정의 답은 한 글자도 같다(`local-test` 가 설치 전 답과 견준다). 제보 본문 · 진단 · 답변 · 상태는 손대지 않는다.
- 설치 파일에 기존 함수 · 정책을 지우는 문장은 없다(연결 도구에서 그런 문장은 확인 대기로 멈췄다 — 20261014 applied.md).

## 실행 순서

1. `20261017_support_reporter.sql` 전체 실행 → «Success». (20261014_support_triage 가 먼저 깔려 있어야 한다 — 없으면 예외로 멈춘다.)
2. `20261017_support_reporter.verify.sql` 실행. 기대:
   `reporter true · wired_inbox true · wired_get true · auth_reporter false · anon_reporter false · auth_inbox true · auth_get true · anon_inbox false · secdef true · marker 1 · triage_marker 5`
3. 읽기 확인(관리자 화면 대신):
   ```sql
   select left(id::text,8) id, title, public.ps_support_reporter(reporter_id) from public.ps_support_reports order by created_at desc limit 5;
   ```
4. 관리자 화면 «오류 제보»: 목록 줄마다 «보낸 사람 이름 · 팀», 제보를 열면 머리에 이름 · 이메일 · 팀.
   클라이언트(`studio/admin-support.js`)는 SQL 이 없으면 예전 화면 그대로다 — SQL 을 먼저 깔아도, 나중에 깔아도 된다.

## 되돌리기

`20261017_support_reporter.rollback.sql` — 목록 · 한 제보 함수를 20261014 · 20260915 판 몸으로. 관리자 답에서 `reporter` 만 빠진다.
보조 `ps_support_reporter` 는 남긴다(부를 수 없다). 지우는 줄은 파일 맨 아래 주석.

## 시험

```sh
node migrations/20261017_support_reporter.local-test.cjs   # npm run test:sql 에 저절로 들어간다
```
