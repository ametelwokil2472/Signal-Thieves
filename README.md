# Signal Thieves — Netlify edition

Responsive React party game with a Netlify Function and strongly consistent Netlify Blobs. No persistent Node server, WebSocket, login, or install required for players.

## Deploy

1. Sign in to Netlify and visit https://app.netlify.com/drop.
2. Drag the **project ZIP** (or its extracted root folder) into Netlify Drop **while signed in**, choosing the option that builds the framework project. Source deployment must execute `npm install` and `npm run build`; uploading the unbuilt source as a static-only site does **not** deploy a function.
3. If Netlify Drop doesn't build and bundle the function in your account, connect the same project through a Git repository, or use `npm install && npm run build && npx netlify deploy --build --prod` with Netlify CLI. A static-only drag-and-drop of `dist/` will not deploy the game backend.
4. Netlify reads root `netlify.toml`: publish `dist`, functions in `netlify/functions`, esbuild bundling. The endpoint is exactly `/.netlify/functions/game`.
5. Open the deployed HTTPS site on two browsers, create a room, join using the four-letter code, and start. Select three rounds for a shorter test.

## Local development

Node 20+ required. Run `npm install` then `npx netlify dev`. Open the URL printed by Netlify CLI (typically http://localhost:8888). Plain `vite` cannot emulate Blobs or Functions.

## Notes

- Every API operation performs a strongly consistent read, applies state transitions, and conditionally writes using the blob ETag. Conflicts retry. Four-letter codes use `onlyIfNew`.
- Browsers poll every 750 ms; this is not equivalent to low-latency Socket.IO and may consume function and blob quotas. Rooms expire logically after 24 hours, but blob objects are not automatically deleted.
- Scores are awarded by the existing game engine. A two-player game uses no Thieves and awards a precision bonus in place of suspicion votes.
- Netlify Blobs is not a transactional database. For a high-volume production game or strict concurrency guarantees across many simultaneous requests, use a transactional database.
- This source package includes no compiled frontend or bundled function; Netlify must perform a build for drag-and-drop source publishing.
