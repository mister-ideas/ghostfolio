import type { ElementRef } from '@angular/core';
import type {
  Chart,
  ChartOptions,
  ChartType,
  ControllerDatasetOptions,
  Plugin,
  Point,
  ScaleOptions,
  Tick,
  TooltipOptions,
  TooltipPosition
} from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import { format } from 'date-fns';

import { secondaryColorRgb } from './config';
import {
  DATE_FORMAT,
  DATE_FORMAT_MONTHLY,
  DATE_FORMAT_YEARLY,
  getBackgroundColor,
  getDateFormatString,
  getLocale,
  getTextColor
} from './helper';
import { ColorScheme, DateRange, GroupBy } from './types';

export function formatGroupedDate({
  date,
  groupBy
}: {
  date: number;
  groupBy: GroupBy;
}) {
  if (groupBy === 'month') {
    return format(date, DATE_FORMAT_MONTHLY);
  } else if (groupBy === 'year') {
    return format(date, DATE_FORMAT_YEARLY);
  }

  return format(date, DATE_FORMAT);
}

// Colors for the lines of the compared benchmarks, the portfolio uses the
// primary color
const BENCHMARK_COLORS = [
  `rgb(${secondaryColorRgb.r}, ${secondaryColorRgb.g}, ${secondaryColorRgb.b})`,
  'rgb(255, 159, 64)',
  'rgb(75, 192, 112)',
  'rgb(153, 102, 255)',
  'rgb(255, 99, 132)',
  'rgb(201, 203, 207)'
];

export function getBenchmarkColor(index: number) {
  return BENCHMARK_COLORS[index % BENCHMARK_COLORS.length];
}

export function getChartBorderColor(colorScheme?: ColorScheme) {
  return `rgba(${getTextColor(colorScheme)}, 0.1)`;
}

export function getChartElementsOptions(
  colorScheme?: ColorScheme
): ChartOptions<'bar' | 'line'>['elements'] {
  return {
    line: {
      tension: 0
    },
    point: {
      hoverBackgroundColor: getBackgroundColor(colorScheme),
      hoverRadius: 2,
      radius: 0
    }
  };
}

/**
 * Returns the unit of the ticks of the time axis, so that the labels fit the
 * length of the date range: days up to a month, months up to a year and years
 * above
 */
export function getTimeAxisUnit(
  aDateRange?: DateRange
): 'day' | 'month' | 'year' {
  switch (aDateRange) {
    case '1d':
    case 'mtd':
    case 'wtd':
      return 'day';
    case '5y':
    case 'max':
    case undefined:
      return 'year';
    default:
      // 'ytd', '1y' and single years
      return 'month';
  }
}

export function getTimeAxisOptions({
  borderWidth = 1,
  colorScheme,
  display = true,
  locale = getLocale(),
  unit = 'year'
}: {
  borderWidth?: number;
  colorScheme?: ColorScheme;
  display?: boolean;
  locale?: string;
  unit?: 'day' | 'month' | 'year';
}): ScaleOptions<'time'> {
  return {
    display,
    border: {
      color: getChartBorderColor(colorScheme),
      width: borderWidth
    },
    grid: {
      display: false
    },
    ticks: {
      autoSkip: true,
      maxRotation: 0,
      maxTicksLimit: 6
    },
    time: {
      tooltipFormat: getDateFormatString(locale),
      unit
    },
    type: 'time'
  };
}

export function getTooltipOptions<T extends ChartType>({
  colorScheme,
  currency = '',
  groupBy,
  locale = getLocale(),
  unit = ''
}: {
  colorScheme?: ColorScheme;
  currency?: string;
  groupBy?: GroupBy;
  locale?: string;
  unit?: string;
}): Partial<TooltipOptions<T>> {
  const textColor = getTextColor(colorScheme);

  return {
    backgroundColor: getBackgroundColor(colorScheme),
    bodyColor: `rgb(${textColor})`,
    borderWidth: 1,
    borderColor: getChartBorderColor(colorScheme),
    // @ts-expect-error: no need to set all attributes in callbacks
    callbacks: {
      label: (context) => {
        let label = (context.dataset as ControllerDatasetOptions).label ?? '';

        if (label) {
          label += ': ';
        }

        const yPoint = (context.parsed as Point).y;

        if (yPoint !== null) {
          if (currency) {
            label += `${yPoint.toLocaleString(locale, {
              maximumFractionDigits: 2,
              minimumFractionDigits: 2,
              useGrouping: true
            })} ${currency}`;
          } else if (unit) {
            label += `${yPoint.toFixed(2)} ${unit}`;
          } else {
            label += yPoint.toFixed(2);
          }
        }

        return label;
      },
      title: (contexts) => {
        const xPoint = (contexts[0].parsed as Point).x;

        if (groupBy && xPoint !== null) {
          return formatGroupedDate({ groupBy, date: xPoint });
        }

        return contexts[0].label;
      }
    },
    caretSize: 0,
    cornerRadius: 2,
    footerColor: `rgb(${textColor})`,
    itemSort: (a, b) => {
      // Reverse order
      return b.datasetIndex - a.datasetIndex;
    },
    titleColor: `rgb(${textColor})`,
    usePointStyle: true
  };
}

export function getTooltipPositionerMapTop(
  chart: Chart,
  position: TooltipPosition
) {
  if (!position || !chart?.chartArea) {
    return false;
  }

  return {
    x: position.x,
    y: chart.chartArea.top
  };
}

export function getValueAxisOptions({
  colorScheme,
  display = true,
  highlightedValues = [],
  tickCallback
}: {
  colorScheme?: ColorScheme;
  display?: boolean;
  highlightedValues?: number[];
  tickCallback: (
    tickValue: number | string,
    index: number,
    ticks: Tick[]
  ) => string;
}): ScaleOptions<'linear'> {
  const borderColor = getChartBorderColor(colorScheme);

  return {
    display,
    border: {
      display: false
    },
    grid: {
      color: ({ scale, tick }) => {
        if (
          tick.value === 0 ||
          tick.value === scale.max ||
          tick.value === scale.min ||
          highlightedValues.includes(tick.value)
        ) {
          return borderColor;
        }

        return 'transparent';
      }
    },
    position: 'right',
    ticks: {
      display,
      callback: tickCallback,
      mirror: true,
      z: 1
    }
  };
}

export function getVerticalHoverLinePlugin<T extends 'line' | 'bar'>(
  chartCanvas: ElementRef<HTMLCanvasElement>,
  colorScheme?: ColorScheme
): Plugin<T, { color: string; width: number }> {
  return {
    afterDatasetsDraw: (chart, _, options) => {
      const active = chart.getActiveElements();

      if (!active || active.length === 0) {
        return;
      }

      const color = options.color ?? `rgb(${getTextColor(colorScheme)})`;
      const width = options.width ?? 1;

      const {
        chartArea: { bottom, top }
      } = chart;
      const xValue = active[0].element.x;

      const context = chartCanvas.nativeElement.getContext('2d');

      if (context) {
        context.lineWidth = width;
        context.strokeStyle = color;

        context.beginPath();
        context.moveTo(xValue, top);
        context.lineTo(xValue, bottom);
        context.stroke();
      }
    },
    id: 'verticalHoverLine'
  };
}

export function getZeroLineAnnotation(
  colorScheme?: ColorScheme
): AnnotationOptions<'line'> {
  return {
    borderColor: getChartBorderColor(colorScheme),
    borderWidth: 1,
    scaleID: 'y',
    type: 'line',
    value: 0
  };
}

export function transformTickToAbbreviation(value: number) {
  if (value === 0) {
    return '0';
  } else if (value >= -999 && value <= 999) {
    return value.toFixed(2);
  } else if (value >= -999999 && value <= 999999) {
    return `${value / 1000}K`;
  } else {
    return `${value / 1000000}M`;
  }
}
