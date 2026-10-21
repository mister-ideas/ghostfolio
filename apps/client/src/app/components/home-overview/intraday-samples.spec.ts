import {
  getIntradayChartItems,
  INTRADAY_SAMPLE_INTERVAL_MS,
  loadIntradaySamples,
  recordIntradaySample
} from './intraday-samples';

describe('intraday samples', () => {
  const now = new Date(2026, 9, 21, 10, 0, 0);

  beforeEach(() => {
    localStorage.clear();
  });

  it('records at most one sample per minute', () => {
    recordIntradaySample({ now, value: 1 });
    recordIntradaySample({ now: new Date(now.getTime() + 5_000), value: 2 });

    expect(loadIntradaySamples(now)).toEqual([
      { timestamp: now.getTime(), value: 2 }
    ]);

    recordIntradaySample({
      now: new Date(now.getTime() + INTRADAY_SAMPLE_INTERVAL_MS),
      value: 3
    });

    expect(loadIntradaySamples(now)).toHaveLength(2);
  });

  it('removes the samples of previous days', () => {
    recordIntradaySample({ now: new Date(2026, 9, 20, 15, 0), value: 1 });
    recordIntradaySample({ now, value: 2 });

    expect(loadIntradaySamples(new Date(2026, 9, 20))).toEqual([]);
    expect(loadIntradaySamples(now)).toHaveLength(1);
  });

  it('starts the chart of the day with the baseline at midnight', () => {
    const items = getIntradayChartItems({
      now,
      baseline: 0,
      samples: [{ timestamp: now.getTime(), value: 0.5 }]
    });

    expect(items).toHaveLength(2);
    expect(new Date(items[0].date).getHours()).toBe(0);
    expect(items[1].value).toBe(0.5);
  });
});
