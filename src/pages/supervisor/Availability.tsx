import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { DAY_NAMES } from '../../utils/openingHours';
import { addWeeks, dateOfWeekDay, formatShortDate, getNextWeekStart, getWeekStart, isAvailabilityDue } from '../../utils/week';
import WeekSwitcher from '../../components/WeekSwitcher';

export default function Availability() {
  const { state, dispatch } = useApp();
  const { currentUser } = useAuth();
  const [weekStart, setWeekStart] = useState(getNextWeekStart());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [dirty, setDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);

  const existing = currentUser
    ? state.availabilities.find(a => a.supervisorId === currentUser.id && a.weekStart === weekStart)
    : undefined;

  useEffect(() => {
    setSelected(new Set(existing?.shiftBlockIds ?? []));
    setNote(existing?.note ?? '');
    setDirty(false);
  }, [weekStart, existing?.updatedAt]);

  const blocksByDay = useMemo(() => DAY_NAMES.map((_, dow) =>
    state.shiftBlocks
      .filter(s => s.dayOfWeek === dow)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  ), [state.shiftBlocks]);

  if (!currentUser) return null;

  const allIds = state.shiftBlocks.map(s => s.id);
  const validSelectedCount = allIds.filter(id => selected.has(id)).length;

  const update = (next: Set<string>) => { setSelected(next); setDirty(true); setSavedFlash(false); };

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    update(next);
  };

  const toggleDay = (dow: number) => {
    const ids = blocksByDay[dow].map(s => s.id);
    const allOn = ids.every(id => selected.has(id));
    const next = new Set(selected);
    ids.forEach(id => allOn ? next.delete(id) : next.add(id));
    update(next);
  };

  const save = async () => {
    setSaving(true);
    const res = await dispatch({
      type: 'UPSERT_AVAILABILITY',
      payload: {
        id: existing?.id ?? `av-${Date.now()}`,
        supervisorId: currentUser.id,
        supervisorName: currentUser.name,
        weekStart,
        shiftBlockIds: allIds.filter(id => selected.has(id)),
        note: note.trim() || undefined,
        updatedAt: new Date().toISOString(),
      },
    });
    setSaving(false);
    if (!res.ok) return; // the error banner shows why
    setDirty(false);
    setSavedFlash(true);
  };

  const currentWeek = getWeekStart();
  const isNextWeek = weekStart === getNextWeekStart();
  const showDueWarning = !existing && isNextWeek && isAvailabilityDue();

  const updatedLabel = existing
    ? new Date(existing.updatedAt).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="page availability-page">
      <div className="page-header">
        <div>
          <h2>My Availability</h2>
          <p className="page-subtitle">Tap every shift you could take. The admin assigns shifts from this.</p>
        </div>
      </div>

      <WeekSwitcher
        weekStart={weekStart}
        onChange={w => { if (!dirty || window.confirm('Discard your unsaved changes for this week?')) setWeekStart(w); }} minWeek={currentWeek} maxWeek={addWeeks(currentWeek, 4)} />

      {showDueWarning && (
        <div className="banner banner-warn" role="status">
          <span className="banner-icon">⏰</span>
          <span>Please submit your availability for next week so the admin can plan the shifts.</span>
        </div>
      )}
      {existing && !dirty && (
        <div className="banner banner-ok" role="status" data-testid="availability-submitted">
          <span className="banner-icon">✓</span>
          <span>{savedFlash ? 'Saved! ' : ''}Submitted · last updated {updatedLabel}</span>
        </div>
      )}
      {!existing && !showDueWarning && !dirty && (
        <div className="banner banner-info" role="status">
          <span className="banner-icon">ℹ</span>
          <span>Not submitted yet for this week.</span>
        </div>
      )}

      <div className="avail-toolbar">
        <span className="avail-count"><strong>{validSelectedCount}</strong> of {allIds.length} shifts selected</span>
        <div className="avail-toolbar-actions">
          <button className="btn-ghost-sm" onClick={() => update(new Set(allIds))} disabled={allIds.length === 0}>Select all</button>
          <button className="btn-ghost-sm" onClick={() => update(new Set())} disabled={validSelectedCount === 0}>Clear</button>
        </div>
      </div>

      {allIds.length === 0 ? (
        <p className="empty-state">No shifts are defined in the shift plan yet.</p>
      ) : (
        <div className="avail-days">
          {DAY_NAMES.map((day, dow) => {
            const blocks = blocksByDay[dow];
            if (blocks.length === 0) return null;
            const dayCount = blocks.filter(b => selected.has(b.id)).length;
            const allOn = dayCount === blocks.length;
            return (
              <div key={dow} className={`avail-day ${dayCount > 0 ? 'avail-day-active' : ''}`}>
                <div className="avail-day-head">
                  <span className="avail-day-name">
                    {day} <span className="avail-day-date">{formatShortDate(dateOfWeekDay(weekStart, dow))}</span>
                  </span>
                  <button className="avail-day-toggle" onClick={() => toggleDay(dow)}>
                    {allOn ? 'None' : 'All day'}
                  </button>
                </div>
                <div className="avail-chips">
                  {blocks.map(b => {
                    const on = selected.has(b.id);
                    return (
                      <button
                        key={b.id}
                        className={`avail-chip ${on ? 'avail-chip-on' : ''}`}
                        onClick={() => toggle(b.id)}
                        aria-pressed={on}
                      >
                        <span className="avail-chip-check">{on ? '✓' : '+'}</span>
                        {b.startTime}–{b.endTime}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="form-row">
        <label className="form-label" htmlFor="avail-note">Note for the admin (optional)</label>
        <textarea
          id="avail-note"
          className="form-input"
          rows={2}
          maxLength={300}
          placeholder="e.g. exam on Wednesday, prefer max. 3 shifts"
          value={note}
          onChange={e => { setNote(e.target.value); setDirty(true); setSavedFlash(false); }}
        />
      </div>

      <div className={`save-bar ${dirty ? 'save-bar-dirty' : ''}`}>
        <span className="save-bar-text">{dirty ? 'Unsaved changes' : existing ? 'All changes saved' : 'Nothing submitted yet'}</span>
        <button className="btn-primary" onClick={save} disabled={saving || (!dirty && !!existing)}>
          {saving ? 'Saving…' : existing ? 'Update availability' : 'Submit availability'}
        </button>
      </div>
    </div>
  );
}
