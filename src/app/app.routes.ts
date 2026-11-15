import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell/shell').then((module) => module.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Overview · Solar OS',
        loadComponent: () => import('./features/overview/overview').then((module) => module.OverviewPage),
      },
      {
        path: 'flow',
        title: 'Energy flow · Solar OS',
        loadComponent: () => import('./features/flow/flow').then((module) => module.FlowPage),
      },
      {
        path: 'analytics',
        title: 'Analytics · Solar OS',
        loadComponent: () =>
          import('./features/analytics/analytics').then((module) => module.AnalyticsPage),
      },
      {
        path: 'phases',
        title: 'Phases · Solar OS',
        loadComponent: () => import('./features/phases/phases').then((module) => module.PhasesPage),
      },
      {
        path: 'battery',
        title: 'Battery · Solar OS',
        loadComponent: () => import('./features/battery/battery').then((module) => module.BatteryPage),
      },
      {
        path: 'solar',
        title: 'Solar · Solar OS',
        loadComponent: () => import('./features/solar/solar').then((module) => module.SolarPage),
      },
      {
        path: 'cost',
        title: 'Cost · Solar OS',
        loadComponent: () => import('./features/cost/cost').then((module) => module.CostPage),
      },
      {
        path: 'alerts',
        title: 'Alerts · Solar OS',
        loadComponent: () => import('./features/alerts/alerts').then((module) => module.AlertsPage),
      },
      {
        path: 'settings',
        title: 'Settings · Solar OS',
        loadComponent: () =>
          import('./features/settings/settings').then((module) => module.SettingsPage),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
