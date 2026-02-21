import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { saengsansoAPI as _ssoAPI, saengsansoAboutAPI } from '../services/api';
import Login from './Login';

// API 타입 캐스팅
const saengsansoAPI = _ssoAPI as Record<string, {
  getAll: (opts?: any) => Promise<any>;
  create: (data: any) => Promise<any>;
  update: (id: string, data: any) => Promise<any>;
  delete: (id: string) => Promise<any>;
  reorder: (orders: any[]) => Promise<any>;
}>;

// ─── Autumn Atelier 디자인 토큰 ───
const C = {
  accent: '#CE7F64',   // 코랄 클레이
  red: '#BA462C',      // 버밀리언 레드
  cyan: '#CE7F64',     // 코랄 클레이 (accent 통일)
  black: '#2F1F1B',    // 딥 에스프레소
  dark: '#2F1F1B',     // 딥 에스프레소
  white: '#EDD6B6',    // 앤티크 아이보리
  gray65: '#7F776D',   // 테라코타 그레이
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
  { year: '2024', date: '2024.09.06-22.', title: '고도 주민의 삶과 기억전', venue: '부여 청소년 문화의집', note: '2024 고도주민활동지원사업. 백제역사문화연구원 위탁.' },
  { year: '2023', date: '2023', title: '금강아카이브: 멀고도 가까운', venue: '무대륙, 서울', note: '' },
  { year: '2023', date: '2023.07.', title: '백제기와문화관 세계국가유산산업전 부스 기획 및 설치', venue: '경주', note: '충청남도 부여군 사적관리소 위탁.' },
  { year: '2023', date: '2023', title: '아르코 공공미술 프로젝트', venue: '', note: '' },
  { year: '2023', date: '2023', title: '문화가있는날 금강워킹', venue: '서울, 부여, 강경, 서천', note: '지역문화진흥원' },
  { year: '2021', date: '2021.10.', title: '공예주간 조각수집', venue: '생산소, 부여', note: '대장장이 체험, 목공예·도자·보태니컬아트 전시, 살구에이드.' },
  { year: '2021', date: '2021', title: "위성악보 시리즈 'KARMA'", venue: '부소갤러리, 부여', note: '' },
];

const FALLBACK_PROJECTS = [
  { category: 'SOUNDSCAPE', date: '2024.11.10.', title: '사운드 오케스트라 in 부여', detail: '신동엽문학관 → 임천면 성흥산 → 대조사. 모듈러신스로 참여자와 소리 만들기. 관광두레 파일럿 프로그램.' },
  { category: 'SOUNDSCAPE', date: '2021-2023', title: '도시기록프로젝트 소리탐사조', detail: '서울 기반 도시 사운드 리서치' },
  { category: 'COLLABORATION', date: '2025.08-11.', title: '비단가람온길 레저코스 탄소중립 여행 활성화', detail: '서부내륙권 관광진흥사업. 백제역사문화연구원 위탁. 금강 인접 지자체 자전거여행+탄소중립 체험.' },
  { category: 'COLLABORATION', date: '2025.09.20.', title: '비단가람 무브먼트 에코-플로깅', detail: '큐클리프(CUECLYP) × 인디언모터사이클 × 생산소 협업 — 백마강, 부여. 비단가람온길 탄소중립 사업의 일환.' },
  { category: 'RESIDENCY', date: '2021', title: '민간레지던시 프로젝트', detail: '히스테리안(강정아) 기획 — 대안적 거주와 공간 리서치' },
  { category: 'WORKSHOP & COMMUNITY', date: '2025.03.01.', title: '2025 삼일절 임천면', detail: '임천면 만세장터·임천보부상·장놀이패·부여웅비태권도·부여군여성농민회. 토종씨앗·연대·농민의 삶.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2025.01.', title: '이야기 자리와 기록', detail: '꿈다락 문화예술학교 워크숍 \'나를 흔드는 ○○○이 있는가?\' 기록집 발간. 아르떼 라이브러리 수록.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2024.12.', title: '부여청년-마스터 크리스마스', detail: '부여 5년 커뮤니티 모임. 솥뚜껑삼겹살 저녁, 시낭송, 디제잉 파티, 키네틱공연. #지원사업아님' },
  { category: 'WORKSHOP & COMMUNITY', date: '2024.08.', title: '어반아트 네비게이터 — 하자센터', detail: '소리+움직임 워크숍. AI 시대 사람과 공간을 소리·움직임으로 해석. 어린이 대상.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2024.08.', title: '도시 읽기: 고흥', detail: '지역 기획자 초대로 고흥군 방문. 예술로 어울리기.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2024.', title: '꿈다락 문화예술학교 워크숍', detail: '\'나를 흔드는 ○○○이 있는가?\' — 아르떼 라이브러리 기록집 발간' },
  { category: 'WORKSHOP & COMMUNITY', date: '2023.09.', title: '공간(공항) 기반 수요 맞춤형 문화예술교육 프로그램 개발', detail: '한국문화예술교육진흥원 위탁. 공간 기반 문화예술교육 콘텐츠 기획·개발.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2023.06.16.', title: '《블록파티》 전시공간 토크', detail: '아마도예술공간, 서울 — "축구와, 배드민턴과, (대안)예술은"' },
  { category: 'WORKSHOP & COMMUNITY', date: '2023.04.21-23.', title: '부여세도유채꽃방울토마토축제 프로그램 운영', detail: '충청남도 부여군 세도면 위탁. 15ha 금강 하천부지 유채꽃밭. 코로나 이후 첫 재개최.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2023.', title: '문화가있는날 금강워킹', detail: '서울, 부여, 강경, 서천 — 지역문화진흥원' },
  { category: 'WORKSHOP & COMMUNITY', date: '2022.05.', title: 'DJ입문 클래스 — 플러그인 생산소', detail: '20대부터 60대 함께하는 DJ입문과정. 관광두레.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2022.05.29.', title: '부여객사 로그온: 나는 너를 방울방울해', detail: '2022 공예주간. 방울토마토 영감 공연, 금속/한지공예 전시, 사운드 VR 체험.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2022.05.', title: '일상색채수집보관함', detail: '세계문화예술교육주간 프로그램.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2022.05.', title: '정답은 없다', detail: '생활문화공동체지원사업.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2022.05.', title: '우당탕탕운동회', detail: '세도꿈꾸는마을학교.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2022.04.', title: 'Cafeteria Brisa 계절다방', detail: '이동형 가판 프로젝트. 마을 순회 커피·문화 가판대.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2022.02.14.', title: '계절상품시리즈: 비밀결사대', detail: '정월대보름 세시풍속 재해석. 쥐불놀이·연 날리기. 몽사모 × 평통사.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2022.01.29.', title: '호랑이배 연 날리기 대회', detail: '설날 정월 행사. 전통 연 날리기.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.12.', title: '계절상품시리즈: 미리 만나는 크리스마스', detail: '연말 커뮤니티 축제.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.11.', title: '충남문화재단 × 버밀라 아카데미 — 날아오르다', detail: '생산소 × 버밀라 아카데미 협업.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.10.', title: '핼러윈 호박줄기 축제', detail: '생산소 핼러윈 파티.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.09.', title: '부여아트페어: 지금의 생활도구', detail: '생산소품 브랜드 런칭. 호미 디자인, 낭만히힛 조각수집전.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.09.', title: '옥수수파티', detail: '홍우주사회적협동조합 × 생산소. 부여아트페어 연계.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.08.', title: '웨하스영화제', detail: '고란독서회 연계. 프리다(Frida) 상영.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.08.', title: '이몽학 위령제', detail: '구룡면. 술 담그고 위령제 진행.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.08.', title: '술-술-술 酒-術-述', detail: '술빚기 프로그램. 지역 술 문화 체험.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.03-09.', title: '쓸데없는 대장간', detail: '1974년 생산소 공간을 대장간으로. 충남문화재단.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.02.', title: '사운드키박스 프로젝트', detail: '동네 탐험 기록, 가사/멜로디 음악 제작.' },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.', title: '만날 사람은 만난다', detail: '비대면 장애인 문화예술교육 콘텐츠 개발. 아르떼. 발달장애 특화 <일상색채수집보관함>.' },
];

const FALLBACK_NEWS: any[] = [
  { date: '2025.08', title: '부여군, 비단가람온길 레저코스 사업 운영…11월까지', source: '에이티엔뉴스', category: 'press', url: 'https://www.atnnews.co.kr/news/articleView.html?idxno=90320' },
  { date: '2025.08', title: '부여군 비단가람온길 레저코스 사업 11월까지 운영', source: '굿모닝충청', category: 'press', url: 'https://www.goodmorningcc.com/news/articleView.html?idxno=406473' },
  { date: '2025.09.20', title: '비단가람 무브먼트 에코-플로깅 — 큐클리프 × 생산소 협업, 백마강 부여', source: '큐클리프', category: 'press', url: 'https://www.cueclyp.com/collaboration' },
  { date: '2024.11.10', title: '사운드 오케스트라 in 부여 — 신동엽문학관·대조사. 관광두레 생산소 파일럿', source: '관광두레', category: 'press' },
  { date: '2024.09.06-22', title: '고도 주민의 삶과 기억전 — 2024 고도주민활동지원사업, 백제역사문화연구원 × 생산소 기획', source: '백제역사문화연구원', category: 'press' },
  { date: '2023.09', title: '공간(공항) 기반 수요 맞춤형 문화예술교육 프로그램 개발', source: '한국문화예술교육진흥원', category: 'press' },
  { date: '2023.07', title: '백제기와문화관 세계국가유산산업전 부스 기획 및 설치', source: '세계국가유산산업전', category: 'press', url: 'https://heritage-korea.com/' },
  { date: '2023.06', title: '《블록파티》 전시공간 토크 — 대안예술공간 운영자 대담', source: '아마도예술공간', category: 'press' },
  { date: '2023.04', title: '2023 부여세도 방울토마토&유채꽃 축제 프로그램 운영', source: '데일리투데이', category: 'press', url: 'http://www.dtoday.co.kr/news/articleView.html?idxno=593416' },
  { date: '2023', title: '금강아카이브: 멀고도 가까운 — 지역 문화 기록 프로젝트', source: '지역문화진흥원', category: 'press' },
  { date: '2023', title: '문화가있는날 금강워킹 — 서울, 부여, 강경, 서천', source: '지역문화진흥원', category: 'press' },
  { date: '2022.05', title: '즐거움이 방울방울 피어나는 부여객사로 — 부여객사 로그온, 공예주간', source: '충남일보', category: 'press', url: 'https://www.ccdn.co.kr/news/articleView.html?idxno=761279' },
  { date: '2021', title: '만날 사람은 만난다 — 비대면 장애인 문화예술교육 콘텐츠 개발', source: '아르떼 라이브러리', category: 'press', url: 'https://lib.arte.or.kr/educationdata/board/ArchiveData_BoardView.do?board_id=BRD_ID0056902' },
  { date: '2021', title: '히스테리안 — 민간레지던시 프로젝트 리서치', source: '히스테리안', category: 'press' },
  { date: '2026.02', title: '생산소 홈페이지 오픈', source: '생산소', category: 'notice' },
  { date: '2025.08', title: '비단가람온길 레저코스 탄소중립 여행 활성화 사업 시작', source: '생산소', category: 'notice' },
  { date: '2025.09', title: '비단가람 무브먼트 에코-플로깅 진행', source: '생산소', category: 'notice' },
  { date: '2024.11', title: '사운드 오케스트라 부여 프로그램 운영', source: '생산소', category: 'notice' },
  { date: '2024.09', title: '고도 주민의 삶과 기억전 개최', source: '생산소', category: 'notice' },
  { date: '2024', title: '생산소 부여 공간 운영 안내', source: '생산소', category: 'notice' },
  { date: '2023.09', title: '공간 기반 문화예술교육 프로그램 개발 (한국문화예술교육진흥원)', source: '생산소', category: 'notice' },
  { date: '2023.07', title: '세계국가유산산업전 백제기와문화관 부스 기획·설치', source: '생산소', category: 'notice' },
  { date: '2023.04', title: '부여세도 방울토마토&유채꽃 축제 프로그램 운영', source: '생산소', category: 'notice' },
];

const FALLBACK_ARCHIVES = [
  { title: '비단가람온길 탄소중립 여행', year: '2025', bg: 'linear-gradient(135deg, #1a2a1f, #2a3a2a)' },
  { title: '비단가람 무브먼트', year: '2025', bg: 'linear-gradient(135deg, #0d2a1a, #1a3a2a)' },
  { title: '고도 주민의 삶과 기억', year: '2024', bg: 'linear-gradient(135deg, #2F2520, #40302A)' },
  { title: '사운드 오케스트라 in 부여', year: '2024', bg: 'linear-gradient(135deg, #1a1a2e, #0d1f2f)' },
  { title: '금강아카이브', year: '2023', bg: 'linear-gradient(135deg, #35201E, #2F1F1B)' },
  { title: '공간 기반 문화예술교육', year: '2023', bg: 'linear-gradient(135deg, #2a201a, #3a302a)' },
  { title: '세계국가유산산업전 백제기와 부스', year: '2023', bg: 'linear-gradient(135deg, #2a1a20, #3a2a30)' },
  { title: '부여세도 방울토마토&유채꽃 축제', year: '2023', bg: 'linear-gradient(135deg, #1a2a1a, #2a3a20)' },
  { title: '블록파티 전시공간 토크', year: '2023', bg: 'linear-gradient(135deg, #2a1a1a, #3a2a1a)' },
  { title: '민간레지던시 히스테리안', year: '2021', bg: 'linear-gradient(135deg, #1a1a2e, #2e1a2e)' },
];

// ─── 슬라이드 fallback 데이터 ───
const FALLBACK_SLIDES = [
  { _id: 'f0', bg: 'linear-gradient(135deg, #2F1F1B 0%, #3D2D28 50%, #2F1F1B 100%)', caption: '생산소 — 부여 기반 대안예술공간', image: '' },
  { _id: 'f1', bg: 'linear-gradient(135deg, #2B2520 0%, #3A302A 50%, #2B2520 100%)', caption: '유기적공명: 에디아포닉 Organic Resonance: Ediaphonic', image: '' },
  { _id: 'f2', bg: 'linear-gradient(135deg, #2F2520 0%, #40302A 50%, #2F2520 100%)', caption: '위성악보 시리즈 — Satellite Score Series', image: '' },
  { _id: 'f3', bg: 'linear-gradient(135deg, #35201E 0%, #2F1F1B 50%, #35201E 100%)', caption: '리커넥트: 낙원식당 Reconnect: Nakwon Restaurant', image: '' },
  { _id: 'f4', bg: 'linear-gradient(135deg, #2B2018 0%, #3A2E26 50%, #2B2018 100%)', caption: '금강아카이브: 멀고도 가까운', image: '' },
];

// ─── 이미지 압축 (canvas, max 1920px, JPEG 80%) ───
const compressImage = (file: File, maxWidth = 1920, quality = 0.8): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas error')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ─── 네비게이션 ───
interface SubMenuItem { label: string; page?: string }
interface MenuItem { label: string; page: string; sub?: SubMenuItem[]; href?: string }

const MENU_ITEMS: MenuItem[] = [
  { label: 'MAIN', page: 'MAIN' },
  { label: 'ABOUT', page: 'ABOUT' },
  { label: 'PROJECTS', page: 'PROJECTS' },
  { label: 'SHOP', page: 'SHOP' },
  {
    label: 'NEWS', page: 'NEWS',
    sub: [
      { label: '- 공지사항', page: 'NEWS_NOTICE' },
      { label: '- 언론보도', page: 'NEWS_PRESS' },
    ]
  },
  { label: 'ARCHIVE', page: 'ARCHIVE' },
  { label: 'NODE TREE', page: 'NODE_TREE', href: 'https://nodetree.kr' },
];

// ─── 공통 컴포넌트 ───
function RedLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ ...TEXT_BASE, background: C.red, color: C.white, padding: '0 4px', display: 'inline' }}>
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
  ...btnStyle, background: C.accent, color: C.white, border: 'none',
  padding: '4px 14px', fontSize: '12px', marginTop: '12px',
};

// ─── 인라인 폼 스타일 ───
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: '14px', fontFamily: 'inherit',
  border: `1px solid #C4B5A4`, marginBottom: '6px', boxSizing: 'border-box',
};
const selectStyle: React.CSSProperties = { ...inputStyle, background: '#EDD6B6' };
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
    <div style={{ background: '#F5E8D8', padding: '12px', margin: '8px 0', border: '1px solid #C4B5A4' }}>
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
        <button style={{ ...formBtnStyle, background: C.accent, color: C.white }} onClick={() => onSave(form)}>저장</button>
        <button style={{ ...formBtnStyle, background: '#DCC4A8' }} onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}

// ─── 슬라이드 편집 모달 ───
function SlideEditModal({ slide, onSave, onClose }: {
  slide: any;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [caption, setCaption] = useState(slide?.caption || '');
  const [imagePreview, setImagePreview] = useState<string>(slide?.image || '');
  const [isDragging, setIsDragging] = useState(false);
  const [imgError, setImgError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setImgError('');
    if (!file.type.startsWith('image/')) { setImgError('이미지 파일만 가능합니다.'); return; }
    if (file.size > 15 * 1024 * 1024) { setImgError('15MB 이하 파일만 가능합니다.'); return; }
    try { setImagePreview(await compressImage(file)); } catch { setImgError('이미지 처리 실패'); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ caption, image: imagePreview, bg: slide?.bg || '' });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(47,31,27,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
    }} onClick={onClose}>
      <div style={{
        background: '#EDD6B6', padding: '28px', width: '90%', maxWidth: '480px',
        boxShadow: '0 12px 40px rgba(47,31,27,0.4)', borderRadius: '2px',
      }} onClick={e => e.stopPropagation()}>
        <p style={{ ...TEXT_BASE, marginBottom: '20px' }}>
          {slide?._id ? '슬라이드 편집' : '슬라이드 추가'}
        </p>

        {/* 이미지 미리보기 */}
        {imagePreview && (
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <img src={imagePreview} alt="" style={{
              width: '100%', height: '160px', objectFit: 'cover',
              display: 'block', border: '1px solid #C4B5A4',
            }} />
            <button onClick={() => setImagePreview('')} style={{
              position: 'absolute', top: '6px', right: '6px',
              background: 'rgba(47,31,27,0.8)', color: '#EDD6B6',
              border: 'none', borderRadius: '50%', width: '24px', height: '24px',
              cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>
        )}

        {/* 이미지 업로드 영역 */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? C.accent : '#C4B5A4'}`,
            padding: '16px', textAlign: 'center', cursor: 'pointer',
            background: isDragging ? 'rgba(206,127,100,0.08)' : 'rgba(237,214,182,0.5)',
            marginBottom: '12px', transition: 'all 0.2s',
          }}
        >
          <p style={{ ...TEXT_SM, color: C.gray65, margin: 0 }}>이미지 클릭 또는 드래그</p>
          <p style={{ ...TEXT_XS, color: '#B0A090', margin: '4px 0 0' }}>JPG·PNG·WEBP · 15MB 이하 · 자동 압축</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {imgError && <p style={{ ...TEXT_XS, color: C.red, marginBottom: '8px' }}>{imgError}</p>}

        {/* 캡션 */}
        <label style={{ ...TEXT_XS, display: 'block', marginBottom: '4px', color: C.gray65 }}>캡션</label>
        <input value={caption} onChange={e => setCaption(e.target.value)}
          style={{ ...inputStyle, marginBottom: '20px' }} placeholder="슬라이드 설명 텍스트" />

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...formBtnStyle, background: '#DCC4A8' }}>취소</button>
          <button onClick={handleSave} disabled={saving}
            style={{ ...formBtnStyle, background: saving ? '#B0A090' : C.accent, color: C.white }}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 페이지: MAIN ───
function PageMain({ goToSlide, currentSlide, slides, isAdmin, onEditSlide, onAddSlide, onDeleteSlide }: {
  goToSlide: (i: number) => void;
  currentSlide: number;
  slides: any[];
  isAdmin: boolean;
  onEditSlide: (slide: any) => void;
  onAddSlide: () => void;
  onDeleteSlide: (id: string) => void;
}) {
  const slide = slides[currentSlide];
  if (!slide) return null;

  return (
    <div style={{ height: '52vh', position: 'relative', marginTop: '4px', overflow: 'hidden' }}>
      <AnimatePresence initial={false}>
        <motion.div
          key={currentSlide}
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
          style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
        >
          <div
            className="sso-slide-drift"
            style={{
              position: 'absolute', inset: '-4%',
              background: slide.bg || 'linear-gradient(135deg, #2F1F1B, #3D2D28)',
              backgroundSize: 'cover', backgroundPosition: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {/* 실제 이미지 */}
            {slide.image && (
              <img src={slide.image} alt="" style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', display: 'block',
              }} />
            )}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.6 }}
              style={{ color: 'rgba(237,214,182,0.5)', fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)', fontWeight: 300, letterSpacing: '0.12em', textAlign: 'center', margin: 0, position: 'relative', zIndex: 1 }}>
              {slide.caption}
            </motion.p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 도트 인디케이터 */}
      <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', zIndex: 10 }}>
        {slides.map((_: any, i: number) => (
          <button key={i} onClick={() => goToSlide(i)} style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: i === currentSlide ? C.accent : 'rgba(237,214,182,0.3)',
            border: 'none', cursor: 'pointer', padding: 0, transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* 관리자 편집 컨트롤 */}
      {isAdmin && (
        <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px', zIndex: 20 }}>
          <button onClick={() => onEditSlide(slide)} style={{
            background: 'rgba(206,127,100,0.9)', color: '#EDD6B6',
            border: 'none', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
          }}>이미지 편집</button>
          {slides.length > 1 && !String(slide._id).startsWith('f') && (
            <button onClick={() => onDeleteSlide(slide._id)} style={{
              background: 'rgba(186,70,44,0.9)', color: '#EDD6B6',
              border: 'none', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
            }}>삭제</button>
          )}
          <button onClick={onAddSlide} style={{
            background: 'rgba(47,31,27,0.85)', color: '#EDD6B6',
            border: 'none', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
          }}>+ 추가</button>
        </div>
      )}
    </div>
  );
}

// ─── 페이지: ABOUT ───
const DEFAULT_ABOUT_DESC = '생산소는\n지역 리서치를 기반으로 활동하는 뉴미디어 아티스트 듀오 노드 트리의 작업 과정에서,\n적정한 규모의 도시에 대한 질문을 바탕으로\n마을에서 어떻게 관계를 맺고 어떤 태도로 실천되는지를 기록하는 공간입니다.\n마을에서 마음을 나누며, 감각과 이야기를 축적하고 있습니다';

function PageAbout({ isAdmin }: { isAdmin: boolean }) {
  const [description, setDescription] = useState(DEFAULT_ABOUT_DESC);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    saengsansoAboutAPI.get()
      .then(res => { if (res.success && res.data?.description) setDescription(res.data.description); })
      .catch(() => {});
  }, []);

  const handleEdit = () => { setEditText(description); setIsEditing(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saengsansoAboutAPI.update(editText);
      if (res.success) { setDescription(editText); setIsEditing(false); }
    } catch { alert('저장에 실패했습니다.'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
      <div style={{ display: 'flex', gap: '68px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 500px', minWidth: '300px' }}>
          <p style={TEXT_BASE}>생산소 省算所</p>
          <p style={TEXT_BASE}>SAENGSANSO</p>
          <p style={TEXT_BASE}>Alternative Art Space</p>
          <p style={TEXT_BASE}>Buyeo, Chungcheongnam-do</p>
          <br />

          {/* 편집 가능 설명 영역 */}
          {isEditing ? (
            <div style={{ marginBottom: '16px' }}>
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                rows={8}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  lineHeight: '1.8',
                  fontSize: '16px',
                  fontFamily: 'inherit',
                  marginBottom: '10px',
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ ...formBtnStyle, background: saving ? '#B0A090' : C.accent, color: C.white }}>
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button onClick={() => setIsEditing(false)}
                  style={{ ...formBtnStyle, background: '#DCC4A8' }}>
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              {description.split('\n').map((line, i) => (
                <p key={i} style={{ ...TEXT_BASE, margin: '0 0 2px' }}>{line}</p>
              ))}
              {isAdmin && (
                <button onClick={handleEdit} style={{
                  ...btnStyle, marginLeft: 0, marginTop: '12px', display: 'block',
                  background: C.accent, color: C.white, border: 'none', padding: '4px 14px',
                }}>
                  텍스트 편집
                </button>
              )}
            </div>
          )}

          <br />
          <p style={TEXT_BASE}>saengsanso@gmail.com</p>
          <p style={TEXT_BASE}>
            Instagram @saengsanso
            {' '}
            <a
              href="https://instagram.com/saengsanso"
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...TEXT_SM, color: C.accent, textDecoration: 'none', fontWeight: 700 }}
            >
              ↗ 바로가기
            </a>
          </p>
          <br />
          <p style={TEXT_BASE}>충남 부여군</p>
          <p style={TEXT_BASE}>Buyeo-gun, Chungcheongnam-do, Korea</p>
          <br />
          <p style={{ ...TEXT_SM, color: C.cyan }}>* 방문은 사전 연락 후 가능합니다</p>
          <br />
          <div style={{
            width: '100%', maxWidth: '660px', height: '284px',
            background: `linear-gradient(135deg, ${C.dark} 0%, #3D2D28 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'rgba(237,214,182,0.3)', fontSize: '14px', letterSpacing: '0.1em' }}>MAP — 부여</span>
          </div>
          <br />
          <p style={{ ...TEXT_XS, color: C.gray65 }}>website by NODE TREE</p>
        </div>
        <div style={{ flex: '0 0 242px', minWidth: '200px' }}>
          <p style={TEXT_BASE}>Space Inquiry</p>
          <br />
          <button style={{ ...TEXT_XS, background: C.red, color: C.white, border: 'none', padding: '4px 16px', cursor: 'pointer', fontWeight: 700 }}>문의하기</button>
          <br /><br /><br />
          <p style={TEXT_BASE}>Operated by.</p>
          <br />
          <button onClick={() => window.open('https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=%EC%9D%B4%ED%99%94%EC%98%81+%EC%98%88%EC%88%A0%EA%B0%80&ackey=dwenwv4b', '_blank', 'noopener,noreferrer')} style={{ ...TEXT_XS, background: C.red, color: C.white, border: 'none', padding: '4px 16px', cursor: 'pointer', fontWeight: 700 }}>이화영 Lee Hwayoung</button>
          <br /><br />
          <button style={{ ...TEXT_XS, background: C.red, color: C.white, border: 'none', padding: '4px 16px', cursor: 'pointer', fontWeight: 700 }}>정강현 Jung Kanghyun</button>
        </div>
      </div>
    </div>
  );
}

// ─── 페이지: SHOP (준비중) ───
function PageShop() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: '0 0 196px', minWidth: '140px' }}>
          <p style={TEXT_BASE}>SHOP</p>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', paddingTop: '4px' }}>
          <p style={{ ...TEXT_BASE, color: C.gray65 }}>준비중입니다.</p>
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
function PageProjects({ projects, isAdmin, onSave, onDelete }: {
  projects: any[];
  isAdmin: boolean;
  onSave: (data: Record<string, string>, id?: string) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editItem, setEditItem] = useState<any>(null); // null=닫힘, {}=새항목, {_id,...}=수정중

  const PROJ_FIELDS = [
    { key: 'category', label: '카테고리', type: 'select' as const, options: ['SOUNDSCAPE', 'COLLABORATION', 'RESIDENCY', 'WORKSHOP & COMMUNITY'] },
    { key: 'date', label: '날짜' },
    { key: 'title', label: '제목' },
    { key: 'detail', label: '상세' },
  ];

  const categories = ['SOUNDSCAPE', 'COLLABORATION', 'RESIDENCY', 'WORKSHOP & COMMUNITY'];
  const grouped: Record<string, any[]> = {};
  categories.forEach(c => { grouped[c] = []; });
  projects.forEach(p => { if (grouped[p.category]) grouped[p.category].push(p); });

  const handleSave = async (data: Record<string, string>) => {
    await onSave(data, editItem?._id);
    setEditItem(null);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: '0 0 196px', minWidth: '140px' }}><p style={TEXT_BASE}>PROGRAM</p></div>
        <div style={{ flex: 1 }}>
          {/* 새 항목 추가 폼 */}
          {isAdmin && editItem && !editItem._id && (
            <InlineForm fields={PROJ_FIELDS} initial={{}} onSave={handleSave} onCancel={() => setEditItem(null)} />
          )}
          {categories.map(cat => (
            <div key={cat} style={{ marginBottom: '32px' }}>
              <p style={{ ...TEXT_BASE, marginBottom: '8px' }}><RedLabel>{cat}</RedLabel></p>
              {grouped[cat].map((item: any, i: number) => (
                <div key={item._id || i} style={{ marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <p style={{ ...TEXT_BASE, margin: 0 }}>{item.date} {item.title}</p>
                    {isAdmin && (
                      <>
                        <button style={btnStyle} onClick={() => setEditItem(item)}>수정</button>
                        <button style={{ ...btnStyle, color: C.red }} onClick={() => onDelete(item._id)}>삭제</button>
                      </>
                    )}
                  </div>
                  <p style={{ ...TEXT_SM, color: C.gray65 }}>{item.detail}</p>
                  {/* 수정 폼: 해당 항목 바로 아래 */}
                  {isAdmin && editItem?._id === item._id && (
                    <InlineForm
                      fields={PROJ_FIELDS}
                      initial={{ category: item.category, date: item.date, title: item.title, detail: item.detail }}
                      onSave={handleSave}
                      onCancel={() => setEditItem(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
          {isAdmin && <button style={addBtnStyle} onClick={() => setEditItem({})}>+ 프로젝트 추가</button>}
        </div>
      </div>
    </div>
  );
}

// ─── 페이지: NEWS (DB 연동) ───
function PageNews({ filter, news, isAdmin, onSave, onDelete }: {
  filter?: 'notice' | 'press';
  news: any[];
  isAdmin: boolean;
  onSave: (data: Record<string, string>, id?: string) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'all' | 'notice' | 'press'>(
    filter === 'notice' ? 'notice' : filter === 'press' ? 'press' : 'all'
  );
  const [editItem, setEditItem] = useState<any>(null);

  useEffect(() => {
    if (filter === 'notice') setActiveTab('notice');
    else if (filter === 'press') setActiveTab('press');
  }, [filter]);

  const NEWS_FIELDS = [
    { key: 'date', label: '날짜' },
    { key: 'title', label: '제목' },
    { key: 'source', label: '출처' },
    { key: 'category', label: '분류', type: 'select' as const, options: ['notice', 'press'] },
    { key: 'url', label: 'URL' },
  ];

  const filteredNews = activeTab === 'all' ? news : news.filter((n: any) => n.category === activeTab);
  const tabs: { key: 'all' | 'notice' | 'press'; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'notice', label: '공지사항' },
    { key: 'press', label: '언론보도' },
  ];

  const handleSave = async (data: Record<string, string>) => {
    await onSave(data, editItem?._id);
    setEditItem(null);
  };

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
      {/* 새 항목 추가 폼 */}
      {isAdmin && editItem && !editItem._id && (
        <InlineForm fields={NEWS_FIELDS} initial={{}} onSave={handleSave} onCancel={() => setEditItem(null)} />
      )}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.dark}`, paddingBottom: '8px', marginBottom: '4px' }}>
        <span style={{ ...TEXT_SM, flex: '0 0 100px' }}>날짜</span>
        <span style={{ ...TEXT_SM, flex: 1 }}>제목</span>
        <span style={{ ...TEXT_SM, flex: '0 0 120px', textAlign: 'right' }}>출처</span>
        {isAdmin && <span style={{ ...TEXT_SM, flex: '0 0 80px', textAlign: 'right' }}>관리</span>}
      </div>
      {filteredNews.map((item: any, i: number) => (
        <div key={item._id || i}>
          <div style={{
            display: 'flex', padding: '10px 0', borderBottom: '1px solid #DCC4A8',
            cursor: (!isAdmin && item.url) ? 'pointer' : 'default', transition: 'background 0.2s',
          }}
            onClick={() => !isAdmin && item.url && window.open(item.url, '_blank', 'noopener,noreferrer')}
            onMouseEnter={e => { e.currentTarget.style.background = '#F5E8D8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ ...TEXT_SM, flex: '0 0 100px', color: C.gray65 }}>{item.date}</span>
            <span style={{ ...TEXT_BASE, flex: 1 }}>
              {item.title}
              {item.url && <span style={{ ...TEXT_XS, color: C.cyan, marginLeft: '6px' }}>↗</span>}
            </span>
            <span style={{ ...TEXT_XS, flex: '0 0 120px', textAlign: 'right', color: C.gray65, alignSelf: 'center' }}>{item.source}</span>
            {isAdmin && (
              <span style={{ flex: '0 0 80px', textAlign: 'right', flexShrink: 0 }}>
                <button style={btnStyle} onClick={e => { e.stopPropagation(); setEditItem(item); }}>수정</button>
                <button style={{ ...btnStyle, color: C.red }} onClick={e => { e.stopPropagation(); onDelete(item._id); }}>삭제</button>
              </span>
            )}
          </div>
          {/* 수정 폼: 해당 항목 바로 아래 */}
          {isAdmin && editItem?._id === item._id && (
            <InlineForm
              fields={NEWS_FIELDS}
              initial={{ date: item.date, title: item.title, source: item.source, category: item.category, url: item.url || '' }}
              onSave={handleSave}
              onCancel={() => setEditItem(null)}
            />
          )}
        </div>
      ))}
      {isAdmin && <button style={addBtnStyle} onClick={() => setEditItem({})}>+ 뉴스 추가</button>}
    </div>
  );
}

// ─── 페이지: ARCHIVE (DB 연동) ───
function PageArchive({ archives, isAdmin, onSave, onDelete }: {
  archives: any[];
  isAdmin: boolean;
  onSave: (data: Record<string, string>, id?: string) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editItem, setEditItem] = useState<any>(null);

  const ARCHIVE_FIELDS = [
    { key: 'title', label: '제목' },
    { key: 'year', label: '연도' },
    { key: 'bg', label: '배경(CSS)' },
    { key: 'image', label: '이미지 URL' },
  ];

  const handleSave = async (data: Record<string, string>) => {
    await onSave(data, editItem?._id);
    setEditItem(null);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
      {/* 새 항목 추가 폼 */}
      {isAdmin && editItem && !editItem._id && (
        <InlineForm fields={ARCHIVE_FIELDS} initial={{}} onSave={handleSave} onCancel={() => setEditItem(null)} />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {archives.map((item: any, i: number) => (
          <div key={item._id || i} style={{ display: 'contents' }}>
            <div style={{
              background: item.bg || 'linear-gradient(135deg, #2F1F1B, #3D2520)',
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
                  <button style={{ ...btnStyle, background: 'rgba(237,214,182,0.8)' }} onClick={e => { e.stopPropagation(); setEditItem(item); }}>수정</button>
                  <button style={{ ...btnStyle, background: 'rgba(237,214,182,0.8)', color: C.red }} onClick={e => { e.stopPropagation(); onDelete(item._id); }}>삭제</button>
                </div>
              )}
            </div>
            {/* 수정 폼: 카드 바로 다음 칸에 full-width로 */}
            {isAdmin && editItem?._id === item._id && (
              <div style={{ gridColumn: '1 / -1' }}>
                <InlineForm
                  fields={ARCHIVE_FIELDS}
                  initial={{ title: item.title, year: item.year, bg: item.bg || '', image: item.image || '' }}
                  onSave={handleSave}
                  onCancel={() => setEditItem(null)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {isAdmin && <button style={addBtnStyle} onClick={() => setEditItem({})}>+ 아카이브 추가</button>}
    </div>
  );
}


// ═══════════════════════════════════════════
// ─── 메인 앱 ───
// ═══════════════════════════════════════════
function SaengsansoApp() {
  const { isAuthenticated, logout, user } = useAuth();
  const isAdmin = isAuthenticated;

  // 해시에서 초기 페이지 복원
  const getInitialPage = () => {
    const hash = window.location.hash.replace('#', '').toUpperCase();
    const valid = ['ABOUT', 'PROJECTS', 'SHOP', 'NEWS', 'NEWS_NOTICE', 'NEWS_PRESS', 'ARCHIVE'];
    return valid.includes(hash) ? hash : 'MAIN';
  };

  const [currentPage, setCurrentPage] = useState(getInitialPage);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [adminEditMode, setAdminEditMode] = useState(false); // 편집 버튼 눌러야 활성화

  // ─── 타이틀 음각 애니메이션 ───
  const TITLE_CHARS = '생산소 省算所 SAENGSANSO'.split('');
  const [pressedChars, setPressedChars] = useState<Set<number>>(new Set());
  const pressTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const nonSpaceIndices = TITLE_CHARS.map((c, i) => c !== ' ' ? i : -1).filter(i => i >= 0);

    const clearTimers = () => {
      pressTimersRef.current.forEach(t => clearTimeout(t));
      pressTimersRef.current = [];
    };

    const runCycle = () => {
      clearTimers();
      setPressedChars(new Set());

      // 글자 하나씩 눌러넣기
      nonSpaceIndices.forEach((charIdx, seqIdx) => {
        const t = setTimeout(() => {
          setPressedChars(prev => { const next = new Set(Array.from(prev)); next.add(charIdx); return next; });
        }, seqIdx * 150);
        pressTimersRef.current.push(t);
      });

      const totalPressTime = nonSpaceIndices.length * 150;

      // 전부 눌린 채로 유지 → 일괄 해제 → 대기 → 반복
      const releaseT = setTimeout(() => setPressedChars(new Set()), totalPressTime + 2000);
      const restartT = setTimeout(runCycle, totalPressTime + 2000 + 1500);
      pressTimersRef.current.push(releaseT, restartT);
    };

    runCycle();
    return clearTimers;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DB 데이터
  const [loading, setLoading] = useState(true);
  const [exhibitions, setExhibitions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [archives, setArchives] = useState<any[]>([]);
  const [slides, setSlides] = useState<any[]>(FALLBACK_SLIDES);

  // 슬라이드 편집 모달
  const [slideEditTarget, setSlideEditTarget] = useState<any>(null); // null=닫힘, {}=추가, {_id,...}=편집

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [exRes, prRes, nwRes, arRes, slRes] = await Promise.all([
        saengsansoAPI.exhibitions.getAll().catch(() => null),
        saengsansoAPI.projects.getAll().catch(() => null),
        saengsansoAPI.news.getAll().catch(() => null),
        saengsansoAPI.archive.getAll().catch(() => null),
        saengsansoAPI.slides.getAll().catch(() => null),
      ]);
      setExhibitions(exRes?.success && exRes.data.length > 0 ? exRes.data : FALLBACK_EXHIBITIONS);
      setProjects(prRes?.success && prRes.data.length > 0 ? prRes.data : FALLBACK_PROJECTS);
      setNews(nwRes?.success && nwRes.data.length > 0 ? nwRes.data : FALLBACK_NEWS);
      setArchives(arRes?.success && arRes.data.length > 0 ? arRes.data : FALLBACK_ARCHIVES);
      setSlides(slRes?.success && slRes.data.length > 0 ? slRes.data : FALLBACK_SLIDES);
    } catch {
      setExhibitions(FALLBACK_EXHIBITIONS);
      setProjects(FALLBACK_PROJECTS);
      setNews(FALLBACK_NEWS);
      setArchives(FALLBACK_ARCHIVES);
      setSlides(FALLBACK_SLIDES);
    } finally {
      setLoading(false);
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
    const timer = setInterval(() => setCurrentSlide(prev => (prev + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, [currentPage, slides.length]);

  const goToSlide = useCallback((i: number) => setCurrentSlide(i), []);

  const handleNav = (page: string) => {
    if (page === 'LOGIN') { setShowLogin(true); return; }
    const item = MENU_ITEMS.find(m => m.page === page);
    if (item?.href) { window.open(item.href, '_blank', 'noopener,noreferrer'); return; }
    setCurrentPage(page);
    setMobileMenuOpen(false);
    setActiveDropdown(null);
    setAdminEditMode(false); // 페이지 이동 시 편집 모드 초기화
    window.location.hash = page === 'MAIN' ? '' : page.toLowerCase();
  };

  // ─── CRUD 핸들러 (각 페이지 컴포넌트에 주입) ───
  const makeSaveHandler = (type: string) => async (data: Record<string, string>, id?: string) => {
    const api = (saengsansoAPI as any)[type];
    if (id) {
      await api.update(id, data);
    } else {
      await api.create(data);
    }
    await loadData();
  };

  const makeDeleteHandler = (type: string) => async (id: string) => {
    if (!id || !window.confirm('정말 삭제하시겠습니까?')) return;
    await (saengsansoAPI as any)[type].delete(id);
    await loadData();
  };

  const isMain = currentPage === 'MAIN';

  // 슬라이드 저장 핸들러
  const handleSaveSlide = async (data: any, id?: string) => {
    if (id && !String(id).startsWith('f')) {
      await saengsansoAPI.slides.update(id, data);
    } else {
      await saengsansoAPI.slides.create(data);
    }
    await loadData();
    // 슬라이드 추가 후 마지막 슬라이드로 이동
    if (!id) setCurrentSlide(slides.length);
  };

  const handleDeleteSlide = async (id: string) => {
    if (!window.confirm('슬라이드를 삭제하시겠습니까?')) return;
    await saengsansoAPI.slides.delete(id);
    setCurrentSlide(0);
    await loadData();
  };

  const loadingIndicator = (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '60px' }}>
      <p style={{ ...TEXT_SM, color: C.gray65, letterSpacing: '0.05em' }}>불러오는 중...</p>
    </div>
  );

  const renderPage = () => {
    switch (currentPage) {
      case 'MAIN': return (
        <PageMain
          goToSlide={goToSlide}
          currentSlide={currentSlide}
          slides={slides}
          isAdmin={isAdmin && adminEditMode}
          onEditSlide={(slide) => setSlideEditTarget(slide)}
          onAddSlide={() => setSlideEditTarget({})}
          onDeleteSlide={handleDeleteSlide}
        />
      );
      case 'ABOUT': return <PageAbout isAdmin={isAdmin && adminEditMode} />;
      case 'SHOP': return <PageShop />;
      case 'PROJECTS':
        if (loading) return loadingIndicator;
        return (
          <>
            <PageExhibitions
              exhibitions={exhibitions}
              isAdmin={isAdmin && adminEditMode}
              onAdd={() => {}}
              onEdit={() => {}}
              onDelete={makeDeleteHandler('exhibitions')}
            />
            <PageProjects
              projects={projects}
              isAdmin={isAdmin && adminEditMode}
              onSave={makeSaveHandler('projects')}
              onDelete={makeDeleteHandler('projects')}
            />
          </>
        );
      case 'NEWS':
      case 'NEWS_NOTICE':
      case 'NEWS_PRESS':
        if (loading) return loadingIndicator;
        return (
          <PageNews
            filter={currentPage === 'NEWS_NOTICE' ? 'notice' : currentPage === 'NEWS_PRESS' ? 'press' : undefined}
            news={news}
            isAdmin={isAdmin && adminEditMode}
            onSave={makeSaveHandler('news')}
            onDelete={makeDeleteHandler('news')}
          />
        );
      case 'ARCHIVE':
        if (loading) return loadingIndicator;
        return (
          <PageArchive
            archives={archives}
            isAdmin={isAdmin && adminEditMode}
            onSave={makeSaveHandler('archive')}
            onDelete={makeDeleteHandler('archive')}
          />
        );
      default: return (
        <PageMain
          goToSlide={goToSlide}
          currentSlide={currentSlide}
          slides={slides}
          isAdmin={isAdmin && adminEditMode}
          onEditSlide={(slide) => setSlideEditTarget(slide)}
          onAddSlide={() => setSlideEditTarget({})}
          onDeleteSlide={handleDeleteSlide}
        />
      );
    }
  };

  // 로그인 페이지
  if (showLogin) {
    return <Login onClose={() => setShowLogin(false)} />;
  }

  // 슬라이드 편집 모달
  const slideModal = slideEditTarget !== null && (
    <SlideEditModal
      slide={slideEditTarget._id ? slideEditTarget : null}
      onSave={(data) => handleSaveSlide(data, slideEditTarget._id)}
      onClose={() => setSlideEditTarget(null)}
    />
  );

  return (
    <div style={{
      fontFamily: "Verdana, 'Noto Sans Korean', 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif",
      width: '100vw', height: '100vh', overflow: isMain ? 'hidden' : 'auto',
      background: C.white, display: 'flex', flexDirection: 'column',
    }}>
      {slideModal}
      {/* ─── 타이틀 행 ─── */}
      <div style={{ background: '#2F1F1B', padding: '0 15px', flexShrink: 0 }}>
        <div style={{ paddingTop: '18px', paddingBottom: '12px', margin: 0, lineHeight: '32px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          onClick={() => handleNav('MAIN')}>
          <p style={{ margin: 0, padding: 0, fontSize: '20px', lineHeight: '32px' }}>
            {TITLE_CHARS.map((char, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  fontSize: '48px', fontWeight: 900,
                  fontFamily: "Verdana, 'Noto Sans Korean', 'Apple SD Gothic Neo', sans-serif",
                  color: '#2F1F1B',
                  lineHeight: '32px',
                  minWidth: char === ' ' ? '14px' : undefined,
                  transition: 'text-shadow 0.35s ease-out',
                  textShadow: pressedChars.has(i)
                    ? `2px 1px 0 #DCC4A8, 4px 2px 0 #CCAE90, 6px 3px 0 #BC9878, 8px 4px 0 #AC8260, 10px 5px 0 #9C6C48, 12px 6px 1px rgba(0,0,0,0.2), -1px -1px 0 #F8E4CE, -2px -1px 0 #F5E0CA`
                    : `0 0 0 #2F1F1B, 0 0 0 #2F1F1B, 0 0 0 #2F1F1B, 0 0 0 #2F1F1B, 0 0 0 #2F1F1B, 0 0 0 #2F1F1B, 0 0 0 #2F1F1B, 0 0 0 #2F1F1B`,
                }}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            ))}
          </p>
        </div>
        {/* 로그인/로그아웃 */}
        <div style={{ textAlign: 'right', paddingBottom: '4px' }}>
          {!isAuthenticated ? (
            <span
              onClick={(e) => { e.stopPropagation(); setShowLogin(true); }}
              style={{ ...TEXT_XS, color: 'rgba(237,214,182,0.5)', cursor: 'pointer', textDecoration: 'none' }}
            >
              로그인
            </span>
          ) : (
            <span style={{ ...TEXT_XS, color: 'rgba(237,214,182,0.7)' }}>
              {user?.username}님{' '}
              <span
                onClick={() => setAdminEditMode(m => !m)}
                style={{ cursor: 'pointer', textDecoration: 'underline', marginRight: '8px', color: adminEditMode ? C.accent : 'inherit' }}
              >
                {adminEditMode ? '편집완료' : '편집'}
              </span>
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
                <span className="sso-nav-item" onClick={() => handleNav(item.page)} style={{
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
                    position: 'absolute', top: '34px', left: 0, background: '#EDD6B6',
                    minWidth: '200px', boxShadow: '0 4px 20px rgba(47,31,27,0.15)', zIndex: 200, padding: '8px 0',
                  }}>
                    {item.sub.map(sub => (
                      <div key={sub.label} style={{
                        padding: '10px 20px', color: C.dark, fontSize: '13px', fontWeight: 400, cursor: 'pointer', transition: 'background 0.2s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.color = C.white; }}
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
            style={{ position: 'fixed', top: '120px', left: 0, right: 0, bottom: 0, background: '#EDD6B6', zIndex: 90, padding: '20px', overflowY: 'auto' }}
          >
            {MENU_ITEMS.map(item => (
              <div key={item.label} style={{ borderBottom: '1px solid #DCC4A8' }}>
                <div onClick={() => handleNav(item.page)} style={{
                  padding: '16px 0', fontSize: '17px', fontWeight: 700,
                  textTransform: 'uppercase' as const, color: C.dark, cursor: 'pointer',
                }}>
                  {item.label}
                </div>
                {item.sub && (
                  <div style={{ paddingBottom: '12px' }}>
                    {item.sub.map(sub => (
                      <div key={sub.label} style={{ padding: '8px 0 8px 16px', fontSize: '13px', color: '#7F776D', cursor: 'pointer' }}
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
        </footer>
      )}

      {/* ─── 반응형 ─── */}
      <style>{`
@keyframes ssoSlowDrift {
  0%   { transform: scale(1.06) translate(0%, 0%); }
  25%  { transform: scale(1.06) translate(-1.2%, -0.6%); }
  50%  { transform: scale(1.06) translate(-2%, 0%); }
  75%  { transform: scale(1.06) translate(-0.8%, 0.6%); }
  100% { transform: scale(1.06) translate(0%, 0%); }
}
.sso-slide-drift {
  animation: ssoSlowDrift 18s ease-in-out infinite;
}
.sso-nav-item {
          position: relative;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.3s, color 0.3s !important;
        }
        .sso-nav-item:hover {
          transform: translateY(-5px) scale(1.08);
        }
        .sso-nav-item::before {
          content: '✦';
          position: absolute;
          top: -16px;
          left: 50%;
          transform: translateX(-50%) scale(0) rotate(-30deg);
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          font-size: 9px;
          color: #CE7F64;
          line-height: 1;
          pointer-events: none;
        }
        .sso-nav-item:hover::before {
          transform: translateX(-50%) scale(1) rotate(0deg);
        }
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
