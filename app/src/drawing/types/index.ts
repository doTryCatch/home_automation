export interface Point {
  x: number;
  y: number;
}

export interface StrokePoint extends Point {
  timestamp: number;
  pressure?: number;
}

export type DrawingObjectType = 'freehand' | 'line' | 'circle' | 'rectangle' | 'polygon';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawingObject {
  id: string;
  type: DrawingObjectType;
  points: Point[];
  position: Point;
  boundingBox: BoundingBox;
  style: DrawingStyle;
  metadata: ObjectMetadata;
  zIndex: number;
  recognizedFrom?: string;
}

export interface DrawingStyle {
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number;
  opacity: number;
}

export interface ObjectMetadata {
  componentId?: string;
  componentName?: string;
  isSegment: boolean;
  isDeviceSlot: boolean;
  deviceId?: string;
  onTap?: string;
  customData?: Record<string, unknown>;
}

export type ToolMode = 'draw' | 'erase' | 'select' | 'segment' | 'device';
export type DrawTool = 'pen' | 'line' | 'rectangle' | 'circle';
export type EraserMode = 'stroke' | 'path';

export interface TransformState {
  translateX: number;
  translateY: number;
  scale: number;
}

export interface SelectionState {
  selectedId: string | null;
  showHandles: boolean;
  isDragging: boolean;
  isResizing: boolean;
  isRotating: boolean;
  activeHandle?: ResizeHandle;
  initialTransform?: {
    position: Point;
    boundingBox: BoundingBox;
  };
}

export type ResizeHandle =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'middleRight'
  | 'bottomRight'
  | 'bottomCenter'
  | 'bottomLeft'
  | 'middleLeft';

export interface ComponentGroup {
  id: string;
  name: string;
  objectIds: string[];
  color: string;
  center: Point;
  boundingBox: BoundingBox;
}

export interface HistoryEntry {
  type: 'add' | 'remove' | 'modify' | 'reorder' | 'group';
  objectId: string;
  before?: DrawingObject;
  after?: DrawingObject;
  timestamp: number;
}

export interface CanvasExport {
  version: string;
  canvasSize: { width: number; height: number };
  objects: DrawingObject[];
  components: ComponentGroup[];
}

export interface SkiaPoints {
  raw: Point[];
  smoothed: Point[];
}

export const DEFAULT_STYLE: DrawingStyle = {
  strokeColor: '#556270',
  fillColor: undefined,
  strokeWidth: 3,
  opacity: 1,
};

export const ROOM_COLORS = [
  '#4ECDC4', '#FF6B6B', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#E74C3C',
];

export const CANVAS_SIZE = { width: 2000, height: 1500 };
