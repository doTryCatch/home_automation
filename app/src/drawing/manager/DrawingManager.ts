import { Point, DrawingObject, ComponentGroup, HistoryEntry, ROOM_COLORS, CANVAS_SIZE } from '../types';
import { generateId, computeBoundingBox, dist, centerOfPoints, pointNearStroke, pointInBounds } from '../engine/GeometryUtils';
import { recognizeShape, buildRecognizedObject } from '../recognition/ShapeRecognizer';

const CLUSTER_DISTANCE = 80;
const MIN_CLUSTER_SIZE = 1;

export class DrawingManager {
  private objects: Map<string, DrawingObject> = new Map();
  private zOrder: string[] = [];
  private components: Map<string, ComponentGroup> = new Map();
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private maxHistory = 50;
  private listeners: Set<() => void> = new Set();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  getObjects(): DrawingObject[] {
    return this.zOrder
      .map(id => this.objects.get(id))
      .filter((o): o is DrawingObject => !!o);
  }

  getObject(id: string): DrawingObject | undefined {
    return this.objects.get(id);
  }

  getComponents(): ComponentGroup[] {
    return Array.from(this.components.values());
  }

  getComponent(id: string): ComponentGroup | undefined {
    return this.components.get(id);
  }

  addStroke(rawPoints: Point[], autoRecognize = true): DrawingObject {
    let obj: DrawingObject;

    if (autoRecognize && rawPoints.length >= 8) {
      const result = recognizeShape(rawPoints);
      if (result && result.type !== 'freehand') {
        obj = buildRecognizedObject(result, rawPoints);
      } else {
        obj = this.createFreehandObject(rawPoints);
      }
    } else {
      obj = this.createFreehandObject(rawPoints);
    }

    this.objects.set(obj.id, obj);
    this.zOrder.push(obj.id);
    this.pushHistory({ type: 'add', objectId: obj.id, after: obj });
    this.notify();
    return obj;
  }

  private createFreehandObject(points: Point[]): DrawingObject {
    return {
      id: generateId(),
      type: 'freehand',
      points,
      position: centerOfPoints(points),
      boundingBox: computeBoundingBox(points, 5),
      style: {
        strokeColor: '#556270',
        strokeWidth: 3,
        opacity: 1,
      },
      metadata: { isSegment: false, isDeviceSlot: false },
      zIndex: Date.now(),
    };
  }

  addObject(obj: DrawingObject): void {
    this.objects.set(obj.id, obj);
    if (!this.zOrder.includes(obj.id)) {
      this.zOrder.push(obj.id);
    }
    this.pushHistory({ type: 'add', objectId: obj.id, after: obj });
    this.notify();
  }

  removeObject(id: string): DrawingObject | undefined {
    const obj = this.objects.get(id);
    if (!obj) return undefined;
    this.objects.delete(id);
    this.zOrder = this.zOrder.filter(oid => oid !== id);
    this.removeObjectFromComponents(id);
    this.pushHistory({ type: 'remove', objectId: id, before: obj });
    this.notify();
    return obj;
  }

  updateObject(id: string, updates: Partial<DrawingObject>): DrawingObject | undefined {
    const obj = this.objects.get(id);
    if (!obj) return undefined;
    const before = { ...obj };
    const updated = { ...obj, ...updates };
    if (updates.points) {
      updated.boundingBox = computeBoundingBox(updates.points, 5);
      updated.position = centerOfPoints(updates.points);
    }
    this.objects.set(id, updated);
    this.pushHistory({ type: 'modify', objectId: id, before, after: updated });
    this.notify();
    return updated;
  }

  moveObject(id: string, dx: number, dy: number): void {
    const obj = this.objects.get(id);
    if (!obj) return;
    const newPoints = obj.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
    this.updateObject(id, {
      points: newPoints,
      position: { x: obj.position.x + dx, y: obj.position.y + dy },
    });
  }

  scaleObject(id: string, scale: number, anchor: Point): void {
    const obj = this.objects.get(id);
    if (!obj) return;
    const newPoints = obj.points.map(p => ({
      x: anchor.x + (p.x - anchor.x) * scale,
      y: anchor.y + (p.y - anchor.y) * scale,
    }));
    this.updateObject(id, { points: newPoints });
  }

  bringForward(id: string): void {
    const idx = this.zOrder.indexOf(id);
    if (idx < 0 || idx >= this.zOrder.length - 1) return;
    [this.zOrder[idx], this.zOrder[idx + 1]] = [this.zOrder[idx + 1], this.zOrder[idx]];
    this.notify();
  }

  sendBackward(id: string): void {
    const idx = this.zOrder.indexOf(id);
    if (idx <= 0) return;
    [this.zOrder[idx], this.zOrder[idx - 1]] = [this.zOrder[idx - 1], this.zOrder[idx]];
    this.notify();
  }

  bringToFront(id: string): void {
    const idx = this.zOrder.indexOf(id);
    if (idx < 0) return;
    this.zOrder.splice(idx, 1);
    this.zOrder.push(id);
    this.notify();
  }

  sendToBack(id: string): void {
    const idx = this.zOrder.indexOf(id);
    if (idx < 0) return;
    this.zOrder.splice(idx, 1);
    this.zOrder.unshift(id);
    this.notify();
  }

  hitTest(canvasPoint: Point, threshold = 12): DrawingObject | null {
    for (let i = this.zOrder.length - 1; i >= 0; i--) {
      const obj = this.objects.get(this.zOrder[i]);
      if (!obj) continue;

      if (obj.type === 'freehand' || obj.type === 'line') {
        if (pointNearStroke(canvasPoint, obj.points, threshold + obj.style.strokeWidth / 2)) {
          return obj;
        }
      } else {
        if (pointInBounds(canvasPoint, obj.boundingBox)) {
          return obj;
        }
      }
    }
    return null;
  }

  eraseAtPoint(canvasPoint: Point, radius: number, mode: 'stroke' | 'path'): DrawingObject[] {
    const erased: DrawingObject[] = [];

    if (mode === 'stroke') {
      for (let i = this.zOrder.length - 1; i >= 0; i--) {
        const obj = this.objects.get(this.zOrder[i]);
        if (!obj) continue;

        const hit = obj.type === 'freehand' || obj.type === 'line'
          ? pointNearStroke(canvasPoint, obj.points, radius + obj.style.strokeWidth / 2)
          : pointInBounds(canvasPoint, obj.boundingBox);

        if (hit) {
          erased.push(obj);
          this.removeObject(obj.id);
        }
      }
    }

    return erased;
  }

  segmentIntoComponents(): ComponentGroup[] {
    const objects = this.getObjects();
    const clusters = this.spatialCluster(objects, CLUSTER_DISTANCE);
    this.components.clear();

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      if (cluster.length < MIN_CLUSTER_SIZE) continue;

      const allPoints = cluster.flatMap(o => o.points);
      const bb = computeBoundingBox(allPoints, 15);
      const center = centerOfPoints(allPoints);
      const color = ROOM_COLORS[i % ROOM_COLORS.length];
      const componentId = generateId();
      const componentName = `Area ${i + 1}`;

      const group: ComponentGroup = {
        id: componentId,
        name: componentName,
        objectIds: cluster.map(o => o.id),
        color,
        center,
        boundingBox: bb,
      };

      this.components.set(componentId, group);

      for (const obj of cluster) {
        this.updateObject(obj.id, {
          metadata: {
            ...obj.metadata,
            componentId,
            componentName,
            isSegment: true,
          },
        });
      }
    }

    this.notify();
    return this.getComponents();
  }

  private spatialCluster(objects: DrawingObject[], threshold: number): DrawingObject[][] {
    if (objects.length === 0) return [];

    const visited = new Set<string>();
    const clusters: DrawingObject[][] = [];

    for (const obj of objects) {
      if (visited.has(obj.id)) continue;
      visited.add(obj.id);

      const cluster: DrawingObject[] = [obj];
      const queue = [obj];

      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const other of objects) {
          if (visited.has(other.id)) continue;
          if (this.areNearby(current, other, threshold)) {
            visited.add(other.id);
            cluster.push(other);
            queue.push(other);
          }
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  private areNearby(a: DrawingObject, b: DrawingObject, threshold: number): boolean {
    const d = dist(a.position, b.position);
    if (d < threshold) return true;

    const aBB = a.boundingBox;
    const bBB = b.boundingBox;
    const gapX = Math.max(0, Math.max(aBB.x - (bBB.x + bBB.width), bBB.x - (aBB.x + aBB.width)));
    const gapY = Math.max(0, Math.max(aBB.y - (bBB.y + bBB.height), bBB.y - (aBB.y + aBB.height)));
    const minDist = Math.sqrt(gapX * gapX + gapY * gapY);

    return minDist < threshold;
  }

  updateComponentName(id: string, name: string): void {
    const comp = this.components.get(id);
    if (!comp) return;
    comp.name = name;
    for (const oid of comp.objectIds) {
      const obj = this.objects.get(oid);
      if (obj) {
        obj.metadata.componentName = name;
      }
    }
    this.notify();
  }

  removeObjectFromComponents(objectId: string): void {
    for (const [cid, comp] of this.components) {
      const idx = comp.objectIds.indexOf(objectId);
      if (idx >= 0) {
        comp.objectIds.splice(idx, 1);
        if (comp.objectIds.length === 0) {
          this.components.delete(cid);
        }
      }
    }
  }

  private pushHistory(entry: Omit<HistoryEntry, 'timestamp'>): void {
    this.undoStack.push({ ...entry, timestamp: Date.now() });
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) return false;

    this.redoStack.push(entry);

    switch (entry.type) {
      case 'add':
        this.objects.delete(entry.objectId);
        this.zOrder = this.zOrder.filter(id => id !== entry.objectId);
        break;
      case 'remove':
        if (entry.before) {
          this.objects.set(entry.objectId, entry.before);
          this.zOrder.push(entry.objectId);
        }
        break;
      case 'modify':
        if (entry.before) {
          this.objects.set(entry.objectId, entry.before);
        }
        break;
    }

    this.notify();
    return true;
  }

  redo(): boolean {
    const entry = this.redoStack.pop();
    if (!entry) return false;

    this.undoStack.push(entry);

    switch (entry.type) {
      case 'add':
        if (entry.after) {
          this.objects.set(entry.objectId, entry.after);
          this.zOrder.push(entry.objectId);
        }
        break;
      case 'remove':
        this.objects.delete(entry.objectId);
        this.zOrder = this.zOrder.filter(id => id !== entry.objectId);
        break;
      case 'modify':
        if (entry.after) {
          this.objects.set(entry.objectId, entry.after);
        }
        break;
    }

    this.notify();
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.objects.clear();
    this.zOrder = [];
    this.components.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  exportJSON(): string {
    const data = {
      version: '1.0.0',
      canvasSize: CANVAS_SIZE,
      objects: this.getObjects(),
      components: this.getComponents(),
    };
    return JSON.stringify(data);
  }

  importJSON(json: string): void {
    try {
      const data = JSON.parse(json);
      this.clear();
      if (data.objects) {
        for (const obj of data.objects) {
          this.objects.set(obj.id, obj);
          this.zOrder.push(obj.id);
        }
      }
      if (data.components) {
        for (const comp of data.components) {
          this.components.set(comp.id, comp);
        }
      }
      this.notify();
    } catch (e) {
      console.error('Failed to import:', e);
    }
  }

  loadObjects(objects: DrawingObject[], components?: ComponentGroup[]): void {
    this.clear();
    for (const obj of objects) {
      const fixed = {
        ...obj,
        position: centerOfPoints(obj.points),
        boundingBox: computeBoundingBox(obj.points, 5),
      };
      this.objects.set(fixed.id, fixed);
      this.zOrder.push(fixed.id);
    }
    if (components) {
      for (const comp of components) {
        this.components.set(comp.id, comp);
      }
    }
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}

export default new DrawingManager();
