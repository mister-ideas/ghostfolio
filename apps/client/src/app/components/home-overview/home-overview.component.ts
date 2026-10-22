import { GfDateRangeSelectorComponent } from '@ghostfolio/client/components/date-range-selector/date-range-selector.component';
import { GfPortfolioPerformanceComponent } from '@ghostfolio/client/components/portfolio-performance/portfolio-performance.component';
import { LayoutService } from '@ghostfolio/client/core/layout.service';
import { AutoRefreshService } from '@ghostfolio/client/services/auto-refresh/auto-refresh.service';
import { ImpersonationStorageService } from '@ghostfolio/client/services/impersonation-storage.service';
import { UserService } from '@ghostfolio/client/services/user/user.service';
import { getTradingDayItems } from '@ghostfolio/common/chart-helper';
import {
  DEFAULT_CURRENCY,
  DEFAULT_USER_DATE_RANGE,
  DEFAULT_LOCALE,
  NUMERICAL_PRECISION_THRESHOLD_6_FIGURES
} from '@ghostfolio/common/config';
import { isIntradayDateRange } from '@ghostfolio/common/date-range.helper';
import { isCashPosition } from '@ghostfolio/common/helper';
import {
  AssetProfileIdentifier,
  NullableLineChartItem,
  PortfolioPerformance,
  PortfolioPerformanceResponse,
  PortfolioPosition,
  User
} from '@ghostfolio/common/interfaces';
import { hasPermission, permissions } from '@ghostfolio/common/permissions';
import { internalRoutes } from '@ghostfolio/common/routes/routes';
import { hasScope, scopes } from '@ghostfolio/common/scopes';
import { DateRange } from '@ghostfolio/common/types';
import { GfHoldingsTableComponent } from '@ghostfolio/ui/holdings-table';
import { GfLineChartComponent } from '@ghostfolio/ui/line-chart';
import { DataService } from '@ghostfolio/ui/services';

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Router, RouterModule } from '@angular/router';
import { DeviceDetectorService } from 'ngx-device-detector';
import {
  catchError,
  EMPTY,
  exhaustMap,
  filter,
  forkJoin,
  map,
  Observable,
  of
} from 'rxjs';

const MINIMUM_CHART_ITEMS = 3;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    GfDateRangeSelectorComponent,
    GfHoldingsTableComponent,
    GfLineChartComponent,
    GfPortfolioPerformanceComponent,
    MatButtonModule,
    MatCardModule,
    RouterModule
  ],
  selector: 'gf-home-overview',
  styleUrls: ['./home-overview.scss'],
  templateUrl: './home-overview.html'
})
export class GfHomeOverviewComponent implements OnInit {
  protected readonly errors = signal<AssetProfileIdentifier[]>([]);
  protected readonly hasImpersonationId = signal(false);
  protected readonly historicalDataItems = signal<
    NullableLineChartItem[] | null
  >(null);

  // A line through only two points (e.g. the close of the previous day and
  // now) is drawn as a misleading slope across the whole width
  protected readonly hasEnoughChartData = computed(() => {
    const minimum = isIntradayDateRange(this.dateRange())
      ? 1
      : MINIMUM_CHART_ITEMS;

    return (
      (this.historicalDataItems() ?? []).filter(({ value }) => {
        return value !== null;
      }).length >= minimum
    );
  });
  protected readonly holdings = signal<PortfolioPosition[] | undefined>(
    undefined
  );
  protected readonly isLoadingPerformance = signal(true);
  protected readonly isMarketOpen = signal<boolean | undefined>(undefined);

  protected readonly dateRange = computed<DateRange>(() => {
    return this.user()?.settings?.dateRange ?? DEFAULT_USER_DATE_RANGE;
  });

  protected readonly locale = computed(() => {
    return this.user()?.settings?.locale ?? DEFAULT_LOCALE;
  });

  protected readonly performance = signal<PortfolioPerformance | null>(null);
  protected readonly performanceLabel = $localize`Performance`;
  protected readonly precision = signal(2);
  protected readonly user = signal<User | null>(null);

  protected readonly routerLinkAccounts = internalRoutes.accounts.routerLink;
  protected readonly routerLinkPortfolio = internalRoutes.portfolio.routerLink;
  protected readonly routerLinkPortfolioActivities =
    internalRoutes.portfolio.subRoutes.activities.routerLink;
  protected readonly routerLinkPortfolioActivitiesCreate =
    internalRoutes.portfolio.subRoutes.activities.subRoutes.create.routerLink;

  protected readonly deviceType = computed(
    () => this.deviceDetectorService.deviceInfo().deviceType
  );

  protected readonly hasPermissionToCreateActivity = computed(() => {
    return (
      hasPermission(this.user()?.permissions, permissions.createActivity) &&
      hasScope(this.user()?.scopes, scopes.activityCreate)
    );
  });

  protected readonly showDetails = computed(() => {
    const user = this.user();

    return user
      ? !user?.settings?.isRestrictedView && user?.settings?.viewMode !== 'ZEN'
      : false;
  });

  protected readonly showExperimentalHoldings = computed(() => {
    const user = this.user();

    return (
      user?.settings?.isExperimentalFeatures === true &&
      user?.settings?.viewMode !== 'ZEN'
    );
  });

  protected readonly unit = computed(() => {
    if (!this.showDetails()) {
      return '%';
    }

    return this.deviceType() === 'mobile'
      ? undefined
      : (this.user()?.settings?.baseCurrency ?? DEFAULT_CURRENCY);
  });

  private readonly autoRefreshService = inject(AutoRefreshService);
  private readonly dataService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly deviceDetectorService = inject(DeviceDetectorService);
  private readonly impersonationStorageService = inject(
    ImpersonationStorageService
  );
  private readonly layoutService = inject(LayoutService);
  private readonly router = inject(Router);
  private readonly userService = inject(UserService);

  public constructor() {
    this.userService.stateChanged
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (state?.user) {
          this.user.set(state.user);
          this.update();
        }
      });
  }

  public ngOnInit() {
    this.impersonationStorageService
      .onChangeHasImpersonation()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((impersonationId) => {
        this.hasImpersonationId.set(!!impersonationId);
      });

    this.layoutService.shouldReloadContent$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.update();
      });

    this.autoRefreshService.refresh$
      .pipe(
        filter(() => !!this.user() && !this.isLoadingPerformance()),
        exhaustMap(() => {
          const dateRange = this.dateRange();

          return forkJoin({
            chart: this.fetchChartItems(dateRange),
            response: this.dataService.fetchPortfolioPerformance({
              range: dateRange
            })
          }).pipe(catchError(() => EMPTY));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ chart, response }) => {
        this.setPerformance(response);

        // Same series: the line chart moves without the drawing animation
        this.historicalDataItems.set(
          chart ?? this.getDailyChartItems(response)
        );

        this.autoRefreshService.markUpdated();
      });

    this.autoRefreshService.refresh$
      .pipe(
        filter(() => this.showExperimentalHoldings() && !!this.holdings()),
        exhaustMap(() => {
          return this.dataService
            .fetchPortfolioHoldings({
              filters: [{ id: 'ACTIVE', type: 'HOLDING_TYPE' }],
              range: this.user()?.settings?.dateRange
            })
            .pipe(catchError(() => EMPTY));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ holdings }) => {
        this.holdings.set(this.filterCashPositions(holdings));
      });
  }

  protected onHoldingClicked({ dataSource, symbol }: AssetProfileIdentifier) {
    if (dataSource && symbol) {
      void this.router.navigate([], {
        queryParams: { dataSource, symbol, holdingDetailDialog: true }
      });
    }
  }

  private filterCashPositions(holdings: PortfolioPosition[]) {
    const baseCurrency =
      this.user()?.settings?.baseCurrency ?? DEFAULT_CURRENCY;

    return holdings.filter(({ assetProfile }) => {
      return !(
        isCashPosition(assetProfile) &&
        assetProfile.currency === baseCurrency &&
        assetProfile.symbol === baseCurrency
      );
    });
  }

  private fetchChartItems(
    aDateRange: DateRange
  ): Observable<NullableLineChartItem[] | null> {
    if (!isIntradayDateRange(aDateRange)) {
      // The daily chart is part of the performance response
      return of(null);
    }

    return this.dataService.fetchPortfolioIntraday({ range: aDateRange }).pipe(
      map(({ chart }) => {
        return chart.map(({ date, value }) => {
          return { date, value: value === null ? null : value * 100 };
        });
      }),
      // Fall back to the daily chart
      catchError(() => of(null))
    );
  }

  private getDailyChartItems({
    chart
  }: PortfolioPerformanceResponse): NullableLineChartItem[] {
    return getTradingDayItems({
      dateRange: this.dateRange(),
      items:
        chart?.map(({ date, netPerformanceInPercentageWithCurrencyEffect }) => {
          return {
            date,
            value: (netPerformanceInPercentageWithCurrencyEffect ?? 0) * 100
          };
        }) ?? []
    });
  }

  private setPerformance({
    errors,
    isMarketOpen,
    performance
  }: PortfolioPerformanceResponse) {
    this.errors.set(errors ?? []);
    this.isMarketOpen.set(isMarketOpen);
    this.performance.set(performance);
  }

  private update() {
    const userSettings = this.user()?.settings;

    this.historicalDataItems.set(null);
    this.isLoadingPerformance.set(true);

    if (this.showExperimentalHoldings()) {
      this.holdings.set(undefined);

      this.dataService
        .fetchPortfolioHoldings({
          filters: [{ id: 'ACTIVE', type: 'HOLDING_TYPE' }],
          range: userSettings?.dateRange
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(({ holdings }) => {
          this.holdings.set(this.filterCashPositions(holdings));
        });
    }

    const dateRange = this.dateRange();

    forkJoin({
      chart: this.fetchChartItems(dateRange),
      response: this.dataService.fetchPortfolioPerformance({
        range: dateRange
      })
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ chart, response }) => {
        const { performance } = response;

        this.setPerformance(response);
        this.historicalDataItems.set(
          chart ?? this.getDailyChartItems(response)
        );

        this.precision.set(2);

        if (
          this.deviceType() === 'mobile' &&
          performance.currentValueInBaseCurrency >=
            NUMERICAL_PRECISION_THRESHOLD_6_FIGURES
        ) {
          this.precision.set(0);
        }

        this.isLoadingPerformance.set(false);
      });
  }
}
