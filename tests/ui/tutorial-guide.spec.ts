import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { TutorialGuideComponent } from '../../src/app/components/tutorial-guide/tutorial-guide.component';

class Target {
  constructor(private selectors: string[] = []) {}
  closest(selector: string) { return this.selectors.includes(selector) ? this : null; }
  blur = vi.fn();
}

function setup() {
  const nodes = new Map<string, any>();
  vi.stubGlobal('Element', Target);
  vi.stubGlobal('document', { querySelector: (s: string) => nodes.get(s) ?? null, activeElement: null });
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn(), scrollTo: vi.fn() });
  const state: any = {
    viewerSlot: { genes: [{ gene: 'USER' }], nested: { count: 1 } },
    analysisSlot: { genes: [{ gene: 'ANALYSIS' }] }, activeMode: 'analysis',
    isCuratedView: false, curationConfig: null, originalSlotSnapshot: null, lastExportedFile: null,
    resultsUpdated$: new Subject(), collapseAnalysisPanels: vi.fn(),
    activateSlot(mode: string) { this.activeMode = mode; },
    loadResultData: vi.fn(function(this: any, data: any) { this.viewerSlot.genes = data.scopes[0].genes; }),
    addTab: vi.fn(), tabs: [], selectedFiles: [], illuminaPairs: [],
  };
  const excel: any = { importFromExcel: vi.fn() };
  const guide = new TutorialGuideComponent(state, { detectChanges: vi.fn() } as any, {} as any, excel);
  guide.requestTab.emit = vi.fn();
  (guide as any).updateLayoutInstant = vi.fn();
  return { guide, state, nodes, excel };
}
function event(selectors: string[], type = 'click', key?: string) {
  return { target: new Target(selectors), type, key, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() } as any;
}
function step(guide: TutorialGuideComponent, id: string, mode: 'analysis' | 'result' = 'analysis') {
  guide.guideMode = mode;
  guide.currentStepIndex = guide.currentSteps.findIndex(s => s.id === id);
  expect(guide.currentStepIndex).toBeGreaterThanOrEqual(0);
}

describe('guided interaction boundaries', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('blocks unrelated controls even when they lie in the highlighted tabs bar', () => {
    const { guide } = setup(); step(guide, 'analysis-tabs');
    for (const type of ['pointerdown', 'click', 'keydown', 'contextmenu', 'drop']) {
      const e = event(['#guide-tabs-bar', '.tab-close'], type, 'Enter');
      (guide as any).guardInteraction(e);
      expect(e.preventDefault).toHaveBeenCalled(); expect(e.stopImmediatePropagation).toHaveBeenCalled();
    }
  });

  it('creates only one demo tab, including repeated clicks', () => {
    const { guide, state } = setup(); step(guide, 'analysis-tabs');
    state.currentTab = { id: 'demo' }; state.renameTab = vi.fn();
    (guide as any).guardInteraction(event(['#guide-add-tab-btn']));
    (guide as any).guardInteraction(event(['#guide-add-tab-btn']));
    expect(state.addTab).toHaveBeenCalledTimes(1);
    expect(guide.guideTabCreated).toBe(true);
  });

  it('locks explanatory steps rather than enabling every control inside the spotlight', () => {
    const { guide } = setup(); step(guide, 'core-parameters');
    const e = event(['#guide-targets-section']); (guide as any).guardInteraction(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('prevents closing/reopening Window Check after its required click', () => {
    const { guide, nodes } = setup(); step(guide, 'window-check'); guide.windowCheckOpened = true;
    nodes.set('#guide-window-check-panel', {});
    expect(guide.isCurrentActionCompleted).toBe(true);
    for (const s of ['.btn-close-window-check', '#guide-window-check-btn']) {
      const e = event([s]); (guide as any).guardInteraction(e); expect(e.preventDefault).toHaveBeenCalled();
    }
    nodes.delete('#guide-window-check-panel'); expect(guide.isCurrentActionCompleted).toBe(false);
  });

  it('allows guide controls and handles Escape only once', () => {
    const { guide } = setup(); guide.closeGuide = vi.fn();
    const allowed = event(['app-tutorial-guide']); (guide as any).guardInteraction(allowed);
    expect(allowed.preventDefault).not.toHaveBeenCalled();
    (guide as any).guardInteraction(event(['app-tutorial-guide'], 'keydown', 'Escape'));
    expect(guide.closeGuide).toHaveBeenCalledTimes(1);
  });

  it('does not turn Enter on a focused guide button into another Next action', () => {
    const { guide } = setup(); guide.nextStep = vi.fn();
    guide.onKeyDown(event(['button'], 'keydown', 'Enter'));
    expect(guide.nextStep).not.toHaveBeenCalled();
  });

  it('cancels delayed advancement when returning to the hub', () => {
    const { guide } = setup(); step(guide, 'ref-configuration-actions');
    (guide as any).onCaptureClick(event(['#guide-autofill-btn']));
    guide.returnToHub(); vi.runAllTimers();
    expect(guide.guideMode).toBe('hub'); expect(guide.currentStepIndex).toBe(0);
  });

  it('does not enable Next while the required screen target is missing', () => {
    const { guide } = setup(); step(guide, 'result-metrics', 'result');
    expect(guide.isNextButtonEnabled).toBe(false);
  });

  it('does not accept existing user files as completion of the demo upload', () => {
    const { guide, state } = setup(); step(guide, 'file-upload'); state.selectedFiles = [{}];
    expect(guide.isCurrentActionCompleted).toBe(false);
  });

  it('resets demo actions on restarting Analysis from the hub', () => {
    const { guide } = setup(); guide.demoFilesLoaded = true; guide.demoTargetsLoaded = true; guide.isAutofillOpen = true;
    guide.startAnalysisGuide();
    expect(guide.demoFilesLoaded).toBe(false); expect(guide.demoTargetsLoaded).toBe(false); expect(guide.isAutofillOpen).toBe(false);
  });

  it('removes capture handlers and pending callbacks on destruction', () => {
    const { guide } = setup(); const callback = vi.fn(); (guide as any).later(callback, 50);
    guide.ngOnDestroy(); vi.runAllTimers();
    expect(callback).not.toHaveBeenCalled();
    expect(window.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function), true);
  });
});

describe('Results guide entry and readiness', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('direct entry loads the visible Viewer without overwriting analysis or saved Viewer data', () => {
    const { guide, state } = setup(); const original = state.viewerSlot, analysis = state.analysisSlot;
    guide.startResultsGuide();
    expect(guide.requestTab.emit).toHaveBeenCalledWith('viewer');
    expect(state.activeMode).toBe('viewer'); expect(state.loadResultData).toHaveBeenCalledTimes(1);
    expect(state.analysisSlot).toBe(analysis); expect(original.genes[0].gene).toBe('USER');
    expect(state.viewerSlot).not.toBe(original);
    (guide as any).restoreViewer(); expect(state.viewerSlot).toBe(original);
  });

  it('resets completion flags and ignores stale exports on restarting the Results guide', () => {
    const { guide, state } = setup(); guide.viewerLoaded = true; guide.exportTested = true; state.lastExportedFile = {};
    guide.startResultsGuide();
    expect(guide.viewerLoaded).toBe(false); expect(guide.exportTested).toBe(false); expect(state.lastExportedFile).toBeNull();
  });

  it('waits for the actual Excel import before completing the reproduction step', async () => {
    const { guide, state, excel } = setup(); step(guide, 'result-viewer-reproduce', 'result'); state.lastExportedFile = {};
    let resolve!: (data: any) => void;
    excel.importFromExcel.mockReturnValue(new Promise(r => resolve = r));
    const task = (guide as any).simulateDropIntoResultViewer();
    expect(guide.viewerLoaded).toBe(false); expect((guide as any).pendingAction).toBe(true);
    resolve({ scopes: [{ genes: [] }] }); await task;
    expect(guide.viewerLoaded).toBe(true); expect((guide as any).pendingAction).toBe(false);
  });

  it('does not complete a failed import', async () => {
    const { guide, state, excel } = setup(); step(guide, 'result-viewer-reproduce', 'result'); state.lastExportedFile = {};
    excel.importFromExcel.mockRejectedValue(new Error('bad workbook'));
    await (guide as any).simulateDropIntoResultViewer();
    expect(guide.viewerLoaded).toBe(false); expect((guide as any).pendingAction).toBe(false);
  });

  it('does not accept a failed or unfinished export as a successful download', async () => {
    const { guide, state } = setup(); step(guide, 'result-export-report', 'result');
    let resolve!: (file: any) => void; state.exportToExcel = vi.fn(() => new Promise(r => resolve = r));
    const task = (guide as any).exportGuideResult();
    expect(guide.exportTested).toBe(false); expect((guide as any).pendingAction).toBe(true);
    resolve(null); await task;
    expect(guide.exportTested).toBe(false); expect((guide as any).pendingAction).toBe(false);
  });

  it('discards an import that resolves after leaving and re-entering the same step', async () => {
    const { guide, state, excel } = setup(); step(guide, 'result-viewer-reproduce', 'result'); state.lastExportedFile = {};
    let resolve!: (data: any) => void; excel.importFromExcel.mockReturnValue(new Promise(r => resolve = r));
    const task = (guide as any).simulateDropIntoResultViewer();
    guide.returnToHub(); step(guide, 'result-viewer-reproduce', 'result');
    resolve({ scopes: [{ genes: [] }] }); await task;
    expect(state.loadResultData).not.toHaveBeenCalled(); expect(guide.viewerLoaded).toBe(false);
  });
});
