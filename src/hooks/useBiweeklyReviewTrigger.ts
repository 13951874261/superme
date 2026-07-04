import { useState, useEffect } from 'react';
import { getLastReviewDate } from '../utils/reviewHelper';

export function useBiweeklyReviewTrigger() {
  const [shouldShowCard, setShouldShowCard] = useState(false);
  const [shouldForceModal, setShouldForceModal] = useState(false);

  const checkPeriod = () => {
    const lastDate = getLastReviewDate();
    const diffMs = Date.now() - lastDate;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    setShouldShowCard(diffDays >= 14);
    setShouldForceModal(diffDays >= 17);
  };

  useEffect(() => {
    checkPeriod();
    const interval = setInterval(checkPeriod, 60000 * 60);
    window.addEventListener('superme-review-date-changed', checkPeriod);
    return () => {
      clearInterval(interval);
      window.removeEventListener('superme-review-date-changed', checkPeriod);
    };
  }, []);

  return { shouldShowCard, shouldForceModal };
}
