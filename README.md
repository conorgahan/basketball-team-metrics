# Team Metrics (PWA)

Angular PWA that tracks the four U14 metrics (eFG%, TOV%, DRB%, FTR) per game and over the season. Team-level only; no player stats.

## Run

- Dev: `npm install && npm start` (service worker is off in dev)
- Build: `npm run build` → `dist/basketball-team-metrics/browser`
- Local test of the PWA: `npx http-server dist/basketball-team-metrics/browser -p 8080`

## Share / install on a phone

Host `dist/basketball-team-metrics/browser` on any static HTTPS host (GitHub Pages, Netlify, Cloudflare Pages), send the link, then

- iPhone/iPad: Safari → Share → Add to Home Screen
- Android: Chrome → Install app
  Service workers need HTTPS (or localhost), so a plain `http://<LAN-ip>` link will not install offline. After first load the app works offline.

## Data

Stored on-device in localStorage (persistent storage requested). Use Data → Export backup (.json) to back up or move data; Import merges by game id. CSV export opens in Excel/Sheets.
