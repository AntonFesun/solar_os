import { Component, computed, inject } from '@angular/core';
import { SiteStore } from '../../core/state/site-store';
import { formatWhen } from '../../shared/format';

@Component({
  selector: 'app-alerts',
  host: { class: 'page' },
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">Alerts</p>
        <h2>Raised only by this fixture</h2>
      </div>
      <p>
        {{ active().length }} active, {{ resolved().length }} resolved.
        Thresholds in settings change which of these exist.
      </p>
    </header>

    @if (alerts().length === 0) {
      <article class="panel">
        <p class="empty">No DEMO alerts. The live snapshot is inside the current thresholds.</p>
      </article>
    } @else {
      <ul class="alert-list">
        @for (alert of alerts(); track alert.id) {
          <li class="panel alert" [attr.data-severity]="alert.severity" [attr.data-status]="alert.status">
            <header>
              <span class="severity">{{ alert.severity }}</span>
              <span class="demo">DEMO</span>
              <span class="status-word">{{ alert.status }}</span>
            </header>
            <h2>{{ alert.title }}</h2>
            <p>{{ alert.detail }}</p>
            <p class="fine">{{ alert.device }} · {{ formatWhen(alert.at) }}
              @if (alert.resolvedAt) {
                · resolved {{ formatWhen(alert.resolvedAt) }}
              }
            </p>
          </li>
        }
      </ul>
    }
  `,
})
export class AlertsPage {
  private readonly store = inject(SiteStore);
  protected readonly alerts = this.store.alerts;
  protected readonly formatWhen = formatWhen;
  protected readonly active = computed(() => this.alerts().filter((alert) => alert.status === 'active'));
  protected readonly resolved = computed(() =>
    this.alerts().filter((alert) => alert.status === 'resolved'),
  );
}
