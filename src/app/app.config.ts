import { ApplicationConfig, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { PreloadAllModules, provideRouter, withComponentInputBinding, withInMemoryScrolling, withPreloading, withViewTransitions } from '@angular/router';
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
      // Fetch every screen's code in the background after start-up so navigation is instant.
      withPreloading(PreloadAllModules),
    ),
    provideInfrastructure(),
    provideAppInitializer(loadApplicationState),
  ],
};
