import { Component, computed, inject } from '@angular/core';
import { SiteStore } from '../../core/state/site-store';
import { batteryChart } from '../../shared/chart-options';
import { DemoChart } from '../../shared/demo-chart';
import {
  formatEnergy,
  formatHours,
  formatPower,
  formatSoc,
  formatTemp,
} from '../../shared/format';
import { readPalette } from '../../shared/palette';

@Component({
  selector: 'app-battery',
  host: { class: 'page' },
  imports: [DemoChart],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">Battery</p>
        <h2>Storage on the same bus</h2>
      </div>
      <p>State of charge, throughput, and runtime all use today’s DEMO series. Health is a fixture label, not a measurement.</p>
    </header>

    <section class="split">
      <article class="panel soc-panel">
        <div class="soc" [style.--soc]="battery().soc">
          <div class="soc-hole">
            <strong>{{ formatSoc(battery().soc) }}</strong>
            <span class="demo">DEMO</span>
          </div>
        </div>
        <p class="fine">{{ modeLabel() }}</p>
      </article>
      <section class="stat-grid">
        <article class="stat"><h3>Power</h3><p>{{ formatPower(battery().powerW, units()) }}</p><span class="demo">DEMO</span></article>
        <article class="stat"><h3>Capacity</h3><p>{{ formatEnergy(battery().capacityWh, units()) }}</p><span>From settings</span></article>
        <article class="stat"><h3>Throughput today</h3><p>{{ formatEnergy(battery().throughputWh, units()) }}</p><span>Charge plus discharge</span></article>
        <article class="stat"><h3>Temperature</h3><p>{{ formatTemp(battery().tempC) }}</p><span class="demo">DEMO</span></article>
        <article class="stat"><h3>Health</h3><p>{{ healthLabel() }}</p><span>Fixture label</span></article>
        <article class="stat"><h3>Runtime</h3><p>{{ formatHours(battery().runtime.hours) }}</p><span>{{ battery().runtime.mode }}</span></article>
      </section>
    </section>

    <article class="panel callout">
      <h2>Runtime assumption</h2>
      <p>{{ battery().runtime.assumption }}</p>
    </article>

    <article class="panel">
      <header class="panel-head">
        <h2>Today’s samples</h2>
        <span class="demo">DEMO</span>
      </header>
      @if (battery().history.length === 0) {
        <p class="empty">No DEMO battery samples.</p>
      } @else {
        <app-demo-chart [option]="chart()" label="DEMO battery state of charge and power" />
      }
    </article>
  `,
})
export class BatteryPage {
  private readonly store = inject(SiteStore);
  protected readonly settings = this.store.settings;
  protected readonly battery = this.store.battery;
  protected readonly units = computed(() => this.settings().units);
  protected readonly formatPower = formatPower;
  protected readonly formatEnergy = formatEnergy;
  protected readonly formatSoc = formatSoc;
  protected readonly formatTemp = formatTemp;
  protected readonly formatHours = formatHours;
  protected readonly chart = computed(() => {
    this.settings();
    return batteryChart(this.battery().history, readPalette(), this.units());
  });

  protected healthLabel(): string {
    const health = this.battery().health;
    return health === null ? '—' : `${health.toFixed(1)}%`;
  }

  protected modeLabel(): string {
    const mode = this.battery().runtime.mode;
    if (mode === 'charge') {
      return 'Charging · power is positive into the battery';
    }
    if (mode === 'discharge') {
      return 'Discharging · power is negative out of the battery';
    }
    return 'Idle · power is under 25 W';
  }
}
