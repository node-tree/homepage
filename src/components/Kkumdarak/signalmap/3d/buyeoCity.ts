// @ts-nocheck
// ═══════════════════════════════════════════════════════════════════════
// buyeoCity.ts — 부흥여지도 도시 조립 · 포스터 배치판 (2026-10-16)
//   작가 「위치도 포스터에 나와있는대로 배치하자」 → 부흥여지도 포스터(시안 C)의 강·길·번호 원 39곳 자리.
//   위치는 buyeoGeo.ts(생성기 buheung-web-20261016/map/build_layout_poster.py, 북 = 포스터 위 = −z)에서 읽는다.
//   그리는 문법(먹선 모형·다리·차량·LED·신호 보드)은 그대로. 실제 지리판(10-15)은 git 506ae66.
// ═══════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { inkLine, grayLine, cyl, ico, at, buildTrack, trackAt, inked, mergeStatics } from './ink3';
import { BUILDERS } from './models3';
import { PLACES39 } from '../places39';
import { GEO } from './buyeoGeo';

const line = (pts3, mat = inkLine, dash) => {
  const geo = new THREE.BufferGeometry().setFromPoints(pts3.map(p => new THREE.Vector3(...p)));
  if (dash) {
    const l = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: mat.color, dashSize: dash[0], gapSize: dash[1] }));
    l.computeLineDistances(); return l;
  }
  return new THREE.Line(geo, mat);
};
// 폴리라인을 옆으로 d만큼 민 선(각 꼭짓점 = 앞뒤 법선 평균)
const offsetLine = (pts, d) => pts.map((p, i) => {
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
  return [p[0] - dz / L * d, p[1] + dx / L * d];
});

// 39곳 모형: 이름표 → [모형, 크기, 방향, 여러 채면 놓을 간격들]
const PLACE_MODEL = {
  '관광·부소산성': ['부소산성', 1.7, 0.3], '관광·낙화암': ['낙화암·백화정', 1.1, 2.4], '관광·사랑나무': ['사랑나무·평상', 1, 0],
  '관광·궁남지': ['궁남지', 1.15, 0], '관광·국립부여박물관': ['박물관·현수막', 1.1, 0], '관광·정림사지': ['정림사지 오층석탑', 1.35, 0],
  '문화·구드래 조각공원': ['조각·덩어리', 1.6, 0, [[0, 0], [3.2, 1.6], [-2.4, 2.6]]], '문화·사비마루': ['야외무대', 0.95, 0.25],
  '문화·구드래 나루터 통통배': ['통통배', 0.9, 0.5], '문화·백제문화단지': ['누각·기와', 1.1, 0],
  '문화·한국전통문화대학교': ['강의동', 0.95, 0, [[0, -2.6], [0, 2.6]]], '장터·부여 오일장': ['오일장 천막', 0.95, 0.3, [[0, 0], [3.4, 1.2], [-3.2, 1.6]]],
  '상가·아울렛': ['박물관·현수막', 0.95, 0], '공방·123공예마을': ['집 A', 0.85, 0.2, [[0, 0], [3.4, 0.8], [1.2, 3.4]]],
  '운동·규암초 운동장': ['운동장 판·공', 0.9, 0], '운동·놀이터': ['놀이터', 0.95, 0.3], '운동·아파트 놀이터': ['놀이터', 0.9, -0.4],
  '운동·종합운동장': ['종합운동장 트랙', 1.0, 0], '운동·백중 농구장': ['농구장', 0.95, 0.08], '운동·부여중 체육관': ['체육관', 0.95, 0],
  '운동·부여여중 수영장': ['수영장', 0.95, 0], '학교·궁남초': ['학교 본관', 0.9, 0], '학교·장암초': ['학교 본관', 1.05, 0],
  '공공·부여지역아동센터': ['상가 A', 0.85, Math.PI], '공공·주민자치센터': ['마을회관·확성기', 0.8, Math.PI],
  '아파트·코아루 장암': ['작은 아파트', 0.95, 0, [[0, 0], [3.6, 0]]], '아파트·규암 아파트': ['작은 아파트', 0.95, 0, [[0, -2.2], [0, 2.4]]],
  '축제·궁남지 연꽃': ['연못·물결', 0.8, 0.2], '축제·연꽃축제 천막': ['오일장 천막', 0.8, 0.2],
};
const SHOP_ALT = ['상가 A', '상가 B·2층'];

export function buildCity(scene) {
  const ticks = [];
  const placed = [];                       // 배치 전수 감사용 기록(이름 + 오브젝트)
  //  label = 참여자(아이들)가 적어 낸 「부여 장소」 이름. 장소 앵커(동그라미)는 이 이름표 모형 위에 뜬다.
  const put = (name, x, z, ry = 0, scale = 1, label) => {
    const m = BUILDERS[name]();
    m.position.set(x, 0, z); m.rotation.y = ry;
    if (scale !== 1) m.scale.setScalar(scale);
    scene.add(m);
    placed.push({ name: label || name, obj: m });
    if (m.userData.tick) ticks.push(m.userData.tick);
    return m;
  };

  // ── 백마강: 두 둑 + 흐름 눈금(실제 물길) — 가운데 점선은 길과 헷갈려 그리지 않고 배·눈금 경로로만 쓴다 ──
  for (const bank of GEO.river.banks) scene.add(line(bank.map(([x, z]) => [x, 0.03, z])));
  // 물: 포스터의 하늘색 한 덩어리 — 두 둑 사이를 채운다(ShapeGeometry의 y → 월드 z)
  {
    const [wb, eb] = GEO.river.banks;
    const shape = new THREE.Shape([...wb, ...[...eb].reverse()].map(([x, z]) => new THREE.Vector2(x, z)));
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI / 2);
    const water = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x93cbe9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }));
    water.position.y = 0.01;
    scene.add(water);
  }
  const mid = GEO.river.mid;
  const riverTrack = buildTrack(mid);
  const flows = [];
  for (let i = 0; i < 9; i++) {
    const fl = line([[-0.7, 0.06, 0], [0.7, 0.06, 0]], grayLine);
    scene.add(fl); flows.push({ fl, off: i * riverTrack.total / 9 });
  }
  ticks.push(t => flows.forEach(({ fl, off }) => {
    const p = trackAt(riverTrack, t / 260 + off);
    fl.position.set(p.x, 0, p.z); fl.rotation.y = p.ang;
  }));
  // 잔물결 V — 중심선을 따라 고르게
  for (let i = 1; i < 12; i++) {
    const p = trackAt(riverTrack, riverTrack.total * i / 12);
    scene.add(line([[p.x - 0.5, 0.05, p.z + 0.2], [p.x, 0.05, p.z], [p.x + 0.5, 0.05, p.z + 0.2]], grayLine));
  }

  // ── 큰길: 두 줄 + 가운데 점선(강 위 구간은 다리가 대신) ──
  for (const { pts } of GEO.roads) {
    scene.add(line(offsetLine(pts, 1.4).map(([x, z]) => [x, 0.02, z])));
    scene.add(line(offsetLine(pts, -1.4).map(([x, z]) => [x, 0.02, z])));
    scene.add(line(pts.map(([x, z]) => [x, 0.02, z]), grayLine, [0.9, 1.1]));
  }

  // ── 다리(백제교 · 부여대교) — 실제 방향으로 강폭에 걸치는 파라메트릭 교량 ──
  const DECK_TOP = 0.92;
  const buildBridge = ([ax, az], [bx, bz]) => {
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
    const g = new THREE.Group();
    g.add(at(inked(new THREE.BoxGeometry(3.2, 0.24, L)), 0, 0.8, 0));
    g.add(at(inked(new THREE.BoxGeometry(3.5, 0.1, L + 0.3)), 0, DECK_TOP, 0));
    for (const end of [-1, 1]) {
      const ramp = inked(new THREE.BoxGeometry(3.2, 0.1, 2.6));
      ramp.position.set(0, 0.5, end * (L / 2 + 1.1)); ramp.rotation.x = end * 0.3; g.add(ramp);
    }
    const nPier = Math.max(2, Math.round(L / 5));
    for (let i = 1; i <= nPier; i++) {
      const pz = -L / 2 + (L / (nPier + 1)) * i;
      g.add(at(inked(new THREE.BoxGeometry(2.6, 0.85, 0.6)), 0, 0.4, pz));
      g.add(at(cyl(0.42, 0.5, 0.7, 8), -1.55, 0.32, pz));
      g.add(at(cyl(0.42, 0.5, 0.7, 8), 1.55, 0.32, pz));
    }
    for (let i = 0; i <= nPier; i++) {
      const a = -L / 2 + (L / (nPier + 1)) * i, b = -L / 2 + (L / (nPier + 1)) * (i + 1);
      for (const sx of [-1.62, 1.62]) {
        const pts = [];
        for (let k = 0; k <= 10; k++) { const u = k / 10; pts.push(new THREE.Vector3(sx, 0.72 - Math.sin(u * Math.PI) * 0.45, a + (b - a) * u)); }
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), inkLine));
      }
    }
    for (const sx of [-1.5, 1.5]) {
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(sx, 1.42, -L / 2), new THREE.Vector3(sx, 1.42, L / 2)]), inkLine));
      const nPost = Math.round(L / 1.1);
      for (let i = 0; i <= nPost; i++)
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(sx, DECK_TOP, -L / 2 + (L / nPost) * i), new THREE.Vector3(sx, 1.42, -L / 2 + (L / nPost) * i)]), inkLine));
    }
    for (const pz of [-L / 2 + 0.8, L / 2 - 0.8]) for (const sx of [-1.7, 1.7]) {
      g.add(at(cyl(0.035, 0.035, 1.1, 5), sx, 1.55, pz));
      g.add(at(cyl(0.13, 0.05, 0.15, 6), sx, 2.15, pz));
    }
    g.position.set((ax + bx) / 2, 0, (az + bz) / 2);
    g.rotation.y = Math.atan2(dx, dz);              // 국소 +z → 다리 방향
    scene.add(g);
    return { cx: (ax + bx) / 2, cz: (az + bz) / 2, ux: dx / L, uz: dz / L, half: L / 2 };
  };
  const bridges = GEO.bridges.map(b => ({ name: b.name, ...buildBridge(b.a, b.b) }));

  // ── 39곳: 실제 좌표에 그 장소의 모형 ──
  const shopIdx = { i: 0 };
  for (const [label, [x, z]] of Object.entries(GEO.places)) {
    const def = PLACE_MODEL[label];
    if (def) {
      const [mdl, s, ry, offs] = def;
      if (label === '문화·구드래 나루터 통통배') { put(mdl, x, z, ry, s, label).userData.roam = false; continue; }
      for (const [ox, oz] of (offs || [[0, 0]])) put(mdl, x + ox, z + oz, ry, s, label);
    } else if (label.startsWith('상가·')) {
      put(SHOP_ALT[shopIdx.i++ % 2], x, z, shopIdx.i % 3 === 0 ? Math.PI : 0, 0.82, label);
    }
  }
  put('깃발', GEO.places['학교·장암초'][0] - 3, GEO.places['학교·장암초'][1] + 2.4, 0, 0.8);
  put('축운산', GEO.landmarks['축운산'][0], GEO.landmarks['축운산'][1], 0, 1.6);        // 포스터의 축운산 자리

  // ── 채움(포스터 그림의 빈 땅 구역만 · 집 · 비닐하우스 · 논밭 · 나무 · 갈대 · 꽃) ──
  for (const [mdl, x, z, ry, s] of GEO.fill) put(mdl, x, z, ry, s);
  // 새 · 솟대 — 강과 부소산 위
  [[0.18, 0.7], [0.42, 2.1], [0.66, 4.0]].forEach(([u, ry]) => { const p = trackAt(riverTrack, riverTrack.total * u); put('새·날갯짓', p.x + 4, p.z, ry); });
  put('솟대', GEO.signals['star-yard'][0] - 6, GEO.signals['star-yard'][1] - 4, 0);

  // 전봇대 — 강 남쪽 가로길(전선 스팬 5.2 간격)
  for (const nm of ['H3']) {
    const tr = GEO.tracks[nm]; if (!tr) continue;
    const t = buildTrack(offsetLine(tr, 2.2));
    for (let d = 2; d < t.total; d += 5.2) { const p = trackAt(t, d); put('전봇대', p.x, p.z, -p.ang + Math.PI / 2, 0.95); }
  }

  // ── 군부대 + 회로 문법 ①: 차단봉을 모터가 여닫는다 ──
  const [mx0, mz0] = GEO.military;
  const guardPost = put('군부대·차단봉', mx0, mz0, 0.2, 1.5);
  {
    const [gx, gz] = GEO.signals['ipdae-gate'];
    const mx2 = (mx0 + gx) / 2, mz2 = (mz0 + gz) / 2 - 2;
    put('모터·회전', mx2, mz2, 0.9, 1.1);
    scene.add(line([[mx2, 0.35, mz2], [(mx2 + gx) / 2, 0.15, (mz2 + gz) / 2], [gx, 0.4, gz]], grayLine, [0.25, 0.8]));
    guardPost.updateMatrixWorld(true);
    const gp = guardPost.localToWorld(new THREE.Vector3(0.9, 0.95, 1.4));
    scene.add(line([[mx2, 0.4, mz2], [(mx2 + gp.x) / 2, 0.12, (mz2 + gp.z) / 2], [gp.x, gp.y - 0.1, gp.z]], grayLine, [0.25, 0.8]));
  }

  // ── 회로 문법 ②: 화려한 곳의 장식 LED 스트링(박물관 처마 · 오일장 · 백제교 난간) ──
  const LED5 = [0xfe5000, 0xe2402f, 0xf5b52e, 0x3f9b4f, 0x2f6fe4];
  const stringBulbs = [];
  const ledString = (pts3, n, phase = 0) => {
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
      const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: LED5[k % 5] }));
      bulb.position.set(pos[0], pos[1], pos[2]);
      scene.add(bulb);
      stringBulbs.push({ bulb, color: LED5[k % 5], ph: phase + k * 0.5 });
    }
  };
  {
    const [mx3, mz3] = GEO.places['관광·국립부여박물관'];
    ledString([[mx3 - 2.6, 2.5, mz3 + 1.5], [mx3, 2.9, mz3 + 1.7], [mx3 + 2.6, 2.5, mz3 + 1.5]], 11);
    const [ox, oz] = GEO.places['장터·부여 오일장'];
    ledString([[ox - 1.3, 1.5, oz + 0.9], [ox + 1.3, 1.5, oz + 0.9]], 6, 1);
    const b1 = bridges.find(b => b.name === '백제교') || bridges[0];
    if (b1) for (const [side, ph] of [[-1.6, 0.7], [1.6, 1.7]]) {
      const nx = -b1.uz * side, nz = b1.ux * side;
      const A = [b1.cx - b1.ux * (b1.half - 1) + nx, 1.5, b1.cz - b1.uz * (b1.half - 1) + nz];
      const M = [b1.cx + nx, 1.7, b1.cz + nz];
      const Bp = [b1.cx + b1.ux * (b1.half - 1) + nx, 1.5, b1.cz + b1.uz * (b1.half - 1) + nz];
      ledString([A, M, Bp], 9, ph);
    }
  }
  ticks.push(t => stringBulbs.forEach(({ bulb, color, ph }) => {
    const on = Math.sin(t / 380 + ph * 2.4) > -0.15;
    bulb.material.color.set(on ? color : 0xfcfbf9);
  }));

  // ── 교통: 포스터의 길을 왕복(다리 위에서는 상판 높이로) ──
  const RAMP = 2.2;
  const bridgeLift = (x, z) => {
    let lift = 0;
    for (const b of bridges) {
      const rx = x - b.cx, rz = z - b.cz;
      const along = rx * b.ux + rz * b.uz, across = Math.abs(-rx * b.uz + rz * b.ux);
      if (across > 2.2 || Math.abs(along) > b.half + RAMP) continue;
      lift = Math.max(lift, DECK_TOP * Math.min(1, (b.half + RAMP - Math.abs(along)) / RAMP));
    }
    return lift;
  };
  const vehicle = (name, track, period, mode, phase = 0, lane = 0) => {
    const v = BUILDERS[name]();
    v.userData.roam = false;
    scene.add(v);
    if (v.userData.tick) ticks.push(v.userData.tick);
    ticks.push(t => {
      const u = mode === 'loop' ? ((t + phase) % period) / period : Math.abs((((t + phase) % (period * 2)) / period) - 1);
      const p = trackAt(track, u * track.total);
      const lx = p.x + Math.sin(p.ang) * lane, lz = p.z + Math.cos(p.ang) * lane;
      v.position.set(lx, bridgeLift(lx, lz), lz);
      v.rotation.y = p.ang + (mode !== 'loop' && ((t + phase) % (period * 2)) > period ? Math.PI : 0);
    });
    return v;
  };
  const T = (nm) => buildTrack(GEO.tracks[nm]);
  vehicle('차·주행', T('V1'), 40000, 'shuttle', 0, 0.8);
  vehicle('버스', T('H1'), 34000, 'shuttle', 6000, -0.9);
  vehicle('차·주행', T('V2'), 42000, 'shuttle', 14000, -0.8);
  vehicle('경운기', T('H3'), 64000, 'shuttle', 9000, 0.9);
  vehicle('통통배', buildTrack(mid.slice(0, Math.max(4, Math.round(mid.length * 0.45)))), 60000, 'shuttle', 0, 0);

  // ── 신호 11: 아이들 작품 미니어처(나무판 디오라마) — 모터는 돌고 LED는 깜빡인다 ──
  //   자리 = 옛 2D 지도 자리에서 출발해 생성기가 강·길·장소·산에서 밀어낸 빈 땅.
  const SIGNALS_3D = [
    { id: 'ground',          color: 0xfe5000, model: '작품·마을의 운동장', ry: 0,     h: 5.2, anchor: [-5.55, -1.95] },
    { id: 'shop-alley',      color: 0xe2402f, model: '작품·상가 골목',     ry: 0,     h: 4.8 },
    { id: 'star-yard',       color: 0xfe5000, model: '작품·별빛 마당',     ry: 0.15,  h: 4.6 },
    { id: 'chugunsan',       color: 0x3f9b4f, model: '작품·축운산',        ry: -0.03, h: 5.0, anchor: [2.15, -1.45] },
    { id: 'baseball',        color: 0xf5b52e, model: '작품·야구장',        ry: 0.03,  h: 4.6, anchor: [-1.9, -1.7] },
    { id: 'pond-field',      color: 0xe2402f, model: '작품·연못 들판',     ry: -0.25, h: 4.8, anchor: [0.22, 0.42], anchorY: 0.86, pole: false },
    { id: 'frog-pond',       color: 0x2f6fe4, model: '작품·개구리 연못',   ry: 0.1,   h: 6.8, anchor: [3.2, -1.55] },
    { id: 'village-circuit', color: 0xfe5000, model: '작품·마을 회로',     ry: -0.1,  h: 5.0 },
    { id: 'ipdae-gate',      color: 0x3f9b4f, model: '작품·입대 정문',     ry: 0.2,   h: 5.6 },
    { id: 'karasuno',        color: 0xf5b52e, model: '작품·카라스노 고교', ry: -0.15, h: 5.0 },
    { id: 'cherry',          color: 0xe2402f, model: '작품·체리 가게',     ry: 0.28,  h: 5.0, anchor: [-1.6, 1.35] },
  ];
  const arts = {};
  const signals = SIGNALS_3D.map(({ id, color, model, ry, h, anchor, anchorY, pole }) => {
    const [x, z] = GEO.signals[id];
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

  // ── 장소 앵커: 부흥여지도 39곳 + 군부대 — 3D 표지판 없이 건물 위에 뜬 검정 원(DOM) ──
  //   39곳은 put(…, label) 이름표가 같은 모형들의 묶음 상자 위(여러 채면 가운데), 군부대는 그 모형 위.
  scene.updateMatrixWorld(true);
  const byLabel = {};
  for (const { name, obj } of placed) (byLabel[name] = byLabel[name] || []).push(obj);
  const places = PLACES39.map(({ id, label }) => {
    const objs = byLabel[label];
    if (objs && objs.length) {
      const box = new THREE.Box3();
      objs.forEach(o => box.expandByObject(o));
      return { id, pos: new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + 1.1, (box.min.z + box.max.z) / 2) };
    }
    const [x, z] = GEO.places[label] || [0, 0];
    return { id, pos: new THREE.Vector3(x, 4, z) };
  });
  places.push({ id: 'military', pos: new THREE.Vector3(mx0, 6.4, mz0) });

  // ── 프레이밍용 콘텐츠 경계 ── (병합 전에 재야 한다 — 병합은 원본을 visible=false로 내린다)
  scene.updateMatrixWorld(true);
  const bb = new THREE.Box3(), fit = [];
  for (const { obj } of placed) {
    bb.setFromObject(obj);
    if (bb.isEmpty() || !isFinite(bb.min.x)) continue;
    fit.push([bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z]);
  }
  for (const s of signals) fit.push([s.pos.x, s.pos.y, s.pos.z, s.pos.x, s.pos.y, s.pos.z]);
  for (const pl of places) fit.push([pl.pos.x, pl.pos.y, pl.pos.z, pl.pos.x, pl.pos.y, pl.pos.z]);

  // ── 드로우콜 절감: 정적 지오메트리 병합(?s3dnomerge 로 끄고 A/B 비교) ──
  const noMerge = typeof window !== 'undefined' && /[?&]s3dnomerge/.test(window.location.search);
  const mergeInfo = noMerge ? null : mergeStatics(scene, ticks, signals.map(s => s.bulb));

  if (typeof window !== 'undefined' && /[?&]s3ddebug/.test(window.location.search))
    window.__city3d = { signals, arts, placed, mergeInfo, fit, roads: GEO.roads, bridges };

  return { ticks, signals, places, riverTrack, fit };
}
