import type { EChartsCoreOption } from 'echarts/core';
import type { CostBucket, DisplayUnits, EnergyGrain, EnergyPoint } from '../core/api/site-api';
import type { BatterySample } from '../core/api/site-api';
import { formatBucket, formatEnergy, formatMoney, formatPower, formatSoc } from './format';
import type { ChartPalette } from './palette';

interface TooltipItem {
  seriesName?: string;
  value?: number | string;
  marker?: string;
  axisValueLabel?: string;
  axisValue?: string;
}

export function energyChart(
  points: EnergyPoint[],
  grain: EnergyGrain,
  palette: ChartPalette,
  units: DisplayUnits,
): EChartsCoreOption {
  const scale = units === 'kW' ? 1000 : 1;
  const unit = units === 'kW' ? 'kWh' : 'Wh';
  return axisChart(
    points.map((point) => formatBucket(point.at, grain)),
    [
      bar('Consumption', points.map((point) => point.consumptionWh / scale), palette.house),
      bar('Solar', points.map((point) => point.solarWh / scale), palette.solar),
      bar('Grid import', points.map((point) => point.gridImportWh / scale), palette.grid),
      bar('Grid export', points.map((point) => point.gridExportWh / scale), palette.export),
    ],
    palette,
    unit,
    grain === 'hour' || grain === 'day',
    (value) => formatEnergy(value * scale, units),
  );
}

export function batteryChart(
  history: BatterySample[],
  palette: ChartPalette,
  units: DisplayUnits,
): EChartsCoreOption {
  const scale = units === 'kW' ? 1000 : 1;
  const powerUnit = units === 'kW' ? 'kW' : 'W';
  return {
    backgroundColor: 'transparent',
    animationDuration: motion(),
    textStyle: { fontFamily: FONT, color: palette.muted },
    legend: legend(palette),
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.panel,
      borderColor: palette.line,
      textStyle: { color: palette.text, fontFamily: FONT },
      formatter: (params: unknown) => {
        const items = rows(params);
        const title = items[0]?.axisValueLabel ?? items[0]?.axisValue ?? '';
        const lines = items.map((item) => {
          const numeric = typeof item.value === 'number' ? item.value : Number(item.value);
          const text =
            item.seriesName === 'State of charge'
              ? formatSoc(numeric)
              : formatPower(numeric * scale, units);
          return `${item.marker ?? ''} ${item.seriesName ?? ''}: ${text}`;
        });
        return [title, ...lines].join('<br/>');
      },
    },
    grid: { left: 52, right: 52, top: 36, bottom: 28 },
    xAxis: {
      type: 'category',
      data: history.map((sample) => formatSampleTime(sample.at)),
      axisLabel: { color: palette.muted },
      axisLine: { lineStyle: { color: palette.line } },
    },
    yAxis: [
      {
        type: 'value',
        name: 'SOC %',
        min: 0,
        max: 100,
        nameTextStyle: { color: palette.muted },
        axisLabel: { color: palette.muted },
        splitLine: { lineStyle: { color: palette.line } },
      },
      {
        type: 'value',
        name: powerUnit,
        nameTextStyle: { color: palette.muted },
        axisLabel: { color: palette.muted },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'State of charge',
        type: 'line',
        yAxisIndex: 0,
        smooth: 0.25,
        showSymbol: false,
        data: history.map((sample) => sample.soc),
        lineStyle: { width: 2, color: palette.battery },
        itemStyle: { color: palette.battery },
      },
      bar(
        'Power',
        history.map((sample) => sample.powerW / scale),
        palette.solar,
        1,
      ),
    ],
  };
}

export function costChart(
  buckets: CostBucket[],
  grain: EnergyGrain,
  palette: ChartPalette,
  currency: string,
): EChartsCoreOption {
  return axisChart(
    buckets.map((bucket) => formatBucket(bucket.at, grain)),
    [
      bar('Import cost', buckets.map((bucket) => bucket.importCost), palette.grid),
      bar('Export credit', buckets.map((bucket) => bucket.exportCredit), palette.battery),
    ],
    palette,
    currency,
    grain === 'hour' || grain === 'day',
    (value) => formatMoney(value, currency),
  );
}

const FONT = 'ui-sans-serif, system-ui, sans-serif';

function axisChart(
  categories: string[],
  series: object[],
  palette: ChartPalette,
  yName: string,
  zoom: boolean,
  formatValue: (value: number) => string,
): EChartsCoreOption {
  return {
    backgroundColor: 'transparent',
    animationDuration: motion(),
    textStyle: { fontFamily: FONT, color: palette.muted },
    legend: legend(palette),
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.panel,
      borderColor: palette.line,
      textStyle: { color: palette.text, fontFamily: FONT },
      formatter: (params: unknown) => {
        const items = rows(params);
        const title = items[0]?.axisValueLabel ?? items[0]?.axisValue ?? '';
        const lines = items.map((item) => {
          const numeric = typeof item.value === 'number' ? item.value : Number(item.value);
          return `${item.marker ?? ''} ${item.seriesName ?? ''}: ${formatValue(numeric)}`;
        });
        return [title, ...lines].join('<br/>');
      },
    },
    grid: { left: 56, right: 16, top: 36, bottom: zoom ? 52 : 28 },
    dataZoom: zoom
      ? [
          { type: 'inside' },
          {
            type: 'slider',
            height: 16,
            bottom: 8,
            borderColor: palette.line,
            fillerColor: 'rgba(62, 224, 210, 0.2)',
            textStyle: { color: palette.muted },
          },
        ]
      : undefined,
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { color: palette.muted },
      axisLine: { lineStyle: { color: palette.line } },
    },
    yAxis: {
      type: 'value',
      name: yName,
      nameTextStyle: { color: palette.muted },
      axisLabel: { color: palette.muted },
      splitLine: { lineStyle: { color: palette.line } },
    },
    series,
  };
}

function bar(name: string, data: number[], color: string, yAxisIndex?: number): object {
  return {
    name,
    type: 'bar',
    yAxisIndex,
    data,
    barMaxWidth: 18,
    itemStyle: { color, borderRadius: [3, 3, 0, 0] },
  };
}

function legend(palette: ChartPalette): object {
  return { textStyle: { color: palette.muted, fontFamily: FONT }, top: 0 };
}

function rows(params: unknown): TooltipItem[] {
  return Array.isArray(params) ? (params as TooltipItem[]) : [params as TooltipItem];
}

function formatSampleTime(iso: string): string {
  const date = new Date(iso);
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function motion(): number {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 0;
  }
  return 400;
}
