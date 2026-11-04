import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'info' | 'warning' | 'danger';

export interface Toast {
  readonly id: number;
  readonly tone: ToastTone;
  readonly title: string;
  readonly message?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<readonly Toast[]>([]);

  show(tone: ToastTone, title: string, message?: string, durationMs = 4200): void {
    const toast: Toast = { id: this.nextId++, tone, title, message };
    this.toasts.update((items) => [...items, toast].slice(-4));
    setTimeout(() => this.dismiss(toast.id), durationMs);
  }

  success(title: string, message?: string): void {
    this.show('success', title, message);
  }

  info(title: string, message?: string): void {
    this.show('info', title, message);
  }

  warning(title: string, message?: string): void {
    this.show('warning', title, message);
  }

  error(title: string, message?: string): void {
    this.show('danger', title, message);
  }

  dismiss(id: number): void {
    this.toasts.update((items) => items.filter((toast) => toast.id !== id));
  }
}
