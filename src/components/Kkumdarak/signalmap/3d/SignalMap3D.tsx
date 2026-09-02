// @ts-nocheck
// ═══════════════════════════════════════════════════════════════════════
// SignalMap3D.tsx — 마을의 신호: 작은 부여 (3D 먹선 도시)
//   진입: /iso#signal-map-3d (2D판 #signal-map과 병존)
//   조작: 드래그 = 궤도 회전(도시를 돌려 본다) · 휠/핀치 = 줌
//         Shift+드래그 · 두 손가락 드래그 = 팬 · 버튼 = 시점 프리셋
//   신호 8 = 다색 LED 기둥, 클릭 → 카드(소개글 + 사진 갤러리, 콘텐츠는 2D scene.ts와 공유)
// ═══════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from 'framer-motion';
import { resetBoilers, boilTick, PAPER } from './ink3';
import { buildCity } from './buyeoCity';
import { SIGNALS, PLACES } from '../scene';
import { signalMapAPI } from '../../../../services/api';
import { imagekitAdminAPI } from '../../../../services/imagekitAdminApi';
import { useKkumdarakAuth } from '../../KkumdarakAuthContext';
import { ikUrl } from '../../../../utils/ikUrl';
import '../signalmap.css';
import './signalmap3d.css';

// 시점 프리셋 — 방위각(az)·고도각(el)
const VIEWS = {
  iso: { az: 0.72, el: 0.62, label: '조감' },
  top: { az: 0.72, el: 1.53, label: '평면도' },
  side: { az: 0.02, el: 0.07, label: '입면' },
};

const SignalMap3D: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const wrapRef = useRef(null);
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

  useEffect(() => { signalMapAPI.get().then(setOverrides); }, []);
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

  const selectView = useCallback((v) => { setView(v); apiRef.current?.toView(v); }, []);
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
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PAPER);
    resetBoilers();
    const { ticks, signals, places } = buildCity(scene);

    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 700);
    // 궤도 상태 — 목표값으로 부드럽게 수렴(스프링 없는 지수 추적)
    const st = { az: VIEWS.iso.az, el: VIEWS.iso.el, zoom: 1.25, cx: 0, cz: 0 };
    const target = { az: st.az, el: st.el, zoom: st.zoom, cx: 0, cz: 0 };
    const S0 = 72, R = 260;
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
      toView: (v) => { target.az = VIEWS[v].az; target.el = VIEWS[v].el; },
      addCustom: null, stopAdding: null,   // 컴포넌트 본문에서 채운다(오버라이드 상태 접근)
    };
    applyCam();

    // ── 조작: 드래그=궤도, Shift/두손가락=팬, 휠/핀치=줌 ──
    const ptrs = new Map();
    let pinch0 = 0, zoom0 = 1;
    const clampPan = () => {
      target.cx = Math.max(-95, Math.min(95, target.cx));
      target.cz = Math.max(-70, Math.min(70, target.cz));
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
      if (e.target.closest('.smap-card, .smap-btn, .smap-back, .s3d-views')) return;
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
        else {                                                    // 궤도 회전
          target.az -= dx * 0.0052;
          target.el = Math.max(0.06, Math.min(1.53, target.el + dy * 0.004));
          setView('custom');
        }
      } else if (ptrs.size === 2) {
        // 두 손가락: 핀치 줌 + 평균 이동 팬
        const pts = [...ptrs.values()];
        ptrs.set(e.pointerId, cur);
        const pts2 = [...ptrs.values()];
        const d1 = Math.hypot(pts2[0].x - pts2[1].x, pts2[0].y - pts2[1].y);
        if (pinch0) target.zoom = Math.max(0.7, Math.min(4.5, zoom0 * (d1 / pinch0)));
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
      target.zoom = Math.max(0.7, Math.min(4.5, target.zoom * Math.exp(-e.deltaY * 0.0014)));
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });

    const onResize = () => { renderer.setSize(el.clientWidth, el.clientHeight); applyCam(); };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    // ── 루프: 카메라 추적 + 보일 + 액터 + LED + 버튼 투영 ──
    let lastBoil = 0, lastDots = 0, raf = 0, running = true;
    const sigMeta = signals.map(sg => ({ ...sg, blink: (SIGNALS.find(s => s.id === sg.id)?.blink) || [800, 800] }));
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
            return { id: pl.id, x: (v3.x * 0.5 + 0.5) * W2, y: (-v3.y * 0.5 + 0.5) * H2, color: 0x1f1e1c, place: true };
          }),
          ...customRef.current.map(cm => {
            v3.copy(cm.pos).project(cam);
            return { id: cm.id, x: (v3.x * 0.5 + 0.5) * W2, y: (-v3.y * 0.5 + 0.5) * H2, color: 0x1f1e1c, place: true };
          }),
        ].filter(d => !hiddenRef.current.has(d.id)));
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
    <div className="smap s3d" ref={wrapRef}>
      <header className="smap-head">
        <h1>마을의 신호</h1>
      </header>
      <button className="smap-back" onClick={onBack}>← 이소 홈으로</button>
      <nav className="s3d-views">
        {Object.entries(VIEWS).map(([k, v]) => (
          <button key={k} className={view === k ? 'on' : ''} onClick={() => selectView(k)}>{v.label}</button>
        ))}
        {authed && (
          <button className={adding ? 'on' : ''} onClick={() => setAdding(a => !a)}>
            {adding ? '지도를 클릭해 위치 지정…' : '+ 마커 추가'}
          </button>
        )}
      </nav>
      {dots.map(d => (
        <button
          key={d.id}
          className={`smap-btn s3d-btn${d.place ? ' s3d-btn--place' : ''}${openId === d.id ? ' is-open' : ''}`}
          style={{ left: d.x, top: d.y, '--led': `#${d.color.toString(16).padStart(6, '0')}` } as React.CSSProperties}
          onClick={() => setOpenId(openId === d.id ? null : d.id)}
          aria-label={`${d.place ? '장소' : '신호'}: ${ALL.find(s => s.id === d.id)?.name}`}
        />
      ))}
      <footer className="smap-legend">
        <span className="smap-legend-dot" style={{ background: '#1f1e1c' }} /> 동그라미 = 신호·장소 — 누르면 소개와 사진
        <em>드래그로 도시를 돌려 보세요</em>
      </footer>
      {open && (
        <aside className="smap-card" role="dialog" aria-label={`${open.name} 소개`}>
          {/* 카드 머리 — 사진 갤러리로 카드가 길어져도 태그·제목·닫기가 상단에 붙어 있게(sticky) */}
          <div className="smap-card-head">
            <button className="smap-card-close" onClick={() => setOpenId(null)} aria-label="닫기">✕</button>
            <span className="smap-card-tag">{isPlace ? 'PLACE' : 'SIGNAL'} · {open.id.toUpperCase()}</span>
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
