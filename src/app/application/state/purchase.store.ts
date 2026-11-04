import { computed, inject, Injectable } from '@angular/core';
import {
  Attachment,
  EntityId,
  McdmCriterion,
  PurchaseRequest,
  PurchaseStage,
  PurchaseStageKey,
  SupplierQuote,
} from '@domain/models';
import { PurchaseRepository } from '@domain/ports/repositories';
import { createPurchaseStages, DEFAULT_CRITERIA, todayIso } from '@domain/rules';
import { EntityStore, newId } from './entity-store';

export type NewPurchase = Pick<PurchaseRequest, 'title' | 'projectId' | 'nodeId' | 'quantity' | 'unit' | 'priority'>;

@Injectable({ providedIn: 'root' })
export class PurchaseStore extends EntityStore<PurchaseRequest> {
  protected readonly repository = inject(PurchaseRepository);

  readonly byNode = computed(() => {
    const map = new Map<EntityId, PurchaseRequest>();
    for (const request of this.all()) if (request.nodeId) map.set(request.nodeId, request);
    return map;
  });

  readonly sorted = computed(() => [...this.all()].sort((a, b) => b.number.localeCompare(a.number)));

  create(data: NewPurchase): PurchaseRequest {
    const sequence = this.all().length + 1;
    return this.insert({
      ...data,
      id: newId('pr'),
      number: `PR-${new Date().getFullYear()}-${String(sequence).padStart(3, '0')}`,
      supplierId: null,
      unitPrice: null,
      stages: createPurchaseStages(),
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

  addQuote(id: EntityId, quote: Omit<SupplierQuote, 'id'>): void {
    this.modify(id, (request) => ({ ...request, quotes: [...request.quotes, { ...quote, id: newId('q') }] }));
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

  remove(id: EntityId): void {
    this.removeWhere((request) => request.id === id);
  }
}
