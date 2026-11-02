import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { provideServiceWorker } from '@angular/service-worker';
import { CategoryScale, LineController, LineElement, LinearScale, PointElement, Tooltip } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { provideCharts } from 'ng2-charts';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'en-IE' },
    provideCharts({ registerables: [LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, annotationPlugin] }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
