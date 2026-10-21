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
    resultsUpdated$: new Subject(), benchmarkUpdated$: new Subject(), collapseAnalysisPanels: vi.fn(),
    activateSlot(mode: string) { this.activeMode = mode; },
    loadResultData: vi.fn(function(this: any, data: any) { this.viewerSlot.genes = data.scopes[0].genes; }),
    addTab: vi.fn(), tabs: [], selectedFiles: [], illuminaPairs: [],
    newViewer: vi.fn(function(this: any) { this.viewerSlot = { genes: [] }; this.isCuratedView = false; this.curationConfig = null; this.originalSlotSnapshot = null; }),
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

  it('shows encouragement only after the required curation action succeeds', () => {
    const { guide, state } = setup(); step(guide, 'result-curation', 'result');
    expect(guide.mascotPose).toBe('inspect');
    state.isCuratedView = true;
    expect(guide.mascotPose).toBe('success');
    expect(guide.mascotSrc).toBe('guide-mascots/success.webp');
    (guide as any).pendingAction = true;
    expect(guide.mascotPose).toBe('inspect');
    (guide as any).pendingAction = false;
    step(guide, 'result-metrics', 'result');
    expect(guide.mascotPose).toBe('flask');
    guide.guideMode = 'hub'; guide.currentStepIndex = 0;
    expect(guide.mascotPose).toBe('idle');
  });

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

  it('allows Window Check inputs, matrix cells and comparison scrolling but not panel closing', () => {
    const { guide } = setup(); step(guide, 'window-check'); guide.windowCheckOpened = true;
    for (const selector of ['#guide-window-check-panel input', '#guide-window-check-panel .similarity-table td', '#guide-pair-comparison .alignment-box', '#guide-pair-comparison .btn-close-comparison']) {
      const e = event([selector]); (guide as any).guardInteraction(e);
      expect(e.preventDefault).not.toHaveBeenCalled();
    }
    const close = event(['.btn-close-window-check']); (guide as any).guardInteraction(close);
    expect(close.preventDefault).toHaveBeenCalled();
  });

  it('reduces Sequence Viewer to import, align and search with real completion gates', () => {
    const { guide, nodes } = setup(); guide.guideMode = 'workspace';
    expect(guide.workspaceSteps.map(s => s.id)).toEqual(['workspace-reads', 'workspace-align', 'workspace-search', 'workspace-final']);
    guide.currentStepIndex = 1;
    expect(guide.isCurrentActionCompleted).toBe(false);
    const allowed = event(['#guide-workspace-run-align']); (guide as any).guardInteraction(allowed);
    expect(allowed.preventDefault).not.toHaveBeenCalled();
    nodes.set('#guide-workspace-reads[data-aligned="true"]', {});
    expect(guide.isCurrentActionCompleted).toBe(true);
    guide.currentStepIndex = 2;
    expect(guide.isCurrentActionCompleted).toBe(false);
    nodes.set('#guide-workspace-reads[data-guide-search-complete="true"]', {});
    expect(guide.isCurrentActionCompleted).toBe(true);
  });

  it('allows only generated blob download links outside the highlighted action', () => {
    const { guide } = setup(); step(guide, 'result-export-report', 'result');
    const download = event([]);
    Object.assign(download.target, { tagName: 'A', download: 'results.xlsx', href: 'blob:https://example.test/report' });
    (guide as any).guardInteraction(download); expect(download.preventDefault).not.toHaveBeenCalled();
    download.target.href = 'https://example.test/unrelated';
    (guide as any).guardInteraction(download); expect(download.preventDefault).toHaveBeenCalled();
  });

  it('keeps native touch scrolling available through long highlighted panels', () => {
    const { guide } = setup();
    expect((guide as any).guardedEvents).not.toContain('touchstart');
    expect((guide as any).guardedEvents).toContain('click');
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

  it('requires TRY selection before continuing the reference-switch step', () => {
    const { guide, state } = setup(); step(guide, 'result-references', 'result');
    state.currentGene = { gene: 'CPC' }; expect(guide.isCurrentActionCompleted).toBe(false);
    state.currentGene = { gene: 'TRY' }; expect(guide.isCurrentActionCompleted).toBe(true);
  });

  it('allows one example-group exclusion and then requires restoring it', () => {
    const { guide, state } = setup(); step(guide, 'result-exclude-group', 'result');
    let excluded = false;
    state.currentGene = { gene: 'TRY' }; state.selectedTarget = { target_id: 't1', top_groups: [{ group_rank: 5, read_inner: 'ACTG' }] };
    state.isGroupExcluded = () => excluded;
    state.toggleGroupExclusion = vi.fn(() => excluded = !excluded);
    const selector = '#guide-annotation-panel [data-guide-group-rank="5"] .exclude-btn-group';
    (guide as any).guardInteraction(event([selector]));
    expect(guide.isCurrentActionCompleted).toBe(true); expect(excluded).toBe(true);
    (guide as any).guardInteraction(event([selector]));
    expect(state.toggleGroupExclusion).toHaveBeenCalledTimes(1);
    step(guide, 'result-restore-group', 'result'); expect(guide.isCurrentActionCompleted).toBe(false);
    (guide as any).guardInteraction(event([selector], 'keydown', 'Enter'));
    expect(excluded).toBe(false); expect(guide.isCurrentActionCompleted).toBe(true);
  });

  it('blocks drag-delete initiation during the group exercise', () => {
    const { guide } = setup(); step(guide, 'result-exclude-group', 'result');
    const e = event(['#guide-annotation-panel [data-guide-group-rank="5"] .exclude-btn-group'], 'pointerdown');
    (guide as any).guardInteraction(e); expect(e.stopImmediatePropagation).toHaveBeenCalled();
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

  it('uses CPC and TRY examples with separate sequences and reconciled read counts', () => {
    const { guide } = setup(); const data = (guide as any).generateSyntheticFigure2Result();
    expect(data.scopes[0].genes.map((g: any) => g.gene)).toEqual(['CPC', 'TRY']);
    const targets = data.scopes[0].genes.map((g: any) => g.analysis_result.targets[0]);
    expect(targets[0].ref_sequence).not.toBe(targets[1].ref_sequence);
    for (const t of targets) {
      expect(t.top_groups.reduce((sum: number, g: any) => sum + g.read_count, 0)).toBe(t.summary.aligned_reads);
      expect(t.ref_sequence.length).toBe(90);
      expect(t.top_groups.every((g: any) => /^[ACGT]+$/.test(g.read_inner))).toBe(true);
    }
    expect(data.scopes[0].readFlow.assignedReads).toBe(targets.reduce((sum: number, t: any) => sum + t.summary.aligned_reads, 0));
  });

  it('shows read-action previews only during the demo and clears them on restoration', () => {
    const { guide, state } = setup(); guide.startResultsGuide();
    expect(state.guideReadActionsPreview).toBe(true);
    (guide as any).restoreViewer(); expect(state.guideReadActionsPreview).toBe(false);
  });

  it('restores the original viewer before emitting guide close', () => {
    const { guide, state } = setup(); const original = state.viewerSlot;
    guide.startResultsGuide();
    const closed = vi.fn(() => expect(state.viewerSlot).toBe(original));
    guide.close.subscribe(closed); guide.closeGuide();
    expect(closed).toHaveBeenCalledOnce();
  });

  it('waits for the actual Excel import before completing the reproduction step', async () => {
    const { guide, state, excel } = setup(); step(guide, 'result-viewer-reproduce', 'result'); state.lastExportedFile = {};
    let resolve!: (data: any) => void;
    excel.importFromExcel.mockReturnValue(new Promise(r => resolve = r));
    const task = (guide as any).importGuideResult();
    expect(guide.viewerLoaded).toBe(false); expect((guide as any).pendingAction).toBe(true);
    resolve({ scopes: [{ genes: [] }] }); await task;
    expect(guide.viewerLoaded).toBe(true); expect((guide as any).pendingAction).toBe(false);
  });

  it('does not complete a failed import', async () => {
    const { guide, state, excel } = setup(); step(guide, 'result-viewer-reproduce', 'result'); state.lastExportedFile = {};
    excel.importFromExcel.mockRejectedValue(new Error('bad workbook'));
    await (guide as any).importGuideResult();
    expect(guide.viewerLoaded).toBe(false); expect((guide as any).pendingAction).toBe(false);
    expect(guide.guideImportError).toContain('could not be imported');
  });

  it('shows an empty viewer and never restores merely by clicking its navigation tab', () => {
    const { guide, state, excel } = setup(); guide.startResultsGuide();
    const preview = state.viewerSlot;
    state.lastExportedFile = new File(['example'], 'guide.xlsx');
    step(guide, 'result-viewer-reproduce', 'result');
    (guide as any).handleStepSideEffects();
    expect(state.newViewer).toHaveBeenCalledOnce(); expect(state.viewerSlot.genes).toEqual([]);
    (guide as any).guardInteraction(event(['#guide-viewer-tab-btn']));
    expect(excel.importFromExcel).not.toHaveBeenCalled(); expect(guide.viewerLoaded).toBe(false);
    step(guide, 'result-export-report', 'result'); (guide as any).handleStepSideEffects();
    expect(state.viewerSlot).toBe(preview);
  });

  it('imports an actual dropped report and only then acknowledges success', async () => {
    const { guide, state, excel } = setup(); step(guide, 'result-viewer-reproduce', 'result');
    const file = new File(['workbook'], 'example.xlsx');
    excel.importFromExcel.mockResolvedValue({ scopes: [{ genes: [] }] });
    const drop = event(['#guide-viewer-dropzone'], 'drop');
    drop.dataTransfer = { getData: () => '', files: [file] };
    (guide as any).guardInteraction(drop);
    expect(drop.preventDefault).toHaveBeenCalled();
    await Promise.resolve(); await Promise.resolve();
    expect(excel.importFromExcel).toHaveBeenCalledWith(file); expect(guide.viewerLoaded).toBe(true);
  });

  it('keeps unrelated areas locked and restores with a single drop-zone click', async () => {
    const { guide, state, excel } = setup(); step(guide, 'result-viewer-reproduce', 'result');
    state.lastExportedFile = new File(['workbook'], 'guide.xlsx');
    excel.importFromExcel.mockResolvedValue({ scopes: [{ genes: [] }] });
    const elsewhere = event(['#guide-upload-zone'], 'drop');
    (guide as any).guardInteraction(elsewhere);
    expect(elsewhere.preventDefault).toHaveBeenCalled(); expect(excel.importFromExcel).not.toHaveBeenCalled();
    (guide as any).guardInteraction(event(['#guide-viewer-dropzone']));
    (guide as any).guardInteraction(event(['#guide-viewer-dropzone']));
    await Promise.resolve(); expect(excel.importFromExcel).toHaveBeenCalledWith(state.lastExportedFile);
    expect(excel.importFromExcel).toHaveBeenCalledTimes(1);
  });

  it('does not advance benchmark until actual calculation has finished', () => {
    const { guide, state } = setup(); guide.guideMode = 'benchmark';
    guide.currentStepIndex = guide.benchmarkSteps.findIndex(s => s.id === 'benchmark-run');
    state.benchmarkResult = null; expect(guide.isCurrentActionCompleted).toBe(false);
    state.benchmarkResult = { total_reads: 24 }; state.benchIsLoading = true; expect(guide.isCurrentActionCompleted).toBe(false);
    state.benchIsLoading = false; expect(guide.isCurrentActionCompleted).toBe(true);
  });

  it('keeps original benchmark inputs and results untouched after leaving the example', () => {
    const { guide, state } = setup();
    const rows = [{ geneName: 'My own experiment' }]; const result = { total_reads: 987 };
    Object.assign(state, { benchRows: rows, benchmarkResult: result, benchWindow: 200, benchPhred: 30, benchIsLoading: false });
    guide.startBenchmarkGuide();
    expect(state.guideBenchmarkActive).toBe(true); expect(state.benchRows).toEqual([]);
    expect(state.benchWindow).toBe(90);
    guide.returnToHub();
    expect(state.benchRows).toBe(rows); expect(state.benchmarkResult).toBe(result);
    expect(state.benchWindow).toBe(200); expect(state.benchPhred).toBe(30); expect(state.guideBenchmarkActive).toBe(false);
  });

  it('does not replace an already-running benchmark', () => {
    const { guide, state } = setup();
    const rows = [{ geneName: 'Running experiment' }]; Object.assign(state, { benchRows: rows, benchIsLoading: true });
    guide.startBenchmarkGuide(); expect(guide.benchmarkUnavailable).toBe(true);
    expect(state.benchRows).toBe(rows); expect(state.guideBenchmarkActive).not.toBe(true);
    expect(guide.isNextButtonEnabled).toBe(false);
  });

  it('marks the sibling benchmark page for refresh when asynchronous work completes', () => {
    const { guide, state } = setup(); guide.ngOnInit();
    guide.guideMode = 'benchmark'; guide.currentStepIndex = guide.benchmarkSteps.findIndex(s => s.id === 'benchmark-run');
    state.benchmarkResult = { total_reads: 24 }; state.benchIsLoading = false;
    state.benchmarkUpdated$.next();
    expect(guide.requestTab.emit).toHaveBeenCalledWith('benchmark');
    vi.advanceTimersByTime(60);
    expect((guide as any).cdr.detectChanges).toHaveBeenCalled();
    guide.ngOnDestroy();
  });

  it('accepts the draggable example token but not arbitrary source controls', async () => {
    const { guide, state, excel } = setup(); step(guide, 'result-viewer-reproduce', 'result');
    const file = new File(['workbook'], 'guide.xlsx'); state.lastExportedFile = file;
    const setData = vi.fn(); guide.dragGuideReport({ dataTransfer: { setData }, preventDefault: vi.fn() } as any);
    expect(setData).toHaveBeenCalledWith('application/x-casmango-guide-report', 'example');
    excel.importFromExcel.mockResolvedValue({ scopes: [{ genes: [] }] });
    const drop = event(['#guide-viewer-dropzone'], 'drop');
    drop.dataTransfer = { files: [], getData: () => 'example' };
    (guide as any).guardInteraction(drop); await Promise.resolve();
    expect(excel.importFromExcel).toHaveBeenCalledWith(file);
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
    const task = (guide as any).importGuideResult();
    guide.returnToHub(); step(guide, 'result-viewer-reproduce', 'result');
    resolve({ scopes: [{ genes: [] }] }); await task;
    expect(state.loadResultData).not.toHaveBeenCalled(); expect(guide.viewerLoaded).toBe(false);
  });

  it('requires actually opening comparison and selecting a combination, not an unrelated result action', () => {
    const { guide, nodes } = setup(); step(guide, 'result-homeo-open', 'result');
    expect(guide.isCurrentActionCompleted).toBe(false);
    const blocked = event(['#guide-standard-figure']); (guide as any).guardInteraction(blocked); expect(blocked.preventDefault).toHaveBeenCalled();
    nodes.set('#guide-open-homeo[aria-pressed="true"]', {}); expect(guide.isCurrentActionCompleted).toBe(true);
    step(guide, 'result-homeo-select', 'result'); expect(guide.isCurrentActionCompleted).toBe(false);
    nodes.set('#guide-homeo-comparison[data-selection-count="1"] #guide-homeo-second-reference[aria-pressed="false"]', {});
    expect(guide.isCurrentActionCompleted).toBe(true);
  });

  it('guides figure opening and panel addition as two real actions and locks other controls', () => {
    const { guide, nodes } = setup(); step(guide, 'result-figure-homeo', 'result');
    expect((guide as any).allowedSelectors()).toEqual(['#guide-homeo-figure']);
    nodes.set('#guide-homeo-figure[aria-pressed="true"]', {});
    expect((guide as any).allowedSelectors()).toEqual(['#guide-add-homeo-panel']);
    expect(guide.currentStepTargetSelector).toBe('#guide-add-homeo-panel');
    const blocked = event(['.figure-settings']); (guide as any).guardInteraction(blocked); expect(blocked.preventDefault).toHaveBeenCalled();
    nodes.set('[data-figure-source="homoeolog"]', { getAttribute: () => '1' });
    expect(guide.isCurrentActionCompleted).toBe(true); expect((guide as any).allowedSelectors()).toEqual([]);
  });

  it('requires a standard panel and an independent homeo figure card', () => {
    const { guide, nodes } = setup(); step(guide, 'result-figure-both', 'result');
    nodes.set('[data-figure-source="standard"]', { getAttribute: () => '1' });
    expect(guide.isCurrentActionCompleted).toBe(false); nodes.set('#guide-homeo-figure-pane:not([hidden])', {});
    expect(guide.isCurrentActionCompleted).toBe(true);
  });
});
