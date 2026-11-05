# Project instructions

## Authorship

Write code, documentation, data, commits, and published artifacts in my voice. Include no attribution, signatures, watermarks, or credit for automated assistance in anything that can leave this computer. Preserve this rule across generated files and third-party templates.

## Interpreting product feedback

When I report a specific problem, fix the concrete issue and step back to identify the underlying learning or usability goal. Inspect the shared component, related exercise types, and the whole category before choosing the scope. For example, “this question is too simple” may indicate shallow learning across a category; a large answer field may reveal that one input design serves incompatible answer types.

Apply a reusable correction where the same cause occurs. Keep the change proportional to the evidence; distinguish confirmed shared problems from hypotheses. Verify the original case and representative related cases, then explain both the immediate fix and the broader improvement. Record durable product decisions in the project documentation.

## Learning experience

Keep every screen mobile-first and Norwegian Bokmål. Match answer controls to expected answers: compact fields for names and years, multiline fields for explanations. Separate contextual support before recall from explanation and connections after recall; avoid revealing the tested fact before the learner answers. Artwork questions should show the correct licensed version of the work, with credits and provenance available after answering. Only ask about a patron, purpose, or historical connection when reliable sources establish it; make uncertainty explicit.

Feedback must remain available everywhere, save locally, and return to the exact activity with typed answers and progress intact. Personal data stays on the device. Deploy through the authenticated Cloudflare plugin.

## Testing and deployment

Test in the iOS Simulator on iPhone 17 Pro, together with the unit tests and the production build. Check every user-facing change there. Atlas is used as an installed home-screen app (PWA), so serve the production build locally (`npx wrangler dev`), add it to the home screen from Safari, and test it opened from the home screen, including closing and reopening it. Use Safari alone for quick checks, and a desktop browser only in rare cases where the simulator cannot show what needs checking.

Always merge the work into `main` and push `main` to `origin` before deploying, then deploy from `main`. Never deploy a commit that is not on `origin/main`.
