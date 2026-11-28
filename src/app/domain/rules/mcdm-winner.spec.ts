import { isMcdmWinner } from './mcdm';

describe('MCDM winner mark', () => {
  it('crowns the top scored quotation', () => {
    expect(isMcdmWinner({ quoteId: 'a', score: 70, rank: 1 })).toBe(true);
    expect(isMcdmWinner({ quoteId: 'b', score: 60, rank: 2 })).toBe(false);
  });

  it('crowns nothing while quotations are unscored', () => {
    expect(isMcdmWinner({ quoteId: 'a', score: 0, rank: 1 })).toBe(false);
    expect(isMcdmWinner(undefined)).toBe(false);
  });
});
