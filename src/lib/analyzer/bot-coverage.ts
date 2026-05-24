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

interface Rule {
  type: 'allow' | 'disallow';
  path: string;
}

interface Group {
  agents: string[];
  rules: Rule[];
}

function parseGroups(txt: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const raw of txt.split('\n')) {
    // Strip inline comments and trim
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) {
      // Blank line resets the "last was agent" state so that the next
      // User-agent starts a new group even if no rules were emitted yet.
      lastWasAgent = false;
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const field = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === 'allow' || field === 'disallow') {
      if (current) {
        current.rules.push({ type: field, path: value });
      }
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }

  return groups;
}

/**
 * Resolve the effective status for a given bot name against the parsed groups.
 *
 * Site-level semantics: we evaluate rules against the root URL "/".
 * A rule only affects "/" if its path is a prefix of "/" — i.e. path is "" or "/".
 * Path-specific rules like /wp-admin/, /private, /cart do NOT affect the root.
 *
 * Precedence:
 *  1. A specific group for this agent wins over the wildcard (*) group.
 *  2. Within a group: rules are evaluated against the root path "/".
 *     A rule matches "/" iff rule.path === '' || '/'.startsWith(rule.path).
 *  3. Among matching rules: longest path wins.
 *  4. At equal path length: Allow beats Disallow.
 *  5. An empty Disallow ("Disallow:") means "allow everything".
 *  6. If no rule matches "/" → allowed (root is open; path-specific disallows
 *     are irrelevant to site-level access).
 */
function resolveStatus(agentName: string, groups: Group[]): BotStatus {
  const a = agentName.toLowerCase();
  const specific = groups.find((g) => g.agents.includes(a));
  const wildcard = groups.find((g) => g.agents.includes('*'));

  // Choose which group applies: specific overrides wildcard.
  const group = specific ?? wildcard;
  if (!group) return 'unmentioned';

  // A group with no rules and a specific entry → effectively "allowed" (no restriction).
  if (group.rules.length === 0) {
    return specific ? 'allowed' : 'unmentioned';
  }

  // Evaluate rules against the root path "/".
  // A rule matches "/" iff its path is a prefix of "/" — only "" or "/" qualify.
  const ROOT = '/';
  let bestLen = -1;
  let bestType: 'allow' | 'disallow' | null = null;

  for (const rule of group.rules) {
    // Only consider rules whose path is a prefix of the root URL.
    if (rule.path !== '' && !ROOT.startsWith(rule.path)) {
      continue;
    }

    const pathLen = rule.path.length;

    // A Disallow with an empty path = "allow everything" — treat as allow.
    const effectiveType: 'allow' | 'disallow' =
      rule.type === 'disallow' && rule.path === '' ? 'allow' : rule.type;

    if (pathLen > bestLen) {
      bestLen = pathLen;
      bestType = effectiveType;
    } else if (pathLen === bestLen && effectiveType === 'allow') {
      // Allow wins ties.
      bestType = 'allow';
    }
  }

  // No rule matched "/" → root is open; site-level access is allowed.
  if (bestType === null) return 'allowed';
  return bestType === 'disallow' ? 'blocked' : 'allowed';
}

export function parseRobotsForAiBots(robotsTxt: string | undefined): BotResult[] {
  if (!robotsTxt) {
    return AI_BOTS.map((b) => ({ name: b.name, crawls: b.crawls, status: 'unmentioned' as const }));
  }

  const groups = parseGroups(robotsTxt);

  return AI_BOTS.map((b) => {
    const hasSpecific = groups.some((g) => g.agents.includes(b.name.toLowerCase()));
    const hasWildcard = groups.some((g) => g.agents.includes('*'));

    // If neither a specific block nor a wildcard block mentions this bot → unmentioned.
    if (!hasSpecific && !hasWildcard) {
      return { name: b.name, crawls: b.crawls, status: 'unmentioned' as const };
    }

    const status = resolveStatus(b.name, groups);
    return { name: b.name, crawls: b.crawls, status };
  });
}
