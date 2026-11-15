# Solar OS

Energy control center for one site. The UI is an Angular app with a dark default and a light theme. Every screen reads one in-memory DEMO fixture. There is no backend in this repository and the app does not call the network.

## Run

```bash
npm install
npm start
```

Open `http://localhost:4200`. Production build:

```bash
npm run build
npm test
```

`npm install` uses `legacy-peer-deps` (see `.npmrc`) so the Angular 21 and Vitest peer set resolves on npm 10.

## Stub data

`FixtureSiteApi` implements the `/api/v1` client interface. The UI talks to `SiteStore`, and the store talks only to that interface. The fixture clock is **18 Jun 2026, 13:20 UTC**. It does not advance. Refreshing the page restores the default fixture. Settings change the same model, so overview, flow, analytics, phases, battery, solar, cost, and alerts stay in agreement.

Stub values are marked **DEMO**.

## Sign convention

Power is watts. Energy is watt-hours.

- Grid import is positive into the site. Export is negative grid power.
- House consumption is positive demand.
- Battery charge is positive into the battery. Discharge is negative.
- Solar and generator are positive generation. This fixture leaves the generator at 0 W.

AC balance:

```text
solarW + generatorW + gridW = consumptionW + batteryW
```

Battery losses (96% charge, 96% discharge) change stored watt-hours. They are not applied a second time in the cost figures. Self-consumption is `(solarWh − gridExportWh) / solarWh`, clamped to 0–1. A null ratio means there was no solar, which is shown as an em dash rather than zero.

## Screens

| Route | What it shows |
| --- | --- |
| `/` | Live KPIs, today’s energy, net cost, balance |
| `/flow` | Solar, house, battery, grid, generator, animated only while a path has power |
| `/analytics` | Hour, day, week, month, year from the same series |
| `/phases` | L1 L2 L3 voltage, current, power, power factor, imbalance, overload |
| `/battery` | SOC, capacity, power, throughput, temperature, health, runtime assumption |
| `/solar` | Power, today’s yield, peak, export, self-consumption |
| `/cost` | Tariff, import cost, export credit, assumptions |
| `/alerts` | Alerts derived from the snapshot and the thresholds |
| `/settings` | Name, phases, limits, capacities, tariffs, thresholds, theme, units |

A single-phase installation leaves L2 and L3 empty. Those readings are absent, not zero.

## Layout

- `src/app/core/api` — interface shared with the API plan
- `src/app/core/domain` — balance and flow allocation
- `src/app/core/model` — deterministic fixture model
- `src/app/core/fixture` — `FixtureSiteApi`
- `src/app/core/state` — signal store
- `src/app/features` — lazy screens
- `src/app/shell` — navigation, theme, DEMO badge
