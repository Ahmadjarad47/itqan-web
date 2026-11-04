import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '@shared/ui/icon/icon';
import { ConfirmService } from './confirm.service';
import { ToastService, ToastTone } from './toast.service';

const TONE_ICONS: Record<ToastTone, string> = {
  success: 'check-circle',
  info: 'bell',
  warning: 'alert',
  danger: 'x-circle',
};

/** Renders global toasts and the confirmation dialog. */
@Component({
  selector: 'app-feedback-host',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feedback-host.html',
  styleUrl: './feedback-host.scss',
})
export class FeedbackHost {
  protected readonly toast = inject(ToastService);
  protected readonly confirm = inject(ConfirmService);
  protected readonly icons = TONE_ICONS;
}
