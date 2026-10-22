import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AppStateService } from '../../src/app/services/app-state.service';

function setup(platform: 'nanopore' | 'illumina', homeolog: boolean, curated: boolean, scope: number) {
  const state = Object.create(AppStateService.prototype) as any;
  state.activeMode = 'analysis'; state.isCuratedView = curated;
  state.analysisSlot = { lastRunParams: {sequencingPlatform: platform, homoeologMode: homeolog, dataType: platform === 'illumina' ? 'paired-end' : 'single-end'}, selectedScopeIndex: scope };
  state.selectedFiles = platform === 'nanopore' ? [new File(['@r\nACGT\n+\nIIII'], 'one.fq'),new File(['@r\nACGT\n+\nIIII'], 'two.fq')] : [];
  state.illuminaPairs = platform === 'illumina' ? [0,1].map(i => ({id:String(i),r1:new File(['@r\nACGT\n+\nIIII'],`${i}_R1.fq`),r2:new File(['@r\nACGT\n+\nIIII'],`${i}_R2.fq`)})) : [];
  return state;
}

describe('FASTQ actions across analysis combinations', () => {
  const cases = (['nanopore','illumina'] as const).flatMap(platform => [false,true].flatMap(homeolog => [false,true].flatMap(curated => [-1,0,1].map(scope => ({platform,homeolog,curated,scope})))));
  it.each(cases)('retains original sources for $platform / homeolog=$homeolog / curated=$curated / scope=$scope', ({platform,homeolog,curated,scope}) => {
    const state = setup(platform,homeolog,curated,scope);
    expect(state.hasFastqExportSources).toBe(true);
    const sources = state.fastqExportSources();
    expect(sources).toHaveLength(scope === -1 ? 2 : 1);
    if (scope !== -1) expect(sources[0]).toBe((platform === 'illumina' ? state.illuminaPairs : state.selectedFiles)[scope]);
  });
  it.each(['nanopore','illumina'] as const)('does not borrow unrelated %s sources for imported reports', platform => {
    const state = setup(platform,true,true,-1);
    state.viewerSlot = {...state.analysisSlot}; state.activeMode = 'viewer';
    expect(state.hasFastqExportSources).toBe(false);
  });
  it('supports an existing paired-end run without the platform metadata', () => {
    const state = setup('illumina',true,false,-1);
    delete state.lastRunParams.sequencingPlatform;
    expect(state.hasFastqExportSources).toBe(true);
    state.illuminaPairs = []; expect(state.hasFastqExportSources).toBe(false);
  });
  it('uses the same source check for target and group actions, and records the run platform', () => {
    const template = readFileSync('src/app/components/result-dashboard/result-dashboard.component.html','utf8');
    expect(template.match(/state.guideReadActionsPreview \|\| state.hasFastqExportSources/g)).toHaveLength(2);
    expect(template).not.toContain('state.selectedFiles.length > 0');
    const page = readFileSync('src/app/pages/analysis-page/analysis-page.component.ts','utf8');
    expect(page).toContain('this.state.lastRunParams = {\n      sequencingPlatform: platform,');
  });
});
