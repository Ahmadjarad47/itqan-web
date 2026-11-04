import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthorizationService } from '@application/auth/authorization.service';
import { Permission } from '@domain/models';
import { NAVIGATION } from '../layout/navigation';

/** Allows the route when the current user holds at least one of the permissions. */
export function requirePermission(...permissions: Permission[]): CanActivateFn {
  return () => inject(AuthorizationService).canAny(permissions) || inject(Router).createUrlTree(['/forbidden']);
}

/** First screen the user is allowed to open. */
export function firstAllowedLink(auth: AuthorizationService): string {
  const item = NAVIGATION.flatMap((group) => group.items).find((nav) => auth.can(nav.permission));
  return item?.link ?? '/forbidden';
}

/** Redirect target for empty and unknown URLs (must run in an injection context). */
export function landingUrl(): string {
  return firstAllowedLink(inject(AuthorizationService));
}
