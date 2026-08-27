# v5 재조판 — 원래 페이지 5종을 「내용은 DB 그대로, 디자인만 v5」로

작업일 2026-08-27 · 브랜치 `redesign/pages` · 기준 커밋 643ee7b

사용자 지시: **구조·메뉴·내용은 원래대로, 바꾸는 건 디자인뿐.**
따라서 정본은 계속 DB(`/api/work`·`/api/filed`·`/api/about`·`/api/cv`·`/api/contact`)이고,
v5 는 조판(정간 20 격자 · 계선 · 도판 창 · Mono 메타 · 결측 표기)만 갈아끼웠다.
정적 복사본은 만들지 않았다 — 레거시 컴포넌트가 쓰던 `src/services/api.js` 를 그대로 재사용한다.

## 만든 것

| 경로 | 파일 | 판식 정본(목업) | 내용 정본(DB) |
|---|---|---|---|
| `/about` | `src/redesign/pages/About.tsx` | `v5/about.html` (좌 6정간 소개 / 우 10정간 도판) | `/api/about` (문단 6 · 대표 이미지 1) |
| `/work` | `pages/Work.tsx` | `v5/works.html` (도판 흐름 i1~i8 + 텍스트 인덱스) | `/api/work` 16점 + `/api/work/header` |
| `/work/:id` | `pages/WorkDetail.tsx` → `pages/PostDetail.tsx` | `v5/work.html` (세로쓰기 메타 / 본문 / 도판 창 / 다음 작품) | 같은 글의 `content`(HTML) |
| `/commons` | `pages/Commons.tsx` | `v5/index.html` 피드 행 + 인덱스 행 | `/api/filed` 34건 + `/api/filed/header` |
| `/commons/:id` | `pages/CommonsDetail.tsx` → `PostDetail.tsx` | `v5/work.html` 재사용 | `/api/filed` |
| `/cv` | `pages/CV.tsx` | `v5/index-archive.html` (좌 연도 Mono · 앵커) | `/api/cv` 줄글 파싱 |
| `/contact` | `pages/Contact.tsx` | `v5/about.html` 의 Contact 블록 | `/api/contact` + 메시지 전송 API |

공용 인프라
- `src/redesign/db.ts` — DB 훅(usePosts·useHeader·useAbout·useCv·useContact·useResearchSynced), cleanup 으로 언마운트 후 setState 차단.
- `src/redesign/components/RichHtml.tsx` — **레거시 에디터 HTML → v5 조판**. DOMPurify 살균(iframe 허용) 후
  `style`/`class`/`<font>` 등 옛 판식 잔재만 제거하고, 빈 `<p><br></p>` 더미를 걷어낸다.
  `<img>` 는 도판 창(`figure.rfig`, 봉인 72% → 호버 100%, 창 높이 min(76vh,880px))으로, `<iframe>` 은 16:9 창으로 승격.
  ImageKit 변환은 `ikUrl`(GIF 무변환) 규칙 유지.
- `components/PlateImage.tsx` — DB 이미지용 도판 창(원형 썸네일·둥근 모서리 없음, 없으면 `absent` 점선 창).
- `components/bits.tsx` — 표제 부제(개행 보존) · 상태 표시(Mono 한 줄) · 관리자 편집 안내.
- `nt.css` +230줄(`.rich` · `.plate.pic` · `.prow-l` · `.form` · `.state` 등, 전부 `.nt` 안).

## 라우팅

```
/            NtHome(그대로)
/about       About(v5+DB)
/work        Work 목록      · /work?post=<id> → /work/<id> (구 발행 URL 보존)
/work/:id    WorkDetail     · /work/research/:postId 는 그대로(앞선 라우트)
/commons     Commons 목록   · /commons?post=<id> → /commons/<id>
/commons/:id CommonsDetail
/cv /contact CV · Contact
/index · /works-v5 · /about-v5 → /cv · /work · /about 로 리다이렉트(시안 URL 보존)
/legacy · /iso · /ocean · /guestbook  회귀 없음
```
- 시안 컴포넌트 `pages/Legacy.tsx`·`Works.tsx`·`IndexPage.tsx` 삭제.
- 원래 컴포넌트 `src/components/*.tsx` 는 **삭제하지 않았다** — `/legacy` 편집기에서 계속 쓴다.
- `public/sitemap.xml` 60 URL 로 갱신(작품 16 · 공유지 34 · 페이지 6 · 기타 4).

## 검증 (증거는 이 폴더)

리그(저장소 의존성만 사용, CDP 직접 구동):
- `shoot.js <path> <slug>` — 1920 데스크톱 · 390 모바일 풀페이지 PNG + 본문 텍스트 + 콘솔/네트워크 로그 + 고정 헤더 hit-test.
  (lazy 이미지는 한 번 훑어 로드시킨 뒤 촬영한다 — 안 그러면 도판이 빈 채로 찍힌다.)
- `routes.js` — 기존 발행 URL 18개 회귀(최종 URL·표제·콘솔).
- `textdiff.js` — DB 원문 토큰이 페이지에 전부 실렸는지(누락 0 확인).
- `crop.py` — 풀페이지 PNG 구간 확대 확인용.

결과(2026-08-27 실행 원문 = `shots/*.json`, `routes.json`):
- 콘솔 error 0 · pageerror 0 · 실패 요청 0 — /about · /work · /work/:id 3건 · /commons · /commons/:id · /cv · /contact.
  (React Router v7 future flag **warning** 2건은 앱 전역 기존 사항이라 그대로 남는다.)
- 고정 헤더 hit-test: 데스크톱·모바일 전 페이지 `covered:false`(헤더 바로 아래 3지점 elementFromPoint 가 `header` 밖).
- DB 텍스트 누락: **총 0 토큰** (about 234 / cv 505 / contact 25 / work 목록 74 / commons 목록 107 /
  상세 corrosia 211 · ediaphonic 161 · 낙원식당 176 · 워크북 67 토큰 전량 일치).
- 작품 상세 3종 실렌더 확인: 도판+영상(에디아포닉·PDF 도록 2행), 텍스트만(Corrosia·리서치 아카이브 행),
  이미지 다수(낙원식당·방명록 행). 공유지 상세는 인라인 PDF 워크북(`object`)까지 확인.
- `npm run build` → `Compiled successfully.` (경고 0)

스크린샷: `shots/<slug>-{desktop,mobile}.png` (42MB — 저장소에 넣지 않고 로컬 증거로 둔다.
커밋에는 `.json`·`.txt` 로그와 리그 스크립트만 넣는다.)

## 남긴 것 · 판단

1. **관리자 편집 UI 는 v5 페이지에 옮기지 않았다.** 새 글 작성·수정·삭제·순서 편집·헤더 편집은
   레거시 편집기(`/legacy`)에 그대로 있고, 로그인 상태에서만 각 페이지 하단에 그 링크(`.adminline`)를 낸다.
2. **장식용 캔버스 2종 미이식** — 공생직조 상세의 부식 reaction-diffusion 히어로(p5)와 낙원식당의
   ReconnectAnimation. 둘 다 옛 판식의 장식이라 v5 도판 창 문법과 충돌한다(내용 텍스트 누락은 0).
   되살릴지는 사용자 판단 대기.
3. **매체·장소는 `absent`** — `/api/work` 스키마에 해당 필드가 없다. 만들지 않고 자리만 비웠다(설계 §2.2).
   DB 에 필드가 생기면 `Work.tsx`·`PostDetail.tsx` 의 `—` 자리에 그대로 꽂으면 된다.
4. **COMMONS 도판 흐름은 최근 8건** — 34건 전부를 피드로 깔면 3만 px 가 된다(실측). 나머지는 인덱스 행에 전량.
5. `/work` 인덱스의 연도 묶음은 역순 정렬. 도판 흐름은 DB `sortOrder` 순서 그대로다.
