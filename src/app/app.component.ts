import { Component, DestroyRef, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { SwUpdate } from '@angular/service-worker';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatTabsModule, MatButtonModule],
  styles: `
    img {
      margin-right: 10px;
    }
    nav {
      max-width: 1040px;
      margin: 0 auto;
    }
  `,
  template: `
    <div class="app-header">
      <mat-toolbar>
        <img src="logo-emblem.png" alt="" width="32" height="32" />
        <span>Team Metrics</span>
        <span class="spacer"></span>
        <a mat-flat-button routerLink="/game/new">+ Game</a>
      </mat-toolbar>
      <nav mat-tab-nav-bar [tabPanel]="panel" mat-stretch-tabs="true">
        <a mat-tab-link routerLink="/" routerLinkActive #metrics="routerLinkActive" [routerLinkActiveOptions]="{ exact: true }" [active]="metrics.isActive">Metrics</a>
        <a mat-tab-link routerLink="/games" routerLinkActive #games="routerLinkActive" [active]="games.isActive">Games</a>
        <a mat-tab-link routerLink="/data" routerLinkActive #data="routerLinkActive" [active]="data.isActive">Data</a>
      </nav>
    </div>
    <mat-tab-nav-panel #panel
      ><main><router-outlet /></main
    ></mat-tab-nav-panel>
  `,
})
export class AppComponent {
  private sw = inject(SwUpdate);
  private snack = inject(MatSnackBar);

  constructor() {
    if (!this.sw.isEnabled) return;
    const destroyRef = inject(DestroyRef);
    const sub = this.sw.versionUpdates.subscribe((e) => {
      if (e.type === 'VERSION_READY') this.promptReload('A new version is available.');
    });
    const unrecoverable = this.sw.unrecoverable.subscribe(() => this.promptReload('The app needs to reload.'));
    // The browser only checks for a new version on navigation; also check when the app returns to the foreground.
    const check = () => {
      if (document.visibilityState === 'visible') this.sw.checkForUpdate().catch(() => {});
    };
    document.addEventListener('visibilitychange', check);
    destroyRef.onDestroy(() => {
      sub.unsubscribe();
      unrecoverable.unsubscribe();
      document.removeEventListener('visibilitychange', check);
    });
  }

  private promptReload(message: string) {
    this.snack
      .open(message, 'Update now')
      .onAction()
      .subscribe(async () => {
        try {
          await this.sw.activateUpdate();
        } finally {
          document.location.reload();
        }
      });
  }
}
