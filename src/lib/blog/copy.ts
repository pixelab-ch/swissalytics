import type { Locale } from './types';

/** Small set of blog UI strings, localized for all four blog locales. Kept separate from
 *  the homepage `COPY` object (fr/en only) — the blog is the one bilingual→4-lang surface. */
export type BlogCopy = {
  listTitle: string;
  metaTitle: string;
  metaDescription: string;
  relatedTitle: string;
  homeLabel: string;
  ogLang: string; // BCP-47-ish tag for OpenGraph locale
};

export const BLOG_COPY: Record<Locale, BlogCopy> = {
  fr: {
    listTitle: 'Le blog',
    metaTitle: 'Blog — Swissalytics',
    metaDescription: 'Analyses SEO & visibilité IA (GEO) par Pixelab.',
    relatedTitle: 'À lire aussi',
    homeLabel: 'Accueil',
    ogLang: 'fr_CH',
  },
  en: {
    listTitle: 'The blog',
    metaTitle: 'Blog — Swissalytics',
    metaDescription: 'SEO & AI-search (GEO) analyses by Pixelab.',
    relatedTitle: 'Read next',
    homeLabel: 'Home',
    ogLang: 'en_US',
  },
  de: {
    listTitle: 'Der Blog',
    metaTitle: 'Blog — Swissalytics',
    metaDescription: 'SEO- & KI-Suche-Analysen (GEO) von Pixelab.',
    relatedTitle: 'Auch lesenswert',
    homeLabel: 'Startseite',
    ogLang: 'de_CH',
  },
  it: {
    listTitle: 'Il blog',
    metaTitle: 'Blog — Swissalytics',
    metaDescription: 'Analisi SEO e ricerca IA (GEO) di Pixelab.',
    relatedTitle: 'Da leggere',
    homeLabel: 'Home',
    ogLang: 'it_CH',
  },
};
