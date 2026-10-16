// @ts-nocheck
// ═══════════════════════════════════════════════════════════════════════
// SignalMap3D.tsx — 부흥여지도 (3D 먹선 도시, 포스터 배치)
//   진입: nodetree.kr/buheung (독립 페이지, Buheung.tsx) · /iso#signal-map-3d (이소 안, onBack 있음)
//   조작: 드래그 = 궤도 회전(도시를 돌려 본다) · 휠/핀치 = 줌
//         Shift+드래그 · 두 손가락 드래그 = 팬 · 버튼 = 시점 프리셋 · 나침반 = 북쪽 위로 / 휴대폰 방향 따라가기
//   번호 원 39곳 = 포스터 범례 번호, 신호 11 = 아이들 작품 보드(LED). 누르면 카드(소개글 + 사진 갤러리)
// ═══════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from 'framer-motion';
import { resetBoilers, boilTick, PAPER } from './ink3';
import { buildCity } from './buyeoCity';
import { GEO } from './buyeoGeo';
import { SIGNALS, PLACES } from '../scene';
import { PLACES39 } from '../places39';
import { signalMapAPI } from '../../../../services/api';
import { imagekitAdminAPI } from '../../../../services/imagekitAdminApi';
import { useKkumdarakAuth } from '../../KkumdarakAuthContext';
import { ikUrl } from '../../../../utils/ikUrl';
import '../signalmap.css';
import './signalmap3d.css';

// 시점 프리셋 — 방위각(az)·고도각(el). az 0 = 북쪽(포스터 위)이 화면 위.
const VIEWS = {
  iso: { az: 0.16, el: 0.62, label: '비스듬히' },
  top: { az: 0, el: 1.53, label: '위에서' },
  side: { az: 0.02, el: 0.07, label: '옆에서' },
};
const PLACE_N = Object.fromEntries(PLACES39.map(p => [p.id, p.n]));
const PLACE_CAT = Object.fromEntries(PLACES39.map(p => [p.id, p.cat]));
// 각도를 (−π, π]로
const wrapPi = (a) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

type Props = {
  onBack?: () => void;          // 있으면 「← 이소 홈으로」(이소 안에서 열 때)
  title?: React.ReactNode;      // 왼쪽 위 제목 판(없으면 글자 제목)
  actions?: React.ReactNode;    // 오른쪽 위 버튼 줄 앞에 붙는 버튼(예: 이야기)
  openListSignal?: number;      // 값이 바뀌면 39곳 목록을 연다(이야기 패널의 「지도에서 39곳 보기」)
};

const SignalMap3D: React.FC<Props> = ({ onBack, title, actions, openListSignal }) => {
  const wrapRef = useRef(null);
  const needleRef = useRef(null);                     // 나침반 바늘 — 프레임마다 직접 돌린다(리렌더 없이)
  const headingRef = useRef(false);                   // 휴대폰 방향 따라가기 중인지(효과 안에서 읽는다)
  const [compass, setCompass] = useState('free');     // free | north | heading
  const [compassTip, setCompassTip] = useState('');
  const [touched, setTouched] = useState(false);      // 처음 만지면 안내 줄을 접는다
  const [tags, setTags] = useState([]);               // 지명 6(포스터 팻말)
  const [far, setFar] = useState(false);              // 멀리 볼 때(번호 원끼리 겹칠 만큼 작을 때) 번호 대신 작은 점
  const reduced = useReducedMotion();
  const [view, setView] = useState('iso');
  const [openId, setOpenId] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', story: '', makers: '', photos: [] });
  const [saving, setSaving] = useState(false);
  const { authed } = useKkumdarakAuth();
  const customs = useMemo(() => (overrides._custom || []), [overrides]);
  const ALL = useMemo(() => [...SIGNALS, ...PLACES, ...customs.map(c => ({ id: c.id, name: c.name, blink: [0, 1], draft: true }))], [customs]);
  const [adding, setAdding] = useState(false);
  const addingRef = useRef(false);
  useEffect(() => { addingRef.current = adding; }, [adding]);
  const customRef = useRef([]);
  const hiddenRef = useRef(new Set());
  useEffect(() => {
    customRef.current = (overrides._custom || []).map(c => ({ id: c.id, pos: new THREE.Vector3(c.pos[0], 6, c.pos[1]) }));
    hiddenRef.current = new Set(Object.keys(overrides).filter(k => k !== '_custom' && overrides[k] && overrides[k].hidden));
  }, [overrides]);
  // 정적 기본값 + 서버 오버라이드 병합 — 편집은 오버라이드만 만진다
  const open = useMemo(() => {
    const base = ALL.find(s => s.id === openId);
    if (!base) return null;
    return { ...base, ...(overrides[openId] || {}) };
  }, [ALL, openId, overrides]);
  const isPlace = useMemo(() => PLACES.some(pl => pl.id === openId), [openId]);
  const [dots, setDots] = useState([]);
  const apiRef = useRef(null);
  // ── 모바일 고르기: 겹친 동그라미 후보 말풍선 + 목록 서랍(좁은 화면 전용, 데스크톱 무변경) ──
  const [glFailed, setGlFailed] = useState(false);   // WebGL을 못 열면 안내로 대체
  const [pick, setPick] = useState(null);            // { x, y, ids[] } | null
  const [listOpen, setListOpen] = useState(false);
  const [listTab, setListTab] = useState('place');
  const PICK_R = 28;                                  // 이 거리(px) 안의 동그라미는 겹친 것으로 본다
  const isNarrow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;
  const nameOf = (id) => (overrides[id] && overrides[id].name) || ALL.find(s => s.id === id)?.name || id;
  // 누른 지점 기준: 히트 영역(44px)이 겹쳐 위 버튼이 가로채도 가장 가까운 동그라미가 열린다.
  //   좁은 화면에서 PICK_R 안에 둘 이상이면 카드 대신 후보 말풍선. 키보드(Enter)는 그 버튼 그대로.
  const onDot = (d, e) => {
    const r = wrapRef.current?.getBoundingClientRect();
    const kb = !e || !r || (e.clientX === 0 && e.clientY === 0);
    const px = kb ? d.x : e.clientX - r.left, py = kb ? d.y : e.clientY - r.top;
    const ranked = dots
      .map(o => ({ id: o.id, x: o.x, y: o.y, r: Math.hypot(o.x - px, o.y - py) }))
      .sort((a, b) => a.r - b.r);
    if (!kb && isNarrow()) {
      const near = ranked.filter(o => o.r < PICK_R);
      if (near.length > 1) { setOpenId(null); setPick({ x: near[0].x, y: near[0].y, ids: near.slice(0, 6).map(o => o.id) }); return; }
    }
    const id = kb ? d.id : (ranked[0] ? ranked[0].id : d.id);
    setPick(null);
    setOpenId(openId === id ? null : id);
  };
  const choose = (id, focus) => {
    setPick(null); setListOpen(false); setOpenId(id);
    if (focus) apiRef.current?.focus?.(id);
  };
  // 목록 — 장소는 포스터 범례 번호순으로 분류를 묶고, 군부대·추가 마커는 「그 밖」
  const placeGroups = useMemo(() => {
    const vis = (id) => !(overrides[id] && overrides[id].hidden);
    const groups = [];
    for (const p of PLACES39) {
      if (!vis(p.id)) continue;
      const g = groups[groups.length - 1];
      if (g && g.cat === p.cat) g.items.push(p); else groups.push({ cat: p.cat, items: [p] });
    }
    const etc = [...PLACES.filter(p => !PLACES39.some(q => q.id === p.id)), ...customs]
      .filter(p => vis(p.id)).map(p => ({ id: p.id, name: p.name }));
    if (etc.length) groups.push({ cat: '그 밖의 곳', items: etc });
    return groups;
  }, [overrides, customs]);

  useEffect(() => { signalMapAPI.get().then(setOverrides); }, []);
  useEffect(() => {
    if (!openListSignal) return;
    setPick(null); setOpenId(null); setListTab('place'); setListOpen(true);
  }, [openListSignal]);
  useEffect(() => {                                              // 카드 전환 시 편집 폼 리셋
    setEditing(false);
    if (open) setForm({ name: open.name || '', story: open.story || '', makers: open.makers || '', photos: open.photos || [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const [uploading, setUploading] = useState(null);   // 업로드 진행 문구('1/3 …') | null
  // 사진 다중 업로드 — 선택한 파일을 순차로 올려 form.photos 뒤에 붙인다
  const uploadPhotos = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const stamp = Date.now();
    const done = [];
    try {
      for (let i = 0; i < files.length; i += 1) {
        setUploading(`${i + 1}/${files.length}`);
        const file = files[i];
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const r = await imagekitAdminAPI.uploadFile(file, `${openId}-${stamp}-${i}.${ext}`, { folder: '/signal-map' });
        done.push(r.url);
      }
    } catch (e) {
      alert(e.message || '업로드 실패');
    } finally {
      if (done.length) setForm(f => ({ ...f, photos: [...f.photos, ...done] }));
      setUploading(null);
    }
  };
  const removePhoto = (i) => setForm(f => ({ ...f, photos: f.photos.filter((_, k) => k !== i) }));

  const saveOverrides = async (next) => {
    await signalMapAPI.save(next);
    setOverrides(next);
  };
  const deleteMarker = async () => {
    if (!openId) return;
    if (!window.confirm('이 마커를 지도에서 삭제할까요?')) return;
    try {
      const next = { ...overrides };
      if (customs.some(c => c.id === openId)) {
        next._custom = customs.filter(c => c.id !== openId);
      } else {
        next[openId] = { ...(next[openId] || {}), hidden: true };   // 기본 마커는 숨김 처리(복구 가능)
      }
      await saveOverrides(next);
      setOpenId(null);
    } catch (e) { alert(e.message || '삭제 실패'); }
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const entry = { ...(overrides[openId] || {}),
        story: form.story.trim(), makers: form.makers.trim() };
      delete entry.audio;                                     // 소리 기능 폐지 — 남은 키 정리
      if (form.name.trim()) entry.name = form.name.trim();   // 타이틀 오버라이드(비우면 기본 이름)
      else delete entry.name;
      const photos = form.photos.map(u => (u || '').trim()).filter(Boolean);
      if (photos.length) entry.photos = photos;
      else delete entry.photos;
      const next = { ...overrides, [openId]: entry };
      await signalMapAPI.save(next);
      setOverrides(next);
      setEditing(false);
    } catch (e) {
      alert(e.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const selectView = useCallback((v) => { setView(v); setCompass('free'); apiRef.current?.toView(v); }, []);

  // ── 나침반 ──
  //   한 번 누르면 북쪽(포스터 위)이 화면 위로. 이미 북쪽이면, 방위 센서가 있는 휴대폰에서는
  //   휴대폰이 향한 쪽이 화면 위가 되게 따라간다(다시 누르거나 손으로 돌리면 멈춤).
  //   iOS는 누를 때 권한을 물어야 하고(requestPermission), 안드로이드는 deviceorientationabsolute.
  const hasSensor = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
    && window.matchMedia('(pointer: coarse)').matches;
  const tipTimer = useRef(0);
  const tip = (t) => { setCompassTip(t); window.clearTimeout(tipTimer.current); tipTimer.current = window.setTimeout(() => setCompassTip(''), 2600); };
  const onCompass = async () => {
    const api = apiRef.current; if (!api) return;
    if (compass === 'heading') { headingRef.current = false; setCompass('north'); api.north(); return; }
    if (!api.isNorth() || !hasSensor) {
      api.north(); setCompass('north');
      if (hasSensor) tip('한 번 더 누르면 휴대폰 방향으로 돌아가요');
      return;
    }
    try {
      const D = window.DeviceOrientationEvent;
      if (D && typeof D.requestPermission === 'function' && (await D.requestPermission()) !== 'granted') {
        tip('방향 센서를 쓸 수 없어요'); return;
      }
    } catch (e) { tip('방향 센서를 쓸 수 없어요'); return; }
    headingRef.current = true; setCompass('heading'); tip('휴대폰이 향한 쪽이 위예요');
  };
  useEffect(() => {
    if (compass !== 'heading') return undefined;
    let got = false;
    const onOri = (e) => {
      if (!headingRef.current) return;
      let deg = null;
      if (typeof e.webkitCompassHeading === 'number') deg = e.webkitCompassHeading;           // iOS: 북에서 시계방향
      else if (e.absolute && typeof e.alpha === 'number') deg = 360 - e.alpha;                 // 안드로이드: 반시계 alpha
      if (deg == null) return;
      got = true;
      const scr = (window.screen?.orientation?.angle) || 0;                                     // 가로로 눕힌 화면 보정
      apiRef.current?.heading(((deg + scr) % 360) * Math.PI / 180);
    };
    const evt = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(evt, onOri);
    const t = window.setTimeout(() => { if (!got) { headingRef.current = false; setCompass('north'); tip('이 기기에서는 방향을 읽을 수 없어요'); } }, 2500);
    return () => { window.removeEventListener(evt, onOri); window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compass]);
  useEffect(() => {
    if (!apiRef.current) return;
    apiRef.current.addCustom = async (marker) => {
      try { await saveOverrides({ ...overrides, _custom: [...customs, marker] }); }
      catch (e) { alert(e.message || '마커 저장 실패'); }
    };
    apiRef.current.stopAdding = () => setAdding(false);
  });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // WebGL을 못 여는 기기(오래된 폰 · 컨텍스트 한도 · 저전력)에서 예외가 그대로 나가면 앱 전체가 흰 화면이 된다.
    //   → 잡아서 안내 + 평면 지도 링크로(머리글·뒤로 가기는 그대로 남는다).
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch (e) { setGlFailed(true); return undefined; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PAPER);
    resetBoilers();
    const { ticks, signals, places, fit } = buildCity(scene);

    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 700);
    const S0 = 72, R = 260, FIT_PAD = 40;
    //   FIT_PAD = fit 대상 점이 프레임에서 떨어질 최소 거리(px). dot은 점이 아니라 지름 18px 원 +
    //   반경 15px 헤일로다 — 요구치 24px를 헤일로 기준으로도 만족시키려면 40이 필요하다(실측).
    // 프리셋 뷰에서 도시(배치물 AABB + 마커 dot)가 화면축으로 갖는 최대 반경(월드).
    // 실제 지리판(2026-10-15)은 콘텐츠 중심이 원점이 아니다 → 배치물 AABB 가운데를 맞춤 중심으로.
    const FC = (() => { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
      for (const [x0, , z0, x1, , z1] of fit) { a = Math.min(a, x0); b = Math.max(b, x1); c = Math.min(c, z0); d = Math.max(d, z1); }
      return [(a + b) / 2, (c + d) / 2]; })();
    const fitRadius = (v) => {
      const { az, el: ev } = VIEWS[v] || VIEWS.iso;
      const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(ev), se = Math.sin(ev);
      let hx = 1, hy = 1;
      for (const [x0, y0, z0, x1, y1, z1] of fit) for (let i = 0; i < 8; i++) {
        const x = ((i & 1) ? x1 : x0) - FC[0], y = (i & 2) ? y1 : y0, z = ((i & 4) ? z1 : z0) - FC[1];
        const sx = x * ca - z * sa, sy = y * ce - se * (x * sa + z * ca);
        if (Math.abs(sx) > hx) hx = Math.abs(sx);
        if (Math.abs(sy) > hy) hy = Math.abs(sy);
      }
      return [hx, hy];
    };
    const clampZoom = (z) => Math.max(0.1, Math.min(4.5, z));
    // 도시 전체가 프레임에 들어오는 줌. 뷰포트 종횡비에 따라 폭 또는 높이가 기준이 된다.
    const fitZoom = (v) => {
      const [hx, hy] = fitRadius(v);
      const w = el.clientWidth || 1400, h = el.clientHeight || 900;
      return clampZoom(Math.min((w / 2 - FIT_PAD) / hx, (h / 2 - FIT_PAD) / hy) * S0 / (h / 2));
    };
    // 세로 화면 조감은 폭 기준 fit이면 도시가 손톱만 해진다(390×844에서 약 320×200).
    //   → 도시 투영 높이가 뷰포트의 PORTRAIT_H가 되는 줌을 하한으로 두고, 중앙 블록을 잡아
    //     나머지는 팬으로 탐색하게 한다. 가로 화면·평면도·입면은 손대지 않는다(fit 그대로).
    //   PORTRAIT_H 줌은 뷰포트 높이와 무관하다: zoom = PORTRAIT_H · S0 / hy.
    //   포스터 배치판(2026-10-16): 세로 첫 화면은 39곳의 무게중심(부여읍 쪽)을 반폭 PORTRAIT_HALF 월드로 —
    //   번호 원이 점으로 접히지 않는 가장 넓은 폭(px/월드 ≥ 4.3, 아래 far 판정).
    const PORTRAIT_HALF = 44;
    const CENTER = GEO.portraitCenter;
    const startCam = (v) => {
      const z = fitZoom(v);
      if (v !== 'iso' || el.clientWidth >= el.clientHeight) return { zoom: z, cx: FC[0], cz: FC[1] };
      const asp = el.clientWidth / el.clientHeight;
      const floor = clampZoom(S0 * asp / PORTRAIT_HALF);
      return floor > z ? { zoom: floor, cx: CENTER[0], cz: CENTER[1] } : { zoom: z, cx: FC[0], cz: FC[1] };
    };
    let userZoomed = false, preset = 'iso';        // 사용자가 줌을 만졌으면 리사이즈 refit 금지
    // 궤도 상태 — 목표값으로 부드럽게 수렴(스프링 없는 지수 추적)
    const cam0 = startCam('iso');
    const st = { az: VIEWS.iso.az, el: VIEWS.iso.el, zoom: cam0.zoom, cx: cam0.cx, cz: cam0.cz };
    const target = { az: st.az, el: st.el, zoom: st.zoom, cx: st.cx, cz: st.cz };
    const zoomMin = () => Math.min(0.7, fitZoom(preset));   // 세로 화면 fit 줌이 0.7보다 작아도 갇히지 않게
    const applyCam = () => {
      const ce = Math.cos(st.el), se = Math.sin(st.el);
      cam.position.set(
        st.cx + R * ce * Math.sin(st.az),
        R * se,
        st.cz + R * ce * Math.cos(st.az),
      );
      cam.up.set(0, 1, 0);
      cam.lookAt(st.cx, 0, st.cz);
      const asp = el.clientWidth / el.clientHeight;
      const S = S0 / st.zoom;
      cam.left = -S * asp; cam.right = S * asp; cam.top = S; cam.bottom = -S;
      cam.updateProjectionMatrix();
    };
    apiRef.current = {
      toView: (v) => { preset = v; freeFocus = false; headingRef.current = false; target.az = VIEWS[v].az; target.el = VIEWS[v].el;
        // 프리셋 버튼 = 프레이밍 리셋(줌 + 중심) — 확대·목록 이동 뒤 전체 지도로 돌아오는 길
        userZoomed = false;
        const c = startCam(v); target.zoom = c.zoom; target.cx = c.cx; target.cz = c.cz; },
      addCustom: null, stopAdding: null,   // 컴포넌트 본문에서 채운다(오버라이드 상태 접근)
      // 나침반: 북쪽(포스터 위)을 화면 위로 — 가까운 쪽으로 돈다
      north: () => { headingRef.current = false; target.az = target.az - wrapPi(target.az); clampPan(); },
      isNorth: () => Math.abs(wrapPi(st.az)) < 0.03,
      // 휴대폰이 향한 방위(라디안, 북에서 시계방향)를 화면 위로 — az = −heading
      heading: (h) => { target.az = target.az + wrapPi(-h - target.az); clampPan(); },
    };
    applyCam();

    // ── 조작: 드래그=궤도, Shift/두손가락=팬, 휠/핀치=줌 ──
    const ptrs = new Map();
    let pinch0 = 0, zoom0 = 1;
    // ── 팬 클램프: 콘텐츠가 화면에서 사라지지 않게 ──
    //   직교 카메라라 화면축을 지면(XZ)으로 정확히 역투영할 수 있다.
    //   화면 좌우 = 월드 XZ를 az만큼 돌린 u축, 화면 상하 = 같은 프레임의 w축(고도각 때문에 1/sin(el)로 늘어난다).
    //     u = x·cos az − z·sin az  (|u| ≤ S·asp)
    //     w = x·sin az + z·cos az  (|w| ≤ S/sin el)   ← 화면 y = −sin(el)·w 이므로
    //   허용 중심은 콘텐츠 상자를 (뷰포트 반범위 − PAN_M)만큼 안으로 줄인 상자.
    //   줄여서 뒤집히면(뷰포트가 콘텐츠보다 크면) 같은 두 수가 자리를 바꿔 '콘텐츠가 프레임 안에
    //   PAN_M 여백을 두고 다 들어오는' 범위가 된다 — 한 식으로 두 경우가 모두 처리된다.
    const PAN_M = 6;                                    // 콘텐츠 밖으로 허용할 여백(world)
    let panAz = NaN, panU = [0, 0], panW = [0, 0];      // az별 콘텐츠 회전 AABB 캐시(회전 중에만 재계산)
    const panX = [Infinity, -Infinity], panZ = [Infinity, -Infinity];   // 월드 XZ AABB(고정)
    for (const [x0, , z0, x1, , z1] of fit) {
      if (x0 < panX[0]) panX[0] = x0; if (x1 > panX[1]) panX[1] = x1;
      if (z0 < panZ[0]) panZ[0] = z0; if (z1 > panZ[1]) panZ[1] = z1;
    }
    const contentBox = (az) => {
      if (Math.abs(az - panAz) < 1e-4) return;
      panAz = az;
      const ca = Math.cos(az), sa = Math.sin(az);
      let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
      for (const [x0, , z0, x1, , z1] of fit) for (let i = 0; i < 4; i++) {
        const x = (i & 1) ? x1 : x0, z = (i & 2) ? z1 : z0;
        const u = x * ca - z * sa, w = x * sa + z * ca;
        if (u < u0) u0 = u; if (u > u1) u1 = u;
        if (w < w0) w0 = w; if (w > w1) w1 = w;
      }
      panU = [u0, u1]; panW = [w0, w1];
    };
    const span1 = (v, a0, a1, half) => {
      const lo = a0 + half - PAN_M, hi = a1 - half + PAN_M;
      return lo <= hi ? Math.max(lo, Math.min(hi, v))    // 뷰포트 < 콘텐츠 — 콘텐츠가 화면을 덮게
                      : Math.max(hi, Math.min(lo, v));   // 뷰포트 > 콘텐츠 — 콘텐츠가 화면 안에 다 들어오게
    };
    // 목록에서 고른 곳으로 옮길 때만 클램프를 잠깐 푼다(세로 화면은 ② XZ 클램프가 보수적이라
    //   가장자리 장소로 중심이 못 간다 — 실측). 다음 조작(드래그·휠·프리셋)에서 다시 걸리며 부드럽게 돌아온다.
    let freeFocus = false;
    const clampPan = () => {
      if (freeFocus) return;
      const az = target.az, ev = Math.max(0.06, target.el);
      contentBox(az);
      const S = S0 / target.zoom;
      const asp = (el.clientWidth || 1400) / (el.clientHeight || 900);
      const ca = Math.cos(az), sa = Math.sin(az);
      const hu = S * asp;
      // 화면 세로 반범위는 고도각이 낮을수록 1/sin(el)로 발산한다(지평선). 하지만 실제로 보이는
      // 거리는 카메라 깊이 범위(near .1 ~ far 700, 카메라 거리 R)가 먼저 자른다 —
      // 캡을 씌우지 않으면 입면 뷰에서 목표가 far 밖으로 밀려 화면이 빈다(실측으로 잡은 결함).
      const hw = Math.min(S / Math.sin(ev), R * 0.9);
      // ① 화면축(u,w)에서 클램프
      const u = span1(target.cx * ca - target.cz * sa, panU[0], panU[1], hu);
      const w = span1(target.cx * sa + target.cz * ca, panW[0], panW[1], hw);
      target.cx = u * ca + w * sa;                       // 역회전
      target.cz = -u * sa + w * ca;
      // ② 월드 XZ에서 한 번 더. ①만으로는 회전 AABB의 '모서리'(콘텐츠가 없는 대각 구석)로
      //    빠져나갈 수 있다 — 실측으로 잡은 결함(줌 4.5에서 대각 드래그 시 빈 화면).
      //    뷰포트 사각형의 XZ 방향 반범위 = |hu·cos az| + |hw·sin az| (그 반대도 동일).
      const hx = Math.abs(hu * ca) + Math.abs(hw * sa), hz = Math.abs(hu * sa) + Math.abs(hw * ca);
      target.cx = span1(target.cx, panX[0], panX[1], hx);
      target.cz = span1(target.cz, panZ[0], panZ[1], hz);
    };
    const panBy = (dx, dy) => {
      const S = S0 / target.zoom;
      const perPx = (S * 2) / el.clientHeight;
      const sa = Math.sin(target.az), ca = Math.cos(target.az);
      const fs = Math.max(0.25, Math.sin(target.el));            // 고도 낮을수록 세로 팬 증폭 제한
      target.cx -= (dx * ca - (dy / fs) * -sa) * perPx;
      target.cz -= (dx * -sa - (dy / fs) * -ca) * perPx;
      clampPan();
    };
    const down = (e) => {
      if (e.target.closest('.smap-card, .smap-btn, .smap-back, .s3d-views, .s3d-pick, [data-ui]')) return;
      setPick(null);                                              // 지도를 만지면 겹침 말풍선은 닫는다
      setTouched(true);
      freeFocus = false;
      downPt = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = target.zoom; }
    };
    const move = (e) => {
      const prev = ptrs.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      const dx = cur.x - prev.x, dy = cur.y - prev.y;
      if (ptrs.size === 1) {
        if (e.shiftKey) panBy(dx, dy);
        else {                                                    // 궤도 회전(손으로 돌리면 방향 따라가기는 끈다)
          if (headingRef.current) { headingRef.current = false; setCompass('free'); }
          target.az -= dx * 0.0052;
          target.el = Math.max(0.06, Math.min(1.53, target.el + dy * 0.004));
          clampPan();                                             // 시야가 돌면 허용 중심도 바뀐다
          setView('custom');
        }
      } else if (ptrs.size === 2) {
        // 두 손가락: 핀치 줌 + 평균 이동 팬
        const pts = [...ptrs.values()];
        ptrs.set(e.pointerId, cur);
        const pts2 = [...ptrs.values()];
        const d1 = Math.hypot(pts2[0].x - pts2[1].x, pts2[0].y - pts2[1].y);
        if (pinch0) { userZoomed = true; target.zoom = Math.max(zoomMin(), Math.min(4.5, zoom0 * (d1 / pinch0))); clampPan(); }
        const mx0 = (pts[0].x + pts[1].x) / 2, my0 = (pts[0].y + pts[1].y) / 2;
        const mx1 = (pts2[0].x + pts2[1].x) / 2, my1 = (pts2[0].y + pts2[1].y) / 2;
        panBy(mx1 - mx0, my1 - my0);
        return;
      }
      ptrs.set(e.pointerId, cur);
    };
    let downPt = null;
    const up = (e) => {
      // 마커 추가 모드: 드래그가 아니면 지면 좌표에 심는다
      if (addingRef.current && downPt && Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y) < 6) {
        const r = el.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
        const ny = -((e.clientY - r.top) / r.height) * 2 + 1;
        const p0 = new THREE.Vector3(nx, ny, -1).unproject(cam);
        const p1 = new THREE.Vector3(nx, ny, 1).unproject(cam);
        const dir = p1.sub(p0);
        const t = -p0.y / (dir.y || 1e-6);
        const gx = p0.x + dir.x * t, gz = p0.z + dir.z * t;
        const name = window.prompt('새 마커 이름');
        if (name && name.trim()) {
          const id = `custom-${Date.now().toString(36)}`;
          apiRef.current?.addCustom({ id, name: name.trim(), pos: [Math.round(gx * 10) / 10, Math.round(gz * 10) / 10] });
        }
        apiRef.current?.stopAdding();
      }
      ptrs.delete(e.pointerId); pinch0 = 0;
    };
    const wheel = (e) => {
      e.preventDefault();
      userZoomed = true;
      freeFocus = false;
      target.zoom = Math.max(zoomMin(), Math.min(4.5, target.zoom * Math.exp(-e.deltaY * 0.0014)));
      clampPan();                                                 // 줌이 바뀌면 뷰포트 반범위가 바뀐다 — 즉시 재클램프
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });

    const onResize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      if (!userZoomed) {                                         // 종횡비 바뀌면 다시 fit
        const c = startCam(preset);
        st.zoom = target.zoom = c.zoom; st.cx = target.cx = c.cx; st.cz = target.cz = c.cz;
      }
      applyCam();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    // ── 루프: 카메라 추적 + 보일 + 액터 + LED + 버튼 투영 ──
    let lastBoil = 0, lastDots = 0, raf = 0, running = true;
    const sigMeta = signals.map(sg => ({ ...sg, blink: (SIGNALS.find(s => s.id === sg.id)?.blink) || [800, 800] }));
    // 목록에서 고른 곳으로 카메라를 옮긴다 — 그 지면 점을 화면 가운데로, 줌은 최소 2.2배
    apiRef.current.focus = (id) => {
      const hit = sigMeta.find(s => s.id === id) || places.find(p => p.id === id) || customRef.current.find(c => c.id === id);
      if (!hit) return;
      userZoomed = true;
      target.zoom = Math.max(target.zoom, 2.2);
      // 좁은 화면은 카드가 아래를 덮는다 — 시선 중심을 카메라 쪽으로 당겨 고른 곳이 화면 위쪽에 오게
      const S = S0 / target.zoom, shift = isNarrow() ? 0.45 * S / Math.max(0.2, Math.sin(target.el)) : 0;
      target.cx = hit.pos.x + Math.sin(target.az) * shift;
      target.cz = hit.pos.z + Math.cos(target.az) * shift;
      freeFocus = true;
    };
    const v3 = new THREE.Vector3();
    const frame = (t) => {
      if (!running) return;
      // 카메라 지수 수렴(감쇠 0.16) — 프리셋 전환·드래그 모두 부드럽게
      let moved = false;
      for (const k of ['az', 'el', 'zoom', 'cx', 'cz']) {
        const d = target[k] - st[k];
        if (Math.abs(d) > 1e-4) { st[k] += d * 0.16; moved = true; }
      }
      if (moved) applyCam();
      // 나침반 바늘: 화면에서 북쪽은 위에서 시계방향으로 az만큼 돌아 있다
      if (needleRef.current) needleRef.current.style.transform = `rotate(${st.az}rad)`;
      if (!reduced) {
        if (t - lastBoil >= 100) { lastBoil = t; boilTick(); }
        for (const tick of ticks) tick(t);
      }
      for (const sg of sigMeta) {
        const [on, off] = sg.blink;
        sg.bulb.userData.mesh.material.color.set((t % (on + off)) < on ? sg.color : PAPER);
      }
      if (t - lastDots > 90) {
        lastDots = t;
        const W2 = el.clientWidth, H2 = el.clientHeight;
        setDots([
          ...sigMeta.map(sg => {
            v3.copy(sg.pos).project(cam);
            return { id: sg.id, x: (v3.x * 0.5 + 0.5) * W2, y: (-v3.y * 0.5 + 0.5) * H2, color: sg.color, place: false };
          }),
          ...places.map(pl => {
            v3.copy(pl.pos).project(cam);
            return { id: pl.id, x: (v3.x * 0.5 + 0.5) * W2, y: (-v3.y * 0.5 + 0.5) * H2, color: 0x1f1e1c, place: true, n: PLACE_N[pl.id] };
          }),
          ...customRef.current.map(cm => {
            v3.copy(cm.pos).project(cam);
            return { id: cm.id, x: (v3.x * 0.5 + 0.5) * W2, y: (-v3.y * 0.5 + 0.5) * H2, color: 0x1f1e1c, place: true };
          }),
        ].filter(d => !hiddenRef.current.has(d.id)));
        // 화면 1px당 월드 거리 → 이웃 장소(≈6 월드)가 번호 원(26px)보다 가까우면 점으로
        setFar(H2 * st.zoom / (2 * S0) < 4.3);
        setTags((GEO.labels || []).map(({ text, pos }) => {
          v3.set(pos[0], 0.4, pos[1]).project(cam);
          return { text, x: (v3.x * 0.5 + 0.5) * W2, y: (-v3.y * 0.5 + 0.5) * H2 };
        }));
      }
      renderer.render(scene, cam);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onVis = () => { if (document.hidden) { running = false; cancelAnimationFrame(raf); } else if (!running) { running = true; raf = requestAnimationFrame(frame); } };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      running = false; cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      renderer.dispose();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <div className={`smap s3d${far ? ' s3d--far' : ''}`} ref={wrapRef}>
      <div className="s3d-head" data-ui>
        {title || <h1 className="s3d-title">부흥여지도</h1>}
      </div>
      <div className="s3d-actions" data-ui>
        {onBack && <button className="s3d-act s3d-act--ghost" onClick={onBack}>← 이소 홈으로</button>}
        {actions}
        <button className={`s3d-act${listOpen ? ' on' : ''}`} aria-expanded={listOpen}
          onClick={() => { setPick(null); setOpenId(null); setListOpen(o => !o); }}>목록</button>
      </div>
      {glFailed && (
        <div className="s3d-nogl" role="alert" data-ui>
          <p>이 기기에서는 3D 지도를 열 수 없어요.</p>
          <button onClick={() => setListOpen(true)}>39곳 목록 보기</button>
        </div>
      )}
      <div className="s3d-dock" data-ui>
        <div className="s3d-compass-wrap">
          {compassTip && <span className="s3d-compass-tip" role="status">{compassTip}</span>}
          <button className={`s3d-compass${compass === 'heading' ? ' on' : ''}`} onClick={onCompass}
            aria-label={compass === 'heading' ? '휴대폰 방향 따라가기 끄기' : '북쪽을 위로'}
            title={compass === 'heading' ? '휴대폰 방향 따라가기 끄기' : '북쪽을 위로'}>
            <span className="s3d-needle" ref={needleRef} aria-hidden="true">
              <svg viewBox="0 0 40 40" width="40" height="40">
                <text x="20" y="8.6" textAnchor="middle" dominantBaseline="middle" fontSize="8.5" fontWeight="800" fill="currentColor">N</text>
                <path d="M20 13 L24.6 23 L15.4 23 Z" fill="currentColor" />
                <path d="M20 33 L24.6 23 L15.4 23 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        </div>
        <nav className="s3d-views" aria-label="보는 방향">
          {Object.entries(VIEWS).map(([k, v]) => (
            <button key={k} className={view === k ? 'on' : ''} aria-pressed={view === k} onClick={() => selectView(k)}>{v.label}</button>
          ))}
          {authed && (
            <button className={adding ? 'on' : ''} onClick={() => setAdding(a => !a)}>
              {adding ? '지도를 눌러 위치 지정…' : '+ 마커'}
            </button>
          )}
        </nav>
      </div>
      {tags.map(t => (
        <span key={t.text} className="s3d-tag" style={{ left: t.x, top: t.y }} aria-hidden="true">{t.text}</span>
      ))}
      {dots.map(d => (
        <button
          key={d.id}
          className={`smap-btn s3d-btn${d.place ? ' s3d-btn--place' : ''}${d.n ? ' s3d-btn--num' : ''}${openId === d.id ? ' is-open' : ''}`}
          style={{ left: d.x, top: d.y, '--led': `#${d.color.toString(16).padStart(6, '0')}` } as React.CSSProperties}
          onClick={(e) => onDot(d, e)}
          aria-label={`${d.n ? `${d.n}번 ` : ''}${d.place ? '장소' : '신호'}: ${nameOf(d.id)}`}
        >{d.n ? <span className="s3d-num" aria-hidden="true">{d.n}</span> : null}</button>
      ))}
      {pick && (() => {
        const W2 = wrapRef.current?.clientWidth || 390;
        const below = pick.y < 230;                            // 위가 좁으면 손가락 아래로
        const left = Math.max(96, Math.min(W2 - 96, pick.x));
        return (
          <div className={`s3d-pick${below ? ' s3d-pick--below' : ''}`} style={{ left, top: pick.y }} role="menu"
            aria-label="겹친 동그라미 고르기">
            {pick.ids.map(id => (
              <button key={id} role="menuitem" onClick={() => choose(id, false)}>{nameOf(id)}</button>
            ))}
          </div>
        );
      })()}
      {listOpen && (
        <aside className="smap-card s3d-list" role="dialog" aria-label="신호·장소 목록">
          <div className="smap-card-head">
            <button className="smap-card-close" onClick={() => setListOpen(false)} aria-label="닫기">✕</button>
            <div className="s3d-list-tabs" role="tablist">
              <button role="tab" aria-selected={listTab === 'place'} className={listTab === 'place' ? 'on' : ''}
                onClick={() => setListTab('place')}>자주 가는 곳 {PLACES39.filter(p => !(overrides[p.id] && overrides[p.id].hidden)).length}</button>
              <button role="tab" aria-selected={listTab === 'signal'} className={listTab === 'signal' ? 'on' : ''}
                onClick={() => setListTab('signal')}>우리가 만든 신호 {SIGNALS.filter(s => !(overrides[s.id] && overrides[s.id].hidden)).length}</button>
            </div>
          </div>
          {listTab === 'place' ? placeGroups.map(g => (
            <section key={g.cat}>
              <h3>{g.cat}</h3>
              <ul>
                {g.items.map(p => (
                  <li key={p.id}><button onClick={() => choose(p.id, true)}>
                    {p.n ? <span className="s3d-list-n">{p.n}</span> : null}{nameOf(p.id)}
                  </button></li>
                ))}
              </ul>
            </section>
          )) : (
            <ul>
              {SIGNALS.filter(s => !(overrides[s.id] && overrides[s.id].hidden)).map(s => (
                <li key={s.id}><button onClick={() => choose(s.id, true)}>{nameOf(s.id)}</button></li>
              ))}
            </ul>
          )}
        </aside>
      )}
      <footer className={`s3d-hint${touched || openId || listOpen ? ' is-off' : ''}`} aria-hidden={touched}>
        번호를 누르면 소개와 사진이 열려요 <em>끌어서 돌려 보세요</em>
      </footer>
      {open && (
        <aside className="smap-card" role="dialog" aria-label={`${open.name} 소개`}>
          {/* 카드 머리 — 사진 갤러리로 카드가 길어져도 태그·제목·닫기가 상단에 붙어 있게(sticky) */}
          <div className="smap-card-head">
            <button className="smap-card-close" onClick={() => setOpenId(null)} aria-label="닫기">✕</button>
            <span className="smap-card-tag">
              {PLACE_N[open.id] ? `${PLACE_N[open.id]} · ${PLACE_CAT[open.id]}` : isPlace ? '장소' : '우리가 만든 신호'}
            </span>
            <h2>{open.name}</h2>
          </div>
          {open.photos?.length ? (
            <div className={`smap-gallery${open.photos.length > 1 ? ' smap-gallery--stack' : ''}`}>
              {open.photos.map((src, i) => (
                <img key={`${src}-${i}`} src={ikUrl(src, { w: 900, q: 80 })} loading="lazy"
                  alt={`${open.name} 작품 사진 ${i + 1}`} />
              ))}
            </div>
          ) : null}
          {open.makers && <p className="smap-card-makers">만든 사람 · {open.makers}</p>}
          {open.story
            ? <p className="smap-card-story">{open.story}</p>
            : <p className="smap-card-draft">이 신호의 이야기와 사진은 프로그램이 끝나는 대로 채워집니다.</p>}
          {authed && !editing && (
            <div className="smap-edit-row" style={{ marginTop: 14 }}>
              <button className="smap-edit-btn" style={{ margin: 0 }} onClick={() => setEditing(true)}>소개·사진 편집</button>
              <button className="smap-edit-btn smap-edit-btn--danger" onClick={deleteMarker}>마커 삭제</button>
            </div>
          )}
          {authed && editing && (
            <div className="smap-edit">
              <label>이름(타이틀)
                <input value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </label>
              <label>소개글
                <textarea value={form.story} rows={4}
                  onChange={e => setForm(f => ({ ...f, story: e.target.value }))} />
              </label>
              <label>만든 사람
                <input value={form.makers}
                  onChange={e => setForm(f => ({ ...f, makers: e.target.value }))} />
              </label>
              <label>사진 (여러 장 선택 가능) {uploading ? `— 업로드 중 ${uploading}…` : ''}
                <input type="file" accept="image/*" multiple disabled={!!uploading}
                  onChange={e => { uploadPhotos(e.target.files); e.target.value = ''; }} />
              </label>
              {form.photos.length > 0 && (
                <ul className="smap-edit-thumbs">
                  {form.photos.map((src, i) => (
                    <li key={`${src}-${i}`}>
                      <img className="smap-edit-thumb" src={ikUrl(src, { w: 400, q: 70 })}
                        alt={`업로드된 사진 ${i + 1} 미리보기`} />
                      <button type="button" className="smap-thumb-x" onClick={() => removePhoto(i)}
                        aria-label={`사진 ${i + 1} 제거`}>✕</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="smap-edit-row">
                <button onClick={saveEdit} disabled={saving || !!uploading}>{saving ? '저장 중…' : '저장'}</button>
                <button onClick={() => setEditing(false)} disabled={saving}>취소</button>
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
};

export default SignalMap3D;
