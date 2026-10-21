import { getTimeAxisBounds, getTimeAxisUnit } from './chart-helper';

describe('getTimeAxisUnit', () => {
  it.each([
    ['1d', 'hour'],
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

describe('getTimeAxisBounds', () => {
  const reference = new Date(2026, 9, 21, 15, 30);

  it('spans the whole current year for ytd', () => {
    const { max, min } = getTimeAxisBounds('ytd', reference);

    expect(new Date(min).toDateString()).toBe(
      new Date(2026, 0, 1).toDateString()
    );
    expect(new Date(max).toDateString()).toBe(
      new Date(2026, 11, 31).toDateString()
    );
  });

  it('spans the whole current month for mtd', () => {
    const { max, min } = getTimeAxisBounds('mtd', reference);

    expect(new Date(min).getDate()).toBe(1);
    expect(new Date(max).getDate()).toBe(31);
  });

  it('spans the whole current week for wtd', () => {
    const { max, min } = getTimeAxisBounds('wtd', reference);

    expect(new Date(min).getDay()).toBe(1);
    expect(new Date(max).getDay()).toBe(0);
  });

  it('spans the whole current day for 1d', () => {
    const { max, min } = getTimeAxisBounds('1d', reference);

    expect(new Date(min).getHours()).toBe(0);
    expect(new Date(max).getHours()).toBe(23);
  });

  it('spans a past year', () => {
    const { max, min } = getTimeAxisBounds('2024', reference);

    expect(new Date(min).getFullYear()).toBe(2024);
    expect(new Date(max).getMonth()).toBe(11);
  });

  it('does not fix the bounds of rolling ranges', () => {
    expect(getTimeAxisBounds('1y', reference)).toEqual({});
    expect(getTimeAxisBounds('5y', reference)).toEqual({});
    expect(getTimeAxisBounds('max', reference)).toEqual({});
  });
});
