import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { ExcelExportService, ExportParams, ScopeData } from '../../src/app/services/excel-export.service';
import { AppStateService } from '../../src/app/services/app-state.service';
import { emptyCurationConfig } from '../../src/app/models/curation.model';
import { ResultDashboardComponent } from '../../src/app/components/result-dashboard/result-dashboard.component';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

describe('saved curated baseline', () => {
  it('roundtrips an XLSX as a clean baseline while retaining curation provenance', async () => {
    const service = new ExcelExportService();
    const config = emptyCurationConfig(); config.excludedFiles = ['removed.fq'];
    const scopes: ScopeData[] = [{ sheetName: 'Merged', genes: [], readFlow: {
      rawReads: 20, phredPassed: 18, anchorMatched: 16, assignedReads: 10, ambiguousReads: 0
    } }];
    const file = await service.exportToExcel({} as ExportParams, scopes, undefined, config);
    const imported = await service.importFromExcel(file);
    expect(imported.scopes).toEqual(scopes);
    expect(imported.curationConfig).toBeNull();
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
    let metadata = ''; wb.getWorksheet('.metadata')!.eachRow(row => metadata += row.getCell(1).text);
    expect(JSON.parse(metadata).curationHistory.excludedFiles).toEqual(['removed.fq']);
    const state = Object.create(AppStateService.prototype) as any;
    state.activeMode = 'analysis'; state.analysisSlot = {};
    state.ngZone = { run: (fn: () => void) => fn() };
    state.updateVisibleGenes = vi.fn(); state.resultsUpdated$ = { next: vi.fn() };
    state.loadResultData(imported);
    expect(state.isCuratedView).toBe(false);
    expect(state.curationConfig).toBeNull();
    expect(state.originalSlotSnapshot).toBeNull();
  });
});

describe('exclude groups below', () => {
  beforeEach(() => vi.stubGlobal('window', { innerWidth: 1200, innerHeight: 800 }));
  afterEach(() => vi.unstubAllGlobals());
  function fixture() {
    const component = Object.create(ResultDashboardComponent.prototype) as any;
    const groups = Array.from({ length: 35 }, (_, i) => ({ read_inner: `seq${i}` }));
    component.state = { isCuratedView: true, curationConfig: {}, selectedTarget: { target_id: 'T', top_groups: groups },
      currentGene: { gene: 'G' }, isGroupExcluded: (_g: string, _t: string, seq: string) => seq === 'seq12' };
    component.cancelCurationSweep = vi.fn(); component.applyCurationItems = vi.fn();
    component.cdr = { detectChanges: vi.fn() };
    component.excludeBelowMenu = { nativeElement: { showPopover: vi.fn(), hidePopover: vi.fn(), querySelector: vi.fn() } };
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: 100, clientY: 200 };
    return { component, groups, event };
  }
  it('includes hidden rows and applies once when the context-menu action is selected', () => {
    const { component, groups, event } = fixture();
    component.openExcludeBelow(event, groups[8]);
    expect(component.bulkGroupExclusion.keys).toHaveLength(26);
    expect(component.bulkGroupExclusion.keys[0]).toBe('G::T::seq8');
    expect(component.bulkGroupExclusion.keys.at(-1)).toBe('G::T::seq34');
    expect(component.applyCurationItems).not.toHaveBeenCalled();
    component.confirmExcludeBelow();
    expect(component.applyCurationItems).toHaveBeenCalledTimes(1);
    expect(component.applyCurationItems.mock.calls[0][1]).toBe(true);
  });
  it('cancels without changes and rejects confirmation after switching targets', () => {
    const { component, groups, event } = fixture();
    component.openExcludeBelow(event, groups[0]); component.closeExcludeBelow(); component.confirmExcludeBelow();
    expect(component.applyCurationItems).not.toHaveBeenCalled();
    component.openExcludeBelow(event, groups[0]); component.state.selectedTarget.target_id = 'other';
    component.confirmExcludeBelow();
    expect(component.applyCurationItems).not.toHaveBeenCalled();
  });
});
