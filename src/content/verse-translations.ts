import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";

import sanskritScripture from "./bhagavad-gita-sanskrit.json";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY is required.");
}

const openrouter = createOpenRouter({
  apiKey: OPENROUTER_API_KEY,
  appName: "geeta-project",
});

const MODEL = "openai/gpt-5.4";
const VERSE_PROCESS_LIMIT = Infinity;
const FORCE_TRANSLATE = process.env.FORCE_TRANSLATE === "1";
const OUTPUT_FILE = new URL(
  "./bhagavad-gita-translations.json",
  import.meta.url,
);
const LLMS_FILE = new URL("../../public/llms.txt", import.meta.url);

const verseTranslationSchema = z
  .object({
    englishTranslation: z.string().min(1),
    hindiTranslation: z.string().min(1),
  })
  .strict();

const translatedScriptureSchema = z.object({
  title: z.string(),
  chapters: z.array(
    z.object({
      number: z.number(),
      title: z.string(),
      verses: z.array(
        z.object({
          number: z.number(),
          sanskrit: z.string(),
          hindi: z.string(),
          english: z.string(),
        }),
      ),
    }),
  ),
});

type VerseTranslation = z.infer<typeof verseTranslationSchema>;
type TranslatedScripture = z.infer<typeof translatedScriptureSchema>;

type VerseInput = {
  chapter: number;
  verse: number;
  sanskrit: string;
};

type TranslatedVerse = VerseInput & {
  translation: VerseTranslation;
};

function buildVerseTranslationSystemPrompt() {
  return String.raw`
  You translate Bhagavad Gita Sanskrit verses into structured JSON data.

  Return only the requested JSON structure.

  Your goal is to preserve the exact meaning of the verse while making it easy for a modern reader to understand in a single reading.

  Follow this process internally:

  1. First understand the Sanskrit verse completely.

  2. Resolve the verse into clear modern English meaning internally.

  Do not imitate Sanskrit grammar or sentence structure mechanically.

  3. When a Sanskrit word has multiple valid meanings, choose the meaning that best fits the immediate narrative and grammatical context while preserving the intended sense of the verse.

  Do not mechanically choose the most common dictionary meaning if it creates a misleading or contextually incorrect translation.

  4. Generate the English translation using:

  * natural sentence flow
  * explicit references when needed
  * clear and understandable language

  5. Generate the Hindi translation from the resolved English meaning, not directly from Sanskrit grammar.

  The Hindi should sound natural to a modern Hindi speaker and be understandable in a single reading.

  Use respectful and natural Hindi while referring to or addressing people.

  Do not add:

  * commentary
  * philosophy
  * interpretation
  * emotional tone
  * symbolism
  * teaching
  * implied meaning
  * explanatory conclusions

  When the verse depends on nearby context to understand the subject or reference, make that context explicit if necessary for readability.

  When Sanskrit uses indirect identifiers, titles, family references, or relational names, resolve them into clear modern references when necessary for comprehension.

  Keep related information close together so the reader does not need to mentally rearrange the sentence.

  Reduce cognitive load by using:

  * linear sentence flow
  * natural phrasing
  * explicit references
  * conversational readability

  Keep English and Hindi:

  * simple
  * modern
  * direct
  * natural
  * easy to follow
  * semantically accurate

  Avoid:

  * overly Sanskritized Hindi
  * literary Hindi
  * fragmented phrasing
  * archaic wording
  * poetic reconstruction
  * rigid word-by-word translation

  Prefer clarity over literal sentence imitation.

  Preserve meaning exactly, but express it in the clearest and most natural modern language possible.
`.trim();
}

function buildVerseTranslationPrompt(verse: VerseInput) {
  return String.raw`
  Chapter: ${verse.chapter}
  Verse: ${verse.verse}

  Sanskrit:
  ${verse.sanskrit}

  Return JSON with only:

  * englishTranslation
  * hindiTranslation
  `.trim();
}

function getVerseKey(chapter: number, verse: number) {
  return `${chapter}:${verse}`;
}

function getVerseInputs(limit = VERSE_PROCESS_LIMIT): VerseInput[] {
  return sanskritScripture.chapters
    .flatMap((chapter) =>
      chapter.verses.map((verse) => ({
        chapter: chapter.number,
        verse: verse.number,
        sanskrit: verse.sanskrit,
      })),
    )
    .slice(0, limit);
}

async function translateVerse(verse: VerseInput): Promise<VerseTranslation> {
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

async function loadExistingTranslatedVerses(): Promise<TranslatedVerse[]> {
  try {
    const rawOutput = await readFile(OUTPUT_FILE, "utf8");
    const parsedOutput = translatedScriptureSchema.safeParse(
      JSON.parse(rawOutput),
    );

    if (!parsedOutput.success) {
      console.error("Failed to parse existing translations:");
      return [];
    }

    return parsedOutput.data.chapters.flatMap((chapter) =>
      chapter.verses
        .filter((verse) => verse.hindi.trim() && verse.english.trim())
        .map((verse) => ({
          chapter: chapter.number,
          verse: verse.number,
          sanskrit: verse.sanskrit,
          translation: {
            hindiTranslation: verse.hindi,
            englishTranslation: verse.english,
          },
        })),
    );
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

function buildTranslatedScripture(
  translatedVerses: TranslatedVerse[],
): TranslatedScripture {
  const translatedByKey = new Map(
    translatedVerses.map((verse) => [
      getVerseKey(verse.chapter, verse.verse),
      verse.translation,
    ]),
  );

  return {
    title: sanskritScripture.title,
    chapters: sanskritScripture.chapters.map((chapter) => ({
      number: chapter.number,
      title: chapter.title,
      verses: chapter.verses.map((verse) => {
        const translation = translatedByKey.get(
          getVerseKey(chapter.number, verse.number),
        );

        return {
          number: verse.number,
          sanskrit: verse.sanskrit,
          hindi: translation?.hindiTranslation ?? "",
          english: translation?.englishTranslation ?? "",
        };
      }),
    })),
  };
}

function buildLlmsText(translatedScripture: TranslatedScripture) {
  const lines = [
    `# ${translatedScripture.title}`,
    "",
    "> Sanskrit verses with Hindi and English translations.",
    "",
  ];

  for (const chapter of translatedScripture.chapters) {
    lines.push("", `## ${chapter.title}`);

    for (const verse of chapter.verses) {
      lines.push(
        "",
        `### Verse ${chapter.number}.${verse.number}`,
        "",
        "Sanskrit:",
        verse.sanskrit,
        "",
        "Hindi:",
        verse.hindi,
        "",
        "English:",
        verse.english,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

async function persistOutputs(translatedVerses: TranslatedVerse[]) {
  const translatedScripture = buildTranslatedScripture(translatedVerses);

  await writeFile(
    OUTPUT_FILE,
    `${JSON.stringify(translatedScripture, null, 2)}\n`,
    "utf8",
  );
  await writeFile(LLMS_FILE, buildLlmsText(translatedScripture), "utf8");

  return translatedScripture;
}

async function main() {
  console.log(`Using model: ${MODEL}`);
  console.log(`Verse process limit: ${VERSE_PROCESS_LIMIT}`);
  console.log(`Force translate: ${FORCE_TRANSLATE ? "yes" : "no"}`);

  const verseInputs = getVerseInputs();
  const translatedVerses = await loadExistingTranslatedVerses();
  const translatedByKey = new Map(
    translatedVerses.map((verse) => [
      getVerseKey(verse.chapter, verse.verse),
      verse,
    ]),
  );

  console.log(`Loaded existing translations: ${translatedByKey.size}`);
  console.log(`Output JSON: ${OUTPUT_FILE.pathname}`);
  console.log(`LLMs text: ${LLMS_FILE.pathname}`);

  try {
    for (const [index, verse] of verseInputs.entries()) {
      const verseKey = getVerseKey(verse.chapter, verse.verse);
      const progress = `[${index + 1}/${verseInputs.length}]`;

      if (!FORCE_TRANSLATE && translatedByKey.has(verseKey)) {
        console.log(
          `${progress} Skipping ${verse.chapter}.${verse.verse} already translated`,
        );
        continue;
      }

      console.log(`${progress} Translating ${verse.chapter}.${verse.verse}`);

      const translation = await translateVerse(verse);
      const translatedVerse = {
        ...verse,
        translation,
      };

      translatedByKey.set(verseKey, translatedVerse);
      const currentTranslatedVerses = Array.from(translatedByKey.values());
      await persistOutputs(currentTranslatedVerses);

      console.log(`${progress} Saved ${verse.chapter}.${verse.verse}`);
    }
  } catch (error: unknown) {
    await persistOutputs(Array.from(translatedByKey.values()));
    console.error("Translation failed. Partial output has been saved.");
    throw error;
  }

  const translatedScripture = await persistOutputs(
    Array.from(translatedByKey.values()),
  );
  const totalVerseCount = translatedScripture.chapters.reduce(
    (total, chapter) => total + chapter.verses.length,
    0,
  );
  const completedTranslationCount = Array.from(translatedByKey.values()).length;

  console.log(
    `Done. Saved ${totalVerseCount} verses, ${completedTranslationCount} with translations.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
