import React from 'react';

// ════════════════════════════════════════════════════════════════════════
// NtBoot — v5 라우트 전용 로딩 자리(청크가 오는 동안).
//   · 공용 PageLoader 를 쓰면 「불러오는 중…」이 body 의 S-CoreDream 을 깨워
//     새 페이지에서 쓰지도 않는 168 KB woff2 를 받아 간다(실측). 그래서 별도로 둔다.
//   · nt.css 를 import 하지 않는다 — 그러면 판식 CSS 가 메인 번들로 끌려온다.
//     스타일은 인라인 + 시스템 서체만(웹폰트 요청 0).
//   · 결측의 조판(설계 §2.2): 회색 막대 스켈레톤이 아니라 **계선과 빈 자리**.
// ════════════════════════════════════════════════════════════════════════
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/** stage = 근흑 무대 라우트(홈). 판이 검은데 로딩 자리만 희면 흰 섬광이 한 번 친다. */
const NtBoot: React.FC<{ stage?: boolean }> = ({ stage }) => {
  const bg = stage ? 'rgb(10,10,10)' : '#FAFAF9';
  const ink = stage ? 'rgb(220,221,211)' : '#0F0F1A';
  const line = stage ? 'rgba(220,221,211,.18)' : '#E4E2DC';
  const dim = stage ? 'rgb(116,116,116)' : '#B2B2B2';
  return (
    <div style={{ background: bg, minHeight: '100vh' }} aria-busy="true">
      <div
        style={{
          height: 56,
          display: 'grid',
          gridTemplateColumns: 'repeat(20, 1fr)',
          alignItems: 'center',
          borderBottom: `1px solid ${line}`,
        }}
      >
        <div style={{ gridColumn: '1 / 5', paddingLeft: 24, fontFamily: MONO, fontSize: 13, letterSpacing: '.02em', color: ink }}>
          NODE TREE
        </div>
        <div style={{ gridColumn: '16 / 21', paddingRight: 24, textAlign: 'right', fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', color: dim }}>
          讀誦 —— / 3029
        </div>
      </div>
      <div style={{ height: 1, background: line, margin: '128px calc(100vw / 20) 0' }} />
    </div>
  );
};

export default NtBoot;
