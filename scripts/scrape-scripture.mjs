import { writeFile } from "node:fs/promises"

const BASE_URL = "https://www.gitasupersite.iitk.ac.in/srimad"
const OUTPUT_PATH = "src/content/scripture.ts"

const FIELD_CLASSES = {
  sanskrit: "views-field-body",
  hindi: "views-field-field-httyn",
  english: "views-field-field-etpurohit",
}

const chapterTitles = Array.from({ length: 18 }, (_, index) => `Chapter ${index + 1}`)

function buildUrl(chapter, verse) {
  const url = new URL(BASE_URL)
  url.searchParams.set("language", "dv")
  url.searchParams.set("field_chapter_value", String(chapter))
  url.searchParams.set("field_nsutra_value", String(verse))
  url.searchParams.set("httyn", "1")
  url.searchParams.set("etpurohit", "1")
  url.searchParams.set("choose", "1")

  return url.toString()
}

async function fetchPage(chapter, verse) {
  const response = await fetch(buildUrl(chapter, verse))

  if (!response.ok) {
    throw new Error(
      `Failed to fetch chapter ${chapter}, verse ${verse}: ${response.status} ${response.statusText}`,
    )
  }

  return response.text()
}

function extractSelectOptions(html, selectId) {
  const selectMatch = html.match(
    new RegExp(
      `<select[^>]*id=["']${selectId}["'][^>]*>([\\s\\S]*?)<\\/select>`,
      "i",
    ),
  )

  if (!selectMatch) {
    throw new Error(`Could not find select #${selectId}`)
  }

  return Array.from(selectMatch[1].matchAll(/<option\b[^>]*value=["']?(\d+)["']?[^>]*>/gi)).map(
    (match) => Number(match[1]),
  )
}

function extractFieldHtml(html, fieldClass) {
  const classIndex = html.indexOf(fieldClass)

  if (classIndex === -1) {
    throw new Error(`Could not find field block for ${fieldClass}`)
  }

  const fieldStart = html.lastIndexOf("<div", classIndex)
  const contentStart = html.indexOf(">", classIndex)
  const fieldEnd = html.indexOf("</div>", contentStart)

  if (fieldStart === -1 || contentStart === -1 || fieldEnd === -1) {
    throw new Error(`Could not parse field block for ${fieldClass}`)
  }

  return html.slice(contentStart + 1, fieldEnd)
}

function decodeHtmlEntities(value) {
  const namedEntities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  }

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, token) => {
    if (token[0] === "#") {
      const isHex = token[1]?.toLowerCase() === "x"
      const codePoint = Number.parseInt(token.slice(isHex ? 2 : 1), isHex ? 16 : 10)

      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint)
    }

    return namedEntities[token.toLowerCase()] ?? entity
  })
}

function cleanHtmlText(html) {
  return decodeHtmlEntities(
    html
      .replace(/\uFEFF/g, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<p\b[^>]*>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  )
}

function extractTextFromField(html, fieldClass) {
  const fieldHtml = extractFieldHtml(html, fieldClass)
  const fontMatches = Array.from(fieldHtml.matchAll(/<font\b[^>]*>([\s\S]*?)<\/font>/gi))

  if (fontMatches.length === 0) {
    throw new Error(`Could not find font content in ${fieldClass}`)
  }

  return cleanHtmlText(fontMatches.at(-1)[1])
}

function renderScriptureFile(chapters) {
  const lines = [
    "export type Verse = {",
    "  number: number",
    "  sanskrit: string",
    "  hindi: string",
    "  english: string",
    "}",
    "",
    "export type Chapter = {",
    "  number: number",
    "  title: string",
    "  verses: Verse[]",
    "}",
    "",
    "export type Scripture = {",
    "  title: string",
    "  chapters: Chapter[]",
    "}",
    "",
    "export const scripture: Scripture = {",
    '  title: "Bhagavad Gita",',
    "  chapters: [",
  ]

  chapters.forEach((chapter) => {
    lines.push("    {")
    lines.push(`      number: ${chapter.number},`)
    lines.push(`      title: ${JSON.stringify(chapter.title)},`)
    lines.push("      verses: [")

    chapter.verses.forEach((verse) => {
      lines.push("        {")
      lines.push(`          number: ${verse.number},`)
      lines.push(`          sanskrit: ${JSON.stringify(verse.sanskrit)},`)
      lines.push(`          hindi: ${JSON.stringify(verse.hindi)},`)
      lines.push(`          english: ${JSON.stringify(verse.english)},`)
      lines.push("        },")
    })

    lines.push("      ],")
    lines.push("    },")
  })

  lines.push("  ],")
  lines.push("}")
  lines.push("")

  return lines.join("\n")
}

async function getVerseCount(chapter) {
  const html = await fetchPage(chapter, 1)
  const options = extractSelectOptions(html, "edit-field-nsutra-value")

  if (options.length === 0) {
    throw new Error(`No verse options found for chapter ${chapter}`)
  }

  return {
    html,
    verseCount: Math.max(...options),
  }
}

async function scrapeChapter(chapter) {
  const { html: firstPageHtml, verseCount } = await getVerseCount(chapter)
  const verses = []

  for (let verseNumber = 1; verseNumber <= verseCount; verseNumber += 1) {
    const html = verseNumber === 1 ? firstPageHtml : await fetchPage(chapter, verseNumber)

    verses.push({
      number: verseNumber,
      sanskrit: extractTextFromField(html, FIELD_CLASSES.sanskrit),
      hindi: extractTextFromField(html, FIELD_CLASSES.hindi),
      english: extractTextFromField(html, FIELD_CLASSES.english),
    })

    console.log(`Scraped chapter ${chapter}, verse ${verseNumber}/${verseCount}`)
  }

  return {
    number: chapter,
    title: chapterTitles[chapter - 1],
    verses,
  }
}

async function main() {
  const chapters = []

  for (let chapter = 1; chapter <= 18; chapter += 1) {
    chapters.push(await scrapeChapter(chapter))
  }

  await writeFile(OUTPUT_PATH, renderScriptureFile(chapters), "utf8")
  console.log(`Wrote ${OUTPUT_PATH}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
