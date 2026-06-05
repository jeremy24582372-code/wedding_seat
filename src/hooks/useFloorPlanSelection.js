import { useCallback, useState } from 'react';

function isAdditiveSelectionEvent(event) {
  return event.shiftKey || event.ctrlKey || event.metaKey;
}

export function useFloorPlanSelection() {
  const [selectedTableIds, setSelectedTableIds] = useState(() => new Set());

  const clearSelectedTables = useCallback(() => {
    setSelectedTableIds(new Set());
  }, []);

  const updateTableSelection = useCallback((tableId, additive = false) => {
    setSelectedTableIds(prev => {
      if (additive) {
        const next = new Set(prev);
        next.has(tableId) ? next.delete(tableId) : next.add(tableId);
        return next;
      }

      return prev.size === 1 && prev.has(tableId)
        ? new Set()
        : new Set([tableId]);
    });
  }, []);

  const selectTableFromPointer = useCallback((event, tableId) => {
    updateTableSelection(tableId, isAdditiveSelectionEvent(event));
  }, [updateTableSelection]);

  const handleTableWrapperClick = useCallback((event, tableId) => {
    if (!isAdditiveSelectionEvent(event)) return;
    event.stopPropagation();
    updateTableSelection(tableId, true);
  }, [updateTableSelection]);

  return {
    selectedTableIds,
    clearSelectedTables,
    selectTableFromPointer,
    handleTableWrapperClick,
  };
}
