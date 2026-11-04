import { IsoDate, TaskStatus, WorkTask } from '@domain/models';
import { addDays } from '@domain/rules';
import { operationId } from './production.seed';
import { nodeId } from './projects.seed';

interface TaskSpec {
  readonly code: string;
  readonly sequence: number;
  readonly projectId: string;
  readonly departmentId: string;
  readonly assigneeId: string;
  readonly start: number;
  readonly days: number;
  readonly status: TaskStatus;
  readonly target: number;
  readonly progress?: readonly number[];
  readonly archived?: boolean;
  readonly seen?: boolean;
  readonly notes?: string;
}

const SPECS: TaskSpec[] = [
  { code: 'ATL-1.1', sequence: 20, projectId: 'p-atl', departmentId: 'd-welding', assigneeId: 'e-3', start: -9, days: 6, status: 'active', target: 3, progress: [1, 1], notes: 'الالتزام بمعيار نعومة السطح قبل الدهان' },
  { code: 'ATL-2.1', sequence: 30, projectId: 'p-atl', departmentId: 'd-welding', assigneeId: 'e-4', start: -10, days: 9, status: 'active', target: 3, progress: [1], notes: 'استخدام الحماية الخلفية بغاز الأرغون' },
  { code: 'ATL-1.2', sequence: 20, projectId: 'p-atl', departmentId: 'd-bending', assigneeId: 'e-2', start: -8, days: 6, status: 'accepted', target: 12 },
  { code: 'ATL-2.2.2', sequence: 10, projectId: 'p-atl', departmentId: 'd-machining', assigneeId: 'e-5', start: -4, days: 6, status: 'sent', target: 3, seen: false, notes: 'يرجى مراجعة ملف STEP المرفق بالمكون' },
  { code: 'ATL-1.1', sequence: 10, projectId: 'p-atl', departmentId: 'd-welding', assigneeId: 'e-3', start: -16, days: 6, status: 'completed', target: 3, progress: [1, 1, 1] },
  { code: 'ATL-1.1.2', sequence: 10, projectId: 'p-atl', departmentId: 'd-laser', assigneeId: 'e-1', start: -22, days: 1, status: 'completed', target: 18, progress: [18], archived: true },
  { code: 'ATL-3.5', sequence: 10, projectId: 'p-atl', departmentId: 'd-assembly', assigneeId: 'e-6', start: -3, days: 3, status: 'rejected', target: 3 },
  { code: 'HP-1.1', sequence: 20, projectId: 'p-hp', departmentId: 'd-machining', assigneeId: 'e-5', start: -5, days: 7, status: 'active', target: 10, progress: [2, 1] },
  { code: 'HP-1.2', sequence: 20, projectId: 'p-hp', departmentId: 'd-welding', assigneeId: 'e-3', start: -2, days: 6, status: 'sent', target: 5, seen: false },
  { code: 'ATL-5', sequence: 10, projectId: 'p-atl', departmentId: 'd-electrical', assigneeId: 'e-9', start: -6, days: 14, status: 'active', target: 1 },
];

export function seedTasks(today: IsoDate): WorkTask[] {
  return SPECS.map((spec, index): WorkTask => {
    const start = addDays(today, spec.start);
    const createdAt = `${addDays(start, -1)}T08:30:00.000Z`;
    const history = [{ status: 'sent' as TaskStatus, at: createdAt, note: '' }];
    if (spec.status !== 'sent') {
      history.push({ status: spec.status === 'rejected' ? 'rejected' : 'accepted', at: `${start}T08:00:00.000Z`, note: '' });
    }
    if (spec.status === 'active' || spec.status === 'completed') {
      history.push({ status: 'active', at: `${start}T09:00:00.000Z`, note: '' });
    }
    if (spec.status === 'completed') {
      history.push({ status: 'completed', at: `${addDays(start, spec.days - 1)}T15:00:00.000Z`, note: '' });
    }
    return {
      id: `t-${index + 1}`,
      number: `TSK-${String(index + 101)}`,
      projectId: spec.projectId,
      nodeId: nodeId(spec.code),
      operationId: operationId(spec.code, spec.sequence),
      departmentId: spec.departmentId,
      assigneeId: spec.assigneeId,
      start,
      end: addDays(start, spec.days - 1),
      notes: spec.notes ?? '',
      status: spec.status,
      archived: spec.archived ?? false,
      seenByAssignee: spec.seen ?? true,
      rejectReason: spec.status === 'rejected' ? 'department' : null,
      rejectNote: spec.status === 'rejected' ? 'العملية من اختصاص قسم الكهرباء' : '',
      targetQuantity: spec.target,
      progress: (spec.progress ?? []).map((quantity, i) => ({
        id: `t-${index + 1}-p${i + 1}`,
        at: `${addDays(start, i + 1)}T14:00:00.000Z`,
        completedQuantity: quantity,
        qualityOk: true,
        note: i === 0 ? 'تم إنجاز الدفعة الأولى' : '',
      })),
      history,
      createdAt,
    };
  });
}
