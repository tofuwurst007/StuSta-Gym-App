import type { ShiftAssignment, ShiftBlock, SpontaneousOpening } from '../types';
import { localISODate } from './date';
import { dateOfWeekDay } from './week';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Europe/Berlin definition so DTSTART;TZID=Europe/Berlin is valid (RFC 5545 §3.6.5)
const VTIMEZONE_BERLIN = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Berlin',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

function icsDate(date: string, time: string): string {
  // YYYYMMDDTHHMMSS, interpreted in the TZID given on the property
  const [y, m, d] = date.split('-');
  const [h, min] = time.split(':');
  return `${y}${m}${d}T${h}${min}00`;
}

/** UTC timestamp for DTSTAMP, e.g. 20261004T183000Z */
function icsStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Escape TEXT values: backslash, semicolon, comma, newline */
function esc(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold lines longer than 75 octets (UTF-8) with CRLF + space */
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  for (const ch of line) {
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (enc.encode(cur + ch).length > limit) { parts.push(cur); cur = ''; }
    cur += ch;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

function download(lines: string[], filename: string): void {
  const ics = lines.map(fold).join('\r\n') + '\r\n';
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportShiftsICS(shiftBlocks: ShiftBlock[], assignments: ShiftAssignment[]): void {
  const stamp = icsStamp();
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StuSta Gym//Shift Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:StuSta Gym Schedule',
    'X-WR-TIMEZONE:Europe/Berlin',
    ...VTIMEZONE_BERLIN,
  ];

  // Shifts are planned week by week, so every covered shift is one dated event (from today on)
  const today = localISODate();
  const blocks = new Map(shiftBlocks.map(b => [b.id, b]));
  const events = assignments
    .map(a => ({ a, shift: blocks.get(a.shiftBlockId) }))
    .filter((e): e is { a: ShiftAssignment; shift: ShiftBlock } => !!e.shift)
    .map(({ a, shift }) => ({ a, shift, date: localISODate(dateOfWeekDay(a.weekStart, shift.dayOfWeek)) }))
    .filter(e => e.date >= today)
    .sort((x, y) => x.date.localeCompare(y.date) || x.shift.startTime.localeCompare(y.shift.startTime));

  for (const { a, shift, date } of events) {
    // Names are only loaded for staff; members export the plain schedule
    const by = a.supervisorName ? ` — ${a.supervisorName}` : '';
    lines.push(
      'BEGIN:VEVENT',
      `UID:shift-${shift.id}-${a.weekStart}@stusta-gym`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Berlin:${icsDate(date, shift.startTime)}`,
      `DTEND;TZID=Europe/Berlin:${icsDate(date, shift.endTime)}`,
      `SUMMARY:${esc(`🏋️ Gym Open${by}`)}`,
      `DESCRIPTION:${esc(`Supervised gym session${by ? ` by ${a.supervisorName}` : ''} (${DAY_NAMES[shift.dayOfWeek]} ${shift.startTime}–${shift.endTime})`)}`,
      'CATEGORIES:StuSta Gym',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  download(lines, 'stusta-gym-schedule.ics');
}

export function exportSpontaneousICS(openings: SpontaneousOpening[]): void {
  const stamp = icsStamp();
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StuSta Gym//Extra Sessions//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:StuSta Gym Extra Sessions',
    'X-WR-TIMEZONE:Europe/Berlin',
    ...VTIMEZONE_BERLIN,
  ];

  for (const sp of openings) {
    const by = sp.supervisorName ? ` — ${sp.supervisorName}` : '';
    lines.push(
      'BEGIN:VEVENT',
      `UID:spontaneous-${sp.id}@stusta-gym`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Berlin:${icsDate(sp.date, sp.startTime)}`,
      `DTEND;TZID=Europe/Berlin:${icsDate(sp.date, sp.endTime)}`,
      `SUMMARY:${esc(`⚡ Gym Extra Session${by}`)}`,
      `DESCRIPTION:${esc(sp.note || 'Spontaneous opening')}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  download(lines, 'stusta-gym-extra-sessions.ics');
}

/** Deep link to open a single event in Google Calendar */
export function googleCalendarLink(
  title: string,
  date: string,
  startTime: string,
  endTime: string,
  description = '',
): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${icsDate(date, startTime)}/${icsDate(date, endTime)}`,
    details: description,
    ctz: 'Europe/Berlin',
  });
  return `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`;
}
