import { describe, it, expect } from 'vitest';
import { scoreQualifier } from '../scorecardQualifier';

describe('scoreQualifier', () => {
  it('>=80 → Solide', () => { expect(scoreQualifier(81, true).label).toBe('Solide'); });
  it('60-79 → Correct', () => { expect(scoreQualifier(63, true).label).toBe('Correct'); });
  it('<60 → À renforcer', () => { expect(scoreQualifier(58, true).label).toBe('À renforcer'); });
  it('null → état chargement', () => { expect(scoreQualifier(null, true).loading).toBe(true); });
  it('EN labels', () => { expect(scoreQualifier(81, false).label).toBe('Solid'); });
});
