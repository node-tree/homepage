import React from 'react';
import { motion } from 'framer-motion';

interface PageLoaderProps {
  message?: string;
}

const PageLoader: React.FC<PageLoaderProps> = ({ message = '불러오는 중...' }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '20px',
    }}>
      <div style={{
        display: 'flex',
        gap: '6px',
        alignItems: 'center',
      }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#999',
            }}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        style={{
          fontSize: '0.85rem',
          color: '#999',
          letterSpacing: '0.05em',
          fontWeight: 300,
          // [perf] 본문 폰트(S-CoreDream)를 상속하면 이 한 줄(한글·weight 300) 때문에
          //   SCDream3.woff2 169KB 를 lazy 라우트마다 받는다 — 정작 0.3초 뒤 사라지는 문구다.
          //   (생산소는 S-CoreDream 을 아예 쓰지 않는데도 페이지 무게의 22% 를 이걸로 썼다. 2026-08-30 실측)
          //   대체 문구이므로 시스템 폰트로 그린다.
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        {message}
      </motion.p>
    </div>
  );
};

export default PageLoader;
