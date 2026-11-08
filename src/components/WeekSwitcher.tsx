import { addWeeks, formatWeekRange, getWeekStart } from '../utils/week';

interface Props {
  weekStart: string;
  onChange: (weekStart: string) => void;
  minWeek?: string;
  maxWeek?: string;
}

export function weekLabel(weekStart: string): string {
  const current = getWeekStart();
  if (weekStart === current) return 'This week';
  if (weekStart === addWeeks(current, 1)) return 'Next week';
  if (weekStart === addWeeks(current, -1)) return 'Last week';
  return weekStart < current ? 'Past week' : 'Upcoming week';
}

export default function WeekSwitcher({ weekStart, onChange, minWeek, maxWeek }: Props) {
  const prev = addWeeks(weekStart, -1);
  const next = addWeeks(weekStart, 1);
  return (
    <div className="week-switcher" role="group" aria-label="Select week">
      <button
        className="week-switcher-btn"
        onClick={() => onChange(prev)}
        disabled={!!minWeek && prev < minWeek}
        aria-label="Previous week"
      >‹</button>
      <div className="week-switcher-label">
        <span className="week-switcher-title">{weekLabel(weekStart)}</span>
        <span className="week-switcher-range">{formatWeekRange(weekStart)}</span>
      </div>
      <button
        className="week-switcher-btn"
        onClick={() => onChange(next)}
        disabled={!!maxWeek && next > maxWeek}
        aria-label="Next week"
      >›</button>
    </div>
  );
}
