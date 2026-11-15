/**
 * Client shape of `/api/v1`. The fixture implements this. The UI does not
 * call the network.
 *
 * Sign convention (also enforced by the domain model):
 * - Power is W. Energy is Wh.
 * - Grid import is positive into the site. Export is negative grid power.
 * - House load (`consumptionW`) is positive demand.
 * - Battery charge is positive into the battery. Discharge is negative.
 * - Solar and generator are positive generation.
 * - AC balance: solarW + generatorW + gridW = consumptionW + batteryW.
 */

export const API_BASE = '/api/v1';

export type SiteStatus = 'online' | 'degraded' | 'offline';
export type EnergyGrain = 'hour' | 'day' | 'week' | 'month' | 'year';
export type PhaseId = 'L1' | 'L2' | 'L3';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'resolved';
export type ThemeName = 'dark' | 'light';
export type DisplayUnits = 'W' | 'kW';

export interface LiveSnapshot {
  consumptionW: number;
  solarW: number;
  gridW: number;
  batteryW: number;
  batterySoc: number;
  generatorW: number;
  status: SiteStatus;
  updatedAt: string;
}

export interface EnergyQuery {
  from: string;
  to: string;
  grain: EnergyGrain;
}

export interface EnergyPoint {
  at: string;
  /** Length of this bucket. The current hour is shorter than 1. */
  durationH: number;
  consumptionWh: number;
  solarWh: number;
  gridImportWh: number;
  gridExportWh: number;
  batteryInWh: number;
  batteryOutWh: number;
}

export interface EnergySeries {
  from: string;
  to: string;
  grain: EnergyGrain;
  points: EnergyPoint[];
}

export interface PhaseReading {
  id: PhaseId;
  present: boolean;
  voltageV: number | null;
  currentA: number | null;
  activePowerW: number | null;
  powerFactor: number | null;
}

export interface PhasesLive {
  phases: PhaseReading[];
  /** Null when the site is not three-phase. Never a fake zero. */
  imbalancePct: number | null;
  overloaded: boolean;
  limits: {
    voltageMinV: number;
    voltageMaxV: number;
    currentA: number;
    powerW: number;
  };
}

export interface BatterySample {
  at: string;
  soc: number;
  powerW: number;
}

export interface BatteryRuntime {
  hours: number | null;
  mode: 'charge' | 'discharge' | 'idle';
  assumption: string;
}

export interface BatteryStatus {
  soc: number;
  capacityWh: number;
  powerW: number;
  throughputWh: number;
  tempC: number | null;
  health: number | null;
  runtime: BatteryRuntime;
  /** DEMO samples from the same day model. Not a second source. */
  history: BatterySample[];
}

export interface SolarStatus {
  powerW: number;
  todayWh: number;
  peakW: number;
  exportWh: number;
  /** Share of today's solar that stayed on site, 0–1. Null when there is no solar. */
  selfConsumption: number | null;
}

export interface Tariff {
  currency: string;
  importDayPerKwh: number;
  importNightPerKwh: number;
  exportPerKwh: number;
  /** Inclusive UTC hour. */
  dayStartHour: number;
  /** Exclusive UTC hour. */
  dayEndHour: number;
}

export interface CostBucket {
  at: string;
  importCost: number;
  exportCredit: number;
}

export interface CostReport {
  from: string;
  to: string;
  tariff: Tariff;
  importCost: number;
  exportCredit: number;
  assumptions: string[];
  buckets: CostBucket[];
}

export interface CostQuery {
  from: string;
  to: string;
}

export interface SiteAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  device: string;
  at: string;
  status: AlertStatus;
  resolvedAt: string | null;
}

export interface AlertThresholds {
  lowSoc: number;
  voltageMinV: number;
  voltageMaxV: number;
  imbalancePct: number;
}

export interface SiteSettings {
  siteId: string;
  name: string;
  phaseCount: 1 | 3;
  gridLimitW: number;
  phaseCurrentLimitA: number;
  pvCapacityW: number;
  batteryCapacityWh: number;
  tariffs: Tariff;
  theme: ThemeName;
  units: DisplayUnits;
  thresholds: AlertThresholds;
}

export type SettingsPatch = {
  name?: string;
  phaseCount?: 1 | 3;
  gridLimitW?: number;
  phaseCurrentLimitA?: number;
  pvCapacityW?: number;
  batteryCapacityWh?: number;
  tariffs?: Partial<Tariff>;
  theme?: ThemeName;
  units?: DisplayUnits;
  thresholds?: Partial<AlertThresholds>;
};

/**
 * Synchronous stand-in for the HTTP API. Implementations must not perform I/O.
 */
export interface SiteApi {
  getLive(siteId: string): LiveSnapshot;
  getEnergy(siteId: string, query: EnergyQuery): EnergySeries;
  getPhasesLive(siteId: string): PhasesLive;
  getBattery(siteId: string): BatteryStatus;
  getSolar(siteId: string): SolarStatus;
  getCost(siteId: string, query: CostQuery): CostReport;
  getAlerts(siteId: string): SiteAlert[];
  getSettings(siteId: string): SiteSettings;
  patchSettings(siteId: string, patch: SettingsPatch): SiteSettings;
}
