import { useCallback, useState } from 'react';

const HEADCOUNT_ISSUE_LABELS = {
  missing: '缺少人數',
  invalid: '非法',
  'below-min': '小於 1',
  'non-integer': '非整數',
  truncated: '超過 10',
};

function summarizeHeadcountDiagnostics(guests) {
  const diagnostics = (guests ?? [])
    .filter(guest => guest._sourceHeadcountStatus && guest._sourceHeadcountStatus !== 'ok')
    .map(guest => ({
      name: guest.name,
      rawValue: guest._sourceHeadcountRaw,
      normalizedValue: guest.headcount,
      status: guest._sourceHeadcountStatus,
      message: guest._sourceHeadcountMessage,
    }));

  const counts = diagnostics.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  return { diagnostics, counts };
}

function formatHeadcountIssueCounts(counts) {
  return Object.entries(HEADCOUNT_ISSUE_LABELS)
    .map(([status, label]) => counts?.[status] > 0 ? `${label} ${counts[status]} 筆` : '')
    .filter(Boolean)
    .join('，');
}

export function useGuestImportFlow({ fetchGuests, importGuests, toast }) {
  const [lastImportSummary, setLastImportSummary] = useState(null);

  const handleImport = useCallback(async () => {
    try {
      const guests = await fetchGuests();
      if (!guests) return;
      if (guests.length === 0) {
        toast.info('來源試算表沒有可匯入的賓客');
        return;
      }

      const headcountIssues = summarizeHeadcountDiagnostics(guests);
      const missingHeadcountRows = headcountIssues.counts.missing ?? 0;

      const {
        added,
        updated = 0,
        skipped,
        sourceDuplicateRows = skipped ?? 0,
        assigned = 0,
        createdTables = 0,
        unassignedDueToFullTables = 0,
      } = importGuests(guests);

      setLastImportSummary({
        added,
        updated,
        skipped: sourceDuplicateRows,
        sourceDuplicateRows,
        assigned,
        createdTables,
        unassignedDueToFullTables,
        sourceRows: guests.length,
        missingHeadcountRows,
        invalidHeadcountRows: (headcountIssues.counts.invalid ?? 0) + (headcountIssues.counts['below-min'] ?? 0),
        nonIntegerHeadcountRows: headcountIssues.counts['non-integer'] ?? 0,
        truncatedHeadcountRows: headcountIssues.counts.truncated ?? 0,
        headcountIssueCounts: headcountIssues.counts,
        headcountDiagnostics: headcountIssues.diagnostics,
        importedAt: new Date().toISOString(),
      });

      const details = [];
      if (assigned > 0) details.push(`依桌次安排 ${assigned} 位`);
      if (createdTables > 0) details.push(`新增 ${createdTables} 張桌次`);
      if (unassignedDueToFullTables > 0) {
        details.push(`${unassignedDueToFullTables} 位因桌次已滿保留未分配`);
      }
      const suffix = details.length > 0 ? `（${details.join('，')}）` : '';
      const updatedText = updated > 0 ? `，更新 ${updated} 筆既有來源` : '';
      const duplicateText = sourceDuplicateRows > 0
        ? `，略過 ${sourceDuplicateRows} 筆來源內重複列`
        : '';

      if (added === 0 && updated === 0 && details.length === 0) {
        toast.info(`沒有新增資料${duplicateText}`);
      } else if (added === 0) {
        toast.success(`已更新 ${updated} 筆既有來源${duplicateText}${suffix}`);
      } else if (sourceDuplicateRows > 0) {
        toast.success(`新增 ${added} 位座位需求${updatedText}${duplicateText}${suffix}`);
      } else {
        toast.success(`已匯入 ${added} 位座位需求${updatedText}${suffix}`);
      }

      if (headcountIssues.diagnostics.length > 0) {
        const issueSummary = formatHeadcountIssueCounts(headcountIssues.counts);
        toast.warn(`匯入人數需確認：${issueSummary}；已用安全值處理，請到「賓客」資料品質查看。`);
      }
    } catch (err) {
      toast.error(`匯入失敗：${err?.message ?? '未知錯誤'}`);
    }
  }, [fetchGuests, importGuests, toast]);

  return {
    lastImportSummary,
    handleImport,
  };
}
