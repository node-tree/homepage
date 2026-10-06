# 모바일 공통 메뉴 · 2026-10-06

완료: BRIEF-mobile-menu.md에 따른 구현·프로덕션 빌드·브라우저 검증. push·배포·DB 쓰기 없음.

## 채택한 구현
- 767px 이하: 64px 헤더, 왼쪽 기존 로고 / 오른쪽 44×44px 햄버거 버튼.
- 讀誦 계수와 LOGIN은 패널 내부 하단에 배치. 7개 메뉴를 Mono 세로 목록으로 표시하고 현재 경로는 밑줄·aria-current로 식별.
- 홈 감지금니 및 밝은 내지의 기존 색 토큰 사용. 전환 150ms, reduced-motion에서는 전환 제거.
- X·Esc·바깥 탭·메뉴 이동으로 닫힘. 본문 inert·스크롤 잠금과 위치 복구, Tab/Shift+Tab 순환, 닫은 뒤 트리거 포커스 복귀. 지연 로드되는 다음 페이지의 새 헤더에도 복귀.
- 삼베는 열림 상태에서 숨김. 닫힌 390px 헤더의 실측 안전 중심 구간은 x=158.922~319.563px. 로고·버튼 교차 0. 320px의 기존 캐릭터 숨김 정책 유지.
- reading.css의 이전 116px/2행 메뉴 덮어쓰기 삭제. 데스크톱은 display:contents로 기존 grid 배치 유지.

## 실제 검증
- 프로덕션 빌드: Compiled successfully, 경고 없음. prebuild의 DB 연결 절차는 실행하지 않음. 공유 node_modules는 읽기만 사용, 빌드 캐시는 worktree 내부.
- 127.0.0.1:3601: GET/HEAD만 허용하는 정적 빌드 + 원래 저장소 `_workspace/12_text_layout/raw` 읽기 전용 스냅샷 서버.
- Chromium 13개 시나리오 통과: 390·320px에서 홈·/work·/work/6969e0c950e7b0f6a31e83fa 닫힘/열림, 7개 세로 배치, 활성 항목, 포커스 순환/복귀, X/Esc/바깥 클릭/메뉴 이동, 스크롤 잠금/복구, 가로 넘침 0, 페이지 JS 오류 0.
- 390px 삼베는 각 페이지에서 시간 샘플 12회 추가 관찰: 로고·버튼 교차 0. 메뉴 열림에서는 숨김.
- 1440px 홈·목록·상세 캡처. 새 wrapper를 제거한 기존 DOM 구조와 헤더/로고/내비 7항목/계수/LOGIN의 bounding rect 전부 일치, 헤더 56px 유지.
- 상세 sticky: desktop 헤더 실측 56px +24px =80px, position:sticky 유지. 모바일은 기존 일반 흐름 유지.
- 320·390·1440px PDF: 실제 페이지 이미지 로딩, 다음 쪽 이동, Esc 닫기와 원래 버튼으로 포커스 복귀 통과.
- 모바일→데스크톱→모바일 전환 시 스크롤 잠금·inert 해제 및 닫힘 상태 확인. reduced-motion 전환 0s 확인.
- 증거: `verification.json`, `build.log`, `output/playwright/`의 최종 PNG 18장. 캡처 중 홈/밝은 메뉴, 상세, PDF를 직접 열어 관찰함.

## 수정 파일
`src/redesign/components/Header.tsx`, `SambeWalker.tsx`, `src/redesign/nt.css`, `reading.css`, `home/home.css`.
검증 도구는 현재 폴더 `build.cjs`, `server.cjs`, `verify.cjs`.

## 재현
현재 worktree 루트에서:
```
node _home/mobile-menu/build.cjs
node _home/mobile-menu/server.cjs
TMPDIR="$PWD/_home/mobile-menu" node _home/mobile-menu/verify.cjs
```
검증 스크립트는 이 장비에 이미 설치된 Playwright와 Google Chrome을 사용한다.

## 한계·인계
- 실물 iOS/Android·VoiceOver/TalkBack·로그인한 관리자 계정은 미검증. 실 DB/배포 API는 호출하지 않음.
- Claude가 같은 최종 캡처와 코드를 확인한 후 통합·배포 판단. 외부 우편함·전역 journal은 worktree 밖 쓰기 금지에 따라 갱신하지 않았으며 작업일지/다음 행동은 이 폴더에 기록.
- 초기에 확인한 CSS 우선순위 및 열림/페이지 이동 포커스 결함은 수정 후 전체 검증 통과. probe/실패 중간 캡처는 삭제하고 채택본 18장만 보존.
- 모델 추가 호출 없음. 사용량 화면을 조회하지 않았으므로 전후 구독 소진율은 미측정.
