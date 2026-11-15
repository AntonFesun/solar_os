import type { DisplayUnits, EnergyGrain, SiteStatus } from '../core/api/site-api';

export const FIXTURE_CLOCK = '18 Jun 2026, 13:20 UTC';

export function formatPower(watts: number, units: DisplayUnits): string {
  if (!Number.isFinite(watts)) {
    return '—';
  }
  if (units === 'W') {
    return `${Math.round(watts).toLocaleString('en-GB')} W`;
  }
  return `${(watts / 1000).toFixed(2)} kW`;
}

export function formatEnergy(wh: number, units: DisplayUnits): string {
  if (!Number.isFinite(wh)) {
    return '—';
  }
  if (units === 'W') {
    return `${Math.round(wh).toLocaleString('en-GB')} Wh`;
  }
  return `${(wh / 1000).toFixed(2)} kWh`;
}

export function moneyParts(importCost: number, exportCredit: number): {
  importCost: number;
  exportCredit: number;
  net: number;
} {
  const imported = Math.round(importCost * 100);
  const credit = Math.round(exportCredit * 100);
  return {
    importCost: imported / 100,
    exportCredit: credit / 100,
    net: (imported - credit) / 100,
  };
}

export function formatMoney(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) {
    return '—';
  }
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatRatio(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) {
    return '—';
  }
  return `${(ratio * 100).toFixed(1)}%`;
}

export function formatSoc(soc: number | null): string {
  if (soc === null || !Number.isFinite(soc)) {
    return '—';
  }
  return `${soc.toFixed(1)}%`;
}

export function formatHours(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) {
    return '—';
  }
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  return `${hours.toFixed(1)} h`;
}

export function formatTemp(tempC: number | null): string {
  if (tempC === null || !Number.isFinite(tempC)) {
    return '—';
  }
  return `${tempC.toFixed(1)} °C`;
}

export function formatVolt(voltage: number | null): string {
  if (voltage === null || !Number.isFinite(voltage)) {
    return '—';
  }
  return `${voltage.toFixed(1)} V`;
}

export function formatAmp(current: number | null): string {
  if (current === null || !Number.isFinite(current)) {
    return '—';
  }
  return `${current.toFixed(2)} A`;
}

export function formatFactor(factor: number | null): string {
  if (factor === null || !Number.isFinite(factor)) {
    return '—';
  }
  return factor.toFixed(2);
}

export function formatDelta(current: number, previous: number): string | null {
  if (!(previous > 0) || !Number.isFinite(current)) {
    return null;
  }
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(0)}% vs yesterday to 13:20`;
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return `${date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  })} UTC`;
}

export function formatRange(from: string, to: string): string {
  return `${formatWhen(from)} – ${formatWhen(to)}`;
}

export function formatBucket(iso: string, grain: EnergyGrain): string {
  const date = new Date(iso);
  const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  if (grain === 'hour') {
    return `${date.getUTCHours().toString().padStart(2, '0')}:00`;
  }
  if (grain === 'day' || grain === 'week') {
    return `${date.getUTCDate()} ${month}`;
  }
  if (grain === 'month') {
    return `${month} ${date.getUTCFullYear()}`;
  }
  return String(date.getUTCFullYear());
}

export function statusLabel(status: SiteStatus): string {
  switch (status) {
    case 'online':
      return 'Online';
    case 'degraded':
      return 'Degraded';
    case 'offline':
      return 'Offline';
  }
}
