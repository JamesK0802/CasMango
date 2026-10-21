import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { applyIndelThreshold, thresholdGroups, mergeThresholdBaselines } from '../../src/app/models/indel-threshold';
import { emptyCurationConfig, groupKey } from '../../src/app/models/curation.model';
import { CurationService } from '../../src/app/services/curation.service';
import { ExcelExportService } from '../../src/app/services/excel-export.service';
import { AppStateService } from '../../src/app/services/app-state.service';
import { processFile } from '../../src/app/workers/core/analysis-pipeline';
import { findGrnaCutSite } from '../../src/app/workers/core/classifier';

vi.mock('file-saver', () => ({saveAs:vi.fn()}));
function rawTarget(): any {
  const groups = [80,15,4,1].map((count,i) => ({group_rank:i+1, read_inner:`SEQ${i}`, read_count:count, read_pct:count,
    classification:['No indel','In-frame indel','Out-of-frame indel','Substitution'][i], net_indel:[0,-3,-1,0][i], tokens:[]}));
  return { target_id:'t1', sgrna_seq:'AAAA', ref_sequence:'ACGT', cut_site_index:2,
    summary:{total_reads:110,matched_reads:100,aligned_reads:100,unmodified:80,modified:19,editing_efficiency:19,indel_editing_efficiency:19,
      no_indel_pct:80,substitution_pct:1,in_frame_pct:15,out_of_frame_pct:4,substitution_reads:1,failed_reads:10},
    breakdown:{no_indel:80,substitution:1,in_frame:15,out_of_frame:4,failed:10},
    top_groups:groups, unfiltered_top_groups:structuredClone(groups), threshold_data_complete:true, applied_indel_threshold:0 };
}
function gene(target = applyIndelThreshold(rawTarget(),2)): any {
  return {gene:'7A',reference_sequence:'AACCGG',assigned_read_count:100,analysis_result:{targets:[target]}};
}
function file(name = 'sample.fq'): any {
  return {fastq_file:name,multi_reference_result:{genes:[gene()],ambiguous_read_count:0,
    debug:{total_reads_parsed:110,phred_passed_count:110,anchor_matched_count:100}}};
}
function curate(files:any[], threshold:number, excluded:string[] = []) {
  const config=emptyCurationConfig(); config.indelThreshold=threshold; config.excludedGroups=excluded;
  return new CurationService().computeCuratedResult(files,[],0,0,0,0,config);
}
function state():any {
  const s=Object.create(AppStateService.prototype); s.activeMode='viewer';
  s.viewerSlot={genes:[],mergedGenes:[],allFileResults:[],selectedScopeIndex:-1,selectedGeneIndex:0,lastRunParams:{indelThreshold:2,dataType:'Test'}};
  s.ngZone={run:(fn:any)=>fn()}; s.resultsUpdated$={next:vi.fn()}; s.curationService=new CurationService(); return s;
}
const flow={rawReads:110,phredPassed:110,anchorMatched:100,assignedReads:100,ambiguousReads:0};
async function readWorkbook(params:any, scopes:any[], config?:any) {
  const service=new ExcelExportService(); const report=await service.exportToExcel(params,scopes,undefined,config);
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(await report.arrayBuffer());
  let json=''; wb.getWorksheet('.metadata')!.eachRow(row=>json+=row.getCell(1).text);
  return {service,report,wb,metadata:JSON.parse(json)};
}

describe('reversible post-processing frequency threshold',()=>{
  it.each([[0,[80,15,4,1]],[2,[80,15,4]],[5,[80,15]],[20,[80]]])('matches running post-cut rule at %s percent',(threshold,expected)=>{
    expect(thresholdGroups(rawTarget().top_groups,threshold as number).map(g=>g.read_count)).toEqual(expected);
  });
  it('restores filtered groups without rerunning alignment or mutating source evidence',()=>{
    const source=applyIndelThreshold(rawTarget(),2), before=structuredClone(source);
    expect(source.summary.aligned_reads).toBe(99);
    const restored=applyIndelThreshold(source,0);
    expect(restored.summary.aligned_reads).toBe(100); expect(restored.top_groups).toHaveLength(4);
    expect(restored.summary.substitution_pct).toBe(1); expect(source).toEqual(before);
  });
  it('keeps manual exclusions independent when threshold is raised and lowered',()=>{
    const files=[file()], before=structuredClone(files), excluded=[groupKey('7A','t1','SEQ1')];
    const high=curate(files,20,excluded).mergedGenes[0].analysis_result.targets[0]; expect(high.summary.aligned_reads).toBe(80);
    const low=curate(files,0,excluded).mergedGenes[0].analysis_result.targets[0];
    expect(low.summary.aligned_reads).toBe(85); expect(low.summary.in_frame_pct).toBe(0); expect(low.summary.substitution_reads).toBe(1);
    expect(files).toEqual(before);
  });
  it('does not convert low-frequency filtering into assignment ambiguity or change unique assigned reads',()=>{
    const result=curate([file()],20); expect(result.mergedGenes[0].assigned_read_count).toBe(100);
    expect(result.ambiguousReadCount).toBe(0); expect(result.mergedGenes[0].analysis_result.targets[0].summary.low_frequency_filtered).toBe(20);
  });
  it('preserves complete baseline counts while merging files/batches',()=>{
    const a=applyIndelThreshold(rawTarget(),2), b=applyIndelThreshold(rawTarget(),2); mergeThresholdBaselines(a,b);
    expect(a.unfiltered_top_groups!.map(g=>g.read_count)).toEqual([160,30,8,2]); expect(a.threshold_data_complete).toBe(true);
    expect(b.unfiltered_top_groups!.map(g=>g.read_count)).toEqual([80,15,4,1]);
    const result=curate([file('one.fq'),file('two.fq')],0);
    expect(result.mergedGenes[0].analysis_result.targets[0].summary.aligned_reads).toBe(200);
  });
  it('marks mixed legacy/new baselines incomplete rather than claiming to restore missing groups',()=>{
    const a=applyIndelThreshold(rawTarget(),2), b=applyIndelThreshold(rawTarget(),2); delete b.unfiltered_top_groups; delete b.threshold_data_complete;
    mergeThresholdBaselines(a,b); expect(a.threshold_data_complete).toBe(false);
  });
  it('supports reports with only a merged scope',()=>{
    const config=emptyCurationConfig(); config.indelThreshold=0;
    const result=new CurationService().computeCuratedResult([], [gene()],0,110,110,100,config);
    expect(result.mergedGenes[0].analysis_result.targets[0].summary.aligned_reads).toBe(100); expect(result.totalMergedRawReads).toBe(110);
  });
  it('does not silently fall back from an explicit zero when all groups are excluded',()=>{
    const source=rawTarget(), excluded=new Set<string>(source.top_groups.map((g:any)=>g.read_inner));
    const result=applyIndelThreshold(source,0,excluded); expect(result.summary.aligned_reads).toBe(0); expect(result.summary.editing_efficiency).toBe(0);
  });
});

describe('real analysis output retains the zero-threshold evidence',()=>{
  it('post-processes to the same visible counts as a direct analysis at each threshold',()=>{
    const guide='GATTACAGTCGATCGTACGA';
    const reference='ACGTTGCACTGATCGCGGATCCGTA'+guide+'AGTCCGATCATGCATGACCTAGTCA';
    const cut=findGrnaCutSite(reference,guide).cut_site;
    const variants=[reference,reference.slice(0,cut)+reference.slice(cut+1),reference.slice(0,cut)+(reference[cut]==='A'?'C':'A')+reference.slice(cut+1)];
    const reads=[...Array(100).fill(variants[0]),...Array(5).fill(variants[1]),variants[2]].map(seq=>({seq,qual:new Array(seq.length).fill(40)}));
    const genes=[{gene:'A',sequence:reference,targets:[{target_id:'t',sgrna_seq:guide,window_size:50}]}];
    const params={phredThreshold:20,indelThreshold:2,marginThreshold:0.01,windowSize:50};
    const analysed=processFile('actual.fq',reads,structuredClone(genes),params).multi_reference_result.genes[0].analysis_result.targets[0];
    expect(analysed.threshold_data_complete).toBe(true); expect(analysed.unfiltered_top_groups!.length).toBeGreaterThan(analysed.top_groups.length);
    for(const threshold of [0,2,10,100]) {
      const direct=processFile('actual.fq',reads,structuredClone(genes),{...params,indelThreshold:threshold}).multi_reference_result.genes[0].analysis_result.targets[0];
      const post=applyIndelThreshold(analysed as any,threshold);
      for(const key of ['aligned_reads','matched_reads','no_indel_pct','substitution_pct','in_frame_pct','out_of_frame_pct','editing_efficiency']) expect((post.summary as any)[key]).toBe((direct.summary as any)[key]);
      expect(post.top_groups!.map(g=>[g.read_inner,g.read_count,g.read_pct])).toEqual(direct.top_groups.map(g=>[g.read_inner,g.read_count,g.read_pct]));
    }
  });
});

describe('visible Excel vs zero-threshold restoration metadata',()=>{
  it('keeps visible sheets at the chosen threshold but serializes all groups and threshold zero',async()=>{
    const scopes=[{sheetName:'Merged',readFlow:flow,genes:[gene()]}], before=structuredClone(scopes);
    const {wb,metadata}=await readWorkbook({indelThreshold:2},scopes);
    const cells:string[]=[]; wb.getWorksheet('Merged')!.eachRow(r=>r.eachCell(c=>cells.push(String(c.value))));
    const label=cells.indexOf('Indel Threshold (%)'); expect(cells[label+1]).toBe('2');
    expect(metadata.params.indelThreshold).toBe(0); expect(metadata.params.exportedIndelThreshold).toBe(2); expect(metadata.params.thresholdRecoveryComplete).toBe(true);
    const target=metadata.scopes[0].genes[0].analysis_result.targets[0];
    expect(target.top_groups).toHaveLength(4); expect(target.summary.aligned_reads).toBe(100); expect(target.unfiltered_top_groups).toBeUndefined();
    expect(scopes).toEqual(before);
  });
  it('roundtrips with a zero-threshold baseline and allows Curate to change 0 → 20 → 0',async()=>{
    const scopes=[{sheetName:'Merged',readFlow:flow,genes:[gene()]},{sheetName:'sample.fq',readFlow:flow,genes:[gene()]}];
    const {service,report}=await readWorkbook({indelThreshold:2},scopes);
    const s=state(); s.loadResultData(await service.importFromExcel(report));
    expect(s.lastRunParams.indelThreshold).toBe(0); expect(s.genes[0].analysis_result.targets[0].summary.aligned_reads).toBe(100);
    s.enterCuratedView(); expect(s.thresholdRecoveryComplete).toBe(true);
    s.selectScope = undefined; s.selectedScopeIndex=0;
    s.setCuratedIndelThreshold(20); expect(s.genes[0].analysis_result.targets[0].summary.aligned_reads).toBe(80); expect(s.selectedScopeIndex).toBe(0);
    s.setCuratedIndelThreshold(0); expect(s.genes[0].analysis_result.targets[0].summary.aligned_reads).toBe(100);
    s.exitCuratedView(); expect(s.genes[0].analysis_result.targets[0].summary.aligned_reads).toBe(100);
  });
  it('marks old filtered reports incomplete, preserves available reads, and does not invent rare groups',async()=>{
    const legacy=applyIndelThreshold(rawTarget(),2); delete legacy.unfiltered_top_groups; delete legacy.threshold_data_complete;
    const {metadata}=await readWorkbook({indelThreshold:2},[{sheetName:'Merged',readFlow:flow,genes:[gene(legacy)]}]);
    expect(metadata.params.thresholdRecoveryComplete).toBe(false); expect(metadata.scopes[0].genes[0].analysis_result.targets[0].top_groups).toHaveLength(3);
    const s=state(); s.loadResultData(metadata); expect(s.thresholdRecoveryComplete).toBe(false);
  });
  it('curated export keeps manually removed groups out of both sheets and metadata but retains threshold-hidden groups',async()=>{
    const s=state(); s.handleAnalysisComplete({results:[file()]}); s.enterCuratedView();
    s.toggleGroupExclusion('7A','t1','SEQ1'); s.setCuratedIndelThreshold(20);
    const data=s.getExportData(); expect(data.params.indelThreshold).toBe(20);
    const {metadata}=await readWorkbook(data.params,data.scopes,s.curationConfig);
    const groups=metadata.scopes.find((scope:any)=>scope.sheetName==='sample.fq').genes[0].analysis_result.targets[0].top_groups;
    expect(groups.map((g:any)=>g.read_inner)).toEqual(['SEQ0','SEQ2','SEQ3']);
    expect(metadata.curationConfig).toBeNull(); expect(metadata.curationHistory.excludedGroups).toEqual([groupKey('7A','t1','SEQ1')]);
  });
  it('does not permit threshold changes outside a curated view',()=>{
    const s=state(); s.setCuratedIndelThreshold(20); expect(s.lastRunParams.indelThreshold).toBe(2);
  });
  it('never upgrades a legacy filtered baseline to complete after Curate is set to zero and re-exported',async()=>{
    const legacy=applyIndelThreshold(rawTarget(),2); delete legacy.unfiltered_top_groups; delete legacy.threshold_data_complete;
    const original=file(); original.multi_reference_result.genes=[gene(legacy)];
    const s=state(); s.handleAnalysisComplete({results:[original]}); s.enterCuratedView(); s.setCuratedIndelThreshold(0);
    expect(s.thresholdRecoveryComplete).toBe(false);
    const data=s.getExportData(), {metadata}=await readWorkbook(data.params,data.scopes,s.curationConfig);
    expect(metadata.params.indelThreshold).toBe(0); expect(metadata.params.thresholdRecoveryComplete).toBe(false);
    expect(metadata.scopes[0].genes[0].analysis_result.targets[0].top_groups).toHaveLength(3);
  });
});
