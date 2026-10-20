import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalAnalysisService } from '../../src/app/services/local-analysis.service';

describe('guide cancellation race', () => {
  afterEach(() => vi.useRealTimers());
  it('does not terminate a newly started worker when the old cancel timeout expires', () => {
    vi.useFakeTimers();
    const service = Object.create(LocalAnalysisService.prototype) as any;
    const oldWorker = { postMessage: vi.fn(), terminate: vi.fn() };
    const newWorker = { postMessage: vi.fn(), terminate: vi.fn() };
    service.worker = oldWorker;
    service.cancelAnalysis();
    service.worker = newWorker;
    vi.advanceTimersByTime(500);
    expect(oldWorker.terminate).toHaveBeenCalledOnce();
    expect(newWorker.terminate).not.toHaveBeenCalled();
    expect(service.worker).toBe(newWorker);
  });
});
