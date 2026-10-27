import { AutoAlignConfig } from './sequence.model';
import { AnnotationTarget, resolveAnnotationCutSite } from '../components/result-dashboard/annotation-cut-site';

/** Keep the exact reference window and marker shown in Group Annotation. */
export function annotationAlignmentConfig(target: AnnotationTarget): AutoAlignConfig {
  const windowSeq = (target.ref_sequence || '').replace(/\s+/g, '').toUpperCase();
  const cut = resolveAnnotationCutSite(target);
  return {
    windowSeq,
    cutSiteInWindow: cut !== null && cut >= 0 && cut <= windowSeq.length ? cut : undefined,
    refSeq: windowSeq,
    grnaSeq: target.sgrna_seq || '',
    winSize: windowSeq.length,
  };
}
