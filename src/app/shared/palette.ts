export interface ChartPalette {
  text: string;
  muted: string;
  line: string;
  solar: string;
  house: string;
  grid: string;
  battery: string;
  export: string;
  panel: string;
  violet: string;
}

const fallback: ChartPalette = {
  text: '#e7eef8',
  muted: '#93a4bd',
  line: 'rgba(148, 178, 210, 0.16)',
  solar: '#ffc14d',
  house: '#3ee0d2',
  grid: '#7aa2ff',
  battery: '#7dffb3',
  export: '#ff9d6b',
  panel: '#10192b',
  violet: '#b79bff',
};

export function readPalette(): ChartPalette {
  if (typeof document === 'undefined') {
    return fallback;
  }
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string, spare: string): string => style.getPropertyValue(name).trim() || spare;
  return {
    text: pick('--text', fallback.text),
    muted: pick('--muted', fallback.muted),
    line: pick('--line', fallback.line),
    solar: pick('--solar', fallback.solar),
    house: pick('--house', fallback.house),
    grid: pick('--grid', fallback.grid),
    battery: pick('--battery', fallback.battery),
    export: pick('--export', fallback.export),
    panel: pick('--bg-elev', fallback.panel),
    violet: pick('--violet', fallback.violet),
  };
}
