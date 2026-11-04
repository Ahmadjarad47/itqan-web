import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Attachment, EntityId, fileExtension } from '@domain/models';
import { ArDatePipe } from '../../pipes/format.pipes';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-attachment-list',
  imports: [Icon, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (file of attachments(); track file.id) {
      <div class="file" animate.enter="enter-fade">
        <span class="file__ext ltr">{{ extension(file.name) }}</span>
        <div class="file__meta">
          <span class="file__name ltr">{{ file.name }}</span>
          <span class="file__info">{{ size(file.size) }} · {{ file.uploadedAt | arDate: 'datetime' }}</span>
        </div>
        @if (removable()) {
          <button type="button" class="btn btn--ghost btn--icon btn--sm" aria-label="حذف الملف" (click)="removed.emit(file.id)">
            <app-icon name="trash" [size]="15" />
          </button>
        }
      </div>
    } @empty {
      <p class="empty">{{ emptyText() }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .file {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
    }
    .file__ext {
      width: 40px;
      height: 40px;
      border-radius: 9px;
      display: grid;
      place-items: center;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--primary);
      background: var(--primary-soft);
    }
    .file__meta {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .file__name {
      font-weight: 600;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: start;
    }
    .file__info {
      font-size: 11.5px;
      color: var(--text-subtle);
    }
    .empty {
      font-size: 12.5px;
      color: var(--text-subtle);
    }
  `,
})
export class AttachmentList {
  readonly attachments = input.required<readonly Attachment[]>();
  readonly removable = input(true);
  readonly emptyText = input('لا توجد ملفات مرفقة');
  readonly removed = output<EntityId>();

  protected extension(name: string): string {
    return fileExtension(name) || 'file';
  }

  protected size(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
