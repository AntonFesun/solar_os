import { Component, computed, inject, signal } from '@angular/core';
import type { EnergyGrain } from '../../core/api/site-api';
import { gridDependency, selfConsumptionRatio } from '../../core/domain/balance';
import { rangeFor } from '../../core/model/ranges';
import { sumPoints } from '../../core/model/site-model';
import { SiteStore } from '../../core/state/site-store';
import { energyChart } from '../../shared/chart-options';
import { DemoChart } from '../../shared/demo-chart';
import {
  formatBucket,
  formatEnergy,
  formatMoney,
  formatPower,
  formatRange,
  formatRatio,
  moneyParts,
} from '../../shared/format';
import { readPalette } from '../../shared/palette';

@Component({
  selector: 'app-analytics',
  host: { class: 'page' },
  imports: [DemoChart],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">Consumption analytics</p>
        <h2>Same model, five grains</h2>
      </div>
      <p>{{ formatRange(series().from, series().to) }}. Partial buckets keep their real duration.</p>
    </header>

    <div class="segmented" role="group" aria-label="Time grain">
      @for (option of grains; track option.id) {
        <button type="button" [attr.aria-pressed]="grain() === option.id" (click)="grain.set(option.id)">
          {{ option.label }}
        </button>
      }
    </div>

    <section class="stat-grid">
      <article class="stat">
        <h3>Consumption</h3>
        <p>{{ formatEnergy(totals().consumptionWh, units()) }}</p>
        <span class="demo">DEMO</span>
      </article>
      <article class="stat">
        <h3>Solar</h3>
        <p>{{ formatEnergy(totals().solarWh, units()) }}</p>
        <span class="demo">DEMO</span>
      </article>
      <article class="stat">
        <h3>Highest bucket</h3>
        <p>{{ peak().power > 0 ? formatPower(peak().power, units()) : '—' }}</p>
        <span>{{ peak().at ? formatBucket(peak().at, grain()) : 'No bucket' }}</span>
      </article>
      <article class="stat">
        <h3>Self-consumption</h3>
        <p>{{ formatRatio(selfConsumption()) }}</p>
        <span>Solar that stayed on site</span>
      </article>
      <article class="stat">
        <h3>Grid dependency</h3>
        <p>{{ formatRatio(dependency()) }}</p>
        <span>Import ÷ consumption</span>
      </article>
      <article class="stat">
        <h3>Net cost</h3>
        <p>{{ formatMoney(net(), settings().tariffs.currency) }}</p>
        <span>Import minus export credit</span>
      </article>
    </section>

    <article class="panel">
      <header class="panel-head">
        <h2>{{ grainLabel() }} energy</h2>
        <span class="demo">DEMO</span>
      </header>
      @if (series().points.length === 0) {
        <p class="empty">No DEMO buckets in this range.</p>
      } @else {
        <app-demo-chart [option]="chart()" [label]="'DEMO ' + grainLabel() + ' energy chart'" />
      }
    </article>
  `,
})
export class AnalyticsPage {
  private readonly store = inject(SiteStore);
  protected readonly settings = this.store.settings;
  protected readonly grain = signal<EnergyGrain>('hour');
  protected readonly grains = [
    { id: 'hour' as const, label: 'Hour' },
    { id: 'day' as const, label: 'Day' },
    { id: 'week' as const, label: 'Week' },
    { id: 'month' as const, label: 'Month' },
    { id: 'year' as const, label: 'Year' },
  ];
  protected readonly formatEnergy = formatEnergy;
  protected readonly formatPower = formatPower;
  protected readonly formatRatio = formatRatio;
  protected readonly formatMoney = formatMoney;
  protected readonly formatRange = formatRange;
  protected readonly formatBucket = formatBucket;

  protected readonly series = computed(() => {
    const range = rangeFor(this.grain());
    return this.store.energy(range.from, range.to, this.grain());
  });
  protected readonly totals = computed(() => sumPoints(this.series().points));
  protected readonly units = computed(() => this.settings().units);
  protected readonly cost = computed(() => {
    const range = rangeFor(this.grain());
    return this.store.cost(range.from, range.to);
  });
  protected readonly net = computed(
    () => moneyParts(this.cost().importCost, this.cost().exportCredit).net,
  );
  protected readonly selfConsumption = computed(() =>
    selfConsumptionRatio(this.totals().solarWh, this.totals().gridExportWh),
  );
  protected readonly dependency = computed(() =>
    gridDependency(this.totals().gridImportWh, this.totals().consumptionWh),
  );
  protected readonly peak = computed(() => {
    return this.series().points.reduce(
      (best, point) => {
        const power = point.durationH > 0 ? point.consumptionWh / point.durationH : 0;
        return power > best.power ? { power, at: point.at } : best;
      },
      { power: 0, at: '' },
    );
  });
  protected readonly chart = computed(() => {
    this.settings();
    return energyChart(this.series().points, this.grain(), readPalette(), this.units());
  });

  protected grainLabel(): string {
    return this.grains.find((option) => option.id === this.grain())?.label ?? 'Energy';
  }
}
