import '@angular/compiler';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { comparisonRows, comparisonSummary, homeologCombination, captureFigureSource, renderFigure, sequenceCells, moveFigurePanel, FigureOptions, withoutExcludedGroups, figureRows, figureRowChoices, figurePanelLayout, FigurePanel } from '../../src/app/components/result-dashboard/result-presentation';
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
  it('compares an arbitrary combination and models independent events without modifying read fractions', () => {
    const rows = source().rows, original = structuredClone(rows), combo = homeologCombination(rows)!;
    expect(combo.weakest.name).toBe('7D'); expect(combo.gap).toBe(30);
    expect(combo.all).toBeCloseTo(6.75); expect(combo.any).toBeCloseTo(53.25);
    expect(combo.distribution.map(d => d.percent).reduce((a,b)=>a+b,0)).toBeCloseTo(100);
    expect(rows).toEqual(original);
    expect(homeologCombination(rows, ['inFrame','outOfFrame'])!.all).toBeCloseTo(6.75);
    expect(homeologCombination(rows, ['outOfFrame'])!.all).toBeCloseTo(1.75);
  });
  it('switches the displayed co-editing basis without changing the read results', () => {
    const component = new HomoeologComparisonComponent(); component.genes = [gene('7A'), gene('7D',80)];
    const original = structuredClone(component.genes);
    expect(component.combination!.all).toBeCloseTo(6.75);
    component.coeditingMetric = ['outOfFrame'];
    expect(component.metricLabel).toBe('Out-of-frame'); expect(component.combination!.all).toBeCloseTo(1.75);
    component.coeditingMetric = ['inFrame','outOfFrame'];
    expect(component.metricLabel).toBe('In-frame + Out-of-frame'); expect(component.combination!.all).toBeCloseTo(6.75);
    expect(component.genes).toEqual(original);
  });
  it('does not silently ignore missing targets, zero depth or a single selection', () => {
    expect(homeologCombination(comparisonRows([gene('A'),gene('B',50,0)], ['A','B'], 't1'))).toBeNull();
    expect(homeologCombination(source().rows.slice(0,1))).toBeNull();
    expect(homeologCombination([])).toBeNull();
  });
  it('normalizes the independent count distribution at 0/100 percent and with many loci', () => {
    const rows = comparisonRows(Array.from({length:20}, (_,i)=>gene(`R${i}`,50)), Array.from({length:20},(_,i)=>`R${i}`),'t1');
    const result = homeologCombination(rows)!;
    expect(result.distribution.reduce((n,d)=>n+d.percent,0)).toBeCloseTo(100);
    const extremes = rows.slice(0,2).map((row,i)=>({...row,inFrame:0,outOfFrame:i*100}));
    expect(homeologCombination(extremes)!.distribution.map(d=>d.percent)).toEqual([0,100,0]);
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
  it('captures each co-editing panel basis and renders the matching calculation', () => {
    const composer = new FigureComposerComponent({bypassSecurityTrustHtml:(v:string)=>v} as any, {detectChanges:vi.fn()} as any);
    composer.source = source(); composer.kind = 'coediting'; composer.coeditingMetric = ['outOfFrame']; composer.addPanel();
    expect(composer.panels[0].coeditingMetric).toEqual(['outOfFrame']);
    expect(composer.svg).toContain('Out-of-frame'); expect(composer.svg).toContain(`All 2: ${homeologCombination(source().rows, ['outOfFrame'])!.all.toFixed(1)}%`);
    composer.coeditingMetric = ['inFrame','outOfFrame']; composer.addPanel();
    expect(composer.panels[0].coeditingMetric).toEqual(['outOfFrame']);
    expect(composer.panels[1].coeditingMetric).toEqual(['inFrame','outOfFrame']);
    expect(composer.svg).toContain('In-frame + Out-of-frame'); expect(composer.svg).toContain('All 2: 6.8%');
  });
  it('renders a selected-combination co-editing model with explicit assumptions', () => {
    const svg = renderFigure([{id:1,kind:'coediting',title:'Co-editing model',source:source()}],options);
    expect(svg).toContain('All 2: 6.8%'); expect(svg).toContain('At least one: 53.3%');
    expect(svg).toContain('independence assumed'); expect(svg).toContain('not measured same-cell');
    expect(svg).toContain('0 / 2'); expect(svg).toContain('2 / 2');
    const missing = source(); missing.rows[0].edited = null;
    expect(renderFigure([{id:1,kind:'coediting',title:'Model',source:missing}],options)).toContain('with aligned reads');
  });
  it('offers combination panels without accepting a single-reference co-editing panel', () => {
    const composer = new FigureComposerComponent({bypassSecurityTrustHtml:(v:string)=>v} as any, {detectChanges:vi.fn()} as any);
    composer.source = source(); composer.kind = 'coediting'; composer.addPanel();
    expect(composer.panels[0].kind).toBe('coediting');
    composer.source = {...source(),rows:source().rows.slice(0,1)}; composer.addPanel();
    expect(composer.panels).toHaveLength(1);
  });
  it('changes preview size without changing export SVG or panel snapshots', () => {
    const composer = new FigureComposerComponent({bypassSecurityTrustHtml:(v:string)=>v} as any, {detectChanges:vi.fn()} as any);
    composer.source = source(); composer.active = true; composer.ngOnChanges();
    const svg = composer.svg, panels = structuredClone(composer.panels);
    composer.setPreviewZoom(50); expect(composer.previewWidth).toBe(390);
    composer.fitWidth = true; composer.setPreviewZoom(200); expect(composer.fitWidth).toBe(false);
    expect(composer.previewWidth).toBe(1560);
    composer.setPreviewZoom(0); expect(composer.previewZoom).toBe(25);
    composer.setPreviewZoom('bad'); expect(composer.previewZoom).toBe(100);
    expect(composer.svg).toBe(svg); expect(composer.panels).toEqual(panels);
  });
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
    expect(cells.filter(c => c.type === 'insert').map(c=>c.text).join('')).toBe('GG');
    expect(cells.filter(c => c.type === 'delete').map(c => c.text)).toEqual(['-','-']);
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
    composer.options.layout = 'columns:2'; composer.refresh(); expect(composer.svg).toContain('width="1440"');
    composer.options.layout = 'columns:1'; composer.refresh(); expect(composer.svg).toContain('width="780"');
  });
  it('clamps invalid editor values and limits panel count', () => {
    const composer = new FigureComposerComponent({bypassSecurityTrustHtml: (v: string) => v} as any, {detectChanges:vi.fn()} as any); composer.source = source();
    for (let i=0;i<15;i++) composer.addPanel(); expect(composer.panels).toHaveLength(12);
    composer.options.fontSize = NaN; composer.options.radius = -20; composer.refresh(); expect(composer.options.fontSize).toBe(14); expect(composer.options.radius).toBe(10);
  });
});

describe('figure source selection and initial panels', () => {
  it('previews exports during free guide exploration without saving a file', async () => {
    const composer = new FigureComposerComponent({bypassSecurityTrustHtml: (v: string) => v} as any, {detectChanges:vi.fn()} as any);
    composer.previewOnly = true;
    const save = vi.spyOn(composer as any, 'save');
    composer.downloadSvg(); await composer.downloadPng();
    expect(save).not.toHaveBeenCalled(); expect(composer.exportPreviewMessage).toContain('no file downloaded');
  });
  it('starts empty, adds All 4 on request and preserves deletions and mixed snapshots', () => {
    const composer = new FigureComposerComponent({bypassSecurityTrustHtml: (v: string) => v} as any, {detectChanges:vi.fn()} as any);
    composer.genes = [gene('7A'), gene('7D')]; composer.source = source(); composer.active = true;
    composer.ngOnChanges();
    expect(composer.panels).toEqual([]);
    composer.sourceChoice = 'ref:7A'; composer.chooseSource();
    composer.kind = 'all'; composer.addPanel();
    expect(composer.panels.map(p => p.kind)).toEqual(['profile', 'editing', 'alleles', 'summary']);
    const original = structuredClone(composer.panels);
    composer.sourceChoice = 'ref:7D'; composer.chooseSource(); composer.kind = 'profile'; composer.addPanel();
    expect(composer.panels[4].source.rows.map(r => r.name)).toEqual(['7D']);
    expect(composer.panels.slice(0, 4)).toEqual(original);
    composer.remove(0); composer.ngOnChanges(); expect(composer.panels).toHaveLength(4);
    composer.sourceChoice = 'homeo'; composer.selectedRefs = ['7A', '7D']; composer.chooseSource(); composer.addPanel();
    expect(composer.panels[4].source.rows).toHaveLength(2);
  });
  it('adds All 5 atomically for Homeolog sources and respects the 12-panel cap', () => {
    const composer = new FigureComposerComponent({bypassSecurityTrustHtml:(v:string)=>v} as any,{detectChanges:vi.fn()} as any);
    composer.genes = [gene('7A'),gene('7D')]; composer.source = source(); composer.active = true; composer.ngOnChanges();
    composer.kind = 'all'; composer.addPanel();
    expect(composer.panels.map(p=>p.kind)).toEqual(['profile','editing','alleles','summary','coediting']);
    composer.addPanel(); expect(composer.panels).toHaveLength(10);
    expect(composer.canAddPanels).toBe(false); composer.addPanel(); expect(composer.panels).toHaveLength(10);
    composer.kind = 'profile'; composer.addPanel(); composer.addPanel(); expect(composer.panels).toHaveLength(12);
  });
});

describe('automatic and custom Figure rows', () => {
  it('reserves two vertical cells for sequences and fills the cells next to them', () => {
    const panels: FigurePanel[] = ['profile','editing','alleles','summary','coediting'].map((kind,i)=>({id:i,kind:kind as any,title:kind,source:source()}));
    const grid = figurePanelLayout(panels, {...options,columns:0,layout:'auto'});
    expect(grid.slots.map(slot=>[slot.row,slot.col,slot.span])).toEqual([[0,0,1],[0,1,1],[0,2,2],[1,0,1],[1,1,1]]);
    expect(grid.slots[2].height).toBe(grid.slots[0].height * 2 + 24);
    for (let a=0;a<grid.slots.length;a++) for(let b=a+1;b<grid.slots.length;b++) {
      const x=grid.slots[a],y=grid.slots[b];
      expect(x.x+x.width<=y.x || y.x+y.width<=x.x || x.y+x.height<=y.y || y.y+y.height<=x.y).toBe(true);
    }
    expect(renderFigure(panels,{...options,columns:0,layout:'auto'})).toContain('data-row-span="2"');
  });
  it('reflows two-cell sequences after drag/drop and preserves their co-editing basis', () => {
    const composer = new FigureComposerComponent({bypassSecurityTrustHtml:(v:string)=>v} as any,{detectChanges:vi.fn()} as any);
    composer.source=source();composer.genes=[gene('7A'),gene('7D')];composer.active=true;composer.ngOnChanges();composer.kind='all';composer.coeditingMetric=['outOfFrame'];composer.addPanel();
    composer.startDrag({dataTransfer:{setData:vi.fn()}} as any,2);
    composer.dropPanel({preventDefault:vi.fn(),stopPropagation:vi.fn()} as any,0,true);
    expect(composer.panels[0].kind).toBe('alleles'); expect(composer.previewLayout.slots[0].span).toBe(2);
    expect(composer.panels[2].kind).toBe('profile');
    expect(composer.dragIndex).toBeNull(); expect(composer.panels.find(p=>p.kind==='coediting')!.coeditingMetric).toEqual(['outOfFrame']);
  });
  it.each([[4,[2,2]],[5,[3,2]],[6,[3,3]],[7,[4,3]],[8,[4,4]],[9,[3,3,3]],[10,[4,3,3]],[11,[4,4,3]],[12,[4,4,4]]] as const)('balances %s panels without singleton rows', (count,expected) => {
    expect(figureRows(count,{columns:0,layout:'auto'})).toEqual(expected);
    const panels = Array.from({length:count},(_,i)=>({id:i,kind:'profile' as const,title:'Panel',source:source()}));
    const svg = renderFigure(panels,{...options,layout:'auto'});
    const actual = [...svg.matchAll(/data-row="(\d+)"/g)].map(m=>Number(m[1]));
    expect(expected.map((_,row)=>actual.filter(value=>value===row).length)).toEqual(expected);
    expect(svg).not.toMatch(/NaN|undefined/);
  });
  it('permits explicit rows and fixed columns, falling back safely for stale row choices', () => {
    expect(figureRows(5,{columns:0,layout:'rows:2+2+1'})).toEqual([2,2,1]);
    expect(figureRows(5,{columns:0,layout:'columns:2'})).toEqual([2,2,1]);
    expect(figureRows(5,{columns:0,layout:'rows:4+4'})).toEqual([3,2]);
    expect(figureRowChoices(5)).toContain('rows:3+2'); expect(figureRowChoices(12)).toContain('rows:4+4+4');
    expect(figureRows(0,{columns:0})).toEqual([]);
  });
});

describe('two-visible-pane workspace', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  function setup() {
    vi.useFakeTimers(); vi.stubGlobal('window', {matchMedia: () => ({matches:false})});
    const state: any = { normalGenes:[gene('A'),gene('B')], genes:[gene('A'),gene('B')], currentGene:gene('A'), selectedTarget:gene('A').analysis_result.targets[0], lastRunParams:{homoeologMode:true}, allFileResults:[], selectedScopeIndex:-1 };
    const dashboard = new ResultDashboardComponent(state, {detectChanges:vi.fn()} as any, {run:(f: any)=>f()} as any);
    const panels = [{hidden:false,clientWidth:492,offsetLeft:0},{hidden:false,clientWidth:492,offsetLeft:508},{hidden:false,clientWidth:492,offsetLeft:1016}];
    const track = {children:panels,clientWidth:1000,scrollTo:vi.fn()}; dashboard.workspaceTrack = {nativeElement:track} as any;
    return {dashboard,track,panels};
  }
  it('opens one shared Figure workspace, not additional result cards', () => {
    const {dashboard} = setup(); dashboard.toggleFigure();
    expect(dashboard.showFigure).toBe(true); expect(dashboard.workspacePanes).toEqual(['standard']);
    expect(dashboard.figureInitialSource.rows[0].name).toBe('A');
  });
  it('keeps hidden Homeolog toggles from affecting an open Figure', () => {
    const {dashboard,track} = setup(); dashboard.toggleFigure(); track.scrollTo.mockClear();
    const initial = dashboard.figureInitialSource;
    dashboard.toggleHomoeolog();
    expect(dashboard.homoeologOpen).toBe(false); expect(dashboard.figureOpen).toBe(true);
    expect(dashboard.figureInitialSource).toBe(initial); expect(track.scrollTo).not.toHaveBeenCalled();
  });
  it('makes Homeolog comparison available only for Homeolog-mode results', () => {
    const {dashboard} = setup();
    expect(dashboard.hasHomoeologResults).toBe(true);
    (dashboard.state as any).lastRunParams = {homoeologMode:false};
    expect(dashboard.hasHomoeologResults).toBe(false);
  });
  it('uses the selected combination as the initial shared source', () => {
    const {dashboard} = setup(); dashboard.homoeologOpen = true;
    dashboard.comparison = {figureSource:source()} as any; dashboard.toggleFigure();
    expect(dashboard.figureInitialSource.rows).toHaveLength(2);
    expect(dashboard.workspacePanes).toEqual(['standard','homoeolog']);
    dashboard.toggleFigure(); expect(dashboard.showFigure).toBe(false); expect(dashboard.showHomoeolog).toBe(true);
  });
  it('uses one visible pane on narrow viewports', () => {
    const {dashboard,track,panels} = setup(); panels.forEach(p=>p.clientWidth=1000); dashboard.homoeologOpen = true;
    dashboard.focusWorkspace('homoeolog'); expect(track.scrollTo).toHaveBeenCalledWith({left:508,behavior:'smooth'});
  });
  it('returns from the rightmost pair to Standard + Homeo in one header drag', () => {
    const {dashboard,track,panels} = setup(); dashboard.homoeologOpen = true;
    Object.assign(track, {scrollLeft:508, firstElementChild:panels[0]}); dashboard.activeWorkspacePane = 'figure';
    dashboard.beginWorkspaceSwipe({target:{closest:()=>null}, currentTarget:{setPointerCapture:vi.fn()}, button:0, clientX:100,pointerId:1} as any);
    dashboard.endWorkspaceSwipe({clientX:250,pointerId:1} as any);
    expect(track.scrollTo).toHaveBeenCalledWith({left:0,behavior:'smooth'});
  });
});

it('renders annotation insertions inline, deletions as single-width hyphens and substitutions blue/underlined',()=>{
 const data=source(),target=data.rows[0].target!;target.ref_sequence='ACCT';target.cut_site_index=2;
 target.top_groups=[{read_inner:'ACGCT',net_indel:1,read_count:50,read_pct:50,classification:'out_of_frame',group_rank:1,tokens:[{type:'equal',val:'AC'},{type:'insert',val:'G'},{type:'equal',val:'CT'}]},{read_inner:'AT-T',net_indel:-1,read_count:40,read_pct:40,classification:'out_of_frame',group_rank:2,tokens:[{type:'equal',val:'A'},{type:'substitute',val:'T'},{type:'delete',val:'C'},{type:'equal',val:'T'}]}];
 expect(sequenceCells(target,0,20,4).map(c=>c.text).join('')).toBe('ACGCT');
 const svg=renderFigure([{id:1,kind:'alleles',title:'Annotation',source:data}],{...options,columns:1,sequenceBases:4});
 expect(svg).not.toContain('stroke-dasharray="3 3"');
 const bases=[...svg.matchAll(/<text ([^>]*data-annotation-base="([^"]+)"[^>]*)>([^<]*)<\/text>/g)];
 const inserted=bases.find(m=>m[2]==='insert')!,deleted=bases.find(m=>m[2]==='delete')!,sub=bases.find(m=>m[2]==='substitute')!;
 expect(inserted[3]).toBe('G');expect(deleted[3]).toBe('-');expect(inserted[1]).toContain('fill="#dc2626"');expect(deleted[1]).toContain('fill="#dc2626"');expect(sub[1]).toContain('fill="#2563eb"');expect(svg).toContain('data-annotation-underline="substitute"');
 expect(new Set(bases.slice(0,9).map(m=>/font-size="([^"]+)"/.exec(m[1])![1])).size).toBe(1);
 expect(new Set(bases.slice(0,9).map(m=>/ y="([^"]+)"/.exec(' '+m[1])![1])).size).toBe(2); // reference and insertion row
});
it('clips an exact odd annotation span to the stored analysis window without changing the results',()=>{
 const data=source(),target=data.rows[0].target!;target.cut_site_index=2;target.ref_sequence='ACGTACGTAC';target.top_groups![0].tokens=[{type:'equal',val:target.ref_sequence}];const before=structuredClone(data);
 expect(sequenceCells(target,0,20,7)).toHaveLength(7);expect(sequenceCells(target,0,20,999)).toHaveLength(10);
 const c=new FigureComposerComponent({bypassSecurityTrustHtml:(v:string)=>v}as any,{detectChanges:vi.fn()}as any);c.source=data;c.kind='alleles';c.addPanel();c.setAnnotationBases(999);expect(c.options.sequenceBases).toBe(10);c.setAnnotationBases(7);expect(c.annotationBases).toBe(7);expect(data).toEqual(before);
});
it('annotation span leaves every other figure type unchanged',()=>{
 for(const kind of ['profile','editing','summary','coediting']as const){const panels=[{id:1,kind,title:kind,source:source()}];expect(renderFigure(panels,{...options,sequenceBases:5})).toBe(renderFigure(panels,{...options,sequenceBases:80}));}
});
it('adds gRNA replicate panels independently without changing reference annotation span or group limits',()=>{const c=new FigureComposerComponent({bypassSecurityTrustHtml:(v:string)=>v}as any,{detectChanges:vi.fn()}as any),g=gene('A');const t=g.analysis_result.targets[0];t.ref_sequence='CCGACGTACGG';t.display_sgrna_seq='ACGTAC';t.grna_start_index=3;t.top_groups[0].tokens=[{type:'equal',val:t.ref_sequence}];c.genes=[g];c.selectedRefs=['A'];c.targetChoice='t1';c.replicateFiles=['C1.fq','C2.fq'].map(sample=>({sample,genes:[g]}));c.options.sequenceBases=7;c.options.groupLimit=3;c.kind='guide-alleles';c.kindChanged();expect(c.selectedSource.rows[0].guideReplicates).toHaveLength(2);c.addPanel();expect(c.panels[0].kind).toBe('guide-alleles');c.setAnnotationBases(9);c.setGroupLimit(20);expect(c.options.sequenceBases).toBe(7);expect(c.options.groupLimit).toBe(3);expect(c.options.guideSequenceBases).toBe(9);expect(c.options.guideGroupLimit).toBe(20);g.analysis_result.targets[0].top_groups=[];expect(c.panels[0].source.rows[0].guideReplicates![0].target.top_groups).toHaveLength(1);});
it('keeps replicate input identities stable across change detection and preserves report membership separately from curated groups',()=>{const g=gene('A'),key=JSON.stringify(['A','t1']),file={fastq_file:'C1.fq',multi_reference_result:{genes:[g]},guideFigureSelections:{[key]:{sequences:['visible']}}},state:any={allFileResults:[file],isCuratedView:false,isFileExcluded:()=>false},d=new ResultDashboardComponent(state,{}as any,{}as any),first=d.figureReplicateFiles;expect(d.figureReplicateFiles).toBe(first);expect((first[0].genes[0].analysis_result.targets[0]as any).guideReportGroups).toEqual(['visible']);state.isCuratedView=true;state.curationConfig={excludedGroups:[]};const curated=d.figureReplicateFiles;expect(curated).not.toBe(first);expect((curated[0].genes[0].analysis_result.targets[0]as any).guideReportGroups).toBeUndefined();expect(d.figureReplicateFiles).toBe(curated);file.fastq_file='C2.fq';expect(d.figureReplicateFiles[0].sample).toBe('C2.fq');});
it('lays out the independent gRNA annotation in two columns automatically without changing the other figure grids',()=>{const panels=Array.from({length:4},(_,i)=>({id:i,kind:'guide-alleles' as const,title:'gRNA',source:source()})),layout=figurePanelLayout(panels,{...options,columns:0,layout:'auto'});expect(layout.slots.map(s=>s.col)).toEqual([0,1,0,1]);expect(layout.slots.map(s=>s.row)).toEqual([0,0,2,2]);});
