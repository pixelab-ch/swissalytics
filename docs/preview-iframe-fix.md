# Correctif — débloquer l'iframe Live Preview du hub CMS (swissalytics)

> À inclure dans une PR swissalytics. Rédigé le 2026-06-22.
> **Optionnel** : le preview fonctionne déjà via le bouton « Preview » du hub, qui
> ouvre le brouillon dans un **nouvel onglet** (pas une iframe → aucun header ne le
> bloque). Ce correctif active en plus l'aperçu **côte-à-côte dans l'admin**.

## Problème

L'admin du hub (`cms.pixelab.ch/admin`) charge le Live Preview dans une **iframe**
vers `swissalytics.com/blog/<slug>`. swissalytics répond `X-Frame-Options: SAMEORIGIN`
→ une origine tierce (le hub) ne peut pas le framer → iframe en erreur.

**Particularité swissalytics** : ce header n'est **ni dans le code, ni dans un nginx
du repo** (`next.config.js` n'a aucun `headers()`, pas de Dockerfile/nginx/vercel.json
versionnés). Il est posé **au niveau de l'hébergement** (reverse-proxy Jelastic /
plateforme). Et contrairement à helvee, **il n'y a pas de CSP `frame-ancestors`** —
donc une seule chose à traiter : `X-Frame-Options`, sur `/blog` uniquement.

> `/api/preview` n'a pas besoin d'être touché : c'est une redirection 307 vers
> `/blog/<slug>`, jamais un document rendu dans l'iframe.

---

## Étape 1 — Localiser la source du header (obligatoire avant d'écrire le fix)

Le header ne vient pas de Next. Confirmer et trouver où il est posé :

```bash
# Confirmer que Next ne le pose pas (aucun match attendu)
grep -rni "SAMEORIGIN\|X-Frame\|async headers" src next.config.js 2>/dev/null

# Sur l'hôte / dashboard Jelastic : chercher dans la config du reverse-proxy
#   grep -rni "x-frame-options\|same-origin\|add_header" /etc/nginx /opt/.../nginx 2>/dev/null
```

Selon où il est posé, appliquer **2a** (proxy d'hébergement) ou **2b** (déplacer la
gestion des headers dans l'app). **2a est le chemin normal** ici, puisque le header
est aujourd'hui hébergement.

---

## Étape 2a — Carve-out au niveau du reverse-proxy (chemin recommandé)

Si le header est posé par un nginx (Jelastic), même logique que helvee. ⚠️ Piège
nginx : un `add_header` dans une `location` annule l'héritage parent → redéclarer
les autres headers de sécurité éventuels, **sauf** `X-Frame-Options`, sur `/blog` :

```nginx
        # Blog : pas de X-Frame-Options → autorise l'iframe Live Preview du hub.
        location /blog {
            proxy_pass http://<upstream_app>;   # même upstream que la location /
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            # Redéclarer ici les autres add_header de sécurité présents au niveau
            # server (nosniff, Referrer-Policy, HSTS, …) — SAUF X-Frame-Options.
        }
```

> Si la plateforme ne sait poser `X-Frame-Options` que **globalement** (pas par
> chemin), passer la valeur globale de `SAMEORIGIN` à **non-posée** et laisser
> l'app gérer le framing via CSP (voir 2b) — sinon le header hôte écrasera l'app.

---

## Étape 2b — Alternative : gérer les headers dans `next.config.js`

À utiliser **seulement si** l'hébergement cesse de poser `X-Frame-Options`
globalement (sinon le header hôte gagne, le plus restrictif l'emporte). On ajoute
un `headers()` qui pose `frame-ancestors` partout (strict), assoupli sur `/blog` :

```js
  async headers() {
    const FRONT = "'self'";
    const HUB = "https://cms.pixelab.ch";
    return [
      // Blog : framing autorisé depuis le hub (frame-ancestors), pas de X-Frame-Options.
      {
        source: '/blog/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: `frame-ancestors ${FRONT} ${HUB}` },
        ],
      },
      // Tout le reste : framing interdit (équivalent strict de SAMEORIGIN/DENY).
      {
        source: '/((?!blog).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
```

> ⚠️ Si swissalytics a une CSP plus large par ailleurs, fusionner `frame-ancestors`
> dedans plutôt que de poser une CSP minimale (une CSP ne doit pas en écraser une
> autre). Ici le repo n'a aucune CSP → ce bloc minimal suffit.

---

## Multilingue (note)

Le blog est en `/blog` (fr) et `/blog/<slug>`. Si une variante **préfixée par la
langue** existe ou est ajoutée (ex. `/en/blog`), ajouter la source correspondante
(`'/:locale/blog/:path*'` ou `'/en/blog/:path*'`) au carve-out, sinon l'iframe
restera bloquée sur ces URLs.

---

## Vérification (après déploiement)

```bash
# /blog : plus de SAMEORIGIN, et frame-ancestors inclut le hub (si 2b)
curl -s -D - -o /dev/null https://swissalytics.com/blog | grep -iE "x-frame-options|frame-ancestors"
#   attendu : PAS de "x-frame-options: SAMEORIGIN" ; (2b) "frame-ancestors 'self' https://cms.pixelab.ch"

# Une route sensible reste verrouillée
curl -sI https://swissalytics.com/ | grep -i x-frame-options
#   attendu : header de framing restrictif (SAMEORIGIN ou DENY)
```

Puis, dans l'admin du hub, ouvrir un article `site=swissalytics` → l'onglet **Live
Preview** doit afficher l'iframe.

## Sécurité — ce qu'on change

On retire l'interdiction de framing **sur `/blog` seulement**, et **uniquement
pour le hub** (`cms.pixelab.ch`, origine de confiance — jamais `*`). `/blog` est du
contenu public, sans action ni session → rien à détourner par clickjacking. Toutes
les autres routes (analyseur, rapports, etc.) gardent un framing interdit.
Exposition résiduelle : négligeable.
