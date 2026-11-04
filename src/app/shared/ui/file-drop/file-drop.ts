import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Attachment, AttachmentKind, ATTACHMENT_RULES, fileExtension } from '@domain/models';
import { nowIso } from '@domain/rules';
import { Icon } from '../icon/icon';

export interface RejectedFile {
  readonly name: string;
  readonly reason: string;
}

/** Drag-and-drop area that turns selected files into attachment metadata. */
@Component({
  selector: 'app-file-drop',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label
      class="zone"
      [class.zone--over]="dragging()"
      [class.zone--compact]="compact()"
      (dragover)="onDragOver($event)"
      (dragleave)="dragging.set(false)"
      (drop)="onDrop($event)"
    >
      <input type="file" multiple [accept]="accept()" (change)="onSelect($event)" />
      <span class="zone__icon"><app-icon name="upload" [size]="compact() ? 16 : 20" /></span>
      <span class="zone__text">
        <strong>{{ label() ?? 'اسحب الملفات هنا أو انقر للاختيار' }}</strong>
        <small class="ltr">{{ extensions().join(' · ').toUpperCase() }}</small>
      </span>
    </label>
  `,
  styles: `
    .zone {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border: 1.5px dashed var(--border-strong);
      border-radius: var(--radius);
      background: var(--surface-2);
      cursor: pointer;
      transition: all 0.18s;
    }
    .zone:hover,
    .zone--over {
      border-color: var(--primary);
      background: var(--primary-soft);
    }
    .zone--compact {
      padding: 8px 12px;
    }
    input {
      display: none;
    }
    .zone__icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: var(--surface);
      color: var(--primary);
      box-shadow: var(--shadow-xs);
    }
    .zone--compact .zone__icon {
      width: 30px;
      height: 30px;
    }
    .zone__text {
      display: flex;
      flex-direction: column;
      font-size: 13px;
    }
    small {
      color: var(--text-subtle);
      font-size: 11px;
      text-align: start;
    }
  `,
})
export class FileDrop {
  readonly kind = input<AttachmentKind>('document');
  readonly label = input<string>();
  readonly compact = input(false);

  readonly added = output<Attachment[]>();
  readonly rejected = output<RejectedFile[]>();

  protected readonly dragging = signal(false);
  protected readonly extensions = computed(() => ATTACHMENT_RULES[this.kind()].extensions);
  protected readonly accept = computed(() => this.extensions().map((ext) => `.${ext}`).join(','));

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.handle(Array.from(event.dataTransfer?.files ?? []));
  }

  protected onSelect(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    this.handle(Array.from(inputEl.files ?? []));
    inputEl.value = '';
  }

  private handle(files: File[]): void {
    const allowed = this.extensions();
    const accepted: Attachment[] = [];
    const rejected: RejectedFile[] = [];
    for (const file of files) {
      if (!allowed.includes(fileExtension(file.name))) {
        rejected.push({ name: file.name, reason: 'صيغة غير مدعومة' });
        continue;
      }
      accepted.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        kind: this.kind(),
        uploadedAt: nowIso(),
      });
    }
    if (accepted.length) this.added.emit(accepted);
    if (rejected.length) this.rejected.emit(rejected);
  }
}
