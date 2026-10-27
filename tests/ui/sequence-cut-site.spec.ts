import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { FastqViewerComponent } from '../../src/app/components/sequence-workspace/fastq-viewer.component';
import { annotationAlignmentConfig } from '../../src/app/models/sequence-alignment-config';
import { resolveAnnotationCutSite } from '../../src/app/components/result-dashboard/annotation-cut-site';
import { reverseComplement } from '../../src/app/workers/core/classifier';

function viewer() {
  const component = new FastqViewerComponent({ getPendingAutoAlign: () => null } as any, { detectChanges: vi.fn() } as any);
  vi.spyOn(component as any, 'reprocessAlignment').mockImplementation(() => {});
  return component;
}

describe('Sequence Viewer cut site matches Group Annotation', () => {
  it.each([
    { guide: 'GTTCAGACAAGGCCGGA', left: 'AAAA', right: 'TGGCCCC', strand: 'forward' },
    { guide: 'GTTCAGACAAGGCCGGAAAAAATGG', left: 'AAAA', right: 'CCCC', strand: 'forward' },
    { guide: 'GTTCAGACAAGGCCGGA', left: 'AAACCA', right: 'TTTT', strand: 'reverse' },
    { guide: 'CCAGTTCAGACAAGGCCGGAAAAAA', left: 'AAAA', right: 'TTTT', strand: 'reverse' },
  ])('uses the same PAM boundary for $strand input $guide', ({ guide, left, right, strand }) => {
    const reference = left + guide + right;
    const component = viewer();
    component.alignMode = 'ref_target';
    component.inputRefSeq = reference;
    component.inputGrnaSeq = strand === 'reverse' ? reverseComplement(guide) : guide;
    component.inputWinSize = 1000;
    component.runAlign();
    expect(component.alignedCutSiteInWindow).toBe(resolveAnnotationCutSite({
      ref_sequence: reference, display_sgrna_seq: guide, grna_start_index: left.length, strand,
    }));
  });

  it('keeps an asymmetric result window and its annotation marker during automatic alignment', () => {
    const ref = 'A'.repeat(12) + 'GTTCAGACAAGGCCGGA' + 'TGG' + 'C'.repeat(130);
    const config = annotationAlignmentConfig({ ref_sequence: ref, display_sgrna_seq: 'GTTCAGACAAGGCCGGA', grna_start_index: 12 });
    const component = viewer();
    component.document = { autoAlign: config } as any;
    (component as any).checkPendingAutoAlign();
    expect(component.alignedWindowSeq).toBe(ref);
    expect(component.alignedCutSiteInWindow).toBe(26);
    expect(component.alignMode).toBe('window');
    component.inputWindowSeq = 'ACGT'.repeat(25);
    component.runAlign();
    expect(component.alignedCutSiteInWindow).toBe(50);
  });

  it('keeps a saved marker when the PAM is outside the displayed window', () => {
    const config = annotationAlignmentConfig({ ref_sequence: 'ACGT'.repeat(30), cut_site_index: 17 });
    const component = viewer();
    component.document = { autoAlign: config } as any;
    (component as any).checkPendingAutoAlign();
    expect(component.alignedCutSiteInWindow).toBe(17);
    expect(component.alignedWindowSeq).toHaveLength(120);
  });

  it('uses the midpoint for a standalone window without annotation metadata', () => {
    const component = viewer();
    component.alignMode = 'window';
    component.inputWindowSeq = 'ACGT'.repeat(25);
    component.runAlign();
    expect(component.alignedCutSiteInWindow).toBe(50);
  });
});
