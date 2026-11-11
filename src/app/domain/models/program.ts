import { Entity, EntityId, IsoDate } from './common';

/**
 * Organisation hierarchy: Company → Program → Project → Model → Serial unit.
 * A program groups related projects (e.g. "A — monitoring program").
 */
export interface Program extends Entity {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly createdAt: IsoDate;
}

export type SerialUnitStatus = 'planned' | 'in-production' | 'testing' | 'delivered';

export const SERIAL_STATUS_LABELS: Record<SerialUnitStatus, string> = {
  planned: 'مخططة',
  'in-production': 'قيد التصنيع',
  testing: 'قيد الاختبار',
  delivered: 'مُسلّمة',
};

/** One physical unit of a model, identified by its serial number (e.g. AM.101-1). */
export interface SerialUnit {
  readonly id: EntityId;
  readonly serial: string;
  readonly status: SerialUnitStatus;
  readonly note: string;
}

/** A variant of a project's product (e.g. AM.101 "with laser rangefinder"). */
export interface ProjectModel extends Entity {
  readonly projectId: EntityId;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly units: readonly SerialUnit[];
  readonly createdAt: IsoDate;
}

export interface CompanyProfile {
  readonly code: string;
  readonly name: string;
}
