import { EntityId, IsoDateTime } from './common';

export type AttachmentKind = 'drawing2d' | 'model3d' | 'quality' | 'document';

/** Metadata of an uploaded file. Binary content is out of scope for the UI-only build. */
export interface Attachment {
  readonly id: EntityId;
  readonly name: string;
  readonly size: number;
  readonly kind: AttachmentKind;
  readonly uploadedAt: IsoDateTime;
}

export interface AttachmentRule {
  readonly label: string;
  readonly extensions: readonly string[];
}

export const ATTACHMENT_RULES: Record<AttachmentKind, AttachmentRule> = {
  drawing2d: { label: 'رسم ثنائي الأبعاد', extensions: ['pdf', 'dxf', 'dwg'] },
  model3d: { label: 'نموذج ثلاثي الأبعاد', extensions: ['step', 'stp', 'iges', 'igs', 'sldprt'] },
  quality: { label: 'استمارة مراقبة الجودة', extensions: ['pdf', 'docx', 'xlsx'] },
  document: { label: 'مستند', extensions: ['pdf', 'docx', 'xlsx', 'png', 'jpg', 'zip'] },
};

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}
