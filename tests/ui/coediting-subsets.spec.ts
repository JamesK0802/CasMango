import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { ElementRef } from '@angular/core';
import { CoeditingSubsetsComponent } from '../../src/app/components/result-dashboard/coediting-subsets.component';
import { ComparisonRow, homeologSubset, homeologSubsets, homeologCombination, renderFigure } from '../../src/app/components/result-dashboard/result-presentation';

const rows: ComparisonRow[] = [.2,.3,.4].map((p,i)=>({name:['4A','4B','4D'][i],reads:100,wt:100-p*100,inFrame:0,outOfFrame:p*100,substitution:0,edited:p*100}));
describe('specific co-editing combinations',()=>{
  it('partitions each intermediate count into exact reference combinations',()=>{
    const combinations=homeologSubsets(rows,['outOfFrame'],2);
    expect(combinations.items.map(item=>item.names)).toEqual([['4A','4B'],['4A','4D'],['4B','4D']]);
    [3.6,5.6,9.6].forEach((value,i)=>expect(combinations.items[i].percent).toBeCloseTo(value));
    expect(combinations.items.reduce((sum,item)=>sum+item.percent,0)).toBeCloseTo(homeologCombination(rows,['outOfFrame'])!.distribution[2].percent);
  });
  it('recalculates categories and rejects stale or invalid selections',()=>{
    expect(homeologSubset(rows,['wt'],['4B','4A'])!.names).toEqual(['4A','4B']);
    expect(homeologSubset(rows,['wt'],['4A','4B'])!.percent).toBeCloseTo(22.4);
    for(const names of [[],['missing'],['4A','4A'],['4A','4B','4D']]) expect(homeologSubset(rows,['outOfFrame'],names)).toBeNull();
    expect(homeologSubset(rows,[],['4A'])).toBeNull();
    expect(homeologSubsets(rows,['outOfFrame'],2,2)).toMatchObject({hasMore:true,items:expect.any(Array)});
    expect(homeologSubsets(rows,['outOfFrame'],2,2).items).toHaveLength(2);
  });
  it('toggles subsets without mutating the parent selection',()=>{
    const component=new CoeditingSubsetsComponent(new ElementRef({}));
    component.selected=[['4A','4B']]; const emit=vi.spyOn(component.selectedChange,'emit');
    component.toggle(['4B','4D']); expect(emit).toHaveBeenLastCalledWith([['4A','4B'],['4B','4D']]);
    component.toggle(['4B','4A']); expect(emit).toHaveBeenLastCalledWith([]);
    expect(component.selected).toEqual([['4A','4B']]);
  });
  it('includes chosen reference combinations and their probabilities in Figure export',()=>{
    const svg=renderFigure([{id:1,kind:'coediting',title:'Co-editing',source:{label:'Test',rows},coeditingMetric:['outOfFrame'],coeditingSubsets:[['4A','4B'],['missing']]}],{title:'Test',columns:1,fontSize:14,radius:20,groupLimit:5,minFrequency:2,palette:'okabe'});
    expect(svg).toContain('4A + 4B'); expect(svg).toContain('3.6%'); expect(svg).not.toContain('missing');
  });
});
