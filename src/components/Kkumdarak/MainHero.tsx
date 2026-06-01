import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MOTION } from './data';
import HeroScene from './HeroScene';

const MainHero: React.FC = () => {
  const reduced = useReducedMotion();

  return (
    <div className="kd-hero">
      <motion.div
        className="kd-hero-stage"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: MOTION.durBase, ease: MOTION.ease }}
      >
        <HeroScene />
      </motion.div>
    </div>
  );
};

export default MainHero;
