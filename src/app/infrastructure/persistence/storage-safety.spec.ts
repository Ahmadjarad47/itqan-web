import { Entity } from '@domain/models';
import {
  clearLocalStorageData,
  flushPendingWrites,
  LocalStorageRepository,
  STORAGE_NAMESPACE,
  storageIssues,
} from './local-storage.repository';

const KEY = `${STORAGE_NAMESPACE}rows`;
const seed = async (): Promise<Entity[]> => [{ id: 'seed' }];
const backups = () => Object.keys(localStorage).filter((key) => key.startsWith(`${KEY}.corrupt-`));
const failWrites = () =>
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError');
  });

describe('LocalStorageRepository: unreadable or unwritable storage', () => {
  beforeEach(() => {
    clearLocalStorageData();
    storageIssues.set([]);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(['[{"id":"mine"', '{"id":"mine"}'])('keeps a copy of unreadable data %s before replacing it', async (raw) => {
    localStorage.setItem(KEY, raw);
    await new LocalStorageRepository('rows', seed).getAll();
    flushPendingWrites();
    expect(backups().map((key) => localStorage.getItem(key))).toEqual([raw]);
    expect(storageIssues()).toEqual([{ kind: 'corrupt', collection: 'rows' }]);
  });

  it('never overwrites unreadable data it could not back up', async () => {
    localStorage.setItem(KEY, '{broken');
    const spy = failWrites();
    const repository = new LocalStorageRepository('rows', seed);
    await repository.getAll();
    spy.mockRestore();
    await repository.save({ id: 'new' });
    flushPendingWrites();
    expect(localStorage.getItem(KEY)).toBe('{broken');
  });

  it('reports a failed write and clears the report once a write succeeds', async () => {
    const repository = new LocalStorageRepository('rows', seed);
    await repository.getAll();
    flushPendingWrites();
    const spy = failWrites();
    await repository.save({ id: 'a' });
    flushPendingWrites();
    expect(storageIssues()).toEqual([{ kind: 'write', collection: 'rows' }]);
    spy.mockRestore();
    await repository.save({ id: 'b' });
    flushPendingWrites();
    expect(storageIssues()).toEqual([]);
  });
});
