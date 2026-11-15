import {
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  viewChild,
  Component,
} from '@angular/core';
import { BarChart, LineChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { init, use, type EChartsCoreOption, type EChartsType } from 'echarts/core';

use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

@Component({
  selector: 'app-demo-chart',
  host: { class: 'chart-host' },
  template: `<div #host class="chart" role="img" [attr.aria-label]="label()"></div>`,
})
export class DemoChart {
  readonly option = input.required<EChartsCoreOption>();
  readonly label = input('DEMO chart');
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly destroyRef = inject(DestroyRef);
  private instance: EChartsType | null = null;

  constructor() {
    afterNextRender(() => {
      const element = this.host().nativeElement;
      this.instance = init(element, undefined, { renderer: 'canvas' });
      this.instance.setOption(this.option());
      const observer = new ResizeObserver(() => {
        requestAnimationFrame(() => this.instance?.resize());
      });
      observer.observe(element);
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        this.instance?.dispose();
        this.instance = null;
      });
    });

    effect(() => {
      const option = this.option();
      this.instance?.setOption(option, { notMerge: true });
    });
  }
}
