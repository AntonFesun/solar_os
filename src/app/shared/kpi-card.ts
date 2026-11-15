import { Component, input } from '@angular/core';

@Component({
  selector: 'app-kpi',
  host: {
    class: 'kpi',
    '[attr.data-tone]': 'tone()',
  },
  template: `
    <div class="kpi-top">
      <span class="kpi-icon"><ng-content /></span>
      <span class="demo">DEMO</span>
    </div>
    <h3>{{ label() }}</h3>
    <p class="kpi-value">{{ value() }}</p>
    <p class="kpi-meta">{{ meta() }}</p>
  `,
})
export class KpiCard {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly meta = input('');
  readonly tone = input('cyan');
}
