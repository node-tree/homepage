import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './Popup.css';

interface PopupProps {
  open: boolean;
  message: string;
}

const Popup: React.FC<PopupProps> = ({ open, message }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div 
          className="popup-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="popup-box"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="popup-message">{message}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Popup; 