import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  CostReport,
  EnergyGrain,
  EnergySeries,
  SettingsPatch,
  SiteSettings,
} from '../api/site-api';
import { SITE_API } from '../fixture/fixture-site-api';
import { DEFAULT_SETTINGS, SITE_ID } from '../model/site-model';

@Injectable({ providedIn: 'root' })
export class SiteStore {
  private readonly api = inject(SITE_API);
  private readonly revision = signal(0);

  readonly settings = computed(() => {
    this.revision();
    return this.api.getSettings(SITE_ID);
  });

  readonly live = computed(() => {
    this.revision();
    return this.api.getLive(SITE_ID);
  });

  readonly phases = computed(() => {
    this.revision();
    return this.api.getPhasesLive(SITE_ID);
  });

  readonly battery = computed(() => {
    this.revision();
    return this.api.getBattery(SITE_ID);
  });

  readonly solar = computed(() => {
    this.revision();
    return this.api.getSolar(SITE_ID);
  });

  readonly alerts = computed(() => {
    this.revision();
    return this.api.getAlerts(SITE_ID);
  });

  readonly activeAlertCount = computed(
    () => this.alerts().filter((alert) => alert.status === 'active').length,
  );

  energy(from: string, to: string, grain: EnergyGrain): EnergySeries {
    this.revision();
    return this.api.getEnergy(SITE_ID, { from, to, grain });
  }

  cost(from: string, to: string): CostReport {
    this.revision();
    return this.api.getCost(SITE_ID, { from, to });
  }

  patch(patch: SettingsPatch): SiteSettings {
    const next = this.api.patchSettings(SITE_ID, patch);
    this.revision.update((value) => value + 1);
    this.syncTheme();
    return next;
  }

  reset(): SiteSettings {
    return this.patch({
      name: DEFAULT_SETTINGS.name,
      phaseCount: DEFAULT_SETTINGS.phaseCount,
      gridLimitW: DEFAULT_SETTINGS.gridLimitW,
      phaseCurrentLimitA: DEFAULT_SETTINGS.phaseCurrentLimitA,
      pvCapacityW: DEFAULT_SETTINGS.pvCapacityW,
      batteryCapacityWh: DEFAULT_SETTINGS.batteryCapacityWh,
      tariffs: { ...DEFAULT_SETTINGS.tariffs },
      thresholds: { ...DEFAULT_SETTINGS.thresholds },
      theme: DEFAULT_SETTINGS.theme,
      units: DEFAULT_SETTINGS.units,
    });
  }

  syncTheme(): void {
    const theme = this.settings().theme;
    document.documentElement.dataset['theme'] = theme;
    document.documentElement.style.colorScheme = theme;
  }
}
