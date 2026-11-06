@AGENTS.md

## iOS Simulator testing happens in the PWA

All testing in the iOS Simulator (iPhone 17 Pro) is done in Atlas installed as a home-screen app (PWA), never in a Safari tab.

- Local changes: serve the production build with `npx wrangler dev`, add it to the home screen from Safari once, and open Atlas from the home screen icon.
- After a deploy: check the published address the same way, as a home-screen app added from that address.
- Close the app completely and reopen it from the home screen as part of every check, so saved state and the update banner are tested the way they are used.
- Safari is only used to add the app to the home screen.
