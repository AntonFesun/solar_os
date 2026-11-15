import type {
  BatteryStatus,
  CostBucket,
  CostReport,
  EnergyGrain,
  EnergyPoint,
  EnergySeries,
  LiveSnapshot,
  PhaseId,
  PhaseReading,
  PhasesLive,
  SiteAlert,
  SiteSettings,
  SolarStatus,
  Tariff,
} from '../api/site-api';
import { balanceResidual, gridFromBalance, selfConsumptionRatio } from '../domain/balance';

/** Fixed DEMO clock. It does not advance and it does not read the network. */
export const DEMO_NOW_ISO = '2026-06-18T13:20:00.000Z';
export const DEMO_NOW_MS = Date.parse(DEMO_NOW_ISO);
export const SITE_ID = 'site-harbor';

const STEP_MS = 10 * 60 * 1000;
const STEP_H = STEP_MS / 3_600_000;
const CHARGE_EFF = 0.96;
const DISCHARGE_EFF = 0.96;
const MIN_SOC = 0.1;
const MAX_SOC = 1;
const HISTORY_START_MS = Date.UTC(2022, 0, 1);
const CLOCK_OFFSET_MS = DEMO_NOW_MS - startOfUtcDay(DEMO_NOW_MS);
const IDLE_W = 25;
const C_RATE = 0.5;
const CHARGE_CAP_W = 5000;

const PHASES: Record<
  1 | 3,
  { id: PhaseId; share: number; voltageV: number; powerFactor: number }[]
> = {
  3: [
    { id: 'L1', share: 0.37, voltageV: 231.4, powerFactor: 0.98 },
    { id: 'L2', share: 0.34, voltageV: 229.8, powerFactor: 0.96 },
    { id: 'L3', share: 0.29, voltageV: 230.6, powerFactor: 0.97 },
  ],
  1: [{ id: 'L1', share: 1, voltageV: 230.4, powerFactor: 0.97 }],
};

export const DEFAULT_SETTINGS: SiteSettings = {
  siteId: SITE_ID,
  name: 'Harbor House',
  phaseCount: 3,
  gridLimitW: 11_000,
  phaseCurrentLimitA: 32,
  pvCapacityW: 8_200,
  batteryCapacityWh: 13_500,
  tariffs: {
    currency: 'EUR',
    importDayPerKwh: 0.28,
    importNightPerKwh: 0.14,
    exportPerKwh: 0.09,
    dayStartHour: 7,
    dayEndHour: 23,
  },
  theme: 'dark',
  units: 'kW',
  thresholds: {
    lowSoc: 20,
    voltageMinV: 207,
    voltageMaxV: 253,
    imbalancePct: 10,
  },
};

interface Totals {
  durationH: number;
  consumptionWh: number;
  solarWh: number;
  gridImportWh: number;
  gridExportWh: number;
  batteryInWh: number;
  batteryOutWh: number;
  importCost: number;
  exportCredit: number;
  peakSolarW: number;
  peakLoadW: number;
}

interface DayRecord {
  startMs: number;
  simulatedEndMs: number;
  startSoc: number;
  endSoc: number;
  totals: Totals;
  toClock: Totals | null;
  atClock: LivePowers | null;
  /** Hour buckets clipped to the fixture clock. Null before that moment. */
  clockHours: EnergyPoint[] | null;
  /** Cost of those same clipped hours, including the partial clock hour. */
  clockHourCosts: CostBucket[] | null;
  hours: EnergyPoint[];
  hourCosts: CostBucket[];
  samples: { at: string; soc: number; powerW: number }[];
  lowBattery: { activeSince: number | null; recoveredFrom: number | null; recoveredAt: number | null };
}

interface LivePowers {
  solarW: number;
  consumptionW: number;
  generatorW: number;
  batteryW: number;
  gridW: number;
  soc: number;
}

export interface SiteModel {
  settings: SiteSettings;
  days: DayRecord[];
  live: LiveSnapshot;
  phases: PhasesLive;
  battery: BatteryStatus;
  solar: SolarStatus;
  alerts: SiteAlert[];
}

export function startOfUtcDay(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function addUtcDays(ms: number, days: number): number {
  return ms + days * 86_400_000;
}

export function buildSiteModel(settings: SiteSettings): SiteModel {
  const days: DayRecord[] = [];
  let soc = 0.55;
  const todayStart = startOfUtcDay(DEMO_NOW_MS);

  for (let dayStart = HISTORY_START_MS; dayStart <= todayStart; dayStart = addUtcDays(dayStart, 1)) {
    const isToday = dayStart === todayStart;
    const end = isToday ? DEMO_NOW_MS : addUtcDays(dayStart, 1);
    const day = simulateDay(settings, dayStart, end, soc, isToday);
    days.push(day);
    soc = day.endSoc;
  }

  const today = days[days.length - 1];
  if (!today?.atClock) {
    throw new Error('DEMO model did not sample the fixture clock.');
  }

  const livePowers = today.atClock;
  const residual = balanceResidual({ ...livePowers, generatorW: livePowers.generatorW });
  if (Math.abs(residual) > 1e-6) {
    throw new Error(`DEMO balance failed by ${residual} W.`);
  }

  const phases = buildPhases(settings, livePowers.consumptionW);
  const alerts = buildAlerts(settings, today, livePowers, phases);
  const status = alerts.some((alert) => alert.status === 'active' && alert.severity === 'critical')
    ? 'degraded'
    : 'online';

  const live: LiveSnapshot = {
    consumptionW: livePowers.consumptionW,
    solarW: livePowers.solarW,
    gridW: livePowers.gridW,
    batteryW: livePowers.batteryW,
    batterySoc: livePowers.soc * 100,
    generatorW: livePowers.generatorW,
    status,
    updatedAt: DEMO_NOW_ISO,
  };

  return {
    settings,
    days,
    live,
    phases,
    battery: buildBattery(settings, today, livePowers),
    solar: buildSolar(today, livePowers),
    alerts,
  };
}

export function queryEnergy(
  model: SiteModel,
  fromIso: string,
  toIso: string,
  grain: EnergyGrain,
): EnergySeries {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  const points =
    Number.isFinite(from) && Number.isFinite(to) && from < to ? bucket(model, grain, from, to) : [];
  return { from: fromIso, to: toIso, grain, points };
}

export function queryCost(model: SiteModel, fromIso: string, toIso: string): CostReport {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  const totals =
    Number.isFinite(from) && Number.isFinite(to) && from < to
      ? sumRange(model, from, to)
      : emptyTotals();
  return {
    from: fromIso,
    to: toIso,
    tariff: { ...model.settings.tariffs },
    importCost: totals.importCost,
    exportCredit: totals.exportCredit,
    assumptions: costAssumptions(model.settings.tariffs),
    buckets: costBuckets(model, from, to),
  };
}

export function sumPoints(points: EnergyPoint[]): Totals {
  return points.reduce((totals, point) => addTotals(totals, pointTotals(point)), emptyTotals());
}

function bucket(model: SiteModel, grain: EnergyGrain, from: number, to: number): EnergyPoint[] {
  if (grain === 'hour') {
    return hourPoints(model, from, to);
  }

  const grouped = new Map<number, Totals>();
  for (const day of model.days) {
    const slice = sliceDay(model.settings, day, from, to);
    if (!slice || slice.durationH <= 0) {
      continue;
    }
    const key = bucketStart(day.startMs, grain);
    grouped.set(key, addTotals(grouped.get(key) ?? emptyTotals(), slice));
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([at, totals]) => toPoint(at, totals));
}

function hourPoints(model: SiteModel, from: number, to: number): EnergyPoint[] {
  const points: EnergyPoint[] = [];
  for (const day of model.days) {
    const clockMs = day.startMs + CLOCK_OFFSET_MS;
    const overlaps = day.startMs < to && day.simulatedEndMs > from;
    if (!overlaps) {
      continue;
    }
    if (from <= day.startMs && to === clockMs && day.clockHours) {
      points.push(...day.clockHours);
      continue;
    }
    if (from <= day.startMs && to >= day.simulatedEndMs) {
      points.push(
        ...day.hours.filter((point) => {
          const at = Date.parse(point.at);
          return at >= from && at < to;
        }),
      );
      continue;
    }
    const slice = simulateDay(
      model.settings,
      day.startMs,
      Math.min(day.simulatedEndMs, to),
      day.startSoc,
      false,
      Math.max(day.startMs, from),
    );
    points.push(...slice.hours);
  }
  return points;
}

function bucketStart(dayStart: number, grain: EnergyGrain): number {
  const date = new Date(dayStart);
  if (grain === 'day') {
    return dayStart;
  }
  if (grain === 'week') {
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    return dayStart - mondayOffset * 86_400_000;
  }
  if (grain === 'month') {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  }
  return Date.UTC(date.getUTCFullYear(), 0, 1);
}

function sumRange(model: SiteModel, from: number, to: number): Totals {
  return model.days.reduce(
    (totals, day) => addTotals(totals, sliceDay(model.settings, day, from, to) ?? emptyTotals()),
    emptyTotals(),
  );
}

function sliceDay(settings: SiteSettings, day: DayRecord, from: number, to: number): Totals | null {
  const sliceFrom = Math.max(day.startMs, from);
  const sliceTo = Math.min(day.simulatedEndMs, to);
  if (sliceFrom >= sliceTo) {
    return null;
  }
  if (sliceFrom === day.startMs && sliceTo === day.simulatedEndMs) {
    return day.totals;
  }
  const clockMs = day.startMs + CLOCK_OFFSET_MS;
  if (day.toClock && sliceFrom === day.startMs && sliceTo === clockMs) {
    return day.toClock;
  }
  return simulateDay(settings, day.startMs, sliceTo, day.startSoc, false, sliceFrom).totals;
}

export function costBucketGrain(fromIso: string, toIso: string): EnergyGrain {
  const span = Date.parse(toIso) - Date.parse(fromIso);
  if (span <= 36 * 3_600_000) {
    return 'hour';
  }
  if (span <= 62 * 86_400_000) {
    return 'day';
  }
  if (span <= 400 * 86_400_000) {
    return 'month';
  }
  return 'year';
}

function costBuckets(model: SiteModel, from: number, to: number): CostBucket[] {
  if (!(from < to)) {
    return [];
  }
  const grain = costBucketGrain(new Date(from).toISOString(), new Date(to).toISOString());
  if (grain === 'hour') {
    return hourCostBuckets(model, from, to);
  }
  const grouped = new Map<number, Totals>();
  for (const day of model.days) {
    const slice = sliceDay(model.settings, day, from, to);
    if (!slice || slice.durationH <= 0) {
      continue;
    }
    const key = bucketStart(day.startMs, grain);
    grouped.set(key, addTotals(grouped.get(key) ?? emptyTotals(), slice));
  }
  return [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([at, slice]) => ({
      at: new Date(at).toISOString(),
      importCost: slice.importCost,
      exportCredit: slice.exportCredit,
    }));
}

function hourCostBuckets(model: SiteModel, from: number, to: number): CostBucket[] {
  const buckets: CostBucket[] = [];
  for (const day of model.days) {
    const clockMs = day.startMs + CLOCK_OFFSET_MS;
    const overlaps = day.startMs < to && day.simulatedEndMs > from;
    if (!overlaps) {
      continue;
    }
    if (from <= day.startMs && to === clockMs && day.clockHourCosts) {
      buckets.push(...day.clockHourCosts);
      continue;
    }
    if (from <= day.startMs && to >= day.simulatedEndMs) {
      buckets.push(
        ...day.hourCosts.filter((bucket) => {
          const at = Date.parse(bucket.at);
          return at >= from && at < to;
        }),
      );
      continue;
    }
    buckets.push(
      ...simulateDay(
        model.settings,
        day.startMs,
        Math.min(day.simulatedEndMs, to),
        day.startSoc,
        false,
        Math.max(day.startMs, from),
      ).hourCosts,
    );
  }
  return buckets;
}

function simulateDay(
  settings: SiteSettings,
  dayStart: number,
  endMs: number,
  socStart: number,
  collectDetail: boolean,
  accumulateFrom = dayStart,
): DayRecord {
  const climate = climateFor(dayStart);
  const totals = emptyTotals();
  const hours: EnergyPoint[] = [];
  const hourCosts: CostBucket[] = [];
  let hour = emptyTotals();
  let hourStart = dayStart;
  let soc = socStart;
  let toClock: Totals | null = null;
  let atClock: LivePowers | null = null;
  let clockHours: EnergyPoint[] | null = null;
  let clockHourCosts: CostBucket[] | null = null;
  let belowSince: number | null = null;
  let recoveredFrom: number | null = null;
  let recoveredAt: number | null = null;
  const samples: { at: string; soc: number; powerW: number }[] = [];
  const clockMs = dayStart + CLOCK_OFFSET_MS;

  const flushHour = (nextStart: number): void => {
    if (hour.durationH > 0 && hourStart >= accumulateFrom) {
      hours.push(toPoint(hourStart, hour));
      hourCosts.push({
        at: new Date(hourStart).toISOString(),
        importCost: hour.importCost,
        exportCredit: hour.exportCredit,
      });
    }
    hour = emptyTotals();
    hourStart = nextStart;
  };

  for (let time = dayStart; time < endMs; time += STEP_MS) {
    const stepEnd = Math.min(time + STEP_MS, endMs);
    const stepH = (stepEnd - time) / 3_600_000;
    const nextHour = hourStart + 3_600_000;
    if (time >= nextHour) {
      flushHour(startOfUtcHour(time));
    }

    const powers = commandAt(settings, time, dayStart, soc, climate, stepH);
    if (collectDetail && time % (20 * 60 * 1000) === 0) {
      samples.push({
        at: new Date(time).toISOString(),
        soc: soc * 100,
        powerW: powers.batteryW,
      });
    }

    const socPct = soc * 100;
    if (socPct < settings.thresholds.lowSoc) {
      belowSince ??= time;
    } else if (belowSince !== null) {
      recoveredFrom ??= belowSince;
      recoveredAt ??= time;
      belowSince = null;
    }

    if (time >= accumulateFrom) {
      const cost = costOfStep(settings.tariffs, time, dayStart, powers.gridW, stepH);
      addStep(totals, powers, stepH, cost);
      addStep(hour, powers, stepH, cost);
    }
    soc = nextSoc(soc, settings.batteryCapacityWh, powers.batteryW, stepH);

    if (stepEnd === clockMs) {
      toClock = cloneTotals(totals);
      atClock = commandAt(settings, clockMs, dayStart, soc, climate, STEP_H);
      clockHours = hour.durationH > 0 ? [...hours, toPoint(hourStart, hour)] : [...hours];
      clockHourCosts =
        hour.durationH > 0
          ? [
              ...hourCosts,
              {
                at: new Date(hourStart).toISOString(),
                importCost: hour.importCost,
                exportCredit: hour.exportCredit,
              },
            ]
          : [...hourCosts];
    }
  }

  flushHour(endMs);
  const endSocPct = soc * 100;
  if (endSocPct < settings.thresholds.lowSoc) {
    belowSince ??= endMs;
  } else if (belowSince !== null) {
    recoveredFrom ??= belowSince;
    recoveredAt ??= endMs;
    belowSince = null;
  }
  if (atClock) {
    totals.peakSolarW = Math.max(totals.peakSolarW, atClock.solarW);
    totals.peakLoadW = Math.max(totals.peakLoadW, atClock.consumptionW);
  }
  if (collectDetail && atClock) {
    samples.push({
      at: new Date(endMs).toISOString(),
      soc: atClock.soc * 100,
      powerW: atClock.batteryW,
    });
  }

  return {
    startMs: dayStart,
    simulatedEndMs: endMs,
    startSoc: socStart,
    endSoc: soc,
    totals,
    toClock,
    atClock,
    clockHours,
    clockHourCosts,
    hours,
    hourCosts,
    samples: collectDetail ? samples : [],
    lowBattery: {
      activeSince: belowSince,
      recoveredFrom,
      recoveredAt,
    },
  };
}

function commandAt(
  settings: SiteSettings,
  time: number,
  dayStart: number,
  soc: number,
  climate: { solar: number; load: number },
  stepH: number,
): LivePowers {
  const hour = (time - dayStart) / 3_600_000;
  const solarW = solarPowerW(hour, settings.pvCapacityW, climate.solar);
  const consumptionW = loadPowerW(hour) * climate.load;
  const generatorW = 0;
  const maxW = Math.min(CHARGE_CAP_W, settings.batteryCapacityWh * C_RATE);
  const surplus = solarW + generatorW - consumptionW;
  let batteryW = 0;
  if (surplus >= 0) {
    const roomWh = Math.max(0, (MAX_SOC - soc) * settings.batteryCapacityWh);
    const roomW = roomWh / CHARGE_EFF / stepH;
    batteryW = Math.min(surplus, maxW, roomW);
  } else {
    const availableWh = Math.max(0, (soc - MIN_SOC) * settings.batteryCapacityWh);
    const availableW = (availableWh * DISCHARGE_EFF) / stepH;
    batteryW = -Math.min(-surplus, maxW, availableW);
  }
  return {
    solarW,
    consumptionW,
    generatorW,
    batteryW,
    gridW: gridFromBalance({ solarW, generatorW, consumptionW, batteryW }),
    soc,
  };
}

function nextSoc(soc: number, capacityWh: number, batteryW: number, stepH: number): number {
  const stored =
    batteryW >= 0 ? batteryW * stepH * CHARGE_EFF : (batteryW * stepH) / DISCHARGE_EFF;
  const next = soc + stored / capacityWh;
  return Math.min(MAX_SOC, Math.max(MIN_SOC, next));
}

function solarPowerW(hour: number, pvCapacityW: number, scale: number): number {
  const sunrise = 5.35;
  const sunset = 19.45;
  if (hour <= sunrise || hour >= sunset) {
    return 0;
  }
  const progress = (hour - sunrise) / (sunset - sunrise);
  return pvCapacityW * 0.8 * Math.sin(Math.PI * progress) ** 1.15 * scale;
}

function loadPowerW(hour: number): number {
  const bump = (center: number, height: number, width: number): number =>
    height * Math.exp(-((hour - center) ** 2) / (2 * width * width));
  return 520 + bump(7.3, 1700, 1.05) + bump(12.7, 2100, 1.7) + bump(19.1, 2900, 1.65);
}

function climateFor(dayStart: number): { solar: number; load: number } {
  const date = new Date(dayStart);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((dayStart - yearStart) / 86_400_000);
  const seasonal = Math.sin(((dayOfYear - 81) / 365) * 2 * Math.PI);
  const wobble = 0.94 + 0.06 * Math.sin(dayOfYear * 0.71);
  const solar = Math.min(1, 0.34 + 0.66 * Math.max(0, seasonal)) * wobble;
  const load = 0.88 + 0.28 * Math.max(0, -seasonal);
  return { solar, load };
}

function costOfStep(
  tariff: Tariff,
  time: number,
  dayStart: number,
  gridW: number,
  stepH: number,
): { importCost: number; exportCredit: number } {
  const hour = (time - dayStart) / 3_600_000;
  const dayRate = hour >= tariff.dayStartHour && hour < tariff.dayEndHour;
  const importWh = gridW > 0 ? gridW * stepH : 0;
  const exportWh = gridW < 0 ? -gridW * stepH : 0;
  return {
    importCost: (importWh / 1000) * (dayRate ? tariff.importDayPerKwh : tariff.importNightPerKwh),
    exportCredit: (exportWh / 1000) * tariff.exportPerKwh,
  };
}

function buildPhases(settings: SiteSettings, consumptionW: number): PhasesLive {
  const shape = PHASES[settings.phaseCount];
  const readings: PhaseReading[] = shape.map((phase, index) => {
    const earlier = shape
      .slice(index + 1)
      .reduce((sum, item) => sum + consumptionW * item.share, 0);
    const activePowerW = index === 0 ? consumptionW - earlier : consumptionW * phase.share;
    const currentA = activePowerW / (phase.voltageV * phase.powerFactor);
    return {
      id: phase.id,
      present: true,
      voltageV: phase.voltageV,
      currentA,
      activePowerW,
      powerFactor: phase.powerFactor,
    };
  });

  const absent: PhaseId[] = settings.phaseCount === 1 ? ['L2', 'L3'] : [];
  for (const id of absent) {
    readings.push({
      id,
      present: false,
      voltageV: null,
      currentA: null,
      activePowerW: null,
      powerFactor: null,
    });
  }

  const presentPower = readings
    .filter((phase) => phase.present && phase.activePowerW !== null)
    .map((phase) => phase.activePowerW ?? 0);
  const average = presentPower.reduce((sum, power) => sum + power, 0) / presentPower.length;
  const imbalancePct =
    settings.phaseCount === 3 && average > 0
      ? (Math.max(...presentPower.map((power) => Math.abs(power - average))) / average) * 100
      : null;
  const powerLimit = settings.gridLimitW / settings.phaseCount;
  const overloaded = readings.some(
    (phase) =>
      phase.present &&
      ((phase.currentA ?? 0) > settings.phaseCurrentLimitA ||
        (phase.activePowerW ?? 0) > powerLimit),
  );

  return {
    phases: readings,
    imbalancePct,
    overloaded,
    limits: {
      voltageMinV: settings.thresholds.voltageMinV,
      voltageMaxV: settings.thresholds.voltageMaxV,
      currentA: settings.phaseCurrentLimitA,
      powerW: powerLimit,
    },
  };
}

function buildBattery(settings: SiteSettings, today: DayRecord, live: LivePowers): BatteryStatus {
  const capacityWh = settings.batteryCapacityWh;
  const powerW = live.batteryW;
  let hours: number | null = null;
  let mode: BatteryStatus['runtime']['mode'] = 'idle';
  let assumption =
    'DEMO runtime is idle because battery power is under 25 W. Nothing is projected.';

  if (powerW > IDLE_W) {
    mode = 'charge';
    const roomWh = Math.max(0, (MAX_SOC - live.soc) * capacityWh);
    hours = roomWh / (powerW * CHARGE_EFF);
    assumption =
      'DEMO estimate. Charge power stays at this snapshot, 96% of AC energy is stored, and charging stops at 100% SOC.';
  } else if (powerW < -IDLE_W) {
    mode = 'discharge';
    const availableWh = Math.max(0, (live.soc - MIN_SOC) * capacityWh);
    hours = (availableWh * DISCHARGE_EFF) / -powerW;
    assumption =
      'DEMO estimate. Discharge power stays at this snapshot, 96% of stored energy reaches the AC bus, and the 10% reserve is kept.';
  }

  const tempC = Math.round((25 + Math.abs(powerW) / 800 + Math.max(0, live.soc * 100 - 70) * 0.03) * 10) / 10;

  return {
    soc: live.soc * 100,
    capacityWh,
    powerW,
    throughputWh: today.totals.batteryInWh + today.totals.batteryOutWh,
    tempC,
    health: 97.2,
    runtime: { hours, mode, assumption },
    history: today.samples,
  };
}

function buildSolar(today: DayRecord, live: LivePowers): SolarStatus {
  return {
    powerW: live.solarW,
    todayWh: today.totals.solarWh,
    peakW: today.totals.peakSolarW,
    exportWh: today.totals.gridExportWh,
    selfConsumption: selfConsumptionRatio(today.totals.solarWh, today.totals.gridExportWh),
  };
}

function buildAlerts(
  settings: SiteSettings,
  today: DayRecord,
  live: LivePowers,
  phases: PhasesLive,
): SiteAlert[] {
  const alerts: SiteAlert[] = [];
  if (live.gridW < -50) {
    alerts.push({
      id: 'grid-export',
      severity: 'info',
      title: 'Exporting to the grid',
      detail: `DEMO grid power is ${live.gridW.toFixed(0)} W. Negative means export.`,
      device: 'Grid connection',
      at: DEMO_NOW_ISO,
      status: 'active',
      resolvedAt: null,
    });
  }
  if (phases.imbalancePct !== null && phases.imbalancePct > settings.thresholds.imbalancePct) {
    alerts.push({
      id: 'phase-imbalance',
      severity: 'warning',
      title: 'Phase imbalance',
      detail: `DEMO imbalance is ${phases.imbalancePct.toFixed(1)}%. Threshold is ${settings.thresholds.imbalancePct}%.`,
      device: 'Phase monitor',
      at: DEMO_NOW_ISO,
      status: 'active',
      resolvedAt: null,
    });
  }
  if (phases.overloaded) {
    alerts.push({
      id: 'phase-overload',
      severity: 'critical',
      title: 'Phase overload',
      detail: `DEMO phase current or power is above the fixture limit of ${settings.phaseCurrentLimitA} A or ${phases.limits.powerW.toFixed(0)} W.`,
      device: 'Phase monitor',
      at: DEMO_NOW_ISO,
      status: 'active',
      resolvedAt: null,
    });
  }
  const voltage = phases.phases.find(
    (phase) =>
      phase.present &&
      phase.voltageV !== null &&
      (phase.voltageV < settings.thresholds.voltageMinV ||
        phase.voltageV > settings.thresholds.voltageMaxV),
  );
  if (voltage?.voltageV !== null && voltage?.voltageV !== undefined) {
    alerts.push({
      id: 'voltage',
      severity: 'critical',
      title: 'Voltage outside limits',
      detail: `DEMO ${voltage.id} is ${voltage.voltageV.toFixed(1)} V. Limits are ${settings.thresholds.voltageMinV}–${settings.thresholds.voltageMaxV} V.`,
      device: voltage.id,
      at: DEMO_NOW_ISO,
      status: 'active',
      resolvedAt: null,
    });
  }
  if (today.lowBattery.activeSince !== null) {
    alerts.push({
      id: 'low-battery',
      severity: 'warning',
      title: 'Low battery',
      detail: `DEMO state of charge is ${(live.soc * 100).toFixed(1)}%, under the ${settings.thresholds.lowSoc}% threshold.`,
      device: 'Battery',
      at: new Date(today.lowBattery.activeSince).toISOString(),
      status: 'active',
      resolvedAt: null,
    });
  } else if (today.lowBattery.recoveredAt !== null && today.lowBattery.recoveredFrom !== null) {
    alerts.push({
      id: 'low-battery-recovered',
      severity: 'info',
      title: 'Low battery recovered',
      detail: `DEMO state of charge crossed back above ${settings.thresholds.lowSoc}%.`,
      device: 'Battery',
      at: new Date(today.lowBattery.recoveredFrom).toISOString(),
      status: 'resolved',
      resolvedAt: new Date(today.lowBattery.recoveredAt).toISOString(),
    });
  }
  const severityRank = { critical: 0, warning: 1, info: 2 } as const;
  return alerts.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'active' ? -1 : 1;
    }
    return severityRank[a.severity] - severityRank[b.severity];
  });
}

function costAssumptions(tariff: Tariff): string[] {
  return [
    'DEMO tariff. Not a utility bill. No standing charge, tax, or demand fee.',
    `Day rate ${tariff.importDayPerKwh} ${tariff.currency}/kWh applies from ${tariff.dayStartHour}:00 inclusive to ${tariff.dayEndHour}:00 exclusive UTC. Night rate is ${tariff.importNightPerKwh} ${tariff.currency}/kWh.`,
    `Export credit is ${tariff.exportPerKwh} ${tariff.currency}/kWh of negative grid energy. It is a credit, not a savings claim.`,
    'Battery losses are already in the watt-hours: 96% charge efficiency and 96% discharge efficiency. Cost does not apply them again.',
    'The fixture clock is 18 Jun 2026, 13:20 UTC. It does not advance.',
  ];
}

function emptyTotals(): Totals {
  return {
    durationH: 0,
    consumptionWh: 0,
    solarWh: 0,
    gridImportWh: 0,
    gridExportWh: 0,
    batteryInWh: 0,
    batteryOutWh: 0,
    importCost: 0,
    exportCredit: 0,
    peakSolarW: 0,
    peakLoadW: 0,
  };
}

function addStep(
  totals: Totals,
  powers: LivePowers,
  stepH: number,
  cost: { importCost: number; exportCredit: number },
): void {
  totals.durationH += stepH;
  totals.consumptionWh += powers.consumptionW * stepH;
  totals.solarWh += powers.solarW * stepH;
  if (powers.gridW >= 0) {
    totals.gridImportWh += powers.gridW * stepH;
  } else {
    totals.gridExportWh += -powers.gridW * stepH;
  }
  if (powers.batteryW >= 0) {
    totals.batteryInWh += powers.batteryW * stepH;
  } else {
    totals.batteryOutWh += -powers.batteryW * stepH;
  }
  totals.importCost += cost.importCost;
  totals.exportCredit += cost.exportCredit;
  totals.peakSolarW = Math.max(totals.peakSolarW, powers.solarW);
  totals.peakLoadW = Math.max(totals.peakLoadW, powers.consumptionW);
}

function addTotals(target: Totals, extra: Totals): Totals {
  target.durationH += extra.durationH;
  target.consumptionWh += extra.consumptionWh;
  target.solarWh += extra.solarWh;
  target.gridImportWh += extra.gridImportWh;
  target.gridExportWh += extra.gridExportWh;
  target.batteryInWh += extra.batteryInWh;
  target.batteryOutWh += extra.batteryOutWh;
  target.importCost += extra.importCost;
  target.exportCredit += extra.exportCredit;
  target.peakSolarW = Math.max(target.peakSolarW, extra.peakSolarW);
  target.peakLoadW = Math.max(target.peakLoadW, extra.peakLoadW);
  return target;
}

function cloneTotals(totals: Totals): Totals {
  return { ...totals };
}

function pointTotals(point: EnergyPoint): Totals {
  return {
    durationH: point.durationH,
    consumptionWh: point.consumptionWh,
    solarWh: point.solarWh,
    gridImportWh: point.gridImportWh,
    gridExportWh: point.gridExportWh,
    batteryInWh: point.batteryInWh,
    batteryOutWh: point.batteryOutWh,
    importCost: 0,
    exportCredit: 0,
    peakSolarW: 0,
    peakLoadW: 0,
  };
}

function toPoint(atMs: number, totals: Totals): EnergyPoint {
  return {
    at: new Date(atMs).toISOString(),
    durationH: totals.durationH,
    consumptionWh: totals.consumptionWh,
    solarWh: totals.solarWh,
    gridImportWh: totals.gridImportWh,
    gridExportWh: totals.gridExportWh,
    batteryInWh: totals.batteryInWh,
    batteryOutWh: totals.batteryOutWh,
  };
}

function startOfUtcHour(ms: number): number {
  return Math.floor(ms / 3_600_000) * 3_600_000;
}
