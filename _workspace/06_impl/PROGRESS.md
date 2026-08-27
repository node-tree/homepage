
## 2026-08-27 세션 (DharaniClock 구현 재개)
- [start] 브랜치 redesign/dharani-clock 확인. 정본 Read 시작.
- [read] 정본 4종 완료: hero-dark.html(기하 전량 추출) / 설계 §0-d~e / retypeset.json 구조 / volume.ts:1889-1925 SDF 셰이더 규칙
  - 상수: SDF_EDGE=128/255, SDF_ERODE_GAIN=.16, DENS_FLOOR=0, CREAM=[220,221,211]/221, VERM=[190,60,40]/255, 봉인루마[110,140]·개봉[190,230]
  - 규칙: w=clamp(fwidth(d)*.75,.002,.25); paper=smoothstep(dGate*.5,dGate,dens); a=smoothstep(edge-w,edge+w,d)*paper
  - 기하: viewBox -470..940 / ring r=450k,412,348,284,222,160,112k,80k / tick 200개 r450→442(대강 [3,5,8,11,13,16] →434)
  - 고리: [380 donor h26][316 vow h30][253 dharani h30][191 charm h34][136 seed h22], n=floor(2πr/(h*.78))
  - A(독송)=100.1°, hand2(각)= -100°, sweep W=36°, seed 중심 원 r=78
- [A done] scripts/build-clock-atlas.py → public/dharani/clock-glyphs.{png,json}
  - 선정 donor48/vow48/dharani40/charm24(주서)/seed9 = 169군, 전부 source=seg
  - 아틀라스 2048x1024, 텍셀 1,230,594(점유 58.7%), PNG **592,472 B = 578.6 KB** (<=600KB OK)
  - 축소: 고리 1.5텍셀/판화소, 종자자 2.5. 여백 트림 3판화소, SDF 밴드 ±2텍셀 포화(이득), 농도 16단
- [B done] 컴포넌트 작성
  - src/components/DharaniClock/{beat.ts,atlas.ts,glyphRenderer.ts,DharaniClock.tsx,DharaniClock.css}
  - src/components/DharaniClockPage.tsx + src/App.tsx 에 `/clock` lazy 라우트(기존 라우트 무수정)
  - 렌더: WebGL2 인스턴싱 SDF(폴백 3× 래스터 스프라이트), SVG 2층(아래=고리/눈금/가림/중심지, 위=부채꼴/바늘/OCR/계기)
- [D-1 관찰] 1차 실렌더 결함 4
  1) 중심 종자자가 덩어리 — retypeset 자동 군집이 종자자(3×3 = 9자, 각 ~110×150 판화소)를 조각냈고
     glyph_cap(2.0×pitch=63.6)이 진짜 종자자를 전부 걸러냄 → **판 조각을 9군집으로 다시 묶어야** 함
  2) 원반이 뷰포트 아래로 넘침(1152 > 1024) → 디스크 최대폭 제한 필요
  3) headless chromium 에 WebGL2 없음 → 래스터 폴백만 검증됨(launch args 필요)
  4) fps 52.3(데스크톱 다크) — 매 프레임 전량 재드로 → dirty 추적 필요
- [B/C done] 결함 5종 수정
  1) 중심 종자자 → 판 조각 9군집(축별 1D k-means 3×3) 재조립, 브러시 범자 9자 확인(seed_preview.png)
  2) 원반 지름 912px 상한(12정간 1152 > 히어로 1024) → 뷰포트 안에 온전히 들어옴
  3) 먹 사각(inkBox) 도입 — 타일의 SDF 여백 때문에 글자가 15% 작아지던 것 교정(먹높이/타일 평균 0.844)
  4) 판독 블록/라벨/캡션이 원반에 얹히던 문제 — **그리드 컨테이너의 절대배치 자식은 그리드 영역이
     컨테이닝 블록**이라 left/right 가 원반 칸 기준으로 잡혔다. grid-column:auto 로 해제 + ≥1600 에서만 겹배치
  5) 중심 종자자 크로스페이드가 같은 자를 (1−e)·e 로 두 번 그려 유령처럼 옅어짐 → 같은 자/전환완료면 한 장만
  + 주서 밝기 계수 1.20(랩 '개봉' vermS) 적용, OCR 라벨은 고리마다 바늘에 가장 가까운 한 칸에만(겹침 해소)
  + 성능: 고리 정지이므로 걸음(300ms) 이후 재드로 중단(dirty), 래스터 폴백은 고리를 한 장으로 미리 구움
- [D done] 검증 — _workspace/06_impl/ 참조
- [D-2 정정] 1차 보고 누락 — dev 로그의 webpack 경고 1건(내 코드)을 확인하지 않고 "콘솔 에러 0"만 보고했음.
  `react-hooks/exhaustive-deps`: `seedIds = set?.rings.seed ?? []` 가 매 렌더 새 배열 → seedsFor 불안정 →
  이를 의존성으로 가진 rAF 효과가 리렌더마다 재부착될 수 있었다(박마다 setBeat 리렌더라 실제로 물린다).
  useMemo + 모듈 상수 EMPTY_IDS 로 참조 고정. 재컴파일 **Compiled successfully! / 경고 0**.
  재검증 전항목 통과(fps 60.5~61.2, 겹침 0, 왕복 6/6, 가시성 PASS, reduced 정지 PASS, 폴백 raster 61.0).

## iteration 2 (REWORK 회신 반영)
verdict: `~/.claude/.quality-gate/verdicts/2026-08-27-nodetree-dharani-clock.json` (REWORK, it.1)

- [blocker 2] **종자자 9자 재조립** — 조각 무게중심 k-means 폐기.
  `seed_lattice_tiles()`: ① 판 전체 SDF 합성 → 잉크장 ② 행 경계 = 전역 가로 투영 골짜기(y 217·390),
  열 경계 = **행마다** 세로 투영 골짜기(x [168,247]/[148,272]/[129,266] — 아래 행은 글자가 왼쪽으로 몰려 있다)
  ③ 연결 성분을 무게중심이 속한 칸에 **소유**시켜 이웃 꼬리 제거(버린 잉크 0.054%)
  ④ 통일 창(141×202, 종횡비 0.698)을 칸의 잉크 무게중심에 맞춰 놓고 판 밖으로 못 나가게 클램프
  ⑤ 창 안 잉크 무게중심 어긋남을 `centerOffset` 으로 실어 렌더가 되민다(가장자리 칸의 창 클램프 보정)
  ⑥ 종자자는 **먹 사각 정규화를 쓰지 않고 통일 창을 렌더 사각**으로 쓴다 — 먹 사각으로 정규화하면
     판에서 작게 쓰인 아래 행 자가 홀로 크게 부풀고 납작한 자가 좌우로 늘어난다(it.1 種字 07)
  실측(빌더): 높이 편차 **1.00배** · 종횡비 **0.700**(전 9자 동일, 요구 0.5~0.7) · 중심이탈 최대 0.187R · 판 안쪽 True
  실측(?beat=0..8 실렌더, r112 안쪽만): **중심이탈 최대 0.021R**(it.1 0.474R) · 먹 높이 125~200 · 잉크량 편차 1.91배
  ⚠ 잉크량 편차 목표 1.3배 미달 — 원판 자체의 편차다. 크기를 강제 균일화하면 오히려 2.45배로 악화(측정),
     아래 행 3자가 원판에서 더 작고 획이 가볍다. 군집 실패가 아니라 도판의 사실.
- [blocker 3] `.dclock__meter` <g>(y=-96·y=104) + CSS **삭제**. 같은 문구는 판독 블록에만 있다(41번 §2).
- [blocker 1] 동결 절차: 이번 회차는 이 커밋 이후 산출물·증거를 건드리지 않는다. amend 없음.
- 비차단: hand2 `--hand2` = 다크 rgba(220,221,211,.7) / 라이트 #0F0F1A (목업 일치) ·
  SEED_H 132→190(중심 칸 r112 를 목업 비율 0.85 로 채움) · DharaniClockPage 390 헤더 겹침 해소(flex+약칭)
- 자산: 2048×1024 · texels 1,361,880 · PNG **583,272 B = 569.6 KB**(≤600KB) · JSON 58,910 B (build-atlas.log 갱신)
- 검증 재실행: webpack **Compiled successfully! 경고 0** · WebGL2 6종 fps 60.3~61.1 · 콘솔 error/pageerror/requestfailed **0** ·
  겹침 0/0/0 · 박 10/10 · 왕복 6/6 · 탭 가시성 PASS · reduced 정지 PASS · 폴백 raster 60.3 · IoU min 0.9329 mean 0.9472

**iteration 2 제출 · 동결** — 동결 지점 = 이 PROGRESS.md 를 포함한 마지막 커밋(HEAD). 이후 파일 변경 없음.
