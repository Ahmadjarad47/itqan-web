import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { EmployeeStore } from '@application/state/organization.store';
import { SessionStore } from '@application/state/session.store';
import { TaskStore } from '@application/state/task.store';
import { EntityId } from '@domain/models';
import { ArDatePipe } from '@shared/pipes/format.pipes';
import { Avatar } from '@shared/ui/avatar/avatar';
import { Icon } from '@shared/ui/icon/icon';

/** Conversation between the manager and the assignee, kept inside the task. */
@Component({
  selector: 'app-task-chat',
  imports: [Avatar, Icon, ArDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chat">
      <div class="chat__log" #log>
        @for (m of messages(); track m.id) {
          @let mine = m.authorId === me();
          <div class="msg" [class.msg--mine]="mine">
            @if (!mine) {
              <app-avatar [name]="author(m.authorId)" [size]="28" />
            }
            <div class="msg__bubble">
              @if (!mine) {
                <strong class="msg__author">{{ author(m.authorId) }}</strong>
              }
              <p>{{ m.text }}</p>
              <time>{{ m.at | arDate: 'datetime' }}</time>
            </div>
          </div>
        } @empty {
          <p class="chat__empty"><app-icon name="message" [size]="18" /> لا توجد رسائل بعد — ابدأ المحادثة حول هذه المهمة.</p>
        }
      </div>
      @if (canWrite()) {
        <form class="chat__compose" (submit)="send($event)">
          <textarea
            class="textarea"
            rows="1"
            placeholder="اكتب رسالة..."
            [value]="draft()"
            (input)="draft.set($any($event.target).value)"
            (keydown.enter)="onEnter($event)"
          ></textarea>
          <button type="submit" class="btn btn--primary btn--icon" aria-label="إرسال" [disabled]="!draft().trim()">
            <app-icon name="send" [size]="16" />
          </button>
        </form>
      }
    </div>
  `,
  styles: `
    .chat {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .chat__log {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 320px;
      min-height: 140px;
      overflow-y: auto;
      padding: 12px;
      border-radius: var(--radius);
      background: var(--surface-sunken);
    }
    .chat__empty {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: auto;
      font-size: 12.5px;
      color: var(--text-subtle);
    }
    .msg {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      max-width: 85%;
      &--mine {
        align-self: flex-end;
        .msg__bubble {
          background: var(--primary);
          color: var(--primary-contrast);
          border-end-end-radius: 4px;
          border-end-start-radius: 14px;
        }
        time {
          color: inherit;
        }
      }
      &__bubble {
        padding: 8px 12px;
        border-radius: 14px;
        border-end-start-radius: 4px;
        background: var(--surface);
        box-shadow: var(--shadow-xs);
        p {
          margin: 0;
          white-space: pre-wrap;
          line-height: 1.6;
        }
        time {
          display: block;
          margin-top: 2px;
          font-size: 10.5px;
          opacity: 0.7;
        }
      }
      &__author {
        display: block;
        font-size: 11.5px;
        color: var(--primary);
      }
    }
    .chat__compose {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      .textarea {
        flex: 1;
        min-height: 40px;
        resize: vertical;
      }
    }
    .chat__note {
      font-size: 12px;
      margin: 0;
    }
  `,
})
export class TaskChat {
  private readonly tasks = inject(TaskStore);
  private readonly employees = inject(EmployeeStore);
  private readonly session = inject(SessionStore);

  readonly taskId = input.required<EntityId>();

  private readonly log = viewChild<ElementRef<HTMLElement>>('log');

  protected readonly draft = signal('');
  protected readonly me = this.session.userId;
  protected readonly task = computed(() => this.tasks.find(this.taskId()));
  protected readonly messages = computed(() => this.task()?.messages ?? []);
  /** Both screens hosting the chat are permission-guarded (assignee / task managers). */
  protected readonly canWrite = computed(() => !!this.task() && !!this.me());

  constructor() {
    // Opening the conversation marks it as read for the current user.
    effect(() => {
      const id = this.taskId();
      const me = this.me();
      this.messages();
      untracked(() => this.tasks.markChatRead(id, me));
    });
    afterRenderEffect(() => {
      this.messages();
      const el = this.log()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  protected author(id: EntityId): string {
    return this.employees.find(id)?.name ?? '—';
  }

  protected onEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.shiftKey) return;
    keyboard.preventDefault();
    this.send(event);
  }

  protected send(event: Event): void {
    event.preventDefault();
    const text = this.draft().trim();
    if (!text) return;
    this.tasks.postMessage(this.taskId(), this.me(), text);
    this.draft.set('');
  }
}
