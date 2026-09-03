# /admin/media 검증 하네스

`_workspace/09_media/shots/` 의 스크린샷과 보고서의 실측 수치를 **그대로 재현**하기 위한 도구 모음.
저장소 코드는 건드리지 않고, 로컬에서만 도는 스텁·스크립트다.

## 왜 스텁이 필요한가 (중요)

`backend/.env` 와 Vercel 운영 env 모두 `IMAGEKIT_PUBLIC_KEY` / `IMAGEKIT_PRIVATE_KEY` 가 **빈 값**이다
(`IMAGEKIT_URL_ENDPOINT` 만 설정됨). 따라서 `/api/imagekit/*` 는 전부 **503** 을 반환하고
실제 ImageKit 데이터를 받을 수 없다.

그래서 검증을 세 층으로 나눴다.

| 층 | 도구 | 무엇을 실제로 확인하나 | 확인 못 하는 것 |
|---|---|---|---|
| 백엔드 라우트 | `backend-checks.sh` | 실제 `routes/imagekit.js` 를 마운트해 인증(401/403)·키 가드(503)·입력검증(400)·상류 오류 매핑·키 비노출 | ImageKit 실호출 결과 |
| 프론트 UI | `stub-api.js` + `shoot-*.js` | 실렌더·상호작용·콘솔 에러·레이아웃(데스크톱/모바일) | 실데이터 |
| 이미지 파이프라인 | `shoot-edit.js`·`shoot-exif.js`·`quality-bench.js` | canvas 편집 결과의 **실제 픽셀 치수·바이트**, 업로드 FormData 필드, EXIF 반영 | ImageKit `overwriteFile` 이 정말 URL 을 유지하는지, purge 응답 원문 |

**미검증으로 남는 것**: 실계정 왕복(업로드→이동→이름변경→덮어쓰기→같은 URL 재요청→퍼지).
키가 채워지면 `/_ik-test/` 폴더로 수행해야 한다.

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
| `quality-bench.js` | 같은 입력·같은 변환으로 quality 1.0/0.95/0.9/0.85/0.82/0.8/0.7 출력 바이트 비교 |
| `fixtures/exif6.jpg` | 위 EXIF 픽스처(커밋됨 — 네트워크 없이도 재현 가능) |

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
