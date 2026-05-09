import { useCallback, useState } from 'react';
import { DrawingObject, Point, SelectionState, ResizeHandle } from '../types';
import { DrawingManager } from '../manager/DrawingManager';
import { dist } from '../engine/GeometryUtils';

const HANDLE_HIT_SIZE = 20;

export function useSelectionManager(manager: DrawingManager) {
  const [selection, setSelection] = useState<SelectionState>({
    selectedId: null,
    showHandles: false,
    isDragging: false,
    isResizing: false,
    isRotating: false,
  });

  const selectObject = useCallback((id: string | null) => {
    setSelection(prev => ({
      ...prev,
      selectedId: id,
      showHandles: id !== null,
    }));
  }, []);

  const getSelectedObject = useCallback((): DrawingObject | null => {
    if (!selection.selectedId) return null;
    return manager.getObject(selection.selectedId) ?? null;
  }, [selection.selectedId, manager]);

  const getHandleAtPoint = useCallback((canvasPoint: Point, obj: DrawingObject): ResizeHandle | null => {
    const bb = obj.boundingBox;
    const handles: { handle: ResizeHandle; point: Point }[] = [
      { handle: 'topLeft', point: { x: bb.x, y: bb.y } },
      { handle: 'topCenter', point: { x: bb.x + bb.width / 2, y: bb.y } },
      { handle: 'topRight', point: { x: bb.x + bb.width, y: bb.y } },
      { handle: 'middleRight', point: { x: bb.x + bb.width, y: bb.y + bb.height / 2 } },
      { handle: 'bottomRight', point: { x: bb.x + bb.width, y: bb.y + bb.height } },
      { handle: 'bottomCenter', point: { x: bb.x + bb.width / 2, y: bb.y + bb.height } },
      { handle: 'bottomLeft', point: { x: bb.x, y: bb.y + bb.height } },
      { handle: 'middleLeft', point: { x: bb.x, y: bb.y + bb.height / 2 } },
    ];

    for (const h of handles) {
      if (dist(canvasPoint, h.point) < HANDLE_HIT_SIZE) {
        return h.handle;
      }
    }
    return null;
  }, []);

  const resizeObject = useCallback((objId: string, handle: ResizeHandle, delta: Point) => {
    const obj = manager.getObject(objId);
    if (!obj) return;

    const bb = { ...obj.boundingBox };

    switch (handle) {
      case 'topLeft':
        bb.x += delta.x;
        bb.y += delta.y;
        bb.width -= delta.x;
        bb.height -= delta.y;
        break;
      case 'topCenter':
        bb.y += delta.y;
        bb.height -= delta.y;
        break;
      case 'topRight':
        bb.width += delta.x;
        bb.y += delta.y;
        bb.height -= delta.y;
        break;
      case 'middleRight':
        bb.width += delta.x;
        break;
      case 'bottomRight':
        bb.width += delta.x;
        bb.height += delta.y;
        break;
      case 'bottomCenter':
        bb.height += delta.y;
        break;
      case 'bottomLeft':
        bb.x += delta.x;
        bb.width -= delta.x;
        bb.height += delta.y;
        break;
      case 'middleLeft':
        bb.x += delta.x;
        bb.width -= delta.x;
        break;
    }

    if (bb.width < 10) bb.width = 10;
    if (bb.height < 10) bb.height = 10;

    const newPoints = [
      { x: bb.x, y: bb.y },
      { x: bb.x + bb.width, y: bb.y },
      { x: bb.x + bb.width, y: bb.y + bb.height },
      { x: bb.x, y: bb.y + bb.height },
    ];

    manager.updateObject(objId, {
      type: 'rectangle',
      points: newPoints,
      boundingBox: bb,
      position: { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 },
    });
  }, [manager]);

  const deleteSelected = useCallback(() => {
    if (selection.selectedId) {
      manager.removeObject(selection.selectedId);
      selectObject(null);
    }
  }, [selection.selectedId, manager, selectObject]);

  return {
    selection,
    selectObject,
    getSelectedObject,
    getHandleAtPoint,
    resizeObject,
    deleteSelected,
  };
}
