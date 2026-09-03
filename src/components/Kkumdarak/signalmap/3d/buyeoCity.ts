// @ts-nocheck
// ═══════════════════════════════════════════════════════════════════════
// buyeoCity.ts — 작은 부여 도시 조립 (배치도 08 정본, px/8 → 월드)
//   백마강이 북서→남→동으로 감싸고, 백제교 너머 남쪽이 장암 마을.
//   심시티 문법: 건물은 도로에 면해 반복 배치, 교통은 도로망을 실제로 순환.
// ═══════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { inkLine, grayLine, cyl, ico, at, buildTrack, trackAt, inked } from './ink3';
import { BUILDERS } from './models3';

// 배치도(1440×1040) px → 월드: /8, 중심 원점
const W = (px, py) => [px / 8 - 90, py / 8 - 65];

const line = (pts3, mat = inkLine, dash) => {
  const geo = new THREE.BufferGeometry().setFromPoints(pts3.map(p => new THREE.Vector3(...p)));
  if (dash) {
    const l = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: mat.color, dashSize: dash[0], gapSize: dash[1] }));
    l.computeLineDistances(); return l;
  }
  return new THREE.Line(geo, mat);
};

export function buildCity(scene) {
  const ticks = [];
  const placed = [];                       // 배치 전수 감사용 기록(이름 + 오브젝트)
  //  label = 참여자(아이들)가 적어 낸 「부여 장소」 이름. 주면 감사·디버그 이름이 그 장소명이 된다.
  //  (도로 예외 정규식 /횡단보도|차·주행|버스|경운기|통통배|전봇대|다리/ 에 걸리는 소품엔 라벨을 붙이지 않는다)
  const put = (name, x, z, ry = 0, scale = 1, label) => {
    const m = BUILDERS[name]();
    m.position.set(x, 0, z); m.rotation.y = ry;
    if (scale !== 1) m.scale.setScalar(scale);
    scene.add(m);
    placed.push({ name: label || name, obj: m });
    if (m.userData.tick) ticks.push(m.userData.tick);
    return m;
  };

  // ── 백마강: 두 둑 + 흐름 점선 ──
  const bankA = [[150,0],[230,120],[180,260],[230,420],[330,560],[420,660],[620,730],[900,760],[1200,745],[1440,750]].map(p => W(...p));
  const bankB = [[240,0],[320,130],[265,260],[315,410],[410,545],[500,620],[660,665],[910,692],[1200,678],[1440,682]].map(p => W(...p));
  const mid   = [[200,60],[275,190],[222,300],[280,430],[380,560],[560,660],[900,726],[1440,716]].map(p => W(...p));
  scene.add(line(bankA.map(([x,z]) => [x, 0.03, z])));
  scene.add(line(bankB.map(([x,z]) => [x, 0.03, z])));
  scene.add(line(mid.map(([x,z]) => [x, 0.03, z]), grayLine, [1.2, 1.6]));
  const riverTrack = buildTrack(mid);
  // 흐름 물결 6
  const flows = [];
  for (let i = 0; i < 6; i++) {
    const fl = line([[-0.7, 0.06, 0], [0.7, 0.06, 0]], grayLine);
    scene.add(fl); flows.push({ fl, off: i * riverTrack.total / 6 });
  }
  ticks.push(t => flows.forEach(({ fl, off }) => {
    const p = trackAt(riverTrack, t / 260 + off);
    fl.position.set(p.x, 0, p.z); fl.rotation.y = p.ang;
  }));

  // ── 도로망: 간선(남북) + 읍내 가로 2 + 동측 연결 + 장암 길 ──
  const roads = [
    [[700, 60], [700, 655]],      // 간선 북측 — 백제교 접속부에서 끊는다
    [[700, 768], [700, 1000]],    // 간선 남측
    [[430, 300], [1150, 300]],
    [[430, 470], [1050, 470]],
    [[1050, 300], [1050, 672]],   // 동측 북 — 동교 접속부
    [[1050, 760], [1050, 880]],   // 동측 남
    [[120, 880], [1150, 880]],
  ];
  for (const [a, b] of roads) {
    const [ax, az] = W(...a), [bx, bz] = W(...b);
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz), nx = -dz / len * 1.4, nz = dx / len * 1.4;
    scene.add(line([[ax + nx, 0.02, az + nz], [bx + nx, 0.02, bz + nz]]));
    scene.add(line([[ax - nx, 0.02, az - nz], [bx - nx, 0.02, bz - nz]]));
    scene.add(line([[ax, 0.02, az], [bx, 0.02, bz]], grayLine, [0.9, 1.1]));
  }
  // ── 다리 2 (백제교·동교) — 강폭에 정확히 걸치는 파라메트릭 교량 ──
  const DECK_TOP = 0.92;
  const buildBridge = (px, pyA, pyB) => {
    const [x, zA] = W(px, pyA); const [, zB] = W(px, pyB);
    const L = Math.abs(zB - zA) + 3, mid = (zA + zB) / 2;
    const g = new THREE.Group();
    // 상판(살짝 두꺼운 거더) + 테두리 림
    g.add(at(inked(new THREE.BoxGeometry(3.2, 0.24, L)), 0, 0.8, 0));
    g.add(at(inked(new THREE.BoxGeometry(3.5, 0.1, L + 0.3)), 0, DECK_TOP, 0));
    // 접속 램프(양끝 경사면)
    for (const end of [-1, 1]) {
      const ramp = inked(new THREE.BoxGeometry(3.2, 0.1, 2.6));
      ramp.position.set(0, 0.5, end * (L / 2 + 1.1));
      ramp.rotation.x = end * 0.3;   // 바깥끝이 내려가는 경사(진입로)
      g.add(ramp);
    }
    // 교각 + 물가르개(유선 원기둥)
    const nPier = Math.max(2, Math.round(L / 5));
    for (let i = 1; i <= nPier; i++) {
      const pz = -L / 2 + (L / (nPier + 1)) * i;
      g.add(at(inked(new THREE.BoxGeometry(2.6, 0.85, 0.6)), 0, 0.4, pz));
      g.add(at(cyl(0.42, 0.5, 0.7, 8), -1.55, 0.32, pz));
      g.add(at(cyl(0.42, 0.5, 0.7, 8), 1.55, 0.32, pz));
    }
    // 아치 리브 — 교각 사이 스팬마다 양측면
    for (let i = 0; i <= nPier; i++) {
      const a = -L / 2 + (L / (nPier + 1)) * i;
      const b = -L / 2 + (L / (nPier + 1)) * (i + 1);
      for (const sx of [-1.62, 1.62]) {
        const pts = [];
        for (let k = 0; k <= 10; k++) {
          const u = k / 10;
          pts.push(new THREE.Vector3(sx, 0.72 - Math.sin(u * Math.PI) * 0.45, a + (b - a) * u));
        }
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), inkLine));
      }
    }
    // 난간(레일 + 살) + 가로등 4
    for (const sx of [-1.5, 1.5]) {
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
        [new THREE.Vector3(sx, 1.42, -L / 2), new THREE.Vector3(sx, 1.42, L / 2)]), inkLine));
      const nPost = Math.round(L / 1.1);
      for (let i = 0; i <= nPost; i++)
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
          [new THREE.Vector3(sx, DECK_TOP, -L / 2 + (L / nPost) * i), new THREE.Vector3(sx, 1.42, -L / 2 + (L / nPost) * i)]), inkLine));
    }
    for (const pz of [-L / 2 + 0.8, L / 2 - 0.8]) for (const sx of [-1.7, 1.7]) {
      g.add(at(cyl(0.035, 0.035, 1.1, 5), sx, 1.55, pz));
      g.add(at(cyl(0.13, 0.05, 0.15, 6), sx, 2.15, pz));
    }
    g.position.set(x, 0, mid);
    scene.add(g);
    return { x, z0: Math.min(zA, zB) - 2.4, z1: Math.max(zA, zB) + 2.4 };
  };
  const bridge1 = buildBridge(700, 669, 738);   // 백제교
  const bridge2 = buildBridge(1050, 685, 752);  // 동교

  // ── 강변 디테일: 갈대 군락·자갈·잔물결 V·선착장 잔교 ──
  [[255,150],[210,360],[300,480],[365,600],[470,650],[560,700],[850,700],[1150,700],[420,590]]
    .forEach(([gx,gz],i)=>put('갈대', ...W(gx,gz), i * 0.8, 0.8 + (i % 3) * 0.15));
  // 자갈 모래톱(안쪽 굽이)
  [[248,300],[262,318],[240,332],[640,700],[660,712],[905,738],[925,730]].forEach(([px2,pz2],i)=>{
    const peb = ico(0.12 + (i % 3) * 0.04); const [wx2, wz2] = W(px2, pz2);
    peb.scale.y = 0.5; peb.position.set(wx2, 0.05, wz2); peb.rotation.y = i; scene.add(peb);
  });
  // 잔물결 V (정적 물결 무늬)
  [[290,180],[250,430],[350,585],[520,672],[760,715],[980,700],[1250,712]].forEach(([px2,pz2],i)=>{
    const [wx2, wz2] = W(px2, pz2);
    scene.add(line([[wx2-0.5,0.05,wz2+0.2],[wx2,0.05,wz2],[wx2+0.5,0.05,wz2+0.2]], grayLine));
    scene.add(line([[wx2-0.3,0.05,wz2+0.55],[wx2+0.05,0.05,wz2+0.4],[wx2+0.4,0.05,wz2+0.55]], grayLine));
  });
  // 선착장 잔교(장암 방향 북안) — 통통배가 지나는 물가
  {
    const [jx, jz] = W(600, 658);
    const deck = inked(new THREE.BoxGeometry(1.1, 0.12, 2.6));
    deck.position.set(jx, 0.35, jz + 0.9); scene.add(deck);
    for (const dz of [0.2, 1.7]) {
      const post = cyl(0.06, 0.06, 0.5, 5);
      post.position.set(jx - 0.4, 0.15, jz + dz); scene.add(post);
      const post2 = cyl(0.06, 0.06, 0.5, 5);
      post2.position.set(jx + 0.4, 0.15, jz + dz); scene.add(post2);
    }
  }

  // ── 부소산 · 낙화암 (북서 강굽이) ──
  put('부소산성', ...W(210, 170), 0.3, 1.7, '관광·부소산성');
  put('낙화암·백화정', ...W(330, 300), 2.4, 1.1, '관광·낙화암');
  put('나무 A', ...W(140, 240), 0, 1.1);
  put('나무 B·침엽', ...W(352, 142), 0);
  put('새·날갯짓', ...W(230, 110), 0);
  put('새·날갯짓', ...W(300, 220), 1.5);

  // ── 부여 읍내: 정림사지 광장 + 격자 블록 ──
  put('정림사지 오층석탑', ...W(760, 250), 0, 1.35, '관광·정림사지');
  // 광장 테두리
  const [px0, pz0] = W(760, 250);
  scene.add(line([[px0-5,0.02,pz0-5],[px0+5,0.02,pz0-5],[px0+5,0.02,pz0+5],[px0-5,0.02,pz0+5],[px0-5,0.02,pz0-5]], grayLine, [0.5,0.7]));
  put('박물관·현수막', ...W(640, 180), 0, 1.1, '관광·국립부여박물관');
  put('마을회관·확성기', ...W(880, 200), Math.PI);
  put('작은 아파트', ...W(990, 180), 0);
  put('작은 아파트', ...W(1020, 250), Math.PI / 2, 0.9);
  // 상가: 가로1 북측·남측 도로에 면해 줄지어 — 참여자 상호를 붙인다
  //   (830,340)·(900,340) 2채는 C 상권 거리 북측 열과 겹쳐 그쪽으로 흡수했다
  const shopRow = [
    [480, 262, 0, '상가 A', '상가·부여읍 상점가'],
    [600, 262, 0, '상가 B·2층', '상가·부여읍 상점가'],
    [830, 262, 0, '상가 A', '상가·부여읍 상점가'],
    [600, 340, Math.PI, '상가 B·2층', '상가·전설의 스테이크'],
    [540, 340, Math.PI, '상가 A', '상가·명륜진사갈비'],
  ];
  shopRow.forEach(([sx, sz, ry, mdl, lb]) => put(mdl, ...W(sx, sz), ry, 0.85, lb));
  // 신호 상가골목 뒷골목 집들 — v2: 무작위 산포 12채를 3열 격자로 정돈(골목 리듬)
  const houseGrid = [[460, 110], [508, 110], [556, 110], [604, 110], [652, 110],
                     [460, 170], [508, 170], [556, 170],
                     [460, 232], [508, 232], [556, 232], [604, 232]];
  houseGrid.forEach(([hx, hz], i) => put(i % 2 ? '집 B·굴뚝연기' : '집 A', ...W(hx, hz),
    ((i % 3) - 1) * 0.14, 0.86 + (i % 3) * 0.05));
  // 뒷골목 2줄(바닥 점선) — 집 열 사이 통로
  for (const ly of [141, 201]) {
    const [l0x, l0z] = W(438, ly), [l1x, l1z] = W(684, ly);
    scene.add(line([[l0x, 0.02, l0z], [l1x, 0.02, l1z]], grayLine, [0.6, 0.9]));
  }
  put('오일장 천막', ...W(946, 420), 0.3, 1, '장터·부여 오일장');
  put('오일장 천막', ...W(996, 442), -0.4, 0.9, '장터·부여 오일장');
  put('버스정류장', ...W(730, 430), Math.PI, 0.95);
  put('사람(주민)', ...W(745, 415), 0, 0.8);
  // 전봇대 열 — 간선 동측, 전선 스팬이 이어지도록 간격 = 스팬(5.2)
  for (let i = 0; i < 9; i++) {
    const [ex, ez] = W(725, 120 + i * 41.6);
    put('전봇대', ex, ez, Math.PI / 2, 1);
  }
  // 가로수·주민
  [[460, 380], [672, 90], [980, 330], [860, 120]].forEach(([tx, tz], i) => put(i % 2 ? '나무 A' : '나무 B·침엽', ...W(tx, tz), 0, 0.9));
  [[600, 285], [850, 320], [770, 455]].forEach(([sx2, sz2], i) => put('사람(주민)', ...W(sx2, sz2), i, 0.8));

  // ── 군부대 (서남 — 장암길 서쪽 끝) ──
  put('군부대·차단봉', ...W(165, 950), 0.2, 1.5);
  put('나무 B·침엽', ...W(120, 860), 0);
  put('나무 B·침엽', ...W(210, 1000), 0, 0.9);

  // ── 궁남지 + 사랑나무 (읍 남단, 강 북안) ──
  put('궁남지', ...W(545, 600), 0, 1.15, '관광·궁남지');
  put('사랑나무·평상', ...W(452, 578), 0, 1, '관광·사랑나무');
  // 연꽃축제 — 궁남지 둘레의 연잎·꽃과 천막 1
  put('연못·물결', ...W(500, 566), 0.2, 0.8, '축제·궁남지 연꽃');
  put('오일장 천막', ...W(592, 624), 0.2, 0.8, '축제·연꽃축제 천막');
  [[498, 588], [578, 590], [520, 552], [600, 512], [676, 604]]
    .forEach(([fx, fz], i) => put('꽃', ...W(fx, fz), i * 1.1, 1.15));

  // ── 학교 (강 북안 동측) = 장암초등학교 ──
  put('학교 본관', ...W(870, 580), 0, 1.05, '학교·장암초');
  put('깃발', ...W(838, 620), 0, 0.8);

  // ── 장암 마을 (강 건너 남서) ──
  const jangamHouses = [[300, 940], [362, 952], [430, 945], [492, 952], [545, 945]];   // v2: 전봇대 열과 겹치던 2채 남향 이동
  jangamHouses.forEach(([hx, hz], i) => put(i % 2 ? '집 A' : '집 B·굴뚝연기', ...W(hx, hz), (i % 3) * 0.9, 0.95));
  put('솟대', ...W(230, 900), 0);                 // 마당 솟대는 장암 장식으로 존치
  put('마당바위', ...W(452, 792), 0.7, 0.9);          // v2: village-circuit 새 자리 확보
  put('와요지 가마', ...W(814, 856), 0, 0.95);
  put('사람(주민)', ...W(400, 862), 2, 0.8);
  put('사람(주민)', ...W(640, 862), 4, 0.8);

  // ── 농경지 (남동) — 경지정리 격자: 논 2행×3열 · 밭 1행 · 비닐하우스 열 ──
  for (const gy of [792, 828]) for (const gx of [872, 920, 968])
    put('논·벼바람', ...W(gx, gy), 0, 0.95);
  for (const gx of [880, 928, 976]) put('밭·이랑', ...W(gx, 922), 0, 0.95);
  for (const gx of [1012, 1090]) put('비닐하우스', ...W(gx, 952), Math.PI / 2, 1.0);
  put('수박', ...W(988, 952), 0);

  // ── 좌우 여백 농경(정렬) ──
  // 서측 강변 바깥: 세로 정렬 1열(논 3 → 밭 1 → 비닐하우스 2)
  for (const gy of [300, 346, 392]) put('논·벼바람', ...W(100, gy), Math.PI / 2, 0.9);
  put('밭·이랑', ...W(100, 444), Math.PI / 2, 0.9);
  for (const gy of [504, 540]) put('비닐하우스', ...W(100, gy), 0, 0.95);
  // 동측(군부대 이전으로 빈 땅): 논 2행×4열 · 밭 1행 · 비닐하우스 1행
  for (const gy of [318, 354]) for (const gx of [1205, 1253, 1301, 1349])
    put('논·벼바람', ...W(gx, gy), 0, 0.95);
  for (const gx of [1213, 1261, 1309, 1357]) put('밭·이랑', ...W(gx, 404), 0, 0.95);
  for (const gx of [1210, 1250, 1290, 1330]) put('비닐하우스', ...W(gx, 462), Math.PI / 2, 0.95);
  put('경운기', ...W(1395, 420), 1.6, 0.95);

  // ── 축운산 (동남 산) + 유적 ──
  put('축운산', ...W(1290, 595), 0, 1.9);
  put('비석', ...W(1205, 550), -0.4);
  put('봉분', ...W(1390, 605), 0, 0.85);
  put('나무 B·침엽', ...W(1195, 500), 0, 1.1);
  put('정자(백화정)', ...W(1345, 528), 0, 0.9);

  // ── 밀도 증강: 상가2열·횡단보도·가로수·강변·사람 ──
  [[470, 440, '상가·엽떡'], [530, 440, '상가·신전떡볶이'], [590, 440, '상가·살구스튜디오'], [640, 440, '상가·부여읍 상점가']]
    .forEach(([sx, sz, lb], i) => put(i % 2 ? '상가 A' : '상가 B·2층', ...W(sx, sz), 0, 0.8, lb));
  put('학교 본관', ...W(496, 508), 0, 0.9, '학교·궁남초');
  [[556, 498], [600, 502], [466, 546]].forEach(([hx, hz], i) =>
    put(i % 2 ? '집 B·굴뚝연기' : '집 A', ...W(hx, hz), i * 0.5, 0.85, '공방·123공예마을'));
  // 횡단보도 4 (교차로)
  [[700,300],[700,470],[700,880],[1050,880]].forEach(([cx,cz])=>put('횡단보도 타일', ...W(cx,cz), Math.PI/2, 0.55));
  // 강변 나무·바위·새
  [[476,574],[598,585],[640,628],[420,782],[540,795]].forEach(([tx,tz],i)=>put(i%2?'나무 A':'나무 B·침엽', ...W(tx,tz), 0, 0.85+((i%3)*0.1)));
  put('마당바위', ...W(468, 772), 1.2, 0.6);
  put('새·날갯짓', ...W(500, 660), 0.7);
  put('새·날갯짓', ...W(820, 700), 2.2);
  // 읍내 가로수·주민 증원
  [[520,330],[760,330],[950,250],[640,420],[900,455],[1010,120]].forEach(([tx,tz],i)=>put(i%2?'나무 B·침엽':'나무 A', ...W(tx,tz), 0, 0.8));
  [[500,315],[676,250],[810,285],[930,430],[760,120],[1000,316]].forEach(([sx2,sz2],i)=>put('사람(주민)', ...W(sx2,sz2), i*1.1, 0.78));
  // 장암 증원
  [[318,850],[498,988],[560,850]].forEach(([hx,hz],i)=>put(i%2?'집 B·굴뚝연기':'집 A', ...W(hx,hz), i*0.7, 0.9));
  [[335,800],[420,810],[590,845]].forEach(([fx,fz],i)=>put('꽃', ...W(fx,fz), i));
  [[470,900],[560,865]].forEach(([sx2,sz2],i)=>put('사람(주민)', ...W(sx2,sz2), i*2, 0.78));
  // 전봇대 — 장암길 남측 열(스팬 연결 간격)
  for (let i = 0; i < 6; i++) put('전봇대', ...W(330 + i * 41.6, 908), 0, 0.95);
  // 농경 증원
  put('밭·이랑', ...W(1120, 838), -0.1, 0.95);
  put('수박', ...W(1070, 900), 1);
  // 부소산·축운산 수목
  [[120,185],[176,308],[140,158]].forEach(([tx,tz],i)=>put(i%2?'나무 B·침엽':'나무 A', ...W(tx,tz), 0, 1.0));
  [[1168,548],[1418,560]].forEach(([tx,tz])=>put('나무 B·침엽', ...W(tx,tz), 0, 1.1));

  // ── 남중앙 아파트 단지 ──
  for (const ay of [938, 986]) for (const ax of [606, 652, 752, 798])
    put('작은 아파트', ...W(ax, ay), 0, 0.95);
  put('나무 A', ...W(672, 940), 0, 0.9);
  put('나무 B·침엽', ...W(672, 990), 0, 0.9);
  put('사람(주민)', ...W(722, 962), 1.4, 0.78);

  // ═══ 배치 v2 (2026-09-03) — 밀도 균형 · 구역별 성격 ═══════════════════
  //   빈 80px 셀을 메우되 블록마다 다른 성격을 준다:
  //   B 학교 마을 / C 장터 거리 / D 북동 들판 / E 도로 동측 띠 / F 가마터·묘역 / G 서안 산책

  // ── B 학교 마을 (x720–1040, y480–660) ──
  {  // 학교 부지 테두리(점선) — 학교 본관 + 운동장·축운산·야구장 보드를 한 동네로 묶는다
    const [b0x, b0z] = W(800, 550), [b1x, b1z] = W(1032, 674);
    scene.add(line([[b0x, 0.02, b0z], [b1x, 0.02, b0z], [b1x, 0.02, b1z], [b0x, 0.02, b1z], [b0x, 0.02, b0z]], grayLine, [0.5, 0.8]));
  }
  // 서쪽 주택 띠(간선 동측에 면해) — 집 4 + 가로수 3 + 주민
  [[740, 566, 0.1], [740, 608, -0.1], [776, 586, 1.6], [742, 648, 0.2]]
    .forEach(([hx, hz, ry], i) => put(i % 2 ? '집 B·굴뚝연기' : '집 A', ...W(hx, hz), ry, 0.88 + (i % 2) * 0.06));
  [[768, 628], [800, 656]].forEach(([tx, tz], i) => put(i % 2 ? '나무 B·침엽' : '나무 A', ...W(tx, tz), 0, 0.88));
  put('사람(주민)', ...W(762, 592), 1.2, 0.78);
  // 교정 안쪽 — 담장 따라 나무 2 · 골대 1 · 학생 3 (부지 안이 비어 보이지 않게)
  put('나무 A', ...W(812, 578), 0, 0.9);
  put('나무 B·침엽', ...W(812, 640), 0, 0.9);
  put('골대', ...W(830, 612), Math.PI / 2, 0.95);
  [[852, 636], [820, 660], [876, 654]].forEach(([sx2, sz2], i) => put('사람(주민)', ...W(sx2, sz2), i * 1.9, 0.76));
  // 북동 학교앞 거리(가로2 남측에 면해) — 상가 2 + 정류장 + 주민 2 + 가로수 2
  put('상가 A', ...W(895, 506), Math.PI, 0.85, '공공·부여지역아동센터');
  put('마을회관·확성기', ...W(940, 508), Math.PI, 0.72, '공공·주민자치센터');
  put('버스정류장', ...W(990, 500), Math.PI, 0.9);
  [[912, 530], [966, 528]].forEach(([sx2, sz2], i) => put('사람(주민)', ...W(sx2, sz2), i * 1.7, 0.78));
  [[864, 514], [1014, 530]].forEach(([tx, tz], i) => put(i % 2 ? '나무 A' : '나무 B·침엽', ...W(tx, tz), 0, 0.85));

  // ── C 읍내 남측 (x720–1040, y300–470): 석탑 광장 정돈 + 오일장 시장 거리 ──
  {  // 광장 안쪽 단(내부 점선)
    const [q0x, q0z] = W(744, 226), [q1x, q1z] = W(776, 274);
    scene.add(line([[q0x, 0.02, q0z], [q1x, 0.02, q0z], [q1x, 0.02, q1z], [q0x, 0.02, q1z], [q0x, 0.02, q0z]], grayLine, [0.3, 0.45]));
  }
  [[812, 214], [812, 278]].forEach(([tx, tz], i) => put(i % 2 ? '나무 B·침엽' : '나무 A', ...W(tx, tz), 0, 0.9));
  [[788, 214], [748, 282]].forEach(([sx2, sz2], i) => put('사람(주민)', ...W(sx2, sz2), i * 2.2, 0.78));
  // 부여읍 상권 거리 — 가로1·가로2 사이에 남북 두 줄로 상가를 세우고 가운데를 거리로 비운다
  {  // 거리 바닥선
    const [c0x, c0z] = W(752, 392), [c1x, c1z] = W(1016, 392);
    scene.add(line([[c0x, 0.02, c0z], [c1x, 0.02, c1z]], grayLine, [0.6, 0.9]));
  }
  [[776, '상가 A', '상가·설빙'], [828, '상가 B·2층', '상가·롯데리아'], [880, '상가 A', '상가·맘스터치'],
   [932, '상가 B·2층', '상가·다이소'], [984, '상가 A', '상가·와플대학']]
    .forEach(([sx, mdl, lb], i) => put(mdl, ...W(sx, 356), 0, 0.85 + (i % 2) * 0.04, lb));
  [[790, '상가 B·2층', '상가·부여읍 상점가'], [842, '상가 A', '상가·부여읍 상점가'], [894, '상가 B·2층', '상가·부여읍 상점가']]
    .forEach(([sx, mdl, lb]) => put(mdl, ...W(sx, 428), Math.PI, 0.85, lb));
  put('오일장 천막', ...W(1008, 396), -0.2, 0.9, '장터·부여 오일장');    // 천막 3으로 장터 마당
  {  // 장터 마당 테두리
    const [j0x, j0z] = W(926, 402), [j1x, j1z] = W(1026, 456);
    scene.add(line([[j0x,0.02,j0z],[j1x,0.02,j0z],[j1x,0.02,j1z],[j0x,0.02,j1z],[j0x,0.02,j0z]], grayLine, [0.4, 0.6]));
  }
  put('나무 A', ...W(812, 402), 0, 0.85);
  put('상가 B·2층', ...W(1090, 348), -Math.PI / 2, 0.85, '상가·부여읍 상점가');   // 동측 도로변

  // ── D 북동 = 운동·체육 동네 (참여자 목록: 종합운동장·부여중 체육관·부여여중 수영장·백중 농구장·규암초 운동장·놀이터) ──
  put('종합운동장 트랙', ...W(1160, 156), 0, 1.0, '운동·종합운동장');
  put('체육관', ...W(1264, 148), 0, 0.95, '운동·부여중 체육관');
  put('수영장', ...W(1272, 210), 0, 0.95, '운동·부여여중 수영장');
  put('농구장', ...W(1216, 262), 0.08, 0.95, '운동·백중 농구장');
  put('운동장 판·공', ...W(1086, 118), 0, 0.9, '운동·규암초 운동장');
  put('놀이터', ...W(1090, 200), 0.3, 0.95, '운동·놀이터');
  put('집 A', ...W(1086, 262), 0.15, 0.9);
  put('집 B·굴뚝연기', ...W(1136, 272), -0.25, 0.9);
  {  // 체육 단지 진입로(바닥 점선)
    const [f0x, f0z] = W(1058, 236), [f1x, f1z] = W(1396, 236);
    scene.add(line([[f0x, 0.02, f0z], [f1x, 0.02, f1z]], grayLine, [0.6, 0.9]));
  }
  [[1310, 264]].forEach(([tx, tz], i) => put('나무 B·침엽', ...W(tx, tz), 0, 0.95));
  [[1180, 232], [1108, 236]].forEach(([sx2, sz2], i) => put('사람(주민)', ...W(sx2, sz2), i * 1.4, 0.78));

  // ── E 동측 띠 = 규암면 아파트 단지 + 아파트 놀이터 ──
  [[500, '아파트·코아루 장암'], [548, '아파트·규암 아파트'], [596, '아파트·규암 아파트']]
    .forEach(([ay, lb]) => put('작은 아파트', ...W(1092, ay), 0, 0.95, lb));
  put('놀이터', ...W(1140, 572), -0.4, 0.9, '운동·아파트 놀이터');
  put('나무 B·침엽', ...W(1124, 494), 0, 0.9);
  put('나무 A', ...W(1146, 622), 0, 0.9);
  for (const ey of [532, 630]) put('전봇대', ...W(1074, ey), Math.PI / 2, 0.95);

  // ── F 축운산 남안 = 동쪽 새 동네 (백제문화단지·한국전통문화대학교·아울렛) + 가마터 묘역 ──
  put('누각·기와', ...W(1300, 826), 0, 0.95, '문화·백제문화단지');
  put('강의동', ...W(1382, 776), -0.1, 0.95, '문화·한국전통문화대학교');
  put('강의동', ...W(1382, 828), 0.1, 0.95, '문화·한국전통문화대학교');
  {  // 대학 마당(점선)
    const [u0x, u0z] = W(1346, 758), [u1x, u1z] = W(1424, 852);
    scene.add(line([[u0x,0.02,u0z],[u1x,0.02,u0z],[u1x,0.02,u1z],[u0x,0.02,u1z],[u0x,0.02,u0z]], grayLine, [0.4, 0.6]));
  }
  put('박물관·현수막', ...W(1218, 776), 0, 0.9, '상가·아울렛');
  // 가마터·묘역 — 산 남쪽 기슭에 모음
  put('와요지 가마', ...W(1202, 878), 0.2, 0.95);                  // (1148,956)에서 이설
  put('봉분', ...W(1246, 892), 0, 1.0);                            // (1358,638) 축운산 겹침분 이설
  put('봉분', ...W(1300, 898), 0, 0.85);
  put('비석', ...W(1340, 890), 0.3, 0.95);
  for (const gx of [1256, 1330, 1392]) put('밭·이랑', ...W(gx, 924), 0, 0.9);   // 밭 1행
  [[1240, 846], [1320, 782], [1364, 886]].forEach(([tx, tz], i) => put(i % 2 ? '나무 A' : '나무 B·침엽', ...W(tx, tz), 0, 0.95));

  // ── G 서안 경작지 2열 + 강변 산책 (x40–400, y560–800) ──
  //   기존 x100 1열을 남으로 잇고 x166에 2열째를 세워 경지정리 격자로 읽히게 한다.
  [[102, 592, '논·벼바람'], [102, 664, '밭·이랑'], [102, 736, '논·벼바람']]
    .forEach(([gx, gz, n]) => put(n, ...W(gx, gz), Math.PI / 2, 0.88));
  [[166, 440, '밭·이랑'], [166, 512, '비닐하우스'], [166, 600, '논·벼바람'], [166, 672, '밭·이랑'], [166, 744, '논·벼바람']]
    .forEach(([gx, gz, n]) => put(n, ...W(gx, gz), n === '비닐하우스' ? 0 : Math.PI / 2, 0.86));
  {  // 서안 잔교(작은 나루) — 둑에 걸치는 판 + 말뚝 4
    const [jx, jz] = W(330, 578);
    const deck = inked(new THREE.BoxGeometry(2.4, 0.12, 1.0));
    deck.rotation.y = 0.35; deck.position.set(jx + 0.7, 0.32, jz); scene.add(deck);
    for (const [dx, dz] of [[-0.4, -0.4], [-0.4, 0.4], [1.5, -0.4], [1.5, 0.4]]) {
      const post = cyl(0.06, 0.06, 0.46, 5);
      post.position.set(jx + dx, 0.14, jz + dz); scene.add(post);
    }
  }
  // 물가 산책 — 둑을 따라 갈대·솟대·바위·주민
  put('솟대', ...W(286, 590), 0.4);
  put('마당바위', ...W(268, 632), 1.1, 0.65);
  [[300, 566], [326, 598], [438, 668], [496, 700]].forEach(([gx, gz], i) => put('갈대', ...W(gx, gz), i * 1.1, 0.9 + (i % 2) * 0.2));
  [[240, 580], [322, 690], [352, 676], [288, 758]].forEach(([tx, tz], i) => put(i % 2 ? '나무 A' : '나무 B·침엽', ...W(tx, tz), 0, 0.9 + (i % 3) * 0.07));
  // 구드래 — 나루에 정박한 통통배 · 조각공원 3점 · 사비마루 야외무대
  put('통통배', ...W(370, 596), 0.5, 0.9, '문화·구드래 나루터 통통배').userData.roam = false;
  [[252, 606], [292, 638], [230, 664]].forEach(([sx2, sz2], i) =>
    put('조각·덩어리', ...W(sx2, sz2), i * 1.2, 1.5 + (i % 2) * 0.35, '문화·구드래 조각공원'));
  put('야외무대', ...W(268, 704), 0.25, 0.95, '문화·사비마루');
  [[228, 616], [214, 700], [250, 786], [316, 668]].forEach(([sx2, sz2], i) => put(i % 2 ? '사람(주민)' : '꽃', ...W(sx2, sz2), i * 1.3, 0.8));

  // ── 강 동안 숲 띠 (x320–400) + 북동 어귀 + 간선 서측 상가 ──
  [[366, 196], [368, 352], [372, 438]].forEach(([tx, tz], i) => put(i % 2 ? '나무 A' : '나무 B·침엽', ...W(tx, tz), 0, 0.9 + (i % 2) * 0.1));
  put('새·날갯짓', ...W(340, 176), 0.6);
  put('꽃', ...W(344, 380), 0.3);
  put('새·날갯짓', ...W(258, 286), 2.1);
  put('집 A', ...W(912, 120), 0.2, 0.88);
  put('상가 A', ...W(654, 352), Math.PI / 2, 0.85);
  put('사람(주민)', ...W(672, 380), 0.8, 0.78);

  // ── 백제교 남안 물가(장암 어귀) ──
  put('갈대', ...W(648, 756), 1.4, 1.15);
  put('나무 B·침엽', ...W(592, 774), 0, 0.9);
  put('나무 A', ...W(660, 782), 0, 0.9);
  put('집 B·굴뚝연기', ...W(762, 786), -0.2, 0.9);
  // 회로 신호가 떠난 자리(655,834) 채움
  put('나무 A', ...W(664, 812), 0, 0.9);
  put('꽃', ...W(676, 846), 1.1);
  // 장암 서측 · 간선 동측 남단
  put('집 A', ...W(198, 834), 0.3, 0.9);
  put('나무 B·침엽', ...W(230, 812), 0, 0.9);
  put('사람(주민)', ...W(172, 852), 2.6, 0.78);
  put('집 A', ...W(748, 828), -0.15, 0.9);
  put('나무 A', ...W(782, 814), 0, 0.9);
  put('사람(주민)', ...W(764, 856), 0.4, 0.78);
  // 동교 남안 물가
  put('나무 A', ...W(1108, 786), 0, 0.9);
  put('나무 B·침엽', ...W(1184, 782), 0, 0.9);
  // 가마가 떠난 남동 끝 자리(1148,956) 채움
  put('밭·이랑', ...W(1162, 922), 0, 0.9);
  put('수박', ...W(1120, 930), 0.6);

  // ── 회로 문법 가시화 ①: 군부대 차단봉 = 모터가 여닫는다 ──
  {
    put('모터·회전', ...W(210, 910), 0.9, 1.1);
    const [gx, gz] = W(236, 940);                 // 작품 「입대 정문」 보드 앞
    const [mx2, mz2] = W(210, 910);
    scene.add(line([[mx2, 0.35, mz2], [(mx2 + gx) / 2, 0.15, (mz2 + gz) / 2], [gx, 0.4, gz]], grayLine, [0.25, 0.8]));
  }

  // ── 회로 문법 가시화 ②: 화려한 곳의 장식 LED 스트링 ──
  const LED5 = [0xfe5000, 0xe2402f, 0xf5b52e, 0x3f9b4f, 0x2f6fe4];
  const stringBulbs = [];
  const ledString = (pts3, n, phase = 0) => {
    // pts3: [x,y,z][] 폴리라인 — 누적 길이로 n개 전구 배치
    const cum = [0];
    for (let i = 1; i < pts3.length; i++)
      cum.push(cum[i - 1] + Math.hypot(pts3[i][0] - pts3[i - 1][0], pts3[i][1] - pts3[i - 1][1], pts3[i][2] - pts3[i - 1][2]));
    const total = cum[cum.length - 1];
    scene.add(line(pts3, grayLine));
    for (let k = 0; k < n; k++) {
      const d = (k / (n - 1)) * total;
      let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
      const u = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      const pos = [0, 1, 2].map(ax => pts3[i - 1][ax] + (pts3[i][ax] - pts3[i - 1][ax]) * u);
      const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0),
        new THREE.MeshBasicMaterial({ color: LED5[k % 5] }));
      bulb.position.set(pos[0], pos[1], pos[2]);
      scene.add(bulb);
      stringBulbs.push({ bulb, color: LED5[k % 5], ph: phase + k * 0.5 });
    }
  };
  {
    const [mx3, mz3] = W(640, 180);                               // 박물관 정면 처마
    ledString([[mx3 - 2.6, 2.5, mz3 + 1.5], [mx3, 2.9, mz3 + 1.7], [mx3 + 2.6, 2.5, mz3 + 1.5]], 11);
    const [ox, oz] = W(950, 420);                                 // 오일장 천막 테두리
    ledString([[ox - 1.3, 1.5, oz + 0.9], [ox + 1.3, 1.5, oz + 0.9]], 6, 1);
    const [bx2, bz2] = W(730, 430);                               // 버스정류장 지붕
    ledString([[bx2 - 1.2, 1.9, bz2 - 0.4], [bx2 + 1.2, 1.9, bz2 - 0.4]], 5, 2);
    // 백제교 난간 경관조명(양측)
    ledString([[bridge1.x - 1.6, 1.5, bridge1.z0 + 1], [bridge1.x - 1.6, 1.7, (bridge1.z0 + bridge1.z1) / 2], [bridge1.x - 1.6, 1.5, bridge1.z1 - 1]], 9, 0.7);
    ledString([[bridge1.x + 1.6, 1.5, bridge1.z0 + 1], [bridge1.x + 1.6, 1.7, (bridge1.z0 + bridge1.z1) / 2], [bridge1.x + 1.6, 1.5, bridge1.z1 - 1]], 9, 1.7);
  }
  ticks.push(t => stringBulbs.forEach(({ bulb, color, ph }) => {
    const on = Math.sin(t / 380 + ph * 2.4) > -0.15;
    bulb.material.color.set(on ? color : 0xfcfbf9);
  }));

  // ── 교통: 도로망 실제 순환 ──
  const loop = buildTrack([W(700, 320), W(700, 860), W(1050, 860), W(1050, 320), W(700, 320)]);
  const shuttleMain = buildTrack([W(700, 90), W(700, 990)]);
  const shuttleJangam = buildTrack([W(300, 895), W(1140, 895)]);
  const bridges = [bridge1, bridge2];
  const bridgeLift = (x, z) => {
    let lift = 0;
    for (const b of bridges) {
      if (Math.abs(x - b.x) > 2.2) continue;
      const RAMP = 2.2;
      if (z > b.z0 - RAMP && z < b.z1 + RAMP) {
        const inA = Math.min(1, Math.max(0, (z - (b.z0 - RAMP)) / RAMP));
        const inB = Math.min(1, Math.max(0, ((b.z1 + RAMP) - z) / RAMP));
        lift = Math.max(lift, DECK_TOP * Math.min(inA, inB));
      }
    }
    return lift;
  };
  const vehicle = (name, track, period, mode, phase = 0, lane = 0) => {
    const v = BUILDERS[name]();
    v.userData.roam = false;
    scene.add(v);
    if (v.userData.tick) ticks.push(v.userData.tick);
    ticks.push(t => {
      const u = mode === 'loop'
        ? ((t + phase) % period) / period
        : Math.abs((((t + phase) % (period * 2)) / period) - 1);   // 왕복 삼각파
      const p = trackAt(track, u * track.total);
      const lx = p.x + Math.sin(p.ang) * lane, lz = p.z + Math.cos(p.ang) * lane;
      v.position.set(lx, bridgeLift(lx, lz), lz);
      v.rotation.y = p.ang + (mode !== 'loop' && ((t + phase) % (period * 2)) > period ? Math.PI : 0);
    });
    return v;
  };
  vehicle('차·주행', loop, 42000, 'loop', 0, 0.8);
  vehicle('차·주행', loop, 42000, 'loop', 14000, 0.8);
  vehicle('차·주행', loop, 42000, 'loop', 28000, 0.8);
  vehicle('버스', shuttleMain, 36000, 'shuttle', 0, -0.9);
  vehicle('경운기', shuttleJangam, 52000, 'shuttle', 9000, 0.9);
  const riverWest = buildTrack(mid.slice(0, 6));               // 상류~선착장 앞
  vehicle('통통배', riverWest, 46000, 'shuttle', 0, 0);

  // ── 신호 11: 아이들 작품 미니어처(나무판 디오라마) — 모터는 돌고 LED는 깜빡인다 ──
  //   피그마 정본 「07 신호 정의」 대조(2026-09-02): pond-field=r5 꽃무늬/신호등 판,
  //   chugunsan=r10 초록 언덕 보드, frog-pond·karasuno·cherry 신설.
  //   대표 LED(userData.mainLed)가 있으면 그것이 bulb — 도시 루프가 blink 리듬으로 색 갱신.
  //   없으면 anchor 자리에 전구(pole:false면 기둥 없이 작품 위 구슬로).
  const SIGNALS_3D = [
    { id: 'ground',          px: [960, 658],  color: 0xfe5000, model: '작품·마을의 운동장', ry: 0,     h: 5.2, anchor: [-5.55, -1.95] },
    { id: 'shop-alley',      px: [540, 262],  color: 0xe2402f, model: '작품·상가 골목',     ry: 0,     h: 4.8 },
    { id: 'star-yard',       px: [360, 830],  color: 0xfe5000, model: '작품·별빛 마당',     ry: 0.15,  h: 4.6 },
    { id: 'chugunsan',       px: [935, 617],  color: 0x3f9b4f, model: '작품·축운산',        ry: -0.03, h: 5.0, anchor: [2.15, -1.45] },
    { id: 'baseball',        px: [982, 617],  color: 0xf5b52e, model: '작품·야구장',        ry: 0.03,  h: 4.6, anchor: [-1.9, -1.7] },
    { id: 'pond-field',      px: [636, 566],  color: 0xe2402f, model: '작품·연못 들판',     ry: -0.25, h: 4.8, anchor: [0.22, 0.42], anchorY: 0.86, pole: false },
    { id: 'frog-pond',       px: [560, 540],  color: 0x2f6fe4, model: '작품·개구리 연못',   ry: 0.1,   h: 6.8, anchor: [3.2, -1.55] },
    { id: 'village-circuit', px: [520, 830],  color: 0xfe5000, model: '작품·마을 회로',     ry: -0.1,  h: 5.0 },
    { id: 'ipdae-gate',      px: [236, 964],  color: 0x3f9b4f, model: '작품·입대 정문',     ry: 0.2,   h: 5.6 },
    { id: 'karasuno',        px: [820, 530],  color: 0xf5b52e, model: '작품·카라스노 고교', ry: -0.15, h: 5.0 },
    { id: 'cherry',          px: [1090, 430], color: 0xe2402f, model: '작품·체리 가게',     ry: 0.28,  h: 5.0, anchor: [-1.6, 1.35] },
  ];
  const arts = {};
  const signals = SIGNALS_3D.map(({ id, px, color, model, ry, h, anchor, anchorY, pole }) => {
    const [x, z] = W(...px);
    const g = new THREE.Group();
    const art = BUILDERS[model]();
    art.rotation.y = ry || 0;
    arts[id] = art;
    g.add(art);
    if (art.userData.tick) ticks.push(art.userData.tick);
    let bulb = art.userData.mainLed;
    if (!bulb) {
      const [ax, az] = anchor || [0, 0];
      const ay = anchorY != null ? anchorY : 2.4;
      if (pole !== false) art.add(at(cyl(0.06, 0.06, ay - 0.35, 6), ax, (ay - 0.35) / 2 + 0.3, az));
      bulb = ico(pole === false ? 0.19 : 0.32, { fill: color });
      bulb.position.set(ax, ay, az);
      art.add(bulb);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    placed.push({ name: '신호·' + id, obj: g });
    return { id, obj: g, bulb, color, pos: new THREE.Vector3(x, h, z) };
  });

  // ── 장소 앵커: 박물관·군부대 — 3D 표지판 없이 건물 위 높이 뜬 검정 원(DOM) ──
  const PLACES_3D = [
    { id: 'museum', px: [640, 180], h: 7 },
    { id: 'military', px: [168, 946], h: 6.4 },
  ];
  const places = PLACES_3D.map(({ id, px, h }) => {
    const [x, z] = W(...px);
    return { id, pos: new THREE.Vector3(x, h, z) };
  });

  // 검증 훅 — ?s3ddebug 쿼리일 때만 노출(상시 노출은 언마운트 후 씬 누수)
  if (typeof window !== 'undefined' && /[?&]s3ddebug/.test(window.location.search))
    window.__city3d = { signals, arts, placed, roads: roads.map(([a, b]) => [...W(...a), ...W(...b)]) };

  return { ticks, signals, places, riverTrack };
}
