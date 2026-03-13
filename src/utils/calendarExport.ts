import type { ShiftBlock, SpontaneousOpening } from '../types';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function icsDate(date: string, time: string): string {
  // Returns YYYYMMDDTHHMMSS (local, no timezone for simplicity)
  const [y, m, d] = date.split('-');
  const [h, min] = time.split(':');
  return `${y}${m}${d}T${h}${min}00`;
}

function nextWeekdayDate(dayOfWeek: number): string {
  const now = new Date();
  const todayDow = (now.getDay() + 6) % 7; // Mon=0
  const diff = (dayOfWeek - todayDow + 7) % 7;
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  return target.toISOString().split('T')[0];
}

const RRULE_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export function exportShiftsICS(shiftBlocks: ShiftBlock[]): void {
  const claimedShifts = shiftBlocks.filter(s => s.supervisorId);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StuSta Gym//Shift Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:StuSta Gym Schedule',
    'X-WR-TIMEZONE:Europe/Berlin',
  ];

  for (const shift of claimedShifts) {
    const baseDate = nextWeekdayDate(shift.dayOfWeek);
    const uid = `shift-${shift.id}@stusta-gym`;
    const dtstart = icsDate(baseDate, shift.startTime);
    const dtend   = icsDate(baseDate, shift.endTime);
    const day     = RRULE_DAYS[shift.dayOfWeek];
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART;TZID=Europe/Berlin:${dtstart}`,
      `DTEND;TZID=Europe/Berlin:${dtend}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${day}`,
      `SUMMARY:🏋️ Gym Open — ${shift.supervisorName ?? ''}`,
      `DESCRIPTION:Supervised by ${shift.supervisorName ?? 'N/A'} (${DAY_NAMES[shift.dayOfWeek]} ${shift.startTime}–${shift.endTime})`,
      'CATEGORIES:StuSta Gym',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  const ics = lines.join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'stusta-gym-schedule.ics';
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSpontaneousICS(openings: SpontaneousOpening[]): void {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StuSta Gym//Extra Sessions//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:StuSta Gym Extra Sessions',
  ];

  for (const sp of openings) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:spontaneous-${sp.id}@stusta-gym`,
      `DTSTART;TZID=Europe/Berlin:${icsDate(sp.date, sp.startTime)}`,
      `DTEND;TZID=Europe/Berlin:${icsDate(sp.date, sp.endTime)}`,
      `SUMMARY:⚡ Gym Extra Session — ${sp.supervisorName}`,
      `DESCRIPTION:${sp.note ?? 'Spontaneous opening by ' + sp.supervisorName}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  const ics = lines.join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'stusta-gym-extra-sessions.ics';
  a.click();
  URL.revokeObjectURL(url);
}

/** Deep link to open a single event in Google Calendar */
export function googleCalendarLink(
  title: string,
  date: string,
  startTime: string,
  endTime: string,
  description = '',
): string {
  const fmt = (d: string, t: string) => {
    const [y, m, day] = d.split('-');
    const [h, min] = t.split(':');
    return `${y}${m}${day}T${h}${min}00`;
  };
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(date, startTime)}/${fmt(date, endTime)}`,
    details: description,
  });
  return `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`;
}
