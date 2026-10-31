import type { ModelPart, PartName } from '@trackball/core';
export interface RenderedPart extends ModelPart {
  bytes: Uint8Array;
  milliseconds: number;
  cached: boolean;
}
export interface Progress {
  name: PartName;
  state: 'rendering' | 'done';
  cached?: boolean;
}
const abort = () => new DOMException('Rendering superseded', 'AbortError');
/** Browser adapter only. @trackball/core has no dependency on this package. */
export class BrowserRenderer {
  private worker?: Worker;
  private reject?: (error: unknown) => void;
  private serial = 0;
  private cache = new Map<string, RenderedPart>();
  private timer?: ReturnType<typeof setTimeout>;
  cancel() {
    this.serial++;
    this.worker?.terminate();
    this.worker = undefined;
    clearTimeout(this.timer);
    this.reject?.(abort());
    this.reject = undefined;
  }
  async render(
    parts: ModelPart[],
    runtimeUrl: string,
    onProgress: (p: Progress) => void = () => {},
  ): Promise<RenderedPart[]> {
    this.cancel();
    const jobId = ++this.serial;
    const keys = await Promise.all(
      parts.map(
        async (p) =>
          [
            p.name,
            Array.from(
              new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p.scad))),
            )
              .map((n) => n.toString(16).padStart(2, '0'))
              .join(''),
          ] as const,
      ),
    );
    if (jobId !== this.serial) throw abort();
    const lookup = new Map(keys),
      results: RenderedPart[] = [],
      pending: ModelPart[] = [];
    for (const part of parts) {
      const hit = this.cache.get(lookup.get(part.name)!);
      if (hit) {
        results.push({ ...part, bytes: hit.bytes, cached: true, milliseconds: 0 });
        onProgress({ name: part.name, state: 'done', cached: true });
      } else pending.push(part);
    }
    if (!pending.length) return results;
    return new Promise((resolve, reject) => {
      this.reject = reject;
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      const resetTimer = () => {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          cleanup();
          reject(new Error('Rendering timed out. Try a lower preview detail.'));
        }, 120000);
      };
      resetTimer();
      const cleanup = () => {
        clearTimeout(this.timer);
        worker.terminate();
        this.worker = undefined;
        this.reject = undefined;
      };
      worker.onerror = (event) => {
        cleanup();
        reject(new Error(event.message || 'Could not load the rendering worker'));
      };
      worker.onmessage = ({ data }) => {
        if (data.jobId !== jobId) return;
        if (data.kind === 'start') {
          resetTimer();
          onProgress({ name: data.name, state: 'rendering' });
        }
        if (data.kind === 'part') {
          const part = pending.find((p) => p.name === data.name)!;
          const rendered = {
            ...part,
            bytes: new Uint8Array(data.buffer),
            milliseconds: data.milliseconds,
            cached: false,
          };
          results.push(rendered);
          this.cache.set(lookup.get(part.name)!, rendered);
          // Keep the memory cache bounded rather than retaining every edited design.
          let size = [...this.cache.values()].reduce((n, p) => n + p.bytes.byteLength, 0);
          while (size > 48 * 1024 * 1024 && this.cache.size > 1) {
            const key = this.cache.keys().next().value!;
            size -= this.cache.get(key)!.bytes.byteLength;
            this.cache.delete(key);
          }
          onProgress({ name: part.name, state: 'done' });
        }
        if (data.kind === 'done') {
          cleanup();
          resolve(results);
        }
        if (data.kind === 'error') {
          cleanup();
          reject(new Error(`${data.error}\n${data.log || ''}`));
        }
      };
      worker.postMessage({ jobId, parts: pending, runtimeUrl });
    });
  }
}
