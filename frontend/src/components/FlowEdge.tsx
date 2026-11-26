import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, useStore, type Edge, type EdgeProps } from '@xyflow/react';
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

/** Point at parameter t of a cubic Bézier path "M x,y C x,y x,y x,y" (as built by getBezierPath). */
export function bezierPoint(path: string, t: number): Point | null {
  const n = (path.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi) ?? []).map(Number);
  if (n.length < 8) return null;
  const [x0, y0, x1, y1, x2, y2, x3, y3] = n;
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * x0 + b * x1 + c * x2 + d * x3, y: a * y0 + b * y1 + c * y2 + d * y3 };
}

/** Where a new bend point can be dragged out of the line. */
export interface AddHandle {
  /** Index at which the new point is inserted into the bend points. */
  index: number;
  at: Point;
}

/**
 * Positions of the "add point" handles: on a line without bend points at a quarter and three quarters of the curve
 * (the label sits in the middle), otherwise in the middle of each segment, moved aside if the label is there.
 */
export function addHandles(all: Point[], points: Point[], bezier: string, label: Point, minGap: number): AddHandle[] {
  if (!points.length) {
    return [0.25, 0.75].map((t) => ({
      index: 0,
      at: bezierPoint(bezier, t) ?? {
        x: all[0].x + (all[1].x - all[0].x) * t,
        y: all[0].y + (all[1].y - all[0].y) * t,
      },
    }));
  }
  return all.slice(1).map((p, i) => {
    const prev = all[i];
    let f = 0.5;
    const mid = { x: (prev.x + p.x) / 2, y: (prev.y + p.y) / 2 };
    if (Math.hypot(mid.x - label.x, mid.y - label.y) < minGap) f = 0.25;
    return { index: i, at: { x: prev.x + (p.x - prev.x) * f, y: prev.y + (p.y - prev.y) * f } };
  });
}

const round = (p: Point): Point => ({ x: Math.round(p.x / 5) * 5, y: Math.round(p.y / 5) * 5 });

function FlowEdgeComponent(props: EdgeProps<FlowEdgeType>) {
  const {
    id, data, selected, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd,
    markerStart, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, interactionWidth,
  } = props;
  const { edgesEditable, setEdgeStyle } = useEditor();
  const { screenToFlowPosition } = useReactFlow();
  // Handles keep the same size on screen at every zoom level
  const zoom = useStore((s) => s.transform[2]);
  const flowId = data?.flow.id;
  const points = data?.points ?? [];

  let path: string;
  let labelX: number;
  let labelY: number;
  const [bezier, bezierX, bezierY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  if (points.length) {
    const all = [{ x: sourceX, y: sourceY }, ...points, { x: targetX, y: targetY }];
    path = smoothPath(all);
    ({ x: labelX, y: labelY } = halfway(all));
  } else {
    [path, labelX, labelY] = [bezier, bezierX, bezierY];
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
  const scale = 1 / (zoom || 1);
  const place = (p: Point) => ({ transform: `translate(${p.x}px, ${p.y}px) scale(${scale}) translate(-50%, -50%)` });
  const adds = showHandles ? addHandles(all, points, bezier, { x: labelX, y: labelY }, 40 * scale) : [];

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
          {adds.map((h, i) => (
            <div
              key={`add-${i}`}
              className="nsc-edge-handle nsc-edge-handle-add nodrag nopan"
              style={place(h.at)}
              title={t('Drag to bend the line')}
              onPointerDown={(e) => startDrag(e, h.index, true)}
            >
              <i className="mdi mdi-plus" />
            </div>
          ))}
          {points.map((p, i) => (
            <div
              key={`pt-${i}`}
              className="nsc-edge-handle nodrag nopan"
              style={place(p)}
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
