import { Component, computed, inject, signal } from '@angular/core';
import { demoRanges, type DemoRange } from '../../core/model/ranges';
import { costBucketGrain } from '../../core/model/site-model';
import { SiteStore } from '../../core/state/site-store';
import { costChart } from '../../shared/chart-options';
import { DemoChart } from '../../shared/demo-chart';
import { formatMoney, formatRange, moneyParts } from '../../shared/format';
import { readPalette } from '../../shared/palette';

type CostPeriod = 'today' | 'month' | 'year';

@Component({
  selector: 'app-cost',
  host: { class: 'page' },
  imports: [DemoChart],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">Cost and tariffs</p>
        <h2>Import cost and export credit</h2>
      </div>
      <p>Figures follow the DEMO tariff. Export credit is not a savings claim.</p>
    </header>

    <div class="segmented" role="group" aria-label="Cost period">
      @for (option of periods; track option.id) {
        <button type="button" [attr.aria-pressed]="period() === option.id" (click)="period.set(option.id)">
          {{ option.label }}
        </button>
      }
    </div>

    <p class="fine">{{ formatRange(report().from, report().to) }}</p>

    <section class="stat-grid">
      <article class="stat">
        <h3>Import cost</h3>
        <p>{{ money(parts().importCost) }}</p>
        <span class="demo">DEMO</span>
      </article>
      <article class="stat">
        <h3>Export credit</h3>
        <p>{{ money(parts().exportCredit) }}</p>
        <span class="demo">DEMO</span>
      </article>
      <article class="stat">
        <h3>Net</h3>
        <p>{{ money(parts().net) }}</p>
        <span>Import minus credit</span>
      </article>
      <article class="stat">
        <h3>Day rate</h3>
        <p>{{ tariffText(report().tariff.importDayPerKwh) }}</p>
        <span>{{ report().tariff.dayStartHour }}:00–{{ report().tariff.dayEndHour }}:00 UTC</span>
      </article>
      <article class="stat">
        <h3>Night rate</h3>
        <p>{{ tariffText(report().tariff.importNightPerKwh) }}</p>
        <span>Outside the day window</span>
      </article>
      <article class="stat">
        <h3>Export rate</h3>
        <p>{{ tariffText(report().tariff.exportPerKwh) }}</p>
        <span>Per exported kWh</span>
      </article>
    </section>

    <article class="panel">
      <header class="panel-head">
        <h2>Cost buckets</h2>
        <span class="demo">DEMO</span>
      </header>
      @if (report().buckets.length === 0) {
        <p class="empty">No DEMO cost buckets in this range.</p>
      } @else {
        <app-demo-chart [option]="chart()" label="DEMO import cost and export credit" />
      }
    </article>

    <article class="panel">
      <h2>Assumptions</h2>
      <ul class="assumptions">
        @for (item of report().assumptions; track item) {
          <li>{{ item }}</li>
        }
      </ul>
    </article>
  `,
})
export class CostPage {
  private readonly store = inject(SiteStore);
  protected readonly settings = this.store.settings;
  protected readonly period = signal<CostPeriod>('today');
  protected readonly periods = [
    { id: 'today' as const, label: 'Today' },
    { id: 'month' as const, label: 'Month' },
    { id: 'year' as const, label: 'Year' },
  ];
  protected readonly formatRange = formatRange;
  protected readonly report = computed(() => {
    const range = this.range();
    return this.store.cost(range.from, range.to);
  });
  protected readonly chart = computed(() => {
    this.settings();
    const report = this.report();
    return costChart(
      report.buckets,
      costBucketGrain(report.from, report.to),
      readPalette(),
      report.tariff.currency,
    );
  });

  protected parts(): { importCost: number; exportCredit: number; net: number } {
    const report = this.report();
    return moneyParts(report.importCost, report.exportCredit);
  }

  protected money(amount: number): string {
    return formatMoney(amount, this.report().tariff.currency);
  }

  protected tariffText(rate: number): string {
    return `${formatMoney(rate, this.report().tariff.currency)}/kWh`;
  }

  private range(): DemoRange {
    switch (this.period()) {
      case 'today':
        return demoRanges.today;
      case 'month':
        return demoRanges.monthToDate;
      case 'year':
        return demoRanges.yearToDate;
    }
  }
}
