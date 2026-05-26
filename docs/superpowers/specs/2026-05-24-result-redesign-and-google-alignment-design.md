# Design — Refonte vue résultat + alignement doctrine Google (mai 2026)

**Date** : 2026-05-24
**Statut** : 🟡 En attente de validation utilisateur (checklist ci-dessous)
**Prototype validé** : [`assets/2026-05-24-result-redesign-prototype.html`](./assets/2026-05-24-result-redesign-prototype.html) (direction « E+B » : onglets principaux en rail gauche, sous-sections Détails inversées en haut, accueil = plan groupé)

---

## Contexte

Swissalytics livré le 2026-05-11. Google publie sa doctrine officielle sur l'optimisation pour l'IA le 2026-05-15 (réf. `data/research/seo-geo/`). Deux chantiers en découlent :
- **Vague 1** — correctifs de crédibilité + alignement avec la doctrine Google.
- **Vague 2** — refonte de la vue résultat (hiérarchie de l'info), pour qu'un premier visiteur sache immédiatement quoi faire.

**Hors scope (reporté, déjà discuté)** : analyse d'entités vs concurrents SERP (coût récurrent), MCP server. La promesse « trafic IA mesuré » n'existe pas dans le code (audit confirmé) → rien à corriger.

---

## VAGUE 1 — Correctifs + alignement Google

### 1.1 — Incohérence durée d'analyse
- [ ] `src/lib/journal/posts.ts:116` : « 40 secondes » → « 30 secondes » (partout ailleurs c'est 30s).

### 1.2 — Footer : liens morts
- [ ] Retirer `API` et `Changelog` de `footerProduit` (`copy.ts:116` FR + `:183` EN) et du rendu `Footer.tsx`.
- [ ] Créer la page **Glossaire SEO** (`/glossaire`) + brancher le lien footer (`footerRessources`).
- [ ] Créer la page **Guide GEO** (`/guide-geo`) + brancher le lien footer.
- [ ] Contenu FR + EN à rédiger pour les 2 pages (glossaire = définitions des termes clés ; guide GEO = guide aligné doctrine Google). **→ contenu à valider séparément.**

### 1.3 — Journal bilingue
- [ ] Ajouter `contentEn` aux 7 articles (`src/lib/journal/posts.ts`) — actuellement titre/excerpt traduits mais corps en FR.
- [ ] Le rendu article utilise `contentEn` en anglais (fallback FR si absent).
- [ ] **→ traductions à valider.**

### 1.4 — `llms.txt` : garder mais recadrer (doctrine Google : non déterminant)
- [ ] Retirer la pénalité de score (`technical.ts:464`, −3 pts) — `llms.txt` reste détecté/affiché mais ne fait plus bouger la note.
- [ ] Réécrire l'InfoBox existante `TechnicalTab.tsx:65` (« un avantage compétitif en GEO » → texte honnête : « Google ne le considère pas comme déterminant — bonus optionnel »).
- [ ] Reformuler le texte d'issue (`technical.ts:340`) + le tip (`issueTips.ts`).
- [ ] Recadrer le témoignage Exemples `src/app/exemples/page.tsx:39-40` (crédite llms.txt d'un gain).
- [ ] Recadrer la mention Méthode `src/app/methode/page.tsx:36,80` (grille IA-Ready).
- [ ] Revoir l'article journal `posts.ts:334` (« llms.txt : le mode d'emploi honnête ») à la lumière de la doctrine mai 2026.
- [ ] PDF `generateReport.ts` : garder la ligne llms.txt (info), pas de pénalité.

### 1.5 — Bot-coverage (nouveau, différentiateur, aligné Google)
- [ ] Fonction pure `parseRobotsForAiBots(robotsTxt)` → pour chaque crawler : `allowed | blocked | unmentioned`. Robots : `Googlebot`, `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot`. (robots.txt déjà téléchargé dans `technical.ts` — zéro coût réseau/API.)
- [ ] Gérer : pas de robots.txt = tout autorisé par défaut ; règles `User-agent: *` ; précédence Allow/Disallow ; wildcards.
- [ ] Affichage dans l'onglet **Indexation IA / GEO** (`GeoTabContent.tsx`) : tableau autorisé/bloqué + avertissement si un robot IA est bloqué.
- [ ] Tests unitaires exhaustifs du parser (le point sensible : un mauvais parse = fausse info = perte de crédibilité).

---

## VAGUE 2 — Refonte vue résultat (prototype validé)

### 2.1 — Onglets principaux → rail gauche
- [ ] Dans `ReportView.tsx`, remplacer la barre d'onglets horizontale (`:331-372`) par un rail vertical à gauche réutilisant le pattern `SectionNavEntry` de `DetailsContent.tsx` (`§NN` rouge, barre rouge à gauche de l'actif, fond crème). Layout `grid 240px 1fr`.
- [ ] Conserver la synchro URL `?tab=` existante (compat liens partagés).

### 2.2 — Inversion dans Détails
- [ ] `DetailsContent.tsx` : les 6 sous-sections passent en **barre horizontale soulignée en haut** (le rail gauche est désormais pris par les onglets principaux). Style « top-underline » (rouge sous l'actif).

### 2.3 — Accueil (Tableau de bord) = plan groupé (contenu B)
- [ ] Remplacer l'ordre actuel de `OverviewContent.tsx` (stat cards d'abord, top issues en bas) par : **problèmes groupés Critique / Important / Bonus** (réutiliser les buckets de `buildPlan`), avec phrase d'explication + effort par item.
- [ ] Lien/bouton « Voir le plan d'action complet → » vers l'onglet Plan.
- [ ] Compteurs bruts (titres/images/liens) relégués en bas, étiquetés « pour info ».

### 2.4 — Scorecards lisibles d'un coup d'œil
- [ ] Sous chaque scorecard : mot qualificatif (Solide / Correct / À renforcer) dérivé du seuil `scoreColor`.
- [ ] InfoBox « i » sur chaque label jargon (IA-Ready, Visibilité locale, etc.) avec définition courte.

### 2.5 — État de chargement IA-Ready
- [ ] `Scorecard.tsx:54` : remplacer le `···` clignotant (qui ressemble à un bug) par un état calme (ex. libellé « calcul… » discret, sans animation flash agressive).

### 2.6 — Verdict serif
- [ ] Conservé, lien Pixelab conservé (décision utilisateur). Éventuel léger dégonflage visuel.

### 2.7 — Responsive
- [ ] Le rail gauche bascule en barre horizontale scrollable sur mobile (`<768px`) — le pattern existe déjà dans `DetailsContent.tsx` (mode `isNarrow`), à généraliser au rail principal.

---

## ADDENDUM 2026-05-25 — Tableau de bord « cockpit » (révision validée)

Révision de §2.3 après revue visuelle : le Tableau de bord et le Plan d'action étaient quasi-identiques (tous deux la liste groupée complète). Résolution validée (mockup `assets/2026-05-25-dashboard-cockpit-mockup.html`) :

- **Tableau de bord = cockpit** (synthèse, chaque bloc tease un onglet) :
  - §01 **À corriger en priorité** : top **3** actions seulement + lien « Plan complet (N) → » vers l'onglet Plan.
  - §02 **Visibilité IA** : « X/4 moteurs te citent » + puces moteurs (ChatGPT/Gemini/Claude/Mistral) + ligne robots IA (bot-coverage) + alerte si bot bloqué + lien « Détail IA → ».
  - §03 **Points forts** : 4-5 signaux positifs dérivés des données (HTTPS, Schema présent, LCP rapide, ratio alt, Flesch).
  - §04 **Aperçu technique** : 4 chiffres clés (titres/images/liens/lisibilité, anomalies en rouge) + lien « Tous les détails → ».
- **Plan d'action = liste complète** groupée Crit/Important/Bonus (inchangé). Plus de doublon avec l'accueil.

### Chargement interactif (async)
Certaines données arrivent après l'analyse principale (geoAnalysis = moteurs IA ; CWV = LCP). Les blocs concernés doivent **« arriver »** avec un skeleton/état de chargement, pas pop ni rester vides :
- §02 puces moteurs : skeleton tant que `report.geoAnalysis` est absent (le bot-coverage, lui, est synchrone → affiché tout de suite).
- §03 point fort LCP : skeleton tant que `cwvLoading` (les autres points forts sont synchrones).
Réutiliser l'esprit « état calme » du Scorecard (pas d'animation agressive).

### Clarté de l'effort (S/M/L)
`PlanBucket.tsx:118` affiche `S`/`M`/`L` brut (incompréhensible). Le rendre explicite : mot complet localisé — FR « Effort faible / moyen / élevé », EN « Low / Medium / High effort ». `PlanBucket` reçoit `isFr`.

---

## Stratégie de test

### Tests unitaires (obligatoires, cf. politique projet)
- [ ] `parseRobotsForAiBots` : aucun robots.txt, `User-agent: *` Disallow, bot spécifique bloqué, Allow override, wildcard, casse, multi-groupes.
- [ ] Tout helper nouveau (qualificatif scorecard, mapping plan→buckets si modifié).

### Tests Playwright e2e (nouveau dans le projet — infra à mettre en place)
- [ ] Setup Playwright (config, script `test:e2e`, CI optionnel).
- [ ] Navigation : clic sur les 4 onglets du rail gauche change le contenu + l'URL `?tab=`.
- [ ] Détails : clic sur les 6 sous-sections horizontales change la section.
- [ ] Accueil : le bloc « Critique / Important / Bonus » est présent et au-dessus des stats brutes.
- [ ] Scorecards : qualificatif + couleur présents ; pas de `···` figé.
- [ ] Bot-coverage affiché dans l'onglet GEO.
- [ ] Footer : `/glossaire` et `/guide-geo` répondent 200 ; `API`/`Changelog` absents.
- [ ] Journal : page article EN affiche un corps en anglais.
- [ ] Itérer jusqu'au vert. Validation finale = utilisateur.

---

## Découpage livraison
- **1 seule PR** couvrant Vague 1 + Vague 2 + tests (décision utilisateur 2026-05-24).

## Décisions de rédaction (validées 2026-05-24)
- Contenu **Glossaire SEO** + **Guide GEO** rédigé par l'assistant (ton éditorial du site, bonnes pratiques en ligne, aligné doctrine Google mai 2026), relu par l'utilisateur.
- Traductions EN des 7 articles rédigées par l'assistant.
- Langues du site : **FR + EN uniquement**.
- Validation finale (UI + tests) : utilisateur.
