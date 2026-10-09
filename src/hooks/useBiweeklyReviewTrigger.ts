import { useState, useEffect, useCallback } from 'react';
import { getLastReviewDate } from '../utils/reviewHelper';

export function useBiweeklyReviewTrigger() {
  const [shouldShowCard, setShouldShowCard] = useState(false);
  const [shouldForceModal, setShouldForceModal] = useState(false);
  const [daysSinceReview, setDaysSinceReview] = useState(0);

  const checkPeriod = useCallback(() => {
    const lastDate = getLastReviewDate();
    const diffMs = Date.now() - lastDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    setDaysSinceReview(diffDays);
    setShouldShowCard(diffDays >= 14);
    setShouldForceModal(diffDays >= 17);
  }, []);

  useEffect(() => {
    checkPeriod();
    const interval = setInterval(checkPeriod, 60 * 60 * 1000);
    window.addEventListener('superme-review-date-changed', checkPeriod);
    return () => {
      clearInterval(interval);
      window.removeEventListener('superme-review-date-changed', checkPeriod);
    };
  }, [checkPeriod]);

  return { shouldShowCard, shouldForceModal, daysSinceReview, checkPeriod };
}
