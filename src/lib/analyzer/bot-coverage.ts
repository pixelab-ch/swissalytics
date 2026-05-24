export type BotStatus = 'allowed' | 'blocked' | 'unmentioned';

export interface AiBot {
  name: string;
}

/** Ordered list of known AI bots. The display description is resolved in the UI layer. */
export const AI_BOTS: AiBot[] = [
  { name: 'Googlebot' },
  { name: 'GPTBot' },
  { name: 'ClaudeBot' },
  { name: 'PerplexityBot' },
  { name: 'Google-Extended' },
  { name: 'CCBot' },
];

export interface BotResult {
  name: string;
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
 * A rule only affects "/" if its normalised path is a prefix of "/" — i.e. "" or "/".
 * Path-specific rules like /wp-admin/, /private, /cart do NOT affect the root.
 *
 * Normalisation (applied before the prefix test):
 *  - Strip a trailing `*` (e.g. `/*` → `/`, `*` → ``)
 *  - Strip a trailing `$` (e.g. `/$` → `/`)
 * This means `/*`, `*`, and `/$` all resolve to root matches.
 *
 * Precedence:
 *  1. A specific group for this agent wins over the wildcard (*) group.
 *  2. Within a group: rules are evaluated against the root path "/".
 *     A rule matches "/" iff norm === '' || '/'.startsWith(norm).
 *  3. Among matching rules: longest normalised path wins.
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
  // Normalise each rule's path before the prefix check:
  //   strip a trailing `*` (glob wildcard) and a trailing `$` (Google end-anchor).
  //   e.g.  `/*` → `/`,  `*` → ``,  `/$` → `/`
  // A rule matches "/" iff norm === '' || '/'.startsWith(norm).
  const ROOT = '/';
  let bestLen = -1;
  let bestType: 'allow' | 'disallow' | null = null;

  for (const rule of group.rules) {
    const norm = rule.path.replace(/\*+$/, '').replace(/\$$/, '');

    // Only consider rules whose normalised path is a prefix of the root URL.
    if (norm !== '' && !ROOT.startsWith(norm)) {
      continue;
    }

    const pathLen = norm.length;

    // A Disallow with an empty (original) path = "allow everything" — treat as allow.
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

/**
 * Parse a robots.txt string and return the site-level reachability of the root
 * path `/` for each known AI bot.
 *
 * Contract:
 *  - Only the root path `/` is evaluated (site-level signal). Path-specific rules
 *    (e.g. `Disallow: /admin`) and in-path wildcards (e.g. `Disallow: /*.pdf`)
 *    are intentionally ignored because they do not block the site as a whole.
 *  - Trailing `*` and `$` in rule paths are normalised away before the root test
 *    (`/*` → `/`, `*` → ``, `/$` → `/`), so common whole-site blocks are detected.
 *  - Agent names are matched exactly (case-insensitive); no prefix matching.
 */
export function parseRobotsForAiBots(robotsTxt: string | undefined): BotResult[] {
  if (!robotsTxt) {
    return AI_BOTS.map((b) => ({ name: b.name, status: 'unmentioned' as const }));
  }

  const groups = parseGroups(robotsTxt);

  return AI_BOTS.map((b) => {
    const hasSpecific = groups.some((g) => g.agents.includes(b.name.toLowerCase()));
    const hasWildcard = groups.some((g) => g.agents.includes('*'));

    // If neither a specific block nor a wildcard block mentions this bot → unmentioned.
    if (!hasSpecific && !hasWildcard) {
      return { name: b.name, status: 'unmentioned' as const };
    }

    const status = resolveStatus(b.name, groups);
    return { name: b.name, status };
  });
}
