'use client';

import React from 'react';
import Shell from '@/components/design-system/Shell';
import { DisplayTitle } from '@/components/design-system/primitives';
import { useTheme } from '@/components/design-system/ThemeProvider';

type Block = {
  n: string;
  h: string;
  body: string;
  aside: string;
};

type Principle = {
  label: string;
  detail: string;
};

/* ─── FR copy ─────────────────────────────────────────────────────────── */

const positionBlocksFr: Block[] = [
  {
    n: '01',
    h: "GEO, AEO, AI SEO — c’est du SEO.",
    body: "Le 15 mai 2026, Google publie son premier guide officiel sur l’optimisation pour les fonctionnalités IA de Search. Conclusion première et sans ambiguïté : « AEO et GEO sont toujours du SEO. » Les moteurs génératifs (AI Overviews, AI Mode) s’appuient sur RAG — Retrieval-Augmented Generation — qui lui-même s’appuie sur le ranking organique classique. Améliorer votre SEO, c’est mécaniquement améliorer votre présence dans les réponses IA.",
    aside: 'Google Search Central · 15 mai 2026',
  },
  {
    n: '02',
    h: "Pourquoi le marché a quand même inventé le GEO",
    body: "Parce qu’il y a de l’argent à vendre une nouvelle discipline. « GEO specialist », « AI search optimizer », « llms.txt expert » — les prestataires ont trois longueurs d’avance sur Google officiel. Le problème : leur stock de hacks (chunking, sur-structuration schema, llms.txt, réécriture AI-first) est explicitement invalidé par Google dans ce même guide.",
    aside: 'Marketing vs doctrine',
  },
  {
    n: '03',
    h: "Le trafic IA n’est pas mesurable séparément",
    body: "Search Console > Performance > Web : le trafic des AI Overviews et d’AI Mode est fusionné dans les métriques Web globales. Il n’existe pas de dimension séparée, pas d’API GSC dédiée. Quiconque vous promet « voir ton trafic IA Overviews » vous vend un proxy ou une estimation — pas une mesure directe.",
    aside: 'Limite confirmée par Google',
  },
];

const positionBlocksEn: Block[] = [
  {
    n: '01',
    h: "GEO, AEO, AI SEO — it’s SEO.",
    body: "On May 15, 2026, Google published its first official guide on optimizing for AI features in Search. The opening conclusion, unambiguous: “AEO and GEO are still SEO.” Generative engines (AI Overviews, AI Mode) use RAG — Retrieval-Augmented Generation — which itself relies on classic organic ranking. Improving your SEO mechanically improves your presence in AI-generated answers.",
    aside: 'Google Search Central · May 15 2026',
  },
  {
    n: '02',
    h: "Why the market invented GEO anyway",
    body: "Because there’s money in selling a new discipline. “GEO specialist”, “AI search optimizer”, “llms.txt expert” — vendors are always three steps ahead of official Google. The problem: their toolkit of hacks (chunking, over-structured schema, llms.txt, AI-first rewriting) is explicitly invalidated by Google in that same guide.",
    aside: 'Marketing vs doctrine',
  },
  {
    n: '03',
    h: "AI traffic is not separately measurable",
    body: "Search Console > Performance > Web: AI Overviews and AI Mode traffic is merged into the global Web metrics. No separate dimension, no dedicated GSC API. Anyone promising to “show you your AI Overviews traffic” is selling a proxy or an estimate — not a direct measurement.",
    aside: 'Confirmed limitation by Google',
  },
];

const worksBlocksFr: Block[] = [
  {
    n: '04',
    h: 'Contenu de valeur, non-commodité',
    body: "Google insiste : un point de vue unique, une expertise réelle, une expérience vécue. Pas de contenu générique reformulé. Pas de 1 500 mots de remplissage optimisé pour un mot-clé. Les AI Overviews citent les sources qui ont quelque chose à dire que les autres n’ont pas dit. C’est aussi ce que Swissalytics mesure avec le score de densité sémantique et le Flesch.",
    aside: 'People-first content',
  },
  {
    n: '05',
    h: 'Fondations techniques solides',
    body: "Core Web Vitals (LCP < 2,5 s, CLS < 0,1, INP < 200 ms), TTFB correct, HTML sémantique, pas de contenu masqué côté client que Googlebot ne verra pas, zéro duplication canonique non résolue. Ce sont les prérequis que Google cite explicitement. Pas de raccourci.",
    aside: 'Performance · structure · accessibilité',
  },
  {
    n: '06',
    h: "E-E-A-T — surtout l’expérience et l’autorité",
    body: "Auteur identifiable, biographie, signaux d’expertise dans le corps du texte (dates, sources citées, études référencées). Pages About / Équipe à jour. Pour les sujets YMYL (santé, finance, droit) : crédentiels vérifiables. L’E-E-A-T n’est pas un formulaire à remplir, c’est une réputation à bâtir.",
    aside: 'Experience · Expertise · Authoritativeness · Trustworthiness',
  },
  {
    n: '07',
    h: 'Crawlabilité — y compris pour les bots IA',
    body: "Votre robots.txt autorise-t-il GPTBot, ClaudeBot, PerplexityBot ? Si ces crawlers sont bloqués, ChatGPT, Claude et Perplexity ne verront pas votre site — indépendamment de la qualité de votre contenu. Swissalytics audite le statut de chaque crawler IA dans votre robots.txt. C’est un contrôle binaire, concret, sans hack.",
    aside: 'GPTBot · ClaudeBot · PerplexityBot · Google-Extended',
  },
];

const worksBlocksEn: Block[] = [
  {
    n: '04',
    h: 'Valuable, non-commodity content',
    body: "Google insists: a unique point of view, real expertise, lived experience. Not generic reformulated content. Not 1,500 words of keyword-stuffed filler. AI Overviews cite sources that have something to say others haven’t said. This is also what Swissalytics measures with its semantic density score and Flesch readability.",
    aside: 'People-first content',
  },
  {
    n: '05',
    h: 'Strong technical foundations',
    body: "Core Web Vitals (LCP < 2.5s, CLS < 0.1, INP < 200ms), solid TTFB, semantic HTML, no client-side hidden content Googlebot won’t see, zero unresolved canonical duplication. These are the prerequisites Google explicitly cites. No shortcut.",
    aside: 'Performance · structure · accessibility',
  },
  {
    n: '06',
    h: 'E-E-A-T — especially experience and authority',
    body: "Identifiable author, biography, expertise signals in the body text (dates, cited sources, referenced studies). Up-to-date About/Team pages. For YMYL topics (health, finance, law): verifiable credentials. E-E-A-T isn’t a form to fill out — it’s a reputation to build.",
    aside: 'Experience · Expertise · Authoritativeness · Trustworthiness',
  },
  {
    n: '07',
    h: 'Crawlability — including for AI bots',
    body: "Does your robots.txt allow GPTBot, ClaudeBot, PerplexityBot? If those crawlers are blocked, ChatGPT, Claude, and Perplexity won’t see your site — regardless of your content quality. Swissalytics audits the status of each AI crawler in your robots.txt. A binary, concrete check, no hack required.",
    aside: 'GPTBot · ClaudeBot · PerplexityBot · Google-Extended',
  },
];

const doesNotWorkFr: Principle[] = [
  {
    label: 'llms.txt comme facteur déterminant',
    detail: "Google le classe explicitement dans les hacks inutiles. Non standardisé, non reconnu. Au mieux un bonus optionnel — pas une priorité, pas un critère d’audit.",
  },
  {
    label: 'Chunking du contenu pour les IA',
    detail: "Découper le contenu en petits blocs censément optimisés pour le RAG. Google invalide cette approche. Un bon contenu narratif, bien structuré pour les humains, performe mieux.",
  },
  {
    label: 'Sur-structuration schema.org',
    detail: "Empiler des types schema.org (FAQ, HowTo, Speakable…) au-delà du raisonnable pour « plaire aux LLM ». Google dit que le schema.org est utile, pas déterminant — et que l’excès n’apporte rien.",
  },
  {
    label: "Réécriture du contenu pour l’IA",
    detail: "Reformuler le contenu en style « réponse directe » ou « format d’entraînement LLM ». Google est sans ambiguïté : les contenus human-first surclassent les contenus AI-first dans les AI features.",
  },
  {
    label: 'Mentions inauthentiques',
    detail: "Se faire mentionner en échange de liens, de témoignages factices, ou de citations construites. Google dispose des signaux pour détecter l’inauthenticité. L’E-E-A-T ne se génère pas.",
  },
];

const doesNotWorkEn: Principle[] = [
  {
    label: 'llms.txt as a determining factor',
    detail: "Google explicitly classifies it as a useless hack. Not standardized, not recognized. An optional bonus at best — not a priority, not an audit criterion.",
  },
  {
    label: 'Content chunking for AI',
    detail: "Breaking content into small blocks supposedly optimized for RAG. Google invalidates this approach. Well-structured, human-first narrative content performs better.",
  },
  {
    label: 'Over-structuring schema.org',
    detail: "Stacking schema.org types (FAQ, HowTo, Speakable…) beyond reason to “please LLMs”. Google says schema.org is useful, not determining — and excess adds nothing.",
  },
  {
    label: 'Rewriting content for AI',
    detail: "Reformatting content in a “direct answer” or “LLM training format” style. Google is unambiguous: human-first content outperforms AI-first content in AI features.",
  },
  {
    label: 'Inauthentic mentions',
    detail: "Getting mentioned in exchange for links, fake testimonials, or constructed citations. Google has signals to detect inauthenticity. E-E-A-T cannot be generated.",
  },
];

/* ─── Component ────────────────────────────────────────────────────────── */

export default function GuideGeoPage() {
  const { lang } = useTheme();
  const isFr = lang === 'fr';

  const positionBlocks = isFr ? positionBlocksFr : positionBlocksEn;
  const worksBlocks = isFr ? worksBlocksFr : worksBlocksEn;
  const doesNotWork = isFr ? doesNotWorkFr : doesNotWorkEn;

  return (
    <Shell>
      <div className="geo-wrap" style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 24px' }}>
        {/* Kicker */}
        <div
          className="mono"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--sa-red)',
            marginBottom: 20,
          }}
        >
          {isFr ? '§ Guide GEO — doctrine Google mai 2026' : '§ GEO Guide — Google doctrine May 2026'}
        </div>

        <DisplayTitle
          parts={
            isFr
              ? ['GEO :', ["c’est du SEO", { red: '.' }], ["Voici ce que Google dit", ['vraiment', { red: '.' }]]]
              : ['GEO is SEO', { red: '.' }, ["Here’s what Google", ['actually says', { red: '.' }]]]
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
            ? "Guide basé sur la doctrine officielle de Google publiée le 15 mai 2026. Ce qui marche vraiment, ce qui ne marche pas, et la limite honnête à connaître sur la mesure du trafic IA."
            : "Guide based on Google’s official doctrine published May 15, 2026. What actually works, what doesn’t, and the honest limitation to know about AI traffic measurement."}
        </p>

        {/* §01–03 La position de Google */}
        <SectionLabel
          isFr={isFr}
          fr="§ La position de Google"
          en="§ Google’s position"
          top={72}
        />
        <SectionGrid blocks={positionBlocks} isFr={isFr} />

        {/* §04–07 Ce qui marche */}
        <SectionLabel
          isFr={isFr}
          fr="§ Ce qui marche — confirmé par Google"
          en="§ What works — confirmed by Google"
          top={64}
        />
        <SectionGrid blocks={worksBlocks} isFr={isFr} />

        {/* §08 Ce qui NE marche PAS */}
        <div style={{ marginTop: 64 }}>
          <SectionLabel
            isFr={isFr}
            fr="§ Ce qui NE marche PAS — invalidé par Google"
            en="§ What does NOT work — invalidated by Google"
            top={0}
          />

          <div
            className="geo-dnw"
            style={{
              background: 'var(--sa-cream-2)',
              border: '2px solid var(--sa-ink)',
              padding: '32px 40px',
              marginTop: 32,
            }}
          >
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: 'var(--sa-ink-2)',
                margin: '0 0 24px 0',
                maxWidth: 720,
              }}
            >
              {isFr
                ? "Les pratiques suivantes sont explicitement listées par Google comme inutiles ou contre-productives. Elles ne font pas partie du score Swissalytics — et ne devraient pas figurer dans votre plan d’action."
                : "The following practices are explicitly listed by Google as useless or counterproductive. They are not part of the Swissalytics score — and should not appear in your action plan."}
            </p>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {doesNotWork.map((p, i) => (
                <li
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '20px 1fr',
                    gap: '0 16px',
                    paddingBottom: 20,
                    marginBottom: 20,
                    borderBottom: i < doesNotWork.length - 1 ? '1px solid var(--sa-rule)' : 'none',
                  }}
                >
                  <span
                    style={{
                      color: 'var(--sa-red)',
                      fontWeight: 700,
                      fontSize: 16,
                      lineHeight: 1.4,
                      paddingTop: 1,
                    }}
                  >
                    {'✕'}
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: 'var(--sa-ink)',
                        marginBottom: 6,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {p.label}
                    </div>
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
                      {p.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* La limite */}
        <div
          style={{
            marginTop: 64,
            paddingTop: 40,
            borderTop: '2px solid var(--sa-ink)',
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--sa-ink-4)',
              marginBottom: 20,
            }}
          >
            {isFr
              ? '§ La limite — ce qu’on ne peut pas mesurer'
              : '§ The limit — what cannot be measured'}
          </div>

          <h2
            className="h2"
            style={{
              fontSize: 28,
              margin: '0 0 16px 0',
              letterSpacing: '-0.02em',
            }}
          >
            {isFr
              ? "Le trafic IA n’est pas isolable dans Search Console."
              : "AI traffic cannot be isolated in Search Console."}
          </h2>

          <p
            style={{
              fontSize: 17,
              lineHeight: 1.6,
              color: 'var(--sa-ink-2)',
              margin: '0 0 24px 0',
              maxWidth: 720,
            }}
          >
            {isFr
              ? "Google le confirme dans sa documentation officielle (mai 2026) : les clics et impressions générés par AI Overviews et AI Mode sont inclus dans le rapport « Web » de Search Console — sans breakdown séparé, sans dimension dédiée dans l’API GSC. Pas de filtre. Pas de segment. Pas de mesure directe."
              : "Google confirms it in its official documentation (May 2026): clicks and impressions generated by AI Overviews and AI Mode are included in the Search Console “Web” report — with no separate breakdown, no dedicated GSC API dimension. No filter. No segment. No direct measurement."}
          </p>

          <p
            className="mono"
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--sa-ink-3)',
              margin: 0,
              maxWidth: 720,
            }}
          >
            {isFr
              ? "Ce que vous pouvez faire : surveiller les tendances globales de trafic organique, monitorer manuellement vos citations dans ChatGPT et Perplexity, et auditer régulièrement que Googlebot et les bots IA peuvent crawler vos pages. C’est ce que Swissalytics vérifie."
              : "What you can do: monitor global organic traffic trends, manually track your citations in ChatGPT and Perplexity, and regularly audit that Googlebot and AI bots can crawl your pages. That’s what Swissalytics checks."}
          </p>
        </div>

        {/* Footer note */}
        <div
          style={{
            marginTop: 64,
            paddingTop: 32,
            borderTop: '1px solid var(--sa-rule)',
          }}
        >
          <p
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--sa-ink-4)',
              lineHeight: 1.6,
              maxWidth: 720,
            }}
          >
            {isFr
              ? "Sources : Google Search Central — « Google’s Guide to Optimizing for Generative AI Features on Google Search » (15 mai 2026) · « AI Features and Your Website » · Search Engine Journal, Search Engine Land (validation interprétation)."
              : "Sources: Google Search Central — “Google’s Guide to Optimizing for Generative AI Features on Google Search” (May 15, 2026) · “AI Features and Your Website” · Search Engine Journal, Search Engine Land (interpretation validation)."}
          </p>
        </div>

        <style>{`
          @media (max-width: 1024px){
            .geo-grid{ grid-template-columns:1fr 200px !important; }
            .geo-num{ grid-column:1 / -1 !important; padding:32px 0 0 0 !important; border-right:0 !important; }
            .geo-num + .geo-body{ border-top:0 !important; padding-top:12px !important; }
            .geo-aside{ border-top:0 !important; padding-top:12px !important; }
          }
          @media (max-width: 640px){
            .geo-wrap{ padding:48px 20px !important; }
            .geo-grid{ grid-template-columns:1fr !important; }
            .geo-body{ padding:8px 0 24px 0 !important; border-right:0 !important; }
            .geo-body h2{ font-size:22px !important; }
            .geo-aside{ padding:0 0 8px 0 !important; }
            .geo-dnw{ padding:24px 20px !important; }
          }
        `}</style>
      </div>
    </Shell>
  );
}

/* ─── Sub-components ───────────────────────────────────────────────────── */

function SectionLabel({
  isFr,
  fr,
  en,
  top,
}: {
  isFr: boolean;
  fr: string;
  en: string;
  top: number;
}) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--sa-red)',
        marginTop: top,
        marginBottom: 0,
      }}
    >
      {isFr ? fr : en}
    </div>
  );
}

function SectionGrid({ blocks, isFr }: { blocks: Block[]; isFr: boolean }) {
  return (
    <div
      className="geo-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr 220px',
        gap: 0,
      }}
    >
      {blocks.map((b) => (
        <React.Fragment key={b.n}>
          {/* Number */}
          <div
            className="geo-num"
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
              {'§'}{b.n}
            </span>
          </div>

          {/* Body */}
          <div
            className="geo-body"
            style={{
              padding: '40px 40px 40px 32px',
              borderTop: '2px solid var(--sa-ink)',
              borderRight: '1px solid var(--sa-rule)',
            }}
          >
            <h2
              className="h2"
              style={{
                fontSize: 26,
                margin: '0 0 16px 0',
                letterSpacing: '-0.02em',
              }}
            >
              {b.h}
            </h2>
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.6,
                color: 'var(--sa-ink-2)',
                margin: 0,
                maxWidth: 580,
              }}
            >
              {b.body}
            </p>
          </div>

          {/* Aside */}
          <div
            className="geo-aside"
            style={{
              padding: '40px 0 40px 32px',
              borderTop: '2px solid var(--sa-ink)',
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--sa-ink-4)',
                marginBottom: 8,
              }}
            >
              {isFr ? 'Référence' : 'Reference'}
            </div>
            <div
              className="mono"
              style={{
                fontSize: 12,
                color: 'var(--sa-ink-3)',
                lineHeight: 1.6,
              }}
            >
              {b.aside}
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
