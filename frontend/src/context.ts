import { createContext, useContext } from 'react';
import type { Api } from './api';
import type { EdgeStyle, Perms } from './types';

export interface GroupUpdate {
  name?: string;
  color?: string;
  width?: number;
  height?: number;
}

export interface NoteUpdate {
  text?: string;
  color?: string;
  width?: number;
  height?: number;
}

export interface EditorContextValue {
  api: Api;
  perms: Perms;
  readOnly: boolean;
  grid: number;
  /** NetBox UI base path, e.g. "/" or "/netbox/" (derived from the API root). */
  netboxBase: string;
  updateGroup: (nodeId: string, update: GroupUpdate) => void;
  deleteGroup: (nodeId: string) => void;
  updateNote: (nodeId: string, update: NoteUpdate) => void;
  deleteNote: (nodeId: string) => void;
  /** Bend points and color of connection lines may be edited. */
  edgesEditable: boolean;
  /** Change the look of a connection line on this canvas (saved with the layout). */
  setEdgeStyle: (flowId: number, update: Partial<EdgeStyle>) => void;
  /** Remove an object node from the canvas (the NetBox object stays). */
  removeNode: (key: string) => void;
  notify: (message: string, kind?: 'success' | 'danger' | 'info') => void;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('EditorContext missing');
  return ctx;
}
