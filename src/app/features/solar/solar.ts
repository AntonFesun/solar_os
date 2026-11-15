import { Component, computed, inject } from '@angular/core';
import { demoRanges } from '../../core/model/ranges';
import { SiteStore } from '../../core/state/site-store';
import { energyChart } from '../../shared/chart-options';
import { DemoChart } from '../../shared/demo-chart';
import { formatEnergy, formatPower, formatRatio } from '../../shared/format';
import { readPalette } from '../../shared/palette';

@Component({
  selector: 'app-solar',
  host: { class: 'page' },
  imports: [DemoChart],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">Solar</p>
        <h2>Array on the fixture roof</h2>
      </div>
      <p>Today’s yield is the sum of the hourly series, not a separate number. Nameplate capacity is {{ formatPower(settings().pvCapacityW, units()) }}.</p>
    </header>

    <section class="stat-grid">
      <article class="stat"><h3>Power now</h3><p>{{ formatPower(solar().powerW, units()) }}</p><span class="demo">DEMO</span></article>
      <article class="stat"><h3>Today</h3><p>{{ formatEnergy(solar().todayWh, units()) }}</p><span>Sum of hourly solar</span></article>
      <article class="stat"><h3>Peak today</h3><p>{{ formatPower(solar().peakW, units()) }}</p><span>Highest sample</span></article>
      <article class="stat"><h3>Exported</h3><p>{{ formatEnergy(solar().exportWh, units()) }}</p><span>Negative grid energy</span></article>
      <article class="stat"><h3>Self-consumption</h3><p>{{ formatRatio(solar().selfConsumption) }}</p><span>Clamped 0–100%</span></article>
      <article class="stat"><h3>Capacity factor</h3><p>{{ formatRatio(capacityFactor()) }}</p><span>Today’s Wh ÷ nameplate × hours elapsed</span></article>
    </section>

    <article class="panel">
      <header class="panel-head">
        <h2>Solar and export today</h2>
        <span class="demo">DEMO</span>
      </header>
      <app-demo-chart [option]="chart()" label="DEMO hourly solar production and grid export" />
    </article>
  `,
})
export class SolarPage {
  private readonly store = inject(SiteStore);
  protected readonly settings = this.store.settings;
  protected readonly solar = this.store.solar;
  protected readonly units = computed(() => this.settings().units);
  protected readonly formatPower = formatPower;
  protected readonly formatEnergy = formatEnergy;
  protected readonly formatRatio = formatRatio;
  private readonly series = computed(() =>
    this.store.energy(demoRanges.today.from, demoRanges.today.to, 'hour'),
  );
  protected readonly chart = computed(() => {
    this.settings();
    const palette = readPalette();
    const option = energyChart(this.series().points, 'hour', palette, this.units());
    const series = option['series'];
    if (Array.isArray(series)) {
      option['series'] = series.filter((item) => {
        const name = (item as { name?: string }).name;
        return name === 'Solar' || name === 'Grid export';
      });
    }
    return option;
  });

  protected capacityFactor(): number | null {
    const hours = this.series().points.reduce((sum, point) => sum + point.durationH, 0);
    const capacityWh = this.settings().pvCapacityW * hours;
    if (!(capacityWh > 0)) {
      return null;
    }
    return this.solar().todayWh / capacityWh;
  }
}
