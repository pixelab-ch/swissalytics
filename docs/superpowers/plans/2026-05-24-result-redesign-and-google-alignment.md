# Refonte vue résultat + alignement Google — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner Swissalytics sur la doctrine Google de mai 2026 (correctifs crédibilité + bot-coverage) et refondre la vue résultat (onglets en rail gauche, accueil = plan groupé) selon le prototype validé.

**Architecture:** Next.js 15 App Router + React 19, vitest pour l'unitaire, brutalist v2 design system. On réutilise des composants existants (`SectionNavEntry`, `InfoBox`, buckets de `buildPlan`) plutôt que d'en créer. Nouveau : un parser pur `bot-coverage.ts` (testé TDD), 2 pages de contenu, et l'infra Playwright (absente aujourd'hui).

**Tech Stack:** TypeScript, React 19, vitest 4, Playwright (à ajouter), Tailwind 3.

**Spec source:** `docs/superpowers/specs/2026-05-24-result-redesign-and-google-alignment-design.md`
**Prototype validé:** `docs/superpowers/specs/assets/2026-05-24-result-redesign-prototype.html`

**Livraison:** 1 PR. Branche : `feat/result-redesign-google-alignment`.

---

## Carte des fichiers

**Créés :**
- `src/lib/analyzer/bot-coverage.ts` — parser pur robots.txt → statut par crawler IA.
- `src/lib/analyzer/__tests__/bot-coverage.test.ts` — tests unitaires du parser.
- `src/components/report/scorecardQualifier.ts` — helper pur libellé (Solide/Correct/À renforcer) + définitions jargon.
- `src/components/report/__tests__/scorecardQualifier.test.ts` — tests.
- `src/components/report/BotCoverage.tsx` — affichage bot-coverage dans l'onglet GEO.
- `src/app/glossaire/page.tsx` — page Glossaire SEO.
- `src/app/guide-geo/page.tsx` — page Guide GEO.
- `e2e/result-view.spec.ts`, `e2e/navigation.spec.ts`, `e2e/content.spec.ts` — tests Playwright.
- `playwright.config.ts` — config Playwright.

**Modifiés :**
- `src/lib/journal/posts.ts` — fix "40 sec"→"30 sec" ; ajout `contentEn` aux 7 articles ; recadrage article llms.txt.
- `src/lib/i18n/copy.ts` — retrait `API`/`Changelog` de `footerProduit` (FR+EN).
- `src/components/design-system/Footer.tsx` — branchement liens Glossaire/Guide-GEO, retrait API/Changelog.
- `src/lib/analyzer/technical.ts` — retrait pénalité llms.txt (:464) ; reformulation issue (:340) ; calcul `botCoverage`.
- `src/lib/types.ts` — `TechnicalAnalysis.botCoverage` (nouveau champ).
- `src/components/tabs/TechnicalTab.tsx` — réécriture InfoBox llms.txt (:65).
- `src/lib/issueTips.ts` — reformulation tip llms.txt.
- `src/app/exemples/page.tsx:39-40` — recadrage témoignage llms.txt.
- `src/app/methode/page.tsx:36,80` — recadrage grille IA-Ready.
- `src/lib/pdf/generateReport.ts` — ligne llms.txt (info, pas de pénalité).
- `src/components/report/ReportView.tsx` — onglets horizontaux → rail gauche.
- `src/components/report/DetailsContent.tsx` — sous-sections → barre horizontale.
- `src/components/report/OverviewContent.tsx` — accueil = plan groupé Crit/Important/Bonus + stats reléguées.
- `src/components/report/Scorecard.tsx` — état chargement calme + libellé qualificatif + InfoBox jargon.
- `package.json` — scripts `test:e2e`, devDep `@playwright/test`.

---

## PHASE A — Correctifs crédibilité + copy

### Task A1 : Fix durée d'analyse
**Files:** Modify `src/lib/journal/posts.ts:116`

- [ ] **Step 1 — Localiser et corriger**

Remplacer `40 secondes` par `30 secondes` à la ligne 116 (« on vous dit, en 40 secondes, si un LLM peut vous identifier… »).

- [ ] **Step 2 — Vérifier qu'aucune autre divergence ne subsiste**

Run: `grep -rni "40 sec\|en 40\|40 secondes" src` → Expected: aucun résultat.

- [ ] **Step 3 — Commit**

```bash
git add src/lib/journal/posts.ts
git commit -m "fix(journal): durée d'analyse 40s → 30s (cohérence)"
```

### Task A2 : Footer — retirer API + Changelog
**Files:** Modify `src/lib/i18n/copy.ts:116,183`, `src/components/design-system/Footer.tsx`

- [ ] **Step 1 — copy.ts FR (:116)**

`footerProduit: ['Méthode', 'Exemples', 'Comparatifs', 'API', 'Changelog']` → `['Méthode', 'Exemples', 'Comparatifs']`

- [ ] **Step 2 — copy.ts EN (:183)**

`['Method', 'Examples', 'Comparisons', 'API', 'Changelog']` → `['Method', 'Examples', 'Comparisons']`

- [ ] **Step 3 — Footer.tsx**

Lire `Footer.tsx`, retirer les `<li>`/entrées rendues pour API et Changelog (lignes ~13-14). S'assurer que le mapping `footerProduit` ne référence plus d'index disparus (si href en dur indexé par position, réaligner).

- [ ] **Step 4 — Vérifier**

Run: `pnpm type-check` → Expected: clean.

- [ ] **Step 5 — Commit** (groupé avec A3 une fois les pages créées, voir Phase C).

### Task A3 : llms.txt — retirer la pénalité de score
**Files:** Modify `src/lib/analyzer/technical.ts:464`, `:340`

- [ ] **Step 1 — Retirer la pénalité**

`technical.ts:464` : supprimer la ligne `if (!llmsTxt.exists) score -= 3;` (ou la remplacer par un commentaire `// llms.txt: non pénalisé — Google (mai 2026) ne le considère pas comme déterminant`).

- [ ] **Step 2 — Reformuler l'issue (:340)**

`'Fichier llms.txt introuvable (recommandé pour le GEO)'` → `'Fichier llms.txt absent (bonus optionnel — non requis par Google)'`. Garder `type: 'info'`.

- [ ] **Step 3 — Vérifier**

Run: `pnpm test -- technical` puis `pnpm type-check` → Expected: pass/clean. Si un test pinne l'ancienne pénalité, le mettre à jour pour refléter « pas de pénalité llms.txt ».

- [ ] **Step 4 — Commit**

```bash
git add src/lib/analyzer/technical.ts
git commit -m "fix(technical): llms.txt ne pénalise plus le score (doctrine Google mai 2026)"
```

### Task A4 : llms.txt — recadrer les 5 textes UI/éditoriaux
**Files:** Modify `TechnicalTab.tsx:65`, `issueTips.ts`, `exemples/page.tsx:39-40`, `methode/page.tsx:36,80`, `journal/posts.ts:334+`

- [ ] **Step 1 — InfoBox Technique (`TechnicalTab.tsx:65`)**

Remplacer la définition « …un avantage compétitif en GEO. » par : FR « Fichier émergent censé aider certaines IA à comprendre un site. Google (mai 2026) ne le considère pas comme un facteur déterminant — à voir comme un bonus optionnel, pas une priorité. » + équivalent EN si la structure i18n l'exige.

- [ ] **Step 2 — Tip (`issueTips.ts`)**

Remplacer « …un avantage compétitif émergent. » par une formulation alignée (« bonus optionnel, non requis par Google »).

- [ ] **Step 3 — Témoignage Exemples (`exemples/page.tsx:39-40`)**

Retirer la mention `llms.txt` du témoignage (FR + EN), garder `Schéma LocalBusiness` (reste valide). Ex. FR : « Schéma LocalBusiness + contenu structuré. Deux semaines après, nous étions cités par ChatGPT. »

- [ ] **Step 4 — Méthode (`methode/page.tsx:36,80`)**

Dans la grille IA-Ready, retirer `llms.txt` de la liste des critères (FR + EN) ou le marquer « (bonus) ».

- [ ] **Step 5 — Article journal (`posts.ts:334+`)**

L'article « llms.txt : le mode d'emploi honnête » dit déjà « pas pour les raisons qu'on vous raconte ». Mettre à jour le corps pour intégrer explicitement la position Google de mai 2026 (non déterminant). Couvert aussi par A5 (traduction EN).

- [ ] **Step 6 — PDF (`generateReport.ts`)**

Garder la ligne llms.txt en info (Présent/Absent), aucune notion de pénalité.

- [ ] **Step 7 — Commit**

```bash
git add -A
git commit -m "docs(content): recadrer llms.txt comme bonus optionnel (alignement Google)"
```

---

## PHASE B — Bot-coverage (TDD)

### Task B1 : Parser pur `parseRobotsForAiBots` (TDD)
**Files:** Create `src/lib/analyzer/bot-coverage.ts`, Test `src/lib/analyzer/__tests__/bot-coverage.test.ts`

- [ ] **Step 1 — Écrire les tests d'abord**

```ts
// src/lib/analyzer/__tests__/bot-coverage.test.ts
import { describe, it, expect } from 'vitest';
import { parseRobotsForAiBots, AI_BOTS } from '../bot-coverage';

describe('parseRobotsForAiBots', () => {
  it('pas de robots.txt → tous unmentioned (autorisés par défaut)', () => {
    const r = parseRobotsForAiBots(undefined);
    expect(r.every((b) => b.status === 'unmentioned')).toBe(true);
    expect(r).toHaveLength(AI_BOTS.length);
  });

  it('User-agent: * Disallow: / → tous bloqués (sauf override)', () => {
    const r = parseRobotsForAiBots('User-agent: *\nDisallow: /');
    expect(r.find((b) => b.name === 'GPTBot')!.status).toBe('blocked');
  });

  it('bloc spécifique GPTBot Disallow: / → GPTBot bloqué, autres unmentioned', () => {
    const txt = 'User-agent: GPTBot\nDisallow: /';
    const r = parseRobotsForAiBots(txt);
    expect(r.find((b) => b.name === 'GPTBot')!.status).toBe('blocked');
    expect(r.find((b) => b.name === 'ClaudeBot')!.status).toBe('unmentioned');
  });

  it('Allow override : * Disallow / mais GPTBot Allow /', () => {
    const txt = 'User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /';
    const r = parseRobotsForAiBots(txt);
    expect(r.find((b) => b.name === 'GPTBot')!.status).toBe('allowed');
  });

  it('insensible à la casse du user-agent', () => {
    const r = parseRobotsForAiBots('user-agent: gptbot\ndisallow: /');
    expect(r.find((b) => b.name === 'GPTBot')!.status).toBe('blocked');
  });

  it('Disallow vide = autorisé', () => {
    const r = parseRobotsForAiBots('User-agent: GPTBot\nDisallow:');
    expect(r.find((b) => b.name === 'GPTBot')!.status).toBe('allowed');
  });

  it('ignore les commentaires et lignes vides', () => {
    const r = parseRobotsForAiBots('# commentaire\n\nUser-agent: CCBot\nDisallow: /');
    expect(r.find((b) => b.name === 'CCBot')!.status).toBe('blocked');
  });
});
```

- [ ] **Step 2 — Lancer, vérifier l'échec**

Run: `pnpm test -- bot-coverage` → Expected: FAIL (module introuvable).

- [ ] **Step 3 — Implémenter le parser**

```ts
// src/lib/analyzer/bot-coverage.ts
export type BotStatus = 'allowed' | 'blocked' | 'unmentioned';

export interface AiBot {
  name: string;
  /** crawler de quoi (affichage UI) */
  crawls: string;
}

export const AI_BOTS: AiBot[] = [
  { name: 'Googlebot', crawls: 'Google Search + AI Overviews' },
  { name: 'GPTBot', crawls: 'OpenAI / ChatGPT' },
  { name: 'ClaudeBot', crawls: 'Anthropic / Claude' },
  { name: 'PerplexityBot', crawls: 'Perplexity' },
  { name: 'Google-Extended', crawls: 'Gemini (entraînement)' },
  { name: 'CCBot', crawls: 'Common Crawl' },
];

export interface BotResult {
  name: string;
  crawls: string;
  status: BotStatus;
}

interface Group {
  agents: string[];
  rules: Array<{ type: 'allow' | 'disallow'; path: string }>;
}

function parseGroups(txt: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (!m) continue;
    const field = m[1].trim().toLowerCase();
    const value = m[2].trim();
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === 'allow' || field === 'disallow') {
      if (current) current.rules.push({ type: field, path: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

/** statut pour un user-agent donné, selon ses règles (sinon le bloc *). */
function statusFor(agent: string, groups: Group[]): BotStatus {
  const a = agent.toLowerCase();
  const specific = groups.find((g) => g.agents.includes(a));
  const wildcard = groups.find((g) => g.agents.includes('*'));
  const group = specific ?? wildcard;
  if (!group) return 'unmentioned';
  // règle la plus spécifique (path le plus long) gagne ; Allow > Disallow à égalité.
  let decided: BotStatus = 'allowed';
  let bestLen = -1;
  for (const rule of group.rules) {
    const len = rule.path.length;
    const blocksRoot = rule.type === 'disallow' && rule.path !== '';
    const allows = rule.type === 'allow' || rule.path === '';
    if (len > bestLen || (len === bestLen && rule.type === 'allow')) {
      bestLen = len;
      decided = blocksRoot ? 'blocked' : (allows ? 'allowed' : 'allowed');
    }
  }
  // si le bloc existe mais n'a aucune règle → autorisé
  if (group.rules.length === 0) return specific ? 'allowed' : 'unmentioned';
  return decided;
}

export function parseRobotsForAiBots(robotsTxt: string | undefined): BotResult[] {
  if (!robotsTxt) {
    return AI_BOTS.map((b) => ({ name: b.name, crawls: b.crawls, status: 'unmentioned' as const }));
  }
  const groups = parseGroups(robotsTxt);
  return AI_BOTS.map((b) => {
    const hasSpecific = groups.some((g) => g.agents.includes(b.name.toLowerCase()));
    const status = hasSpecific
      ? statusFor(b.name, groups)
      : (groups.some((g) => g.agents.includes('*')) ? statusFor(b.name, groups) : 'unmentioned');
    return { name: b.name, crawls: b.crawls, status };
  });
}
```

- [ ] **Step 4 — Lancer, vérifier le succès**

Run: `pnpm test -- bot-coverage` → Expected: 7/7 PASS. Ajuster l'impl si un cas échoue (notamment la précédence Allow/Disallow).

- [ ] **Step 5 — Commit**

```bash
git add src/lib/analyzer/bot-coverage.ts src/lib/analyzer/__tests__/bot-coverage.test.ts
git commit -m "feat(bot-coverage): parser robots.txt par crawler IA (TDD)"
```

### Task B2 : Câbler le parser dans l'analyse
**Files:** Modify `src/lib/types.ts`, `src/lib/analyzer/technical.ts`

- [ ] **Step 1 — Type**

`types.ts` : dans `TechnicalAnalysis`, ajouter `botCoverage: import('./analyzer/bot-coverage').BotResult[];` (ou importer le type en tête).

- [ ] **Step 2 — Calcul**

`technical.ts` après le bloc robots (≈ ligne 264) : `const botCoverage = parseRobotsForAiBots(robotsRes.ok ? robotsRes.text : undefined);` (utiliser le texte COMPLET `robotsRes.text`, pas `robotsTxt.content` tronqué). Ajouter `botCoverage` à l'objet retourné.

- [ ] **Step 3 — Vérifier**

Run: `pnpm type-check && pnpm test` → Expected: clean + tous verts.

- [ ] **Step 4 — Commit**

```bash
git add src/lib/types.ts src/lib/analyzer/technical.ts
git commit -m "feat(bot-coverage): exposer botCoverage dans TechnicalAnalysis"
```

### Task B3 : Affichage bot-coverage dans l'onglet GEO
**Files:** Create `src/components/report/BotCoverage.tsx`, Modify `src/components/report/GeoTabContent.tsx`

- [ ] **Step 1 — Composant**

Créer `BotCoverage.tsx` : reçoit `bots: BotResult[]` + `isFr`. Rend un panneau brutalist (réutiliser le style `EngineCard`/CheckPill de GeoTabContent) : par bot, nom + ce qu'il crawle + pastille `● Autorisé` (vert `--sa-ok`), `○ Bloqué` (rouge `--sa-red`), `— Non mentionné` (gris). Bandeau d'avertissement si un bot IA (GPTBot/ClaudeBot/PerplexityBot) est `blocked` : « ⚠️ Ton site bloque {bot} — il ne pourra pas te citer. »

- [ ] **Step 2 — Intégrer**

Dans `GeoTabContent.tsx`, ajouter une section `§ Robots IA (robots.txt)` qui rend `<BotCoverage bots={report.technical.botCoverage} isFr={isFr} />`. Placement : après le panneau Indexation IA.

- [ ] **Step 3 — Vérifier visuellement** (Phase E Playwright + manuel).

- [ ] **Step 4 — Commit**

```bash
git add src/components/report/BotCoverage.tsx src/components/report/GeoTabContent.tsx
git commit -m "feat(geo): afficher bot-coverage (robots IA) dans l'onglet Indexation"
```

---

## PHASE C — Contenu (pages + traductions)

### Task C1 : Page Glossaire SEO
**Files:** Create `src/app/glossaire/page.tsx`, Modify `Footer.tsx`

- [ ] **Step 1 — Page**

Créer `glossaire/page.tsx` (server component, ton éditorial brutalist, FR+EN via `useTheme`/copy si pattern existant — sinon suivre le pattern de `methode/page.tsx`). Définitions des termes : SEO, GEO, AEO, E-E-A-T, Schema.org / JSON-LD, Core Web Vitals (LCP/CLS/TTFB), crawlabilité, indexation, AI Overviews / AI Mode, llms.txt (avec la nuance « non requis par Google »), robots.txt, sitemap, canonical, métadonnées, Flesch. ~15 entrées, chacune : terme + définition courte + pourquoi ça compte. Metadata SEO (title/description). Contenu rédigé par l'assistant, **relu par l'utilisateur**.

- [ ] **Step 2 — Brancher le lien footer**

`Footer.tsx` : « Glossaire SEO » → `/glossaire`.

- [ ] **Step 3 — Vérifier**

Run: `pnpm build` → Expected: route `/glossaire` générée, build clean.

- [ ] **Step 4 — Commit**

```bash
git add src/app/glossaire src/components/design-system/Footer.tsx src/lib/i18n/copy.ts
git commit -m "feat(content): page Glossaire SEO + lien footer (retire API/Changelog)"
```

### Task C2 : Page Guide GEO
**Files:** Create `src/app/guide-geo/page.tsx`, Modify `Footer.tsx`

- [ ] **Step 1 — Page**

Créer `guide-geo/page.tsx` aligné sur la doctrine Google mai 2026 (réf. `data/research/seo-geo/conclusions-swissalytics.md`) : « GEO = du SEO », ce qui marche (contenu de valeur, fondations techniques, E-E-A-T, crawlabilité par robots IA), ce qui ne marche PAS selon Google (llms.txt déterminant, chunking, sur-structuration, AI-rewriting). FR+EN. Contenu rédigé par l'assistant, **relu par l'utilisateur**.

- [ ] **Step 2 — Lien footer** « Guide GEO » → `/guide-geo`.

- [ ] **Step 3 — Vérifier** Run: `pnpm build` → route `/guide-geo` générée.

- [ ] **Step 4 — Commit**

```bash
git add src/app/guide-geo src/components/design-system/Footer.tsx
git commit -m "feat(content): page Guide GEO alignée doctrine Google mai 2026"
```

### Task C3 : Journal bilingue (contentEn × 7)
**Files:** Modify `src/lib/journal/posts.ts`, le composant de rendu d'article

- [ ] **Step 1 — Vérifier le type**

Confirmer que `JournalPost` a (ou ajouter) un champ optionnel `contentEn?: string`.

- [ ] **Step 2 — Traduire**

Ajouter `contentEn` aux 7 posts : traduction EN fidèle du corps `content` (HTML identique, texte traduit). Rédigé par l'assistant.

- [ ] **Step 3 — Rendu**

Dans le composant article (probablement `src/app/journal/[slug]/page.tsx`), utiliser `lang === 'en' && post.contentEn ? post.contentEn : post.content`.

- [ ] **Step 4 — Vérifier**

Run: `pnpm build` + ouvrir un article en EN (Phase E) → corps en anglais.

- [ ] **Step 5 — Commit**

```bash
git add src/lib/journal/posts.ts src/app/journal
git commit -m "feat(journal): traduction EN du corps des 7 articles"
```

---

## PHASE D — Refonte vue résultat

> Pas de lib de test composant dans le projet (pattern = pure-functions + smoke). La vérif UI se fait en Phase E (Playwright) + visuel. Suivre le prototype `docs/superpowers/specs/assets/2026-05-24-result-redesign-prototype.html`.

### Task D1 : Helper qualificatif scorecard (TDD)
**Files:** Create `src/components/report/scorecardQualifier.ts` + test

- [ ] **Step 1 — Test**

```ts
import { describe, it, expect } from 'vitest';
import { scoreQualifier } from '../scorecardQualifier';

describe('scoreQualifier', () => {
  it('>=80 → Solide', () => { expect(scoreQualifier(81, true).label).toBe('Solide'); });
  it('60-79 → Correct', () => { expect(scoreQualifier(63, true).label).toBe('Correct'); });
  it('<60 → À renforcer', () => { expect(scoreQualifier(58, true).label).toBe('À renforcer'); });
  it('null → état chargement', () => { expect(scoreQualifier(null, true).loading).toBe(true); });
  it('EN labels', () => { expect(scoreQualifier(81, false).label).toBe('Solid'); });
});
```

- [ ] **Step 2 — Échec** Run: `pnpm test -- scorecardQualifier` → FAIL.

- [ ] **Step 3 — Impl** (aligner les seuils sur `scoreColor` de `primitives`)

```ts
// src/components/report/scorecardQualifier.ts
export interface Qualifier { label: string; loading: boolean; }
export function scoreQualifier(score: number | null, isFr: boolean): Qualifier {
  if (score === null) return { label: isFr ? 'calcul…' : 'computing…', loading: true };
  if (score >= 80) return { label: isFr ? 'Solide' : 'Solid', loading: false };
  if (score >= 60) return { label: isFr ? 'Correct' : 'Fair', loading: false };
  return { label: isFr ? 'À renforcer' : 'Needs work', loading: false };
}
```

- [ ] **Step 4 — Succès** Run: `pnpm test -- scorecardQualifier` → 5/5 PASS.

- [ ] **Step 5 — Commit**

```bash
git add src/components/report/scorecardQualifier.ts src/components/report/__tests__/scorecardQualifier.test.ts
git commit -m "feat(report): helper qualificatif scorecard (TDD)"
```

### Task D2 : Scorecard — état calme + qualificatif + InfoBox jargon
**Files:** Modify `src/components/report/Scorecard.tsx`

- [ ] **Step 1 — Modifier**

- Remplacer le `···` + `animation: sa-flash` (:54) et le scanner agressif par un état discret : texte `calcul…` (mono, `--sa-ink-4`, pas d'animation flash, éventuellement une opacité douce).
- Ajouter sous la barre le libellé `scoreQualifier(score, isFr).label` coloré via `scoreColor`.
- Ajouter un prop optionnel `hint?: string` rendu via `InfoBox` (le « i ») à côté du label, avec la définition du terme (IA-Ready, Visibilité locale).

- [ ] **Step 2 — Passer les hints depuis ReportView**

`ReportView.tsx` : passer `hint` aux 4 `<Scorecard>` (définitions courtes FR/EN).

- [ ] **Step 3 — Vérifier** Run: `pnpm type-check` → clean. Visuel en Phase E.

- [ ] **Step 4 — Commit**

```bash
git add src/components/report/Scorecard.tsx src/components/report/ReportView.tsx
git commit -m "feat(report): scorecards lisibles (qualificatif + jargon i) + chargement calme"
```

### Task D3 : Onglets principaux → rail gauche
**Files:** Modify `src/components/report/ReportView.tsx`

- [ ] **Step 1 — Remplacer la tab bar horizontale (:331-372)**

Reproduire le pattern `SectionNavEntry` de `DetailsContent.tsx` pour les 4 onglets principaux (`§01 Tableau de bord`, `§02 Détails`, `§03 Plan d'action`, `§04 Indexation IA / GEO`) : rail vertical `grid 240px 1fr`, barre rouge à gauche de l'actif, fond `--sa-cream-2`. Conserver `changeTab` + synchro `?tab=`.

- [ ] **Step 2 — Responsive**

Reprendre la logique `isNarrow` (<768px) de `DetailsContent` : sous 768px, le rail principal repasse en barre horizontale scrollable.

- [ ] **Step 3 — Vérifier** Run: `pnpm type-check` → clean. Navigation en Phase E.

- [ ] **Step 4 — Commit**

```bash
git add src/components/report/ReportView.tsx
git commit -m "feat(report): onglets principaux en rail gauche (pattern Détails)"
```

### Task D4 : Détails — sous-sections inversées en haut
**Files:** Modify `src/components/report/DetailsContent.tsx`

- [ ] **Step 1 — Inverser**

Comme le rail gauche est désormais pris par les onglets principaux, les 6 sous-sections de Détails passent en **barre horizontale soulignée en haut** (style « top-underline », rouge sous l'actif) au-dessus du contenu de section. Adapter `sidebarStyle` → barre horizontale par défaut (et garder un fallback scrollable mobile, déjà géré).

- [ ] **Step 2 — Vérifier** Run: `pnpm type-check` → clean.

- [ ] **Step 3 — Commit**

```bash
git add src/components/report/DetailsContent.tsx
git commit -m "feat(report): sous-sections Détails en barre horizontale (inversion)"
```

### Task D5 : Accueil = plan groupé + stats reléguées
**Files:** Modify `src/components/report/OverviewContent.tsx`, `ReportView.tsx`

- [ ] **Step 1 — Réordonner**

`OverviewContent` rend désormais EN PREMIER les problèmes groupés Critique / Important / Bonus (réutiliser `critItems`/`warnItems`/`infoItems` issus de `buildPlan`, déjà calculés dans `ReportView` — les passer en props) avec une phrase d'explication + effort par item (style prototype). Puis un lien/bouton « Voir le plan d'action complet → » qui appelle `changeTab('plan')`. Puis, plus bas, les `OverviewStatCard` (titres/images/liens) sous un libellé discret « Pour info — chiffres bruts ».

- [ ] **Step 2 — Props**

`ReportView` passe `critItems/warnItems/infoItems` + un callback `onGoToPlan` à `OverviewContent`.

- [ ] **Step 3 — Vérifier** Run: `pnpm type-check && pnpm test` → clean + verts.

- [ ] **Step 4 — Commit**

```bash
git add src/components/report/OverviewContent.tsx src/components/report/ReportView.tsx
git commit -m "feat(report): accueil = plan groupé Crit/Important/Bonus, stats reléguées"
```

---

## PHASE E — Playwright e2e

### Task E1 : Setup Playwright
**Files:** Create `playwright.config.ts`, Modify `package.json`

- [ ] **Step 1 — Installer**

Run: `pnpm add -D @playwright/test, puis (téléchargement navigateur, réseau) : pnpm exec playwright install chromium`

- [ ] **Step 2 — Config**

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  webServer: { command: 'pnpm build && pnpm start', url: 'http://localhost:3000', timeout: 120_000, reuseExistingServer: !process.env.CI },
  use: { baseURL: 'http://localhost:3000' },
});
```

- [ ] **Step 3 — Scripts** `package.json` : `"test:e2e": "playwright test"`.

- [ ] **Step 4 — Commit**

```bash
git add playwright.config.ts package.json package-lock.json
git commit -m "chore(test): setup Playwright e2e"
```

### Task E2 : e2e navigation (rail + sous-sections)
**Files:** Create `e2e/navigation.spec.ts`

- [ ] **Step 1 — Test** (utiliser un rapport de démo ; si besoin, créer une route/fixture de rapport statique pour les tests, sinon analyser une URL stable). Couvrir : clic onglets rail → contenu + `?tab=` changent ; clic sous-sections Détails → section change. Run: `pnpm test:e2e navigation` → itérer jusqu'au vert.

- [ ] **Step 2 — Commit.**

### Task E3 : e2e contenu (accueil groupé, scorecards, bot-coverage, footer, journal EN)
**Files:** Create `e2e/result-view.spec.ts`, `e2e/content.spec.ts`

- [ ] **Step 1 — Tests** : bloc Crit/Important/Bonus présent et au-dessus des stats ; scorecards qualificatif + couleur, pas de `···` figé ; bot-coverage visible dans GEO ; `/glossaire` et `/guide-geo` → 200 ; `API`/`Changelog` absents du footer ; article journal en EN affiche corps anglais. Run: `pnpm test:e2e` → itérer jusqu'au vert.

- [ ] **Step 2 — Commit.**

---

## PHASE F — Revue (dev + architecte) [GATE OBLIGATOIRE]

> Réf. préférence projet : toute diff passe par une revue dev + une revue architecte avant validation utilisateur.

### Task F1 : Suite complète verte
- [ ] Run: `pnpm type-check && pnpm lint && pnpm test` → clean + tous unitaires verts.
- [ ] Run: `pnpm test:e2e` → tous e2e verts.

### Task F2 : Revue développeur
- [ ] Dispatcher l'agent `code-reviewer` sur la diff complète (`git diff main...HEAD`). Focus : bugs, sécurité (trust boundary, le parser robots.txt traite de l'input externe), qualité, cohérence des patterns.
- [ ] Traiter chaque finding (corriger ou justifier). Commits de correction atomiques.

### Task F3 : Revue architecte
- [ ] Dispatcher l'agent `architect-reviewer` sur la diff. Focus : limites de modules (rail/contenu, parser isolé), réutilisation vs duplication (SectionNavEntry, InfoBox, buildPlan), impact sur la synchro `?tab=`/liens partagés, dette introduite.
- [ ] Traiter chaque finding.

### Task F4 : Re-vert + handoff utilisateur
- [ ] Re-run la suite complète (F1) après corrections → vert.
- [ ] Présenter à l'utilisateur (valideur final) : résumé des findings dev/architecte + comment ils ont été traités, captures de la vue résultat, statut tests.

---

## Self-review (rempli)
- **Couverture spec** : 1.1→A1, 1.2→A2+C1+C2, 1.3→C3, 1.4→A3+A4, 1.5→B1-B3, 2.1→D3, 2.2→D4, 2.3→D5, 2.4→D1+D2, 2.5→D2, 2.6→(conservé, aucune tâche destructive), 2.7→D3, tests→E, revue→F. ✅
- **Placeholders** : code complet pour parser (B1) + qualifier (D1) ; les tâches UI référencent le prototype + composants existants exacts ; le contenu (C1-C3) est de la prose rédigée en exécution (pas du code à pré-écrire), structure et emplacements définis.
- **Cohérence types** : `BotResult` (B1) réutilisé en B2/B3 ; `scoreQualifier` (D1) réutilisé en D2 ; `parseRobotsForAiBots(string|undefined)` cohérent B1↔B2.
