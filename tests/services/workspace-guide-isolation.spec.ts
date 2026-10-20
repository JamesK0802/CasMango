import '@angular/compiler';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { SequenceWorkspaceService } from '../../src/app/services/sequence-workspace.service';
import { workspaceExampleItems } from '../../src/app/components/tutorial-guide/module-examples';

describe('temporary sequence guide workspace', () => {
  it('never persists demo edits and restores exact original items and selection', async () => {
    const service = Object.create(SequenceWorkspaceService.prototype) as SequenceWorkspaceService;
    const original = [{ ...workspaceExampleItems()[0], id: 'user-document', name: 'My own reference' }];
    const s = service as any;
    s.itemsSubject = new BehaviorSubject(original);
    s.selectedItemIdSubject = new BehaviorSubject('user-document');
    s.selectedRegionSubject = new BehaviorSubject({ start: 1, end: 4, length: 3 });
    s.pendingAutoAlignSubject = new BehaviorSubject({ windowSeq: 'ACGT' });
    s.initDB = vi.fn(() => { throw new Error('Demo must not write IndexedDB'); });
    service.beginGuideExample(workspaceExampleItems());
    expect(service.getSelectedItem()?.id).toBe('guide-cpc-reference');
    await service.saveItem({ ...workspaceExampleItems()[0], name: 'Demo edit only' });
    await service.deleteItem('guide-cpc-reads');
    expect(s.initDB).not.toHaveBeenCalled();
    service.endGuideExample();
    expect(s.itemsSubject.value).toBe(original);
    expect(service.getSelectedItem()?.id).toBe('user-document');
    expect(s.selectedRegionSubject.value).toEqual({ start: 1, end: 4, length: 3 });
    expect(service.getPendingAutoAlign()).toEqual({ windowSeq: 'ACGT' });
    service.endGuideExample(); expect(s.itemsSubject.value).toBe(original);
  });
});
