import { Point, DrawingObjectType, DrawingObject } from '../types';
import { dist, computeBoundingBox, pathLength, centerOfPoints, normalizePoints } from '../engine/GeometryUtils';

const LINE_THRESHOLD = 0.92;
const CIRCLE_VARIANCE = 0.15;
const RECT_ANGLE_THRESHOLD = 0.35;
const MIN_PATH_LENGTH = 30;
const MIN_POINTS = 8;

export interface RecognitionResult {
  type: DrawingObjectType;
  confidence: number;
  points: Point[];
  closed: boolean;
}

export const recognizeShape = (rawPoints: Point[]): RecognitionResult | null => {
  if (rawPoints.length < MIN_POINTS || pathLength(rawPoints) < MIN_PATH_LENGTH) {
    return null;
  }

  const points = normalizePoints(rawPoints, 64);
  const closed = isClosedShape(points);
  const bb = computeBoundingBox(points);
  const diagonal = Math.sqrt(bb.width ** 2 + bb.height ** 2);

  if (diagonal < 10) return null;

  if (closed) {
    const circleResult = checkCircle(points, bb);
    if (circleResult.confidence > 0.7) return circleResult;

    const rectResult = checkRectangle(points, bb);
    if (rectResult.confidence > 0.6) return rectResult;
  }

  const lineResult = checkLine(points);
  if (lineResult.confidence > 0.8) return lineResult;

  return {
    type: 'freehand',
    confidence: 1,
    points: rawPoints,
    closed: false,
  };
};

const isClosedShape = (points: Point[]): boolean => {
  if (points.length < 3) return false;
  const d = dist(points[0], points[points.length - 1]);
  const bb = computeBoundingBox(points);
  const diagonal = Math.sqrt(bb.width ** 2 + bb.height ** 2);
  return diagonal > 0 && d / diagonal < 0.25;
};

const checkLine = (points: Point[]): RecognitionResult => {
  const start = points[0];
  const end = points[points.length - 1];
  const directDist = dist(start, end);
  const actualLen = pathLength(points);

  if (directDist === 0) return { type: 'freehand', confidence: 0, points, closed: false };

  const straightness = directDist / actualLen;

  if (straightness > LINE_THRESHOLD) {
    return {
      type: 'line',
      confidence: straightness,
      points: [start, end],
      closed: false,
    };
  }

  return { type: 'freehand', confidence: 0, points, closed: false };
};

const checkCircle = (points: Point[], bb: BBTmp): RecognitionResult => {
  const center = centerOfPoints(points);
  const radii = points.map(p => dist(p, center));
  const avgRadius = radii.reduce((s, r) => s + r, 0) / radii.length;
  if (avgRadius === 0) return { type: 'freehand', confidence: 0, points, closed: false };

  const variance = radii.reduce((s, r) => s + ((r - avgRadius) ** 2), 0) / radii.length;
  const stdDev = Math.sqrt(variance);
  const normalizedVariance = stdDev / avgRadius;

  const aspectRatio = bb.width > 0 && bb.height > 0
    ? Math.min(bb.width, bb.height) / Math.max(bb.width, bb.height)
    : 0;

  const confidence = Math.max(0, 1 - normalizedVariance * 2) * aspectRatio;

  if (normalizedVariance < CIRCLE_VARIANCE && aspectRatio > 0.7) {
    const circlePoints = generateCirclePoints(center, avgRadius, 36);
    return {
      type: 'circle',
      confidence,
      points: circlePoints,
      closed: true,
    };
  }

  return { type: 'freehand', confidence, points, closed: false };
};

const checkRectangle = (points: Point[], bb: BBTmp): RecognitionResult => {
  const corners = findCorners(points, 4);
  if (corners.length < 4) return { type: 'freehand', confidence: 0, points, closed: false };

  const angles = computeCornerAngles(corners);
  const avgAngleDeviation = angles.reduce((s, a) => s + Math.abs(a - Math.PI / 2), 0) / angles.length;
  const normalizedDev = avgAngleDeviation / (Math.PI / 2);

  const confidence = Math.max(0, 1 - normalizedDev * 2);

  if (normalizedDev < RECT_ANGLE_THRESHOLD) {
    const rectPoints = snapToRectangle(corners, bb);
    return {
      type: 'rectangle',
      confidence,
      points: rectPoints,
      closed: true,
    };
  }

  return { type: 'freehand', confidence, points, closed: false };
};

interface BBTmp {
  x: number;
  y: number;
  width: number;
  height: number;
}

const findCorners = (points: Point[], maxCorners: number): Point[] => {
  const corners: Point[] = [];
  const windowSize = Math.max(3, Math.floor(points.length / 8));

  for (let i = windowSize; i < points.length - windowSize; i++) {
    const prev = points[i - windowSize];
    const curr = points[i];
    const next = points[i + windowSize];

    const angle = angleBetween(prev, curr, next);
    if (angle < Math.PI * 0.65 || angle > Math.PI * 1.35) {
      if (corners.length === 0 || dist(curr, corners[corners.length - 1]) > 15) {
        corners.push(curr);
      }
    }
  }

  if (corners.length > maxCorners) {
    corners.sort((a, b) => {
      const scoreA = cornerScore(a, points);
      const scoreB = cornerScore(b, points);
      return scoreB - scoreA;
    });
    corners.length = maxCorners;
    corners.sort((a, b) => {
      const idxA = points.findIndex(p => p.x === a.x && p.y === a.y);
      const idxB = points.findIndex(p => p.x === b.x && p.y === b.y);
      return idxA - idxB;
    });
  }

  return corners;
};

const cornerScore = (point: Point, allPoints: Point[]): number => {
  let score = 0;
  const radius = 10;
  for (const p of allPoints) {
    if (dist(point, p) < radius) score++;
  }
  return score;
};

const angleBetween = (a: Point, b: Point, c: Point): number => {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const cross = ba.x * bc.y - ba.y * bc.x;
  return Math.atan2(Math.abs(cross), dot);
};

const computeCornerAngles = (corners: Point[]): number[] => {
  const angles: number[] = [];
  for (let i = 0; i < corners.length; i++) {
    const prev = corners[(i - 1 + corners.length) % corners.length];
    const curr = corners[i];
    const next = corners[(i + 1) % corners.length];
    angles.push(angleBetween(prev, curr, next));
  }
  return angles;
};

const snapToRectangle = (corners: Point[], bb: BBTmp): Point[] => {
  return [
    { x: bb.x, y: bb.y },
    { x: bb.x + bb.width, y: bb.y },
    { x: bb.x + bb.width, y: bb.y + bb.height },
    { x: bb.x, y: bb.y + bb.height },
  ];
};

const generateCirclePoints = (center: Point, radius: number, count: number): Point[] => {
  const points: Point[] = [];
  for (let i = 0; i <= count; i++) {
    const angle = (2 * Math.PI * i) / count;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }
  return points;
};

export const buildRecognizedObject = (
  result: RecognitionResult,
  originalPoints: Point[],
  sourceId?: string,
): DrawingObject => {
  const bb = computeBoundingBox(result.points, 5);
  const fillColor = result.closed ? result.type === 'rectangle'
    ? 'rgba(78, 205, 196, 0.15)'
    : result.type === 'circle'
    ? 'rgba(78, 205, 196, 0.15)'
    : undefined
    : undefined;

  return {
    id: sourceId || `obj_${Date.now().toString(36)}`,
    type: result.type,
    points: result.points,
    position: centerOfPoints(result.points),
    boundingBox: bb,
    style: {
      strokeColor: '#556270',
      fillColor,
      strokeWidth: 3,
      opacity: 1,
    },
    metadata: {
      isSegment: false,
      isDeviceSlot: false,
    },
    zIndex: Date.now(),
    recognizedFrom: result.type !== 'freehand' ? 'auto' : undefined,
  };
};
