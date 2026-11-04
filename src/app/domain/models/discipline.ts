export type Discipline = 'mechanical' | 'electrical' | 'electronic' | 'pneumatic' | 'hydraulic' | 'software' | 'other';

export interface DisciplineInfo {
  readonly label: string;
  readonly icon: string;
}

export const DISCIPLINES: Record<Discipline, DisciplineInfo> = {
  mechanical: { label: 'ميكانيكي', icon: 'wrench' },
  electrical: { label: 'كهربائي', icon: 'zap' },
  electronic: { label: 'إلكتروني', icon: 'cpu' },
  pneumatic: { label: 'هوائي / نيوماتيكي', icon: 'wind' },
  hydraulic: { label: 'هيدروليكي', icon: 'droplet' },
  software: { label: 'برمجيات', icon: 'code' },
  other: { label: 'أخرى', icon: 'box' },
};

export const DISCIPLINE_KEYS = Object.keys(DISCIPLINES) as Discipline[];
