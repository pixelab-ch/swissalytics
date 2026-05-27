# Follow-ups — Fiabilité du scanner (réduction des faux négatifs)

> Plan d'options à décider. Contexte : la PR #21 a livré l'analyse content/link-driven + la sécurité SSRF. Reste à réduire les cas où le scanner dit « manquant » alors que ça existe (faux négatif = problème de crédibilité). Aucun de ces points n'était bloquant pour #21.

Rappel des **cas où l'analyse actuelle se trompe encore** :
1. Page légitimement lente (>8s) → coupée → faux « manquant ».
2. Burst de connexions vers un petit site → timeouts auto-infligés.
3. Site SPA / contenu rendu en JS → fetch statique voit une coquille vide.
4. Anti-bot (Cloudflare challenge, CAPTCHA) → contenu invisible.
5. Page existante mais non liée depuis l'accueil → ratée.

---

## Option A — Limiteur de concurrence par origine  ·  cible : cas 2
**Quoi** : un sémaphore (cap ~6 connexions simultanées par domaine) autour de `fetchRealPage` dans `page-discovery.ts`. Toutes les requêtes y passent déjà → borne le burst (~30-40 → 6) sans toucher la logique ni les budgets.
**Pourquoi** : évite de re-créer le timeout enigma sur d'autres petits sites suisses ; évite de se faire bloquer l'IP serveur par un WAF.
**Effort** : faible (+ 1 test). **Coût** : 0 €. **Risque** : sur un site lent+volumineux, peut sérialiser et faire dégrader un module (fail-open, déjà le comportement).
**Verdict revue** : recommandé, non bloquant.

## Option B — État « non vérifiable » (≠ « manquant »)  ·  cible : cas 1,3,4 (crédibilité)  ·  ⭐ sweet spot
**Quoi** : généraliser le modèle 3-états honnête (déjà fait pour les moteurs IA « indisponible » et les bots « non testé ») à tous les signaux E-E-A-T. Quand un fetch timeout / est bloqué / dégrade → afficher **« non vérifié »** au lieu de **« manquant »**, et ne PAS déclencher la reco « créer une page X ».
**Pourquoi** : tue le faux négatif à la racine au niveau UX, sans devoir mieux fetcher. C'est le geste le plus honnête.
**Effort** : moyen. **Coût** : 0 €. **Risque** : faible (UI + condition de reco).

## Option C — Découverte via sitemap.xml  ·  cible : cas 5  ·  ⭐ sweet spot
**Quoi** : on télécharge déjà `sitemap.xml` (check technique). L'utiliser comme source de candidats en plus des liens de l'accueil → attrape les pages existantes non liées depuis la home.
**Pourquoi** : élargit la découverte sans crawl aveugle, s'emboîte dans le modèle link-driven.
**Effort** : faible. **Coût** : 0 €. **Risque** : faible (borne le nb de candidats comme aujourd'hui).

## Option D — Retry sur timeout  ·  cible : cas 1 (transitoire)
**Quoi** : avant de déclarer « manquant », réessayer une fois un fetch qui a timeout (démarrage à froid, lenteur transitoire).
**Pourquoi** : attrape le transitoire (le cold-start enigma à 3,4s).
**Effort** : faible. **Coût** : 0 €. **Risque** : ajoute un peu de latence dans le pire cas (à borner pour rester dans le budget).

## Option E — Rendu navigateur (fallback si SPA)  ·  cible : cas 3,4  ·  🏔️ gros chantier
**Quoi** : quand la détection SPA repère une coquille vide, rendre la page dans un Chromium headless (Playwright) et analyser le DOM rendu. Path statique inchangé pour les sites sains.
**Pourquoi** : seul moyen de voir le contenu rendu en JS + passer certains challenges JS. C'est le vrai plafond.
**Effort** : élevé (phase à part). **Coût** : self-hébergé sur le VPS = 0 €/appel mais RAM/CPU + maintenance ; API managée (Browserless/ScrapingBee…) = ~0,001-0,005 $ par site SPA rendu. **Risque** : infra (mémoire, crashes, latence). Décision self-host vs managé à trancher.
**Note** : borné au fallback-SPA → seuls les sites qui en ont besoin paient le coût.

---

## Séquencement recommandé
1. **B + C** (sweet spot) — meilleur rapport valeur/effort, 0 €, faible risque, attaquent la majorité des faux négatifs honnêtement.
2. **A** — assurance burst, cheap.
3. **D** — petit plus transitoire.
4. **E** — à décider à part (chantier + arbitrage coût). Le faire en fallback-on-SPA.

**À décider par l'utilisateur** : lesquelles, et dans quel ordre.
