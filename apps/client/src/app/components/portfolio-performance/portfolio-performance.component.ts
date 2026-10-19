import {
  getLocale,
  getNumberFormatDecimal,
  getNumberFormatGroup
} from '@ghostfolio/common/helper';
import {
  PortfolioPerformance,
  ResponseError
} from '@ghostfolio/common/interfaces';
import { GfFlashOnChangeDirective } from '@ghostfolio/ui/flash-on-change';
import { NotificationService } from '@ghostfolio/ui/notifications';
import { GfValueComponent } from '@ghostfolio/ui/value';

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  viewChild
} from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { CountUp } from 'countup.js';
import { addIcons } from 'ionicons';
import { timeOutline } from 'ionicons/icons';
import { isNumber } from 'lodash-es';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    GfFlashOnChangeDirective,
    GfValueComponent,
    IonIcon,
    NgxSkeletonLoaderModule
  ],
  selector: 'gf-portfolio-performance',
  styleUrls: ['./portfolio-performance.component.scss'],
  templateUrl: './portfolio-performance.component.html'
})
export class GfPortfolioPerformanceComponent {
  public readonly errors = input<ResponseError['errors']>();
  public readonly isLoading = input<boolean>(false);
  public readonly locale = input<string>(getLocale());
  public readonly performance = input.required<PortfolioPerformance | null>();
  public readonly precision = input.required<number, number>({
    transform: (value) => {
      return value >= 0 ? value : 2;
    }
  });
  public readonly showDetails = input<boolean>(false);
  public readonly unit = input.required<string | undefined>();

  private readonly value =
    viewChild.required<ElementRef<HTMLSpanElement>>('value');

  protected readonly displayedValue = computed(() => {
    const performance = this.performance();

    if (isNumber(performance?.currentValueInBaseCurrency)) {
      return performance.currentValueInBaseCurrency;
    }

    return this.showDetails() === false && performance
      ? performance.netPerformancePercentageWithCurrencyEffect * 100
      : undefined;
  });

  private countUp?: CountUp;
  private countUpTarget?: number;

  private readonly notificationService = inject(NotificationService);

  public constructor() {
    addIcons({ timeOutline });

    effect(() => {
      if (this.isLoading()) {
        this.countUp = undefined;
        this.countUpTarget = undefined;

        if (this.value().nativeElement) {
          this.value().nativeElement.innerHTML = '';
        }
      } else {
        const performance = this.performance();

        if (isNumber(performance?.currentValueInBaseCurrency)) {
          this.showValue({
            decimalPlaces: this.precision(),
            value: performance.currentValueInBaseCurrency
          });
        } else if (this.showDetails() === false && performance) {
          this.showValue({
            decimalPlaces: 2,
            value: performance.netPerformancePercentageWithCurrencyEffect * 100
          });
        } else {
          this.countUp = undefined;
          this.countUpTarget = undefined;
          this.value().nativeElement.innerHTML = '*****';
        }
      }
    });
  }

  /**
   * Counts up from zero on the initial value and rolls from the current to
   * the new number on a refresh. Nothing happens if the number is unchanged.
   */
  private showValue({
    decimalPlaces,
    value
  }: {
    decimalPlaces: number;
    value: number;
  }) {
    if (this.countUp && this.countUpTarget === value) {
      return;
    }

    const isUpdate = this.countUpTarget !== undefined;

    this.countUp = new CountUp('value', value, {
      decimalPlaces,
      decimal: getNumberFormatDecimal(this.locale()),
      duration: isUpdate ? 0.6 : 1,
      separator: getNumberFormatGroup(this.locale()),
      startVal: isUpdate ? this.countUpTarget : 0
    });

    this.countUp.start();

    this.countUpTarget = value;
  }

  protected onShowErrors() {
    const errors = this.errors();

    if (!errors?.length) {
      return;
    }

    const errorMessageParts: string[] = [];

    for (const error of errors) {
      errorMessageParts.push(`${error.symbol} (${error.dataSource})`);
    }

    this.notificationService.alert({
      message: errorMessageParts.join('<br />'),
      title: $localize`Market data is delayed for`
    });
  }
}
