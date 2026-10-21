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
  'analysis-tabs': 'point',
  'platform-mode': 'point',
  'file-upload': 'flask',
  'ref-config': 'inspect',
  'ref-configuration-actions': 'point',
  'autofill-panel': 'point',
  'window-check': 'inspect',
  'core-parameters': 'checklist',
  'advanced-parameters': 'inspect',
  'result-read-flow': 'point',
  'result-metrics': 'flask',
  'result-charts': 'flask',
  'result-annotation': 'inspect',
  'result-curation': 'inspect',
  'result-exclude-group': 'inspect',
  'result-restore-group': 'inspect',
  'result-export-report': 'checklist',
  'result-viewer-reproduce': 'point',
  'result-homeo-open': 'point',
  'result-homeo-select': 'inspect',
  'result-figure-homeo': 'flask',
  'result-figure-both': 'point',
  'workspace-explorer': 'point',
  'workspace-viewer': 'inspect',
  'workspace-inspector': 'inspect',
  'workspace-map': 'inspect',
  'workspace-features': 'inspect',
  'workspace-reads': 'flask',
  'workspace-read-view': 'flask',
  'benchmark-params': 'checklist',
  'benchmark-dataset': 'flask',
  'benchmark-run': 'flask',
  'benchmark-results': 'inspect',
  'benchmark-normalization-mode': 'point',
  'benchmark-mates': 'flask',
  'benchmark-normalize': 'flask',
  'benchmark-normalization-results': 'inspect',
};

export function guideMascotPose(step: MascotStep, actionCompleted: boolean, pending: boolean): GuideMascotPose {
  if (step.interactiveAction && actionCompleted && !pending) return 'success';
  if (step.isFinal && !pending) return 'success';
  if (step.id === 'hub') return 'idle';
  if (step.isIntro) return 'wave';
  if (step.isPrereq) return 'checklist';
  return STEP_POSES[step.id] ?? 'point';
}
