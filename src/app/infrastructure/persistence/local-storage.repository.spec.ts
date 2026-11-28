import { Entity } from '@domain/models';
import { clearLocalStorageData, flushPendingWrites, LocalStorageRepository, STORAGE_NAMESPACE } from './local-storage.repository';

interface Row extends Entity {
  readonly value: number;
}

const rows: Row[] = [
  { id: 'a', value: 1 },
  { id: 'b', value: 2 },
  { id: 'c', value: 3 },
];
const stored = () => JSON.parse(localStorage.getItem(`${STORAGE_NAMESPACE}rows`)!) as Row[];

describe('LocalStorageRepository: writes issued in the same tick', () => {
  let repository: LocalStorageRepository<Row>;

  beforeEach(async () => {
    clearLocalStorageData();
    repository = new LocalStorageRepository<Row>('rows', async () => [...rows]);
    await repository.getAll();
  });

  it('keeps every saved entity', async () => {
    await Promise.all([repository.save({ id: 'a', value: 10 }), repository.save({ id: 'b', value: 20 }), repository.save({ id: 'd', value: 40 })]);
    flushPendingWrites();
    expect(stored().map((r) => r.value)).toEqual([10, 20, 3, 40]);
  });

  it('applies every removal', async () => {
    await Promise.all([repository.remove('a'), repository.remove('b')]);
    flushPendingWrites();
    expect(stored().map((r) => r.id)).toEqual(['c']);
  });

  it('does not lose a save made alongside saveMany', async () => {
    await Promise.all([repository.save({ id: 'a', value: 10 }), repository.saveMany([{ id: 'b', value: 20 }])]);
    flushPendingWrites();
    expect(stored().map((r) => r.value)).toEqual([10, 20, 3]);
  });
});

describe('LocalStorageRepository: stored data that is not a list', () => {
  beforeEach(() => clearLocalStorageData());

  for (const raw of ['null', '{}', '5']) {
    it(`falls back to the seed for ${raw}`, async () => {
      localStorage.setItem(`${STORAGE_NAMESPACE}rows`, raw);
      const repository = new LocalStorageRepository<Row>('rows', async () => [...rows]);
      expect(await repository.getAll()).toEqual(rows);
    });
  }
});
