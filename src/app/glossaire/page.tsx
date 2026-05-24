'use client';

import React from 'react';
import Shell from '@/components/design-system/Shell';
import { DisplayTitle } from '@/components/design-system/primitives';
import { useTheme } from '@/components/design-system/ThemeProvider';

type Entry = {
  n: string;
  term: string;
  def: string;
  why: string;
};

export default function GlossairePage() {
  const { lang } = useTheme();
  const isFr = lang === 'fr';

  const entries: Entry[] = isFr
    ? [
        {
          n: '01',
          term: 'SEO',
          def: "Search Engine Optimization — l'ensemble des pratiques qui améliorent la visibilité organique d'un site dans les moteurs de recherche. Couvre le technique, l'éditorial et l'autorité.",
          why: "La base de tout. Aucune autre discipline (GEO, AEO, paid) ne compense un mauvais SEO technique. Google le confirme en mai 2026 : le GEO et l'AEO sont du SEO.",
        },
        {
          n: '02',
          term: 'GEO — Generative Engine Optimization',
          def: "Terme marketing désignant l'optimisation pour les moteurs génératifs (ChatGPT, Perplexity, Gemini). Google le considère officiellement comme du SEO classique, pas une discipline séparée.",
          why: "Savoir ce que le mot recouvre évite de payer pour des hacks inutiles. Selon Google (mai 2026) : améliorer son SEO améliore mécaniquement sa présence dans les AI Overviews.",
        },
        {
          n: '03',
          term: 'AEO — Answer Engine Optimization',
          def: "Variante du GEO centrée sur la position de réponse directe (featured snippets, AI Overviews). Google classe également ce terme dans le SEO standard.",
          why: "Même logique que le GEO : pas de technique secrète, pas de fichier magique. Contenu clair, bien structuré, E-E-A-T solide — c'est tout.",
        },
        {
          n: '04',
          term: 'E-E-A-T',
          def: "Experience, Expertise, Authoritativeness, Trustworthiness — les quatre dimensions que Google évalue pour juger la qualité d'une page et de son auteur. Anciennement E-A-T, la double-E (Experience) a été ajoutée en 2022.",
          why: "L'E-E-A-T conditionne la confiance que Google accorde à votre contenu. Un médecin qui signe un article médical, un avocat qui rédige une page juridique — c'est l'E-E-A-T en pratique. Sans lui, un bon SEO technique ne suffit pas.",
        },
        {
          n: '05',
          term: 'Schema.org / JSON-LD',
          def: "Vocabulaire de balisage sémantique (Schema.org) encodé en JSON dans la balise <script> (JSON-LD). Permet aux moteurs de comprendre explicitement ce qu'est une entité : organisation, article, produit, avis, recette.",
          why: "Utile, pas magique. Google le considère comme un signal auxiliaire, non déterminant. Swissalytics l'audite car une erreur de schema.org (type incorrect, propriété manquante) peut bloquer les rich snippets.",
        },
        {
          n: '06',
          term: 'Core Web Vitals',
          def: "Les trois métriques de performance UX officiellement intégrées au ranking Google : LCP (Largest Contentful Paint — temps de chargement du contenu principal), CLS (Cumulative Layout Shift — stabilité visuelle) et INP (Interaction to Next Paint — réactivité, remplace FID depuis 2024).",
          why: "Ce sont des facteurs de classement confirmés. Un LCP > 2,5 s pénalise le ranking mobile. Un CLS > 0,1 indique une page instable qui dégrade l'expérience.",
        },
        {
          n: '07',
          term: 'TTFB — Time to First Byte',
          def: "Délai entre la requête HTTP et la réception du premier octet de la réponse serveur. Mesure la réactivité du serveur, du CDN et du backend.",
          why: "Un TTFB > 800 ms indique un problème serveur ou d'hébergement. Il précède le LCP — un mauvais TTFB plafonne tous les autres scores de performance.",
        },
        {
          n: '08',
          term: 'Crawlabilité',
          def: "Capacité d'un robot (Googlebot, GPTBot, etc.) à accéder aux pages d'un site. Un site peut être visible mais non crawlable si robots.txt, noindex ou des erreurs serveur bloquent l'exploration.",
          why: "Première condition de l'indexation. Si Googlebot ne peut pas crawler, rien d'autre n'a d'importance. Idem pour les bots IA : si GPTBot est bloqué, ChatGPT ne citera pas votre site.",
        },
        {
          n: '09',
          term: 'Indexation',
          def: "Processus par lequel Google (ou un autre moteur) enregistre une page dans sa base de données après l'avoir crawlée. Une page peut être crawlée sans être indexée (noindex, faible qualité, duplicate content).",
          why: "Indexé ≠ bien classé, mais non-indexé = invisible. L'audit Swissalytics vérifie balises noindex, canonical, sitemap et robots.txt pour identifier les fuites d'indexation.",
        },
        {
          n: '10',
          term: 'AI Overviews / AI Mode',
          def: "Fonctionnalités de Google Search qui génèrent une réponse synthétique en tête de page (AI Overviews) ou un mode conversationnel avancé (AI Mode). Alimentées par RAG (Retrieval-Augmented Generation) qui s'appuie sur le ranking SEO existant.",
          why: "Le trafic généré par ces fonctionnalités n'est pas mesurable séparément dans Search Console — il est fusionné dans le rapport Web. Améliorer son SEO reste le seul levier confirmé pour y apparaître.",
        },
        {
          n: '11',
          term: 'llms.txt',
          def: "Fichier texte expérimental (à la racine du site, ex. /llms.txt) censé indiquer aux LLM le contenu à prioriser. Non standardisé, non reconnu par Google comme facteur déterminant.",
          why: "À connaître pour déjouer le marketing. Google (mai 2026) le range explicitement parmi les hacks inutiles. Aucune preuve que GPTBot, ClaudeBot ou Googlebot le lisent de manière décisive. Un bonus optionnel au mieux.",
        },
        {
          n: '12',
          term: 'robots.txt',
          def: "Fichier texte à la racine du site qui indique aux robots quelles URLs ils peuvent crawler. Syntaxe : User-agent + Allow/Disallow. Ne garantit pas la non-indexation (pour ça, utiliser noindex).",
          why: "Levier direct sur la crawlabilité. Un robots.txt mal configuré peut bloquer Googlebot sur des sections entières — ou bloquer les bots IA (GPTBot, ClaudeBot) si votre stratégie l'exige.",
        },
        {
          n: '13',
          term: 'Sitemap XML',
          def: "Fichier qui liste les URLs du site avec leurs métadonnées (date de modification, fréquence, priorité). Soumis à Google Search Console pour faciliter le découverte des pages.",
          why: "Accélère l'indexation des nouvelles pages et clarifie la structure du site pour Googlebot. Obligatoire sur les grands sites, recommandé partout.",
        },
        {
          n: '14',
          term: 'Balise canonical',
          def: 'Attribut <link rel="canonical"> qui indique la version de référence d\'une page quand plusieurs URLs servent le même contenu. Évite la dilution de link equity et les pénalités duplicate content.',
          why: "Indispensable sur les sites e-commerce, les blogs avec pagination, ou tout site où les paramètres URL génèrent des variantes de page. Un canonical manquant ou incorrect peut fragmenter l'autorité d'une page.",
        },
        {
          n: '15',
          term: 'Métadonnées (title / description)',
          def: "Balises HTML <title> et <meta name=\"description\"> qui définissent le titre et le résumé d'une page dans les SERPs. Le title influe directement sur le classement ; la description influence le taux de clic.",
          why: "Le title est l'un des signaux SEO on-page les plus puissants. Une description bien écrite peut doubler le CTR sans changer le classement. Swissalytics audite la longueur, la présence des mots-clés et la duplication.",
        },
        {
          n: '16',
          term: 'Score de Flesch',
          def: "Indice de lisibilité (0–100) calculé à partir de la longueur moyenne des phrases et des mots. Adapté au français (formule Kandel-Moles). Plus le score est élevé, plus le texte est accessible.",
          why: "La lisibilité est un signal indirect de qualité. Un texte trop dense (score < 30) décourage la lecture et augmente le taux de rebond. Google favorise les contenus clairs, compréhensibles, orientés humains — pas rédigés pour une IA.",
        },
      ]
    : [
        {
          n: '01',
          term: 'SEO',
          def: "Search Engine Optimization — the set of practices that improve a site's organic visibility in search engines. Covers technical, editorial, and authority dimensions.",
          why: "The foundation of everything. No other discipline (GEO, AEO, paid) compensates for poor technical SEO. Google confirmed in May 2026: GEO and AEO are SEO.",
        },
        {
          n: '02',
          term: 'GEO — Generative Engine Optimization',
          def: "Marketing term for optimization targeting generative AI engines (ChatGPT, Perplexity, Gemini). Google officially classifies it as standard SEO, not a separate discipline.",
          why: "Knowing what the term actually covers protects you from useless hacks. Per Google (May 2026): improving your SEO mechanically improves your presence in AI Overviews.",
        },
        {
          n: '03',
          term: 'AEO — Answer Engine Optimization',
          def: "A GEO variant focused on the direct-answer position (featured snippets, AI Overviews). Google also classifies this term under standard SEO.",
          why: "Same logic as GEO: no secret technique, no magic file. Clear content, good structure, solid E-E-A-T — that's it.",
        },
        {
          n: '04',
          term: 'E-E-A-T',
          def: "Experience, Expertise, Authoritativeness, Trustworthiness — the four dimensions Google evaluates to judge page and author quality. Formerly E-A-T; the double-E (Experience) was added in 2022.",
          why: "E-E-A-T determines the trust Google grants your content. A doctor signing a medical article, a lawyer writing a legal page — that's E-E-A-T in practice. Without it, good technical SEO isn't enough.",
        },
        {
          n: '05',
          term: 'Schema.org / JSON-LD',
          def: "Semantic markup vocabulary (Schema.org) encoded as JSON inside a <script> tag (JSON-LD). Helps engines explicitly understand what an entity is: organization, article, product, review, recipe.",
          why: "Useful, not magic. Google treats it as an auxiliary signal, not a determining factor. Swissalytics audits it because a schema.org error (wrong type, missing property) can block rich snippets.",
        },
        {
          n: '06',
          term: 'Core Web Vitals',
          def: "The three UX performance metrics officially integrated into Google's ranking: LCP (Largest Contentful Paint — main content load time), CLS (Cumulative Layout Shift — visual stability), and INP (Interaction to Next Paint — responsiveness, replacing FID since 2024).",
          why: "These are confirmed ranking factors. LCP > 2.5s penalizes mobile rankings. CLS > 0.1 signals an unstable page that degrades user experience.",
        },
        {
          n: '07',
          term: 'TTFB — Time to First Byte',
          def: "Time between an HTTP request and the receipt of the first byte of the server response. Measures server, CDN, and backend responsiveness.",
          why: "TTFB > 800ms indicates a server or hosting problem. It precedes LCP — a poor TTFB caps all other performance scores.",
        },
        {
          n: '08',
          term: 'Crawlability',
          def: "The ability of a bot (Googlebot, GPTBot, etc.) to access a site's pages. A site can be live but uncrawlable if robots.txt, noindex tags, or server errors block exploration.",
          why: "The first condition for indexing. If Googlebot can't crawl, nothing else matters. Same for AI bots: if GPTBot is blocked, ChatGPT won't cite your site.",
        },
        {
          n: '09',
          term: 'Indexation',
          def: "The process by which Google (or another engine) records a page in its database after crawling it. A page can be crawled without being indexed (noindex, low quality, duplicate content).",
          why: "Indexed ≠ well-ranked, but non-indexed = invisible. Swissalytics audits noindex tags, canonical, sitemap, and robots.txt to identify indexation leaks.",
        },
        {
          n: '10',
          term: 'AI Overviews / AI Mode',
          def: "Google Search features that generate a synthesized answer at the top of the page (AI Overviews) or a conversational advanced mode (AI Mode). Powered by RAG (Retrieval-Augmented Generation) which relies on existing SEO ranking.",
          why: "Traffic from these features is not separately measurable in Search Console — it's merged into the Web report. Improving your SEO remains the only confirmed lever to appear in them.",
        },
        {
          n: '11',
          term: 'llms.txt',
          def: "An experimental text file (at the root of a site, e.g. /llms.txt) meant to tell LLMs which content to prioritize. Not standardized, not recognized by Google as a determining factor.",
          why: "Know it to debunk the marketing. Google (May 2026) explicitly lists it among useless hacks. No proof that GPTBot, ClaudeBot, or Googlebot reads it decisively. An optional bonus at best.",
        },
        {
          n: '12',
          term: 'robots.txt',
          def: "A text file at the root of a site that tells bots which URLs they can crawl. Syntax: User-agent + Allow/Disallow. Does not guarantee non-indexation (use noindex for that).",
          why: "A direct lever on crawlability. A misconfigured robots.txt can block Googlebot from entire sections — or block AI bots (GPTBot, ClaudeBot) if your strategy requires it.",
        },
        {
          n: '13',
          term: 'XML Sitemap',
          def: "A file listing the site's URLs with their metadata (modification date, frequency, priority). Submitted to Google Search Console to facilitate page discovery.",
          why: "Accelerates indexing of new pages and clarifies site structure for Googlebot. Required on large sites, recommended everywhere.",
        },
        {
          n: '14',
          term: 'Canonical tag',
          def: 'The <link rel="canonical"> attribute that designates the reference version of a page when multiple URLs serve the same content. Prevents link equity dilution and duplicate content penalties.',
          why: "Essential on e-commerce sites, blogs with pagination, or any site where URL parameters generate page variants. A missing or incorrect canonical can fragment a page's authority.",
        },
        {
          n: '15',
          term: 'Metadata (title / description)',
          def: 'The <title> and <meta name="description"> HTML tags that define a page\'s title and summary in SERPs. The title directly influences ranking; the description influences click-through rate.',
          why: "The title is one of the most powerful on-page SEO signals. A well-written description can double CTR without changing the ranking. Swissalytics audits length, keyword presence, and duplication.",
        },
        {
          n: '16',
          term: 'Flesch Score',
          def: "A readability index (0–100) calculated from average sentence and word length. French-adapted version uses the Kandel-Moles formula. Higher scores mean more accessible text.",
          why: "Readability is an indirect quality signal. Too-dense text (score < 30) discourages reading and raises bounce rate. Google favors clear, human-oriented content — not written for an AI.",
        },
      ];

  return (
    <Shell>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 24px' }}>
        {/* Kicker */}
        <div
          className="mono caption-red"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--sa-red)',
            marginBottom: 20,
          }}
        >
          § {isFr ? 'Glossaire SEO' : 'SEO Glossary'}
        </div>

        <DisplayTitle
          parts={
            isFr
              ? ['16 termes que', ['tout le monde utilise', { red: ',' }], ['personne ne définit', { red: '.' }]]
              : ['16 terms everyone uses', [', nobody defines', { red: '.' }]]
          }
          size="page"
        />

        <p
          style={{
            fontSize: 20,
            color: 'var(--sa-ink-2)',
            marginTop: 28,
            maxWidth: 720,
            lineHeight: 1.5,
          }}
        >
          {isFr
            ? "Du SEO au score de Flesch — les définitions nettes, sans jargon de vendeur, avec la raison concrète pour laquelle chaque terme change quelque chose à votre visibilité."
            : "From SEO to Flesch score — clean definitions, no vendor jargon, with the concrete reason each term changes something about your visibility."}
        </p>

        {/* Grid of entries */}
        <div
          style={{
            marginTop: 72,
            display: 'grid',
            gridTemplateColumns: '80px 1fr',
            gap: 0,
          }}
        >
          {entries.map((e) => (
            <React.Fragment key={e.n}>
              {/* Number column */}
              <div
                style={{
                  padding: '40px 0',
                  borderTop: '2px solid var(--sa-ink)',
                  borderRight: '1px solid var(--sa-rule)',
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--sa-red)',
                  }}
                >
                  §{e.n}
                </span>
              </div>

              {/* Content column */}
              <div
                style={{
                  padding: '40px 0 40px 40px',
                  borderTop: '2px solid var(--sa-ink)',
                }}
              >
                {/* Term */}
                <h2
                  className="h2"
                  style={{
                    fontSize: 26,
                    margin: '0 0 16px 0',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {e.term}
                </h2>

                {/* Definition */}
                <p
                  style={{
                    fontSize: 17,
                    lineHeight: 1.6,
                    color: 'var(--sa-ink-2)',
                    margin: '0 0 20px 0',
                    maxWidth: 720,
                  }}
                >
                  {e.def}
                </p>

                {/* Why it matters */}
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'var(--sa-red)',
                      paddingTop: 3,
                      flexShrink: 0,
                    }}
                  >
                    {isFr ? '→ Pourquoi ça compte' : '→ Why it matters'}
                  </span>
                  <p
                    className="mono"
                    style={{
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: 'var(--sa-ink-3)',
                      margin: 0,
                      maxWidth: 680,
                    }}
                  >
                    {e.why}
                  </p>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Footer note */}
        <div
          style={{
            marginTop: 80,
            paddingTop: 40,
            borderTop: '2px solid var(--sa-ink)',
          }}
        >
          <p
            className="mono"
            style={{
              fontSize: 12,
              color: 'var(--sa-ink-4)',
              lineHeight: 1.6,
              maxWidth: 720,
            }}
          >
            {isFr
              ? "Source de doctrine : guide officiel Google (15 mai 2026) — « Optimizing for Generative AI Features on Google Search ». Mis à jour à chaque évolution significative."
              : "Doctrine source: official Google guide (May 15, 2026) — \"Optimizing for Generative AI Features on Google Search\". Updated at each significant change."}
          </p>
        </div>
      </div>
    </Shell>
  );
}
