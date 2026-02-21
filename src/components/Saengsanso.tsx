import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { saengsansoAPI as _ssoAPI } from '../services/api';
import Login from './Login';

// API 타입 캐스팅
const saengsansoAPI = _ssoAPI as Record<string, {
  getAll: (opts?: any) => Promise<any>;
  create: (data: any) => Promise<any>;
  update: (id: string, data: any) => Promise<any>;
  delete: (id: string) => Promise<any>;
  reorder: (orders: any[]) => Promise<any>;
}>;

// ─── 미학관 정확한 디자인 토큰 ───
const C = {
  accent: '#00FFB3',
  red: '#FF0000',
  cyan: '#00FFD8',
  black: '#000000',
  dark: '#212121',
  white: '#ffffff',
  gray65: 'rgba(0,0,0,0.65)',
};

const TEXT_BASE: React.CSSProperties = {
  fontSize: '20px', fontWeight: 700,
  fontFamily: "Verdana, 'Noto Sans Korean', 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif",
  lineHeight: '32px', color: C.black, margin: 0,
};
const TEXT_SM: React.CSSProperties = { ...TEXT_BASE, fontSize: '14px', lineHeight: '24px' };
const TEXT_XS: React.CSSProperties = { ...TEXT_BASE, fontSize: '12px', lineHeight: '20px' };

// ─── 하드코딩 fallback 데이터 ───
const FALLBACK_EXHIBITIONS = [
  { year: '2025', date: '2025.11.28.-12.07.', title: '유기적공명: 에디아포닉 Organic Resonance: Ediaphonic', venue: 'CN갤러리, 서울', note: '' },
  { year: '2024', date: '2024', title: "위성악보 시리즈 '국경'", venue: '신동엽문학관, 부여', note: '' },
  { year: '2024', date: '2024', title: '고도 주민의 삶과 기억전', venue: '백제역사문화연구원, 부여', note: '' },
  { year: '2023', date: '2023', title: '금강아카이브: 멀고도 가까운', venue: '무대륙, 서울', note: '' },
  { year: '2023', date: '2023', title: '아르코 공공미술 프로젝트', venue: '', note: '' },
  { year: '2023', date: '2023', title: '문화가있는날 금강워킹', venue: '서울, 부여, 강경, 서천', note: '지역문화진흥원' },
  { year: '2021', date: '2021', title: "위성악보 시리즈 'KARMA'", venue: '부소갤러리, 부여', note: '' },
];

const FALLBACK_PROJECTS = [
  { category: 'SOUNDSCAPE', date: '2017-현재', title: '사운드스케이프 프로젝트', detail: '부여 지역 자연/도시 환경 소리 채집 및 아카이빙' },
  { category: 'SOUNDSCAPE', date: '2021-2023', title: '도시기록프로젝트 소리탐사조', detail: '서울 기반 도시 사운드 리서치' },
  { category: 'SOUNDSCAPE', date: '2025', title: '중고제 소리길 사운드스케이프', detail: '충남 내포 지역 중고제 소리길 채집 및 기록' },
  { category: 'RESIDENCY', date: '2025-2026', title: '충남창작스튜디오 2기 입주', detail: '뉴미디어 부문 선정 (115:8 경쟁률)' },
  { category: 'WORKSHOP & COMMUNITY', date: '2025.09.20.', title: '비단가람 무브먼트 에코-플로깅', detail: '큐클리프 × 인디언모터사이클 × 생산소 협업 — 백마강, 부여' },
  { category: 'WORKSHOP & COMMUNITY', date: '2023.06.16.', title: '《블록파티》 전시공간 토크', detail: '아마도예술공간, 서울 — "축구와, 배드민턴과, (대안)예술은"' },
  { category: 'WORKSHOP & COMMUNITY', date: '2021', title: '민간레지던시 프로젝트', detail: '히스테리안(강정아) 기획 — 대안적 거주와 공간 리서치' },
  { category: 'AWARD', date: '2020', title: '소달구지 Sodalguji', detail: '일본 미디어아트 페스티벌 심사위원 추천작 선정' },
];

const FALLBACK_NEWS: any[] = [
  { date: '2026.01.29', title: "이화영 작가 '리커넥트:낙원식당(樂源識䣊)' 개인전 개최 — 충남창작스튜디오", source: '굿모닝충청', category: 'press', url: 'https://www.goodmorningcc.com/news/articleView.html?idxno=439259' },
  { date: '2025.11.28', title: "노드 트리 '유기적공명: 에디아포닉' — CN갤러리, 서울", source: 'artlecture', category: 'press' },
  { date: '2024.09.26', title: '도민과 문화예술로 소통... 충남창작스튜디오 입주작가 8인 선정', source: '충청투데이', category: 'press', url: 'https://www.cctoday.co.kr/news/articleView.html?idxno=2201676' },
  { date: '2026.02', title: '생산소 홈페이지 오픈', source: '생산소', category: 'notice' },
  { date: '2025.04', title: '충남창작스튜디오 2기 입주 시작 (2025.04 – 2026.03)', source: '생산소', category: 'notice' },
  { date: '2024', title: '생산소 부여 공간 운영 안내', source: '생산소', category: 'notice' },
];

const FALLBACK_ARCHIVES = [
  { title: '유기적공명: 에디아포닉', year: '2025', bg: 'linear-gradient(135deg, #2a1a2e, #1a1a3e)' },
  { title: '위성악보: 국경', year: '2024', bg: 'linear-gradient(135deg, #1a2a2a, #0d1f2f)' },
  { title: '고도 주민의 삶과 기억', year: '2024', bg: 'linear-gradient(135deg, #2a2a1a, #1f1f0d)' },
  { title: '금강아카이브', year: '2023', bg: 'linear-gradient(135deg, #0d2a1f, #1a3a2a)' },
  { title: '위성악보: KARMA', year: '2021', bg: 'linear-gradient(135deg, #2a1a1a, #3a1a1a)' },
  { title: '소달구지 Sodalguji', year: '2020', bg: 'linear-gradient(135deg, #1a1a2e, #2e1a2e)' },
];

// ─── 슬라이드 데이터 ───
const SLIDES = [
  { bg: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)', caption: '생산소 — 부여 기반 대안예술공간' },
  { bg: 'linear-gradient(135deg, #0d1f1f 0%, #1a2a2a 50%, #0d1f1f 100%)', caption: '유기적공명: 에디아포닉 Organic Resonance: Ediaphonic' },
  { bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)', caption: '위성악보 시리즈 — Satellite Score Series' },
  { bg: 'linear-gradient(135deg, #2d1b2e 0%, #1a1a2e 50%, #2d1b2e 100%)', caption: '리커넥트: 낙원식당 Reconnect: Nakwon Restaurant' },
  { bg: 'linear-gradient(135deg, #1a2a1a 0%, #2a3a2a 50%, #1a2a1a 100%)', caption: '금강아카이브: 멀고도 가까운' },
];

// ─── 네비게이션 ───
interface SubMenuItem { label: string; page?: string }
interface MenuItem { label: string; page: string; sub?: SubMenuItem[] }

const MENU_ITEMS: MenuItem[] = [
  { label: 'MAIN', page: 'MAIN' },
  { label: 'ABOUT', page: 'ABOUT' },
  { label: 'EXHIBITIONS', page: 'EXHIBITIONS' },
  { label: 'PROJECTS', page: 'PROJECTS' },
  {
    label: 'NEWS', page: 'NEWS',
    sub: [
      { label: '- 공지사항', page: 'NEWS_NOTICE' },
      { label: '- 언론보도', page: 'NEWS_PRESS' },
    ]
  },
  { label: 'ARCHIVE', page: 'ARCHIVE' },
];

// ─── 공통 컴포넌트 ───
function RedLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ ...TEXT_BASE, background: C.red, color: C.black, padding: '0 4px', display: 'inline' }}>
      {children}
    </span>
  );
}

// ─── 관리 버튼 ───
const btnStyle: React.CSSProperties = {
  background: 'none', border: `1px solid ${C.dark}`, padding: '2px 8px',
  fontSize: '11px', cursor: 'pointer', fontWeight: 700, marginLeft: '6px',
};
const addBtnStyle: React.CSSProperties = {
  ...btnStyle, background: C.accent, color: C.black, border: 'none',
  padding: '4px 14px', fontSize: '12px', marginTop: '12px',
};

// ─── 인라인 폼 스타일 ───
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: '14px', fontFamily: 'inherit',
  border: `1px solid #ccc`, marginBottom: '6px', boxSizing: 'border-box',
};
const selectStyle: React.CSSProperties = { ...inputStyle, background: '#fff' };
const formBtnStyle: React.CSSProperties = {
  padding: '4px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
  border: 'none', marginRight: '6px',
};

// ─── 인라인 편집 폼 ───
function InlineForm({ fields, initial, onSave, onCancel }: {
  fields: { key: string; label: string; type?: 'text' | 'select'; options?: string[] }[];
  initial: Record<string, string>;
  onSave: (data: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(initial);

  return (
    <div style={{ background: '#f9f9f9', padding: '12px', margin: '8px 0', border: '1px solid #ddd' }}>
      {fields.map(f => (
        <div key={f.key} style={{ marginBottom: '4px' }}>
          <label style={{ ...TEXT_XS, display: 'block', marginBottom: '2px' }}>{f.label}</label>
          {f.type === 'select' ? (
            <select style={selectStyle} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}>
              <option value="">선택</option>
              {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input style={inputStyle} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
        <button style={{ ...formBtnStyle, background: C.accent }} onClick={() => onSave(form)}>저장</button>
        <button style={{ ...formBtnStyle, background: '#ddd' }} onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}

// ─── 페이지: MAIN ───
function PageMain({ goToSlide, currentSlide }: { goToSlide: (i: number) => void; currentSlide: number }) {
  return (
    <div style={{ flex: 1, position: 'relative', marginTop: '4px', overflow: 'hidden' }}>
      <AnimatePresence initial={false}>
        <motion.div
          key={currentSlide}
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: 'absolute', inset: 0, background: SLIDES[currentSlide].bg,
            backgroundSize: 'cover', backgroundPosition: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.5 }}
            style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)', fontWeight: 300, letterSpacing: '0.12em', textAlign: 'center', margin: 0 }}>
            {SLIDES[currentSlide].caption}
          </motion.p>
        </motion.div>
      </AnimatePresence>
      <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', zIndex: 10 }}>
        {SLIDES.map((_, i) => (
          <button key={i} onClick={() => goToSlide(i)} style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: i === currentSlide ? C.accent : 'rgba(255,255,255,0.3)',
            border: 'none', cursor: 'pointer', padding: 0, transition: 'background 0.3s',
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── 페이지: ABOUT ───
function PageAbout() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
      <div style={{ display: 'flex', gap: '68px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 500px', minWidth: '300px' }}>
          <p style={TEXT_BASE}>생산소 生産所</p>
          <p style={TEXT_BASE}>SAENGSANSO</p>
          <p style={TEXT_BASE}>Alternative Art Space</p>
          <p style={TEXT_BASE}>Buyeo, Chungcheongnam-do</p>
          <br />
          <p style={TEXT_BASE}>생산소는 충남 부여에 위치한 대안예술공간입니다.</p>
          <p style={TEXT_BASE}>2020년 서울을 떠나 부여에 정착한 NODE TREE(이화영+정강현)가</p>
          <p style={TEXT_BASE}>운영하며, 사라져가는 지역 문화를 미시사(微視史)와</p>
          <p style={TEXT_BASE}>구술사(口述史)의 방법론으로 기록하고,</p>
          <p style={TEXT_BASE}>사운드스케이프, 레지던시, 워크숍, 전시 등</p>
          <p style={TEXT_BASE}>다양한 문화예술 활동을 기획·실행합니다.</p>
          <br />
          <p style={TEXT_BASE}>saengsanso@gmail.com</p>
          <p style={TEXT_BASE}>Instagram @saengsanso</p>
          <br />
          <p style={TEXT_BASE}>충남 부여군</p>
          <p style={TEXT_BASE}>Buyeo-gun, Chungcheongnam-do, Korea</p>
          <br />
          <p style={{ ...TEXT_SM, color: C.cyan }}>* 방문은 사전 연락 후 가능합니다</p>
          <br />
          <div style={{
            width: '100%', maxWidth: '660px', height: '284px',
            background: `linear-gradient(135deg, ${C.dark} 0%, #333 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px', letterSpacing: '0.1em' }}>MAP — 부여</span>
          </div>
          <br />
          <p style={{ ...TEXT_XS, color: C.gray65 }}>website by NODE TREE</p>
        </div>
        <div style={{ flex: '0 0 242px', minWidth: '200px' }}>
          <p style={TEXT_BASE}>Space Inquiry</p>
          <br />
          <button style={{ ...TEXT_XS, background: C.red, color: C.black, border: 'none', padding: '4px 16px', cursor: 'pointer', fontWeight: 700 }}>문의하기</button>
          <br /><br /><br />
          <p style={TEXT_BASE}>Operated by.</p>
          <br />
          <button style={{ ...TEXT_XS, background: C.red, color: C.black, border: 'none', padding: '4px 16px', cursor: 'pointer', fontWeight: 700 }}>이화영 Lee Hwayoung</button>
          <br /><br />
          <button style={{ ...TEXT_XS, background: C.red, color: C.black, border: 'none', padding: '4px 16px', cursor: 'pointer', fontWeight: 700 }}>정강현 Jung Kanghyun</button>
          <br /><br /><br />
          <p style={TEXT_BASE}>생산소의 소식을</p>
          <p style={TEXT_BASE}>메일로 보내드립니다.</p>
          <br />
          <p style={{ ...TEXT_SM, color: C.gray65 }}>Subscribe to our newsletter</p>
          <br />
          <button style={{ ...TEXT_XS, background: C.red, color: C.black, border: 'none', padding: '4px 16px', cursor: 'pointer', fontWeight: 700 }}>Subscribe</button>
        </div>
      </div>
    </div>
  );
}

// ─── 페이지: EXHIBITIONS (DB 연동) ───
function PageExhibitions({ exhibitions, isAdmin, onAdd, onEdit, onDelete }: {
  exhibitions: any[];
  isAdmin: boolean;
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
}) {
  // year별 그룹핑
  const grouped: Record<string, any[]> = {};
  exhibitions.forEach(ex => {
    const y = ex.year || 'N/A';
    if (!grouped[y]) grouped[y] = [];
    grouped[y].push(ex);
  });

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: '0 0 196px', minWidth: '140px' }}>
          <p style={TEXT_BASE}>ONSITE</p>
        </div>
        <div style={{ flex: 1 }}>
          {Object.entries(grouped)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([year, items]) => (
              <div key={year} style={{ marginBottom: '32px' }}>
                <p style={{ ...TEXT_BASE, marginBottom: '8px' }}><RedLabel>{year}</RedLabel></p>
                {items.map((item: any, i: number) => (
                  <p key={item._id || i} style={{ ...TEXT_BASE, cursor: 'pointer' }}>
                    {item.date} {item.title}{item.venue ? ` — ${item.venue}` : ''}
                    {item.note && <span style={{ ...TEXT_SM, color: C.cyan, display: 'block' }}>* {item.note}</span>}
                    {isAdmin && (
                      <>
                        <button style={btnStyle} onClick={() => onEdit(item)}>수정</button>
                        <button style={{ ...btnStyle, color: C.red }} onClick={() => onDelete(item._id)}>삭제</button>
                      </>
                    )}
                  </p>
                ))}
              </div>
            ))}
          {isAdmin && <button style={addBtnStyle} onClick={onAdd}>+ 전시 추가</button>}
        </div>
      </div>
    </div>
  );
}

// ─── 페이지: PROJECTS (DB 연동) ───
function PageProjects({ projects, isAdmin, onAdd, onEdit, onDelete }: {
  projects: any[];
  isAdmin: boolean;
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
}) {
  const categories = ['SOUNDSCAPE', 'RESIDENCY', 'WORKSHOP & COMMUNITY', 'AWARD'];
  const grouped: Record<string, any[]> = {};
  categories.forEach(c => { grouped[c] = []; });
  projects.forEach(p => {
    if (grouped[p.category]) grouped[p.category].push(p);
  });

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: '0 0 196px', minWidth: '140px' }}><p style={TEXT_BASE}>PROGRAM</p></div>
        <div style={{ flex: 1 }}>
          {categories.map(cat => (
            <div key={cat} style={{ marginBottom: '32px' }}>
              <p style={{ ...TEXT_BASE, marginBottom: '8px' }}><RedLabel>{cat}</RedLabel></p>
              {grouped[cat].map((item: any, i: number) => (
                <div key={item._id || i} style={{ marginBottom: '4px' }}>
                  <p style={TEXT_BASE}>
                    {item.date} {item.title}
                    {isAdmin && (
                      <>
                        <button style={btnStyle} onClick={() => onEdit(item)}>수정</button>
                        <button style={{ ...btnStyle, color: C.red }} onClick={() => onDelete(item._id)}>삭제</button>
                      </>
                    )}
                  </p>
                  <p style={{ ...TEXT_SM, color: C.gray65 }}>{item.detail}</p>
                </div>
              ))}
            </div>
          ))}
          {isAdmin && <button style={addBtnStyle} onClick={onAdd}>+ 프로젝트 추가</button>}
        </div>
      </div>
    </div>
  );
}

// ─── 페이지: NEWS (DB 연동) ───
function PageNews({ filter, news, isAdmin, onAdd, onEdit, onDelete }: {
  filter?: 'notice' | 'press';
  news: any[];
  isAdmin: boolean;
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'all' | 'notice' | 'press'>(
    filter === 'notice' ? 'notice' : filter === 'press' ? 'press' : 'all'
  );

  useEffect(() => {
    if (filter === 'notice') setActiveTab('notice');
    else if (filter === 'press') setActiveTab('press');
  }, [filter]);

  const filteredNews = activeTab === 'all' ? news : news.filter((n: any) => n.category === activeTab);

  const tabs: { key: 'all' | 'notice' | 'press'; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'notice', label: '공지사항' },
    { key: 'press', label: '언론보도' },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
      <div style={{ display: 'flex', gap: '0', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <span key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            ...TEXT_BASE, fontSize: '17px', padding: '6px 16px', cursor: 'pointer',
            background: activeTab === tab.key ? C.red : 'transparent',
            color: activeTab === tab.key ? C.white : C.dark, transition: 'all 0.2s',
          }}>
            {tab.label}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.dark}`, paddingBottom: '8px', marginBottom: '4px' }}>
        <span style={{ ...TEXT_SM, flex: '0 0 100px' }}>날짜</span>
        <span style={{ ...TEXT_SM, flex: 1 }}>제목</span>
        <span style={{ ...TEXT_SM, flex: '0 0 120px', textAlign: 'right' }}>출처</span>
        {isAdmin && <span style={{ ...TEXT_SM, flex: '0 0 80px', textAlign: 'right' }}>관리</span>}
      </div>
      {filteredNews.map((item: any, i: number) => (
        <div key={item._id || i} style={{
          display: 'flex', padding: '10px 0', borderBottom: '1px solid #e7e7e7',
          cursor: item.url ? 'pointer' : 'default', transition: 'background 0.2s',
        }}
          onClick={() => !isAdmin && item.url && window.open(item.url, '_blank', 'noopener,noreferrer')}
          onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ ...TEXT_SM, flex: '0 0 100px', color: C.gray65 }}>{item.date}</span>
          <span style={{ ...TEXT_BASE, flex: 1 }}>
            {item.title}
            {item.url && <span style={{ ...TEXT_XS, color: C.cyan, marginLeft: '6px' }}>↗</span>}
          </span>
          <span style={{ ...TEXT_XS, flex: '0 0 120px', textAlign: 'right', color: C.gray65, alignSelf: 'center' }}>{item.source}</span>
          {isAdmin && (
            <span style={{ flex: '0 0 80px', textAlign: 'right' }}>
              <button style={btnStyle} onClick={e => { e.stopPropagation(); onEdit(item); }}>수정</button>
              <button style={{ ...btnStyle, color: C.red }} onClick={e => { e.stopPropagation(); onDelete(item._id); }}>삭제</button>
            </span>
          )}
        </div>
      ))}
      {isAdmin && <button style={addBtnStyle} onClick={onAdd}>+ 뉴스 추가</button>}
    </div>
  );
}

// ─── 페이지: ARCHIVE (DB 연동) ───
function PageArchive({ archives, isAdmin, onAdd, onEdit, onDelete }: {
  archives: any[];
  isAdmin: boolean;
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {archives.map((item: any, i: number) => (
          <div key={item._id || i} style={{
            background: item.bg || 'linear-gradient(135deg, #1a1a2e, #2e1a2e)',
            aspectRatio: '546 / 683', display: 'flex', flexDirection: 'column',
            justifyContent: 'flex-end', padding: '24px', cursor: 'pointer', transition: 'opacity 0.3s',
            position: 'relative',
          }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            {item.image && (
              <img src={item.image} alt={item.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            <p style={{ color: C.accent, fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', margin: '0 0 6px 0', position: 'relative', zIndex: 1 }}>
              {item.year}
            </p>
            <p style={{ color: C.white, fontSize: '16px', fontWeight: 700, margin: 0, lineHeight: '24px', position: 'relative', zIndex: 1 }}>
              {item.title}
            </p>
            {isAdmin && (
              <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 2 }}>
                <button style={{ ...btnStyle, background: 'rgba(255,255,255,0.8)' }} onClick={e => { e.stopPropagation(); onEdit(item); }}>수정</button>
                <button style={{ ...btnStyle, background: 'rgba(255,255,255,0.8)', color: C.red }} onClick={e => { e.stopPropagation(); onDelete(item._id); }}>삭제</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {isAdmin && <button style={addBtnStyle} onClick={onAdd}>+ 아카이브 추가</button>}
    </div>
  );
}


// ═══════════════════════════════════════════
// ─── 메인 앱 ───
// ═══════════════════════════════════════════
function SaengsansoApp() {
  const { isAuthenticated, logout, user } = useAuth();
  const isAdmin = isAuthenticated;

  const [currentPage, setCurrentPage] = useState('MAIN');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // DB 데이터
  const [exhibitions, setExhibitions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [archives, setArchives] = useState<any[]>([]);

  // 편집 상태
  const [editMode, setEditMode] = useState<{ type: string; item: any | null } | null>(null);

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      const [exRes, prRes, nwRes, arRes] = await Promise.all([
        saengsansoAPI.exhibitions.getAll().catch(() => null),
        saengsansoAPI.projects.getAll().catch(() => null),
        saengsansoAPI.news.getAll().catch(() => null),
        saengsansoAPI.archive.getAll().catch(() => null),
      ]);
      setExhibitions(exRes?.success && exRes.data.length > 0 ? exRes.data : FALLBACK_EXHIBITIONS);
      setProjects(prRes?.success && prRes.data.length > 0 ? prRes.data : FALLBACK_PROJECTS);
      setNews(nwRes?.success && nwRes.data.length > 0 ? nwRes.data : FALLBACK_NEWS);
      setArchives(arRes?.success && arRes.data.length > 0 ? arRes.data : FALLBACK_ARCHIVES);
    } catch {
      setExhibitions(FALLBACK_EXHIBITIONS);
      setProjects(FALLBACK_PROJECTS);
      setNews(FALLBACK_NEWS);
      setArchives(FALLBACK_ARCHIVES);
    }
  }, []);

  useEffect(() => {
    document.title = '생산소 SAENGSANSO';
    const style = document.createElement('style');
    style.textContent = `html, body { margin: 0; padding: 0; height: 100%; } * { box-sizing: border-box; }`;
    document.head.appendChild(style);
    loadData();
    return () => {
      document.head.removeChild(style);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [loadData]);

  useEffect(() => {
    document.documentElement.style.overflow = currentPage === 'MAIN' ? 'hidden' : 'auto';
    document.body.style.overflow = currentPage === 'MAIN' ? 'hidden' : 'auto';
  }, [currentPage]);

  useEffect(() => {
    if (currentPage !== 'MAIN') return;
    const timer = setInterval(() => setCurrentSlide(prev => (prev + 1) % SLIDES.length), 5000);
    return () => clearInterval(timer);
  }, [currentPage]);

  const goToSlide = useCallback((i: number) => setCurrentSlide(i), []);

  const handleNav = (page: string) => {
    if (page === 'LOGIN') { setShowLogin(true); return; }
    setCurrentPage(page);
    setMobileMenuOpen(false);
    setActiveDropdown(null);
    setEditMode(null);
  };

  // ─── CRUD 핸들러 ───
  const handleSave = async (type: string, data: Record<string, string>, id?: string) => {
    try {
      const api = (saengsansoAPI as any)[type];
      if (id) {
        await api.update(id, data);
      } else {
        await api.create(data);
      }
      setEditMode(null);
      await loadData();
    } catch (err: any) {
      alert(`저장 실패: ${err.message}`);
    }
  };

  const handleDelete = async (type: string, id: string) => {
    if (!id || !window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await (saengsansoAPI as any)[type].delete(id);
      await loadData();
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // 편집 폼 필드 정의
  const FIELDS: Record<string, { key: string; label: string; type?: 'text' | 'select'; options?: string[] }[]> = {
    exhibitions: [
      { key: 'year', label: '연도' },
      { key: 'date', label: '날짜' },
      { key: 'title', label: '제목' },
      { key: 'venue', label: '장소' },
      { key: 'note', label: '비고' },
    ],
    projects: [
      { key: 'category', label: '카테고리', type: 'select', options: ['SOUNDSCAPE', 'RESIDENCY', 'WORKSHOP & COMMUNITY', 'AWARD'] },
      { key: 'date', label: '날짜' },
      { key: 'title', label: '제목' },
      { key: 'detail', label: '상세' },
    ],
    news: [
      { key: 'date', label: '날짜' },
      { key: 'title', label: '제목' },
      { key: 'source', label: '출처' },
      { key: 'category', label: '분류', type: 'select', options: ['notice', 'press'] },
      { key: 'url', label: 'URL' },
    ],
    archive: [
      { key: 'title', label: '제목' },
      { key: 'year', label: '연도' },
      { key: 'bg', label: '배경(CSS)' },
      { key: 'image', label: '이미지 URL' },
    ],
  };

  const isMain = currentPage === 'MAIN';

  const renderPage = () => {
    // 편집 폼이 열려 있으면 표시
    const renderEditForm = (type: string) => {
      if (editMode && editMode.type === type) {
        const initial: Record<string, string> = {};
        FIELDS[type].forEach(f => { initial[f.key] = editMode.item?.[f.key] || ''; });
        return (
          <InlineForm
            fields={FIELDS[type]}
            initial={initial}
            onSave={(data) => handleSave(type, data, editMode.item?._id)}
            onCancel={() => setEditMode(null)}
          />
        );
      }
      return null;
    };

    switch (currentPage) {
      case 'MAIN': return <PageMain goToSlide={goToSlide} currentSlide={currentSlide} />;
      case 'ABOUT': return <PageAbout />;
      case 'EXHIBITIONS': return (
        <>
          <PageExhibitions
            exhibitions={exhibitions}
            isAdmin={isAdmin}
            onAdd={() => setEditMode({ type: 'exhibitions', item: null })}
            onEdit={(item) => setEditMode({ type: 'exhibitions', item })}
            onDelete={(id) => handleDelete('exhibitions', id)}
          />
          {renderEditForm('exhibitions')}
        </>
      );
      case 'PROJECTS': return (
        <>
          <PageProjects
            projects={projects}
            isAdmin={isAdmin}
            onAdd={() => setEditMode({ type: 'projects', item: null })}
            onEdit={(item) => setEditMode({ type: 'projects', item })}
            onDelete={(id) => handleDelete('projects', id)}
          />
          {renderEditForm('projects')}
        </>
      );
      case 'NEWS':
      case 'NEWS_NOTICE':
      case 'NEWS_PRESS':
        return (
          <>
            <PageNews
              filter={currentPage === 'NEWS_NOTICE' ? 'notice' : currentPage === 'NEWS_PRESS' ? 'press' : undefined}
              news={news}
              isAdmin={isAdmin}
              onAdd={() => setEditMode({ type: 'news', item: null })}
              onEdit={(item) => setEditMode({ type: 'news', item })}
              onDelete={(id) => handleDelete('news', id)}
            />
            {renderEditForm('news')}
          </>
        );
      case 'ARCHIVE': return (
        <>
          <PageArchive
            archives={archives}
            isAdmin={isAdmin}
            onAdd={() => setEditMode({ type: 'archive', item: null })}
            onEdit={(item) => setEditMode({ type: 'archive', item })}
            onDelete={(id) => handleDelete('archive', id)}
          />
          {renderEditForm('archive')}
        </>
      );
      default: return <PageMain goToSlide={goToSlide} currentSlide={currentSlide} />;
    }
  };

  // 로그인 페이지
  if (showLogin) {
    return <Login onClose={() => setShowLogin(false)} />;
  }

  return (
    <div style={{
      fontFamily: "Verdana, 'Noto Sans Korean', 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif",
      width: '100vw', height: '100vh', overflow: isMain ? 'hidden' : 'auto',
      background: C.white, display: 'flex', flexDirection: 'column',
    }}>
      {/* ─── 타이틀 행 ─── */}
      <div style={{ background: isMain ? 'transparent' : C.black, padding: '0 15px', flexShrink: 0, transition: 'background 0.3s' }}>
        <div style={{ paddingTop: '18px', paddingBottom: '8px', margin: 0, lineHeight: '32px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          onClick={() => handleNav('MAIN')}>
          <p style={{ margin: 0, padding: 0, fontSize: '20px', lineHeight: '32px' }}>
            <span style={{ fontSize: '48px', fontWeight: 700, fontFamily: "Verdana, 'Noto Sans Korean', 'Apple SD Gothic Neo', sans-serif", color: C.accent, lineHeight: '32px' }}>
              생산소 生産所 SAENGSANSO
            </span>
          </p>
        </div>
        {/* 로그인/로그아웃 */}
        <div style={{ textAlign: 'right', paddingBottom: '4px' }}>
          {!isAuthenticated ? (
            <span
              onClick={(e) => { e.stopPropagation(); setShowLogin(true); }}
              style={{ ...TEXT_XS, color: isMain ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.4)', cursor: 'pointer', textDecoration: 'none' }}
            >
              로그인
            </span>
          ) : (
            <span style={{ ...TEXT_XS, color: isMain ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.6)' }}>
              {user?.username}님{' '}
              <span onClick={logout} style={{ cursor: 'pointer', textDecoration: 'underline' }}>로그아웃</span>
            </span>
          )}
        </div>
      </div>

      {/* ─── 네비게이션 행 ─── */}
      <div style={{ background: C.white, padding: '0 15px', flexShrink: 0 }}>
        <nav className="sso-desktop-nav"
          style={{ display: 'flex', alignItems: 'center', margin: 0, padding: 0, position: 'relative', zIndex: 100, flexShrink: 0 }}
          onMouseLeave={() => setActiveDropdown(null)}
        >
          {MENU_ITEMS.map((item, idx) => {
            const isActive = currentPage === item.page || (item.page === 'NEWS' && currentPage.startsWith('NEWS'));
            return (
              <div key={item.label} style={{ position: 'relative', display: 'inline-block' }}
                onMouseEnter={() => item.sub ? setActiveDropdown(idx) : setActiveDropdown(null)}>
                <span onClick={() => handleNav(item.page)} style={{
                  display: 'table-cell', padding: '0 10px', height: '34px', lineHeight: '34px',
                  fontSize: '17px', fontWeight: 700,
                  fontFamily: "'Noto Sans Korean', 'Noto Sans KR', sans-serif",
                  textTransform: 'uppercase' as const, letterSpacing: 'normal',
                  cursor: 'pointer', whiteSpace: 'nowrap' as const, verticalAlign: 'middle',
                  color: C.dark,
                  borderBottom: isActive ? `2px solid ${C.accent}` : '2px solid transparent',
                  transition: 'border-color 0.3s, color 0.3s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderBottomColor = C.accent; e.currentTarget.style.color = C.accent; }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderBottomColor = isActive ? C.accent : 'transparent';
                    e.currentTarget.style.color = C.dark;
                  }}
                >
                  {item.label}
                </span>
                {item.sub && activeDropdown === idx && (
                  <div style={{
                    position: 'absolute', top: '34px', left: 0, background: '#fff',
                    minWidth: '200px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 200, padding: '8px 0',
                  }}>
                    {item.sub.map(sub => (
                      <div key={sub.label} style={{
                        padding: '10px 20px', color: C.dark, fontSize: '13px', fontWeight: 400, cursor: 'pointer', transition: 'background 0.2s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.color = C.black; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.dark; }}
                        onClick={() => handleNav(sub.page || item.page)}
                      >
                        {sub.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <button className="sso-mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', marginLeft: 'auto' }}>
            <div style={{ width: '22px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ display: 'block', height: '2px', width: '22px', background: C.dark, transition: 'all 0.3s', transform: mobileMenuOpen ? 'rotate(45deg) translate(2px, 5px)' : 'none' }} />
              <span style={{ display: 'block', height: '2px', width: '22px', background: C.dark, transition: 'all 0.3s', opacity: mobileMenuOpen ? 0 : 1 }} />
              <span style={{ display: 'block', height: '2px', width: '22px', background: C.dark, transition: 'all 0.3s', transform: mobileMenuOpen ? 'rotate(-45deg) translate(2px, -5px)' : 'none' }} />
            </div>
          </button>
        </nav>
      </div>

      {/* 모바일 메뉴 */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{ position: 'fixed', top: '120px', left: 0, right: 0, bottom: 0, background: '#fff', zIndex: 90, padding: '20px', overflowY: 'auto' }}
          >
            {MENU_ITEMS.map(item => (
              <div key={item.label} style={{ borderBottom: '1px solid #eee' }}>
                <div onClick={() => handleNav(item.page)} style={{
                  padding: '16px 0', fontSize: '17px', fontWeight: 700,
                  textTransform: 'uppercase' as const, color: C.dark, cursor: 'pointer',
                }}>
                  {item.label}
                </div>
                {item.sub && (
                  <div style={{ paddingBottom: '12px' }}>
                    {item.sub.map(sub => (
                      <div key={sub.label} style={{ padding: '8px 0 8px 16px', fontSize: '13px', color: '#666', cursor: 'pointer' }}
                        onClick={() => handleNav(sub.page || item.page)}>
                        {sub.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── 콘텐츠 영역 ─── */}
      <main style={{
        width: '100%', padding: '0 15px', flex: 1, display: 'flex', flexDirection: 'column',
        position: 'relative', minHeight: isMain ? 'calc(100vh - 100px)' : 'auto',
      }}>
        {renderPage()}
      </main>

      {/* ─── 푸터 ─── */}
      {currentPage !== 'MAIN' && currentPage !== 'ARCHIVE' && (
        <footer style={{
          padding: '20px 15px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', gap: '8px',
        }}>
          <span style={{ ...TEXT_XS, color: C.gray65 }}>
            Copyright (c) {new Date().getFullYear()} 생산소 SAENGSANSO All rights reserved.
          </span>
          <a href="https://instagram.com/saengsanso" target="_blank" rel="noopener noreferrer"
            style={{ ...TEXT_XS, color: C.gray65, textDecoration: 'none' }}>
            Instagram
          </a>
        </footer>
      )}

      {/* ─── 반응형 ─── */}
      <style>{`
        .sso-mobile-menu-btn { display: none !important; }
        @media (max-width: 768px) {
          .sso-desktop-nav > div > span { padding: 0 6px !important; font-size: 13px !important; }
        }
        @media (max-width: 600px) {
          .sso-desktop-nav > div { display: none !important; }
          .sso-mobile-menu-btn { display: block !important; }
        }
      `}</style>
    </div>
  );
}

export default SaengsansoApp;
