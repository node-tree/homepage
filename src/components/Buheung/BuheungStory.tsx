// ═══════════════════════════════════════════════════════════════════════
// BuheungStory.tsx — 부흥여지도 「이야기」 패널
//   글 정본: 피그마 슬라이드 GwrkmlIy8sqBwjy0onDbTq(청소년 발표 19장) + B3 포스터 L7mc18Be…(시안 C).
//   청소년 문장은 그대로 두고, 발표 진행 문장·발표자·날짜만 뺐다. 대시는 포스터처럼 쉼표·가운뎃점으로.
//   지도 위에 겹쳐 열리고, 닫아도 읽던 자리를 기억한다(언마운트하지 않고 숨긴다).
// ═══════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef } from 'react';

const IMG = (n: string) => `/buheung/${n}.jpg`;

const STEPS = [
  { n: 1, kicker: '과거 · 듣다', title: '부여의 옛날 이야기를 듣고, 상상여행을 떠났습니다',
    text: '어르신들의 이야기를 듣고, 관심있게 들었던 장면을 연필이랑 색연필로 그렸습니다. 신호를 처음으로 연결했어요.',
    imgs: [['p1-listen', '청소년들이 연필과 색연필로 그린 옛 부여 장면들']] },
  { n: 2, kicker: '현재 · 보다', title: '우리가 현재 사는 마을 지도를 그렸어요',
    text: '종이 위에 종이 테이프로 그리다보니, 엉뚱한 생각과 재미있는 장면이 떠올랐어요.',
    imgs: [['p2-draw', '종이 테이프로 그린 마을 지도']] },
  { n: 3, kicker: '', title: '신호의 발견, 도시의 순환 시스템을 이해하다',
    text: '익숙한 도시를 전기 신호로 해석하다보니, 자연스럽게 각자 좋아하는 도시를 만들게 되었어요.',
    imgs: [['p3-signal', '나무판 도시에 전기 신호를 연결하는 손']] },
  { n: 4, kicker: '', title: '상상하고 도시를 건축하다',
    text: '다양한 크기의 나무를 선택하고, 장갑을 끼고 사포로 문질러서 모서리를 둥글게 만들며, 나의 도시를 생각합니다.',
    imgs: [['p4a-build', '장갑을 끼고 사포로 나무 조각을 다듬는 손'], ['p4b-build', '나무판 위에 세운 나무 블록']] },
  { n: 5, kicker: '', title: '재료를 고르고 표면을 입히다',
    text: '포스카 펜, 찰흙, 구슬, 색종이. 도시의 바닥과 벽을 무엇으로 덮을지 하나씩 직접 정했어요.',
    imgs: [['p5-surface', '포스카 펜으로 나무판에 색을 입히는 손']] },
  { n: 6, kicker: '', title: '나의 도시가 모여 우리의 도시가 되다',
    text: '각자 만든 나무판을 이어 붙이니 길이 생기고, 블록이 생기고, 도시가 됐어요.',
    imgs: [['p6-together', '이어 붙인 나무판 도시']] },
];

const FUTURE = [
  ['f1-cherry', '체리 베리 광장 · 개구리 왕국 · UFO 정수대'],
  ['f2-dream', 'DREAM 터널이 있는 밤의 부여'],
  ['f3-river', '백마강 위에 올린 미래, 태양광 · 수직 농장 · 홀로그램 경기장'],
];

const MAKERS = '강다빈 · 김용민 · 문승민 · 서예슬 · 이하은 · 임수지 · 최영민 · 최영준 · 최지율 · 표제유';

const BuheungStory: React.FC<{ open: boolean; onClose: () => void; onShowList: () => void }> = ({ open, onClose, onShowList }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <aside className={`bh-story${open ? ' is-open' : ''}`} aria-hidden={!open} aria-label="부흥여지도 이야기" role="dialog">
      <div className="bh-story-bar">
        <span>이야기</span>
        <button ref={closeRef} className="bh-story-close" onClick={onClose} tabIndex={open ? 0 : -1}>지도 보기</button>
      </div>

      <header className="bh-story-head">
        <div className="bh-plate">
          <img src="/buheung/lettering.svg" alt="부흥여지도" width={668} height={176} />
        </div>
        <p className="bh-hanja">扶餘 · 復興 · 輿地圖</p>
        <p className="bh-sub">청소년이 찾아낸 부여의 가능성</p>
      </header>
      <img className="bh-wide" src={IMG('cover')} alt="청소년들이 나무판으로 만든 부여 도시 모형" loading="lazy" />

      <section className="bh-sec">
        <p className="bh-lead">부여에는 문화도 있고, 역사도 있어요.</p>
        <h2>그런데 지금 여기 사는<br />우리 이야기는 없었어요</h2>
        <p>그래서 우리 이야기를 펼쳐 보려고 시작했습니다.</p>
      </section>

      <section className="bh-sec">
        <h3>우리는 질문부터 시작했어요</h3>
        <ol className="bh-q">
          <li><span>과거 · 듣다</span>할머니가 기억하는 부여는 어떤 모습일까?</li>
          <li><span>현재 · 보다</span>내가 매일 가는 곳을 소개하는 지도는 있을까?</li>
          <li><span>미래 · 상상하다</span>10년 뒤 여기엔 뭐가 있으면 좋을까?</li>
        </ol>
        <p>이 세 가지 질문에서 프로젝트가 시작됐습니다.</p>
      </section>

      <section className="bh-sec bh-sec--ink">
        <p className="bh-lead">많은 사람들이 우리가 사는 곳을 ‘시골’이라고 불러요</p>
        <div className="bh-big" aria-hidden="true">泗沘</div>
        <p>그런데 지금부터 1500년쯤 전, 여기는 백제의 수도였어요. 성벽을 두르고, 길을 내고, 절과 연못을 두고 계획해서 지은 도성, 사비(泗沘)입니다.</p>
        <h2>부여는 원래부터 도시였어요.</h2>
      </section>

      <section className="bh-sec">
        <h3>그런데, 도시가 뭘까요?</h3>
        <div className="bh-dosi">
          <div><b aria-hidden="true">都</b><span>모일 도</span>사람이 모이는 곳</div>
          <div><b aria-hidden="true">市</b><span>저자 시</span>장이 서는 곳</div>
        </div>
        <h2>글자 어디에도 ‘크다’는 없어요.</h2>
        <p>부여에는 사비도성(都)이 있었고, 지금도 오일장(市)이 서요. 글자 그대로 도시예요.</p>
        <div className="bh-three">
          <div><span>1500년 전</span><b>이미 도시였다</b>성벽 두르고 길 내고 절과 연못까지 둔 계획 도성, 사비(泗沘). 부소산성·정림사지·궁남지가 그 흔적이에요.</div>
          <div><span>지금</span><b>조건을 갖췄다</b>도로·병원·학교·공공기관. 부여에는 다 있고 전부 우리가 매일 써요. 도시는 크기가 아니라 조건이니까요.</div>
          <div><span>앞으로</span><b>지을 자리가 남았다</b>없는 건 우리가 먼저 지어 봤어요. 비어 있다는 건 지을 수 있다는 뜻이에요.</div>
        </div>
      </section>

      {STEPS.map(s => (
        <section className="bh-sec bh-step" key={s.n}>
          <p className="bh-step-n"><b>{s.n}</b>{s.kicker}</p>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
          {s.imgs.map(([src, alt]) => <img key={src} src={IMG(src)} alt={alt} loading="lazy" />)}
        </section>
      ))}

      <section className="bh-sec">
        <p className="bh-step-n"><b>7</b>미래 · 상상하다</p>
        <h2>우리가 상상하는 미래 부여</h2>
        {FUTURE.map(([src, cap]) => (
          <figure key={src}>
            <img src={IMG(src)} alt={cap} loading="lazy" />
            <figcaption>{cap}</figcaption>
          </figure>
        ))}
      </section>

      <section className="bh-sec bh-sec--yellow">
        <p className="bh-lead">미래를 그리려면, 지금 어디를 다니는지부터 알아야 했어요.</p>
        <h2>우리가 자주 가는 장소 39곳</h2>
        <p>부여의 명소 소개는 많습니다. 우리의 지도는 기존 소개와 우리가 자주가는 장소를 겹쳐놓았어요.</p>
        <h3>심상지도</h3>
        <p>설명은 일부러 넣지 않았어요. 검색하면 다 나오는 세상에서 살고 있으니까요! 그래서 검색창에 쳐도 안 나오는 것들을 적었어요. 백중 농구장, 아파트 놀이터, 우리 집 앞. 부여의 진짜 풍경을 느끼려면 부흥여지도를 따라가세요.</p>
        <button className="bh-btn" onClick={onShowList} tabIndex={open ? 0 : -1}>지도에서 39곳 보기</button>
      </section>

      <section className="bh-sec">
        <h2>이건 제안서이기도 해요</h2>
        <p>요즘, 우리에게는 상상을 펼치는 기회가 없어요. 그래서 우리가 바라는 부여를 직접 조사하고 지도로 그렸어요. 지도에는 검색의 시대를 살아가는 현재와, 우리의 상상이 담겨 있어요.</p>
        <p>이 지도를 부여군과 주민들께 전달하려고 해요. 우리가 그린 도시를 보고, 한 가지라도 함께 고민해 주세요. 청소년이 바라는 마을도 계획의 일부가 될 수 있도록요.</p>
      </section>

      <section className="bh-sec bh-sec--ink bh-end">
        <div className="bh-big" aria-hidden="true">復興</div>
        <h2>부여는<br />가능성의 도시입니다</h2>
        <p className="bh-lead">부흥(復興), 다시 일어난다는 뜻이에요.</p>
        <p>저희가 각자 만든 도시를 모았더니 부여의 가능성이 보였어요. 그걸 담은 지도가 ‘부흥여지도’입니다.</p>
      </section>

      <footer className="bh-credit">
        <p><b>함께 그린 사람들</b>{MAKERS}</p>
        <p>부여군청소년문화의집 지역사회변화프로젝트 · 제7차 청소년정책 자기주도 봉사활동</p>
        <p>충청남도 · 충청남도교육청 · 충남사회서비스원 · 부여군청소년문화의집 · 2026</p>
      </footer>
    </aside>
  );
};

export default BuheungStory;
