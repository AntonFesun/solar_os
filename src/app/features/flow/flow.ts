import { Component, computed, inject } from '@angular/core';
import { allocateFlows } from '../../core/domain/balance';
import { SiteStore } from '../../core/state/site-store';
import { FIXTURE_CLOCK, formatPower, formatSoc } from '../../shared/format';

@Component({
  selector: 'app-flow',
  host: { class: 'page' },
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">Live energy flow</p>
        <h2>Where the watts go</h2>
      </div>
      <p>Paths move only while that route carries power. Direction comes from the signs. {{ clock }}.</p>
    </header>

    <article class="panel flow-panel">
      <header class="panel-head">
        <h2>Harbor bus</h2>
        <span class="demo">DEMO</span>
      </header>
      <svg class="flow-board" viewBox="0 0 920 640" aria-hidden="true">
        @if (flows().solarToHouse > 1) {
          <path class="flow-line flow-solar is-live" d="M460 128 L460 236" />
        }
        @if (flows().solarToGrid > 1) {
          <path class="flow-line flow-solar is-live" d="M400 70 C260 90 180 180 168 260" />
        }
        @if (flows().solarToBattery > 1) {
          <path class="flow-line flow-solar is-live" d="M400 110 C250 180 250 470 390 520" />
        }
        @if (flows().gridToHouse > 1) {
          <path class="flow-line flow-grid is-live" d="M214 312 L386 312" />
        }
        @if (flows().gridToBattery > 1) {
          <path class="flow-line flow-grid is-live" d="M116 360 C160 450 250 520 376 548" />
        }
        @if (flows().batteryToHouse > 1) {
          <path class="flow-line flow-battery is-live" d="M460 508 L460 386" />
        }
        @if (flows().generatorToHouse > 1) {
          <path class="flow-line flow-generator is-live" d="M716 312 L534 312" />
        }

        <g class="flow-node flow-node-solar">
          <rect x="376" y="28" width="168" height="92" rx="18" />
          <text x="460" y="62" text-anchor="middle">Solar</text>
          <text class="flow-value" x="460" y="92" text-anchor="middle">{{ formatPower(live().solarW, units()) }}</text>
        </g>
        <g class="flow-node flow-node-grid">
          <rect x="28" y="266" width="176" height="92" rx="18" />
          <text x="116" y="300" text-anchor="middle">Grid</text>
          <text class="flow-value" x="116" y="330" text-anchor="middle">{{ formatPower(live().gridW, units()) }}</text>
        </g>
        <g class="flow-node flow-node-house">
          <circle cx="460" cy="312" r="72" />
          <text x="460" y="300" text-anchor="middle">House</text>
          <text class="flow-value" x="460" y="328" text-anchor="middle">{{ formatPower(live().consumptionW, units()) }}</text>
        </g>
        <g class="flow-node flow-node-generator">
          <rect x="716" y="266" width="176" height="92" rx="18" />
          <text x="804" y="300" text-anchor="middle">Generator</text>
          <text class="flow-value" x="804" y="330" text-anchor="middle">{{ generatorLabel() }}</text>
        </g>
        <g class="flow-node flow-node-battery">
          <rect x="376" y="508" width="168" height="100" rx="18" />
          <text x="460" y="546" text-anchor="middle">Battery {{ formatSoc(live().batterySoc) }}</text>
          <text class="flow-value" x="460" y="576" text-anchor="middle">{{ formatPower(live().batteryW, units()) }}</text>
        </g>
      </svg>

      <ul class="path-list">
        @for (path of pathList(); track path.id) {
          <li [class.is-live]="path.live" [attr.data-tone]="path.tone">
            <span>{{ path.label }}</span>
            <strong>{{ path.text }} <em class="demo">DEMO</em></strong>
          </li>
        }
      </ul>
    </article>

    <article class="panel">
      <h2>Sign convention</h2>
      <p class="fine">
        Grid import is positive into the site and export is negative. House load is positive demand.
        Battery charge is positive into the battery. This fixture does not run the generator, and it
        charges the battery from surplus solar only, so grid → battery stays at 0 W unless the dispatch changes.
      </p>
    </article>
  `,
})
export class FlowPage {
  private readonly store = inject(SiteStore);
  protected readonly live = this.store.live;
  protected readonly settings = this.store.settings;
  protected readonly clock = FIXTURE_CLOCK;
  protected readonly formatPower = formatPower;
  protected readonly formatSoc = formatSoc;
  protected readonly units = computed(() => this.settings().units);
  protected readonly flows = computed(() => allocateFlows(this.live()));

  protected generatorLabel(): string {
    return this.live().generatorW > 1 ? formatPower(this.live().generatorW, this.units()) : 'Standby';
  }

  protected pathList(): { id: string; label: string; text: string; live: boolean; tone: string }[] {
    const flows = this.flows();
    const units = this.units();
    const rows = [
      ['solar-house', 'Solar → house', flows.solarToHouse, 'solar'],
      ['solar-battery', 'Solar → battery', flows.solarToBattery, 'solar'],
      ['solar-grid', 'Solar → grid', flows.solarToGrid, 'solar'],
      ['grid-house', 'Grid → house', flows.gridToHouse, 'grid'],
      ['grid-battery', 'Grid → battery', flows.gridToBattery, 'grid'],
      ['battery-house', 'Battery → house', flows.batteryToHouse, 'battery'],
      ['generator-house', 'Generator → house', flows.generatorToHouse, 'violet'],
    ] as const;
    return rows.map(([id, label, watts, tone]) => ({
      id,
      label,
      tone,
      live: watts > 1,
      text: formatPower(watts, units),
    }));
  }
}
