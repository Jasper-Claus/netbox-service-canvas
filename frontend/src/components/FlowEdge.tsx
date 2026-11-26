import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type Edge, type EdgeProps } from '@xyflow/react';
import { memo, useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import { useEditor } from '../context';
import type { FlowEdgeData } from '../graph';
import { t } from '../i18n';
import type { Point } from '../types';

type FlowEdgeType = Edge<Extract<FlowEdgeData, { kind: 'flow' }>, 'flow'>;

/**
 * Smooth path through all points (Catmull-Rom spline converted to cubic Bézier segments). With only start and end it
 * is a straight line.
 */
export function smoothPath(points: Point[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** The point halfway along a polyline (used to place the label). */
export function halfway(points: Point[]): Point {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let rest = lengths.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (rest <= lengths[i] && lengths[i] > 0) {
      const f = rest / lengths[i];
      return { x: points[i].x + (points[i + 1].x - points[i].x) * f, y: points[i].y + (points[i + 1].y - points[i].y) * f };
    }
    rest -= lengths[i];
  }
  return points[Math.floor(points.length / 2)];
}

const round = (p: Point): Point => ({ x: Math.round(p.x / 5) * 5, y: Math.round(p.y / 5) * 5 });

function FlowEdgeComponent(props: EdgeProps<FlowEdgeType>) {
  const {
    id, data, selected, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd,
    markerStart, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, interactionWidth,
  } = props;
  const { edgesEditable, setEdgeStyle } = useEditor();
  const { screenToFlowPosition } = useReactFlow();
  const flowId = data?.flow.id;
  const points = data?.points ?? [];

  let path: string;
  let labelX: number;
  let labelY: number;
  if (points.length) {
    const all = [{ x: sourceX, y: sourceY }, ...points, { x: targetX, y: targetY }];
    path = smoothPath(all);
    ({ x: labelX, y: labelY } = halfway(all));
  } else {
    [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  }

  /** Drag the bend point at `index` (inserted first when `insert` is set) until the pointer is released. */
  const startDrag = useCallback((event: ReactPointerEvent, index: number, insert: boolean) => {
    if (flowId === undefined) return;
    event.stopPropagation();
    event.preventDefault();
    let current = [...points];
    if (insert) current.splice(index, 0, round(screenToFlowPosition({ x: event.clientX, y: event.clientY })));
    setEdgeStyle(flowId, { points: current });
    const move = (e: PointerEvent) => {
      current = current.map((p, i) => (i === index ? round(screenToFlowPosition({ x: e.clientX, y: e.clientY })) : p));
      setEdgeStyle(flowId, { points: current });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [flowId, points, screenToFlowPosition, setEdgeStyle]);

  const removePoint = useCallback((index: number) => {
    if (flowId === undefined) return;
    setEdgeStyle(flowId, { points: points.filter((_, i) => i !== index) });
  }, [flowId, points, setEdgeStyle]);

  const all = [{ x: sourceX, y: sourceY }, ...points, { x: targetX, y: targetY }];
  const showHandles = selected && edgesEditable;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={style}
        markerEnd={markerEnd}
        markerStart={markerStart}
        label={label}
        labelX={labelX}
        labelY={labelY}
        labelStyle={labelStyle}
        labelShowBg={labelShowBg}
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
        interactionWidth={interactionWidth ?? 20}
      />
      {showHandles && (
        <EdgeLabelRenderer>
          {all.slice(1).map((p, i) => {
            const prev = all[i];
            return (
              <div
                key={`add-${i}`}
                className="nsc-edge-handle nsc-edge-handle-add nodrag nopan"
                style={{ transform: `translate(-50%, -50%) translate(${(prev.x + p.x) / 2}px, ${(prev.y + p.y) / 2}px)` }}
                title={t('Drag to bend the line')}
                onPointerDown={(e) => startDrag(e, i, true)}
              />
            );
          })}
          {points.map((p, i) => (
            <div
              key={`pt-${i}`}
              className="nsc-edge-handle nodrag nopan"
              style={{ transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)` }}
              title={t('Drag to move, double-click to remove')}
              onPointerDown={(e) => startDrag(e, i, false)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                removePoint(i);
              }}
            />
          ))}
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const FlowEdge = memo(FlowEdgeComponent);
