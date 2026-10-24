import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';

function BackgroundOverlayComponent() {
  const [bgEnabled, setBgEnabled] = useState(() => {
    return localStorage.getItem('super_agent_bg_enabled') !== 'false';
  });
  
  const [bgIndex, setBgIndex] = useState(() => {
    return parseInt(localStorage.getItem('super_agent_bg_index') || '0', 10);
  });

  const [bgBlur, setBgBlur] = useState(() => {
    return parseInt(localStorage.getItem('super_agent_bg_blur') || '10', 10);
  });

  const [bgOpacity, setBgOpacity] = useState(() => {
    return parseFloat(localStorage.getItem('super_agent_bg_opacity') || '0.45');
  });

  useEffect(() => {
    const handleSettingsChange = () => {
      setBgEnabled(localStorage.getItem('super_agent_bg_enabled') !== 'false');
      setBgIndex(parseInt(localStorage.getItem('super_agent_bg_index') || '0', 10));
      setBgBlur(parseInt(localStorage.getItem('super_agent_bg_blur') || '10', 10));
      setBgOpacity(parseFloat(localStorage.getItem('super_agent_bg_opacity') || '0.45'));
    };

    window.addEventListener('global-settings-changed', handleSettingsChange);
    return () => {
      window.removeEventListener('global-settings-changed', handleSettingsChange);
    };
  }, []);

  if (!bgEnabled) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none transform-gpu [contain:strict] will-change-transform">
      {/* Background image layer with popLayout cross-fade */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={bgIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transform-gpu"
          style={{
            backgroundImage: `url(/images/backgrounds/bg-${bgIndex + 1}.jpg)`,
          }}
        />
      </AnimatePresence>

      {/* Glassmorphism glass blur & overlay layer - GPU isolated */}
      <div 
        className="absolute inset-0 transition-opacity duration-300 transform-gpu"
        style={{
          backdropFilter: `blur(${bgBlur}px)`,
          WebkitBackdropFilter: `blur(${bgBlur}px)`,
          backgroundColor: `rgba(248, 249, 250, ${bgOpacity})`, // F8F9FA matching main body background
        }}
      />
    </div>
  );
}

const BackgroundOverlay = memo(BackgroundOverlayComponent);
export default BackgroundOverlay;

