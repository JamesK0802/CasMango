import '@angular/compiler';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { comparisonRows, comparisonSummary, captureFigureSource, renderFigure, sequenceCells, moveFigurePanel, FigureOptions, withoutExcludedGroups } from '../../src/app/components/result-dashboard/result-presentation';
import { groupKey } from '../../src/app/models/curation.model';
import { HomoeologComparisonComponent } from '../../src/app/components/result-dashboard/homoeolog-comparison.component';
import { FigureComposerComponent } from '../../src/app/components/result-dashboard/figure-composer.component';
import { ResultDashboardComponent } from '../../src/app/components/result-dashboard/result-dashboard.component';

function gene(name: string, wt = 50, reads = 100): any {
  return { gene: name, homoeolog_group: 'Gene1', assigned_read_count: reads, analysis_result: { targets: [{
    target_id: 't1', ref_sequence: 'A'.repeat(80), cut_site_index: 40,
    summary: { matched_reads: reads, aligned_reads: reads, no_indel_pct: wt, substitution_pct: 5, in_frame_pct: 10, out_of_frame_pct: 85 - wt },
    top_groups: [{ read_inner: 'A'.repeat(80), net_indel: 0, read_count: 50, read_pct: 50, classification: 'no_indel', tokens: [{ type: 'equal', val: 'A'.repeat(80) }] }]
  }] } };
}
const options: FigureOptions = { title: 'My figure', columns: 2, fontSize: 14, radius: 20, groupLimit: 5, minFrequency: 2, palette: 'okabe' };
function source() { return { label: 'Sample 1 · t1', rows: comparisonRows([gene('7A'), gene('7B', 90), gene('7D', 80)], ['7A', '7D'], 't1') }; }

describe('presentation-only homoeolog comparison', () => {
  it('uses only selected references without changing underlying results', () => {
    const genes = [gene('7A'), gene('7B'), gene('7D')], before = structuredClone(genes);
    const rows = comparisonRows(genes, ['7A', '7D'], 't1');
    expect(rows.map(r => r.name)).toEqual(['7A', '7D']); expect(genes).toEqual(before);
  });
  it('keeps pure-WT separate from substitution and explicitly counts substitutions as non-WT', () => {
    const row = source().rows[0]; expect(row.wt).toBe(50); expect(row.edited).toBe(50);
    expect(row.substitution).toBe(5); expect(row.inFrame).toBe(10); expect(row.outOfFrame).toBe(35);
  });
  it('treats missing targets and zero reads as not evaluated, not WT', () => {
    expect(comparisonRows([gene('A')], ['A'], 'missing')[0].wt).toBeNull();
    expect(comparisonRows([gene('A', 100, 0)], ['A'], 't1')[0].edited).toBeNull();
  });
  it('uses post-filter aligned reads, including an explicit zero rather than falling back to pre-filter matched reads', () => {
    const g = gene('A'); g.analysis_result.targets[0].summary.aligned_reads = 0;
    expect(comparisonRows([g], ['A'], 't1')[0].reads).toBe(0);
  });
  it('uses stored breakdown counts and the post-filter denominator when legacy summary percentages include substitutions in no-indel', () => {
    const g = gene('A'); const target = g.analysis_result.targets[0];
    target.summary.matched_reads = 200; target.summary.no_indel_pct = 55;
    target.breakdown = {no_indel:50, substitution:5, in_frame:10, out_of_frame:35};
    const row = comparisonRows([g], ['A'], 't1')[0]; expect(row.wt).toBe(50); expect(row.edited).toBe(50); expect(row.reads).toBe(100);
  });
  it('summarizes evidence without multiplying read fractions or claiming a genotype', () => {
    const rows = source().rows, stats = comparisonSummary(rows, 25);
    expect(stats.withEvidence).toBe(1); expect(stats.selected).toBe(2); expect(stats.range).toBe(30);
    expect(stats.mostWt?.name).toBe('7D'); expect(stats).not.toHaveProperty('pBoth');
  });
  it('handles arbitrary reference counts, clear selection, missing targets and separate groups', () => {
    const component = new HomoeologComparisonComponent(); component.genes = Array.from({length: 12}, (_, i) => gene(`R${i}`));
    expect(component.rows.length).toBe(12); component.toggle('R2'); expect(component.rows.length).toBe(11);
    component.selection = []; expect(component.rows).toEqual([]); component.chooseAll(); expect(component.rows.length).toBe(12);
    component.genes.push({ ...gene('Other'), homoeolog_group: 'Gene2' }); component.setGroup('Gene2'); expect(component.rows.map(r => r.name)).toEqual(['Other']);
  });
  it('applies threshold only to evidence count, not read fractions', () => {
    const component = new HomoeologComparisonComponent(); component.genes = [gene('A')]; const rows = structuredClone(component.rows);
    component.setThreshold(90); expect(component.stats.withEvidence).toBe(0); expect(component.rows).toEqual(rows);
    component.setThreshold(-10); expect(component.threshold).toBe(0); component.setThreshold('invalid'); expect(component.threshold).toBe(2);
  });
  it('excludes restorable curated groups from comparison and figures without modifying the original', () => {
    const g = gene('A'), key = groupKey('A', 't1', g.analysis_result.targets[0].top_groups[0].read_inner);
    const projected = withoutExcludedGroups([g], [key]);
    expect(projected[0].analysis_result.targets[0].top_groups).toEqual([]);
    expect(g.analysis_result.targets[0].top_groups).toHaveLength(1);
    expect(projected[0].analysis_result.targets[0].summary).toEqual(g.analysis_result.targets[0].summary);
  });
});

describe('figure snapshots and publication SVG', () => {
  it('captures an independent deep snapshot, including sequence tokens', () => {
    const data = source(), snapshot = captureFigureSource(data.label, data.rows);
    data.rows[0].target!.top_groups![0].tokens[0].val = 'CHANGED';
    expect(snapshot.rows[0].target!.top_groups![0].tokens[0].val).toBe('A'.repeat(80));
  });
  it('does not duplicate per-read detail arrays into every figure panel', () => {
    const data = source(); data.rows[0].target!.read_details = [{read_index:1, target_found:true, classification:'no_indel'}];
    const snapshot = captureFigureSource(data.label, data.rows);
    expect(snapshot.rows[0].target!.read_details).toEqual([]); expect(data.rows[0].target!.read_details).toHaveLength(1);
  });
  it.each(['profile', 'editing', 'summary', 'alleles'] as const)('renders %s from the selected snapshot, with no inferred joint metric', kind => {
    const svg = renderFigure([{ id: 1, kind, title: 'Panel', source: source() }], options);
    expect(svg).toContain('<svg'); expect(svg).toContain('7A'); expect(svg).toContain('7D'); expect(svg).not.toContain('7B');
    expect(svg).not.toMatch(/NaN|undefined|foreignObject|<script|Joint Knockout/);
  });
  it('escapes user-controlled titles, labels and reference names', () => {
    const data = source(); data.rows[0].name = '<script>'; data.label = '<img onerror="x">';
    const svg = renderFigure([{ id: 1, kind: 'profile', title: '<script>bad</script>', source: data }], { ...options, title: '<svg onload="x">' });
    expect(svg).not.toContain('<script>'); expect(svg).not.toContain('<img'); expect(svg).toContain('&lt;script&gt;');
  });
  it('moves panels immutably and ignores out-of-range moves', () => {
    const panels: any[] = [{id:1}, {id:2}, {id:3}]; expect(moveFigurePanel(panels, 0, 2).map(p => p.id)).toEqual([2,3,1]);
    expect(panels.map(p => p.id)).toEqual([1,2,3]); expect(moveFigurePanel(panels, -1, 2)).toEqual(panels);
  });
  it('preserves coordinate consumption for deletion, insertion and unobserved sequence', () => {
    const target = gene('A').analysis_result.targets[0]; target.cut_site_index = 12;
    target.top_groups[0].tokens = [{type:'unobserved', val:'XXXX'}, {type:'equal', val:'A'.repeat(8)}, {type:'insert', val:'GG'}, {type:'delete', val:'AA'}, {type:'equal', val:'A'.repeat(30)}];
    const cells = sequenceCells(target, 0, 10);
    expect(cells.slice(0,2).every(c => c.type === 'unobserved')).toBe(true);
    expect(cells.find(c => c.type === 'insert')?.text).toBe('+GG');
    expect(cells.filter(c => c.type === 'delete').map(c => c.text)).toEqual(['−','−']);
    expect(cells.filter(c => c.type !== 'insert')).toHaveLength(20);
  });
  it('display threshold omits rare groups without renormalizing remaining frequencies', () => {
    const data = source(); data.rows[0].target!.top_groups!.push({ ...data.rows[0].target!.top_groups![0], read_pct: 1.5, net_indel: -7 });
    const svg = renderFigure([{id:1, kind:'alleles', title:'Sequence', source:data}], options);
    expect(svg).toContain('0 bp · 50.0%'); expect(svg).not.toContain('-7 bp'); expect(svg).not.toContain('100.0%');
  });
  it('retains snapshots as result selection changes, and supports both layout columns', () => {
    const composer = new FigureComposerComponent({bypassSecurityTrustHtml: (v: string) => v} as any, {detectChanges:vi.fn()} as any);
    composer.source = source(); composer.addPanel(); composer.source = {label:'Another result', rows:[]}; composer.ngOnChanges();
    expect(composer.panels).toHaveLength(1); expect(composer.panels[0].source.label).toBe('Sample 1 · t1');
    composer.options.columns = 2; composer.refresh(); expect(composer.svg).toContain('width="1440"');
    composer.options.columns = 1; composer.refresh(); expect(composer.svg).toContain('width="780"');
  });
  it('clamps invalid editor values and limits panel count', () => {
    const composer = new FigureComposerComponent({bypassSecurityTrustHtml: (v: string) => v} as any, {detectChanges:vi.fn()} as any); composer.source = source();
    for (let i=0;i<15;i++) composer.addPanel(); expect(composer.panels).toHaveLength(12);
    composer.options.fontSize = NaN; composer.options.radius = -20; composer.refresh(); expect(composer.options.fontSize).toBe(14); expect(composer.options.radius).toBe(10);
  });
});

describe('two-visible-pane workspace', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  function setup() {
    vi.useFakeTimers(); vi.stubGlobal('window', {matchMedia: () => ({matches:false})});
    const state: any = { normalGenes:[gene('A'),gene('B')], lastRunParams:{}, allFileResults:[], selectedScopeIndex:-1 };
    const dashboard = new ResultDashboardComponent(state, {detectChanges:vi.fn()} as any, {run:(f: any)=>f()} as any);
    const panels = [{hidden:false,clientWidth:492,offsetLeft:0},{hidden:false,clientWidth:492,offsetLeft:508},{hidden:false,clientWidth:492,offsetLeft:1016}];
    const track = {children:panels,clientWidth:1000,scrollTo:vi.fn()}; dashboard.workspaceTrack = {nativeElement:track} as any;
    return {dashboard,track,panels};
  }
  it('shows Standard and Figure when no comparison is open', () => {
    const {dashboard} = setup(); dashboard.standardFigureOpen = true; expect(dashboard.workspacePanes).toEqual(['standard','analysis-figure']);
  });
  it('scrolls to Homeo + Figure, not three compressed columns', () => {
    const {dashboard,track} = setup(); dashboard.homoeologOpen = true; dashboard.homoeologFigureOpen = true;
    dashboard.focusWorkspace('homeo-figure'); expect(track.scrollTo).toHaveBeenCalledWith({left:508,behavior:'smooth'});
  });
  it('ignores hidden panes when navigating Standard + Figure', () => {
    const {dashboard,track,panels} = setup(); dashboard.standardFigureOpen = true; panels[1].hidden = true;
    dashboard.focusWorkspace('analysis-figure'); expect(track.scrollTo).toHaveBeenCalledWith({left:0,behavior:'smooth'});
  });
  it('opens four independent cards when both figure editors are open', () => {
    const {dashboard} = setup(); dashboard.homoeologOpen = true; dashboard.standardFigureOpen = true; dashboard.homoeologFigureOpen = true;
    expect(dashboard.workspacePanes).toEqual(['standard','homoeolog','analysis-figure','homeo-figure']);
  });
  it('uses one visible pane on narrow viewports', () => {
    const {dashboard,track,panels} = setup(); panels.forEach(p=>p.clientWidth=1000); dashboard.homoeologOpen = true; dashboard.homoeologFigureOpen = true;
    dashboard.focusWorkspace('homeo-figure'); expect(track.scrollTo).toHaveBeenCalledWith({left:1016,behavior:'smooth'});
  });
  it('returns from the rightmost pair to Standard + Homeo in one header drag', () => {
    const {dashboard,track,panels} = setup(); dashboard.homoeologOpen = true; dashboard.homoeologFigureOpen = true;
    Object.assign(track, {scrollLeft:508, firstElementChild:panels[0]}); dashboard.activeWorkspacePane = 'figure';
    dashboard.beginWorkspaceSwipe({target:{closest:()=>null}, currentTarget:{setPointerCapture:vi.fn()}, button:0, clientX:100,pointerId:1} as any);
    dashboard.endWorkspaceSwipe({clientX:250,pointerId:1} as any);
    expect(track.scrollTo).toHaveBeenCalledWith({left:0,behavior:'smooth'});
  });
});
