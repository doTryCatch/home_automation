import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SvgCanvas } from '../engine/SvgCanvas';
import { DrawingManager } from '../manager/DrawingManager';
import { useGestureHandler } from '../gestures/useGestureHandler';
import { useSelectionManager } from '../interaction/useSelectionManager';
import {
  ToolMode,
  DrawTool,
  EraserMode,
  TransformState,
  DrawingObject,
  ComponentGroup,
  Point,
  ROOM_COLORS,
  CANVAS_SIZE,
} from '../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/theme';

interface DrawingEditorProps {
  initialObjects?: DrawingObject[];
  initialComponents?: ComponentGroup[];
  onObjectsChange?: (objects: DrawingObject[], components: ComponentGroup[]) => void;
  onComponentTap?: (component: ComponentGroup) => void;
  onDevicePlace?: (componentId: string, position: Point) => void;
  showDeviceMode?: boolean;
}

const TOOL_ITEMS: { mode: ToolMode; icon: string; label: string }[] = [
  { mode: 'draw', icon: 'pencil', label: 'Draw' },
  { mode: 'erase', icon: 'eraser', label: 'Erase' },
  { mode: 'select', icon: 'cursor-move', label: 'Select' },
  { mode: 'segment', icon: 'group', label: 'Segment' },
];

const DRAW_TOOLS: { tool: DrawTool; icon: string; label: string }[] = [
  { tool: 'pen', icon: 'pen', label: 'Pen' },
  { tool: 'line', icon: 'vector-line', label: 'Line' },
  { tool: 'rectangle', icon: 'rectangle-outline', label: 'Rect' },
  { tool: 'circle', icon: 'circle-outline', label: 'Circle' },
];

export const DrawingEditor: React.FC<DrawingEditorProps> = ({
  initialObjects,
  initialComponents,
  onObjectsChange,
  onComponentTap,
  onDevicePlace,
  showDeviceMode = true,
}) => {
  const managerRef = useRef(new DrawingManager());
  const manager = managerRef.current;
  const onObjectsChangeRef = useRef(onObjectsChange);
  onObjectsChangeRef.current = onObjectsChange;
  const skipSave = useRef(true);

  const [, forceUpdate] = useState(0);
  const rerender = useCallback(() => forceUpdate(n => n + 1), []);

  useEffect(() => {
    const unsub = manager.subscribe(() => {
      rerender();
      if (!skipSave.current) {
        onObjectsChangeRef.current?.(manager.getObjects(), manager.getComponents());
      }
    });
    if (initialObjects && initialObjects.length > 0) {
      manager.loadObjects(initialObjects, initialComponents);
    }
    skipSave.current = false;
    return unsub;
  }, []);

  const [toolMode, setToolMode] = useState<ToolMode>('draw');
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [eraserMode, setEraserMode] = useState<EraserMode>('stroke');
  const [transform, setTransform] = useState<TransformState>({
    translateX: 0,
    translateY: 0,
    scale: 1,
  });
  const [canvasLayout, setCanvasLayout] = useState({ width: 0, height: 0 });
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [segmentMode, setSegmentMode] = useState(false);

  const { selectObject, getSelectedObject, deleteSelected, selection } = useSelectionManager(manager);

  const objects = manager.getObjects();
  const components = manager.getComponents();

  const handleSelectionChange = useCallback((id: string | null) => {
    selectObject(id);

    if (id && toolMode === 'device') {
      const obj = manager.getObject(id);
      if (obj?.metadata.componentId) {
        const comp = manager.getComponent(obj.metadata.componentId);
        if (comp) {
          onDevicePlace?.(comp.id, obj.position);
        }
      }
    }
  }, [toolMode, manager, onDevicePlace]);

  const { composed, currentStroke, preview } = useGestureHandler({
    manager,
    mode: toolMode,
    drawTool,
    eraserMode,
    transform,
    onTransformChange: setTransform,
    onDrawingEnd: () => {
      rerender();
    },
    onSelectionChange: handleSelectionChange,
    canvasLayout,
  });

  const handleSegment = useCallback(() => {
    const comps = manager.segmentIntoComponents();
    if (comps.length === 0) {
      Alert.alert('No Segments', 'Draw some shapes first, then segment.');
    } else {
      Alert.alert('Segmented', 'Found ' + comps.length + ' areas. You can rename them by tapping.');
    }
    setToolMode('device');
    rerender();
  }, [manager]);

  const handleUndo = useCallback(() => {
    manager.undo();
    rerender();
  }, [manager]);

  const handleRedo = useCallback(() => {
    manager.redo();
    rerender();
  }, [manager]);

  const handleClear = useCallback(() => {
    Alert.alert('Clear Canvas', 'Remove all objects?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          manager.clear();
          selectObject(null);
          rerender();
        },
      },
    ]);
  }, [manager]);

  const handleDeleteSelected = useCallback(() => {
    deleteSelected();
    rerender();
  }, [deleteSelected]);

  const handleRenameComponent = useCallback((compId: string) => {
    const comp = manager.getComponent(compId);
    if (comp) {
      setRenameTarget(compId);
      setRenameText(comp.name);
      setShowRenameModal(true);
    }
  }, [manager]);

  const handleSaveRename = useCallback(() => {
    if (renameTarget && renameText.trim()) {
      manager.updateComponentName(renameTarget, renameText.trim());
      setShowRenameModal(false);
      setRenameTarget(null);
      setRenameText('');
      rerender();
    }
  }, [renameTarget, renameText, manager]);

  const handleExport = useCallback(() => {
    const json = manager.exportJSON();
    onObjectsChange?.(objects, components);
    return json;
  }, [manager, objects, components]);

  const selectedObj = getSelectedObject();
  const selectedComp = selectedObj?.metadata.componentId
    ? manager.getComponent(selectedObj.metadata.componentId)
    : null;

  const effectiveMode = useMemo(() => {
    if (toolMode === 'segment') return 'segment';
    if (segmentMode && toolMode === 'device') return 'device';
    return toolMode;
  }, [toolMode, segmentMode]);

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <FlatList
          horizontal
          data={showDeviceMode ? [...TOOL_ITEMS, { mode: 'device' as ToolMode, icon: 'devices', label: 'Devices' }] : TOOL_ITEMS}
          keyExtractor={item => item.mode}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.toolBtn, toolMode === item.mode && styles.toolBtnActive]}
              onPress={() => {
                if (item.mode === 'segment') {
                  handleSegment();
                } else {
                  setToolMode(item.mode);
                  selectObject(null);
                }
              }}
            >
              <MaterialCommunityIcons
                name={item.icon as any}
                size={18}
                color={toolMode === item.mode ? '#fff' : COLORS.text}
              />
              <Text style={[styles.toolBtnText, toolMode === item.mode && styles.toolBtnTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
        />
      </View>

      {toolMode === 'draw' && (
        <View style={styles.subToolbar}>
          {DRAW_TOOLS.map(dt => (
            <TouchableOpacity
              key={dt.tool}
              style={[styles.subToolBtn, drawTool === dt.tool && styles.subToolBtnActive]}
              onPress={() => setDrawTool(dt.tool)}
            >
              <MaterialCommunityIcons
                name={dt.icon as any}
                size={16}
                color={drawTool === dt.tool ? COLORS.primary : COLORS.textSecondary}
              />
              <Text style={[styles.subToolBtnText, drawTool === dt.tool && styles.subToolBtnTextActive]}>
                {dt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.sep} />
          <TouchableOpacity style={styles.subToolBtn} onPress={handleUndo}>
            <MaterialCommunityIcons name="undo" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.subToolBtn} onPress={handleRedo}>
            <MaterialCommunityIcons name="redo" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.subToolBtn} onPress={handleClear}>
            <MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      )}

      {toolMode === 'erase' && (
        <View style={styles.subToolbar}>
          <TouchableOpacity
            style={[styles.subToolBtn, eraserMode === 'stroke' && styles.subToolBtnActive]}
            onPress={() => setEraserMode('stroke')}
          >
            <Text style={[styles.subToolBtnText, eraserMode === 'stroke' && styles.subToolBtnTextActive]}>
              Stroke
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.hintBar}>
        <Text style={styles.hintText}>
          {toolMode === 'draw'
            ? 'Draw walls, rooms, and shapes. Shapes auto-detected.'
            : toolMode === 'erase'
            ? 'Tap objects to erase them'
            : toolMode === 'select'
            ? 'Tap to select · Drag to move · Use handles to resize'
            : toolMode === 'device'
            ? 'Tap a segmented area to add a device'
            : 'Tap Segment to detect areas from your drawing'}
        </Text>
      </View>

      <View
        style={styles.canvasContainer}
        onLayout={e => setCanvasLayout({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        })}
      >
        <GestureDetector gesture={composed}>
          <View style={styles.canvasInner}>
            <SvgCanvas
              objects={objects}
              components={components}
              transform={transform}
              currentStroke={currentStroke.current}
              preview={preview}
              selectedId={selection.selectedId}
              canvasSize={canvasLayout}
            />
          </View>
        </GestureDetector>
      </View>

      {toolMode === 'select' && selectedObj && (
        <View style={styles.bottomPanel}>
          <View style={styles.panelInfo}>
            <Text style={styles.panelType}>{selectedObj.type}</Text>
            {selectedComp && (
              <Text style={styles.panelComp}>{selectedComp.name}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.panelBtn} onPress={() => manager.bringForward(selectedObj.id)}>
            <MaterialCommunityIcons name="arrow-up-bold" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.panelBtn} onPress={() => manager.sendBackward(selectedObj.id)}>
            <MaterialCommunityIcons name="arrow-down-bold" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.panelBtn} onPress={handleDeleteSelected}>
            <MaterialCommunityIcons name="delete-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      )}

      {toolMode === 'device' && components.length > 0 && (
        <View style={styles.componentList}>
          <Text style={styles.componentListTitle}>Areas ({components.length})</Text>
          <FlatList
            horizontal
            data={components}
            keyExtractor={c => c.id}
            renderItem={({ item: comp }) => (
              <TouchableOpacity
                style={[styles.compChip, { borderColor: comp.color }]}
                onPress={() => onComponentTap?.(comp)}
                onLongPress={() => handleRenameComponent(comp.id)}
              >
                <View style={[styles.compDot, { backgroundColor: comp.color }]} />
                <Text style={styles.compName}>{comp.name}</Text>
                <Text style={styles.compCount}>{comp.objectIds.length}</Text>
              </TouchableOpacity>
            )}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      <Modal visible={showRenameModal} animationType="fade" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rename Area</Text>
            <TextInput
              style={styles.modalInput}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowRenameModal(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveRename} style={styles.modalConfirm}>
                <Text style={styles.modalConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  toolbar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    marginRight: 4,
    gap: 4,
  },
  toolBtnActive: { backgroundColor: COLORS.primary },
  toolBtnText: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.text },
  toolBtnTextActive: { color: '#fff' },
  subToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 4,
  },
  subToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    gap: 3,
  },
  subToolBtnActive: { backgroundColor: COLORS.primary + '15' },
  subToolBtnText: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },
  subToolBtnTextActive: { color: COLORS.primary },
  sep: { width: 1, height: 16, backgroundColor: COLORS.border, marginHorizontal: 4 },
  hintBar: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  hintText: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  canvasContainer: { flex: 1, backgroundColor: '#EEF1F5', overflow: 'hidden' },
  canvasInner: { flex: 1 },
  bottomPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  panelInfo: { flex: 1 },
  panelType: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, textTransform: 'capitalize' },
  panelComp: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  panelBtn: { padding: SPACING.sm },
  componentList: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  componentListTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  compChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1.5,
    marginRight: 6,
    gap: 4,
    backgroundColor: COLORS.surface,
  },
  compDot: { width: 8, height: 8, borderRadius: 4 },
  compName: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.text },
  compCount: { fontSize: 9, color: COLORS.textLight },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.md, marginTop: SPACING.lg },
  modalCancel: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  modalCancelText: { color: COLORS.textSecondary, fontWeight: '600' },
  modalConfirm: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  modalConfirmText: { color: '#fff', fontWeight: '600' },
});
