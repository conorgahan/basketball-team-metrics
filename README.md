# Team Metrics

An installable web app (PWA) for coaches to assess **team** performance with four tempo-free basketball metrics. It is built for underage teams, runs offline on a phone or tablet, and keeps all data on the device. There are no player stats.

## Metrics

| Metric   | Meaning              | Formula                              | Target    | Green / Amber / Red         |
| -------- | -------------------- | ------------------------------------ | --------- | --------------------------- |
| **eFG%** | Shooting efficiency  | (FGM + 0.5 × 3PM) / FGA              | 40–45%    | ≥ 40 / 35–40 / < 35         |
| **TOV%** | Ball protection      | 100 × TOV / (FGA + 0.44 × FTA + TOV) | < 20%     | < 20 / 20–25 / > 25         |
| **DRB%** | Defensive rebounding | DRB / (DRB + opponent ORB)           | > 65%     | ≥ 65 / 60–65 / < 60         |
| **FTR**  | "Hustle"             | FTA / FGA                            | 0.25–0.35 | ≥ 0.25 / 0.18–0.25 / < 0.18 |

Season and filter figures are calculated from **summed counts** across the selected games, not by averaging per-game percentages.

Extra markers shown on the Metrics tab: turnovers per game (goal under 15), free throw attempts per game (goal over 20) and FT% (goal over 52%).

The targets and colour thresholds live in [`src/app/models.ts`](src/app/models.ts).

## Using the app

- **Game** (`+ Game`): record a game live with Made / Miss taps for 2-pointers, 3-pointers and free throws, and +1 taps for turnovers, defensive rebounds and opponent offensive rebounds. Undo removes the last tap, and "Edit totals manually" lets you key in a box score afterwards. Save is enabled only once something has changed.
- **Metrics**: the four metrics, the extra markers, trend charts with the target range shaded, and a game-by-game table. A period toggle (All games, Last 5, Last 3, Last 1) and a share button that sends a text report.
- **Games**: every game as a card; tap one to edit or delete it.
- **Data**: season start date, teams, competitions, backup, import and reset.

### Filters

Team, season, competition and opponent are multi-select and shared by the Metrics and Games tabs, so switching tabs keeps the same view. Nothing selected means "all". Selecting several values means "any of" within a filter and "and" between filters. Opponent names are matched ignoring case and spacing, so "Tolka" and "tolka " are one opponent. The default view is the first team in the current season.

### Seasons, teams and competitions

- A game belongs to the season whose start date it falls on or after. The default start is **1 September**, set under Data → Season dates. A 1 January start gives labels like `2027`; any other start gives `2026-27`.
- Teams and competitions are managed identically: a list with game counts, an add field and a Delete button. **Deleting one also deletes its games**, after a confirmation. The last team and the last competition cannot be deleted.
- Defaults for a fresh install: team `My Team`, competitions `League`, `Cup` and `Friendly`.

## Data and backups

Everything is stored in the browser's `localStorage` on the device (key `team-metrics.v1`), and the app asks the browser for persistent storage. Data is per device and per web address, and is never synced.

Under Data → Backup & sharing:

- **Export backup (.json)**: games, teams, competitions and season settings.
- **Export spreadsheet (.csv)**: one row per game with a season column, for Excel or Sheets.
- **Import & merge backups**: select one or more `.json` backups to merge.
  - Per game id, the most recently edited version wins.
  - A game identical to one already present (same date, team, opponent and counts) is skipped.
  - A game with the same date, team and opponent but different numbers is added and flagged as a possible duplicate.
  - Teams and competitions from the files are added. The season start date is never overwritten.
  - A file that fails to parse is reported by name without stopping the others.
- **Delete everything** wipes games, teams, competitions and settings back to a fresh install.

## Tech stack

- Angular 22 (standalone components, signals), TypeScript 6
- Angular Material 22 with the default Azure theme and the system font
- `ng2-charts` / Chart.js with `chartjs-plugin-annotation` for the trend charts
- `@angular/service-worker` for offline use, with an in-app "new version available" prompt
- Hash routing and relative asset paths, so it can be hosted at any URL or subfolder

## Development

**Requires Node 22.22.3 or newer** (Angular 22).

```
npm install
npm start          # dev server; the service worker is off in dev
npm run build      # production build -> dist/basketball-team-metrics/browser
npm run format     # Prettier
```

To test the PWA locally, build and serve the output over `localhost` (service workers need HTTPS or localhost):

```
npx http-server dist/basketball-team-metrics/browser -p 8080
```

### Project layout

```
src/app/
  models.ts                 types, metric definitions, formulas, defaults
  storage.service.ts        persistence, seasons, import / export
  filters.service.ts        shared team / season / competition / opponent filters
  filter-bar.component.ts   the four multi-select filter fields
  name-list.component.ts    team and competition manager card
  confirm-dialog.component.ts
  pages/                    dashboard (Metrics), game, games, data
public/                     manifest, icons, logo.svg
```

The app icon is a basketball with a rising trend line. `public/logo.svg` is the source; the PNG icons and `favicon.ico` were rendered from it.

## Deploying

The app is static, so any static HTTPS host works (GitHub Pages, Cloudflare Pages, Netlify).

**GitHub Pages:** `.github/workflows/deploy.yml` builds with Node 22 on every push to `main` and publishes `dist/basketball-team-metrics/browser`. In the repository settings, set Pages → Source to **GitHub Actions**. The site is then at `https://<user>.github.io/<repo>/`.

Coaches install it from the link:

- **iPhone / iPad**: open in Safari → Share → Add to Home Screen
- **Android**: open in Chrome → Install app

After the first load the app works offline. When you publish a new version, phones show a "A new version is available" message the next time the app is opened.

Notes:

- Storage belongs to the web address. Moving to a new URL starts every phone empty, so choose the address before sharing, or export a backup first and import it at the new address.
- Safari can clear storage for sites that are not installed after about a week of non-use. Installed home-screen apps are not affected, so remind coaches to export a backup now and then.
- A plain `http://<LAN-ip>` link opens as a normal web page but cannot be installed or used offline.
