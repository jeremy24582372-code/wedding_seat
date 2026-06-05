import { useCallback, useState } from 'react';
import { createAutoSeatPreview } from '../utils/autoSeatPlanner';

export function useAutoSeatFlow({ state, applyAutoSeatPlan, setActiveTab, toast }) {
  const [showAutoSeatRules, setShowAutoSeatRules] = useState(false);
  const [autoSeatPreview, setAutoSeatPreview] = useState(null);

  const handleOpenAutoSeat = useCallback(() => {
    setAutoSeatPreview(null);
    setShowAutoSeatRules(true);
  }, []);

  const handleCloseAutoSeat = useCallback(() => {
    setAutoSeatPreview(null);
    setShowAutoSeatRules(false);
  }, []);

  const handleCreateAutoSeatPreview = useCallback((rules) => {
    const preview = createAutoSeatPreview(state, rules);
    setAutoSeatPreview(preview);

    if (preview.summary.candidateMoveCount === 0 && preview.summary.createdTableCount === 0) {
      toast.info('目前沒有可套用的自動排座建議');
    } else {
      toast.success(`已產生預覽：建議安排 ${preview.summary.candidateMoveCount} 位`);
    }
  }, [state, toast]);

  const handleApplyAutoSeatPreview = useCallback(() => {
    if (!autoSeatPreview) {
      toast.warn('請先產生自動排座預覽');
      return;
    }

    const result = applyAutoSeatPlan(autoSeatPreview.plan);
    if (!result.success) {
      toast.warn(result.reason ?? '無法套用自動排座預覽');
      return;
    }

    toast.success(`已套用自動排座：安排 ${autoSeatPreview.summary.candidateMoveCount} 位`);
    handleCloseAutoSeat();
    setActiveTab('seating');
  }, [applyAutoSeatPlan, autoSeatPreview, handleCloseAutoSeat, setActiveTab, toast]);

  return {
    showAutoSeatRules,
    autoSeatPreview,
    handleOpenAutoSeat,
    handleCloseAutoSeat,
    handleCreateAutoSeatPreview,
    handleApplyAutoSeatPreview,
    clearAutoSeatPreview: () => setAutoSeatPreview(null),
  };
}
