import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  DestroyRef,
  Directive,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  ViewContainerRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroupDirective } from '@angular/forms';
import { STORAGE_NAMESPACE } from '@infrastructure/persistence/local-storage.repository';
import { debounceTime } from 'rxjs';
import { Icon } from '../icon/icon';

const DRAFT_PREFIX = `${STORAGE_NAMESPACE}draft.`;

interface StoredDraft {
  readonly value: unknown;
  readonly savedAt: number;
}

function readDraft(key: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, value: unknown): number {
  const savedAt = Date.now();
  try {
    localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify({ value, savedAt } satisfies StoredDraft));
  } catch {
    // Storage full or unavailable: drafts are best-effort.
  }
  return savedAt;
}

function deleteDraft(key: string): void {
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    // Nothing to remove.
  }
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const timeFormat = new Intl.DateTimeFormat('ar-SY-u-nu-latn', { hour: '2-digit', minute: '2-digit' });

/** Status strip shown above a drafted form: "draft restored" / "draft saved". */
@Component({
  selector: 'app-draft-notice',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'draft-notice',
    '[class.draft-notice--restored]': 'restored()',
    '[hidden]': '!restored() && !savedAt()',
    role: 'status',
    'aria-live': 'polite',
  },
  template: `
    <app-icon [name]="restored() ? 'refresh' : 'check'" [size]="15" />
    @if (restored()) {
      <span>تمت استعادة مسودة غير محفوظة{{ savedAt() ? ' (' + time(savedAt()!) + ')' : '' }}</span>
      <button type="button" class="draft-notice__discard" (click)="discard.emit()">تجاهل المسودة</button>
    } @else {
      <span>حُفظت المسودة تلقائياً{{ savedAt() ? ' · ' + time(savedAt()!) : '' }}</span>
    }
  `,
})
export class DraftNotice {
  readonly restored = signal(false);
  readonly savedAt = signal<number | null>(null);
  readonly discard = output<void>();
  protected time(at: number): string {
    return timeFormat.format(at);
  }
}

/**
 * Auto-saves a reactive form as a local draft while the user types, restores it
 * when the same form is opened again, and clears it once the form is submitted.
 *
 * Forms live inside dialogs whose content is projected, so the directive outlives
 * each opening: `draftActive` tells it when a dialog session starts and ends.
 *
 * Usage: `<form [formGroup]="form" appDraft="supplier:new" [draftActive]="dialogOpen()">` —
 * the key should distinguish "create" from "edit <id>" so drafts never leak between records.
 */
@Directive({
  selector: 'form[formGroup][appDraft]',
  host: { '(submit)': 'onSubmit()' },
})
export class FormDraft {
  readonly appDraft = input.required<string>();
  /** Whether the form is currently open for editing (e.g. its dialog is shown). */
  readonly draftActive = input(true);

  private readonly formDirective = inject(FormGroupDirective);
  private readonly container = inject(ViewContainerRef);
  private readonly destroyRef = inject(DestroyRef);
  private notice: ComponentRef<DraftNotice> | null = null;
  /** Key and initial value of the running session; null while the form is closed. */
  private session: { key: string; pristine: unknown; last: string } | null = null;
  private submittedAt = 0;
  private startTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const active = this.draftActive();
      const key = this.appDraft();
      untracked(() => {
        this.end();
        // Start once the host has finished resetting / filling the form for this opening
        // (hosts do that synchronously or in an effect during the same change-detection pass).
        if (active) this.startTimer = setTimeout(() => this.begin(key));
      });
    });

    // Defer the subscription so the form group is bound before we read valueChanges.
    setTimeout(() => {
      this.form.valueChanges.pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.save());
    });
    this.destroyRef.onDestroy(() => {
      this.end();
      this.notice?.destroy();
    });
  }

  private get form() {
    return this.formDirective.form;
  }

  private ensureNotice(): DraftNotice {
    if (!this.notice) {
      this.notice = this.container.createComponent(DraftNotice);
      this.notice.instance.discard.subscribe(() => this.discard());
    }
    // Keep the notice right above the form (the form may have been re-attached by its dialog).
    const host = this.container.element.nativeElement as HTMLElement;
    if (host.previousElementSibling !== this.notice.location.nativeElement) host.before(this.notice.location.nativeElement);
    return this.notice.instance;
  }

  private begin(key: string): void {
    const pristine = this.form.getRawValue();
    this.session = { key, pristine, last: JSON.stringify(pristine) };
    this.submittedAt = 0;
    const notice = this.ensureNotice();
    notice.restored.set(false);
    notice.savedAt.set(null);

    const draft = readDraft(key);
    if (draft && !sameValue(draft.value, pristine)) {
      this.form.patchValue(draft.value as never);
      this.session.last = JSON.stringify(this.form.getRawValue());
      this.form.markAsDirty();
      notice.restored.set(true);
      notice.savedAt.set(draft.savedAt);
    }
  }

  private save(): void {
    if (!this.session) return;
    const { key, pristine } = this.session;
    const value = this.form.getRawValue();
    const serialized = JSON.stringify(value);
    if (serialized === this.session.last) return; // e.g. the restore itself
    this.session.last = serialized;
    const notice = this.ensureNotice();
    if (sameValue(value, pristine)) {
      deleteDraft(key);
      notice.savedAt.set(null);
      notice.restored.set(false);
      return;
    }
    notice.restored.set(false);
    notice.savedAt.set(writeDraft(key, value));
  }

  private discard(): void {
    if (!this.session) return;
    deleteDraft(this.session.key);
    this.session.last = JSON.stringify(this.session.pristine);
    this.form.reset(this.session.pristine as never);
    this.notice?.instance.restored.set(false);
    this.notice?.instance.savedAt.set(null);
  }

  protected onSubmit(): void {
    if (this.form.valid) this.submittedAt = Date.now();
  }

  /** Closing right after a valid submit means the record was saved: drop the draft. */
  private end(): void {
    clearTimeout(this.startTimer);
    const session = this.session;
    if (!session) return;
    this.session = null;
    // Hosts close the form synchronously on a successful save; a later close is a cancel.
    if (this.submittedAt && Date.now() - this.submittedAt < 1500) {
      deleteDraft(session.key);
    } else if (!sameValue(this.form.getRawValue(), session.pristine)) {
      writeDraft(session.key, this.form.getRawValue());
    }
  }
}
