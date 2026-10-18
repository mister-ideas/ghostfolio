import { getAvailableDateRanges } from './date-range.helper';

describe('getAvailableDateRanges', () => {
  const referenceDate = new Date('2026-10-19T12:00:00.000Z');

  it('returns the short ranges without any activity', () => {
    expect(getAvailableDateRanges({ referenceDate })).toEqual([
      '1d',
      'wtd',
      'mtd',
      'ytd',
      'max'
    ]);
  });

  it('returns the short ranges for less than one year of data', () => {
    expect(
      getAvailableDateRanges({
        referenceDate,
        dateOfFirstActivity: new Date('2026-01-05T00:00:00.000Z')
      })
    ).toEqual(['1d', 'wtd', 'mtd', 'ytd', 'max']);
  });

  it('adds 1y after one year of data', () => {
    expect(
      getAvailableDateRanges({
        referenceDate,
        dateOfFirstActivity: new Date('2025-10-18T00:00:00.000Z')
      })
    ).toEqual(['1d', 'wtd', 'mtd', 'ytd', '1y', 'max']);
  });

  it('adds 1y and 5y after five years of data', () => {
    expect(
      getAvailableDateRanges({
        referenceDate,
        dateOfFirstActivity: '2021-10-18T00:00:00.000Z'
      })
    ).toEqual(['1d', 'wtd', 'mtd', 'ytd', '1y', '5y', 'max']);
  });
});
