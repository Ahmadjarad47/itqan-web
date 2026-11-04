import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthorizationService } from '@application/auth/authorization.service';
import { Permission } from '@domain/models';

/**
 * Renders its template only when the current user holds the permission.
 * Usage: `<button *appCan="'bom.edit'">` or `*appCan="'bom.edit'; else readonly"`.
 */
@Directive({ selector: '[appCan]' })
export class CanDirective {
  private readonly auth = inject(AuthorizationService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);

  readonly appCan = input.required<Permission | readonly Permission[]>();
  readonly appCanElse = input<TemplateRef<unknown> | null>(null);

  constructor() {
    effect(() => {
      const required = this.appCan();
      const allowed = this.auth.canAny(typeof required === 'string' ? [required] : required);
      this.container.clear();
      const template = allowed ? this.template : this.appCanElse();
      if (template) this.container.createEmbeddedView(template);
    });
  }
}
