import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { CoeditingBasisComponent } from '../../src/app/components/result-dashboard/coediting-basis.component';
import { CoeditingCategory, homeologCombination, coeditingMetricLabel, ComparisonRow } from '../../src/app/components/result-dashboard/result-presentation';

const rows: ComparisonRow[] = [
  {name:'A',reads:100,wt:50,inFrame:10,outOfFrame:35,substitution:5,edited:50},
  {name:'B',reads:100,wt:80,inFrame:10,outOfFrame:5,substitution:5,edited:20}
];

describe('three independent co-editing category buttons', () => {
  it.each([1,2,3,4,5,6,7])('calculates selected category combination %s without substitutions', mask => {
    const categories: CoeditingCategory[] = ['wt','inFrame','outOfFrame'];
    const selected = categories.filter((_,i)=>mask & (1 << i));
    const rates = rows.map(row=>selected.reduce((sum,key)=>sum+row[key]!,0)/100);
    const combo = homeologCombination(rows,selected)!;
    expect(combo.all).toBeCloseTo(rates[0]*rates[1]*100);
    expect(combo.any).toBeCloseTo((1-(1-rates[0])*(1-rates[1]))*100);
    expect(combo.distribution.reduce((sum,item)=>sum+item.percent,0)).toBeCloseTo(100);
  });
  it('does not produce a model when every category is deselected', () => {
    expect(homeologCombination(rows,[])).toBeNull();
    expect(coeditingMetricLabel(['wt','outOfFrame'])).toBe('WT + Out-of-frame');
  });
  it('toggles independent buttons without mutating the parent selection', () => {
    const component = new CoeditingBasisComponent(); component.selected=['inFrame','outOfFrame'];
    const emit = vi.spyOn(component.selectedChange,'emit');
    component.toggle('wt'); expect(emit).toHaveBeenLastCalledWith(['wt','inFrame','outOfFrame']);
    expect(component.selected).toEqual(['inFrame','outOfFrame']);
    component.toggle('inFrame'); expect(emit).toHaveBeenLastCalledWith(['outOfFrame']);
    expect(component.categories.map(item=>item.label)).toEqual(['WT','In-frame','Out-of-frame']);
  });
  it('keeps the Figure shell wide even without an open Homeolog result window', () => {
    expect(readFileSync('src/app/app.css','utf8')).toContain('.crispr-body:has(.figure-workspace:not([hidden]))');
  });
});
