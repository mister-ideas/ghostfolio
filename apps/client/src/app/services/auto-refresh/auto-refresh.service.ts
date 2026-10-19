import { Service } from '@angular/core';
import { EMPTY, fromEvent, Observable, timer } from 'rxjs';
import {
  distinctUntilChanged,
  map,
  share,
  startWith,
  switchMap
} from 'rxjs/operators';

export const AUTO_REFRESH_INTERVAL_MS = 15_000;

/**
 * Emits at a fixed interval while the page is visible so that pages can
 * refresh their numbers silently. The timer stops while the tab is hidden
 * and fires once immediately when the tab becomes visible again.
 */
@Service()
export class AutoRefreshService {
  public readonly refresh$: Observable<void>;

  public constructor() {
    let isFirstActivation = true;

    this.refresh$ = fromEvent(document, 'visibilitychange').pipe(
      startWith(undefined),
      map(() => document.visibilityState === 'visible'),
      distinctUntilChanged(),
      switchMap((isVisible) => {
        if (!isVisible) {
          return EMPTY;
        }

        const dueTime = isFirstActivation ? AUTO_REFRESH_INTERVAL_MS : 0;

        isFirstActivation = false;

        return timer(dueTime, AUTO_REFRESH_INTERVAL_MS).pipe(
          map(() => undefined)
        );
      }),
      share()
    );
  }
}
