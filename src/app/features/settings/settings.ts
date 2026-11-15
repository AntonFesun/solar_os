import { Component, computed, inject, signal } from '@angular/core';
import type { DisplayUnits, SiteSettings, ThemeName } from '../../core/api/site-api';
import { SiteStore } from '../../core/state/site-store';

interface Draft {
  name: string;
  phaseCount: 1 | 3;
  gridLimitW: number;
  phaseCurrentLimitA: number;
  pvCapacityW: number;
  batteryCapacityWh: number;
  currency: string;
  importDayPerKwh: string;
  importNightPerKwh: string;
  exportPerKwh: string;
  dayStartHour: number;
  dayEndHour: number;
  lowSoc: number;
  voltageMinV: number;
  voltageMaxV: number;
  imbalancePct: number;
}

@Component({
  selector: 'app-settings',
  host: { class: 'page' },
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">Settings</p>
        <h2>Local fixture only</h2>
      </div>
      <p>Apply rebuilds every screen from these values. Nothing is sent over the network. Theme and units apply immediately.</p>
    </header>

    <form class="panel settings-form" (submit)="apply($event)">
      <section>
        <h2>Appearance</h2>
        <div class="pair">
          <fieldset>
            <legend>Theme</legend>
            <div class="segmented">
              <button type="button" [attr.aria-pressed]="settings().theme === 'dark'" (click)="setTheme('dark')">Dark</button>
              <button type="button" [attr.aria-pressed]="settings().theme === 'light'" (click)="setTheme('light')">Light</button>
            </div>
          </fieldset>
          <fieldset>
            <legend>Units</legend>
            <div class="segmented">
              <button type="button" [attr.aria-pressed]="settings().units === 'kW'" (click)="setUnits('kW')">kW</button>
              <button type="button" [attr.aria-pressed]="settings().units === 'W'" (click)="setUnits('W')">W</button>
            </div>
          </fieldset>
        </div>
      </section>

      <section class="form-grid">
        <label>Installation name
          <input [value]="form().name" (input)="onText('name', $event)" maxlength="48" required />
        </label>
        <label>Phases
          <select [value]="form().phaseCount" (change)="onPhase($event)">
            <option value="1">Single-phase</option>
            <option value="3">Three-phase</option>
          </select>
        </label>
        <label>Grid import limit (W)
          <input type="number" min="1000" max="100000" [value]="form().gridLimitW" (input)="onNumber('gridLimitW', $event)" />
        </label>
        <label>Phase current limit (A)
          <input type="number" min="1" max="200" [value]="form().phaseCurrentLimitA" (input)="onNumber('phaseCurrentLimitA', $event)" />
        </label>
        <label>PV capacity (W)
          <input type="number" min="0" max="200000" [value]="form().pvCapacityW" (input)="onNumber('pvCapacityW', $event)" />
        </label>
        <label>Battery capacity (Wh)
          <input type="number" min="500" max="500000" [value]="form().batteryCapacityWh" (input)="onNumber('batteryCapacityWh', $event)" />
        </label>
      </section>

      <section>
        <h2>Tariff <span class="demo">DEMO</span></h2>
        <div class="form-grid">
          <label>Currency
            <select [value]="form().currency" (change)="onCurrency($event)">
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </label>
          <label>Day import / kWh
            <input inputmode="decimal" autocomplete="off" [value]="form().importDayPerKwh" (input)="onRate('importDayPerKwh', $event)" />
          </label>
          <label>Night import / kWh
            <input inputmode="decimal" autocomplete="off" [value]="form().importNightPerKwh" (input)="onRate('importNightPerKwh', $event)" />
          </label>
          <label>Export / kWh
            <input inputmode="decimal" autocomplete="off" [value]="form().exportPerKwh" (input)="onRate('exportPerKwh', $event)" />
          </label>
          <label>Day starts (UTC hour)
            <input type="number" min="0" max="22" step="1" [value]="form().dayStartHour" (input)="onNumber('dayStartHour', $event)" />
          </label>
          <label>Day ends (UTC hour)
            <input type="number" min="1" max="24" step="1" [value]="form().dayEndHour" (input)="onNumber('dayEndHour', $event)" />
          </label>
        </div>
      </section>

      <section>
        <h2>Alert thresholds</h2>
        <div class="form-grid">
          <label>Low battery (%)
            <input type="number" min="5" max="90" [value]="form().lowSoc" (input)="onNumber('lowSoc', $event)" />
          </label>
          <label>Voltage minimum (V)
            <input type="number" min="180" max="240" [value]="form().voltageMinV" (input)="onNumber('voltageMinV', $event)" />
          </label>
          <label>Voltage maximum (V)
            <input type="number" min="220" max="270" [value]="form().voltageMaxV" (input)="onNumber('voltageMaxV', $event)" />
          </label>
          <label>Imbalance (%)
            <input type="number" min="1" max="100" [value]="form().imbalancePct" (input)="onNumber('imbalancePct', $event)" />
          </label>
        </div>
      </section>

      @if (error()) {
        <p class="form-error" role="alert">{{ error() }}</p>
      }

      <div class="form-actions">
        <button type="submit" [disabled]="draft() === null">Apply to fixture</button>
        <button type="button" class="ghost" (click)="reset()">Reset DEMO defaults</button>
      </div>
    </form>
  `,
})
export class SettingsPage {
  private readonly store = inject(SiteStore);
  protected readonly settings = this.store.settings;
  protected readonly draft = signal<Draft | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly form = computed(() => this.draft() ?? toDraft(this.settings()));

  protected onText(key: 'name', event: Event): void {
    this.edit({ [key]: (event.target as HTMLInputElement).value });
  }

  protected onNumber(key: NumberKey, event: Event): void {
    this.edit({ [key]: Number((event.target as HTMLInputElement).value) });
  }

  protected onRate(key: RateKey, event: Event): void {
    this.edit({ [key]: (event.target as HTMLInputElement).value });
  }

  protected onPhase(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.edit({ phaseCount: value === 1 ? 1 : 3 });
  }

  protected onCurrency(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'EUR' || value === 'USD' || value === 'GBP') {
      this.edit({ currency: value });
    }
  }

  protected setTheme(theme: ThemeName): void {
    this.store.patch({ theme });
  }

  protected setUnits(units: DisplayUnits): void {
    this.store.patch({ units });
  }

  protected apply(event: Event): void {
    event.preventDefault();
    const draft = this.form();
    const rates = readRates(draft);
    const error = validate(draft, rates);
    this.error.set(error);
    if (error || !rates) {
      return;
    }
    this.store.patch({
      name: draft.name.trim(),
      phaseCount: draft.phaseCount,
      gridLimitW: draft.gridLimitW,
      phaseCurrentLimitA: draft.phaseCurrentLimitA,
      pvCapacityW: draft.pvCapacityW,
      batteryCapacityWh: draft.batteryCapacityWh,
      tariffs: {
        currency: draft.currency,
        importDayPerKwh: rates.importDayPerKwh,
        importNightPerKwh: rates.importNightPerKwh,
        exportPerKwh: rates.exportPerKwh,
        dayStartHour: draft.dayStartHour,
        dayEndHour: draft.dayEndHour,
      },
      thresholds: {
        lowSoc: draft.lowSoc,
        voltageMinV: draft.voltageMinV,
        voltageMaxV: draft.voltageMaxV,
        imbalancePct: draft.imbalancePct,
      },
    });
    this.draft.set(null);
  }

  protected reset(): void {
    this.error.set(null);
    this.draft.set(null);
    this.store.reset();
  }

  private edit(partial: Partial<Draft>): void {
    this.draft.set({ ...this.form(), ...partial });
    this.error.set(null);
  }
}

type NumberKey = {
  [Key in keyof Draft]: Draft[Key] extends number ? Key : never;
}[keyof Draft];

type RateKey = 'importDayPerKwh' | 'importNightPerKwh' | 'exportPerKwh';

interface TariffRates {
  importDayPerKwh: number;
  importNightPerKwh: number;
  exportPerKwh: number;
}

function toDraft(settings: SiteSettings): Draft {
  return {
    name: settings.name,
    phaseCount: settings.phaseCount,
    gridLimitW: settings.gridLimitW,
    phaseCurrentLimitA: settings.phaseCurrentLimitA,
    pvCapacityW: settings.pvCapacityW,
    batteryCapacityWh: settings.batteryCapacityWh,
    currency: settings.tariffs.currency,
    importDayPerKwh: formatRate(settings.tariffs.importDayPerKwh),
    importNightPerKwh: formatRate(settings.tariffs.importNightPerKwh),
    exportPerKwh: formatRate(settings.tariffs.exportPerKwh),
    dayStartHour: settings.tariffs.dayStartHour,
    dayEndHour: settings.tariffs.dayEndHour,
    lowSoc: settings.thresholds.lowSoc,
    voltageMinV: settings.thresholds.voltageMinV,
    voltageMaxV: settings.thresholds.voltageMaxV,
    imbalancePct: settings.thresholds.imbalancePct,
  };
}

function validate(draft: Draft, rates: TariffRates | null): string | null {
  if (!draft.name.trim()) {
    return 'Installation name is required.';
  }
  if (draft.phaseCount !== 1 && draft.phaseCount !== 3) {
    return 'Phase count must be 1 or 3.';
  }
  if (!inRange(draft.gridLimitW, 1000, 100_000)) {
    return 'Grid limit must be from 1,000 to 100,000 W.';
  }
  if (!inRange(draft.phaseCurrentLimitA, 1, 200)) {
    return 'Phase current limit must be from 1 to 200 A.';
  }
  if (!inRange(draft.pvCapacityW, 0, 200_000)) {
    return 'PV capacity must be from 0 to 200,000 W.';
  }
  if (!inRange(draft.batteryCapacityWh, 500, 500_000)) {
    return 'Battery capacity must be from 500 to 500,000 Wh.';
  }
  if (
    !rates ||
    !inRange(rates.importDayPerKwh, 0, 5) ||
    !inRange(rates.importNightPerKwh, 0, 5) ||
    !inRange(rates.exportPerKwh, 0, 5)
  ) {
    return 'Tariff rates must be from 0 to 5.';
  }
  if (!inRange(draft.dayStartHour, 0, 22) || !inRange(draft.dayEndHour, 1, 24)) {
    return 'Day hours must sit inside 0–24.';
  }
  if (draft.dayStartHour >= draft.dayEndHour) {
    return 'The day rate must start before it ends.';
  }
  if (!inRange(draft.lowSoc, 5, 90)) {
    return 'Low-battery threshold must be from 5 to 90%.';
  }
  if (!inRange(draft.voltageMinV, 180, 240) || !inRange(draft.voltageMaxV, 220, 270)) {
    return 'Voltage limits are outside the fixture range.';
  }
  if (draft.voltageMinV >= draft.voltageMaxV) {
    return 'Voltage minimum must be below the maximum.';
  }
  if (!inRange(draft.imbalancePct, 1, 100)) {
    return 'Imbalance threshold must be from 1 to 100%.';
  }
  return null;
}

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function readRates(draft: Draft): TariffRates | null {
  const importDayPerKwh = parseRate(draft.importDayPerKwh);
  const importNightPerKwh = parseRate(draft.importNightPerKwh);
  const exportPerKwh = parseRate(draft.exportPerKwh);
  if (importDayPerKwh === null || importNightPerKwh === null || exportPerKwh === null) {
    return null;
  }
  return { importDayPerKwh, importNightPerKwh, exportPerKwh };
}

function parseRate(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function formatRate(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/, '');
}
