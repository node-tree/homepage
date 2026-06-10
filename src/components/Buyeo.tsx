import React from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';

/**
 * 부여 오디오 가이드 — 장소별 단독 페이지 (Buyeo Audio Guide, per-stop)
 *
 * 컨셉: QR 1개 = 사운드 1개. 각 장소(동선상 도착지)마다 QR이 있고,
 * 찍으면 그 장소의 오디오 가이드 페이지로 이동해 사운드 하나만 재생한다.
 *
 * 라우트: /buyeo/:stop  (예: /buyeo/1, /buyeo/2)
 *  - 현장에서 QR로 도달하므로 이 페이지는 공개(로그인 불필요).
 *  - 사이트 홈 메뉴의 진입 링크만 로그인 게이트(App.tsx에서 처리).
 *
 * 음원은 라이선스 이슈로 추후 퍼블릭도메인/직접제작 음원으로 교체 예정.
 * 장소 추가/음원 교체는 아래 BUYEO_STOPS 한 곳만 수정하면 된다(하드코딩 금지).
 */

// ─────────────────────────────────────────────────────────────
// 장소별 설정 — 음원/텍스트 교체·장소 추가는 여기서만 (하드코딩 금지)
// 새 장소를 추가하려면 이 배열에 항목 하나만 더하면 끝.
// ─────────────────────────────────────────────────────────────
interface BuyeoStop {
  /** 동선상 도착지 번호 (URL의 :stop 값과 일치) */
  stop: number;
  /** 장소명 */
  place: string;
  /** 페이지 부제 */
  subtitle: string;
  /** 그 장소용 안내 텍스트 (문단 배열) */
  guide: string[];
  /** 오디오 트랙 라벨 */
  trackLabel: string;
  /** 추후 퍼블릭도메인/직접제작 음원으로 교체. 지금은 임시 placeholder. */
  src: string;
}

const BUYEO_STOPS: BuyeoStop[] = [
  {
    stop: 1,
    place: '부여에 닿다',
    subtitle: '걸음이 시작되는 자리',
    guide: [
      '부여에 도착하셨습니다. 서두르지 않아도 됩니다.',
      '잠시 눈을 감고, 이 도시가 건네는 첫 소리에 귀를 열어 보세요. 오늘의 걸음이 여기에서 시작됩니다.',
    ],
    trackLabel: '도착의 소리',
    src: '/audio/buyeo-stop1.mp3',
  },
  {
    stop: 2,
    place: '오늘을 안고, 돌아가는 길',
    subtitle: '모든 걸음을 마치고',
    guide: [
      '오늘 하루, 당신 안에 두께가 생겼습니다. 역사도 풍경도 아닌, 이 도시를 통과하며 쌓인 겹.',
      '걸으며 길어 올린 다섯 개의 단어를 떠올려 보세요.',
      '이제 마지막 음악과 함께 돌아가는 길 위에서, 오늘을 가만히 되감아 봅니다. 그 안에 당신만의 부여가 있습니다.',
    ],
    trackLabel: '마지막 음악',
    src: '/audio/buyeo-stop2.mp3',
  },
];

/** stop 값으로 장소 데이터 조회. 없거나 잘못된 값이면 첫 장소로 폴백. */
function resolveStop(raw: string | undefined): BuyeoStop {
  const n = Number(raw);
  const found = BUYEO_STOPS.find((s) => s.stop === n);
  return found ?? BUYEO_STOPS[0];
}

// ─────────────────────────────────────────────────────────────
// 컴포넌트 — /buyeo/:stop 한 컴포넌트로 파라미터화
// ─────────────────────────────────────────────────────────────
export default function Buyeo() {
  const { stop } = useParams<{ stop: string }>();
  const data = resolveStop(stop);

  return (
    <div style={styles.page}>
      <main style={styles.container}>
        {/* 헤더 */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={styles.header}
        >
          <p style={styles.eyebrow}>NODE TREE · 부여 오디오 가이드</p>
          <h1 style={styles.title}>{data.place}</h1>
          <p style={styles.subtitle}>{data.subtitle}</p>
        </motion.header>

        {/* 안내 텍스트 (이 장소 전용) */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={styles.section}
        >
          {data.guide.map((para, i) => (
            <p key={i} style={styles.paragraph}>
              {para}
            </p>
          ))}
        </motion.section>

        {/* 오디오 플레이어 (이 장소의 사운드 하나만) */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={styles.section}
        >
          <h2 style={styles.sectionTitle}>오디오 가이드</h2>
          <span style={styles.trackLabel}>{data.trackLabel}</span>
          {/* 정적 플레이어 — 별도 cleanup 불필요. 소스는 BUYEO_STOPS에서 교체 */}
          <audio controls preload="none" src={data.src} style={styles.audio}>
            브라우저가 오디오 재생을 지원하지 않습니다.
          </audio>
        </motion.section>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 스타일 — 사이트 모노크롬 팔레트(#fff / #000 / 그레이) + S-CoreDream
// 반응형: clamp()와 maxWidth로 데스크톱/모바일 동시 대응
// ─────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#ffffff',
    color: '#000000',
    fontFamily: "'S-CoreDream', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  container: {
    maxWidth: '680px',
    margin: '0 auto',
    padding: 'clamp(64px, 12vw, 96px) clamp(20px, 6vw, 40px) 96px',
  },
  header: {
    marginBottom: 'clamp(40px, 8vw, 64px)',
  },
  eyebrow: {
    fontSize: '12px',
    letterSpacing: '0.2em',
    color: '#888888',
    margin: '0 0 12px',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 'clamp(28px, 7vw, 42px)',
    fontWeight: 600,
    lineHeight: 1.2,
    margin: '0 0 12px',
    color: '#000000',
  },
  subtitle: {
    fontSize: 'clamp(15px, 4vw, 18px)',
    fontWeight: 300,
    color: '#666666',
    margin: 0,
    lineHeight: 1.5,
  },
  section: {
    marginBottom: 'clamp(40px, 8vw, 56px)',
    paddingTop: 'clamp(28px, 6vw, 40px)',
    borderTop: '1px solid #e0e0e0',
  },
  sectionTitle: {
    fontSize: 'clamp(15px, 4vw, 17px)',
    fontWeight: 500,
    letterSpacing: '0.04em',
    color: '#000000',
    margin: '0 0 20px',
  },
  paragraph: {
    fontSize: 'clamp(15px, 4vw, 16px)',
    fontWeight: 300,
    lineHeight: 1.9,
    color: '#333333',
    margin: '0 0 16px',
  },
  note: {
    fontSize: '13px',
    color: '#888888',
    margin: '0 0 20px',
    lineHeight: 1.6,
  },
  trackLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 400,
    color: '#333333',
    marginBottom: '10px',
  },
  audio: {
    width: '100%',
  },
};
