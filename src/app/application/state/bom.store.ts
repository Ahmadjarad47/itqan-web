import { computed, inject, Injectable } from '@angular/core';
import { Attachment, BomNode, EntityId, MaterialAssignment } from '@domain/models';
import { BomNodeRepository } from '@domain/ports/repositories';
import { BomTree, todayIso } from '@domain/rules';
import { EntityStore, newId } from './entity-store';

export type NewBomNode = Pick<BomNode, 'name' | 'discipline' | 'quantity' | 'unit'> &
  Partial<Pick<BomNode, 'description' | 'code' | 'image' | 'ownerId'>>;

@Injectable({ providedIn: 'root' })
export class BomStore extends EntityStore<BomNode> {
  protected readonly repository = inject(BomNodeRepository);

  readonly tree = computed(() => new BomTree(this.all()));

  protected override normalize(node: BomNode): BomNode {
    return { ...node, ownerId: node.ownerId ?? null };
  }

  addChild(parentId: EntityId, data: NewBomNode): BomNode {
    const parent = this.find(parentId)!;
    return this.insert({
      id: newId('n'),
      projectId: parent.projectId,
      parentId,
      code: data.code?.trim() || this.nextChildCode(parentId),
      name: data.name,
      description: data.description ?? '',
      discipline: data.discipline,
      ownerId: data.ownerId ?? null,
      quantity: data.quantity,
      unit: data.unit,
      image: data.image ?? null,
      decision: null,
      purchaseUnitPrice: null,
      attachments: [],
      materials: [],
      createdAt: todayIso(),
    });
  }

  createRoot(projectId: EntityId, data: NewBomNode & { code: string }): BomNode {
    return this.insert({
      id: newId('n'),
      projectId,
      parentId: null,
      code: data.code,
      name: data.name,
      description: data.description ?? '',
      discipline: data.discipline,
      ownerId: data.ownerId ?? null,
      quantity: 1,
      unit: 'pcs',
      image: data.image ?? null,
      decision: 'make',
      purchaseUnitPrice: null,
      attachments: [],
      materials: [],
      createdAt: todayIso(),
    });
  }

  /** Suggests a hierarchical code such as ATL-2.3.1 for a new child. */
  nextChildCode(parentId: EntityId): string {
    const tree = this.tree();
    const parent = tree.node(parentId)!;
    const index = tree.children(parentId).length + 1;
    if (parent.parentId === null) {
      return `${parent.code.split('-')[0]}-${index}`;
    }
    return `${parent.code}.${index}`;
  }

  update(id: EntityId, changes: Partial<Omit<BomNode, 'id' | 'projectId' | 'parentId'>>): void {
    this.modify(id, changes);
  }

  addAttachments(id: EntityId, attachments: readonly Attachment[]): void {
    this.modify(id, (node) => ({ ...node, attachments: [...node.attachments, ...attachments] }));
  }

  removeAttachment(id: EntityId, attachmentId: EntityId): void {
    this.modify(id, (node) => ({ ...node, attachments: node.attachments.filter((a) => a.id !== attachmentId) }));
  }

  setMaterials(id: EntityId, materials: readonly MaterialAssignment[]): void {
    this.modify(id, { materials });
  }

  /** Removes the node together with its whole subtree. */
  removeSubtree(id: EntityId): EntityId[] {
    const ids = new Set([id, ...this.tree().descendants(id).map((node) => node.id)]);
    this.removeWhere((node) => ids.has(node.id));
    return [...ids];
  }

  /** Writes a batch of nodes (cloned subtree or restored version). */
  putMany(nodes: readonly BomNode[]): void {
    this.upsertMany(nodes);
  }

  forProject(projectId: EntityId): BomNode[] {
    return this.all().filter((node) => node.projectId === projectId);
  }

  removeProject(projectId: EntityId): void {
    this.removeWhere((node) => node.projectId === projectId);
  }
}
