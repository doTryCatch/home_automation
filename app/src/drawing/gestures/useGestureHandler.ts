import { useCallback, useRef, useMemo, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { Point, TransformState, ToolMode, DrawTool, EraserMode, CANVAS_SIZE, DrawingObject, DEFAULT_STYLE } from '../types';
import { DrawingManager } from '../manager/DrawingManager';
import { generateId, computeBoundingBox, centerOfPoints } from '../engine/GeometryUtils';

const VW = CANVAS_SIZE.width;
const VH = CANVAS_SIZE.height;

interface UseGestureHandlerProps {
  manager: DrawingManager;
  mode: ToolMode;
  drawTool: DrawTool;
  eraserMode: EraserMode;
  transform: TransformState;
  onTransformChange: (t: TransformState) => void;
  onDrawingStart?: () => void;
  onDrawingEnd?: () => void;
  onSelectionChange?: (id: string | null) => void;
  canvasLayout: { width: number; height: number };
}

function computeViewBox(layout: { width: number; height: number }, t: TransformState) {
  if (layout.width === 0 || layout.height === 0) {
    return { vbX: 0, vbY: 0, vbW: VW, vbH: VH };
  }
  const viewRatio = VW / VH;
  const containerRatio = layout.width / layout.height;
  let vbX = 0, vbY = 0, vbW = VW, vbH = VH;
  if (containerRatio > viewRatio) {
    const scale = VH / layout.height;
    vbW = layout.width * scale;
    vbX = (VW - vbW) / 2;
  } else {
    const scale = VW / layout.width;
    vbH = layout.height * scale;
    vbY = (VH - vbH) / 2;
  }
  const z = t.scale;
  const cx = vbX + vbW / 2 - t.translateX * (vbW / VW) * z;
  const cy = vbY + vbH / 2 - t.translateY * (vbH / VH) * z;
  const zW = vbW / z;
  const zH = vbH / z;
  const zX = cx - zW / 2;
  const zY = cy - zH / 2;
  return { vbX: zX, vbY: zY, vbW: zW, vbH: zH };
}

function addShapeObject(manager: DrawingManager, tool: DrawTool, start: Point, end: Point) {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  if (dx < 5 && dy < 5) return;

  if (tool === 'line') {
    const pts = [start, end];
    manager.addObject({
      id: generateId(),
      type: 'line',
      points: pts,
      position: centerOfPoints(pts),
      boundingBox: computeBoundingBox(pts, 5),
      style: { ...DEFAULT_STYLE },
      metadata: { isSegment: false, isDeviceSlot: false },
      zIndex: Date.now(),
    });
  } else if (tool === 'rectangle') {
    const pts = [
      { x: start.x, y: start.y },
      { x: end.x, y: start.y },
      { x: end.x, y: end.y },
      { x: start.x, y: end.y },
    ];
    manager.addObject({
      id: generateId(),
      type: 'rectangle',
      points: pts,
      position: centerOfPoints(pts),
      boundingBox: computeBoundingBox(pts, 5),
      style: { ...DEFAULT_STYLE, fillColor: 'rgba(78, 205, 196, 0.15)' },
      metadata: { isSegment: false, isDeviceSlot: false },
      zIndex: Date.now(),
    });
  } else if (tool === 'circle') {
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r < 5) return;
    const pts = Array.from({ length: 37 }, (_, i) => {
      const angle = (2 * Math.PI * i) / 36;
      return { x: start.x + r * Math.cos(angle), y: start.y + r * Math.sin(angle) };
    });
    manager.addObject({
      id: generateId(),
      type: 'circle',
      points: pts,
      position: start,
      boundingBox: computeBoundingBox(pts, 5),
      style: { ...DEFAULT_STYLE, fillColor: 'rgba(78, 205, 196, 0.15)' },
      metadata: { isSegment: false, isDeviceSlot: false },
      zIndex: Date.now(),
    });
  }
}

export function useGestureHandler({
  manager,
  mode,
  drawTool,
  eraserMode,
  transform,
  onTransformChange,
  onDrawingStart,
  onDrawingEnd,
  onSelectionChange,
  canvasLayout,
}: UseGestureHandlerProps) {
  const currentStroke = useRef<Point[]>([]);
  const isDrawing = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const initialPinchScale = useRef(1);
  const drawStartPt = useRef<Point | null>(null);
  const [preview, setPreview] = useState<{ type: DrawTool | null; points: Point[] }>({ type: null, points: [] });

  const screenToCanvas = useCallback((sx: number, sy: number): Point => {
    if (canvasLayout.width === 0 || canvasLayout.height === 0) return { x: sx, y: sy };
    const vb = computeViewBox(canvasLayout, transform);
    return {
      x: vb.vbX + (sx / canvasLayout.width) * vb.vbW,
      y: vb.vbY + (sy / canvasLayout.height) * vb.vbH,
    };
  }, [transform, canvasLayout]);

  const drawPan = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .onStart((e) => {
      if (mode !== 'draw') return;
      isDrawing.current = true;
      const pt = screenToCanvas(e.x, e.y);

      if (drawTool === 'pen') {
        currentStroke.current = [pt];
      } else {
        drawStartPt.current = pt;
        setPreview({ type: drawTool, points: [pt, pt] });
      }
      onDrawingStart?.();
    })
    .onUpdate((e) => {
      if (mode !== 'draw' || !isDrawing.current) return;
      const pt = screenToCanvas(e.x, e.y);

      if (drawTool === 'pen') {
        currentStroke.current.push(pt);
      } else if (drawStartPt.current) {
        setPreview({ type: drawTool, points: [drawStartPt.current, pt] });
      }
    })
    .onEnd((e) => {
      if (mode !== 'draw' || !isDrawing.current) return;

      if (drawTool === 'pen') {
        if (currentStroke.current.length > 2) {
          manager.addStroke(currentStroke.current);
        }
        currentStroke.current = [];
      } else if (drawStartPt.current) {
        const endPt = screenToCanvas(e.x, e.y);
        addShapeObject(manager, drawTool, drawStartPt.current, endPt);
        drawStartPt.current = null;
        setPreview({ type: null, points: [] });
      }

      isDrawing.current = false;
      onDrawingEnd?.();
    })
    .onFinalize(() => {
      if (isDrawing.current) {
        currentStroke.current = [];
        isDrawing.current = false;
        drawStartPt.current = null;
        setPreview({ type: null, points: [] });
      }
    })
    .minDistance(1)
    .enabled(mode === 'draw'), [mode, drawTool, screenToCanvas, manager, onDrawingStart, onDrawingEnd]);

  const erasePan = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .onStart((e) => {
      if (mode !== 'erase') return;
      isDrawing.current = true;
      manager.eraseAtPoint(screenToCanvas(e.x, e.y), 20, eraserMode);
    })
    .onUpdate((e) => {
      if (mode !== 'erase' || !isDrawing.current) return;
      manager.eraseAtPoint(screenToCanvas(e.x, e.y), 20, eraserMode);
    })
    .onEnd(() => {
      isDrawing.current = false;
    })
    .minDistance(1)
    .enabled(mode === 'erase'), [mode, eraserMode, screenToCanvas, manager]);

  const selectPan = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .onStart((e) => {
      if (mode !== 'select') return;
      const pt = screenToCanvas(e.x, e.y);
      const hit = manager.hitTest(pt, 15);
      onSelectionChange?.(hit?.id ?? null);
      lastPan.current = screenToCanvas(e.x, e.y);
    })
    .onUpdate((e) => {
      if (mode !== 'select') return;
      const pt = screenToCanvas(e.x, e.y);
      const dx = pt.x - lastPan.current.x;
      const dy = pt.y - lastPan.current.y;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        const hit = manager.hitTest(pt, 15);
        if (hit) {
          manager.moveObject(hit.id, dx, dy);
        }
        lastPan.current = pt;
      }
    })
    .minDistance(5)
    .enabled(mode === 'select'), [mode, screenToCanvas, manager, onSelectionChange]);

  const deviceTap = useMemo(() => Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      if (mode !== 'device') return;
      const pt = screenToCanvas(e.x, e.y);
      const hit = manager.hitTest(pt, 15);
      onSelectionChange?.(hit?.id ?? null);
    })
    .enabled(mode === 'device'), [mode, screenToCanvas, manager, onSelectionChange]);

  const singleFingerPan = useMemo(() => Gesture.Race(drawPan, erasePan, selectPan), [drawPan, erasePan, selectPan]);

  const pinchGesture = useMemo(() => Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      initialPinchScale.current = transform.scale;
    })
    .onUpdate((e) => {
      const newScale = Math.max(0.2, Math.min(5, initialPinchScale.current * e.scale));
      onTransformChange({
        scale: newScale,
        translateX: transform.translateX,
        translateY: transform.translateY,
      });
    }), [transform, onTransformChange]);

  const composed = useMemo(() => Gesture.Race(
    pinchGesture,
    Gesture.Simultaneous(singleFingerPan, deviceTap),
  ), [pinchGesture, singleFingerPan, deviceTap]);

  return {
    composed,
    currentStroke,
    preview,
    screenToCanvas,
  };
}
