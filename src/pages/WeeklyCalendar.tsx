import { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { exportShiftsICS, exportSpontaneousICS, googleCalendarLink } from '../utils/calendarExport';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const HOUR_START = 6;
const HOUR_END   = 22;
const HOURS      = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

function timeToY(time: string, hourPx: number, base = HOUR_START): number {
  const [h, m] = time.split(':').map(Number);
  return ((h - base) + m / 60) * hourPx;
}
function timeToPx(start: string, end: string, hourPx: number): number {
  const [hs, ms] = start.split(':').map(Number);
  const [he, me] = end.split(':').map(Number);
  return ((he - hs) + (me - ms) / 60) * hourPx;
}

/** Returns the Monday of the ISO week containing `date` */
function weekStart(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function fmtWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${monday.toLocaleDateString('en-DE', opts)} – ${sunday.toLocaleDateString('en-DE', opts)}`;
}

export default function WeeklyCalendar() {
  const { state } = useApp();
  const [offset, setOffset] = useState(0);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const nowLineRef = useRef<HTMLDivElement>(null);
  const bodyRef    = useRef<HTMLDivElement>(null);

  // Responsive hour height: smaller on mobile so entire day fits without scrolling
  const hourPx = useMemo(() => window.innerWidth < 768 ? 28 : 56, []);

  const today    = new Date();
  const baseMonday = weekStart(today);
  const monday   = addDays(baseMonday, offset * 7);
  const isCurrentWeek = offset === 0;

  // Scroll to current time on mount (desktop only — mobile shows full day)
  useEffect(() => {
    if (!isCurrentWeek || !bodyRef.current || hourPx < 56) return;
    const now = new Date();
    const y = timeToY(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`, hourPx);
    bodyRef.current.scrollTop = Math.max(0, y - 80);
  }, [isCurrentWeek, hourPx]);

  const todayStr = fmtDate(today);

  // Current time position
  const nowH = today.getHours();
  const nowM = today.getMinutes();
  const nowY = ((nowH - HOUR_START) + nowM / 60) * hourPx;
  const nowVisible = isCurrentWeek && nowH >= HOUR_START && nowH < HOUR_END;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Weekly Calendar</h2>
      </div>

      {/* Toolbar */}
      <div className="cal-toolbar">
        <button className="btn-ghost-sm" onClick={() => setOffset(o => o - 1)}>‹ Prev</button>
        <button className="btn-ghost-sm" onClick={() => setOffset(0)} disabled={offset === 0}>Today</button>
        <button className="btn-ghost-sm" onClick={() => setOffset(o => o + 1)}>Next ›</button>
        <span className="cal-week-label">{fmtWeekRange(monday)}</span>
        <button
          className="btn-ghost-sm"
          title="Export to .ics (importable into Google / Apple / Outlook Calendar)"
          onClick={() => exportShiftsICS(state.shiftBlocks)}
        >
          📥 Export .ics
        </button>
        <button
          className="btn-ghost-sm"
          title="Export extra sessions"
          onClick={() => exportSpontaneousICS(state.spontaneousOpenings)}
        >
          ⚡ Export extras
        </button>
      </div>

      {/* Calendar grid */}
      <div className="cal-wrap">
        {/* Header row */}
        <div className="cal-header">
          <div className="cal-header-cell" />
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(monday, i);
            const ds = fmtDate(d);
            const isTdy = ds === todayStr;
            return (
              <div key={i} className={`cal-header-cell ${isTdy ? 'cal-today' : ''}`}>
                {DAY_SHORT[i]}
                {isTdy
                  ? <span className="cal-header-date">{d.getDate()}</span>
                  : <span className="cal-header-date" style={{ fontSize: 16 }}>{d.getDate()}</span>
                }
              </div>
            );
          })}
        </div>

        {/* Body — CSS variable drives row heights; JS uses hourPx for absolute positions */}
        <div className="cal-body" ref={bodyRef} style={{ '--hour-px': `${hourPx}px` } as React.CSSProperties}>
          {/* Time column */}
          <div className="cal-time-col">
            {HOURS.map(h => (
              <div key={h} className="cal-time-label">
                {String(h).padStart(2,'0')}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {Array.from({ length: 7 }, (_, dow) => {
            const colDate = fmtDate(addDays(monday, dow));

            // Claimed shift blocks for this dow
            const shiftEvents = state.shiftBlocks
              .filter(s => s.dayOfWeek === dow && s.supervisorId)
              .map(s => ({
                id: s.id,
                start: s.startTime,
                end:   s.endTime,
                label: s.supervisorName ?? '',
                type: 'shift' as const,
                gcLink: googleCalendarLink(
                  `🏋️ Gym Open`,
                  colDate,
                  s.startTime,
                  s.endTime,
                  `Supervisor: ${s.supervisorName}`,
                ),
              }));

            // Free (unclaimed) blocks for this dow
            const freeEvents = state.shiftBlocks
              .filter(s => s.dayOfWeek === dow && !s.supervisorId)
              .map(s => ({
                id: s.id + '-free',
                start: s.startTime,
                end:   s.endTime,
                label: 'Unclaimed',
                type: 'free' as const,
                gcLink: '',
              }));

            // Spontaneous openings for this specific date
            const spontEvents = state.spontaneousOpenings
              .filter(sp => sp.date === colDate)
              .map(sp => ({
                id: sp.id,
                start: sp.startTime,
                end:   sp.endTime,
                label: sp.supervisorName,
                type: 'open' as const,
                gcLink: googleCalendarLink(
                  `⚡ Extra Session`,
                  colDate,
                  sp.startTime,
                  sp.endTime,
                  sp.note ?? '',
                ),
              }));

            const allEvents = [...freeEvents, ...shiftEvents, ...spontEvents];
            const isTdy = colDate === todayStr;

            return (
              <div key={dow} className="cal-day-col" style={{ background: isTdy ? 'var(--accent-dim)' : undefined }}>
                {/* Hour grid lines */}
                {HOURS.map(h => (
                  <div key={h} className="cal-hour-line" />
                ))}

                {/* Events */}
                {allEvents.map(ev => {
                  const top    = timeToY(ev.start, hourPx);
                  const height = Math.max(timeToPx(ev.start, ev.end, hourPx), 18);
                  const cls = ev.type === 'shift' ? 'cal-event-shift'
                             : ev.type === 'open'  ? 'cal-event-open'
                             : 'cal-event-free';
                  return (
                    <div
                      key={ev.id}
                      className={`cal-event ${cls}`}
                      style={{ top, height }}
                      onMouseEnter={e => {
                        const r = (e.target as HTMLElement).getBoundingClientRect();
                        setTooltip({ text: `${ev.start}–${ev.end} · ${ev.label}`, x: r.left, y: r.top - 32 });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => ev.gcLink && window.open(ev.gcLink, '_blank')}
                      title={ev.gcLink ? 'Click to add to Google Calendar' : undefined}
                    >
                      {ev.start}
                      <div className="cal-event-name">{ev.label}</div>
                    </div>
                  );
                })}

                {/* Now line */}
                {nowVisible && isTdy && (
                  <div
                    ref={nowLineRef}
                    className="cal-now-line"
                    style={{ top: nowY }}
                  >
                    <div className="cal-now-dot" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Export bar */}
        <div className="cal-export-bar">
          <span className="cal-export-label">📅 Google Calendar:</span>
          <button
            className="btn-ghost-sm"
            onClick={() => exportShiftsICS(state.shiftBlocks)}
          >
            Download .ics for Google / Apple / Outlook
          </button>
          <span className="cal-export-label" style={{ marginLeft: 8 }}>
            · Or click any shift block to add directly →
          </span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          top: tooltip.y,
          left: tooltip.x,
          background: 'var(--text)',
          color: 'var(--bg)',
          fontSize: 12,
          fontWeight: 500,
          padding: '5px 10px',
          borderRadius: 8,
          pointerEvents: 'none',
          zIndex: 999,
          whiteSpace: 'nowrap',
          boxShadow: 'var(--shadow-md)',
        }}>
          {tooltip.text}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text3)', alignItems: 'center' }}>
        <span><span style={{ background: 'var(--green-dim)', border: '1px solid var(--green)', borderRadius: 4, padding: '1px 6px', color: 'var(--green)', fontWeight: 600 }}>■</span> Covered shift</span>
        <span><span style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 4, padding: '1px 6px', color: 'var(--accent)', fontWeight: 600 }}>■</span> Spontaneous</span>
        <span><span style={{ background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: 4, padding: '1px 6px', color: 'var(--text3)', fontWeight: 600 }}>■</span> Unclaimed</span>
        <span style={{ marginLeft: 'auto' }}>Click block → Add to Google Calendar</span>
      </div>
    </div>
  );
}
