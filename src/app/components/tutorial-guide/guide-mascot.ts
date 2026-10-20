export type GuideMascotPose = 'idle' | 'wave' | 'point' | 'flask' | 'inspect' | 'checklist' | 'success';

export const GUIDE_MASCOT_ASSETS: Record<GuideMascotPose, string> = {
  idle: 'guide-mascots/idle.webp',
  wave: 'guide-mascots/wave.webp',
  point: 'guide-mascots/point.webp',
  flask: 'guide-mascots/flask.webp',
  inspect: 'guide-mascots/inspect.webp',
  checklist: 'guide-mascots/checklist.webp',
  success: 'guide-mascots/success.webp',
};

interface MascotStep {
  id: string;
  isIntro?: boolean;
  isPrereq?: boolean;
  isFinal?: boolean;
  interactiveAction?: string;
}

// Reuse a pose through each subject block rather than choosing one per page.
const STEP_POSES: Record<string, GuideMascotPose> = {
  'analysis-tabs': 'checklist',
  'platform-mode': 'checklist',
  'file-upload': 'checklist',
  'ref-config': 'checklist',
  'ref-configuration-actions': 'checklist',
  'autofill-panel': 'checklist',
  'window-check': 'inspect',
  'core-parameters': 'checklist',
  'advanced-parameters': 'checklist',
  'result-read-flow': 'flask',
  'result-metrics': 'flask',
  'result-charts': 'flask',
  'result-annotation': 'inspect',
  'result-curation': 'checklist',
  'result-exclude-group': 'checklist',
  'result-restore-group': 'checklist',
  'result-export-report': 'checklist',
  'result-viewer-reproduce': 'checklist',
  'workspace-explorer': 'inspect',
  'workspace-viewer': 'inspect',
  'workspace-inspector': 'inspect',
  'benchmark-params': 'checklist',
  'benchmark-dataset': 'flask',
};

export function guideMascotPose(step: MascotStep, actionCompleted: boolean, pending: boolean): GuideMascotPose {
  if (step.interactiveAction && actionCompleted && !pending) return 'success';
  if (step.isFinal && !pending) return 'success';
  if (step.id === 'hub') return 'idle';
  if (step.isIntro) return 'wave';
  if (step.isPrereq) return 'checklist';
  return STEP_POSES[step.id] ?? 'point';
}
