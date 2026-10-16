import {describe, expect, it} from 'vitest';
import {clearClassifierCache, isReadUsable, reverseComplement} from '../../src/app/workers/core/classifier';
import {classifyMutationWithAlignment} from '../../src/app/workers/core/analyzer';

function dna(size: number, seed = 1729): string {
  let state = seed;
  return Array.from({length: size}, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return 'ACGT'[state >>> 30];
  }).join('');
}
const reference = dna(1200);
const change = (base: string) => 'ACGT'[('ACGT'.indexOf(base) + 1) % 4];
const junction = reference.substring(0, 300) + reference.substring(900);
const noisy = change(junction[0]) + junction.substring(1, junction.length - 1) + change(junction.at(-1)!);
const quality = (read: string, q = 40) => new Uint8Array(read.length).fill(q);

describe('Noisy observed flanks cannot be rejected by an exact-seed/constant-offset gate', () => {
  for (const reverse of [false, true]) {
    it(`recovers a single continuous deletion with terminal SNPs (${reverse ? 'reverse' : 'forward'})`, () => {
      clearClassifierCache();
      const seq = reverse ? reverseComplement(noisy) : noisy;
      const [ok, reason, obs] = isReadUsable(seq, quality(seq), reference, 20, '', 600);
      expect(reason).toBe('ok'); expect(ok).toBe(true);
      const result = classifyMutationWithAlignment(reference, obs!.read_window, obs!.left_x, obs!.right_x);
      expect(result.net_indel).toBe(-600);
      expect(result.tokens.filter(t => t.type === 'delete').map(t => t.val.length)).toEqual([600]);
      expect(result.tokens.filter(t => t.type === 'insert')).toHaveLength(0);
      expect(obs!.left_x).toBe(0); expect(obs!.right_x).toBe(0);
    });
  }
  it('marks genuinely missing terminal bases unknown, not deleted', () => {
    const seq = junction.substring(1, junction.length - 1);
    const [ok, , obs] = isReadUsable(seq, quality(seq), reference, 20, '', 600);
    expect(ok).toBe(true);
    expect([obs!.left_x, obs!.right_x]).toEqual([1, 1]);
    const result = classifyMutationWithAlignment(reference, obs!.read_window, obs!.left_x, obs!.right_x);
    expect(result.net_indel).toBe(-600);
  });
  it('does not rescue a molecule with only one observed flank', () => {
    const seq = noisy.substring(0, 300);
    expect(isReadUsable(seq, quality(seq), reference, 20, '', 600)[0]).toBe(false);
  });
  it('does not replace a previously valid orientation with a rescued second molecule', () => {
    // A concatenated read may contain another molecule in the reverse
    // orientation. A fallback must not override the original valid call.
    const noisyWt = change(reference[0]) + reference.substring(1, reference.length - 1) + change(reference.at(-1)!);
    const seq = junction + 'ATGCATGCATGCATGCATGC' + reverseComplement(noisyWt);
    const [ok, , obs] = isReadUsable(seq, quality(seq), reference, 20, '', 600);
    expect(ok).toBe(true); expect(obs!.is_rc).toBe(false);
    expect(obs!.observed_read).toBe(junction);
    expect(classifyMutationWithAlignment(reference, obs!.read_window, obs!.left_x, obs!.right_x).net_indel).toBe(-600);
  });
  it('does not bridge separate X-delimited observations', () => {
    const seq = noisy.substring(0, 300) + 'X'.repeat(1200) + noisy.substring(300);
    expect(isReadUsable(seq, quality(seq), reference, 20, '', 600)[0]).toBe(false);
  });
  it('rejects ambiguous duplicate placements', () => {
    const seq = noisy + noisy;
    expect(isReadUsable(seq, quality(seq), reference, 20, '', 600)[0]).toBe(false);
  });
  it('retains the quality gate', () => {
    const [ok, reason] = isReadUsable(noisy, quality(noisy, 10), reference, 20, '', 600);
    expect(ok).toBe(false); expect(reason).toBe('quality');
  });
  it('does not turn unrelated sequence into spanning evidence', () => {
    const seq = dna(1600, 76543);
    expect(isReadUsable(seq, quality(seq), reference, 20, '', 600)[0]).toBe(false);
  });
});
