# PRN ASM — Sudoku Online & Realtime Multiplayer

An **offline-ready React presentation**, recreated from the 18-slide Canva design. Content was taken from the original Canva file and laid out as a modern developer-conference deck.

## How to open

Open `index.html` directly in Chrome, Edge, or Firefox. No installation, internet connection, Node.js, or build step is required. The project includes React and ReactDOM JavaScript runtime files locally, so it works from `file://`. The slideshow runtime uses an offline-compatible React 16 UMD build, separate from the **React 19** version mentioned as a technology of the Sudoku application in the original slides.

## Controls

| Key / action | Function |
|---|---|
| `→`, `Space`, `PageDown` | Next slide |
| `←`, `Backspace`, `PageUp` | Previous slide |
| `Home` / `End` | First / last slide |
| `O` | Slide overview |
| `F` | Fullscreen |
| `?` or `H` | Help |
| Mouse wheel / swipe | Navigate slides |

Onscreen controls at the bottom provide the same actions.

## Structure

- `index.html` — browser entry point.
- `src/app.js` — React components and 18 slide templates; content edits happen here.
- `src/styles.css` — visual design system, animations, responsive scaling.
- `assets/vendor/react.min.js` and `react-dom.min.js` — bundled local React 16 runtime, only for offline compatibility.
- `assets/icon.svg` — app favicon.

## Content integrity

Slide ordering and technical statements follow the supplied Canva presentation. Slides 14–18 intentionally reserve an open field for diagrams. No deployment claims were added.

## Presenting

For best results, use Chrome or Edge in 16:9 fullscreen (`F`). Use browser Zoom at 100%.

## Hosting

Deploy the folder unchanged as a static site (Vercel, Netlify, GitHub Pages, Cloudflare Pages, or static web server). No backend is required.

## Note

This is the presentation interface, not the actual Sudoku project's application frontend or a deployed production service.
