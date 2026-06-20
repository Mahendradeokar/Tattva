import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { z } from "zod";

import { scripture } from "./scripture";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY is required.");
}

const openrouter = createOpenRouter({
  apiKey: OPENROUTER_API_KEY,
  appName: "geeta-project",
});

const MODEL = "openai/gpt-4o-mini";
const VERSE_PROCESS_LIMIT = 5;
const OUTPUT_FILE = new URL("./verse-translations.json", import.meta.url);

export const verseTranslationSchema = z
  .object({
    englishTranslation: z.string().min(1),
    hindiTranslation: z.string().min(1),
  })
  .strict();

type VerseTranslation = z.infer<typeof verseTranslationSchema>;

type VerseInput = {
  chapter: number;
  verse: number;
  sanskrit: string;
};

type TranslatedScripture = {
  title: string;
  chapters: Array<{
    number: number;
    title: string;
    verses: Array<{
      number: number;
      sanskrit: string;
      hindi: string;
      english: string;
    }>;
  }>;
};

export function buildVerseTranslationSystemPrompt() {
  return [
    "You translate Bhagavad Gita Sanskrit verses into structured data.",
    "Return only the requested structure.",
    "The reader is a normal, thoughtful person with good intellect who is curious to understand what is actually being said.",
    "The reader wants the literal content of the verse, not a sugar-coated version, devotional framing, philosophical opinion, or borrowed understanding from another person.",
    "Translate the verse as directly and faithfully as possible, so the reader can read what is written without another person's filter.",
    "Do not add commentary, sectarian explanation, personal interpretation, teaching notes, moral lessons, explanatory conclusions, or implied meaning.",
    "Keep the English and Hindi simple, direct, and faithful to what the verse says.",
  ].join(" ");
}

export function buildVerseTranslationPrompt(verse: VerseInput) {
  return [
    `Chapter: ${verse.chapter}`,
    `Verse: ${verse.verse}`,
    "Sanskrit:",
    verse.sanskrit,
    "",
    "Return englishTranslation and hindiTranslation only.",
    "Do not explain, interpret, expand, summarize, or add implied meaning.",
  ].join("\n");
}

export function getVerseInputs(limit = VERSE_PROCESS_LIMIT): VerseInput[] {
  return scripture.chapters
    .flatMap((chapter) =>
      chapter.verses.map((verse) => ({
        chapter: chapter.number,
        verse: verse.number,
        sanskrit: verse.sanskrit,
      })),
    )
    .slice(0, limit);
}

export async function translateVerse(
  verse: VerseInput,
): Promise<VerseTranslation> {
  const result = await generateText({
    model: openrouter(MODEL),
    system: buildVerseTranslationSystemPrompt(),
    prompt: buildVerseTranslationPrompt(verse),
    output: Output.object({
      schema: verseTranslationSchema,
    }),
    temperature: 0,
    maxRetries: 2,
  });

  return verseTranslationSchema.parse(result.output);
}

export function buildTranslatedScripture(
  translatedVerses: Array<VerseInput & { translation: VerseTranslation }>,
): TranslatedScripture {
  const translatedByKey = new Map(
    translatedVerses.map((verse) => [
      `${verse.chapter}:${verse.verse}`,
      verse.translation,
    ]),
  );

  return {
    title: scripture.title,
    chapters: scripture.chapters
      .map((chapter) => ({
        number: chapter.number,
        title: chapter.title,
        verses: chapter.verses
          .filter((verse) =>
            translatedByKey.has(`${chapter.number}:${verse.number}`),
          )
          .map((verse) => {
            const translation = translatedByKey.get(
              `${chapter.number}:${verse.number}`,
            );

            if (!translation) {
              throw new Error(
                `Missing translation for ${chapter.number}.${verse.number}.`,
              );
            }

            return {
              number: verse.number,
              sanskrit: verse.sanskrit,
              hindi: translation.hindiTranslation,
              english: translation.englishTranslation,
            };
          }),
      }))
      .filter((chapter) => chapter.verses.length > 0),
  };
}

export async function main() {
  const translatedVerses = [];

  for (const verse of getVerseInputs()) {
    const translation = await translateVerse(verse);
    translatedVerses.push({
      ...verse,
      translation,
    });
  }

  const translatedScripture = buildTranslatedScripture(translatedVerses);

  await writeFile(
    OUTPUT_FILE,
    `${JSON.stringify(translatedScripture, null, 2)}\n`,
    "utf8",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
