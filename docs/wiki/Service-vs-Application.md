# Service vs. Application

## What a service is

A **service** is a NetBox core object (*IPAM → Services*). It describes one listening port, or a few ports, with a
protocol on exactly one host: a device, a virtual machine or an FHRP group. Example: `grafana`, TCP 3000, on the VM
`monitoring`.

A service answers the question *where does something listen?*

## What an application is

An **application** is an object added by this plugin (*Plugins → Service Canvas → Applications*). It describes a piece
of software as a whole and links it to the services it consists of. It has a status, a version and a URL. Example:
`Grafana`, version 11.2, made of the services `grafana` (web UI) and `grafana-db` (database).

An application answers the question *what is it?*

## Side by side

| | Service | Application |
|---|---|---|
| Comes from | NetBox core (`ipam.Service`) | This plugin |
| Describes | One port/protocol on **one** host | The software as a whole |
| Example | `grafana · TCP 3000 · monitoring` | `Grafana` |
| Has | Protocol, ports, host | Status, version, URL, its services |
| On the canvas | Node linked to its host by a grey dashed line | Node linked to its services by dotted purple lines |

## Which one do I need?

- **One port, one host** (for example AdGuard on UDP 53): a service is enough. You do not need an application.
- **Software made of several parts**, possibly on different hosts (for example Paperless = web UI + Postgres +
  Redis): create one application and attach all its services. On the canvas it appears as one node.
- **You want status, version or URL** of the software: use an application, because NetBox services have no such
  fields.

An application can exist without services, and a service can belong to several applications.

## In the editor

The **New service** dialog has an *Application (optional)* section:

- **None** creates only the service.
- **New application** creates the application in the same step.
- **Add to existing** attaches the service to an existing application.

![New service dialog](https://raw.githubusercontent.com/Jasper-Claus/netbox-service-canvas/main/docs/images/new-service.png)

The **Application** button under *Create new* creates an application from existing services. Services selected on the
canvas are preselected.

## Connections

A **connection** (NetBox object *service connection*) records "A talks to B". Each end can be a service, a device, a
VM or an application. Use services when you know the port. Use hosts or applications when you only care about the big
picture.

In the [[Impact Analysis]], an application fails as soon as one of its services fails.
