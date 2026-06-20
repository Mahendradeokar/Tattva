import { AnimatePresence, motion } from "motion/react";
import {
  ChevronDown,
  Copy,
  CopyCheck,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircle,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PanInfo } from "motion/react";
import type { WheelEvent } from "react";
import { usePostHog } from "@posthog/react";

import { RailSelector } from "@/components/rail-selector";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { scripture } from "@/content/scripture";
import { cn } from "@/lib/utils";

type TransitionState = {
  direction: 1 | -1;
  kind: "chapter" | "verse";
};

function getInitialSelection() {
  if (typeof window === "undefined") {
    return {
      chapter: scripture.chapters[0]?.number ?? 1,
      verse: 1,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const requestedChapter = Number(params.get("chapter"));
  const requestedVerse = Number(params.get("verse"));
  const chapter =
    scripture.chapters.find((item) => item.number === requestedChapter) ??
    scripture.chapters[0];

  return {
    chapter: chapter?.number ?? 1,
    verse:
      chapter?.verses.find((item) => item.number === requestedVerse)?.number ??
      chapter?.verses[0]?.number ??
      1,
  };
}

async function writeToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  const didCopy = document.execCommand("copy");
  document.body.removeChild(textArea);

  if (!didCopy) {
    throw new Error("Copy command failed");
  }
}

function App() {
  const posthog = usePostHog();
  const chapters = scripture.chapters;
  const initialSelection = useMemo(() => getInitialSelection(), []);
  const [mobileRailMode, setMobileRailMode] = useState<"chapter" | "verse">(
    "verse",
  );
  const [selectedChapterNumber, setSelectedChapterNumber] = useState(
    initialSelection.chapter,
  );
  const [selectedVerseNumber, setSelectedVerseNumber] = useState(
    initialSelection.verse,
  );
  const [copyState, setCopyState] = useState<
    "idle" | "copying" | "copied" | "error"
  >("idle");
  const [transitionState, setTransitionState] = useState<TransitionState>({
    direction: 1,
    kind: "verse",
  });
  const lastWheelStepAtRef = useRef(0);

  const selectedChapter =
    chapters.find((chapter) => chapter.number === selectedChapterNumber) ??
    chapters[0];

  const verses = useMemo(
    () => selectedChapter?.verses ?? [],
    [selectedChapter],
  );

  const selectedVerse =
    verses.find((verse) => verse.number === selectedVerseNumber) ?? verses[0];

  const chapterItems = useMemo(
    () =>
      chapters.map((chapter) => ({
        value: chapter.number,
        label: chapter.number.toString().padStart(2, "0"),
        displayLabel: `Chapter ${chapter.number.toString().padStart(2, "0")}`,
      })),
    [chapters],
  );

  const verseItems = useMemo(
    () =>
      verses.map((verse) => ({
        value: verse.number,
        label: verse.number.toString().padStart(2, "0"),
      })),
    [verses],
  );

  const mobileChapterItems = useMemo(
    () =>
      chapters.map((chapter) => ({
        value: chapter.number,
        label: chapter.number.toString().padStart(2, "0"),
      })),
    [chapters],
  );

  const handleChapterSelect = (chapterNumber: number) => {
    if (chapterNumber === selectedChapterNumber) {
      return;
    }

    posthog?.capture("chapter_selected", {
      chapter_number: chapterNumber,
      previous_chapter_number: selectedChapterNumber,
    });

    setTransitionState({
      direction: chapterNumber > selectedChapterNumber ? 1 : -1,
      kind: "chapter",
    });
    setSelectedChapterNumber(chapterNumber);
    setSelectedVerseNumber(1);
  };

  const handleVerseSelect = (verseNumber: number) => {
    if (verseNumber === selectedVerseNumber) {
      return;
    }

    posthog?.capture("verse_selected", {
      chapter_number: selectedChapterNumber,
      verse_number: verseNumber,
      previous_verse_number: selectedVerseNumber,
    });

    setTransitionState({
      direction: verseNumber > selectedVerseNumber ? 1 : -1,
      kind: "verse",
    });
    setSelectedVerseNumber(verseNumber);
  };

  const stepVerse = (delta: -1 | 1) => {
    const chapterIndex = chapters.findIndex(
      (chapter) => chapter.number === selectedChapterNumber,
    );

    if (chapterIndex < 0) {
      return;
    }

    const currentChapter = chapters[chapterIndex];
    const verseIndex = currentChapter.verses.findIndex(
      (verse) => verse.number === selectedVerseNumber,
    );

    if (verseIndex < 0) {
      return;
    }

    const nextVerseIndex = verseIndex + delta;

    if (nextVerseIndex >= 0 && nextVerseIndex < currentChapter.verses.length) {
      posthog?.capture("verse_navigated", {
        chapter_number: selectedChapterNumber,
        verse_number: currentChapter.verses[nextVerseIndex].number,
        previous_verse_number: selectedVerseNumber,
        direction: delta > 0 ? "forward" : "backward",
        cross_chapter: false,
      });
      handleVerseSelect(currentChapter.verses[nextVerseIndex].number);
      return;
    }

    const nextChapter = chapters[chapterIndex + delta];

    if (!nextChapter) {
      return;
    }

    const nextVerseNumber =
      delta > 0
        ? nextChapter.verses[0].number
        : (nextChapter.verses[nextChapter.verses.length - 1]?.number ?? 1);

    posthog?.capture("verse_navigated", {
      chapter_number: nextChapter.number,
      verse_number: nextVerseNumber,
      previous_chapter_number: selectedChapterNumber,
      previous_verse_number: selectedVerseNumber,
      direction: delta > 0 ? "forward" : "backward",
      cross_chapter: true,
    });

    setTransitionState({
      direction: delta,
      kind: "chapter",
    });
    setSelectedChapterNumber(nextChapter.number);
    setSelectedVerseNumber(nextVerseNumber);
  };

  useEffect(() => {
    if (typeof window === "undefined" || !selectedChapter || !selectedVerse) {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("chapter", selectedChapter.number.toString());
    url.searchParams.set("verse", selectedVerse.number.toString());
    window.history.replaceState(null, "", url);
  }, [selectedChapter, selectedVerse]);

  if (!selectedChapter || !selectedVerse) {
    return null;
  }

  const chapterLabel = selectedChapter.number.toString().padStart(2, "0");
  const verseLabel = selectedVerse.number.toString().padStart(2, "0");
  const verseTitle = `Chapter ${chapterLabel} . Verse ${verseLabel}`;
  const verseUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}${window.location.pathname}?chapter=${selectedChapter.number}&verse=${selectedVerse.number}`;
  const llmsTxtUrl =
    typeof window === "undefined"
      ? ""
      : new URL(`${import.meta.env.BASE_URL}llms.txt`, window.location.origin)
          .href;
  const verseMarkdown = `# ${scripture.title} - ${verseTitle}

${selectedVerse.sanskrit}

## Hindi
${selectedVerse.hindi}

## English
${selectedVerse.english}

${verseUrl}`;
  const copyPage = async () => {
    if (copyState === "copying") {
      return;
    }

    setCopyState("copying");

    try {
      await writeToClipboard(verseMarkdown);
      setCopyState("copied");
      posthog?.capture("verse_copied", {
        chapter_number: selectedChapter.number,
        verse_number: selectedVerse.number,
      });
    } catch (err) {
      setCopyState("error");
      posthog?.captureException(err, {
        chapter_number: selectedChapter.number,
        verse_number: selectedVerse.number,
      });
    }

    window.setTimeout(() => {
      setCopyState("idle");
    }, 1600);
  };

  const openInChatGPT = () => {
    posthog?.capture("verse_opened_in_chatgpt", {
      chapter_number: selectedChapter.number,
      verse_number: selectedVerse.number,
    });
    const prompt = `${verseMarkdown}\n\nExplain the above Bhagavad Gita verse.`;
    window.open(
      `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const openFullGeetaInChatGPT = () => {
    posthog?.capture("full_geeta_opened_in_chatgpt", {
      chapter_number: selectedChapter.number,
      verse_number: selectedVerse.number,
    });
    const prompt = `I am reading the Bhagavad Gita. Use this llms.txt file as the full text/context for the Geeta: ${llmsTxtUrl}

Help me understand the full Geeta, starting from the overall structure and key teachings.`;
    window.open(
      `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const canScrollInDirection = (element: HTMLElement, deltaY: number) => {
    if (element.scrollHeight <= element.clientHeight + 1) {
      return false;
    }

    if (deltaY > 0) {
      return (
        element.scrollTop + element.clientHeight < element.scrollHeight - 1
      );
    }

    return element.scrollTop > 1;
  };

  const handleReaderPanEnd = (event: PointerEvent, info: PanInfo) => {
    if (event.pointerType !== "touch") {
      return;
    }

    const horizontalTravel = info.offset.x;
    const verticalTravel = info.offset.y;

    if (
      Math.abs(horizontalTravel) < 48 ||
      Math.abs(horizontalTravel) <= Math.abs(verticalTravel)
    ) {
      return;
    }

    stepVerse(horizontalTravel < 0 ? 1 : -1);
  };

  const handleReaderWheel = (event: WheelEvent<HTMLElement>) => {
    const target = event.target;
    const currentTarget = event.currentTarget;

    if (
      target instanceof HTMLElement &&
      target.closest('[data-rail-selector="true"]')
    ) {
      return;
    }

    if (target instanceof HTMLElement) {
      let currentElement: HTMLElement | null = target;

      while (currentElement && currentElement !== currentTarget) {
        const overflowY = window.getComputedStyle(currentElement).overflowY;

        if (
          (overflowY === "auto" || overflowY === "scroll") &&
          canScrollInDirection(currentElement, event.deltaY)
        ) {
          return;
        }

        currentElement = currentElement.parentElement;
      }
    }

    const scrollingElement = document.scrollingElement;

    if (
      scrollingElement instanceof HTMLElement &&
      canScrollInDirection(scrollingElement, event.deltaY)
    ) {
      return;
    }

    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
      return;
    }

    if (Math.abs(event.deltaY) < 36) {
      return;
    }

    const now = Date.now();
    if (now - lastWheelStepAtRef.current < 420) {
      return;
    }

    event.preventDefault();
    lastWheelStepAtRef.current = now;
    stepVerse(event.deltaY > 0 ? 1 : -1);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section
        onWheel={handleReaderWheel}
        className="relative min-h-dvh overflow-hidden"
      >
        <div aria-hidden="true" className="scripture-scene absolute inset-0">
          <div className="scripture-scene__image" />
          <div className="scripture-scene__wash" />
          <div className="scripture-scene__glow" />
          <div className="scripture-scene__grain" />
        </div>

        <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-7xl items-start justify-center px-0 pt-[18dvh] pb-[calc(13rem+env(safe-area-inset-bottom))] sm:px-32 sm:pt-[16vh] sm:pb-[calc(12rem+env(safe-area-inset-bottom))] lg:px-40">
          <motion.section
            onPanEnd={handleReaderPanEnd}
            style={{ touchAction: "pan-y" }}
            className="w-full cursor-grab active:cursor-grabbing sm:cursor-ns-resize"
          >
            <div className="mx-auto max-w-[70ch] space-y-8 px-4 select-text sm:space-y-10 sm:px-0">
              <header className="space-y-6">
                <div className="flex flex-col gap-2 text-[0.72rem] uppercase tracking-[0.28em] text-muted-foreground/90 sm:flex-row sm:items-center">
                  <span>{scripture.title}</span>
                  <span className="hidden text-border sm:inline">/</span>
                  <span className="flex flex-1 flex-wrap items-center justify-between gap-3">
                    <span className="font-semibold tracking-[0.12em] text-foreground/95">
                      {verseTitle}
                    </span>

                    <DropdownMenu>
                      <div className="inline-flex items-center rounded-md border border-border/70 bg-background/55 normal-case shadow-sm backdrop-blur-sm">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={copyPage}
                          disabled={copyState === "copying"}
                          aria-live="polite"
                          className="h-8 rounded-r-none border-r border-border/70 px-2.5 text-[0.7rem] normal-case tracking-normal"
                        >
                          {copyState === "copying" ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : copyState === "copied" ? (
                            <CopyCheck className="size-3.5" />
                          ) : copyState === "error" ? (
                            <XCircle className="size-3.5 text-destructive" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                          {copyState === "copying"
                            ? "Copying"
                            : copyState === "copied"
                              ? "Copied"
                              : copyState === "error"
                                ? "Failed"
                                : "Copy page"}
                        </Button>

                        <DropdownMenuTrigger
                          type="button"
                          aria-label="Open copy menu"
                          className={cn(
                            buttonVariants({
                              variant: "ghost",
                              size: "icon-sm",
                            }),
                            "h-8 w-8 rounded-l-none",
                          )}
                        >
                          <ChevronDown className="size-3.5" />
                        </DropdownMenuTrigger>
                      </div>

                      <DropdownMenuContent align="end" className="w-72">
                        <DropdownMenuItem onSelect={openInChatGPT}>
                          <MessageCircle className="mr-3 size-4 shrink-0 text-foreground/80" />
                          <div className="flex flex-col gap-0.5 normal-case tracking-normal">
                            <span className="font-medium">
                              Open verse in ChatGPT
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Ask questions about this verse
                            </span>
                          </div>
                        </DropdownMenuItem>

                        <DropdownMenuItem onSelect={openFullGeetaInChatGPT}>
                          <MessageCircle className="mr-3 size-4 shrink-0 text-foreground/80" />
                          <div className="flex flex-col gap-0.5 normal-case tracking-normal">
                            <span className="font-medium">
                              Open full Geeta in ChatGPT
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Ask questions about the whole Geeta
                            </span>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </div>

                <div className="h-px bg-border/95" />
              </header>

              <AnimatePresence mode="wait" initial={false}>
                <motion.article
                  key={`${selectedChapter.number}-${selectedVerse.number}`}
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
                  className="space-y-1 cursor-text"
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
          </motion.section>
        </main>

        <RailSelector
          label="Chapter"
          orientation="vertical"
          items={chapterItems}
          selectedValue={selectedChapter.number}
          onSelect={handleChapterSelect}
          className="absolute top-1/2 right-1.5 z-20 hidden -translate-y-1/2 sm:flex sm:right-6 lg:right-8"
        />

        <div className="absolute bottom-[calc(2rem+env(safe-area-inset-bottom))] left-1/2 z-20 hidden -translate-x-1/2 sm:block">
          <RailSelector
            label="Verse"
            orientation="horizontal"
            items={verseItems}
            selectedValue={selectedVerse.number}
            onSelect={handleVerseSelect}
          />
        </div>

        <div className="absolute inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 px-3 sm:hidden">
          <div className="mx-auto flex max-w-sm flex-col gap-2 rounded-2xl border border-border/50 bg-background/70 p-2 backdrop-blur-md">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
              <button
                type="button"
                onClick={() => {
                  setMobileRailMode("verse");
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
              <button
                type="button"
                onClick={() => {
                  setMobileRailMode("chapter");
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
      </section>

      <footer className="relative z-10 border-t border-border/80 bg-background/95 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-8 sm:py-8">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center text-xs text-muted-foreground sm:justify-between sm:gap-x-4 sm:gap-y-2 sm:text-left">
          <p className="min-h-8 content-center text-foreground/60">
            © 2026 Mahendra Devkar. All rights reserved.
          </p>

          <nav
            aria-label="Footer links"
            className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-foreground/72 sm:justify-end sm:gap-x-4 sm:gap-y-2"
          >
            <a
              href="https://mahendradevkar.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-8 items-center gap-2 rounded-md text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <ExternalLink className="size-3.5 shrink-0" />
              <span>Built by Mahendra Devkar</span>
            </a>

            <a
              href="/llms.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-8 items-center gap-2 rounded-md text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <FileText className="size-3.5 shrink-0" />
              <span>llms.txt</span>
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export default App;
