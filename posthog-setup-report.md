# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Bhagavad Gita reader app. PostHog is initialized in `src/main.tsx` using `posthog-js` and `@posthog/react`, with the `PostHogProvider` wrapping the entire React tree. Six custom events are captured across all key user interactions in `src/App.tsx`: chapter navigation, verse navigation via the rail selector, verse stepping via scroll/swipe, verse copying, and two ChatGPT integration actions. Error tracking via `captureException` is wired into the clipboard copy error path. Environment variables are stored in `.env.local` using the `VITE_` prefix required by Vite.

| Event name | Description | File |
|---|---|---|
| `chapter_selected` | Fired when the user explicitly selects a chapter from the rail selector. | `src/App.tsx` |
| `verse_selected` | Fired when the user explicitly selects a verse from the rail selector. | `src/App.tsx` |
| `verse_navigated` | Fired when the user steps to the next or previous verse via scroll, swipe, or keyboard. | `src/App.tsx` |
| `verse_copied` | Fired when the user successfully copies a verse to the clipboard. | `src/App.tsx` |
| `verse_opened_in_chatgpt` | Fired when the user opens the current verse in ChatGPT to ask questions about it. | `src/App.tsx` |
| `full_geeta_opened_in_chatgpt` | Fired when the user opens the full Bhagavad Gita context in ChatGPT. | `src/App.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/479044/dashboard/1739550)
- [Daily Active Readers](https://us.posthog.com/project/479044/insights/evtgJwo9)
- [Engagement Actions Over Time](https://us.posthog.com/project/479044/insights/okMvb2wD)
- [Verse Navigation vs Chapter Selection](https://us.posthog.com/project/479044/insights/k1TGm8rj)
- [Total Verses Copied](https://us.posthog.com/project/479044/insights/PT2MnvaF)
- [ChatGPT Engagement Rate](https://us.posthog.com/project/479044/insights/GKbHVSM2)

## Verify before merging

- [ ] Run a full production build (`pnpm build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `VITE_POSTHOG_PROJECT_TOKEN` and `VITE_POSTHOG_HOST` to `.env.example` and any bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
