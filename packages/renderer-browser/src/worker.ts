/// <reference lib="webworker" />
import type { ModelPart } from '@trackball/core';
interface Request {
  jobId: number;
  parts: ModelPart[];
  runtimeUrl: string;
}
interface Engine {
  FS: { writeFile: (name: string, data: string) => void; readFile: (name: string) => Uint8Array };
  callMain: (args: string[]) => number;
}
declare const self: DedicatedWorkerGlobalScope;
self.onmessage = async ({ data }: { data: Request }) => {
  const { jobId, parts, runtimeUrl } = data;
  let log: string[] = [];
  try {
    const factory = (await import(/* @vite-ignore */ new URL('openscad.js', runtimeUrl).href)).default;
    const wasm = await (await fetch(new URL('openscad.wasm', runtimeUrl))).arrayBuffer();
    for (const part of parts) {
      log = [];
      self.postMessage({ kind: 'start', jobId, name: part.name });
      const engine: Engine = await factory({
        noInitialRun: true,
        wasmBinary: wasm,
        locateFile: (name: string) => new URL(name, runtimeUrl).href,
        print: (s: string) => log.push(s),
        printErr: (s: string) => log.push(s),
      });
      engine.FS.writeFile('/model.scad', part.scad);
      const started = performance.now();
      const result = engine.callMain([
        '/model.scad',
        '-o',
        '/model.stl',
        '--backend=Manifold',
        '--export-format=binstl',
      ]);
      if (result !== 0 && result !== undefined)
        throw new Error(log.slice(-12).join('\n') || `OpenSCAD exited with ${result}`);
      const bytes = engine.FS.readFile('/model.stl').slice();
      if (bytes.byteLength < 84) throw new Error(`${part.name}: empty mesh`);
      self.postMessage(
        {
          kind: 'part',
          jobId,
          name: part.name,
          buffer: bytes.buffer,
          milliseconds: performance.now() - started,
        },
        [bytes.buffer],
      );
    }
    self.postMessage({ kind: 'done', jobId });
  } catch (error) {
    self.postMessage({ kind: 'error', jobId, error: String(error), log: log.slice(-12).join('\n') });
  }
};
