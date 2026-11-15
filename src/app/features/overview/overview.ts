import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideActivity,
  LucideBattery,
  LucideBatteryCharging,
  LucideChartColumn,
  LucideCoins,
  LucideHouse,
  LucidePlugZap,
  LucideSun,
  LucideUtilityPole,
} from '@lucide/angular';
import { balanceResidual } from '../../core/domain/balance';
import { demoRanges } from '../../core/model/ranges';
import { sumPoints } from '../../core/model/site-model';
import { SiteStore } from '../../core/state/site-store';
import { DemoChart } from '../../shared/demo-chart';
import { energyChart } from '../../shared/chart-options';
import {
  FIXTURE_CLOCK,
  formatDelta,
  formatEnergy,
  formatMoney,
  formatPower,
  moneyParts,
  formatSoc,
  formatWhen,
  statusLabel,
} from '../../shared/format';
import { KpiCard } from '../../shared/kpi-card';
import { readPalette } from '../../shared/palette';

@Component({
  selector: 'app-overview',
  host: { class: 'page' },
  imports: [
    KpiCard,
    DemoChart,
    RouterLink,
    LucideHouse,
    LucideSun,
    LucideUtilityPole,
    LucideBattery,
    LucideBatteryCharging,
    LucidePlugZap,
    LucideChartColumn,
    LucideCoins,
    LucideActivity,
  ],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">Overview</p>
        <h2>Site at a glance</h2>
      </div>
      <p>Live power and today’s energy come from one DEMO fixture. Clock {{ clock }}.</p>
    </header>

    <section class="kpi-grid" aria-label="Key figures">
      <app-kpi label="Household" [value]="formatPower(live().consumptionW, units())" meta="Positive demand" tone="house">
        <svg lucideHouse [size]="18"></svg>
      </app-kpi>
      <app-kpi label="Solar" [value]="formatPower(live().solarW, units())" meta="Positive generation" tone="solar">
        <svg lucideSun [size]="18"></svg>
      </app-kpi>
      <app-kpi label="Grid" [value]="formatPower(live().gridW, units())" [meta]="gridMeta()" tone="grid">
        <svg lucideUtilityPole [size]="18"></svg>
      </app-kpi>
      <app-kpi label="Battery charge" [value]="formatSoc(live().batterySoc)" meta="State of charge" tone="battery">
        <svg lucideBattery [size]="18"></svg>
      </app-kpi>
      <app-kpi label="Battery power" [value]="formatPower(live().batteryW, units())" [meta]="batteryMeta()" tone="battery">
        <svg lucideBatteryCharging [size]="18"></svg>
      </app-kpi>
      <app-kpi label="Today’s consumption" [value]="formatEnergy(today().consumptionWh, units())" [meta]="energyMeta(today().consumptionWh, yesterday().consumptionWh)" tone="house">
        <svg lucidePlugZap [size]="18"></svg>
      </app-kpi>
      <app-kpi label="Today’s solar" [value]="formatEnergy(today().solarWh, units())" [meta]="energyMeta(today().solarWh, yesterday().solarWh)" tone="solar">
        <svg lucideChartColumn [size]="18"></svg>
      </app-kpi>
      <app-kpi label="Net energy cost" [value]="formatMoney(net(), settings().tariffs.currency)" [meta]="costMeta()" tone="violet">
        <svg lucideCoins [size]="18"></svg>
      </app-kpi>
      <app-kpi label="System" [value]="statusLabel(live().status)" [meta]="'Updated ' + formatWhen(live().updatedAt)" tone="cyan">
        <svg lucideActivity [size]="18"></svg>
      </app-kpi>
    </section>

    <section class="split">
      <article class="panel">
        <header class="panel-head">
          <h2>Today so far</h2>
          <span class="demo">DEMO</span>
        </header>
        <app-demo-chart [option]="chart()" label="DEMO hourly solar, consumption, and grid energy for 18 Jun 2026" />
      </article>
      <article class="panel">
        <header class="panel-head">
          <h2>AC balance</h2>
          <span class="demo">DEMO</span>
        </header>
        <p class="equation">
          <span>{{ formatPower(live().solarW, units()) }}</span>
          <em>+</em>
          <span>{{ formatPower(live().generatorW, units()) }}</span>
          <em>+</em>
          <span>{{ formatPower(live().gridW, units()) }}</span>
          <em>=</em>
          <span>{{ formatPower(live().consumptionW, units()) }}</span>
          <em>+</em>
          <span>{{ formatPower(live().batteryW, units()) }}</span>
        </p>
        <p class="fine">Solar + generator + grid = house + battery. Residual {{ residualText() }}.</p>
        <dl class="stack-list">
          <div><dt>Grid import today</dt><dd>{{ formatEnergy(today().gridImportWh, units()) }}</dd></div>
          <div><dt>Grid export today</dt><dd>{{ formatEnergy(today().gridExportWh, units()) }}</dd></div>
          <div><dt>Battery in</dt><dd>{{ formatEnergy(today().batteryInWh, units()) }}</dd></div>
          <div><dt>Battery out</dt><dd>{{ formatEnergy(today().batteryOutWh, units()) }}</dd></div>
        </dl>
        <a class="text-link" routerLink="/flow">Open the live flow</a>
      </article>
    </section>

    <article class="panel">
      <header class="panel-head">
        <h2>Alerts from this snapshot</h2>
        <a routerLink="/alerts">All alerts</a>
      </header>
      @if (alerts().length === 0) {
        <p class="empty">No DEMO alerts for the current thresholds.</p>
      } @else {
        <ul class="alert-strip">
          @for (alert of alerts().slice(0, 3); track alert.id) {
            <li [attr.data-severity]="alert.severity">
              <strong>{{ alert.title }}</strong>
              <span>{{ alert.detail }}</span>
            </li>
          }
        </ul>
      }
    </article>
  `,
})
export class OverviewPage {
  private readonly store = inject(SiteStore);
  protected readonly settings = this.store.settings;
  protected readonly live = this.store.live;
  protected readonly alerts = this.store.alerts;
  protected readonly clock = FIXTURE_CLOCK;
  protected readonly formatPower = formatPower;
  protected readonly formatEnergy = formatEnergy;
  protected readonly formatMoney = formatMoney;
  protected readonly formatSoc = formatSoc;
  protected readonly formatWhen = formatWhen;
  protected readonly statusLabel = statusLabel;

  private readonly todaySeries = computed(() =>
    this.store.energy(demoRanges.today.from, demoRanges.today.to, 'hour'),
  );
  private readonly yesterdaySeries = computed(() =>
    this.store.energy(demoRanges.yesterdayToClock.from, demoRanges.yesterdayToClock.to, 'hour'),
  );
  private readonly todayCost = computed(() => this.store.cost(demoRanges.today.from, demoRanges.today.to));
  private readonly yesterdayCost = computed(() =>
    this.store.cost(demoRanges.yesterdayToClock.from, demoRanges.yesterdayToClock.to),
  );

  protected readonly today = computed(() => sumPoints(this.todaySeries().points));
  protected readonly yesterday = computed(() => sumPoints(this.yesterdaySeries().points));
  protected readonly units = computed(() => this.settings().units);
  protected readonly net = computed(
    () => moneyParts(this.todayCost().importCost, this.todayCost().exportCredit).net,
  );
  protected readonly chart = computed(() => {
    this.settings();
    return energyChart(this.todaySeries().points, 'hour', readPalette(), this.units());
  });

  protected gridMeta(): string {
    return this.live().gridW < 0
      ? 'Export · negative grid power'
      : 'Import · positive into the site';
  }

  protected batteryMeta(): string {
    const power = this.live().batteryW;
    if (power > 25) {
      return 'Charging · positive into the battery';
    }
    if (power < -25) {
      return 'Discharging · negative out of the battery';
    }
    return this.live().batterySoc >= 99 ? 'Idle · holding a full charge' : 'Idle';
  }

  protected energyMeta(current: number, previous: number): string {
    return formatDelta(current, previous) ?? 'Through the fixture clock';
  }

  protected costMeta(): string {
    const previous = moneyParts(
      this.yesterdayCost().importCost,
      this.yesterdayCost().exportCredit,
    ).net;
    return `Import minus export credit. Yesterday to 13:20 ${formatMoney(previous, this.settings().tariffs.currency)}.`;
  }

  protected residualText(): string {
    const residual = balanceResidual(this.live());
    return Math.abs(residual) < 0.05 ? '0 W' : formatPower(residual, 'W');
  }
}
