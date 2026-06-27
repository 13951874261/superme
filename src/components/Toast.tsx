import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose?: () => void;
}

let toastEmitter: ((props: ToastProps) => void) | null = null;

export const showToast = (props: ToastProps | { message: string } | string) => {
  if (toastEmitter) {
    if (typeof props === 'string') {
      toastEmitter({ message: props, type: 'info' });
    } else {
      toastEmitter(props);
    }
  }
};

export const showInfo = (message: string, duration = 3000) => showToast({ message, type: 'info', duration });
export const showSuccess = (message: string, duration = 3000) => showToast({ message, type: 'success', duration });
export const showError = (message: string, duration = 3000) => showToast({ message, type: 'error', duration });
export const showWarning = (message: string, duration = 3000) => showToast({ message, type: 'warning', duration });

const TYPE_CONFIG = {
  success: {
    bg: 'bg-emerald-500/90',
    border: 'border-emerald-600',
    icon: CheckCircle2,
    iconColor: 'text-white',
  },
  error: {
    bg: 'bg-red-500/90',
    border: 'border-red-600',
    icon: XCircle,
    iconColor: 'text-white',
  },
  info: {
    bg: 'bg-blue-500/90',
    border: 'border-blue-600',
    icon: Info,
    iconColor: 'text-white',
  },
  warning: {
    bg: 'bg-amber-500/90',
    border: 'border-amber-600',
    icon: AlertTriangle,
    iconColor: 'text-white',
  },
} as const;

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

  const config = TYPE_CONFIG[toast?.type || 'info'];

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
            px-6 py-3 rounded-xl shadow-lg border backdrop-blur-md font-semibold text-sm tracking-wide text-white
            flex items-center gap-2
            ${config.bg}
            ${config.border}
          `}>
            {React.createElement(config.icon, {
              className: `w-4 h-4 ${config.iconColor}`,
            })}
            {toast.message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
