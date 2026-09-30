# RRI Event Wheel

A live prize-draw wheel for RRI events: conferences, galas, launches and award nights. It's built for a real stage: provably fair draws, a cinematic spin that lands exactly on the winner, a stage-style reveal and an admin panel that event staff can use without training.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 72 unit tests (fairness, landing math, data, import/export, persistence)
npm run build      # production build in dist/
npm run preview    # serve the production build
```

The first launch creates a **demo event** (30 names and 6 prizes, marked "Demo data"), so you can spin right away.

## Running an event (operator guide)

1. Open the app. The **live wheel** is the main screen.
2. Click **ADMIN** (top right).
3. **Participants**: add people one at a time, paste a list of names or import a CSV/TXT file.
4. **Prizes**: add each prize with a photo and a quantity.
5. **Branding** (optional): RRI's logo and colours are already set.
6. **Draw settings**: pick Standard, Dramatic or Grand Prize. You can also turn sound, confetti and winner removal on or off here.
7. Pick the prize under **Choose the prize**, then click **START PRESENTATION**.
8. Press **Space** (or click **SPIN**).

New events can use **Quick setup** (Admin → Quick setup). It's 5 steps and you can skip any of them.

### Presentation mode: `/event/:eventId/present`

- Full screen, huge type and the biggest wheel the screen allows. No admin UI and no emails or phone numbers.
- **Space / Enter**: spin, or continue after a reveal
- **S**: emergency stop (while spinning) · **F**: toggle full screen · **L**: lock controls · **Esc**: leave full screen
- Move the mouse and three small controls appear (Stop, Fullscreen, Exit). They hide again after 2.5 s.

### Safety controls (operator screen)

- **Emergency stop** freezes the wheel instantly. No winner is recorded, and the stop goes into the activity log.
- **Reset current draw** clears the reveal and any unfinished multi-winner batch.
- **Undo last draw** removes the last winner, puts them back in the draw and restores the prize stock. It asks for confirmation first.
- **Lock controls** blocks spins and setting changes.
- Every destructive action (clear participants, clear history, delete event, reset event) asks for a plain-language confirmation.

## How fairness works

```
crypto.getRandomValues  →  winner fixed  →  target segment  →  target rotation  →  animation  →  exact landing  →  reveal
```

- `lib/random/secureRandom.ts`: rejection sampling on `crypto.getRandomValues`, so there's no modulo bias. `Math.random` is never used for a draw, and a test checks this.
- `lib/draw/selectWinner.ts` picks the winner **before** anything moves. The wheel only shows that result.
- `lib/wheel/wheelMath.ts` holds the geometry (clockwise from 12 o'clock) and `computeTargetRotation`.
- `lib/wheel/spinPlan.ts` gives position as an **analytic function of time**. That keeps the landing exact even when frames drop or the tab gets throttled. After each spin the rotation is folded back into [0, 360), so error can't build up across spins.
- Admin → Advanced → **Fairness self-check** simulates 500 spins in the browser and tests the RNG's uniformity.

## Animation

States: `IDLE → PRE_SPIN → ACCELERATING → FULL_SPEED → DECELERATING → FINAL_SLOWDOWN → LANDING → SUSPENSE → WINNER_REVEAL → CELEBRATION → COMPLETE`.

| Mode        | Spin | Notes                                                                    |
|-------------|------|--------------------------------------------------------------------------|
| Standard    | ~5 s | quick, for frequent draws                                                |
| Dramatic    | ~9 s | default: long coast, then a slow crawl at the end                        |
| Grand Prize | ~12 s + reveal | long wind-up, deeper slowdown, blackout, "AND THE WINNER IS…" beat, bigger celebration |

- The velocity curve is continuous: a cosine ease-in, then constant speed, then a `(1-u)^p` coast. The final part of the coast crawls on purpose.
- The wheel settles back slightly onto its final angle. The overshoot always stays inside the winning segment.
- Ticks come from actual peg crossings, so they slow down as the wheel slows. The pointer kicks on each tick and springs back.
- Sound is synthesised with Web Audio, so there are no audio files and it works offline. It covers `spin_start`, `wheel_tick`, `spin_loop` (tracks speed), `slowdown`, `final_tick`, `winner_reveal` and `celebration`.
- Confetti plays a small burst, pauses, fires side cannons, then drifts down gently.
- Reduced motion follows the OS setting by default and can be forced on or off. It shortens the spin and cuts effects, but keeps the reveal readable.

Wheel labels depend on how many names there are: 1–30 get full names, 31–100 get compact labels, and 101–1,000+ get no labels. A live "name under the pointer" readout sits under the wheel. The face is drawn once to an offscreen canvas, and each frame only rotates it.

## Architecture

```
src/
  components/
    wheel/        Wheel, WheelCanvas (GSAP loop), WheelPointer, SpinButton, WheelEffects
    winner/       WinnerReveal, Celebration (confetti)
    stage/        Stage (live screen), OperatorBar, PresenterControls
    participants/ ParticipantTable (virtualised), ParticipantImporter, ParticipantEditor, PasteNames, ParticipantSearch
    prizes/       PrizeCard, PrizeEditor, PrizeSelector, PrizeShowcase
    branding/     BrandLogo, BrandingEditor, LogoUploader, ColorPicker, BrandPreview
    event/        EventCard
    common/       Button, Modal, ConfirmDialog, Toast, Form controls, ErrorBoundary
  pages/          EventScreen, Presentation, admin/* (Home, Event, Participants, Prizes, Branding,
                  DrawSettings, Winners, Advanced, Events & templates, SetupWizard)
  lib/            wheel/ random/ draw/ audio/ storage/ csv/ export/ event/ image/
  store/          appStore (events + persistence), drawStore (live draw), toastStore
  hooks/          useDrawController (draw orchestration), useFullscreen, usePresent, …
  types/
```

- **Persistence**: IndexedDB through a small `StorageAdapter` interface (`lib/storage/storage.ts`). Writes happen immediately and are coalesced per event. If IndexedDB is blocked, the app falls back to in-memory storage and warns the user. To use a backend instead, write another adapter.
- **Data safety**: everything loaded or imported goes through `lib/event/sanitize.ts`. Corrupt data gets repaired or skipped and never crashes the app.
- **Privacy**: no network calls. Email, phone and extra CSV columns only appear in Admin.

## Routes

`/` live event (operator) · `/event/:id/present` presentation · `/admin` and `/admin/{event,participants,prizes,branding,draw,winners,advanced,events,setup}`.
Aliases: `/dashboard`, `/events`, `/events/:id`, `/events/:id/{participants,prizes,winners,branding,settings,present}`.

## Deploying

`npm run build` outputs a static site. `vercel.json` and `public/_redirects` (Netlify) set up the SPA fallback so deep links like `/event/…/present` work.

## Known limitations

- Data is stored per browser and per device. To move an event, use Admin → Advanced → Export/Import event file.
- Browsers only allow fullscreen and audio after a click, so the presentation goes fullscreen when an operator clicks **Start presentation**. Opening the link directly doesn't do it.
- The presentation runs in the same tab as the operator screen. There's no synced second-screen mode yet.
- Demo prize images are generated placeholders marked "DEMO IMAGE".
