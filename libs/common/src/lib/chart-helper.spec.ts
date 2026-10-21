import { getTimeAxisUnit } from './chart-helper';

describe('getTimeAxisUnit', () => {
  it.each([
    ['1d', 'day'],
    ['wtd', 'day'],
    ['mtd', 'day'],
    ['ytd', 'month'],
    ['1y', 'month'],
    ['2025', 'month'],
    ['5y', 'year'],
    ['max', 'year'],
    [undefined, 'year']
  ])('uses the unit of %s', (dateRange, unit) => {
    expect(getTimeAxisUnit(dateRange)).toBe(unit);
  });
});
