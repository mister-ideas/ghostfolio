import { LineChartItem } from '@ghostfolio/common/interfaces';

import { format, startOfDay } from 'date-fns';

export const INTRADAY_SAMPLES_KEY_PREFIX = 'gf-intraday-';
export const INTRADAY_SAMPLE_INTERVAL_MS = 60_000;

export interface IntradaySample {
  timestamp: number;
  value: number;
}

function getKey(aDate: Date) {
  return `${INTRADAY_SAMPLES_KEY_PREFIX}${format(aDate, 'yyyy-MM-dd')}`;
}

export function loadIntradaySamples(aDate = new Date()): IntradaySample[] {
  try {
    const samples = JSON.parse(localStorage.getItem(getKey(aDate)) ?? '[]');

    return Array.isArray(samples) ? samples : [];
  } catch {
    return [];
  }
}

/**
 * Stores the current value of the day (at most one sample per minute) in the
 * local storage of the device, because only a single value per day is stored
 * on the server. Samples of previous days are removed.
 */
export function recordIntradaySample({
  now = new Date(),
  value
}: {
  now?: Date;
  value: number;
}): IntradaySample[] {
  const samples = loadIntradaySamples(now);
  const last = samples.at(-1);

  if (!last || now.getTime() - last.timestamp >= INTRADAY_SAMPLE_INTERVAL_MS) {
    samples.push({ value, timestamp: now.getTime() });
  } else {
    // Keep the latest value of the current minute
    last.value = value;
  }

  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);

      if (key?.startsWith(INTRADAY_SAMPLES_KEY_PREFIX) && key !== getKey(now)) {
        localStorage.removeItem(key);
      }
    }

    localStorage.setItem(getKey(now), JSON.stringify(samples));
  } catch {}

  return samples;
}

/**
 * Builds the chart of the current day: the baseline (the close of the previous
 * day) at the start of the day followed by the recorded samples of the day.
 */
export function getIntradayChartItems({
  baseline,
  now = new Date(),
  samples
}: {
  baseline: number;
  now?: Date;
  samples: IntradaySample[];
}): LineChartItem[] {
  return [
    { date: startOfDay(now).toISOString(), value: baseline },
    ...samples.map(({ timestamp, value }) => {
      return { value, date: new Date(timestamp).toISOString() };
    })
  ];
}
