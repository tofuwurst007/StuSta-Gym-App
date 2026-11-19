import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { downloadScheduleWorkbook, plannableStaff } from '../utils/excelExport';
import { formatWeekRange } from '../utils/week';
import { blocksForWeek } from '../utils/assignments';

export default function ExcelExportButton({ weekStart, label = '⬇ Excel' }: { weekStart: string; label?: string }) {
  const { state } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const availabilities = state.availabilities.filter(a => a.weekStart === weekStart);
      await downloadScheduleWorkbook({
        weekStart,
        shiftBlocks: blocksForWeek(state.shiftBlocks, state.assignments, weekStart),
        availabilities,
        supervisors: plannableStaff(state.users, availabilities),
      });
    } catch (err) {
      console.error('[ExcelExport] failed:', err);
      setError("Couldn't create the Excel file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="btn-ghost-sm"
        onClick={run}
        disabled={busy || state.shiftBlocks.length === 0}
        title={`Shift plan + availabilities for ${formatWeekRange(weekStart)} as .xlsx`}
      >
        {busy ? 'Exporting…' : label}
      </button>
      {error && <span className="form-error" role="alert">{error}</span>}
    </>
  );
}
