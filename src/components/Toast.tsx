import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose?: () => void;
}

// 全局 Toast 状态管理器（简化版）
let toastEmitter: ((props: ToastProps) => void) | null = null;

export const showToast = (props: ToastProps | string) => {
  if (toastEmitter) {
    if (typeof props === 'string') {
      toastEmitter({ message: props });
    } else {
      toastEmitter(props);
    }
  }
};

export const ToastProvider: React.FC = () => {
  const [toast, setToast] = useState<ToastProps | null>(null);

  useEffect(() => {
    toastEmitter = (props) => {
      setToast(props);
      if (props.duration !== 0) {
        setTimeout(() => {
          setToast((current) => (current?.message === props.message ? null : current));
          if (props.onClose) props.onClose();
        }, props.duration || 3000);
      }
    };
    return () => { toastEmitter = null; };
  }, []);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999]"
        >
          <div className={`
            px-6 py-3 rounded-xl shadow-lg border backdrop-blur-md font-semibold text-sm tracking-wide
            ${toast.type === 'error' ? 'bg-red-500/90 text-white border-red-600' : 'bg-[#202124]/90 text-white border-gray-700'}
          `}>
            {toast.message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
