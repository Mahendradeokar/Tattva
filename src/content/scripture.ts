import translatedScripture from "./bhagavad-gita-translations.json";

export type Verse = {
  number: number;
  sanskrit: string;
  hindi: string;
  english: string;
};

export type Chapter = {
  number: number;
  title: string;
  verses: Verse[];
};

export type Scripture = {
  title: string;
  chapters: Chapter[];
};

export const scripture = translatedScripture satisfies Scripture;
