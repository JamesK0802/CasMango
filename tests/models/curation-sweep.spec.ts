import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { CurationSweep, curationRange } from '../../src/app/models/curation-sweep';
import { emptyCurationConfig } from '../../src/app/models/curation.model';
import { AppStateService } from '../../src/app/services/app-state.service';

describe('curation sweep', () => {
  it('collects each visited item once without crossing categories', () => {
    const sweep = new CurationSweep('group', true);
    expect(sweep.add({ kind: 'group', key: 'g::t::ACGT' })).toBe(true);
    expect(sweep.add({ kind: 'group', key: 'g::t::ACGT' })).toBe(false);
    expect(sweep.add({ kind: 'file', key: 'file.fq' })).toBe(false);
    sweep.add({ kind: 'group', key: 'g::t::TGCA' });
    expect(sweep.items.size).toBe(2);
    expect(sweep.excluded).toBe(true);
  });
  it('resolves shift ranges forward and backward using stable keys', () => {
    expect(curationRange(['a','b','c','d'], 'c', 'a')).toEqual(['a','b','c']);
    expect(curationRange(['a','b','c','d'], 'b', 'd')).toEqual(['b','c','d']);
    expect(curationRange(['a','b'], 'missing', 'b')).toEqual(['b']);
  });
});

describe('atomic bulk curation', () => {
  function state() {
    const service = Object.create(AppStateService.prototype) as AppStateService;
    service.isCuratedView = true;
    service.curationConfig = emptyCurationConfig();
    service.recalculateCuratedView = vi.fn();
    return service;
  }
  it('applies one recalculation for an entire group sweep and preserves exact keys', () => {
    const service = state();
    service.curationConfig!.excludedFiles = ['existing.fq'];
    service.setCurationExclusions([{ kind: 'group', key: 'G::T::ACGT' }, { kind: 'group', key: 'G::T::TGCA' }, { kind: 'group', key: 'G::T::ACGT' }], true);
    expect(service.curationConfig!.excludedGroups).toEqual(['G::T::ACGT','G::T::TGCA']);
    expect(service.curationConfig!.excludedFiles).toEqual(['existing.fq']);
    expect(service.recalculateCuratedView).toHaveBeenCalledTimes(1);
  });
  it('restores only requested entries and never toggles entries already in the desired state', () => {
    const service = state(); service.curationConfig!.excludedGenes = ['one','two','three'];
    service.setCurationExclusions([{ kind: 'gene', key: 'one' }, { kind: 'gene', key: 'two' }], false);
    expect(service.curationConfig!.excludedGenes).toEqual(['three']);
    service.setCurationExclusions([{ kind: 'gene', key: 'three' }], true);
    expect(service.recalculateCuratedView).toHaveBeenCalledTimes(1);
  });
  it('does nothing outside curated view', () => {
    const service = state(); service.isCuratedView = false;
    service.setCurationExclusions([{ kind: 'file', key: 'keep.fq' }], true);
    expect(service.curationConfig!.excludedFiles).toEqual([]);
    expect(service.recalculateCuratedView).not.toHaveBeenCalled();
  });
});
