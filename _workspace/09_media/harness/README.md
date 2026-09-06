# /admin/media 검증 하네스

`_workspace/09_media/shots/` 의 스크린샷과 보고서의 실측 수치를 **그대로 재현**하기 위한 도구 모음.
저장소 코드는 건드리지 않고, 로컬에서만 도는 스텁·스크립트다.

## 검증 층 구성

`backend/.env` 에 ImageKit 실키가 들어온 뒤(2026-09-04)로는 **실계정 검증이 가능**하다.
다만 UI 스크린샷까지 실계정으로 찍으면 운영 라이브러리를 건드리게 되므로 층을 나눠 둔다.

| 층 | 도구 | 무엇을 실제로 확인하나 | 쓰기 범위 |
|---|---|---|---|
| 순수 로직 | `node --test backend/lib/*.test.js` | 경로 정규화·치환·전송 실패/보상 분기 | 없음 |
| 백엔드 라우트 | `backend-checks.sh` | 인증(401/403)·키 가드(503)·입력검증(400)·오류 매핑·키 비노출 | 없음 |
| 실계정 왕복 | `transfer-live.js` | 무료 플랜 제약, 복제 이동/복사, 409, 한글 NFC/NFD, 일괄, DB 결합, 실패 보상 | **`/_ik-test` 하위만** (끝나면 폴더째 삭제) |
| DB 참조 | `refs-roundtrip.js` | 치환·롤백 왕복 | **`imagekit_ref_test`·`imagekit_ref_log` 만** |
| 프론트 UI | `stub-api.js` + `shoot-*.js` | 실렌더·상호작용·콘솔 에러·레이아웃(데스크톱/모바일) | 없음(스텁) |

⚠️ `imagekit_ref_log` 에는 **리드가 실제로 수행한 정리 기록**(`actor: lead-reorg-*`)이 들어 있다.
롤백 근거이므로 하네스 정리 시 **actor 로 범위를 좁혀** 삭제할 것(전체 삭제 금지).

## 사전 준비

- Node 18+
- playwright: 저장소에 없다. `lib/common.js` 의 `resolvePlaywright()` 가
  ① 프로젝트 `node_modules` → ② `~/.npm/_npx/*` 중 **설치된 chromium 리비전과 맞는 버전** 순으로 찾는다.
  없으면 `npx playwright install chromium` 후 재시도.
  (버전이 어긋나면 `Executable doesn't exist at .../chromium_headless_shell-####` 로 실패한다.)

## 로그인 우회 방식

`src/contexts/AuthContext.tsx` 는 서버 검증 없이 `localStorage` 의 `auth_token`/`auth_user` 만 읽고
토큰의 `exp` 만 본다. 그래서 **서명 없는 더미 JWT**(`lib/common.js: dummyAdminJwt`)로 admin 세션을
흉내낸다. 백엔드 호출은 스텁이 받으므로 서명 검증이 일어나지 않는다.
→ 로컬 검증 전용. 운영 백엔드에는 통하지 않는다(JWT_SECRET 검증).

## 실행 순서

```bash
cd <repo>

# 1) 백엔드 라우트 검증 (dev 서버 불필요)
bash _workspace/09_media/harness/backend-checks.sh

# 2) 스텁 API + dev 서버 (별도 터미널 2개)
node _workspace/09_media/harness/stub-api.js          # :8000  ← dev 기본 REACT_APP_API_URL
BROWSER=none PORT=3000 npx react-scripts start        # :3000

# 3) 스크린샷·실측 (shots/ 에 저장)
node _workspace/09_media/harness/shoot-media.js   # media-{desktop,mobile}-*.png
node _workspace/09_media/harness/shoot-edit.js    # edit-*-{1..5}.png  + 회전/크롭 치수·업로드 FormData
node _workspace/09_media/harness/shoot-exif.js    # edit-*-{6,7}.png   + EXIF orientation 6 판정
node _workspace/09_media/harness/shoot-picker.js  # picker-*.png (ImageKitPicker 회귀)
node _workspace/09_media/harness/shoot-blocked.js # edit-desktop-8-avif-blocked.png (미지원 확장자 차단)
node _workspace/09_media/harness/shoot-refs.js    # refs-*.png (이동/이름변경 전 참조 안내)
node _workspace/09_media/harness/shoot-xfer.js    # xfer-*.png (복제 이동/복사 완료 알림)

# 5-1) 복제 방식 이동/복사 (실 ImageKit — /_ik-test 안에서만, 끝나면 폴더째 삭제)
node --test backend/lib/ikTransfer.test.js              # 가짜 SDK 로 실패/보상 분기 14건
node _workspace/09_media/harness/transfer-live.js       # 실계정 왕복(무료 플랜 제약 재확인 포함)

# 6) DB 참조 치환 — 순수 로직 + 실 DB 왕복
node --test backend/lib/ikRefs.test.js                  # 순수 로직 21건(네트워크 불필요)
node _workspace/09_media/harness/refs-roundtrip.js      # 실 DB: 치환 → 검증 → 롤백 → 원상복구

# 7) 대량 재정리 CLI (기본 dry-run — 아무것도 바꾸지 않는다)
node backend/scripts/scanCodeRefs.js                    # 소스 하드코딩 목록 갱신
printf '/mcwjd/workshop\t/archive/2026/workshop\n' > /tmp/m.tsv
node backend/scripts/ikReorganize.js /tmp/m.tsv --dry-run

# 4) 재인코딩 품질 근거 (dev 서버·스텁 불필요)
node _workspace/09_media/harness/quality-bench.js  # → quality-bench.log

# 5) 순수 함수 단위 테스트
CI=true npx react-scripts test --watchAll=false --testPathPattern="imageEdit"
```

## 파일

| 파일 | 역할 |
|---|---|
| `lib/common.js` | playwright 해석, 더미 admin 세션 주입, PNG/JPEG/WebP 헤더 치수 파서, multipart 파서 |
| `stub-api.js` | `/api/imagekit/*` 스텁(:8000). 폴더 트리·목록·검색·상세·용량·purge. 썸네일은 **비정방 400x240** PNG 를 즉석 생성 — 정방이면 회전 시 치수 스왑을 볼 수 없다 |
| `backend-harness.js` | 실제 `backend/routes/imagekit.js` 만 마운트하는 최소 express (`MODE=nokeys` / `MODE=dummy`) |
| `backend-checks.sh` | 위 하네스로 401/403/503/400·상류 매핑·키 비노출 일괄 확인 |
| `make-fixtures.js` | `fixtures/exif6.jpg` 생성 — 저장 픽셀 400x240 + **EXIF Orientation=6**(올바로 표시하면 240x400) |
| `shoot-media.js` | 브라우징·트리·선택·이동모달·상세·전역검색 스크린샷 + 콘솔/가로오버플로 점검 |
| `shoot-edit.js` | 편집 탭: 비파괴 tr 문자열, 파괴 회전/크롭 치수, 업로드 FormData, purge 호출 |
| `shoot-exif.js` | EXIF Orientation=6 반영 여부 PASS/FAIL 판정 |
| `shoot-picker.js` | 에디터용 `ImageKitPicker` 회귀(공용 훅 리팩터 영향) |
| `shoot-blocked.js` | 미지원 확장자(.avif)가 파괴 편집에서 차단되는지 UI 로 확인 |
| `shoot-refs.js` | 이동/이름변경 모달의 참조 안내(참조 있음 / 없음) 스크린샷 |
| `refs-roundtrip.js` | 실 DB 치환→롤백 왕복. **쓰기는 `imagekit_ref_test`·`imagekit_ref_log` 두 컬렉션뿐** |
| `transfer-live.js` | 복제 방식 이동/복사 실계정 검증. **ImageKit 쓰기는 `/_ik-test` 하위뿐**, 끝나면 폴더째 삭제 |
| `nfd-folder-live.js` | 폴더 이름변경 후 하위 **NFD 파일명 보존**을 실계정으로 확인(`/_ik-test-nfd`) |
| `shoot-xfer.js` | 복제 이동/복사 완료 알림(검증 결과·부분 실패) 스크린샷 |
| `quality-bench.js` | 같은 입력·같은 변환으로 quality 1.0/0.95/0.9/0.85/0.82/0.8/0.7 출력 바이트 비교 |
| `fixtures/exif6.jpg` | 위 EXIF 픽스처(커밋됨 — 네트워크 없이도 재현 가능) |

## DB 참조 치환 — 테스트 환경 선택 근거

로컬 `mongod` 도 `mongodb-memory-server` 도 설치돼 있지 않다(새 의존성을 추가하지 않기로 했다).
그래서 `refs-roundtrip.js` 는 **운영 DB에 붙되 쓰기 범위를 두 컬렉션으로 못박는다**:

- `imagekit_ref_test` — 이 스크립트가 만들고 마지막에 `drop` 하는 임시 컬렉션
- `imagekit_ref_log` — 치환 감사 로그(롤백 근거). 종료 시 `actor:'harness'` 항목만 삭제

`applyMappings(db, mappings, { only: [TEST_COLLECTION] })` 로 **스캔·쓰기 대상 컬렉션을 인자로
고정**하기 때문에, 로직상 다른 컬렉션에는 접근조차 하지 않는다.
운영 데이터에 대한 검증(`verify-index` 계열)은 전부 **읽기 전용**이다.

`imagekit_ref_test` / `imagekit_ref_log` 는 `listScannableCollections()` 의 기본 스캔 대상에서
제외되므로, 임시 데이터가 실제 참조 집계를 오염시키지 않는다(테스트로 확인).

## 무료 플랜 제약 (2026-09-04 실측)

`files/move`·`files/copy` 는 **항상** 실패한다.
```
POST /v1/files/move → 400 Versions Limit Exceeded. Limit: 0, Actual: 1
POST /v1/files/copy → 400 (동일)
```
`rename`·`bulkJobs(moveFolder/renameFolder)`·`upload`·`delete` 는 정상.
→ 파일 단위 이동/복사는 `backend/lib/ikTransfer.js` 의 **복제 방식**
(`?tr=orig-true` 다운로드 → 업로드 → size/해상도 대조 → DB 참조 갱신 → 원본 삭제)으로 처리한다.

한글 파일명은 **정규화하면 안 된다**: ImageKit 은 NFD 이름을 NFD 그대로 보관하고
NFC 로 바꾼 URL 은 404 다(실측). 그래서 `ikRefs.targetPath()` 는 NFC 정규화를 하지 않는다.

## 하네스 assertion 원칙 (허위 통과 방지)

`transfer-live.js` [7] 단계에서 **"아무 에러나 나면 PASS"** 로 세다가 허위 통과가 났다.
업로드 직후 경로로 호출하면 목록(검색 인덱스) 미반영으로 404 가 먼저 나는데,
그 404 를 "주입한 DB 실패"로 오탐한 것이다.

그래서 두 가지를 강제한다.
1. 실계정 호출에는 **업로드 응답의 `fileId` 를 넘긴다**(경로 검색 의존 제거).
   경로 해석 경로 자체를 검증할 때만 `waitIndexed()` 로 반영을 기다린 뒤 호출한다.
2. 실패 검증은 **기대한 status·메시지·플래그를 모두 매칭**한다.
   (`e.status===500 && e.compensated===true && /DB 참조 갱신 실패로 이동을 취소했습니다/`)
   추가로 주입 함수가 실제로 호출됐는지(`injected`)까지 확인한다.

보고 시에는 하네스의 마지막 줄(`결과: 실패 N건`)을 **그대로 인용**한다.

## dev 서버가 안 뜰 때

`package.json` 에 `"proxy"` 가 있고 머신에 LAN IP 가 없으면 CRA 가
`allowedHosts: [undefined]` 를 넘겨 다음 오류로 죽는다.
```
Invalid options object. Dev Server ... options.allowedHosts[0] should be a non-empty string.
```
→ `DANGEROUSLY_DISABLE_HOST_CHECK=true npx react-scripts start` 로 실행한다(로컬 전용).

## tsconfig 관련 메모

`@types/jest` 가 설치돼 있지 않아 `*.test.ts` 를 타입 검사 대상에 두면 dev 서버/빌드가
`TS2304: Cannot find name 'expect'` 로 실패한다. 새 의존성을 추가하지 않으려고
`tsconfig.json` 의 `exclude` 에 테스트 파일을 넣었다. jest 는 babel 로 변환하므로
`exclude` 와 무관하게 정상 실행된다(22개 통과 확인).

## 스텁이 실제와 다른 점 (해석 주의)

- 파일 URL 은 실제와 같은 `https://ik.imagekit.io/gc3jtyt9o/...` 형태로 준다.
  그래야 `canTransform()`·`ikUrl()` 경로를 그대로 태울 수 있다.
  대신 스크립트가 그 호스트를 **가로채** 로컬 픽스처 바이트로 응답한다.
  → 비파괴 미리보기는 `?tr=` 이 적용되지 않은 원본 크기로 보인다(변환 파라미터의 실동작은
  `quality-bench` 가 아니라 공개 데모 엔드포인트로 따로 실측했다).
- 업로드는 `upload.imagekit.io` 를 가로채 **요청만 검사**하고 성공을 흉내낸다.
  실제 저장·덮어쓰기는 일어나지 않는다.
- 목록 메타데이터(size/width/height)는 합성값이라 실제 바이트와 다르다.
  파괴 편집 판정은 **미리보기 blob·업로드 바이트의 실측 치수**만 근거로 삼는다.
