import { BomNode } from './bom-node';
import { Entity, EntityId, IsoDateTime } from './common';
import { RoutingOperation } from './routing';

/**
 * Frozen snapshot of a project's engineering definition (product tree and routings)
 * at a point in time. Versions can be compared, restored or branched into a new project.
 */
export interface ProjectVersion extends Entity {
  readonly projectId: EntityId;
  /** Sequential number inside the project (v1, v2...). */
  readonly number: number;
  readonly label: string;
  readonly note: string;
  readonly createdAt: IsoDateTime;
  readonly createdById: EntityId | null;
  /** True for the safety copy taken automatically before a restore. */
  readonly automatic: boolean;
  readonly nodes: readonly BomNode[];
  readonly operations: readonly RoutingOperation[];
}
