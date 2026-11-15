import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideActivity,
  LucideBatteryCharging,
  LucideBell,
  LucideChartColumn,
  LucideCoins,
  LucideLayoutDashboard,
  LucideMoon,
  LucideSettings,
  LucideSun,
  LucideSunMedium,
  LucideWorkflow,
} from '@lucide/angular';
import { SiteStore } from '../core/state/site-store';
import { FIXTURE_CLOCK, statusLabel } from '../shared/format';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideSun,
    LucideMoon,
    LucideLayoutDashboard,
    LucideWorkflow,
    LucideChartColumn,
    LucideActivity,
    LucideBatteryCharging,
    LucideSunMedium,
    LucideCoins,
    LucideBell,
    LucideSettings,
  ],
  template: `
    <a class="skip" href="#content">Skip to content</a>
    <div class="shell">
      <aside class="rail">
        <a class="brand" routerLink="/" aria-label="Solar OS overview">
          <svg lucideSun [size]="22"></svg>
          <span>
            <strong>Solar OS</strong>
            <small>Control center</small>
          </span>
        </a>
        <nav aria-label="Sections">
          <a routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
            <svg lucideLayoutDashboard [size]="18"></svg><span>Overview</span>
          </a>
          <a routerLink="/flow" routerLinkActive="is-active" ariaCurrentWhenActive="page">
            <svg lucideWorkflow [size]="18"></svg><span>Flow</span>
          </a>
          <a routerLink="/analytics" routerLinkActive="is-active" ariaCurrentWhenActive="page">
            <svg lucideChartColumn [size]="18"></svg><span>Analytics</span>
          </a>
          <a routerLink="/phases" routerLinkActive="is-active" ariaCurrentWhenActive="page">
            <svg lucideActivity [size]="18"></svg><span>Phases</span>
          </a>
          <a routerLink="/battery" routerLinkActive="is-active" ariaCurrentWhenActive="page">
            <svg lucideBatteryCharging [size]="18"></svg><span>Battery</span>
          </a>
          <a routerLink="/solar" routerLinkActive="is-active" ariaCurrentWhenActive="page">
            <svg lucideSunMedium [size]="18"></svg><span>Solar</span>
          </a>
          <a routerLink="/cost" routerLinkActive="is-active" ariaCurrentWhenActive="page">
            <svg lucideCoins [size]="18"></svg><span>Cost</span>
          </a>
          <a routerLink="/alerts" routerLinkActive="is-active" ariaCurrentWhenActive="page">
            <svg lucideBell [size]="18"></svg><span>Alerts</span>
            @if (store.activeAlertCount() > 0) {
              <em class="badge">{{ store.activeAlertCount() }}</em>
            }
          </a>
          <a routerLink="/settings" routerLinkActive="is-active" ariaCurrentWhenActive="page">
            <svg lucideSettings [size]="18"></svg><span>Settings</span>
          </a>
        </nav>
        <p class="rail-note">In-memory fixture. No network calls.</p>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div>
            <p class="eyebrow">{{ settings().siteId }}</p>
            <h1>{{ settings().name }}</h1>
          </div>
          <div class="topbar-actions">
            <span class="demo demo-lg">DEMO</span>
            <time [attr.datetime]="clockIso">{{ clock }}</time>
            <span class="status" [attr.data-status]="live().status">{{ statusLabel(live().status) }}</span>
            <button type="button" class="theme-toggle" (click)="toggleTheme()" [attr.aria-pressed]="settings().theme === 'light'">
              @if (settings().theme === 'dark') {
                <svg lucideSun [size]="16"></svg><span>Light</span>
              } @else {
                <svg lucideMoon [size]="16"></svg><span>Dark</span>
              }
            </button>
          </div>
        </header>
        <main id="content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class Shell {
  protected readonly store = inject(SiteStore);
  protected readonly settings = this.store.settings;
  protected readonly live = this.store.live;
  protected readonly clock = FIXTURE_CLOCK;
  protected readonly clockIso = '2026-06-18T13:20:00.000Z';
  protected readonly statusLabel = statusLabel;

  protected toggleTheme(): void {
    this.store.patch({ theme: this.settings().theme === 'dark' ? 'light' : 'dark' });
  }
}
