// @ts-nocheck
// ═══════════════════════════════════════════════════════════════════════
// models3.ts — 작은 부여 모델 라이브러리 51종 (도감 v5에서 이식)
//   각 빌더는 THREE.Group 반환, 고유 모션은 group.userData.tick(t).
//   이동체(차·버스·경운기·통통배)는 userData.roam=false로 배회를 끄고
//   도시에서 경로 추종을 입힌다. 정본 룩 검수는 models-catalog.html.
// ═══════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { inked, box, cyl, ico, at, prismGeo, osc, inkLine, LED_COLORS, INK, PAPER } from './ink3';

const B = {};
B['집 A'] = () => { const g = new THREE.Group();
  g.add(at(box(2.6, 1.8, 2.2), 0, 0.9, 0));
  g.add(at(cyl(0, 1.9, 1.5, 4), 0, 2.55, 0, Math.PI / 4));
  return g; };
B['집 B·굴뚝연기'] = () => { const g = new THREE.Group();
  g.add(at(box(2.8, 1.7, 2.2), 0, 0.85, 0));
  g.add(at(inked(prismGeo(3.1, 2.5, 1.3)), 0, 1.7, 0));
  g.add(at(box(0.4, 1.2, 0.4), 0.9, 2.7, 0));
  const puffs = [0, 1, 2].map(i => { const p = ico(0.18 + i * 0.05); g.add(p); return p; });
  g.userData.tick = t => puffs.forEach((p, i) => {
    const ph = ((t / 4000) + i / 3) % 1;
    p.position.set(0.9 + Math.sin(ph * 6 + i) * 0.15, 3.4 + ph * 1.6, 0);
    const s = 0.6 + ph; p.scale.set(s, s * 0.8, s);
    p.visible = ph < 0.85;
  });
  return g; };
B['상가 A'] = () => { const g = new THREE.Group();
  g.add(at(box(3, 2.6, 2.6), 0, 1.3, 0));
  const sign = at(box(2.6, 0.55, 0.12), 0, 2.2, 1.36); g.add(sign);
  const awn = at(box(2.8, 0.08, 0.95), 0, 1.85, 1.55); awn.rotation.x = 0.42; g.add(awn);
  g.userData.tick = t => { awn.rotation.x = 0.42 + osc(t, 2600, 0.05); };
  return g; };
B['상가 B·2층'] = () => { const g = new THREE.Group();
  g.add(at(box(2.6, 4, 2.6), 0, 2, 0));
  g.add(at(box(2.2, 0.5, 0.12), 0, 3.4, 1.36));
  g.add(at(box(3, 0.15, 3), 0, 4.07, 0));
  return g; };
B['운동장 판·공'] = () => { const g = new THREE.Group();
  g.add(at(box(7, 0.3, 4.6), 0, 0.15, 0));
  g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 0.9, 0.32, Math.sin(a) * 0.9); })), inkLine));
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
    [new THREE.Vector3(0, 0.32, -2.3), new THREE.Vector3(0, 0.32, 2.3)]), inkLine));
  const ball = ico(0.3); g.add(ball);
  g.userData.tick = t => {
    ball.position.set(Math.cos(t / 2400) * 2.2, 0.6, Math.sin(t / 1700) * 1.5);
    ball.rotation.z = -t / 400; ball.rotation.x = t / 530;
  };
  return g; };
B['골대'] = () => { const g = new THREE.Group();
  g.add(at(box(0.12, 1.1, 0.12), -0.9, 0.55, 0));
  g.add(at(box(0.12, 1.1, 0.12), 0.9, 0.55, 0));
  g.add(at(box(1.95, 0.12, 0.12), 0, 1.1, 0));
  return g; };
B['깃발'] = () => { const g = new THREE.Group();
  g.add(at(cyl(0.05, 0.05, 2.4, 6), 0, 1.2, 0));
  const pivot = new THREE.Group(); pivot.position.set(0, 2.1, 0);
  pivot.add(at(box(0.9, 0.5, 0.05), 0.48, 0, 0));
  g.add(pivot);
  g.userData.tick = t => { pivot.rotation.y = osc(t, 2200, 0.5); pivot.rotation.z = osc(t, 1400, 0.08); };
  return g; };
B['별빛 판'] = () => { const g = new THREE.Group();
  g.add(at(box(4.4, 0.3, 3.2, { fill: 'ink' }), 0, 0.15, 0));
  const stars = [];
  for (const [sx, sz, h] of [[-1.4, -0.8, 0.9], [0.3, 0.5, 1.3], [1.5, -0.6, 0.7], [-0.4, 1, 0.6]]) {
    g.add(at(cyl(0.03, 0.03, h, 5), sx, 0.3 + h / 2, sz));
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    star.position.set(sx, 0.3 + h + 0.1, sz); g.add(star); stars.push(star);
  }
  g.userData.tick = t => stars.forEach((s, i) => {
    const on = Math.sin(t / (900 + i * 400) + i * 2) * 0.5 + 0.5;
    s.material.color.setScalar(0.45 + on * 0.55);
    s.rotation.y = t / 3000 + i;
  });
  return g; };
B['축운산'] = () => { const g = new THREE.Group();
  g.add(at(cyl(0, 3.4, 3.6, 6), 0, 1.8, 0));
  g.add(at(cyl(0, 2, 2.2, 5), 2.4, 1.1, 1));
  return g; };
B['비석'] = () => { const g = new THREE.Group();
  g.add(at(box(0.9, 0.35, 0.7), 0, 0.17, 0));
  g.add(at(box(0.55, 1.5, 0.22), 0, 1.1, 0));
  return g; };
B['봉분'] = () => { const g = new THREE.Group();
  g.add(at(cyl(0.6, 1.3, 0.9, 8), 0, 0.45, 0));
  return g; };
B['야구장 판·타구'] = () => { const g = new THREE.Group();
  g.add(at(box(4.6, 0.3, 4.6), 0, 0.15, 0, Math.PI / 4));
  const bases = [[0, -1.5], [1.5, 0], [0, 1.5], [-1.5, 0]];
  for (const [bx, bz] of bases) g.add(at(box(0.4, 0.36, 0.4), bx, 0.16, bz, Math.PI / 4));
  const ball = ico(0.22); g.add(ball);
  g.userData.tick = t => {
    const seg = Math.floor(t / 1300) % 4, u = (t % 1300) / 1300;
    const [ax, az] = bases[seg], [bx, bz] = bases[(seg + 1) % 4];
    ball.position.set(ax + (bx - ax) * u, 0.4 + Math.sin(u * Math.PI) * 1.3, az + (bz - az) * u);
  };
  return g; };
B['사람(주민)'] = () => { const g = new THREE.Group();
  g.add(at(cyl(0.24, 0.36, 0.95, 8), 0, 0.48, 0));
  g.add(at(ico(0.3), 0, 1.22, 0));
  const armL = at(box(0.5, 0.1, 0.1), -0.4, 0.78, 0);
  const armR = at(box(0.5, 0.1, 0.1), 0.4, 0.72, 0);
  g.add(armL, armR);
  g.userData.tick = t => {
    g.position.y = Math.abs(osc(t, 700, 0.08));
    armL.rotation.z = 0.55 + osc(t, 700, 0.25);
    armR.rotation.z = -0.35 + osc(t, 700, 0.25, 0.5);
    g.rotation.y = osc(t, 5200, 0.4);
  };
  return g; };
B['연못·물결'] = () => { const g = new THREE.Group();
  g.add(at(cyl(1.7, 1.7, 0.18, 12), 0, 0.09, 0));
  const rips = [0, 1].map(() => {
    const r = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); })),
      new THREE.LineBasicMaterial({ color: INK, transparent: true }));
    r.position.y = 0.2; g.add(r); return r;
  });
  g.userData.tick = t => rips.forEach((r, i) => {
    const ph = ((t / 3000) + i * 0.5) % 1;
    const s = 0.4 + ph * 1.2; r.scale.set(s, 1, s);
    r.material.opacity = (1 - ph) * 0.7;
  });
  return g; };
B['꽃'] = () => { const g = new THREE.Group();
  const sway = new THREE.Group();
  sway.add(at(cyl(0.03, 0.03, 0.7, 5), 0, 0.35, 0));
  sway.add(at(ico(0.2), 0, 0.8, 0));
  g.add(sway);
  g.userData.tick = t => { sway.rotation.z = osc(t, 2100, 0.16); };
  return g; };
B['나무 A'] = () => { const g = new THREE.Group();
  const sway = new THREE.Group();
  sway.add(at(cyl(0.12, 0.16, 1, 7), 0, 0.5, 0));
  sway.add(at(ico(1), 0, 1.9, 0));
  g.add(sway);
  g.userData.tick = t => { sway.rotation.z = osc(t, 3600, 0.07); };
  return g; };
B['나무 B·침엽'] = () => { const g = new THREE.Group();
  const sway = new THREE.Group();
  sway.add(at(cyl(0.1, 0.14, 0.8, 7), 0, 0.4, 0));
  sway.add(at(cyl(0, 0.9, 2.2, 7), 0, 1.9, 0));
  g.add(sway);
  g.userData.tick = t => { sway.rotation.z = osc(t, 4200, 0.06, 0.3); };
  return g; };
B['모터·회전'] = () => { const g = new THREE.Group();
  g.add(at(box(1.6, 0.3, 1.2), 0, 0.15, 0));
  const body = at(cyl(0.55, 0.55, 1.1, 10), 0, 0.85, 0); body.rotation.z = Math.PI / 2; g.add(body);
  const shaft = new THREE.Group(); shaft.position.set(0.9, 0.85, 0);
  const rod = at(cyl(0.07, 0.07, 0.7, 6), 0, 0, 0); rod.rotation.z = Math.PI / 2; shaft.add(rod);
  shaft.add(at(box(0.5, 0.1, 0.1), 0.35, 0, 0));
  g.add(shaft);
  g.userData.tick = t => { shaft.rotation.x = t / 320; };
  return g; };
B['전지'] = () => { const g = new THREE.Group();
  g.add(at(box(1.6, 0.9, 0.9), 0, 0.45, 0));
  g.add(at(cyl(0.12, 0.12, 0.25, 8), -0.5, 1, 0));
  g.add(at(box(0.24, 0.2, 0.24), 0.5, 1, 0));
  return g; };
B['스위치·토글'] = () => { const g = new THREE.Group();
  g.add(at(box(1, 0.5, 0.7), 0, 0.25, 0));
  const lever = new THREE.Group(); lever.position.set(0, 0.5, 0);
  lever.add(at(box(0.14, 0.9, 0.14), 0, 0.4, 0));
  g.add(lever);
  g.userData.tick = t => {
    const on = Math.floor(t / 1600) % 2;
    const target = on ? -0.5 : 0.5;
    lever.rotation.z += (target - lever.rotation.z) * 0.18;
  };
  return g; };
B['LED 신호·다색'] = () => { const g = new THREE.Group();
  const bulbs = [];
  LED_COLORS.forEach((c, i) => {
    const x = (i - (LED_COLORS.length - 1) / 2) * 1.1;
    const h = 1.1 + (i % 3) * 0.3;
    g.add(at(cyl(0.09, 0.09, h, 6), x, h / 2, 0));
    const bulb = ico(0.3, { fill: c });                      // 색 면 + 먹선 테두리
    bulb.position.set(x, h + 0.22, 0); g.add(bulb);
    bulbs.push({ bulb, c, period: 380 + i * 260 });
  });
  g.userData.tick = t => bulbs.forEach(({ bulb, c, period }) => {
    const on = Math.floor(t / period) % 2 === 0;
    bulb.userData.mesh.material.color.set(on ? c : PAPER);   // 꺼지면 흰 면(테두리는 남는다)
  });
  return g; };
B['입대 정문'] = () => { const g = new THREE.Group();
  g.add(at(box(0.4, 3, 0.4), -1.6, 1.5, 0));
  g.add(at(box(0.4, 3, 0.4), 1.6, 1.5, 0));
  g.add(at(box(3.9, 0.5, 0.5), 0, 3.1, 0));
  const plate = at(box(1.6, 0.6, 0.12), 0, 3.1, 0.32); g.add(plate);
  g.userData.tick = t => { plate.rotation.x = osc(t, 3000, 0.1); };
  return g; };
B['차·주행'] = () => { const g = new THREE.Group();
  const car = new THREE.Group();
  car.add(at(box(2.4, 0.7, 1.2), 0, 0.65, 0));
  car.add(at(box(1.2, 0.6, 1.1), -0.2, 1.25, 0));
  const wheels = [];
  for (const [wx, wz] of [[-0.8, 0.62], [0.8, 0.62], [-0.8, -0.62], [0.8, -0.62]]) {
    const w = at(cyl(0.28, 0.28, 0.14, 8), wx, 0.3, wz); w.rotation.x = Math.PI / 2;
    car.add(w); wheels.push(w);
  }
  g.add(car);
  g.userData.tick = t => {
    wheels.forEach(w => { w.rotation.y = -t / 220; });       // 바퀴 굴림
    if (g.userData.roam !== false) car.position.x = osc(t, 5200, 1.3);
    car.position.y = Math.abs(osc(t, 260, 0.015));
  };
  return g; };
B['새·날갯짓'] = () => { const g = new THREE.Group();
  const bird = new THREE.Group();
  const wl = new THREE.Group(); wl.add(at(box(0.5, 0.05, 0.14), -0.25, 0, 0));
  const wr = new THREE.Group(); wr.add(at(box(0.5, 0.05, 0.14), 0.25, 0, 0));
  bird.add(wl, wr); bird.position.y = 1.6; g.add(bird);
  g.userData.tick = t => {
    wl.rotation.z = 0.45 + osc(t, 360, 0.45);
    wr.rotation.z = -0.45 - osc(t, 360, 0.45);
    bird.position.y = 1.6 + osc(t, 2400, 0.25);
    bird.position.x = osc(t, 6400, 1.2);
  };
  return g; };
B['논·벼바람'] = () => { const g = new THREE.Group();
  g.add(at(box(5, 0.18, 3.6), 0, 0.09, 0));
  // 물찬 논: 이랑 줄
  for (let r = -1; r <= 1; r++)
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
      [new THREE.Vector3(-2.3, 0.2, r * 0.9), new THREE.Vector3(2.3, 0.2, r * 0.9)]), inkLine));
  // 벼 포기 4×3 — 열마다 위상 다른 바람
  const stalks = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const sway = new THREE.Group();
    sway.add(at(cyl(0, 0.14, 0.55, 4), 0, 0.27, 0));
    sway.position.set(-1.7 + i * 1.15, 0.18, -0.9 + j * 0.9);
    g.add(sway); stalks.push({ sway, ph: i * 0.2 + j * 0.1 });
  }
  g.userData.tick = t => stalks.forEach(({ sway, ph }) => { sway.rotation.z = osc(t, 2400, 0.18, ph); });
  return g; };
B['밭·이랑'] = () => { const g = new THREE.Group();
  g.add(at(box(5, 0.18, 3.6), 0, 0.09, 0));
  for (let r = 0; r < 4; r++)
    g.add(at(inked(prismGeo(4.4, 0.55, 0.3)), 0, 0.18, -1.2 + r * 0.8));
  // 작물 몇 포기
  const crops = [];
  for (const [cx, cz] of [[-1.5, -1.2], [0.2, -0.4], [1.4, 0.4], [-0.6, 1.2]]) {
    const c = ico(0.22); c.position.set(cx, 0.45, cz); g.add(c); crops.push(c);
  }
  g.userData.tick = t => crops.forEach((c, i) => { c.rotation.y = osc(t, 3200, 0.3, i * 0.25); });
  return g; };
B['작은 아파트'] = () => { const g = new THREE.Group();
  g.add(at(box(2.4, 5.2, 2.4), 0, 2.6, 0));
  g.add(at(box(2.8, 0.18, 2.8), 0, 5.3, 0));                     // 옥상 슬래브
  const tank = at(cyl(0.4, 0.4, 0.7, 8), -0.6, 5.75, -0.5); g.add(tank);
  // 창 3×5
  for (let cx = -1; cx <= 1; cx++) for (let fy = 0; fy < 5; fy++)
    g.add(at(box(0.42, 0.42, 0.06), cx * 0.72, 0.9 + fy * 0.92, 1.22));
  // 옥상 안테나 — 흔들림
  const ant = new THREE.Group(); ant.position.set(0.7, 5.4, 0.4);
  ant.add(at(cyl(0.03, 0.03, 1.1, 5), 0, 0.55, 0));
  ant.add(at(box(0.7, 0.04, 0.04), 0, 1.05, 0));
  g.add(ant);
  g.userData.tick = t => { ant.rotation.z = osc(t, 3800, 0.09); ant.rotation.x = osc(t, 2900, 0.06, 0.3); };
  return g; };
B['군부대·차단봉'] = () => { const g = new THREE.Group();
  // 막사(낮은 박공) + 위병소
  g.add(at(box(3.4, 1.1, 1.5), -0.9, 0.55, -1.2));
  g.add(at(inked(prismGeo(3.6, 1.7, 0.55)), -0.9, 1.1, -1.2));
  g.add(at(box(0.95, 1.4, 0.95), 1.6, 0.7, 0.4));
  g.add(at(box(1.25, 0.14, 1.25), 1.6, 1.47, 0.4));
  // 차단봉 — 지주 피벗에서 수평↔들림으로 여닫는다.
  //   ⚠️ 봉은 −x 방향으로 뻗어 있다. rotation.x는 봉 자체 축 회전이라 화면에서 안 보인다(구버전 실결함).
  //   들어올리는 축은 z — 자유단이 위로 가려면 음의 각이다.
  const post = at(box(0.16, 1, 0.16), 0.9, 0.5, 1.4); g.add(post);
  const arm = new THREE.Group(); arm.position.set(0.9, 0.95, 1.4);
  arm.add(at(box(2.1, 0.09, 0.09), -1.05, 0, 0));
  g.add(arm);
  g.userData.gateArm = arm;                                        // 프로브가 각도를 직접 읽는다
  // 게양대 + 깃발
  g.add(at(cyl(0.04, 0.04, 2.6, 6), -2.3, 1.3, 0.9));
  const flag = new THREE.Group(); flag.position.set(-2.3, 2.35, 0.9);
  flag.add(at(box(0.75, 0.45, 0.04), 0.4, 0, 0));
  g.add(flag);
  // 철조망 지그재그(회색)
  const zig = [];
  for (let i = 0; i <= 12; i++) zig.push(new THREE.Vector3(-2.6 + i * 0.42, i % 2 ? 0.55 : 0.2, 2.2));
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(zig),
    new THREE.LineBasicMaterial({ color: 0x8c8a82 })));
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
    [new THREE.Vector3(-2.6, 0.38, 2.2), new THREE.Vector3(2.44, 0.38, 2.2)]),
    new THREE.LineBasicMaterial({ color: 0x8c8a82 })));
  const LIFT = 75 * Math.PI / 180;                                 // 들림 각 75°
  g.userData.tick = t => {
    // 4초 주기: 닫힘 유지 → 상승 → 열림 유지 → 하강. smoothstep으로 양끝을 눌러 준다.
    const u = (t % 4000) / 4000;
    const r = u < 0.10 ? 0 : u < 0.45 ? (u - 0.10) / 0.35
            : u < 0.60 ? 1 : u < 0.95 ? 1 - (u - 0.60) / 0.35 : 0;
    arm.rotation.z = -LIFT * r * r * (3 - 2 * r);
    flag.rotation.y = osc(t, 2000, 0.5); flag.rotation.z = osc(t, 1300, 0.07);
  };
  return g; };
B['박물관·현수막'] = () => { const g = new THREE.Group();
  // 기단 + 계단 3단
  g.add(at(box(4.6, 0.35, 3), 0, 0.17, 0));
  g.add(at(box(2.6, 0.16, 0.5), 0, 0.08, 1.7));
  g.add(at(box(2.6, 0.16, 0.5), 0, 0.24, 1.45));
  // 본관 + 낮은 박공지붕
  g.add(at(box(4, 1.7, 2.2), 0, 1.2, -0.2));
  g.add(at(inked(prismGeo(4.4, 2.6, 0.8)), 0, 2.05, -0.2));
  // 전면 열주 4
  for (const px of [-1.5, -0.5, 0.5, 1.5])
    g.add(at(cyl(0.11, 0.13, 1.7, 8), px, 1.2, 1.15));
  // 현판
  g.add(at(box(1.4, 0.4, 0.08), 0, 2.05, 1.15));
  // 현수막 — 옆에 드리워 흔들림
  const banner = new THREE.Group(); banner.position.set(2.35, 2.4, 0.6);
  banner.add(at(box(0.5, 1.6, 0.04), 0, -0.8, 0));
  g.add(banner);
  g.add(at(cyl(0.03, 0.03, 0.5, 5), 2.35, 2.5, 0.6, 0));
  g.userData.tick = t => { banner.rotation.x = osc(t, 2700, 0.14); banner.rotation.z = osc(t, 1900, 0.06, 0.4); };
  return g; };
B['비닐하우스'] = () => { const g = new THREE.Group();
  // 아치 리브 5개 — 비닐은 투명이라 뼈대 선만
  const arc = (n = 14) => Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI;
    return new THREE.Vector3(Math.cos(a) * 1.3, Math.sin(a) * 1.2, 0);
  });
  for (let r = 0; r < 5; r++) {
    const rib = new THREE.Line(new THREE.BufferGeometry().setFromPoints(arc()), inkLine);
    rib.position.set(0, 0, -1.8 + r * 0.9); g.add(rib);
  }
  // 용마루 + 바닥 레일 2
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
    [new THREE.Vector3(0, 1.2, -1.8), new THREE.Vector3(0, 1.2, 1.8)]), inkLine));
  for (const sx of [-1.3, 1.3])
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
      [new THREE.Vector3(sx, 0, -1.8), new THREE.Vector3(sx, 0, 1.8)]), inkLine));
  // 출입문 틀
  g.add(at(box(0.8, 1, 0.06), 0, 0.5, 1.82));
  // 안의 작물 3 — 흔들림
  const crops = [];
  for (const [cx, cz] of [[-0.7, -1], [0.1, 0.2], [0.7, 1]]) {
    const sway = new THREE.Group();
    sway.add(at(cyl(0, 0.16, 0.5, 4), 0, 0.25, 0));
    sway.position.set(cx, 0, cz); g.add(sway); crops.push(sway);
  }
  g.userData.tick = t => crops.forEach((c, i) => { c.rotation.z = osc(t, 2600, 0.15, i * 0.3); });
  return g; };
B['정림사지 오층석탑'] = () => { const g = new THREE.Group();
  g.add(at(box(2.2, 0.35, 2.2), 0, 0.17, 0));                    // 기단
  let y = 0.35;
  for (let i = 0; i < 5; i++) {
    const bw = 1.15 - i * 0.16, rw = 1.75 - i * 0.2;
    g.add(at(box(bw, 0.42, bw), 0, y + 0.21, 0));                // 몸돌
    g.add(at(box(rw, 0.13, rw), 0, y + 0.48, 0));                // 지붕돌(넓은 처마)
    y += 0.62;
  }
  g.add(at(cyl(0.05, 0.05, 0.5, 6), 0, y + 0.22, 0));            // 상륜부
  return g; };
B['백마강 타일'] = () => { const g = new THREE.Group();
  g.add(at(box(5.2, 0.12, 3), 0, 0.02, 0));                      // 수면(낮게)
  const flows = [];
  for (let i = 0; i < 6; i++) {
    const f = at(box(0.9, 0.02, 0.05), 0, 0.12, -1 + (i % 3) * 1);
    g.add(f); flows.push({ f, off: i * 1.7, z: -1 + (i % 3) * 1 });
  }
  g.userData.tick = t => flows.forEach(({ f, off, z }) => {
    f.position.x = ((t / 900 + off) % 6.2) - 3.1;                // 물결이 흘러간다
    f.position.z = z + osc(t, 2600, 0.08, off);
  });
  return g; };
B['다리'] = () => { const g = new THREE.Group();
  g.add(at(box(5, 0.2, 1.6), 0, 1.05, 0));                        // 상판
  g.add(at(box(5.3, 0.09, 1.78), 0, 1.2, 0));                     // 상판 테두리(이중선)
  for (const px of [-1.7, 0, 1.7]) g.add(at(box(0.32, 1, 0.5), px, 0.5, 0));
  // 아치 리브 — 교각 사이 2스팬 × 양측면
  for (const cx of [-0.85, 0.85]) for (const sz of [-0.8, 0.8]) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      pts.push(new THREE.Vector3(cx - 0.85 + u * 1.7, 0.95 - Math.sin(u * Math.PI) * 0.55, sz));
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), inkLine));
  }
  for (const sz of [-0.75, 0.75]) {                                // 난간
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
      [new THREE.Vector3(-2.5, 1.55, sz), new THREE.Vector3(2.5, 1.55, sz)]), inkLine));
    for (let i = 0; i <= 10; i++)
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
        [new THREE.Vector3(-2.5 + i * 0.5, 1.24, sz), new THREE.Vector3(-2.5 + i * 0.5, 1.55, sz)]), inkLine));
  }
  for (const px of [-1.9, 1.9]) {                                  // 가로등 2
    g.add(at(cyl(0.035, 0.035, 0.85, 5), px, 1.66, 0.6));
    g.add(at(cyl(0.12, 0.05, 0.14, 6), px, 2.12, 0.6));
  }
  return g; };
B['통통배'] = () => { const g = new THREE.Group();
  const boat = new THREE.Group();
  boat.add(at(box(2.4, 0.5, 1), 0, 0.45, 0));                     // 선체
  boat.add(at(inked(prismGeo(1, 0.5, 0.35)), 1.45, 0.45, 0, 0));  // 뱃머리(엎은 프리즘)
  boat.add(at(box(0.9, 0.7, 0.8), -0.4, 1.05, 0));                // 선실
  boat.add(at(cyl(0.07, 0.07, 0.5, 6), 0.3, 1, 0));               // 굴뚝
  const puffs = [0, 1].map(i => { const p = ico(0.12 + i * 0.04); boat.add(p); return p; });
  g.add(boat);
  g.userData.tick = t => {
    boat.position.y = osc(t, 1400, 0.08) + Math.abs(osc(t, 180, 0.02));   // 통통 진동
    boat.rotation.z = osc(t, 1700, 0.04);
    if (g.userData.roam !== false) boat.position.x = osc(t, 7000, 1.2);
    puffs.forEach((p, i) => {
      const ph = ((t / 2200) + i / 2) % 1;
      p.position.set(0.3 + ph * 0.3, 1.35 + ph * 0.9, 0);
      p.visible = ph < 0.8; const sc = 0.7 + ph; p.scale.set(sc, sc, sc);
    });
  };
  return g; };
B['정자(백화정)'] = () => { const g = new THREE.Group();
  g.add(at(cyl(1.7, 1.9, 0.35, 6), 0, 0.17, 0));                  // 육각 축대
  g.add(at(cyl(1.5, 1.5, 0.15, 6), 0, 0.75, 0));                  // 마루
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + Math.PI / 6;
    g.add(at(cyl(0.07, 0.07, 1.1, 6), Math.cos(a) * 1.15, 1.35, Math.sin(a) * 1.15));
  }
  g.add(at(cyl(0, 1.95, 0.9, 6), 0, 2.25, 0));                    // 육모지붕
  g.add(at(cyl(0.06, 0.06, 0.35, 5), 0, 2.85, 0));                // 절병통
  return g; };
B['부소산성'] = () => { const g = new THREE.Group();
  g.add(at(cyl(0.9, 3.3, 2.8, 7), 0, 1.4, 0));                   // 산체
  // 성곽 띠 + 성문
  g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 21 }, (_, i) => { const a = i / 21 * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 2.15, 1.35, Math.sin(a) * 2.15); })), inkLine));
  g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 21 }, (_, i) => { const a = i / 21 * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 2.3, 1.1, Math.sin(a) * 2.3); })), inkLine));
  g.add(at(box(0.7, 0.55, 0.4), 0, 1.25, 2.1));
  return g; };
B['궁남지'] = () => { const g = new THREE.Group();
  g.add(at(cyl(2.5, 2.5, 0.16, 14), 0, 0.08, 0));                // 연못
  g.add(at(cyl(0.75, 0.9, 0.4, 8), 0, 0.36, 0));                 // 섬
  for (let i = 0; i < 4; i++)                                     // 포룡정(미니)
    g.add(at(cyl(0.05, 0.05, 0.55, 5), Math.cos(i * 1.57 + 0.78) * 0.4, 0.85, Math.sin(i * 1.57 + 0.78) * 0.4));
  g.add(at(cyl(0, 0.75, 0.45, 4), 0, 1.35, 0, Math.PI / 4));
  g.add(at(box(1.7, 0.08, 0.4), 1.6, 0.5, 0));                   // 목교
  const pads = [];
  for (const [px, pz] of [[-1.6, 0.6], [-1.1, -1.2], [1.2, 1.4], [1.7, -0.9], [0.2, -1.8]]) {
    const pad = at(cyl(0.28, 0.28, 0.05, 7), px, 0.19, pz); g.add(pad); pads.push(pad);
  }
  g.userData.tick = t => pads.forEach((pd, i) => {
    pd.position.y = 0.19 + osc(t, 2800, 0.03, i * 0.3);
    pd.rotation.y = osc(t, 5000, 0.3, i * 0.2);
  });
  return g; };
B['낙화암·백화정'] = () => { const g = new THREE.Group();
  g.add(at(box(1.7, 2.2, 1.5), 0, 1.1, 0, 0.2));                 // 절벽 하단
  g.add(at(box(1.4, 1.6, 1.3), 0.15, 2.8, 0.05, -0.15));         // 절벽 상단(단 차)
  for (let i = 0; i < 3; i++)                                     // 백화정(미니 삼주)
    g.add(at(cyl(0.045, 0.045, 0.5, 5), 0.15 + Math.cos(i * 2.1) * 0.32, 3.85, 0.05 + Math.sin(i * 2.1) * 0.32));
  g.add(at(cyl(0, 0.65, 0.4, 6), 0.15, 4.3, 0.05));
  return g; };
B['사랑나무·평상'] = () => { const g = new THREE.Group();
  const sway = new THREE.Group();
  sway.add(at(cyl(0.22, 0.3, 1.6, 8), 0, 0.8, 0));               // 굵은 둥치
  sway.add(at(ico(1.25), -0.55, 2.5, 0));
  sway.add(at(ico(1.05), 0.7, 2.75, 0.15));
  g.add(sway);
  g.add(at(box(1.6, 0.3, 1.1), 1.7, 0.3, 0.9));                  // 평상
  g.userData.tick = t => { sway.rotation.z = osc(t, 4600, 0.05); sway.rotation.x = osc(t, 3900, 0.035, 0.4); };
  return g; };
B['버스정류장'] = () => { const g = new THREE.Group();
  g.add(at(box(0.14, 1.7, 0.14), -1, 0.85, -0.3));
  g.add(at(box(0.14, 1.7, 0.14), 1, 0.85, -0.3));
  g.add(at(box(2.6, 0.1, 1.1), 0, 1.75, 0));                     // 지붕
  g.add(at(box(2.2, 0.12, 0.45), 0, 0.5, -0.35));                // 벤치
  g.add(at(cyl(0.04, 0.04, 2, 5), 1.7, 1, 0.3));                 // 표지판 기둥
  const sign = at(cyl(0.32, 0.32, 0.06, 10), 1.7, 2.1, 0.3); sign.rotation.x = Math.PI / 2; g.add(sign);
  g.userData.tick = t => { sign.rotation.z = osc(t, 3400, 0.18); };
  return g; };
B['버스'] = () => { const g = new THREE.Group();
  const bus = new THREE.Group();
  bus.add(at(box(3.4, 1.3, 1.2), 0, 0.95, 0));
  for (let i = 0; i < 4; i++) bus.add(at(box(0.55, 0.45, 0.06), -1.2 + i * 0.8, 1.25, 0.62));
  for (const [wx, wz] of [[-1.15, 0.62], [1.15, 0.62], [-1.15, -0.62], [1.15, -0.62]]) {
    const w = at(cyl(0.3, 0.3, 0.16, 8), wx, 0.32, wz); w.rotation.x = Math.PI / 2; bus.add(w);
  }
  g.add(bus);
  g.userData.tick = t => {
    const cyc = (t % 9000) / 9000;                                // 달리다 정류장에 선다
    const xx = cyc < 0.4 ? -1.4 + cyc / 0.4 * 1.4 : cyc < 0.6 ? 0 : (cyc - 0.6) / 0.4 * 1.4;
    if (g.userData.roam !== false) bus.position.x = xx;
    bus.position.y = Math.abs(osc(t, 240, 0.012));
  };
  return g; };
B['학교 본관'] = () => { const g = new THREE.Group();
  g.add(at(box(5, 1.9, 1.6), 0, 0.95, 0));
  for (let i = 0; i < 6; i++) for (let f = 0; f < 2; f++)
    g.add(at(box(0.5, 0.42, 0.06), -2.1 + i * 0.84, 0.62 + f * 0.85, 0.83));
  g.add(at(box(1.1, 2.2, 0.5), 0, 1.1, 0.95));                   // 중앙 현관
  g.add(at(cyl(0.04, 0.04, 1.6, 5), 2.1, 2.8, 0));               // 깃대
  const flag = new THREE.Group(); flag.position.set(2.1, 3.45, 0);
  flag.add(at(box(0.6, 0.4, 0.04), 0.32, 0, 0));
  g.add(flag);
  g.userData.tick = t => { flag.rotation.y = osc(t, 2100, 0.5, 0.2); };
  return g; };
B['마을회관·확성기'] = () => { const g = new THREE.Group();
  g.add(at(box(2.8, 1.5, 2), 0, 0.75, 0));
  g.add(at(inked(prismGeo(3.1, 2.3, 0.7)), 0, 1.5, 0));
  g.add(at(cyl(0.05, 0.05, 1.6, 5), 1.1, 2.7, 0));               // 스피커 기둥
  const horn = at(cyl(0.3, 0.12, 0.5, 8), 1.1, 3.4, 0.2); horn.rotation.x = 1.2; g.add(horn);
  // 방송 음파 링
  const waves = [0, 1].map(() => {
    const w = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 14 }, (_, i) => { const a = i / 14 * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a), Math.sin(a), 0); })),
      new THREE.LineBasicMaterial({ color: INK, transparent: true }));
    w.position.set(1.1, 3.55, 0.45); w.rotation.x = 1.2 - Math.PI / 2; g.add(w); return w;
  });
  g.userData.tick = t => waves.forEach((w, i) => {
    const ph = ((t / 2200) + i * 0.5) % 1;
    const sc = 0.15 + ph * 0.9; w.scale.set(sc, sc, sc);
    w.position.y = 3.55 + ph * 0.5; w.material.opacity = (1 - ph) * 0.8;
  });
  return g; };
B['오일장 천막'] = () => { const g = new THREE.Group();
  for (const [px, pz] of [[-1.1, -0.7], [1.1, -0.7], [-1.1, 0.7], [1.1, 0.7]])
    g.add(at(cyl(0.05, 0.05, 1.3, 5), px, 0.65, pz));
  const roof = at(inked(prismGeo(2.9, 2, 0.55)), 0, 1.3, 0); g.add(roof);
  g.add(at(box(1.9, 0.5, 1), 0, 0.25, 0));                       // 좌판
  for (const [bx, bz] of [[-0.5, -0.2], [0.2, 0.15], [0.6, -0.25]]) g.add(at(ico(0.16), bx, 0.58, bz));
  g.userData.tick = t => { roof.rotation.z = osc(t, 1800, 0.03); roof.rotation.x = osc(t, 2400, 0.025, 0.3); };
  return g; };
B['경운기'] = () => { const g = new THREE.Group();
  const tiller = new THREE.Group();
  tiller.add(at(box(1, 0.6, 0.8), 0.7, 0.65, 0));                // 엔진
  tiller.add(at(box(1.4, 0.35, 1), -0.7, 0.75, 0));              // 짐칸
  const handle = at(box(1.1, 0.06, 0.06), -1.35, 1.05, 0.2); handle.rotation.z = 0.35; tiller.add(handle);
  const handle2 = at(box(1.1, 0.06, 0.06), -1.35, 1.05, -0.2); handle2.rotation.z = 0.35; tiller.add(handle2);
  const wheels = [];
  for (const wz of [0.5, -0.5]) { const w = at(cyl(0.34, 0.34, 0.12, 8), 0.7, 0.34, wz); w.rotation.x = Math.PI / 2; tiller.add(w); wheels.push(w); }
  for (const wz of [0.42, -0.42]) { const w = at(cyl(0.22, 0.22, 0.1, 8), -0.9, 0.22, wz); w.rotation.x = Math.PI / 2; tiller.add(w); wheels.push(w); }
  g.add(tiller);
  g.userData.tick = t => {
    tiller.position.y = Math.abs(osc(t, 130, 0.02));             // 덜덜덜
    if (g.userData.roam !== false) tiller.position.x = osc(t, 8200, 1.1);
    wheels.forEach(w => { w.rotation.y = -t / 480; });
  };
  return g; };
B['전봇대'] = () => { const g = new THREE.Group();
  g.add(at(cyl(0.08, 0.11, 3.6, 7), 0, 1.8, 0));
  g.add(at(box(1.5, 0.09, 0.09), 0, 3.3, 0));
  g.add(at(box(1.1, 0.09, 0.09), 0, 3, 0));
  for (const px of [-0.6, 0.6]) g.add(at(box(0.08, 0.16, 0.08), px, 3.42, 0));
  // 늘어진 전선 두 가닥
  for (const [py, sag] of [[3.3, 0.5], [3.0, 0.42]])
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 13 }, (_, i) => { const u = i / 12;
        return new THREE.Vector3(-2.6 + u * 5.2, py - Math.sin(u * Math.PI) * sag, 0); })),
      new THREE.LineBasicMaterial({ color: 0x8c8a82 })));
  return g; };
B['수박'] = () => { const g = new THREE.Group();
  const melon = ico(0.5); melon.scale.y = 0.85; melon.position.y = 0.42; g.add(melon);
  g.add(at(cyl(0.03, 0.03, 0.2, 5), 0, 0.92, 0));
  const half = ico(0.32); half.scale.y = 0.5; half.position.set(0.9, 0.16, 0.3); g.add(half); // 쪼갠 수박
  return g; };
B['와요지 가마'] = () => { const g = new THREE.Group();
  g.add(at(cyl(0.75, 1.5, 0.95, 9), 0, 0.47, 0));                // 가마 봉분
  g.add(at(box(0.55, 0.5, 0.3, { fill: 'ink' }), 0, 0.25, 1.35)); // 아궁이
  const puffs = [0, 1].map(i => { const p = ico(0.14 + i * 0.05); g.add(p); return p; });
  g.userData.tick = t => puffs.forEach((p, i) => {
    const ph = ((t / 3600) + i / 2) % 1;
    p.position.set(Math.sin(ph * 5 + i) * 0.12, 1 + ph * 1.3, 0);
    p.visible = ph < 0.85; const sc = 0.7 + ph * 0.9; p.scale.set(sc, sc * 0.8, sc);
  });
  return g; };
B['마당바위'] = () => { const g = new THREE.Group();
  const rock = ico(1.3); rock.scale.set(1.3, 0.55, 1); rock.position.y = 0.7; rock.rotation.y = 0.4; g.add(rock);
  const rock2 = ico(0.5); rock2.scale.y = 0.6; rock2.position.set(1.5, 0.3, 0.5); g.add(rock2);
  return g; };
B['솟대'] = () => { const g = new THREE.Group();
  g.add(at(cyl(0.05, 0.07, 3, 6), 0, 1.5, 0));
  const bird = new THREE.Group(); bird.position.set(0, 3.1, 0);
  bird.add(at(box(0.55, 0.12, 0.12), 0, 0, 0));
  bird.add(at(box(0.28, 0.1, 0.08), 0.32, 0.1, 0, 0.4));
  g.add(bird);
  g.userData.tick = t => { bird.rotation.y = osc(t, 5200, 0.6); };
  return g; };
B['갈대'] = () => { const g = new THREE.Group();
  const sway = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = -0.5 + i * 0.25;
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      pts.push(new THREE.Vector3(Math.sin(a) * u * 0.55 + u * u * 0.18, u * (0.9 + (i % 3) * 0.25), Math.cos(a) * u * 0.2));
    }
    sway.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), inkLine));
    if (i % 2 === 0) {
      const tip = at(box(0.05, 0.16, 0.05), Math.sin(a) * 0.55 + 0.18, (0.9 + (i % 3) * 0.25) + 0.06, Math.cos(a) * 0.2);
      sway.add(tip);
    }
  }
  g.add(sway);
  g.userData.tick = t => { sway.rotation.z = osc(t, 2300, 0.13); sway.rotation.x = osc(t, 3100, 0.07, 0.3); };
  return g; };
B['도로 타일'] = () => { const g = new THREE.Group();
  g.add(at(box(5, 0.14, 2.4), 0, 0.07, 0));
  for (let i = -2; i <= 2; i++) g.add(at(box(0.7, 0.02, 0.1), i * 1.1, 0.16, 0));
  return g; };
B['횡단보도 타일'] = () => { const g = new THREE.Group();
  g.add(at(box(5, 0.14, 2.4), 0, 0.07, 0));
  for (let i = -2; i <= 2; i++) g.add(at(box(0.5, 0.02, 1.8), i * 0.95, 0.16, 0));
  return g; };

// ═══════════════════════════════════════════════════════════════════════
// 참여자 브레인스토밍 장소 빌더 9종 (2026-09-03)
//   아이들이 적어 낸 「부여 장소」를 도시에 앉히기 위한 최소 세트.
//   기존 마을 소품 문법 유지 — 흰 면 + 먹선만, 색은 쓰지 않는다(색은 작품 LED 몫).
// ═══════════════════════════════════════════════════════════════════════
B['종합운동장 트랙'] = () => { const g = new THREE.Group();
  g.add(at(box(7, 0.24, 4.9), 0, 0.12, 0));                              // 부지
  const oval = (rx, rz, y) => new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 44 }, (_, i) => { const a = i / 44 * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * rx, y, Math.sin(a) * rz); })), inkLine);
  for (let k = 0; k < 3; k++) g.add(oval(3.05 - k * 0.31, 2.0 - k * 0.31, 0.26));   // 트랙 레인 3
  g.add(at(box(3.1, 0.06, 1.7), 0, 0.27, 0));                            // 필드
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
    [new THREE.Vector3(0, 0.31, -0.85), new THREE.Vector3(0, 0.31, 0.85)]), inkLine));
  for (const s of [-1, 1]) {                                             // 골대 2
    g.add(at(box(0.08, 0.58, 0.08), s * 1.45, 0.55, -0.62));
    g.add(at(box(0.08, 0.58, 0.08), s * 1.45, 0.55, 0.62));
    g.add(at(box(0.08, 0.08, 1.32), s * 1.45, 0.83, 0));
  }
  for (let i = 0; i < 3; i++) g.add(at(box(5.4, 0.22, 0.42), 0, 0.23 + i * 0.2, -2.62 - i * 0.36));  // 관중석 3단
  for (const s of [-1, 1]) {                                             // 조명탑 2
    g.add(at(cyl(0.05, 0.05, 2.4, 5), s * 3.1, 1.2, -2.1));
    g.add(at(box(0.62, 0.28, 0.1), s * 3.1, 2.5, -2.1));
  }
  const run = [0, 1, 2].map(() => { const r = ico(0.14); g.add(r); return r; });
  g.userData.tick = t => run.forEach((r, i) => {                         // 트랙을 도는 주자 3
    const a = (t / 6400 + i * 0.13) * Math.PI * 2;
    r.position.set(Math.cos(a) * 2.9, 0.4, Math.sin(a) * 1.85);
  });
  return g; };
B['체육관'] = () => { const g = new THREE.Group();
  g.add(at(box(4.4, 2.1, 2.9), 0, 1.05, 0));
  g.add(at(inked(prismGeo(4.8, 3.2, 0.95)), 0, 2.1, 0));                 // 박공 지붕
  for (let i = 0; i < 4; i++) g.add(at(box(0.6, 0.75, 0.06), -1.5 + i * 1.0, 1.35, 1.48));
  g.add(at(box(1.1, 1.25, 0.32), 0, 0.62, 1.6));                         // 현관
  g.add(at(box(1.9, 0.4, 0.08), 0, 2.55, 1.35));                         // 이름판
  return g; };
B['수영장'] = () => { const g = new THREE.Group();
  g.add(at(box(4.2, 0.34, 3.0), 0, 0.17, 0));                            // 데크
  g.add(at(box(3.3, 0.08, 2.1), 0, 0.36, 0));                            // 수면
  for (let i = -2; i <= 2; i++) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
    [new THREE.Vector3(-1.62, 0.42, i * 0.42), new THREE.Vector3(1.62, 0.42, i * 0.42)]), inkLine));
  for (const s of [-1, 1]) g.add(at(box(0.45, 0.14, 0.34), s * 1.35, 0.45, -1.22));   // 스타팅 블록
  for (const s of [-1, 1]) {                                             // 난간
    g.add(at(cyl(0.04, 0.04, 0.5, 5), s * 2.0, 0.55, 1.4));
    g.add(at(box(0.06, 0.06, 2.8), s * 2.0, 0.78, 0));
  }
  g.add(at(box(1.3, 0.9, 0.8), -2.35, 0.62, 1.05));                      // 탈의동
  const sw = ico(0.13); g.add(sw);
  g.userData.tick = t => { const u = Math.abs(((t / 3800) % 2) - 1);     // 왕복하는 수영자
    sw.position.set(-1.45 + u * 2.9, 0.45, -0.42); };
  return g; };
B['농구장'] = () => { const g = new THREE.Group();
  g.add(at(box(4.0, 0.2, 2.6), 0, 0.1, 0));
  g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-1.85, 0.22, -1.15), new THREE.Vector3(1.85, 0.22, -1.15),
    new THREE.Vector3(1.85, 0.22, 1.15), new THREE.Vector3(-1.85, 0.22, 1.15)]), inkLine));
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
    [new THREE.Vector3(0, 0.22, -1.15), new THREE.Vector3(0, 0.22, 1.15)]), inkLine));
  g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 18 }, (_, i) => { const a = i / 18 * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 0.5, 0.22, Math.sin(a) * 0.5); })), inkLine));
  for (const s of [-1, 1]) {                                             // 백보드·링
    g.add(at(cyl(0.06, 0.06, 1.5, 5), s * 1.75, 0.85, 0));
    g.add(at(box(0.08, 0.5, 0.72), s * 1.62, 1.55, 0));
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17); })), inkLine);
    ring.position.set(s * 1.44, 1.34, 0); g.add(ring);
  }
  const ball = ico(0.12); g.add(ball);
  g.userData.tick = t => { const u = (t % 2600) / 2600;                  // 튀는 공
    ball.position.set(-1.0 + u * 2.0, 0.25 + Math.abs(Math.sin(u * Math.PI * 3)) * 0.9, 0.2); };
  return g; };
B['놀이터'] = () => { const g = new THREE.Group();
  g.add(at(cyl(1.5, 1.5, 0.16, 12), 0, 0.08, 0));                        // 모래판
  for (const s of [-1, 1]) {                                             // 그네 프레임
    g.add(at(box(0.07, 1.5, 0.07), -0.72, 0.75, s * 0.4));
    g.add(at(box(0.07, 1.5, 0.07), 0.12, 0.75, s * 0.4));
  }
  g.add(at(box(1.1, 0.07, 0.07), -0.3, 1.5, 0));
  const sw = new THREE.Group(); sw.position.set(-0.3, 1.5, 0); g.add(sw);
  sw.add(at(box(0.04, 0.9, 0.04), -0.16, -0.45, 0));
  sw.add(at(box(0.04, 0.9, 0.04), 0.16, -0.45, 0));
  sw.add(at(box(0.42, 0.06, 0.24), 0, -0.9, 0));
  g.add(at(box(0.62, 1.1, 0.62), 1.0, 0.55, -0.5));                      // 미끄럼틀 탑
  const slide = at(box(0.42, 0.06, 1.5), 1.0, 0.74, 0.32); slide.rotation.x = 0.55; g.add(slide);
  for (const s of [-1, 1]) g.add(at(box(0.06, 0.5, 0.06), 1.0 + s * 0.22, 1.35, -0.5));
  g.userData.tick = t => { sw.rotation.x = osc(t, 2300, 0.5); };
  return g; };
B['누각·기와'] = () => { const g = new THREE.Group();
  g.add(at(box(4.2, 0.5, 3.0), 0, 0.25, 0));                             // 석축 기단
  for (const cx of [-1.6, 0, 1.6]) for (const cz of [-1.05, 1.05])
    g.add(at(cyl(0.11, 0.13, 1.5, 6), cx, 1.25, cz));                    // 기둥 6
  g.add(at(box(3.9, 0.2, 2.7), 0, 2.1, 0));                              // 창방
  g.add(at(inked(prismGeo(4.9, 3.6, 0.8)), 0, 2.2, 0));                  // 1층 지붕
  g.add(at(box(2.2, 0.95, 1.5), 0, 3.48, 0));                            // 2층 몸
  g.add(at(inked(prismGeo(3.1, 2.3, 0.62)), 0, 3.95, 0));                // 2층 지붕
  g.add(at(cyl(0.07, 0.07, 0.45, 5), 0, 4.75, 0));                       // 절병통
  g.add(at(box(6.2, 0.55, 0.2), 0, 0.27, 2.4));                          // 담장 ㄱ자
  g.add(at(box(0.2, 0.55, 2.6), -3.0, 0.27, 1.2));
  g.add(at(inked(prismGeo(6.4, 0.4, 0.16)), 0, 0.55, 2.4));              // 담장 기와
  return g; };
B['강의동'] = () => { const g = new THREE.Group();
  g.add(at(box(4.0, 2.4, 1.7), 0, 1.2, 0));
  for (let i = 0; i < 5; i++) for (let f = 0; f < 2; f++)
    g.add(at(box(0.46, 0.4, 0.06), -1.7 + i * 0.85, 0.85 + f * 0.8, 0.88));
  g.add(at(inked(prismGeo(4.4, 2.1, 0.55)), 0, 2.4, 0));                 // 기와 박공
  g.add(at(box(1.0, 1.3, 0.42), 0, 0.65, 1.0));                          // 현관
  g.add(at(box(1.4, 0.1, 0.5), 0, 0.06, 1.42));                          // 계단 판
  g.add(at(box(1.6, 0.35, 0.08), 0, 2.16, 0.9));                         // 이름판
  return g; };
B['야외무대'] = () => { const g = new THREE.Group();
  g.add(at(cyl(2.2, 2.4, 0.3, 14), 0, 0.15, 0));                         // 무대 판
  g.add(at(inked(new THREE.CylinderGeometry(1.9, 2.2, 2.1, 14, 1, true, Math.PI * 0.06, Math.PI * 0.88),
    { thresh: 22 }), 0, 1.35, 0));                                       // 반원 배경막
  for (let i = 0; i < 3; i++) g.add(at(box(4.0, 0.2, 0.5), 0, 0.1 + i * 0.18, 2.9 + i * 0.62));  // 객석 3단
  for (const s of [-1, 1]) {                                             // 조명탑
    g.add(at(cyl(0.05, 0.05, 2.6, 5), s * 2.45, 1.3, 1.5));
    g.add(at(box(0.4, 0.22, 0.16), s * 2.45, 2.7, 1.5));
  }
  const perf = ico(0.16); g.add(perf);
  g.userData.tick = t => { perf.position.set(osc(t, 5200, 0.9), 0.46, osc(t, 4100, 0.4, 0.3)); };
  return g; };
B['조각·덩어리'] = () => { const g = new THREE.Group();
  g.add(at(box(1.0, 0.24, 1.0), 0, 0.12, 0));                            // 좌대
  const m = new THREE.Group(); m.position.y = 0.24; g.add(m);
  m.add(at(ico(0.4), 0, 0.55, 0));
  const bar = at(box(0.24, 1.05, 0.24), 0.26, 0.78, -0.08); bar.rotation.z = 0.42; m.add(bar);
  m.add(at(cyl(0.16, 0.3, 0.55, 6), -0.32, 0.32, 0.16));
  g.userData.tick = t => { m.rotation.y = osc(t, 11000, 0.14); };
  return g; };

// ═══════════════════════════════════════════════════════════════════════
// 아이들 작품 미니어처 8종 — 나무판 디오라마 + 실제 DC 모터·LED 재현
//   사진 대응: 마을회로(4) · 입대정문(3) · 연못들판(8,7) · 별빛마당(2)
//              상가골목(6) · 운동장/야구장(10,9) · 축운산(5)
//   · 모터 = 실제 회전하는 메시(userData.spin)
//   · LED = 켜짐 원색 / 꺼짐 PAPER (ledString 문법 동일)
//   · 대표 LED는 userData.mainLed — 도시가 신호 blink 리듬으로 덮어쓴다
// ═══════════════════════════════════════════════════════════════════════
const WOOD = 0xe6d3a8, GRASS = 0x3f9b4f, WATER = 0x4a90c4, SKY = 0x6fb7dd;
const REDC = 0xe2402f, ORANGE = 0xfe5000, YELLOW = 0xf5b52e, PINK = 0xe8489a;
const PURPLE = 0x6b3fa0, BLUE = 0x2f6fe4, SILVER = 0x9d9a92, DIRT = 0xa8663c;
const paperLine = new THREE.LineBasicMaterial({ color: PAPER });

const wire = (pts, color = 0xd8a520) => new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p))),
  new THREE.LineBasicMaterial({ color }));
const poly = (pts, mat = paperLine, loop = false) => {
  const geo = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p)));
  return loop ? new THREE.LineLoop(geo, mat) : new THREE.Line(geo, mat);
};
const dashRoad = (pts, color = PAPER, ds = 0.26, gs = 0.22) => {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p))),
    new THREE.LineDashedMaterial({ color, dashSize: ds, gapSize: gs }));
  l.computeLineDistances(); return l;
};
// 알갱이 무리(진주·별·꽃·체리) — 점 구름 1 드로우콜
const dotField = (pts, color = 0xb9b5ab, size = 2.4) => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color, size, sizeAttenuation: false }));
};
// LED — leds 배열에 등록하면 tickLeds가 점멸시킨다(대표 LED는 leds=null)
const mkLed = (leds, color, x, y, z, period = 620, phase = 0, r = 0.19) => {
  const b = ico(r, { fill: color });
  b.position.set(x, y, z);
  if (leds) leds.push({ b, color, period, phase });
  return b;
};
const tickLeds = (leds, t) => { for (const L of leds)
  L.b.userData.mesh.material.color.set(Math.floor(t / L.period + L.phase) % 2 === 0 ? L.color : PAPER); };
// DC 모터 — 은색 몸통 + 실제 회전하는 축(userData.spin)
const dcMotor = (dir = 'up') => {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  if (dir === 'up') {
    g.add(at(cyl(0.24, 0.24, 0.5, 10, { fill: SILVER }), 0, 0.25, 0));
    g.add(at(cyl(0.06, 0.06, 0.2, 6, { fill: SILVER }), 0, 0.6, 0));
    spin.position.set(0, 0.68, 0);
  } else {
    const body = at(cyl(0.24, 0.24, 0.5, 10, { fill: SILVER }), 0, 0.24, 0);
    body.rotation.z = Math.PI / 2; g.add(body);
    const rod = at(cyl(0.06, 0.06, 0.22, 6, { fill: SILVER }), 0.36, 0.24, 0);
    rod.rotation.z = Math.PI / 2; g.add(rod);
    spin.position.set(0.5, 0.24, 0);
  }
  g.add(spin); g.userData.spin = spin;
  return g;
};
const battBox = (x, y, z, ry = 0) => at(box(1.3, 0.4, 0.6, { fill: 'ink' }), x, y, z, ry);
const toggle = (x, y, z, tilt = -0.55) => {
  const g = new THREE.Group(); g.position.set(x, y, z);
  g.add(at(box(0.42, 0.16, 0.34, { fill: SILVER }), 0, 0.08, 0));
  const lev = at(cyl(0.05, 0.05, 0.34, 6, { fill: SILVER }), 0, 0.3, 0);
  lev.rotation.z = tilt; g.add(lev);
  return g;
};
const upright = (obj) => { obj.rotation.x = Math.PI / 2; return obj; };  // 세운 판에 붙일 원반
const lcg = (seed) => { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; };

// ── ① 마을 회로 (사진 4) — 진주판 + 육각 링 7블록 + 중앙 모터 프로펠러 + LED 3 ──
B['작품·마을 회로'] = () => { const g = new THREE.Group(); const leds = [];
  const BW = 6.4, BD = 5.2;
  g.add(at(box(BW, 0.3, BD), 0, 0.15, 0));                        // 진주 깔린 흰 판
  const pearls = [];
  for (let ix = 0; ix < 30; ix++) for (let iz = 0; iz < 22; iz++) {
    const x = -BW / 2 + 0.14 + ix * ((BW - 0.28) / 29);
    const z = -BD / 2 + 0.14 + iz * ((BD - 0.28) / 21);
    if (Math.hypot(x, z) < 2.25) continue;                          // 링 안쪽은 흰 바닥
    pearls.push([x, 0.31, z]);
  }
  g.add(dotField(pearls, 0xc0bcb2, 2.2));
  const RING = [YELLOW, PINK, PURPLE, 0xf06a4a, ORANGE, REDC, SKY]; // 노랑·분홍·보라·다홍·주황·주황·하늘
  RING.forEach((c, i) => {
    const a = i / 7 * Math.PI * 2 + 0.35;
    const bar = box(1.62, 0.36, 0.42, { fill: c });
    bar.position.set(Math.cos(a) * 1.78, 0.48, Math.sin(a) * 1.78);
    bar.rotation.y = -(a + Math.PI / 2);
    g.add(bar);
  });
  const mot = dcMotor('up'); mot.position.set(0, 0.3, 0); g.add(mot);
  mot.userData.spin.add(box(1.25, 0.04, 0.26));                    // 흰 종이 프로펠러
  g.add(mkLed(leds, BLUE, -1.0, 0.5, 0.92, 300, 0, 0.21));         // 파랑(좌하)
  g.add(mkLed(leds, 0xffffff, 1.1, 0.5, -1.0, 300, 1, 0.21));      // 흰(우상)
  const main = mkLed(null, ORANGE, 1.45, 0.5, 0.42, 0, 0, 0.23);   // 주황(우) = 대표
  g.add(main); g.userData.mainLed = main;
  g.add(toggle(-2.75, 0.3, -2.2));                                 // 좌상 토글 스위치
  g.add(battBox(2.3, 0.5, -2.3, -0.12));                         // 우상 검정 배터리박스
  g.add(wire([[2.15, 0.7, -1.8], [1.3, 0.55, -1.0], [0.3, 0.78, -0.15]], 0xd23b2f));
  g.add(wire([[-2.6, 0.46, -1.75], [-2.3, 0.34, -0.5], [-1.7, 0.34, 0.7], [-1.1, 0.44, 0.95]]));
  g.add(wire([[3.05, 0.32, -0.4], [3.6, 0.32, 0.7], [2.9, 0.32, 1.7], [2.1, 0.32, 2.05]]));
  g.userData.motors = [mot.userData.spin]; g.userData.leds = leds;
  g.userData.tick = t => { mot.userData.spin.rotation.y = t / 95; tickLeds(leds, t); };
  return g; };

// ── ② 입대 정문 (사진 3) — 도로·나무블록 자동차 3 + 연못판 초록 LED + 모터 바퀴 ──
B['작품·입대 정문'] = () => { const g = new THREE.Group(); const leds = [];
  g.add(at(box(6.2, 0.3, 3.0, { fill: GRASS }), 0, 0.15, -1.4));   // 초록 판
  g.add(at(box(6.2, 0.05, 1.1, { fill: 'ink' }), 0, 0.32, -1.5));  // 검정 도로
  g.add(dashRoad([[-3.0, 0.36, -1.5], [3.0, 0.36, -1.5]]));        // 흰 점선
  [[-2.0, REDC, -1.05], [0.2, GRASS, -1.9], [2.1, BLUE, -1.0]].forEach(([cx, c, cz]) => {
    g.add(at(box(1.0, 0.5, 0.6, { fill: WOOD }), cx, 0.55, cz));   // 나무블록 자동차
    g.add(at(box(0.66, 0.03, 0.32, { fill: c }), cx, 0.81, cz));   // 위에 그린 차
  });
  g.add(at(box(4.4, 0.28, 2.8, { fill: WATER }), 0.2, 0.14, 1.5)); // 파란 연못 판
  const arcPts = [];
  for (let i = 0; i <= 18; i++) { const a = Math.PI * (0.12 + 0.76 * i / 18);
    arcPts.push([0.2 + Math.cos(a) * 1.75, 0.3, 1.65 - Math.sin(a) * 1.0]); }
  g.add(poly(arcPts, inkLine));
  g.add(at(box(1.15, 0.06, 0.5, { fill: YELLOW }), -0.15, 0.3, 1.9));   // 노란 「입대」 표지
  const main = mkLed(null, GRASS, 0.8, 0.46, 2.0, 0, 0, 0.23);          // 초록 LED = 대표
  g.add(main); g.userData.mainLed = main;
  const mot = dcMotor('side'); mot.position.set(-1.9, 0.28, 2.45); mot.rotation.y = -0.5; g.add(mot);
  const wheel = cyl(0.34, 0.34, 0.14, 10, { fill: 0x4c7d5a });
  wheel.rotation.z = Math.PI / 2; mot.userData.spin.add(wheel);        // 좌하 모터+바퀴
  g.add(toggle(2.3, 0.28, 2.6, 0.5));                                  // 우하 토글 스위치
  const candy = new THREE.Group(); candy.position.set(-2.6, 0.3, 0.4);
  candy.add(at(cyl(0.05, 0.05, 0.55, 5, { fill: WOOD }), 0, 0.27, 0));
  candy.add(at(cyl(0.5, 0.5, 0.07, 14), 0, 0.58, 0));
  const swirl = [];
  for (let i = 0; i <= 44; i++) { const a = i / 44 * Math.PI * 4, r = 0.06 + i / 44 * 0.4;
    swirl.push([Math.cos(a) * r, 0.63, Math.sin(a) * r]); }
  candy.add(poly(swirl, new THREE.LineBasicMaterial({ color: PINK })));
  g.add(candy);                                                        // 분홍 소용돌이 사탕
  [[-1.25, 0.3], [-0.45, 0.55], [1.35, 0.35]].forEach(([mx, mz]) => {  // 빨간 괴물 3
    const m = ico(0.26, { fill: REDC }); m.position.set(mx, 0.56, mz); g.add(m); });
  g.userData.motors = [mot.userData.spin]; g.userData.leds = leds;
  g.userData.tick = t => { mot.userData.spin.rotation.x = t / 110; tickLeds(leds, t); };
  return g; };

// ── ③ 개구리 연못 (r8 하단 연못 판) — 기둥 위 모터가 벌 큐브를 돌린다 + 흰 LED ──
B['작품·개구리 연못'] = () => { const g = new THREE.Group(); const leds = [];
  g.add(at(box(4.4, 0.3, 3.8, { fill: WATER }), -0.8, 0.15, 0.3));     // 파란 연못 판
  g.add(at(box(2.4, 0.3, 3.8, { fill: GRASS }), 2.6, 0.15, 0.3));      // 초록 잔디 판
  g.add(at(cyl(0.95, 0.95, 0.05, 14, { fill: GRASS }), -1.1, 0.32, 0.75)); // 연잎
  g.add(dotField([[-2.4, 0.33, -0.6], [-2.0, 0.33, 1.2], [-0.2, 0.33, 1.6],
                  [0.4, 0.33, -0.9], [-1.6, 0.33, -1.2]], PINK, 4));
  g.add(at(box(3.6, 2.5, 0.12, { fill: WOOD }), -0.9, 1.25, -1.75));   // 세운 그림판
  g.add(upright(at(cyl(0.85, 0.85, 0.06, 14, { fill: GRASS }), -0.9, 1.02, -1.66))); // 초록 개구리
  g.add(upright(at(cyl(0.26, 0.26, 0.06, 10, { fill: SKY }), -1.25, 1.6, -1.63)));
  g.add(upright(at(cyl(0.26, 0.26, 0.06, 10, { fill: SKY }), -0.55, 1.6, -1.63)));
  g.add(dotField([[-1.25, 1.6, -1.57], [-0.55, 1.6, -1.57]], INK, 5));
  g.add(at(box(1.3, 0.16, 0.06, { fill: YELLOW }), -0.9, 1.88, -1.66));    // 노란 왕관
  [-1.35, -0.9, -0.45].forEach(cx => g.add(at(box(0.2, 0.4, 0.06, { fill: YELLOW }), cx, 2.06, -1.66)));
  g.add(at(box(0.55, 3.3, 0.55, { fill: WOOD }), 1.6, 1.65, -1.1));    // 나무 기둥
  const mot = dcMotor('up'); mot.position.set(1.6, 3.3, -1.1); g.add(mot);
  const bee = new THREE.Group();                                        // 노랑·검정 벌 큐브
  bee.add(at(box(1.05, 0.8, 0.8, { fill: YELLOW }), 0, 0.42, 0));
  bee.add(at(box(1.07, 0.16, 0.82, { fill: 'ink' }), 0, 0.28, 0));
  bee.add(at(box(1.07, 0.16, 0.82, { fill: 'ink' }), 0, 0.58, 0));
  bee.add(at(box(1.5, 0.12, 1.05, { fill: SKY }), 0, 0.92, 0));
  mot.userData.spin.add(bee);
  const frog = new THREE.Group(); frog.position.set(-1.2, 0.3, 0.6);   // 검정 개구리 인형
  frog.add(at(box(0.9, 0.55, 0.7, { fill: 'ink' }), 0, 0.3, 0));
  frog.add(at(ico(0.34, { fill: 'ink' }), -0.1, 0.78, 0.05));
  frog.add(at(ico(0.2, { fill: REDC }), 0.42, 0.5, 0.22));             // 빨간 입·모자
  g.add(frog);
  g.add(dotField([[-1.5, 1.06, 0.9], [-1.18, 1.06, 0.88]], PAPER, 6));
  g.add(battBox(0.9, 0.48, 2.4, 0.25));                                // 배터리박스 2
  g.add(battBox(2.7, 0.48, -0.5, -0.4));
  g.add(mkLed(leds, 0xffffff, 0.15, 0.46, 1.85, 900, 0, 0.2));         // 흰 LED
  g.add(at(ico(0.24, { fill: YELLOW }), -0.3, 0.46, 1.55));            // 노란 오리
  const red = new THREE.Group(); red.position.set(3.0, 0.3, 1.2);
  red.add(at(ico(0.3, { fill: REDC }), 0, 0.32, 0));
  red.add(at(ico(0.22, { fill: REDC }), 0, 0.74, 0));
  g.add(red);
  g.userData.motors = [mot.userData.spin]; g.userData.leds = leds;
  g.userData.tick = t => { mot.userData.spin.rotation.y = t / 130; tickLeds(leds, t); };
  return g; };

// ── ④ 별빛 마당 (사진 2) — 검정 밤하늘 판 + 큐브 탑 + 주황 LED 1 ──
B['작품·별빛 마당'] = () => { const g = new THREE.Group();
  g.add(at(box(4.6, 0.3, 3.4, { fill: 'ink' }), 0, 0.15, 0));         // 검정 밤하늘 판
  const rnd = lcg(7); const sd = [], pd = [];
  for (let i = 0; i < 84; i++) {
    const p = [(rnd() - 0.5) * 4.3, 0.32, (rnd() - 0.5) * 3.1];
    (i % 3 ? pd : sd).push(p);
  }
  g.add(dotField(sd, YELLOW, 3.2));                                    // 노란 별가루
  g.add(dotField(pd, 0xdedad0, 2.4));                                  // 진주
  const stars = [];
  [[-1.5, -0.9], [0.3, 0.5], [1.5, -0.7], [-0.6, 1.0]].forEach(([sx, sz]) => {
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: YELLOW }));
    st.position.set(sx, 0.42, sz); g.add(st); stars.push(st);
  });
  const tower = new THREE.Group(); tower.position.set(1.55, 0.3, 1.35);
  [SKY, PINK, BLUE, YELLOW].forEach((c, i) =>
    tower.add(at(box(0.85, 0.7, 0.85, { fill: c }), 0, 0.35 + i * 0.7, 0)));
  g.add(tower);                                                        // 큐브 탑
  g.add(at(box(1.5, 0.8, 1.2, { fill: SILVER }), -1.85, 0.7, -1.25));  // 진주 은색 상자
  const pb = [];
  for (let i = 0; i < 20; i++) { const u = -0.72 + 1.44 * i / 19;
    pb.push([-1.85 + u, 1.11, -1.85], [-1.85 + u, 1.11, -0.65]); }
  g.add(dotField(pb, 0xf2eee4, 3));
  g.add(at(box(1.6, 0.5, 0.8, { fill: ORANGE }), -0.5, 0.55, 2.0));    // 주황 블록
  const main = mkLed(null, ORANGE, 0.34, 0.95, 1.92, 0, 0, 0.28);      // 주황 LED = 대표
  g.add(main); g.userData.mainLed = main;
  const peng = new THREE.Group(); peng.position.set(-1.5, 0.3, 2.15);  // 펭귄
  peng.add(at(ico(0.28, { fill: 'ink' }), 0, 0.3, 0));
  peng.add(at(ico(0.17, { fill: YELLOW }), 0.08, 0.62, 0.05));
  g.add(peng);
  const car = new THREE.Group(); car.position.set(2.15, 0.3, -1.45);   // 빨간 자동차
  car.add(at(box(0.8, 0.35, 0.5, { fill: REDC }), 0, 0.2, 0));
  car.add(at(box(0.4, 0.24, 0.42, { fill: BLUE }), -0.05, 0.46, 0));
  g.add(car);
  g.userData.tick = t => stars.forEach((s, i) => { s.rotation.y = t / 3400 + i; });
  return g; };

// ── ⑤ 상가 골목 (사진 6) — 알록달록 아파트 블록 + 나무 조형 빨간 LED ──
B['작품·상가 골목'] = () => { const g = new THREE.Group();
  g.add(at(box(5.6, 0.3, 3.2), 0, 0.15, 0));                           // 흰 판
  const blocks = [
    [-2.05, -0.55, 0.95, 2.2, 0.9, BLUE],
    [-0.85, 0.75, 0.85, 1.8, 0.8, REDC],
    [0.25, -0.85, 0.8, 1.25, 0.75, PINK],
    [-2.3, 1.05, 0.8, 1.05, 0.8, GRASS],
    [1.25, 0.85, 0.7, 1.5, 0.7, SILVER],
    [2.3, -0.7, 0.8, 1.15, 0.8, YELLOW],
  ];
  blocks.forEach(([bx, bz, bw, bh, bd, c]) => g.add(at(box(bw, bh, bd, { fill: c }), bx, 0.3 + bh / 2, bz)));
  const wins = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++)
    wins.push([-2.05 - 0.32 + c * 0.32, 0.7 + r * 0.42, -0.55 + 0.48]);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
    wins.push([-0.85 - 0.28 + c * 0.28, 0.8 + r * 0.4, 0.75 + 0.42]);
  g.add(dotField(wins, SKY, 3.6));                                     // 하늘색 창
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), new THREE.MeshBasicMaterial({ color: BLUE }));
  g.add(at(star, 1.25, 1.95, 0.85));                                   // 은색 블록 위 별
  const tree = new THREE.Group(); tree.position.set(1.85, 0.3, 1.05);  // 갈색 나무 조형
  tree.add(at(cyl(0.16, 0.24, 1.5, 7, { fill: 0x8a5a3b }), 0, 0.75, 0));
  tree.add(at(ico(0.42, { fill: 0x6b3a2a }), -0.08, 1.6, 0.08));
  tree.add(at(ico(0.28, { fill: GRASS }), 0.32, 1.48, -0.12));
  g.add(tree);
  const main = mkLed(null, REDC, 1.98, 2.45, 1.02, 0, 0, 0.3);         // 빨간 LED = 대표(수관 위)
  g.add(main); g.userData.mainLed = main;
  g.add(toggle(2.5, 0.3, -1.35, 0.5));                                 // 우상 토글 스위치
  g.add(wire([[2.5, 0.5, -1.3], [2.6, 0.42, -0.2], [2.4, 0.9, 0.7], [2.02, 2.35, 1.02]], 0x8f3a52));
  return g; };

// ── ⑥ 마을의 운동장 (r10 하단 두 판) — 축구장 2면 · 왼쪽 검정 그물 골대 / 오른쪽 원목 골대 ──
//   두 판 사이 이음매를 검정+노랑 도로 테이프 블록이 잇는다(실물 문법).
B['작품·마을의 운동장'] = () => { const g = new THREE.Group();
  const Y = 0.32;
  const tape = (bx, bz, br) => {                                      // 검정+노랑 도로 테이프
    g.add(at(box(1.05, 0.38, 0.62, { fill: 'ink' }), bx, 0.49, bz, br));
    g.add(at(box(0.5, 0.06, 0.15, { fill: YELLOW }), bx, 0.69, bz, br));
  };
  const pitch = (ox) => {                                             // 축구장 한 면(판 + 흰 라인)
    const p = new THREE.Group(); p.position.x = ox;
    p.add(at(box(5.6, 0.3, 4.2, { fill: GRASS }), 0, 0.15, 0));
    p.add(poly([[-2.6, Y, -1.85], [2.6, Y, -1.85], [2.6, Y, 1.85], [-2.6, Y, 1.85]], paperLine, true));
    p.add(poly([[0, Y, -1.85], [0, Y, 1.85]]));
    p.add(poly(Array.from({ length: 25 }, (_, i) => { const a = i / 24 * Math.PI * 2;
      return [Math.cos(a) * 0.66, Y, Math.sin(a) * 0.66]; }), paperLine, true));
    for (const sx of [-1, 1])
      p.add(poly([[sx * 2.6, Y, -0.9], [sx * 1.8, Y, -0.9], [sx * 1.8, Y, 0.9], [sx * 2.6, Y, 0.9]]));
    g.add(p); return p;
  };
  const netDots = (yb = 0.14, h = 0.72, w = 1.4) => {                 // 흰 그물(양면 점그물, 1 드로우콜)
    const n = [];
    for (let i = 0; i <= 5; i++) for (let j = 0; j <= 7; j++)
      n.push([0.085, yb + i * (h / 5), -w / 2 + j * (w / 7)], [-0.085, yb + i * (h / 5), -w / 2 + j * (w / 7)]);
    return dotField(n, PAPER, 2.6);
  };
  const goalBlack = (p, sx) => {                                      // 검정 골대
    const go = new THREE.Group(); go.position.set(sx * 2.72, 0.3, 0);
    go.add(at(box(0.14, 0.85, 1.5, { fill: 'ink' }), 0, 0.42, 0));
    go.add(netDots()); p.add(go);
  };
  const goalWood = (p, sx) => {                                       // 원목 프레임 골대
    const go = new THREE.Group(); go.position.set(sx * 2.72, 0.3, 0);
    go.add(at(box(0.16, 0.85, 1.5, { fill: WOOD }), 0, 0.42, 0));
    go.add(netDots()); p.add(go);
    p.add(at(box(0.22, 0.5, 1.3, { fill: WOOD }), sx * 2.2, 0.55, 0.15));  // 옆에 세운 널
  };
  // ── 왼쪽 판: 양끝 검정 그물 골대 + 흩뿌린 흰 종이 조각 ──
  const L = pitch(-3.0);
  goalBlack(L, -1); goalBlack(L, 1);
  const rnd = lcg(31); const scraps = [];
  for (let i = 0; i < 34; i++) scraps.push([(rnd() - 0.5) * 4.6, 0.36, (rnd() - 0.5) * 3.2]);
  L.add(dotField(scraps, PAPER, 4.6));
  L.add(at(ico(0.2, { fill: REDC }), 0, 0.5, 0));                     // 센터서클 빨간 공
  // ── 오른쪽 판: 원목 골대 + 검정 선수 · 축구공 · 흰 강아지 · 코너 깃발 · 벽돌 건물 ──
  const R = pitch(3.0);
  goalBlack(R, -1); goalWood(R, 1);
  [[-1.5, -1.25], [-0.55, 0.7], [0.35, -0.55], [1.05, 1.15], [1.7, -1.0], [0.15, 1.4]]
    .forEach(([px2, pz]) => { const f = ico(0.16, { fill: 'ink' }); f.position.set(px2, 0.47, pz); R.add(f); });
  R.add(at(ico(0.2), 1.35, 0.5, 0.55));                               // 축구공
  R.add(at(ico(0.22), 1.05, 0.48, 1.5));                              // 흰 강아지
  R.add(at(cyl(0.03, 0.03, 0.5, 5), 2.35, 0.55, 1.6));                // 코너 깃발(체크)
  R.add(at(box(0.32, 0.24, 0.03, { fill: REDC }), 2.19, 0.72, 1.6));
  R.add(at(box(0.95, 0.9, 0.8, { fill: WOOD }), 2.45, 0.75, -0.35));  // 벽돌 건물 블록
  const brick = [];
  for (let r = 0; r < 4; r++) for (let c2 = 0; c2 < 3; c2++)
    brick.push([2.45 - 0.3 + c2 * 0.3, 0.45 + r * 0.2, 0.07]);
  R.add(dotField(brick, INK, 3));
  R.add(at(ico(0.2, { fill: REDC }), 3.05, 0.62, -0.9));              // 빨강·파랑 인형
  R.add(at(ico(0.17, { fill: BLUE }), 3.05, 0.95, -0.9));
  // ── 두 판 이음매·바깥 테두리의 도로 테이프 블록 ──
  [[0, 1.95, 0], [0, -0.4, 0], [0, -2.3, 0], [-4.4, -2.35, 0], [-1.9, -2.35, 0.1], [5.5, -2.3, 0]]
    .forEach(([bx, bz, br]) => tape(bx, bz, br));
  g.add(at(box(1.5, 0.12, 0.35, { fill: WOOD }), -4.1, 0.37, -2.35)); // 원목 벤치
  return g; };

// ── ⑦ 야구장 (사진 10 좌하 · 9) — 갈색 흙 다이아몬드 + 흰 베이스 ──
B['작품·야구장'] = () => { const g = new THREE.Group();
  g.add(at(box(4.6, 0.3, 4.0, { fill: WOOD }), 0, 0.15, 0));
  g.add(at(cyl(1.95, 1.95, 0.05, 20, { fill: GRASS }), 0.15, 0.32, 0.1));
  g.add(at(cyl(1.45, 1.45, 0.05, 4, { fill: DIRT }), 0.15, 0.35, 0.1, Math.PI / 4));
  g.add(at(cyl(0.8, 0.8, 0.05, 4, { fill: GRASS }), 0.15, 0.38, 0.1, Math.PI / 4));
  [[0, -1.28], [1.28, 0], [0, 1.28], [-1.28, 0]].forEach(([bx, bz]) =>
    g.add(at(box(0.3, 0.06, 0.3), 0.15 + bx, 0.41, 0.1 + bz, Math.PI / 4)));
  g.add(poly([[0.15, 0.42, 1.4], [0.15 + 1.9, 0.42, 1.4 - 1.9]]));
  g.add(poly([[0.15, 0.42, 1.4], [0.15 - 1.9, 0.42, 1.4 - 1.9]]));
  g.add(at(ico(0.16, { fill: REDC }), 0.15, 0.45, 0.1));               // 타구
  g.add(at(box(0.9, 0.42, 0.6, { fill: 'ink' }), 1.85, 0.51, -1.6, 0.3));
  g.add(at(box(0.45, 0.06, 0.14, { fill: YELLOW }), 1.85, 0.73, -1.6, 0.3));
  return g; };

// ── ⑧ 연못 들판 (r5) — 꽃무늬 판 + 뻗은 막대 끝 곰 얼굴 판 = 신호등 LED 3(빨강·노랑·빨강 순차) ──
B['작품·연못 들판'] = () => { const g = new THREE.Group(); const leds = [];
  g.add(at(box(4.4, 0.3, 3.0, { fill: GRASS }), 0, 0.15, -0.6));       // 초록 꽃무늬 판
  const rnd = lcg(11); const f1 = [], f2 = [];
  for (let i = 0; i < 46; i++) { const p = [(rnd() - 0.5) * 4.1, 0.32, -0.6 + (rnd() - 0.5) * 2.7];
    (i % 2 ? f1 : f2).push(p); }
  g.add(dotField(f1, YELLOW, 3.4)); g.add(dotField(f2, PINK, 3.4));
  const mon = new THREE.Group(); mon.position.set(1.55, 0.3, -1.35);   // 빨간 괴물
  mon.add(at(ico(0.3, { fill: REDC }), 0, 0.34, 0));
  mon.add(at(ico(0.2, { fill: REDC }), 0, 0.74, 0));
  g.add(mon);
  g.add(at(ico(0.26, { fill: GRASS }), 0.95, 0.58, 0.15));             // 초록 개구리
  g.add(at(box(0.8, 0.3, 0.4, { fill: BLUE }), -1.5, 0.45, -0.75));    // 파란 인형
  g.add(at(box(1.0, 0.5, 0.7, { fill: YELLOW }), -0.1, 0.55, 0.5));    // 노란 블록
  g.add(at(box(0.42, 0.14, 2.3, { fill: WOOD }), -0.1, 0.6, 1.85));    // 뻗은 막대
  const face = new THREE.Group(); face.position.set(-0.1, 0.34, 3.0);
  face.rotation.x = -0.8;                                              // 위로 눕힌 곰 얼굴 판
  face.add(at(box(2.2, 2.2, 0.14, { fill: WOOD }), 0, 1.1, 0));
  face.add(upright(at(cyl(0.4, 0.4, 0.12, 10, { fill: WOOD }), -0.92, 2.1, 0)));
  face.add(upright(at(cyl(0.4, 0.4, 0.12, 10, { fill: WOOD }), 0.92, 2.1, 0)));
  face.add(at(box(1.95, 0.42, 0.06, { fill: SILVER }), 0, 1.62, 0.1));  // 회색 띠
  face.add(upright(at(cyl(0.75, 0.75, 0.06, 12, { fill: SKY }), 0, 0.72, 0.1))); // 파란 얼굴
  face.add(dotField([[-0.3, 1.12, 0.2], [0.3, 1.12, 0.2], [0, 0.92, 0.2]], INK, 6)); // 눈·코
  face.add(mkLed(leds, REDC, -0.66, 1.62, 0.2, 0, 0, 0.22));           // 빨강(좌)
  face.add(mkLed(leds, YELLOW, 0, 1.62, 0.2, 0, 0, 0.21));             // 노랑(중)
  face.add(mkLed(leds, REDC, 0.66, 1.62, 0.2, 0, 0, 0.21));            // 빨강(우)
  g.add(face);
  g.userData.leds = leds;
  // 신호등 순차 점등 — 빨강 → 노랑 → 빨강, 한 번에 하나만
  g.userData.tick = t => { const slot = Math.floor(t / 520) % 3;
    leds.forEach((L, i) => L.b.userData.mesh.material.color.set(i === slot ? L.color : PAPER)); };
  return g; };

// ── ⑨ 축운산 (r10 좌상 초록 언덕 보드) — 언덕·집 한 채·성묘객·반짝이 꽃. 정적 ──
B['작품·축운산'] = () => { const g = new THREE.Group();
  g.add(at(box(5.0, 0.3, 3.6, { fill: GRASS }), 0, 0.15, 0));          // 초록 판
  const hill = at(ico(1.75, { fill: 0x2f8f45 }), -0.5, 0.3, -0.3);     // 초록 흙 언덕
  hill.scale.set(1.15, 0.62, 1.0); g.add(hill);
  g.add(at(box(0.95, 0.8, 0.85, { fill: WOOD }), -0.35, 1.32, 0.15));  // 집 블록
  g.add(at(inked(prismGeo(1.15, 1.0, 0.4), { fill: REDC }), -0.35, 1.72, 0.15)); // 빨간 지붕
  g.add(at(box(0.8, 0.65, 0.7, { fill: WOOD }), -1.45, 1.05, 0.55));   // 나무 블록 2
  g.add(at(box(0.7, 0.55, 0.62, { fill: WOOD }), -0.6, 0.95, 0.9));
  const chk = [];                                                      // 체크무늬 블록
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++)
    if ((i + j) % 2 === 0) chk.push([-0.85 + i * 0.17, 1.05 + j * 0.16, 1.22]);
  g.add(dotField(chk, INK, 4));
  g.add(at(ico(0.34, { fill: 0x2f8f45 }), 1.05, 0.6, -0.15));          // 초록 나무
  g.add(at(ico(0.3, { fill: 0x2f8f45 }), 1.35, 0.5, 0.75));
  g.add(at(box(0.55, 0.35, 0.3, { fill: 0xf0b9ae }), -1.75, 0.9, -0.1)); // 분홍 손
  // 흰검 성묘객 인형 · 흰 조각돌
  [[-1.1, -1.05], [0.35, -1.15], [0.9, 0.35], [-1.9, 0.95], [0.15, 1.25], [1.6, -0.9]]
    .forEach(([fx, fz], i) => { const f = ico(0.14, { fill: i % 2 ? 'ink' : PAPER });
      f.position.set(fx, 0.52 + (i % 2) * 0.05, fz); g.add(f); });
  g.add(dotField([[0.55, 0.95, -0.55], [0.75, 0.9, -0.35], [0.62, 0.86, -0.15],
                  [-0.05, 0.62, 1.35], [0.25, 0.6, 1.5]], 0xbfe3ef, 4));  // 반짝이 꽃
  // 검정+노랑 도로 테이프 블록 3 (운동장 세트 공통 문법)
  [[-2.15, 1.5, 0.2], [1.35, 1.55, 0], [2.05, -1.35, 0.5]].forEach(([bx, bz, br]) => {
    g.add(at(box(1.0, 0.38, 0.6, { fill: 'ink' }), bx, 0.49, bz, br));
    g.add(at(box(0.5, 0.06, 0.15, { fill: YELLOW }), bx, 0.69, bz, br));
  });
  g.add(at(box(0.5, 0.32, 2.6, { fill: 'ink' }), -2.35, 0.46, -0.6));  // 검정 도로 띠
  return g; };

// ── ⑩ 카라스노 고교 (r2) — 주황 「카라스노(하이큐!!) 고교」 블록 + 주황 LED + 배구공 + 말풍선 ──
B['작품·카라스노 고교'] = () => { const g = new THREE.Group();
  g.add(at(box(5.4, 0.3, 3.8, { fill: WOOD }), 0, 0.15, 0));           // 원목 판
  // 주황 블록(교사) + 검정 글씨 줄
  g.add(at(box(2.1, 0.95, 1.15, { fill: ORANGE }), -0.75, 0.78, -1.0));
  g.add(at(box(1.55, 0.05, 0.1, { fill: 'ink' }), -0.75, 0.9, -0.42));
  g.add(at(box(1.35, 0.05, 0.1, { fill: 'ink' }), -0.8, 0.66, -0.42));
  const main = mkLed(null, YELLOW, -0.55, 0.6, -0.3, 0, 0, 0.26);      // 주황 LED = 대표(블록 앞면)
  g.add(main); g.userData.mainLed = main;
  // 펭귄(노란 모자) · 회색 돌 · 주황 열매
  const peng = new THREE.Group(); peng.position.set(-1.2, 1.26, -1.0);
  peng.add(at(ico(0.26, { fill: 'ink' }), 0, 0.24, 0));
  peng.add(at(ico(0.15, { fill: YELLOW }), 0, 0.55, 0));
  g.add(peng);
  const stone = at(ico(0.42, { fill: 0xb9b5ab }), 0.72, 1.4, -1.05);
  stone.scale.set(1.2, 0.75, 0.9); g.add(stone);
  g.add(at(ico(0.36, { fill: ORANGE }), -1.95, 0.62, -0.35));
  // 폼보드 말풍선 2 — 흰 판에 먹 글씨 획
  [[-1.05, 0.35, 0.35], [0.65, 0.25, -0.2]].forEach(([bx, bz, br], i) => {
    const bub = at(box(1.5, 0.1, 0.42), bx, 0.75, bz, br);
    bub.rotation.z = 0.16; g.add(bub);
    const sc = [];
    for (let k = 0; k < 7; k++) sc.push([bx - 0.55 + k * 0.18, 0.82, bz + (k % 2 ? 0.05 : -0.05)]);
    g.add(dotField(sc, INK, 3.4));
  });
  // 진주 테두리 검정 상자 + 노랑·파랑 배구공
  g.add(at(box(1.7, 0.55, 1.2, { fill: 'ink' }), 1.55, 0.58, 1.25));
  const pb = [];
  for (let i = 0; i < 16; i++) { const u = -0.78 + 1.56 * i / 15;
    pb.push([1.55 + u, 0.86, 0.68], [1.55 + u, 0.86, 1.82]); }
  g.add(dotField(pb, 0xf2eee4, 3));
  const ballG = new THREE.Group(); ballG.position.set(1.55, 1.05, 1.25);
  ballG.add(at(ico(0.3, { fill: YELLOW }), 0, 0.25, 0));
  ballG.add(at(box(0.16, 0.5, 0.5, { fill: BLUE }), 0.16, 0.25, 0));
  g.add(ballG);
  g.add(at(box(0.8, 0.35, 0.5, { fill: REDC }), -1.9, 0.48, 0.75));    // 빨간 자동차
  g.add(at(box(0.4, 0.22, 0.42, { fill: BLUE }), -1.95, 0.76, 0.75));
  g.add(at(ico(0.3, { fill: 0xb9b5ab }), 2.15, 0.48, -0.9));           // 회색 돌 하나 더
  g.add(wire([[-0.7, 1.3, -1.5], [-0.2, 2.0, -1.2], [0.5, 1.9, -0.8], [0.15, 0.75, -0.5]]));
  return g; };

// ── ⑪ 체리 가게 (r7) — 색종이 점 판 + 「체리」 회색 판 2 + 체리 블록·인형. 정적 ──
B['작품·체리 가게'] = () => { const g = new THREE.Group();
  g.add(at(box(4.6, 0.3, 3.4, { fill: WOOD }), 0, 0.15, 0));           // 원목 판
  const rnd = lcg(23); const cf = [[], [], []];
  for (let i = 0; i < 45; i++) cf[i % 3].push([(rnd() - 0.5) * 4.2, 0.32, (rnd() - 0.5) * 3.0]);
  g.add(dotField(cf[0], PINK, 3.4)); g.add(dotField(cf[1], YELLOW, 3.4));
  g.add(dotField(cf[2], SKY, 3.4));                                     // 색종이 점
  // 세로 나무 블록 2 — 빨간 체리 얼굴(눈)
  [[-0.55, -1.15], [0.5, -1.15]].forEach(([bx, bz], i) => {
    g.add(at(box(1.0, 1.9, 0.55, { fill: WOOD }), bx, 1.25, bz));
    g.add(at(upright(cyl(0.32, 0.32, 0.06, 12, { fill: REDC })), bx, 1.05, bz - 0.3));
    g.add(dotField([[bx, 1.1, bz - 0.35]], INK, 5));
    g.add(at(box(0.12, 0.55, 0.06, { fill: GRASS }), bx + (i ? -0.2 : 0.2), 1.9, bz - 0.3));
  });
  // 회색 「체리」 판 2 (빨간 글씨 = 붉은 점)
  [[-0.05, 0.15], [0.1, 0.95]].forEach(([sx, sz]) => {
    g.add(at(box(1.9, 0.14, 0.5, { fill: 0x55524d }), sx, 0.4, sz));
    g.add(dotField([[sx - 0.45, 0.5, sz], [sx - 0.25, 0.5, sz], [sx - 0.05, 0.5, sz],
                    [sx + 0.6, 0.5, sz], [sx + 0.75, 0.5, sz]], REDC, 4.2));
  });
  // 체리 무늬 초록 블록 2
  [[-1.7, -0.2], [1.6, -0.35]].forEach(([bx, bz]) => {
    g.add(at(box(0.85, 0.85, 0.8, { fill: WOOD }), bx, 0.72, bz));
    g.add(at(box(0.89, 0.1, 0.84, { fill: GRASS }), bx, 1.19, bz));
    g.add(dotField([[bx - 0.2, 0.9, bz + 0.42], [bx + 0.2, 0.75, bz + 0.42]], REDC, 4.5));
  });
  // 빨간 인형(팔 벌린 괴물) · 초록 체리 인형 · 꼭대기 체리
  const mon = new THREE.Group(); mon.position.set(-1.75, 0.3, 1.15);
  mon.add(at(ico(0.3, { fill: REDC }), 0, 0.34, 0));
  const armL = at(box(0.9, 0.16, 0.16, { fill: REDC }), -0.5, 0.28, 0.1); armL.rotation.z = 0.3;
  const armR = at(box(0.9, 0.16, 0.16, { fill: REDC }), 0.5, 0.28, 0.1); armR.rotation.z = -0.3;
  mon.add(armL, armR); g.add(mon);
  g.add(at(ico(0.22, { fill: GRASS }), 1.55, 1.42, -0.35));
  g.add(at(ico(0.16, { fill: REDC }), 1.72, 1.5, -0.2));
  g.add(at(ico(0.16, { fill: REDC }), -0.62, 2.35, -1.4));
  g.add(at(ico(0.16, { fill: REDC }), -0.42, 2.35, -1.4));
  return g; };


export const BUILDERS = B;
export const MODEL_NAMES = Object.keys(B);
