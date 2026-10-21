import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { FastqViewerComponent } from '../../src/app/components/sequence-workspace/fastq-viewer.component';
import { workspaceExampleItems } from '../../src/app/components/tutorial-guide/module-examples';

describe('explicit FASTQ alignment preset', () => {
  it('fills controls without running alignment automatically', () => {
    const viewer = new FastqViewerComponent({ getPendingAutoAlign: () => null } as any, { detectChanges: vi.fn() } as any);
    const doc = workspaceExampleItems()[1] as any;
    doc.alignmentPreset = doc.autoAlign; delete doc.autoAlign;
    viewer.document = doc;
    const run = vi.spyOn(viewer, 'runAlign');
    vi.spyOn(viewer as any, 'initProcessedReads').mockImplementation(() => {});
    viewer.ngOnChanges({ document: { previousValue: null, currentValue: doc, firstChange: true, isFirstChange: () => true } });
    expect(viewer.inputWindowSeq).toHaveLength(90);
    expect(viewer.isAlignedActive).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
});
