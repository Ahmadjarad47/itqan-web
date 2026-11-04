import { Entity, EntityId } from './common';

export interface Department extends Entity {
  readonly name: string;
  readonly icon: string;
}

export interface Employee extends Entity {
  readonly name: string;
  readonly title: string;
  readonly departmentId: EntityId;
  readonly roleId: EntityId;
  readonly email: string;
  readonly active: boolean;
}
