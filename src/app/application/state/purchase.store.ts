import { computed, inject, Injectable } from '@angular/core';
import {
  Attachment,
  EntityId,
  McdmCriterion,
  PurchaseRequest,
  PurchaseStage,
  PurchaseStageKey,
  SupplierContact,
  SupplierQuote,
} from '@domain/models';
import { PurchaseRepository } from '@domain/ports/repositories';
import { canSaveQuote, createPurchaseStages, DEFAULT_CRITERIA, Guard, nextSequence, todayIso } from '@domain/rules';
import { EntityStore, newId } from './entity-store';
import { TaskStore } from './task.store';

const EMPTY_QUOTE_DETAILS: Omit<SupplierQuote, 'id' | 'supplierId' | 'unitPrice' | 'leadTimeDays' | 'note'> = {
  receivedAt: null,
  channel: 'email',
  shippingCost: 0,
  paymentTerms: '',
  warranty: '',
  validUntil: null,
};

export type NewPurchase = Pick<PurchaseRequest, 'title' | 'projectId' | 'nodeId' | 'quantity' | 'unit' | 'priority'> &
  Partial<Pick<PurchaseRequest, 'materialId' | 'warehouseId'>>;

@Injectable({ providedIn: 'root' })
export class PurchaseStore extends EntityStore<PurchaseRequest> {
  protected readonly repository = inject(PurchaseRepository);
  private readonly tasks = inject(TaskStore);

  readonly byNode = computed(() => {
    const map = new Map<EntityId, PurchaseRequest>();
    for (const request of this.all()) if (request.nodeId) map.set(request.nodeId, request);
    return map;
  });

  readonly sorted = computed(() => [...this.all()].sort((a, b) => b.number.localeCompare(a.number)));

  create(data: NewPurchase): PurchaseRequest {
    const prefix = `PR-${new Date().getFullYear()}-`;
    const sequence = nextSequence(this.all().map((r) => r.number), prefix);
    return this.insert({
      materialId: null,
      warehouseId: null,
      ...data,
      id: newId('pr'),
      number: `${prefix}${String(sequence).padStart(3, '0')}`,
      supplierId: null,
      unitPrice: null,
      stages: createPurchaseStages(),
      contacts: [],
      quotes: [],
      mcdm: { criteria: [...DEFAULT_CRITERIA], scores: {} },
      eta: null,
      revisedEta: null,
      qualityResult: null,
      correctiveAction: '',
      createdAt: todayIso(),
    });
  }

  update(id: EntityId, changes: Partial<Omit<PurchaseRequest, 'id' | 'stages'>>): void {
    this.modify(id, changes);
  }

  updateStage(id: EntityId, key: PurchaseStageKey, changes: Partial<Omit<PurchaseStage, 'key'>>): void {
    this.modify(id, (request) => ({
      ...request,
      stages: request.stages.map((stage) => (stage.key === key ? { ...stage, ...changes } : stage)),
    }));
  }

  addStageAttachments(id: EntityId, key: PurchaseStageKey, attachments: readonly Attachment[]): void {
    this.modify(id, (request) => ({
      ...request,
      stages: request.stages.map((stage) =>
        stage.key === key ? { ...stage, attachments: [...stage.attachments, ...attachments] } : stage,
      ),
    }));
  }

  removeStageAttachment(id: EntityId, key: PurchaseStageKey, attachmentId: EntityId): void {
    this.modify(id, (request) => ({
      ...request,
      stages: request.stages.map((stage) =>
        stage.key === key ? { ...stage, attachments: stage.attachments.filter((a) => a.id !== attachmentId) } : stage,
      ),
    }));
  }

  protected override normalize(request: PurchaseRequest): PurchaseRequest {
    return {
      ...request,
      materialId: request.materialId ?? null,
      warehouseId: request.warehouseId ?? null,
      contacts: request.contacts ?? [],
      stages: request.stages.map((stage) => ({ ...stage, startDate: stage.startDate ?? null })),
      quotes: request.quotes.map((quote) => ({ ...EMPTY_QUOTE_DETAILS, ...quote })),
    };
  }

  /** Records the quote and marks the supplier's RFQ contact as replied. */
  addQuote(id: EntityId, quote: Omit<SupplierQuote, 'id'>): Guard {
    const guard = canSaveQuote(quote);
    if (!guard.allowed) return guard;
    this.modify(id, (request) => ({
      ...request,
      quotes: [...request.quotes, { ...quote, id: newId('q') }],
      contacts: request.contacts.map((c) => (c.supplierId === quote.supplierId ? { ...c, replied: true } : c)),
    }));
    return guard;
  }

  updateQuote(id: EntityId, quoteId: EntityId, changes: Partial<Omit<SupplierQuote, 'id' | 'supplierId'>>): Guard {
    const guard = canSaveQuote(changes);
    if (!guard.allowed) return guard;
    this.modify(id, (request) => ({
      ...request,
      quotes: request.quotes.map((q) => (q.id === quoteId ? { ...q, ...changes } : q)),
      ...(changes.unitPrice !== undefined && request.quotes.find((q) => q.id === quoteId)?.supplierId === request.supplierId
        ? { unitPrice: changes.unitPrice }
        : {}),
    }));
    return guard;
  }

  addContact(id: EntityId, contact: Omit<SupplierContact, 'id'>): void {
    this.modify(id, (request) => ({ ...request, contacts: [...request.contacts, { ...contact, id: newId('c') }] }));
  }

  updateContact(id: EntityId, contactId: EntityId, changes: Partial<Omit<SupplierContact, 'id'>>): void {
    this.modify(id, (request) => ({
      ...request,
      contacts: request.contacts.map((c) => (c.id === contactId ? { ...c, ...changes } : c)),
    }));
  }

  removeContact(id: EntityId, contactId: EntityId): void {
    this.modify(id, (request) => ({ ...request, contacts: request.contacts.filter((c) => c.id !== contactId) }));
  }

  removeQuote(id: EntityId, quoteId: EntityId): void {
    this.modify(id, (request) => {
      const { [quoteId]: _removed, ...scores } = request.mcdm.scores;
      const removedSupplier = request.quotes.find((q) => q.id === quoteId)?.supplierId;
      return {
        ...request,
        quotes: request.quotes.filter((q) => q.id !== quoteId),
        mcdm: { ...request.mcdm, scores },
        ...(removedSupplier === request.supplierId ? { supplierId: null, unitPrice: null } : {}),
      };
    });
  }

  setScore(id: EntityId, quoteId: EntityId, criterionId: EntityId, score: number): void {
    const value = Math.min(10, Math.max(0, Math.round(score) || 0));
    this.modify(id, (request) => ({
      ...request,
      mcdm: {
        ...request.mcdm,
        scores: { ...request.mcdm.scores, [quoteId]: { ...request.mcdm.scores[quoteId], [criterionId]: value } },
      },
    }));
  }

  setCriteria(id: EntityId, criteria: readonly McdmCriterion[]): void {
    this.modify(id, (request) => ({ ...request, mcdm: { ...request.mcdm, criteria } }));
  }

  /** Forgets a deleted warehouse as the destination of supply requests. */
  clearWarehouse(warehouseId: EntityId): void {
    this.all()
      .filter((request) => request.warehouseId === warehouseId)
      .forEach((request) => this.modify(request.id, { warehouseId: null }));
  }

  remove(id: EntityId): void {
    this.removeWhere((request) => request.id === id);
    this.tasks.unlinkPurchase(id);
  }
}
