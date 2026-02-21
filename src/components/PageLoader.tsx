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
        }}
      >
        {message}
      </motion.p>
    </div>
  );
};

export default PageLoader;
