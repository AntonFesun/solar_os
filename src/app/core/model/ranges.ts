import type { EnergyGrain } from '../api/site-api';
import { DEMO_NOW_ISO, DEMO_NOW_MS, addUtcDays, startOfUtcDay } from './site-model';

export interface DemoRange {
  from: string;
  to: string;
}

const todayStart = startOfUtcDay(DEMO_NOW_MS);
const clockOffset = DEMO_NOW_MS - todayStart;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function startOfUtcWeek(ms: number): number {
  const dayStart = startOfUtcDay(ms);
  const weekday = new Date(dayStart).getUTCDay();
  return dayStart - ((weekday + 6) % 7) * 86_400_000;
}

export const demoRanges = {
  today: { from: iso(todayStart), to: DEMO_NOW_ISO },
  yesterdayToClock: {
    from: iso(addUtcDays(todayStart, -1)),
    to: iso(addUtcDays(todayStart, -1) + clockOffset),
  },
  days: { from: iso(addUtcDays(todayStart, -13)), to: DEMO_NOW_ISO },
  weeks: { from: iso(addUtcDays(startOfUtcWeek(DEMO_NOW_MS), -77)), to: DEMO_NOW_ISO },
  months: { from: iso(Date.UTC(2025, 6, 1)), to: DEMO_NOW_ISO },
  monthToDate: { from: iso(Date.UTC(2026, 5, 1)), to: DEMO_NOW_ISO },
  yearToDate: { from: iso(Date.UTC(2026, 0, 1)), to: DEMO_NOW_ISO },
  years: { from: iso(Date.UTC(2022, 0, 1)), to: DEMO_NOW_ISO },
} as const satisfies Record<string, DemoRange>;

export function rangeFor(grain: EnergyGrain): DemoRange {
  switch (grain) {
    case 'hour':
      return demoRanges.today;
    case 'day':
      return demoRanges.days;
    case 'week':
      return demoRanges.weeks;
    case 'month':
      return demoRanges.months;
    case 'year':
      return demoRanges.years;
  }
}
