/// <reference lib="webworker" />
import { SHAPES } from './shapes';
import { voxelize, type VoxelShape } from './voxelize';

export interface VoxelRequest { scale: number }
export interface VoxelResponse { shapes: VoxelShape[]; ms: number }

self.onmessage = (ev: MessageEvent<VoxelRequest>) => {
  const t = performance.now();
  const scale = ev.data.scale;
  const shapes = SHAPES.map((def) => voxelize({ ...def, cell: def.cell * scale }));
  const transfer: Transferable[] = [];
  for (const s of shapes) transfer.push(s.pos.buffer, s.mat.buffer, s.ao.buffer);
  const res: VoxelResponse = { shapes, ms: performance.now() - t };
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(res, transfer);
};
