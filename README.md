# Geeta Project

A small effort to present the Bhagavad Gita as it is written in Sanskrit, with simple modern Hindi and English translations for easier reading.

## Source

The Sanskrit text is obtained from the Gita Supersite by IIT Kanpur:

https://www.gitasupersite.iitk.ac.in/

Gita Supersite began as a research and development initiative at IIT Kanpur under the Department of Computer Science & Engineering to digitize, analyze, and map Indian philosophical texts.

## Translations

Hindi and English translations are generated with an LLM. The goal is not commentary, but clear, direct, modern-language meaning alongside the original Sanskrit.

The generated text is also written to `public/llms.txt` for LLM-friendly reading and indexing.

## Run The App

```bash
pnpm install
pnpm dev
```

Open the local URL printed by Vite.

## Scripts

Scrape Sanskrit/source content:

```bash
pnpm scrape:scripture
```

Generate translations with OpenRouter:

```cmd
set OPENROUTER_API_KEY=your_api_key_here && pnpm translate:verses
```

Force regenerate existing translations:

```cmd
set OPENROUTER_API_KEY=your_api_key_here && set FORCE_TRANSLATE=1 && pnpm translate:verses
```

Build for production:

```bash
pnpm build
```
