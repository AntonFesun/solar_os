/**
 * AC bus identity used everywhere in Solar OS.
 *
 * solarW + generatorW + gridW = consumptionW + batteryW
 *
 * Grid import is positive. Export is negative grid power.
 * Battery charge is positive into the battery. House load is positive.
 */
export interface BusPowers {
  solarW: number;
  generatorW: number;
  gridW: number;
  consumptionW: number;
  batteryW: number;
}

export function balanceResidual(powers: BusPowers): number {
  return (
    powers.solarW + powers.generatorW + powers.gridW - powers.consumptionW - powers.batteryW
  );
}

export function gridFromBalance(powers: Omit<BusPowers, 'gridW'>): number {
  return powers.consumptionW + powers.batteryW - powers.solarW - powers.generatorW;
}

export interface EnergyFlows {
  solarToHouse: number;
  solarToBattery: number;
  solarToGrid: number;
  gridToHouse: number;
  gridToBattery: number;
  batteryToHouse: number;
  generatorToHouse: number;
}

/**
 * Splits a balanced snapshot into the paths the flow screen can draw.
 * Direction comes from the signs, not from a separate flag.
 * The DEMO dispatch never charges the battery from the grid, so
 * `gridToBattery` stays 0 unless a future model does.
 */
export function allocateFlows(powers: BusPowers): EnergyFlows {
  let solar = Math.max(0, powers.solarW);
  let generator = Math.max(0, powers.generatorW);
  let house = Math.max(0, powers.consumptionW);
  const charge = Math.max(0, powers.batteryW);
  const discharge = Math.max(0, -powers.batteryW);
  const gridImport = Math.max(0, powers.gridW);
  const gridExport = Math.max(0, -powers.gridW);

  const solarToHouse = Math.min(solar, house);
  solar -= solarToHouse;
  house -= solarToHouse;

  const batteryToHouse = Math.min(discharge, house);
  house -= batteryToHouse;

  const generatorToHouse = Math.min(generator, house);
  house -= generatorToHouse;

  const gridToHouse = Math.min(gridImport, house);

  const solarToBattery = Math.min(solar, charge);
  solar -= solarToBattery;
  const solarToGrid = Math.min(solar, gridExport);
  const gridToBattery = Math.min(
    Math.max(0, gridImport - gridToHouse),
    Math.max(0, charge - solarToBattery),
  );

  return {
    solarToHouse,
    solarToBattery,
    solarToGrid,
    gridToHouse,
    gridToBattery,
    batteryToHouse,
    generatorToHouse,
  };
}

export function selfConsumptionRatio(solarWh: number, exportWh: number): number | null {
  if (!(solarWh > 0)) {
    return null;
  }
  const ratio = (solarWh - exportWh) / solarWh;
  return Math.min(1, Math.max(0, ratio));
}

export function gridDependency(importWh: number, consumptionWh: number): number | null {
  if (!(consumptionWh > 0)) {
    return null;
  }
  return Math.min(1, Math.max(0, importWh / consumptionWh));
}
