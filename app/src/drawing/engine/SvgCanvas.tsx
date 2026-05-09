import React, { useMemo, useCallback } from 'react';
import Svg, {
  G,
  Path as SvgPath,
  Rect as SvgRect,
  Circle as SvgCircle,
  Text as SvgText,
  Line as SvgLine,
  Defs,
  Pattern,
} from 'react-native-svg';
import { DrawingObject, Point, ComponentGroup, TransformState, DrawTool, CANVAS_SIZE } from '../types';
import { dist } from '../engine/GeometryUtils';

interface SvgCanvasProps {
  objects: DrawingObject[];
  components: ComponentGroup[];
  transform: TransformState;
  currentStroke: Point[];
  preview: { type: DrawTool | null; points: Point[] };
  selectedId: string | null;
  canvasSize: { width: number; height: number };
}

const GRID_SIZE = 40;
const HANDLE_SIZE = 8;
const SELECTION_COLOR = '#4ECDC4';

export const SvgCanvas: React.FC<SvgCanvasProps> = React.memo(({
  objects,
  components,
  transform,
  currentStroke,
  preview,
  selectedId,
  canvasSize,
}) => {
  const VW = CANVAS_SIZE.width;
  const VH = CANVAS_SIZE.height;

  const objectToSvgD = useCallback((obj: DrawingObject): string => {
    if (obj.points.length < 2) return '';
    const pts = obj.points;

    if (obj.type === 'freehand') {
      return pts.length === 2
        ? `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`
        : pts.map((p, i) => {
            if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            const prev = pts[i - 1];
            const cx = ((prev.x + p.x) / 2).toFixed(1);
            const cy = ((prev.y + p.y) / 2).toFixed(1);
            return `Q${prev.x.toFixed(1)},${prev.y.toFixed(1)} ${cx},${cy}`;
          }).join(' ') + ` L${pts[pts.length - 1].x.toFixed(1)},${pts[pts.length - 1].y.toFixed(1)}`;
    }
    if (obj.type === 'line') {
      return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`;
    }
    if (obj.type === 'rectangle' || obj.type === 'polygon') {
      return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
    }
    if (obj.type === 'circle') {
      const center = obj.position;
      const radius = Math.max(1, dist(obj.points[0], center));
      const segments = 36;
      return Array.from({ length: segments + 1 }, (_, i) => {
        const angle = (2 * Math.PI * i) / segments;
        const x = center.x + radius * Math.cos(angle);
        const y = center.y + radius * Math.sin(angle);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ') + ' Z';
    }
    return '';
  }, []);

  const renderGrid = useCallback(() => {
    const lines: React.ReactNode[] = [];
    for (let x = 0; x <= VW; x += GRID_SIZE) {
      lines.push(
        <SvgLine key={`gv${x}`} x1={x} y1={0} x2={x} y2={VH} stroke="#D5DBDF" strokeWidth={0.5} />
      );
    }
    for (let y = 0; y <= VH; y += GRID_SIZE) {
      lines.push(
        <SvgLine key={`gh${y}`} x1={0} y1={y} x2={VW} y2={y} stroke="#D5DBDF" strokeWidth={0.5} />
      );
    }
    return lines;
  }, [VW, VH]);

  const renderObject = useCallback((obj: DrawingObject) => {
    const d = objectToSvgD(obj);
    if (!d) return null;

    const isSelected = obj.id === selectedId;
    const component = obj.metadata.componentId
      ? components.find(c => c.id === obj.metadata.componentId)
      : null;
    const strokeColor = component ? component.color : obj.style.strokeColor;
    const fillColor = obj.style.fillColor ?? (component ? `${component.color}25` : undefined);

    return (
      <G key={obj.id}>
        {fillColor && (
          <SvgPath d={d} fill={fillColor} />
        )}
        <SvgPath
          d={d}
          stroke={strokeColor}
          strokeWidth={obj.style.strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {isSelected && (
          <SvgPath
            d={d}
            stroke={SELECTION_COLOR}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6,4"
          />
        )}
      </G>
    );
  }, [selectedId, components, objectToSvgD]);

  const renderSelectionHandles = useCallback((obj: DrawingObject) => {
    if (obj.id !== selectedId) return null;
    const bb = obj.boundingBox;
    const handles: { x: number; y: number }[] = [
      { x: bb.x, y: bb.y },
      { x: bb.x + bb.width / 2, y: bb.y },
      { x: bb.x + bb.width, y: bb.y },
      { x: bb.x + bb.width, y: bb.y + bb.height / 2 },
      { x: bb.x + bb.width, y: bb.y + bb.height },
      { x: bb.x + bb.width / 2, y: bb.y + bb.height },
      { x: bb.x, y: bb.y + bb.height },
      { x: bb.x, y: bb.y + bb.height / 2 },
    ];

    return (
      <G key="handles">
        <SvgRect
          x={bb.x - 2}
          y={bb.y - 2}
          width={bb.width + 4}
          height={bb.height + 4}
          stroke={SELECTION_COLOR}
          strokeWidth={1}
          fill="none"
          strokeDasharray="4,3"
        />
        {handles.map((h, i) => (
          <G key={`h${i}`}>
            <SvgRect
              x={h.x - HANDLE_SIZE / 2}
              y={h.y - HANDLE_SIZE / 2}
              width={HANDLE_SIZE}
              height={HANDLE_SIZE}
              fill="#fff"
              stroke={SELECTION_COLOR}
              strokeWidth={2}
            />
          </G>
        ))}
      </G>
    );
  }, [selectedId]);

  const renderComponentLabels = useCallback(() => {
    return components.map(comp => (
      <SvgText
        key={`label_${comp.id}`}
        x={comp.center.x}
        y={comp.center.y}
        textAnchor="middle"
        fontSize="12"
        fill="#636E72"
        fontWeight="600"
      >
        {comp.name}
      </SvgText>
    ));
  }, [components]);

  const renderCurrentStroke = useCallback(() => {
    if (currentStroke.length < 2) return null;
    const d = currentStroke.map((p, i) =>
      `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
    ).join(' ');
    return (
      <SvgPath
        d={d}
        stroke={SELECTION_COLOR}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
    );
  }, [currentStroke]);

  const renderPreview = useCallback(() => {
    if (!preview.type || preview.points.length < 2) return null;
    const [start, end] = preview.points;

    if (preview.type === 'line') {
      return (
        <SvgLine
          x1={start.x} y1={start.y}
          x2={end.x} y2={end.y}
          stroke={SELECTION_COLOR}
          strokeWidth={3}
          strokeDasharray="6,4"
        />
      );
    }

    if (preview.type === 'rectangle') {
      const d = `M${start.x},${start.y} L${end.x},${start.y} L${end.x},${end.y} L${start.x},${end.y} Z`;
      return (
        <SvgPath
          d={d}
          stroke={SELECTION_COLOR}
          strokeWidth={2}
          fill={SELECTION_COLOR + '20'}
          strokeDasharray="6,4"
        />
      );
    }

    if (preview.type === 'circle') {
      const r = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
      const segs = 36;
      const d = Array.from({ length: segs + 1 }, (_, i) => {
        const angle = (2 * Math.PI * i) / segs;
        const x = start.x + r * Math.cos(angle);
        const y = start.y + r * Math.sin(angle);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ') + ' Z';
      return (
        <SvgPath
          d={d}
          stroke={SELECTION_COLOR}
          strokeWidth={2}
          fill={SELECTION_COLOR + '20'}
          strokeDasharray="6,4"
        />
      );
    }

    return null;
  }, [preview]);

  const renderedObjects = useMemo(() => objects.map(obj => renderObject(obj)), [objects, renderObject]);
  const renderedHandles = useMemo(() => {
    if (!selectedId) return null;
    const obj = objects.find(o => o.id === selectedId);
    if (!obj) return null;
    return renderSelectionHandles(obj);
  }, [selectedId, objects, renderSelectionHandles]);

  const viewBox = useMemo(() => {
    if (canvasSize.width === 0 || canvasSize.height === 0) return `0 0 ${VW} ${VH}`;
    const viewRatio = VW / VH;
    const containerRatio = canvasSize.width / canvasSize.height;
    let vbX = 0, vbY = 0, vbW = VW, vbH = VH;

    if (containerRatio > viewRatio) {
      const scale = VH / canvasSize.height;
      vbW = canvasSize.width * scale;
      vbX = (VW - vbW) / 2;
    } else {
      const scale = VW / canvasSize.width;
      vbH = canvasSize.height * scale;
      vbY = (VH - vbH) / 2;
    }

    const z = transform.scale;
    const cx = vbX + vbW / 2 - transform.translateX * (vbW / VW) * z;
    const cy = vbY + vbH / 2 - transform.translateY * (vbH / VH) * z;
    const zW = vbW / z;
    const zH = vbH / z;
    const zX = cx - zW / 2;
    const zY = cy - zH / 2;

    return `${zX} ${zY} ${zW} ${zH}`;
  }, [canvasSize, transform, VW, VH]);

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      pointerEvents="none"
    >
      <SvgRect x={0} y={0} width={VW} height={VH} fill="#EEF1F5" />
      {renderGrid()}
      {renderedObjects}
      {renderedHandles}
      {renderComponentLabels()}
      {renderCurrentStroke()}
      {renderPreview()}
    </Svg>
  );
});
