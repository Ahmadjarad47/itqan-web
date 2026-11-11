import {
  BomNode,
  CustomFieldDefinition,
  Department,
  Employee,
  Entity,
  EntityId,
  Material,
  Program,
  Project,
  ProjectModel,
  PurchaseRequest,
  Role,
  RoutingOperation,
  StockMovement,
  Supplier,
  WorkTask,
  Workstation,
} from '../models';

/**
 * Persistence port. Abstract classes double as Angular DI tokens, so the
 * application layer depends on these contracts and never on a storage technology.
 */
export abstract class Repository<T extends Entity> {
  abstract getAll(): Promise<T[]>;
  abstract save(entity: T): Promise<void>;
  abstract saveMany(entities: readonly T[]): Promise<void>;
  abstract remove(id: EntityId): Promise<void>;
}

export abstract class ProjectRepository extends Repository<Project> {}
export abstract class BomNodeRepository extends Repository<BomNode> {}
export abstract class MaterialRepository extends Repository<Material> {}
export abstract class StockMovementRepository extends Repository<StockMovement> {}
export abstract class SupplierRepository extends Repository<Supplier> {}
export abstract class PurchaseRepository extends Repository<PurchaseRequest> {}
export abstract class WorkstationRepository extends Repository<Workstation> {}
export abstract class OperationRepository extends Repository<RoutingOperation> {}
export abstract class DepartmentRepository extends Repository<Department> {}
export abstract class EmployeeRepository extends Repository<Employee> {}
export abstract class TaskRepository extends Repository<WorkTask> {}
export abstract class RoleRepository extends Repository<Role> {}
export abstract class CustomFieldRepository extends Repository<CustomFieldDefinition> {}
export abstract class ProgramRepository extends Repository<Program> {}
export abstract class ProjectModelRepository extends Repository<ProjectModel> {}
