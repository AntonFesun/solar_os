import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import type {
  CostQuery,
  CostReport,
  EnergyQuery,
  EnergySeries,
  LiveSnapshot,
  PhasesLive,
  BatteryStatus,
  SettingsPatch,
  SiteAlert,
  SiteApi,
  SiteSettings,
  SolarStatus,
  Tariff,
  AlertThresholds,
  ThemeName,
  DisplayUnits,
} from '../api/site-api';
import { buildSiteModel, DEFAULT_SETTINGS, queryCost, queryEnergy, type SiteModel } from '../model/site-model';

/**
 * In-memory `SiteApi`. Every screen reads this object. It does not use
 * HttpClient, fetch, or WebSocket.
 */
@Injectable({ providedIn: 'root' })
export class FixtureSiteApi implements SiteApi {
  private readonly settingsState = signal<SiteSettings>(cloneSettings(DEFAULT_SETTINGS));
  private cache: { key: SiteSettings; model: SiteModel } | null = null;

  getLive(siteId: string): LiveSnapshot {
    return this.model(siteId).live;
  }

  getEnergy(siteId: string, query: EnergyQuery): EnergySeries {
    return queryEnergy(this.model(siteId), query.from, query.to, query.grain);
  }

  getPhasesLive(siteId: string): PhasesLive {
    return this.model(siteId).phases;
  }

  getBattery(siteId: string): BatteryStatus {
    return this.model(siteId).battery;
  }

  getSolar(siteId: string): SolarStatus {
    return this.model(siteId).solar;
  }

  getCost(siteId: string, query: CostQuery): CostReport {
    return queryCost(this.model(siteId), query.from, query.to);
  }

  getAlerts(siteId: string): SiteAlert[] {
    return this.model(siteId).alerts;
  }

  getSettings(siteId: string): SiteSettings {
    this.assertSite(siteId);
    return cloneSettings(this.settingsState());
  }

  patchSettings(siteId: string, patch: SettingsPatch): SiteSettings {
    this.assertSite(siteId);
    this.settingsState.update((current) => applyPatch(current, patch));
    this.cache = null;
    return this.getSettings(siteId);
  }

  private model(siteId: string): SiteModel {
    this.assertSite(siteId);
    const key = this.settingsState();
    if (this.cache?.key !== key) {
      this.cache = { key, model: buildSiteModel(key) };
    }
    return this.cache.model;
  }

  private assertSite(siteId: string): void {
    if (siteId !== this.settingsState().siteId) {
      throw new Error(`Unknown DEMO site "${siteId}".`);
    }
  }
}

export const SITE_API = new InjectionToken<SiteApi>('SITE_API', {
  providedIn: 'root',
  factory: () => inject(FixtureSiteApi),
});

function applyPatch(current: SiteSettings, patch: SettingsPatch): SiteSettings {
  const next = cloneSettings(current);
  if (patch.name !== undefined) {
    const name = patch.name.trim().slice(0, 48);
    if (name) {
      next.name = name;
    }
  }
  if (patch.phaseCount === 1 || patch.phaseCount === 3) {
    next.phaseCount = patch.phaseCount;
  }
  if (patch.gridLimitW !== undefined) {
    next.gridLimitW = clamp(patch.gridLimitW, 1_000, 100_000);
  }
  if (patch.phaseCurrentLimitA !== undefined) {
    next.phaseCurrentLimitA = clamp(patch.phaseCurrentLimitA, 1, 200);
  }
  if (patch.pvCapacityW !== undefined) {
    next.pvCapacityW = clamp(patch.pvCapacityW, 0, 200_000);
  }
  if (patch.batteryCapacityWh !== undefined) {
    next.batteryCapacityWh = clamp(patch.batteryCapacityWh, 500, 500_000);
  }
  if (patch.tariffs) {
    next.tariffs = sanitizeTariff({ ...next.tariffs, ...patch.tariffs }, current.tariffs);
  }
  if (patch.theme === 'dark' || patch.theme === 'light') {
    next.theme = patch.theme satisfies ThemeName;
  }
  if (patch.units === 'W' || patch.units === 'kW') {
    next.units = patch.units satisfies DisplayUnits;
  }
  if (patch.thresholds) {
    next.thresholds = sanitizeThresholds({ ...next.thresholds, ...patch.thresholds });
  }
  return next;
}

function sanitizeTariff(tariff: Tariff, previous: Tariff): Tariff {
  const currency = tariff.currency.trim().toUpperCase();
  const dayStartHour = Math.round(clamp(tariff.dayStartHour, 0, 22));
  let dayEndHour = Math.round(clamp(tariff.dayEndHour, 1, 24));
  if (dayStartHour >= dayEndHour) {
    dayEndHour = Math.min(24, dayStartHour + 1);
  }
  return {
    currency: currency === 'EUR' || currency === 'USD' || currency === 'GBP' ? currency : previous.currency,
    importDayPerKwh: clamp(tariff.importDayPerKwh, 0, 5),
    importNightPerKwh: clamp(tariff.importNightPerKwh, 0, 5),
    exportPerKwh: clamp(tariff.exportPerKwh, 0, 5),
    dayStartHour,
    dayEndHour,
  };
}

function sanitizeThresholds(thresholds: AlertThresholds): AlertThresholds {
  const voltageMinV = clamp(thresholds.voltageMinV, 180, 240);
  let voltageMaxV = clamp(thresholds.voltageMaxV, 220, 270);
  if (voltageMaxV <= voltageMinV) {
    voltageMaxV = Math.min(270, voltageMinV + 5);
  }
  return {
    lowSoc: clamp(thresholds.lowSoc, 5, 90),
    voltageMinV,
    voltageMaxV,
    imbalancePct: clamp(thresholds.imbalancePct, 1, 100),
  };
}

function cloneSettings(settings: SiteSettings): SiteSettings {
  return {
    ...settings,
    tariffs: { ...settings.tariffs },
    thresholds: { ...settings.thresholds },
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
