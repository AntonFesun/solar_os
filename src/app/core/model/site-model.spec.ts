import { allocateFlows, balanceResidual, gridDependency, selfConsumptionRatio } from '../domain/balance';
import {
  DEFAULT_SETTINGS,
  DEMO_NOW_ISO,
  DEMO_NOW_MS,
  addUtcDays,
  buildSiteModel,
  queryCost,
  queryEnergy,
  startOfUtcDay,
  sumPoints,
} from './site-model';

const model = buildSiteModel(DEFAULT_SETTINGS);
const todayStart = startOfUtcDay(DEMO_NOW_MS);
const yesterdayStart = addUtcDays(todayStart, -1);

describe('DEMO site model', () => {
  it('keeps the live AC bus in balance', () => {
    expect(balanceResidual(model.live)).toBeCloseTo(0, 6);
    expect(model.live.generatorW).toBe(0);
    expect(model.live.consumptionW).toBeGreaterThan(0);
    expect(model.live.updatedAt).toBe(DEMO_NOW_ISO);
  });

  it('uses one series for today’s solar, export, and cost', () => {
    const series = queryEnergy(model, new Date(todayStart).toISOString(), DEMO_NOW_ISO, 'hour');
    const totals = sumPoints(series.points);
    expect(totals.solarWh).toBeCloseTo(model.solar.todayWh, 6);
    expect(totals.gridExportWh).toBeCloseTo(model.solar.exportWh, 6);
    expect(totals.consumptionWh).toBeGreaterThan(0);
    expect(series.points.every((point) => point.durationH > 0 && point.durationH <= 1)).toBe(true);

    const cost = queryCost(model, new Date(todayStart).toISOString(), DEMO_NOW_ISO);
    expect(cost.importCost).toBeGreaterThanOrEqual(0);
    expect(cost.exportCredit).toBeGreaterThanOrEqual(0);
    const bucketImport = cost.buckets.reduce((sum, bucket) => sum + bucket.importCost, 0);
    const bucketCredit = cost.buckets.reduce((sum, bucket) => sum + bucket.exportCredit, 0);
    expect(bucketImport).toBeCloseTo(cost.importCost, 6);
    expect(bucketCredit).toBeCloseTo(cost.exportCredit, 6);
  });

  it('matches yesterday only through the same fixture clock', () => {
    const series = queryEnergy(
      model,
      new Date(yesterdayStart).toISOString(),
      new Date(yesterdayStart + (DEMO_NOW_MS - todayStart)).toISOString(),
      'hour',
    );
    const totals = sumPoints(series.points);
    expect(totals.durationH).toBeCloseTo(13 + 20 / 60, 5);
    expect(totals.solarWh).toBeGreaterThan(0);
  });

  it('derives self-consumption and grid dependency from the same watt-hours', () => {
    const ratio = selfConsumptionRatio(model.solar.todayWh, model.solar.exportWh);
    expect(model.solar.selfConsumption).toBe(ratio);
    const series = queryEnergy(model, new Date(todayStart).toISOString(), DEMO_NOW_ISO, 'day');
    const totals = sumPoints(series.points);
    const dependency = gridDependency(totals.gridImportWh, totals.consumptionWh);
    expect(dependency === null || (dependency >= 0 && dependency <= 1)).toBe(true);
  });

  it('splits house power across the phases that are installed', () => {
    const powers = model.phases.phases.map((phase) => phase.activePowerW ?? 0);
    expect(powers.reduce((sum, power) => sum + power, 0)).toBeCloseTo(model.live.consumptionW, 6);
    expect(model.phases.phases.every((phase) => phase.present)).toBe(true);
    expect(model.phases.imbalancePct).not.toBeNull();
  });

  it('omits L2 and L3 when the fixture is single-phase', () => {
    const single = buildSiteModel({ ...DEFAULT_SETTINGS, phaseCount: 1 });
    const absent = single.phases.phases.filter((phase) => !phase.present);
    expect(absent.map((phase) => phase.id)).toEqual(['L2', 'L3']);
    expect(absent.every((phase) => phase.voltageV === null && phase.activePowerW === null)).toBe(true);
    expect(single.phases.imbalancePct).toBeNull();
    expect(balanceResidual(single.live)).toBeCloseTo(0, 6);
  });

  it('keeps balance when PV capacity changes and scales solar', () => {
    const larger = buildSiteModel({ ...DEFAULT_SETTINGS, pvCapacityW: DEFAULT_SETTINGS.pvCapacityW * 2 });
    expect(balanceResidual(larger.live)).toBeCloseTo(0, 6);
    expect(larger.live.solarW).toBeGreaterThan(model.live.solarW);
  });

  it('allocates live flow from signs', () => {
    const flows = allocateFlows(model.live);
    const toHouse =
      flows.solarToHouse + flows.batteryToHouse + flows.generatorToHouse + flows.gridToHouse;
    expect(toHouse).toBeCloseTo(model.live.consumptionW, 5);
    expect(flows.solarToBattery + flows.gridToBattery).toBeCloseTo(Math.max(0, model.live.batteryW), 5);
    expect(Object.values(flows).every((watts) => watts >= -1e-9)).toBe(true);
  });

  it('only raises alerts the live fixture can justify', () => {
    const exportAlert = model.alerts.find((alert) => alert.id === 'grid-export');
    if (model.live.gridW < -50) {
      expect(exportAlert?.status).toBe('active');
    } else {
      expect(exportAlert).toBeUndefined();
    }
    const imbalance = model.alerts.find((alert) => alert.id === 'phase-imbalance');
    const pct = model.phases.imbalancePct ?? 0;
    if (pct > DEFAULT_SETTINGS.thresholds.imbalancePct) {
      expect(imbalance?.status).toBe('active');
    } else {
      expect(imbalance).toBeUndefined();
    }
  });

  it('rebuilds a year from the same daily model', () => {
    const year = queryEnergy(model, '2026-01-01T00:00:00.000Z', DEMO_NOW_ISO, 'month');
    expect(year.points.length).toBeGreaterThanOrEqual(6);
    const solar = year.points.reduce((sum, point) => sum + point.solarWh, 0);
    expect(solar).toBeGreaterThan(model.solar.todayWh);
  });
});
