# Spec — Moteur de blog MDX bilingue · Phase 1

**Date :** 2026-06-04
**Statut :** Approuvé — passage à l'implémentation
**Périmètre :** Phase 1 sur 3 (le moteur). Phases 2 (OG auto) et 3 (contenu Ahrefs) ont leurs propres specs.

---

## 1. Contexte & problème

Le Journal actuel (`/journal`) est :
- **Codé en dur** dans `src/lib/journal/posts.ts` (tableau TS, blocs `p`/`h2`/`quote`/`numbered`).
- **Rendu côté client** (`'use client'`) → pas de HTML serveur exploitable.
- **Sans métadonnée par article** ni JSON-LD `Article`.
- **Bilingue en apparence seulement** : `lang` vit dans `localStorage` (`sa_lang`, défaut FR), basculé après hydratation. Pas de route `/en`, pas de middleware. **Pour Google et les bots IA, le site est en FR** ; l'EN est invisible aux crawlers.

Objectif produit : faire citer Swissalytics par les moteurs IA (ChatGPT, Google AI). Le modèle actuel ne le permet pas — d'où le passage à un blog **file-based MDX + RSC** avec SEO/JSON-LD complet et de **vraies URLs par langue**.

On renomme aussi `/journal` → `/blog` (terme conventionnel, meilleure découvrabilité). Coût ~nul puisqu'on reconstruit ; redirections 301 pour ne rien perdre. Base de référence : l'archi blog de Helvee (file-based MDX), adaptée au stack et à l'identité Swissalytics.

## 2. Stack cible (vérifié)

Next.js 15.3.3 · React 19.1 · Tailwind **v3** (3.4.7, `plugins: []` dans `tailwind.config.ts`) · App Router. Aucune dépendance MDX installée à ce jour.

## 3. Objectifs / Non-objectifs

**Objectifs (Phase 1)**
- Blog file-based MDX rendu en RSC, indexable et citable, sous `/blog`.
- JSON-LD complet par article (Article, Breadcrumb, Organization) + FAQPage/HowTo à la demande.
- Vraies URLs par langue : FR `/blog/<slug>`, EN `/blog/en/<slug>`, avec `hreflang` croisé.
- Redirections 301 `/journal` → `/blog` et `/journal/<slug>` → `/blog/<slug>`.
- Migration des 7 articles existants vers MDX, puis suppression de `posts.ts` et des pages client.
- Identité brutaliste respectée (pas de `prose` générique).
- Tests unitaires loader + schema, e2e routes/hreflang/redirections.

**Non-objectifs (hors Phase 1)**
- OG images auto par article (Satori) → Phase 2.
- Les nouveaux articles série Ahrefs → Phase 3.
- Migration de `/compare` vers MDX (reste tel quel).
- Refonte i18n de tout le site (le blog est le 1er bout i18n ; reco séparée pour le reste).
- Coloration de code (shiki / rehype-pretty-code) → exclu (YAGNI).

## 4. Architecture

### 4.1 Arborescence

```
content/blog/
  <slug>.fr.mdx                 # frontmatter YAML + corps MDX
  <slug>.en.mdx                 # version EN (présente seulement si traduite)
  _authors.json                 # registre auteurs (clé → profil)
public/blog/
  <cover>.webp                  # images de couverture
  authors/<avatar>              # avatars
src/lib/blog/
  loader.ts                     # fs + gray-matter, validation, locale, draft, tri  (server-only)
  schema.ts                     # générateurs JSON-LD (constantes Swissalytics/Pixelab)
  loader.test.ts
  schema.test.ts
src/app/blog/
  page.tsx                      # listing FR (RSC)
  [slug]/page.tsx               # article FR (RSC + generateMetadata + JSON-LD)
  en/page.tsx                   # listing EN (RSC)
  en/[slug]/page.tsx            # article EN (RSC + generateMetadata + JSON-LD)
src/components/blog/
  MdxContent.tsx                # pipeline MDX → composants brandés (pas de prose générique)
  TableOfContents.tsx           # sommaire sticky + scroll-spy ('use client')
  ReadingProgressBar.tsx        # barre de progression ('use client')
  Faq.tsx                       # bloc FAQ MDX + JSON-LD FAQPage
  HowTo.tsx                     # bloc pas-à-pas + JSON-LD HowTo
```

### 4.2 Modèle de données — frontmatter

```yaml
title: "..."              # requis
description: "..."        # requis (= meta description + JSON-LD)
publishedAt: "2026-06-04" # requis, ISO 8601
updatedAt: "2026-06-04"   # optionnel
type: "pillar"            # requis, enum: authority | pillar | versus | decision | checklist
author: "dardan"          # requis, clé dans _authors.json
slug: "..."               # optionnel (sinon dérivé du nom de fichier, sans le .fr/.en)
tags: [...]               # optionnel
entities: [...]           # optionnel — entités nommées (SEO/GEO)
featured: true            # optionnel — 1 seul featured par locale sur le listing
draft: false              # optionnel — caché en prod
coverImage / coverAlt / coverCaption   # optionnel
```

Le `type` remplace les catégories actuelles (Analyse/Technique/Opinion/Cas client). Libellés FR/EN d'affichage mappés dans le code (ex. `versus` → « Comparatif », `checklist` → « Checklist », `pillar` → « Dossier », `authority` → « Analyse », `decision` → « Décision »). `entities` sert le positionnement GEO (entités nommées).

### 4.3 `_authors.json`

```json
{
  "dardan":  { "name": "...", "role": "...", "avatar": "/blog/authors/...", "url": "https://pixelab.ch/..." },
  "pixelab": { "name": "Équipe Pixelab", "role": "...", "avatar": "...", "url": "https://pixelab.ch" }
}
```

### 4.4 Loader — `src/lib/blog/loader.ts` (`server-only`)

API publique :
- `listArticles(locale: 'fr' | 'en'): ArticleMeta[]` — méta uniquement, drafts filtrés en prod, triés par `publishedAt` DESC. Ne renvoie que les articles présents dans la locale demandée (choix « fichiers par langue » : pas de fallback FR sur le listing EN).
- `getArticleBySlug(slug: string, locale: 'fr' | 'en'): Article | null` — article complet (méta + source MDX). `null` si absent dans cette locale.
- `listArticleParams(locale): { slug }[]` — pour `generateStaticParams()` par locale.
- `getAlternateLocales(slug): { fr: boolean; en: boolean }` — pour `hreflang`/canonical (savoir si la version sœur existe).
- `getRelatedArticles(slug, locale, limit=3)` — même `type` d'abord, puis récents.

Responsabilités : lecture `fs`, parse `gray-matter`, **validation stricte** du frontmatter (champs requis présents, `type` ∈ enum, dates ISO valides, `slug` kebab-case), **slugs réservés** (`en` interdit comme slug d'article pour ne pas entrer en collision avec `/blog/en`), résolution auteur depuis `_authors.json` (erreur si clé inconnue), calcul `reading-time`. Erreurs de validation = build qui casse (fail fast), pas de publication silencieuse d'un article cassé.

### 4.5 Schema JSON-LD — `src/lib/blog/schema.ts`

Générateurs injectés via `<script type="application/ld+json">` :
- `buildArticleSchema` — Article (headline, description, auteur, datePublished/Modified, image, wordCount, inLanguage).
- `buildBreadcrumbSchema` — BreadcrumbList (Accueil › Blog › Article).
- `buildOrganizationSchema` — Organization (éditeur = Pixelab/Swissalytics).
- `buildBlogSchema` — Blog (page listing).
- `buildFaqPageSchema` — FAQPage (depuis le composant `<Faq>`).
- `buildHowToSchema` — HowTo (depuis le composant `<HowTo>`).

Constantes Swissalytics centralisées en tête de fichier : `SITE_URL`, `SITE_NAME`, `PUBLISHER_*` (Pixelab, Genève).

### 4.6 Rendu MDX — `src/components/blog/MdxContent.tsx`

`MDXRemote` (`next-mdx-remote/rsc`) avec `remark-gfm` + `rehype-slug` (ancres h2/h3 pour le ToC). `mdxComponents` expose `<Faq>` et `<HowTo>` sans import dans le MDX. JSX dans les props autorisé (`<Faq items={[...]} />`).

**Typographie brandée (pas de `prose` par défaut).** On part de `@tailwindcss/typography` (ajouté via `require('@tailwindcss/typography')` dans `plugins` de `tailwind.config.ts`, Tailwind v3) **mais** on surcharge un thème `prose-sa` aligné brutalisme : Inter Tight (titres) + corps lisible, légendes mono, liens rouge `#E5241A` soulignés (pas bleu), zéro arrondi, blockquote bord rouge + drop-cap rouge (réutilise le langage visuel des articles actuels). Objectif explicite : ne pas ressembler au blog IA générique.

### 4.7 Routing & i18n

- FR (canonique) : `/blog` (listing), `/blog/<slug>` (article).
- EN : `/blog/en` (listing), `/blog/en/<slug>` (article).
- **Redirections 301** : `/journal` → `/blog`, `/journal/:slug` → `/blog/:slug` (via `redirects()` dans `next.config`). L'ancien Journal n'avait pas d'EN, donc seules les URLs FR sont à rediriger.
- `generateStaticParams` par locale. `generateMetadata` par article : `<title>`, `description`, OpenGraph, `canonical`, et `alternates.languages` (`hreflang` fr/en) quand la version sœur existe.
- Le toggle FR/EN global : sur une page blog, il **navigue** vers l'URL de l'autre langue (si elle existe ; sinon désactivé/retour listing) et synchronise `localStorage`. Hook/util partagé pour mapper slug ↔ locale.
- Articles rendus **serveur** dans leur langue (plus de bascule client du corps).

### 4.8 Composants annexes
- `TableOfContents` ('use client') — scanne les `h2/h3` (ids via rehype-slug), sticky + scroll-spy, cachée si < 3 sections.
- `ReadingProgressBar` ('use client') — progression de lecture.
- `Faq` / `HowTo` — rendu visuel + émission du JSON-LD correspondant.

## 5. Migration des 7 articles existants

1. Convertir chaque entrée de `posts.ts` en `content/blog/<slug>.fr.mdx` (frontmatter + corps ; blocs `p`/`h2`/`quote`/`numbered` → MDX). `.en.mdx` créé uniquement pour les articles qui ont déjà `contentEn`.
2. Mapper `category` → `type` (enum) ; reporter `featured`, dates, auteur.
3. Reproduire `getRelatedPosts` dans le loader (`getRelatedArticles`).
4. Mettre à jour `sitemap.ts` : URLs par locale + `hreflang` (remplacer l'entrée mono-URL du journal, pointer `/blog`).
5. Mettre à jour les liens nav/footer : libellé « Journal » → « Blog », href `/blog`.
6. **Supprimer** `src/lib/journal/posts.ts` et `src/app/journal/` (pages client) — remplacés par `/blog` RSC. Un seul système. Ajouter les redirections 301.

## 6. Dépendances à ajouter

`gray-matter`, `next-mdx-remote`, `remark-gfm`, `rehype-slug`, `reading-time`, `@tailwindcss/typography`. **Pas** de `shiki`/`rehype-pretty-code`.

## 7. Tests (obligatoire)

- **`loader.test.ts`** : validation frontmatter (manquant/typé/enum), slug kebab + slugs réservés (`en`), filtre `draft` en prod vs dev, tri date DESC, résolution auteur (clé inconnue = erreur), sélection de locale (article FR seul absent du listing EN), `getAlternateLocales`, `getRelatedArticles`.
- **`schema.test.ts`** : chaque générateur produit un JSON-LD valide (champs requis schema.org, langue, URLs absolues).
- **e2e** : `/blog` et `/blog/en` rendent en serveur dans la bonne langue ; un article émet le JSON-LD Article ; `hreflang` présent et croisé ; `/journal` → 301 `/blog` ; un slug inexistant → 404 ; draft non accessible en prod.

## 8. Risques & cas limites

- **next-mdx-remote/rsc sur Next 15 / React 19** : valider la compat dès l'install (smoke test d'un MDX trivial) avant de tout bâtir.
- **Slug `en` réservé** (collision avec `/blog/en`) — couvert par la validation.
- **Traduction EN manquante** : article non listé côté EN ; le toggle sur la page FR pointe vers EN inexistant → toggle désactivé ou renvoi listing EN.
- **MDX = contenu first-party uniquement** : les expressions JSX sont autorisées ; sûr car nous écrivons le MDX (jamais d'entrée utilisateur).
- **Tailwind v3** : bien utiliser le tableau `plugins` (pas la syntaxe `@plugin` v4 de Helvee).
- **Redirections** : vérifier qu'aucun lien interne ne pointe encore vers `/journal` après migration.

## 9. Phases suivantes (hors cette spec)
- **Phase 2** — OG images auto par article (next/og + Satori, fonts Inter Tight/JetBrains).
- **Phase 3** — Série thématique 3-4 articles à partir des 14 études Ahrefs (dont ≥ 1 format `checklist`/listicle pour le finding #1), avec crédits/liens vers Ahrefs.
