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
  // 차단봉 — 피벗 개폐
  const post = at(box(0.16, 1, 0.16), 0.9, 0.5, 1.4); g.add(post);
  const arm = new THREE.Group(); arm.position.set(0.9, 0.95, 1.4);
  arm.add(at(box(2.1, 0.09, 0.09), -1.05, 0, 0));
  g.add(arm);
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
  g.userData.tick = t => {
    const cyc = (t % 6000) / 6000;                                // 열림→대기→닫힘
    const target = (cyc > 0.25 && cyc < 0.6) ? 1.15 : 0;
    arm.rotation.x += (target - arm.rotation.x) * 0.1;
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


export const BUILDERS = B;
export const MODEL_NAMES = Object.keys(B);
