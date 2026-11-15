import { Component, computed, inject } from '@angular/core';
import { SiteStore } from '../../core/state/site-store';
import {
  formatAmp,
  formatFactor,
  formatPower,
  formatVolt,
} from '../../shared/format';

@Component({
  selector: 'app-phases',
  host: { class: 'page' },
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ settings().phaseCount === 3 ? 'Three-phase' : 'Single-phase' }}</p>
        <h2>L1 · L2 · L3</h2>
      </div>
      <p>
        House incomer at the fixture clock.
        @if (settings().phaseCount === 1) {
          This installation is single-phase, so L2 and L3 are not installed.
        } @else {
          Shares follow the DEMO phase shape and sum to household demand.
        }
      </p>
    </header>

    <section class="stat-grid">
      <article class="stat">
        <h3>Imbalance</h3>
        <p>{{ imbalance() }}</p>
        <span class="demo">DEMO</span>
      </article>
      <article class="stat">
        <h3>Overload</h3>
        <p>{{ phases().overloaded ? 'Yes' : 'No' }}</p>
        <span>Limit {{ formatAmp(phases().limits.currentA) }} · {{ formatPower(phases().limits.powerW, units()) }}</span>
      </article>
      <article class="stat">
        <h3>Total active power</h3>
        <p>{{ formatPower(total(), units()) }}</p>
        <span>Equals household demand</span>
      </article>
    </section>

    <section class="phase-grid">
      @for (phase of phases().phases; track phase.id) {
        <article class="panel phase-card" [class.is-absent]="!phase.present">
          <header class="panel-head">
            <h2>{{ phase.id }}</h2>
            <span class="demo">DEMO</span>
          </header>
          @if (!phase.present) {
            <p class="empty">Not installed</p>
            <dl class="stack-list">
              <div><dt>Voltage</dt><dd>—</dd></div>
              <div><dt>Current</dt><dd>—</dd></div>
              <div><dt>Active power</dt><dd>—</dd></div>
              <div><dt>Power factor</dt><dd>—</dd></div>
            </dl>
          } @else {
            <dl class="stack-list">
              <div><dt>Voltage</dt><dd>{{ formatVolt(phase.voltageV) }}</dd></div>
              <div><dt>Current</dt><dd>{{ formatAmp(phase.currentA) }}</dd></div>
              <div><dt>Active power</dt><dd>{{ formatPower(phase.activePowerW ?? 0, units()) }}</dd></div>
              <div><dt>Power factor</dt><dd>{{ formatFactor(phase.powerFactor) }}</dd></div>
            </dl>
            <div class="meter" aria-hidden="true">
              <span [style.width.%]="meter(phase.currentA)"></span>
            </div>
            <p class="fine">{{ formatAmp(phase.currentA) }} of {{ formatAmp(phases().limits.currentA) }}</p>
          }
        </article>
      }
    </section>
  `,
})
export class PhasesPage {
  private readonly store = inject(SiteStore);
  protected readonly settings = this.store.settings;
  protected readonly phases = this.store.phases;
  protected readonly formatPower = formatPower;
  protected readonly formatVolt = formatVolt;
  protected readonly formatAmp = formatAmp;
  protected readonly formatFactor = formatFactor;
  protected readonly units = computed(() => this.settings().units);
  protected readonly total = computed(() =>
    this.phases().phases.reduce((sum, phase) => sum + (phase.activePowerW ?? 0), 0),
  );

  protected imbalance(): string {
    const value = this.phases().imbalancePct;
    return value === null ? '—' : `${value.toFixed(1)}%`;
  }

  protected meter(current: number | null): number {
    if (current === null || this.phases().limits.currentA <= 0) {
      return 0;
    }
    return Math.min(100, (current / this.phases().limits.currentA) * 100);
  }
}
