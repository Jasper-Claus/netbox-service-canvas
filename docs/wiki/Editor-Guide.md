# Editor Guide

## Toolbar

| Button | What it does |
|---|---|
| ◧ | Show or hide the sidebar |
| **"Edit"** / **"View only"** | Switch between edit mode and view mode (see below) |
| **"Group"** | Add a group frame; selected nodes go into it |
| **"Auto layout"** | Arrange everything automatically (ELK) |
| **"Add missing"** | Add related services, hosts and connection peers that are not on the canvas yet |
| Grid / map / link icons | Snap to grid, minimap, show "runs on" edges |
| Fit / reload icons | Show everything, reload from NetBox |
| **PNG / SVG / PDF (A4)** | See [[Export]] |
| **Autosave** | Save layout changes automatically. When it is off, a *Save* button appears. |

## Edit mode vs. view mode

The button at the top left toggles between **"Edit"** and **"View only"**. View mode
hides all editing controls: handles, *remove* buttons and create buttons. Your browser remembers the choice for
each canvas.

> **Can't find the remove button?** You are probably in "View only". Click it to switch back to "Edit".

Users without change permission always see a grey **"View only"** badge.

## Nodes

- **Click** a node to open the **node panel**. It shows details, the node's connections on this canvas, *quick edit*
  for services and applications, a link to the full NetBox form, and ⚡ [[Impact Analysis]].
- **Drag from the dot on the right** onto another node to create a data flow (a real `ServiceConnection`).
- **Double-click** a note to edit its text.

## Remove vs. delete

| Action | Effect |
|---|---|
| **"Remove"** (toolbar above a selected node), the **Del** key, or **"Remove from this canvas"** in the panel | Removes the node **from this canvas only**. The object stays in NetBox. |
| **"Edit all fields" → Delete** in NetBox | Deletes the object in NetBox. It then disappears from every canvas. |

## Edges

Click an edge to edit its protocol, port, the transported data, its status and its **hops** (reverse proxy, VLAN,
VRF, tunnel …).

| Line | Meaning |
|---|---|
| Solid green | Active data flow |
| Dashed | Planned |
| Dotted grey | Disabled |
| Dashed grey | Runs on: service on its host, VM on its device |
| Dotted purple | Service belongs to application |
