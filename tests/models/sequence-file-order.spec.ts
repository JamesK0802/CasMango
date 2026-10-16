import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compareSequenceNames, moveSequenceFile } from '../../src/app/models/sequence-file-order';
import { AnalysisPageComponent } from '../../src/app/pages/analysis-page/analysis-page.component';

describe('natural filename ordering and moves', () => {
  it('uses numeric ordering and ignores case', () => {
    expect(['sample10.fq', 'sample2.fq', 'sample1.fq'].sort(compareSequenceNames))
      .toEqual(['sample1.fq', 'sample2.fq', 'sample10.fq']);
    expect(compareSequenceNames('Sample.fq', 'sample.fq')).toBe(0);
  });
  it('moves before/after either direction without cloning or mutating inputs', () => {
    const a = {}, b = {}, c = {}, files = [a,b,c];
    expect(moveSequenceFile(files, a, c, true)).toEqual([b,c,a]);
    expect(moveSequenceFile(files, c, a)).toEqual([c,a,b]);
    expect(moveSequenceFile(files, a, c)).toEqual([b,a,c]);
    expect(files).toEqual([a,b,c]);
    expect(moveSequenceFile(files, a, a)).toBe(files);
    expect(moveSequenceFile(files, {}, a)).toBe(files);
    expect(moveSequenceFile([a,a,b,c], a, c, true)).toEqual([a,b,c,a]);
  });
});

describe('uploaded file order and rename table', () => {
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
  function component(platform = 'nanopore') {
    const page = Object.create(AnalysisPageComponent.prototype) as any;
    Object.defineProperty(page, 'sequencingPlatform', { value: platform });
    page.sequencePaths = new WeakMap();
    page.state = { selectedFiles: [], illuminaPairs: [] };
    page.collectionSort = null;
    return page;
  }
  const file = (name: string) => new File(['@r\nAC\n+\nII'], name);
  it('sorts the combined list after each batch, preserving files and folder paths', () => {
    const page = component(); const ten = file('sample10.fq'), two = file('sample2.fq'), one = file('sample1.fq');
    page.addSequencingFiles([ten,two]); page.addSequencingFiles([one, file('notes.txt')]);
    expect(page.state.selectedFiles).toEqual([one,two,ten]);
    const sameA = file('same.fq'), sameB = file('same.fq');
    page.sequencePaths.set(sameA, 'z/same.fq'); page.sequencePaths.set(sameB, 'a/same.fq');
    page.addSequencingFiles([sameA,sameB]);
    expect(page.state.selectedFiles.slice(0,2)).toEqual([sameB,sameA]);
  });
  it('keeps a manually reordered list when unsupported files are dropped', () => {
    const page = component(); const files = [file('b.fq'), file('a.fq')]; page.state.selectedFiles = files;
    page.addSequencingFiles([file('note.txt')]); expect(page.state.selectedFiles).toBe(files);
  });
  it('sorts Illumina pairs without changing R1/R2 pairing', () => {
    const page = component('illumina');
    page.addSequencingFiles([file('sample10_R2.fq'), file('sample2_R1.fq'), file('sample10_R1.fq'), file('sample2_R2.fq')]);
    expect(page.state.illuminaPairs.map((pair: any) => pair.name)).toEqual(['Sample 2', 'Sample 10']);
    expect(page.state.illuminaPairs[0].r1.name).toBe('sample2_R1.fq');
    expect(page.state.illuminaPairs[0].r2.name).toBe('sample2_R2.fq');
  });
  it('opens in displayed order, sorts entire rows and pastes into the displayed order', () => {
    vi.useFakeTimers();
    const page = component(); const b = file('b.fq.gz'), a = file('a.fastq');
    page.state.selectedFiles = [b,a]; page.openCollectFilesDialog();
    expect(page.collectionRows.map((row: any) => row.file)).toEqual([b,a]);
    page.collectionRows[0].newName = 'sample2'; page.collectionRows[1].newName = 'sample10';
    page.sortCollectionNames('currentName');
    expect(page.collectionRows.map((row: any) => [row.file, row.newName, row.extension]))
      .toEqual([[a,'sample10','.fastq'],[b,'sample2','.fq.gz']]);
    page.sortCollectionNames('currentName'); expect(page.collectionRows[0].file).toBe(b);
    page.sortCollectionNames('newName'); expect(page.collectionRows[0].file).toBe(b);
    page.sortCollectionNames('newName'); expect(page.collectionRows[0].file).toBe(a);
    page.pasteCollectionNames({ clipboardData: { getData: () => 'first\nsecond' }, preventDefault: vi.fn() }, 0);
    expect(page.collectionRows.map((row: any) => [row.file, row.newName])).toEqual([[a,'first'],[b,'second']]);
    expect(page.state.selectedFiles).toEqual([b,a]);
  });
});
