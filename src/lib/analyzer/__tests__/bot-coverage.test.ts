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
