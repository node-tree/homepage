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

const NtBoot: React.FC = () => (
  <div style={{ background: '#FAFAF9', minHeight: '100vh' }} aria-busy="true">
    <div
      style={{
        height: 56,
        display: 'grid',
        gridTemplateColumns: 'repeat(20, 1fr)',
        alignItems: 'center',
        borderBottom: '1px solid #E4E2DC',
      }}
    >
      <div style={{ gridColumn: '1 / 5', paddingLeft: 24, fontFamily: MONO, fontSize: 13, letterSpacing: '.02em', color: '#0F0F1A' }}>
        NODE TREE
      </div>
      <div style={{ gridColumn: '16 / 21', paddingRight: 24, textAlign: 'right', fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', color: '#B2B2B2' }}>
        讀誦 —— / 3029
      </div>
    </div>
    <div style={{ height: 1, background: '#E4E2DC', margin: '128px calc(100vw / 20) 0' }} />
  </div>
);

export default NtBoot;
