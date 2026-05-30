import { AnimatePresence, motion } from "motion/react"
import { useMemo, useRef, useState } from "react"

import { RailSelector } from "@/components/rail-selector"
import { scripture } from "@/content/scripture"

type TransitionState = {
  direction: 1 | -1
  kind: "chapter" | "verse"
}

function App() {
  const chapters = scripture.chapters
  const [mobileRailMode, setMobileRailMode] = useState<"chapter" | "verse">(
    "chapter",
  )
  const [selectedChapterNumber, setSelectedChapterNumber] = useState(
    chapters[0]?.number ?? 1,
  )
  const [selectedVerseNumber, setSelectedVerseNumber] = useState(1)
  const [transitionState, setTransitionState] = useState<TransitionState>({
    direction: 1,
    kind: "verse",
  })
  const lastWheelStepAtRef = useRef(0)

  const selectedChapter =
    chapters.find((chapter) => chapter.number === selectedChapterNumber) ??
    chapters[0]

  const verses = selectedChapter?.verses ?? []

  const selectedVerse =
    verses.find((verse) => verse.number === selectedVerseNumber) ?? verses[0]

  const chapterItems = useMemo(
    () =>
      chapters.map((chapter) => ({
        value: chapter.number,
        label: chapter.number.toString().padStart(2, "0"),
        displayLabel: `Chapter ${chapter.number.toString().padStart(2, "0")}`,
      })),
    [chapters],
  )

  const verseItems = useMemo(
    () =>
      verses.map((verse) => ({
        value: verse.number,
        label: verse.number.toString().padStart(2, "0"),
      })),
    [verses],
  )

  const mobileChapterItems = useMemo(
    () =>
      chapters.map((chapter) => ({
        value: chapter.number,
        label: chapter.number.toString().padStart(2, "0"),
      })),
    [chapters],
  )

  const handleChapterSelect = (chapterNumber: number) => {
    if (chapterNumber === selectedChapterNumber) {
      return
    }

    setTransitionState({
      direction: chapterNumber > selectedChapterNumber ? 1 : -1,
      kind: "chapter",
    })
    setSelectedChapterNumber(chapterNumber)
    setSelectedVerseNumber(1)
  }

  const handleVerseSelect = (verseNumber: number) => {
    if (verseNumber === selectedVerseNumber) {
      return
    }

    setTransitionState({
      direction: verseNumber > selectedVerseNumber ? 1 : -1,
      kind: "verse",
    })
    setSelectedVerseNumber(verseNumber)
  }

  const stepVerse = (delta: -1 | 1) => {
    const chapterIndex = chapters.findIndex(
      (chapter) => chapter.number === selectedChapterNumber,
    )

    if (chapterIndex < 0) {
      return
    }

    const currentChapter = chapters[chapterIndex]
    const verseIndex = currentChapter.verses.findIndex(
      (verse) => verse.number === selectedVerseNumber,
    )

    if (verseIndex < 0) {
      return
    }

    const nextVerseIndex = verseIndex + delta

    if (nextVerseIndex >= 0 && nextVerseIndex < currentChapter.verses.length) {
      handleVerseSelect(currentChapter.verses[nextVerseIndex].number)
      return
    }

    const nextChapter = chapters[chapterIndex + delta]

    if (!nextChapter) {
      return
    }

    setTransitionState({
      direction: delta,
      kind: "chapter",
    })
    setSelectedChapterNumber(nextChapter.number)
    setSelectedVerseNumber(
      delta > 0
        ? nextChapter.verses[0].number
        : nextChapter.verses[nextChapter.verses.length - 1]?.number ?? 1,
    )
  }

  if (!selectedChapter || !selectedVerse) {
    return null
  }

  const chapterLabel = selectedChapter.number.toString().padStart(2, "0")
  const verseLabel = selectedVerse.number.toString().padStart(2, "0")

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div aria-hidden="true" className="scripture-scene fixed inset-0">
        <div className="scripture-scene__image" />
        <div className="scripture-scene__wash" />
        <div className="scripture-scene__glow" />
        <div className="scripture-scene__grain" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-start justify-center px-0 pt-[18dvh] pb-52 sm:px-32 sm:pt-[16vh] sm:pb-48 lg:px-40">
        <section className="w-full">
          <div className="mx-auto max-w-[70ch] space-y-8 px-4 select-text sm:space-y-10 sm:px-0">
            <header className="space-y-6">
              <div className="flex flex-col gap-2 text-[0.72rem] uppercase tracking-[0.28em] text-muted-foreground/90 sm:flex-row sm:items-center">
                <span>{scripture.title}</span>
                <span className="hidden text-border sm:inline">/</span>
                <span className="font-semibold tracking-[0.12em] text-foreground/95">
                  Chapter {chapterLabel} . Verse {verseLabel}
                </span>
              </div>

              <div className="h-px bg-border/95" />
            </header>

            <AnimatePresence mode="wait" initial={false}>
              <motion.article
                key={`${selectedChapter.number}-${selectedVerse.number}`}
                onPanEnd={(event, info) => {
                  if (event.pointerType !== "touch") {
                    return
                  }

                  const horizontalTravel = info.offset.x
                  const verticalTravel = info.offset.y

                  if (
                    Math.abs(horizontalTravel) < 48 ||
                    Math.abs(horizontalTravel) <= Math.abs(verticalTravel)
                  ) {
                    return
                  }

                  stepVerse(horizontalTravel < 0 ? 1 : -1)
                }}
                onWheel={(event) => {
                  if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
                    return
                  }

                  if (Math.abs(event.deltaY) < 36) {
                    return
                  }

                  const now = Date.now()
                  if (now - lastWheelStepAtRef.current < 420) {
                    return
                  }

                  event.preventDefault()
                  lastWheelStepAtRef.current = now
                  stepVerse(event.deltaY > 0 ? 1 : -1)
                }}
                style={{ touchAction: "pan-y" }}
                initial={{
                  opacity: 0,
                  y: transitionState.direction > 0 ? 18 : -18,
                }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  y: transitionState.direction > 0 ? -14 : 14,
                }}
                transition={{
                  duration: transitionState.kind === "chapter" ? 0.34 : 0.24,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="space-y-1"
              >
                <div className="pb-4 sm:pb-5">
                  <h1 className="font-devanagari text-xl leading-loose text-foreground/95 sm:text-2xl lg:text-4xl lg:leading-[1.55]">
                    {selectedVerse.sanskrit}
                  </h1>
                  <div className="h-px bg-border/95" />
                </div>

                <div className="space-y-5">
                  <p className="font-devanagari text-base leading-9 text-foreground/88 sm:text-lg sm:leading-10">
                    {selectedVerse.hindi}
                  </p>

                  <p className="text-sm leading-8 text-foreground/78 sm:text-base sm:leading-9">
                    {selectedVerse.english}
                  </p>
                </div>
              </motion.article>
            </AnimatePresence>
          </div>
        </section>
      </div>

      <RailSelector
        label="Chapter"
        orientation="vertical"
        items={chapterItems}
        selectedValue={selectedChapter.number}
        onSelect={handleChapterSelect}
        className="fixed top-1/2 right-1.5 z-20 hidden -translate-y-1/2 sm:flex sm:right-6 lg:right-8"
      />

      <RailSelector
        label="Verse"
        orientation="horizontal"
        items={verseItems}
        selectedValue={selectedVerse.number}
        onSelect={handleVerseSelect}
        className="fixed bottom-3 left-1/2 z-20 hidden -translate-x-1/2 sm:flex sm:bottom-8"
      />

      <div className="fixed inset-x-0 bottom-3 z-20 px-3 sm:hidden">
        <div className="mx-auto flex max-w-sm flex-col gap-2 rounded-2xl border border-border/50 bg-background/70 p-2 backdrop-blur-md">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
            <button
              type="button"
              onClick={() => {
                setMobileRailMode("chapter")
              }}
              className={`relative rounded-lg px-3 py-2 text-[0.62rem] font-medium uppercase tracking-[0.2em] transition-colors ${
                mobileRailMode === "chapter"
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {mobileRailMode === "chapter" ? (
                <motion.span
                  layoutId="mobile-rail-tab"
                  className="absolute inset-0 rounded-lg bg-background shadow-sm"
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 34,
                  }}
                />
              ) : null}
              <span className="relative z-10">Chapter</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileRailMode("verse")
              }}
              className={`relative rounded-lg px-3 py-2 text-[0.62rem] font-medium uppercase tracking-[0.2em] transition-colors ${
                mobileRailMode === "verse"
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {mobileRailMode === "verse" ? (
                <motion.span
                  layoutId="mobile-rail-tab"
                  className="absolute inset-0 rounded-lg bg-background shadow-sm"
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 34,
                  }}
                />
              ) : null}
              <span className="relative z-10">Verse</span>
            </button>
          </div>

          {mobileRailMode === "chapter" ? (
            <RailSelector
              label="Chapter"
              orientation="horizontal"
              items={mobileChapterItems}
              selectedValue={selectedChapter.number}
              onSelect={handleChapterSelect}
            />
          ) : (
            <RailSelector
              label="Verse"
              orientation="horizontal"
              items={verseItems}
              selectedValue={selectedVerse.number}
              onSelect={handleVerseSelect}
            />
          )}
        </div>
      </div>
    </main>
  )
}

export default App
