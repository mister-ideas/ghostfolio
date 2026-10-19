import {
  AUTO_REFRESH_INTERVAL_MS,
  AutoRefreshService
} from './auto-refresh.service';

describe('AutoRefreshService', () => {
  const setVisibility = (state: 'hidden' | 'visible') => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state
    });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    jest.useFakeTimers();
    setVisibility('visible');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits at the interval while the page is visible', () => {
    const service = new AutoRefreshService();
    const next = jest.fn();
    const subscription = service.refresh$.subscribe(next);

    jest.advanceTimersByTime(AUTO_REFRESH_INTERVAL_MS - 1);
    expect(next).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(next).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(AUTO_REFRESH_INTERVAL_MS * 2);
    expect(next).toHaveBeenCalledTimes(3);

    subscription.unsubscribe();
  });

  it('pauses while hidden and refreshes immediately when visible again', () => {
    const service = new AutoRefreshService();
    const next = jest.fn();
    const subscription = service.refresh$.subscribe(next);

    setVisibility('hidden');
    jest.advanceTimersByTime(AUTO_REFRESH_INTERVAL_MS * 3);
    expect(next).not.toHaveBeenCalled();

    setVisibility('visible');
    jest.advanceTimersByTime(0);
    expect(next).toHaveBeenCalledTimes(1);

    subscription.unsubscribe();
  });
});
