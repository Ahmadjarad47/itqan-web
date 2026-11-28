/**
 * Next free number among codes shaped `<prefix><digits>`: one above the highest in use.
 * Counting the records instead would repeat a number as soon as one of them is deleted.
 */
export function nextSequence(codes: readonly string[], prefix: string, start = 1): number {
  return codes.reduce((next, code) => {
    const tail = code.startsWith(prefix) ? code.slice(prefix.length) : '';
    return /^\d+$/.test(tail) ? Math.max(next, Number(tail) + 1) : next;
  }, start);
}
