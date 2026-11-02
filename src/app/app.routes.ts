import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent, title: 'Metrics' },
  { path: 'games', loadComponent: () => import('./pages/games.component').then((m) => m.GamesComponent), title: 'Games' },
  { path: 'game/:id', loadComponent: () => import('./pages/game.component').then((m) => m.GameComponent), title: 'Game' },
  { path: 'data', loadComponent: () => import('./pages/data.component').then((m) => m.DataComponent), title: 'Data' },
  { path: '**', redirectTo: '' },
];
