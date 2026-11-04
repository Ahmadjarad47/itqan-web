import { ApplicationConfig, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { loadApplicationState } from '@application/bootstrap';
import { provideInfrastructure } from '@infrastructure/provide-infrastructure';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions({
        skipInitialTransition: true,
        // A newer navigation aborts the running transition; that is expected, not an error.
        onViewTransitionCreated: ({ transition }) => {
          transition.ready.catch(() => undefined);
          transition.finished.catch(() => undefined);
        },
      }),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideInfrastructure(),
    provideAppInitializer(loadApplicationState),
  ],
};
