import { IsoDate, Program, ProjectModel, SerialUnitStatus } from '@domain/models';
import { addDays } from '@domain/rules';

/** Program each demo project belongs to. */
export const PROJECT_PROGRAMS: Readonly<Record<string, string>> = {
  'p-atl': 'prog-a',
  'p-cv': 'prog-a',
  'p-hp': 'prog-b',
};

export function seedPrograms(today: IsoDate): Program[] {
  const createdAt = addDays(today, -60);
  return [
    { id: 'prog-a', code: 'A', name: 'برنامج خطوط الإنتاج والنقل', description: 'خطوط التعبئة وأنظمة النقل للمصانع', createdAt },
    { id: 'prog-b', code: 'B', name: 'برنامج المكابس والتشكيل', description: 'مكابس هيدروليكية ومعدات التشكيل', createdAt },
  ];
}

interface ModelSpec {
  readonly projectId: string;
  readonly code: string;
  readonly name: string;
  readonly description?: string;
  readonly units: readonly SerialUnitStatus[];
}

const MODELS: readonly ModelSpec[] = [
  { projectId: 'p-atl', code: 'ATL-200.1', name: 'ست فوهات — سوائل خفيفة', units: ['testing', 'in-production'] },
  { projectId: 'p-atl', code: 'ATL-200.2', name: 'ثماني فوهات مع غطاء آلي', description: 'نسخة موسعة مع وحدة إغلاق أغطية', units: ['planned'] },
  { projectId: 'p-hp', code: 'HP-50.1', name: 'مع ستارة أمان ضوئية', units: ['delivered', 'in-production', 'in-production'] },
  { projectId: 'p-hp', code: 'HP-50.2', name: 'مع ستارة أمان ووسادة سفلية', units: ['planned', 'planned'] },
  { projectId: 'p-cv', code: 'CV-12.1', name: 'سرعة ثابتة', units: [] },
  { projectId: 'p-cv', code: 'CV-12.2', name: 'سرعة متغيرة VFD', units: [] },
];

export function seedModels(today: IsoDate): ProjectModel[] {
  const createdAt = addDays(today, -25);
  return MODELS.map((spec, index) => ({
    id: `mdl-${index + 1}`,
    projectId: spec.projectId,
    code: spec.code,
    name: spec.name,
    description: spec.description ?? '',
    createdAt,
    units: spec.units.map((status, i) => ({
      id: `mdl-${index + 1}-u${i + 1}`,
      serial: `${spec.code}-${i + 1}`,
      status,
      note: '',
    })),
  }));
}
