import { Point, DrawingObject, BoundingBox, DrawingStyle, ObjectMetadata, DEFAULT_STYLE, CANVAS_SIZE } from '../types';

let _counter = 0;
export const generateId = () => 'obj_' + Date.now().toString(36) + '_' + (++_counter).toString(36);

export const dist = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

export const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export const clampPoint = (p: Point, max = CANVAS_SIZE): Point => ({
  x: Math.max(0, Math.min(max.width, p.x)),
  y: Math.max(0, Math.min(max.height, p.y)),
});

export const computeBoundingBox = (points: Point[], padding = 0): BoundingBox => {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    x: minX - padding,
    y: minY - padding,
    width: (maxX - minX) + padding * 2,
    height: (maxY - minY) + padding * 2,
  };
};

export const pointInBounds = (p: Point, bb: BoundingBox): boolean =>
  p.x >= bb.x && p.x <= bb.x + bb.width && p.y >= bb.y && p.y <= bb.y + bb.height;

export const pointInPolygon = (p: Point, polygon: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
};

export const pointNearStroke = (p: Point, points: Point[], threshold: number): boolean => {
  for (let i = 1; i < points.length; i++) {
    if (distToSegment(p, points[i - 1], points[i]) < threshold) return true;
  }
  return false;
};

export const distToSegment = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
};

export const centerOfPoints = (points: Point[]): Point => {
  if (points.length === 0) return { x: 0, y: 0 };
  const sx = points.reduce((s, p) => s + p.x, 0);
  const sy = points.reduce((s, p) => s + p.y, 0);
  return { x: sx / points.length, y: sy / points.length };
};

export const createDrawingObject = (
  type: DrawingObject['type'],
  points: Point[],
  style?: Partial<DrawingStyle>,
  metadata?: Partial<ObjectMetadata>,
): DrawingObject => ({
  id: generateId(),
  type,
  points,
  position: centerOfPoints(points),
  boundingBox: computeBoundingBox(points, 5),
  style: { ...DEFAULT_STYLE, ...style },
  metadata: {
    isSegment: false,
    isDeviceSlot: false,
    ...metadata,
  },
  zIndex: Date.now(),
});

export const transformPoint = (p: Point, tx: number, ty: number, scale: number): Point => ({
  x: (p.x + tx) * scale,
  y: (p.y + ty) * scale,
});

export const screenToCanvas = (p: Point, tx: number, ty: number, scale: number): Point => ({
  x: p.x / scale - tx,
  y: p.y / scale - ty,
});

export const resamplePoints = (points: Point[], targetCount: number): Point[] => {
  if (points.length <= targetCount) return points;
  const step = (points.length - 1) / (targetCount - 1);
  const result: Point[] = [];
  for (let i = 0; i < targetCount; i++) {
    const idx = Math.min(Math.round(i * step), points.length - 1);
    result.push(points[idx]);
  }
  return result;
};

export const pathLength = (points: Point[]): number => {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += dist(points[i - 1], points[i]);
  return len;
};

export const normalizePoints = (points: Point[], targetLen = 64): Point[] => {
  const total = pathLength(points);
  if (total === 0 || points.length < 2) return points;
  const interval = total / (targetLen - 1);
  const result: Point[] = [points[0]];
  let accumulated = 0;
  let prev = points[0];

  for (let i = 1; i < points.length && result.length < targetLen; i++) {
    const d = dist(prev, points[i]);
    accumulated += d;
    while (accumulated >= interval && result.length < targetLen) {
      const overshoot = accumulated - interval;
      const ratio = 1 - overshoot / d;
      result.push({
        x: prev.x + (points[i].x - prev.x) * ratio,
        y: prev.y + (points[i].y - prev.y) * ratio,
      });
      accumulated -= interval;
    }
    prev = points[i];
  }

  while (result.length < targetLen) result.push(points[points.length - 1]);
  return result;
};
