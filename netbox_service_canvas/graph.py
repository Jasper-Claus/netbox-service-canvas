"""
Read-side helpers for the canvas editor: turn NetBox objects into compact node descriptors and derive the edges
between them. Edges are never stored per canvas. They come from Service.parent ("runs on"), Application.services
("part of"), ServiceConnection and the cables documented in NetBox (physical layer).

Object keys have the form "<app_label>.<model>:<pk>", e.g. "ipam.service:12".
"""
from collections import defaultdict

from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, Q

from dcim.models import Device, Interface
from ipam.models import Service
from virtualization.models import VirtualMachine

from .constants import CANVAS_NODE_TYPES
from .models import Application, ServiceConnection

MODELS = {
    'dcim.device': Device,
    'virtualization.virtualmachine': VirtualMachine,
    'ipam.service': Service,
    'netbox_service_canvas.application': Application,
}
NODE_TYPE = {
    'dcim.device': 'device',
    'virtualization.virtualmachine': 'virtualmachine',
    'ipam.service': 'service',
    'netbox_service_canvas.application': 'application',
}
APPLICATION = 'netbox_service_canvas.application'
SERVICE = 'ipam.service'


def make_key(label, pk):
    return f'{label}:{pk}'


def ct_label(ct):
    return f'{ct.app_label}.{ct.model}'


def parse_keys(raw_keys):
    """
    Parse "app.model:pk" strings into {label: {pk, ...}}. Invalid or unsupported keys are ignored.
    """
    allowed = {f'{app}.{model}' for app, model in CANVAS_NODE_TYPES}
    result = defaultdict(set)
    for raw in raw_keys:
        for key in str(raw).split(','):
            label, _, pk = key.strip().partition(':')
            if label in allowed and pk.isdigit():
                result[label].add(int(pk))
    return result


def _status(obj):
    if not hasattr(obj, 'get_status_color'):
        return None
    return {
        'value': obj.status,
        'label': str(obj.get_status_display()),
        'color': obj.get_status_color(),
    }


def _primary_ip(obj):
    ip = getattr(obj, 'primary_ip', None)
    return str(ip.address.ip) if ip else None


def describe(obj, label=None):
    label = label or obj._meta.label_lower
    data = {
        'key': make_key(label, obj.pk),
        'type': NODE_TYPE[label],
        'id': obj.pk,
        'name': obj.name or str(obj),
        'url': obj.get_absolute_url(),
        'status': None,
        'primary_ip': None,
        'subtitle': '',
    }
    if label == 'dcim.device':
        data['status'] = _status(obj)
        data['primary_ip'] = _primary_ip(obj)
        data['subtitle'] = str(obj.role) if obj.role_id else str(obj.device_type)
    elif label == 'virtualization.virtualmachine':
        data['status'] = _status(obj)
        data['primary_ip'] = _primary_ip(obj)
        data['subtitle'] = str(obj.cluster) if obj.cluster_id else ''
        # The device the VM is pinned to (optional in NetBox), used for "runs on" and impact analysis
        data['host_key'] = make_key('dcim.device', obj.device_id) if obj.device_id else None
    elif label == 'ipam.service':
        parent = obj.parent
        parent_label = obj.parent_object_type.app_label + '.' + obj.parent_object_type.model
        data['status'] = _status(parent) if parent is not None else None  # services inherit the parent's status
        data['subtitle'] = str(parent) if parent is not None else ''
        data['service'] = {
            'protocol': obj.protocol,
            'protocol_label': str(obj.get_protocol_display()),
            'ports': list(obj.ports),
            'parent_key': make_key(parent_label, obj.parent_object_id),
            'parent_type': parent_label,
            'parent_name': str(parent) if parent is not None else '',
        }
    elif label == APPLICATION:
        data['status'] = _status(obj)
        service_ids = [s.pk for s in obj.services.all()]  # prefetched
        data['subtitle'] = obj.version
        data['application'] = {
            'version': obj.version,
            'icon': obj.icon,
            'web_url': obj.web_url,
            'description': obj.description,
            'service_keys': [make_key(SERVICE, pk) for pk in sorted(service_ids)],
        }
    return data


def fetch_objects(user, keys_by_label):
    """
    Return {key: obj} for the requested keys, restricted to what `user` may view.
    """
    objects = {}
    for label, pks in keys_by_label.items():
        if not pks:
            continue
        qs = MODELS[label].objects.restrict(user, 'view').filter(pk__in=pks)
        if label == 'dcim.device':
            qs = qs.select_related('role', 'device_type', 'primary_ip4', 'primary_ip6')
        elif label == 'virtualization.virtualmachine':
            qs = qs.select_related('cluster', 'primary_ip4', 'primary_ip6')
        elif label == 'ipam.service':
            qs = qs.select_related('parent_object_type').prefetch_related('parent')
        elif label == APPLICATION:
            qs = qs.prefetch_related('services')
        for obj in qs:
            objects[make_key(label, obj.pk)] = obj
    return objects


def describe_keys(user, keys_by_label):
    return {key: describe(obj) for key, obj in fetch_objects(user, keys_by_label).items()}


def _endpoint_filter(keys_by_label, prefix):
    q = Q()
    for label, pks in keys_by_label.items():
        if pks:
            app_label, model = label.split('.')
            q |= Q(**{
                f'{prefix}_type__app_label': app_label,
                f'{prefix}_type__model': model,
                f'{prefix}_id__in': pks,
            })
    return q


def connection_data(conn):
    return {
        'id': conn.pk,
        'source': make_key(ct_label(conn.source_type), conn.source_id),
        'target': make_key(ct_label(conn.target_type), conn.target_id),
        'direction': conn.direction,
        'protocol': conn.protocol,
        'protocol_label': str(conn.get_protocol_display()),
        'port': conn.port,
        'status': conn.status,
        'status_label': str(conn.get_status_display()),
        'kind': conn.kind,
        'data_description': conn.data_description,
        'description': conn.description,
        'hop_count': getattr(conn, 'hop_count', None),
        # Objects the connection passes through; if one of them fails, the connection breaks (impact analysis)
        'hop_keys': [make_key(ct_label(h.object_type), h.object_id) for h in conn.hops.all()],
        'url': conn.get_absolute_url(),
    }


def _far_interfaces(path):
    """Interface pks at the far end of a cable path (path nodes have the form "<content type id>:<object id>")."""
    iface_ct = ContentType.objects.get_for_model(Interface).pk
    result = []
    for node in (path or [[]])[-1]:
        ct_id, _, obj_id = str(node).partition(':')
        if ct_id.isdigit() and obj_id.isdigit() and int(ct_id) == iface_ct:
            result.append(int(obj_id))
    return result


def _cable_ids(path):
    """Cable pks along a cable path (every second step of the path holds the cables)."""
    cable_ct = ContentType.objects.get_by_natural_key('dcim', 'cable').pk
    result = []
    for step in (path or [])[1::2]:
        for node in step:
            ct_id, _, obj_id = str(node).partition(':')
            if ct_id.isdigit() and obj_id.isdigit() and int(ct_id) == cable_ct:
                result.append(int(obj_id))
    return result


def cable_links(user, device_pks):
    """
    Physical links of the given devices, taken from NetBox's cable paths (so a link through patch panels counts as one
    link between the two devices at its ends). Links between the same two devices are merged into one entry.
    Only complete paths from interface to interface are considered.
    """
    if not device_pks:
        return []
    rows = list(Interface.objects.restrict(user, 'view').filter(
        device_id__in=device_pks, _path__isnull=False, _path__is_complete=True,
    ).values_list('pk', 'name', 'device_id', '_path__path', '_path__is_active'))
    far_pks = {pk for row in rows for pk in _far_interfaces(row[3])}
    far = {
        pk: (name, device_id)
        for pk, name, device_id in Interface.objects.restrict(user, 'view').filter(pk__in=far_pks).values_list(
            'pk', 'name', 'device_id'
        )
    }

    links = {}
    seen = set()
    for pk, name, device_id, path, active in rows:
        for far_pk in _far_interfaces(path):
            if far_pk not in far or frozenset((pk, far_pk)) in seen:
                continue
            seen.add(frozenset((pk, far_pk)))
            far_name, far_device = far[far_pk]
            if far_device == device_id:
                continue
            # Same orientation for both directions: lower device pk is the source
            if device_id < far_device:
                a, b = (device_id, name), (far_device, far_name)
            else:
                a, b = (far_device, far_name), (device_id, name)
            link = links.setdefault((a[0], b[0]), {
                'id': f'cable:{a[0]}-{b[0]}',
                'source': make_key('dcim.device', a[0]),
                'target': make_key('dcim.device', b[0]),
                'interfaces': [],
                'cable_ids': [],
                'active': True,
            })
            link['interfaces'].append([a[1], b[1]])
            link['cable_ids'].extend(c for c in _cable_ids(path) if c not in link['cable_ids'])
            link['active'] = link['active'] and bool(active)
    for link in links.values():
        link['interfaces'].sort()
        link['patched'] = len(link['cable_ids']) > len(link['interfaces'])
    return sorted(links.values(), key=lambda link: link['id'])


def build_edges(user, node_keys, descriptors):
    """
    Derive edges between the given nodes:
      * runs_on: service -> its parent device/VM, and VM -> the device it is pinned to (if both are present)
      * part_of: service -> application it belongs to (if both are present)
      * flow:    every ServiceConnection whose source and target are both present
      * cables:  physical links between devices (NetBox cables, also through patch panels)
    """
    present = set(node_keys)
    runs_on = []
    part_of = []
    for key, desc in descriptors.items():
        service = desc.get('service')
        if service and service['parent_key'] in present:
            runs_on.append({'id': f'runs_on:{key}', 'source': key, 'target': service['parent_key']})
        host_key = desc.get('host_key')
        if host_key and host_key in present:
            runs_on.append({'id': f'runs_on:{key}', 'source': key, 'target': host_key})
        application = desc.get('application')
        if application:
            for service_key in application['service_keys']:
                if service_key in present:
                    part_of.append({'id': f'part_of:{service_key}:{key}', 'source': service_key, 'target': key})

    keys_by_label = parse_keys(node_keys)
    flows = []
    if keys_by_label:
        qs = ServiceConnection.objects.restrict(user, 'view').filter(
            _endpoint_filter(keys_by_label, 'source') & _endpoint_filter(keys_by_label, 'target')
        ).select_related('source_type', 'target_type').prefetch_related('hops__object_type').annotate(
            hop_count=Count('hops'),
        )
        flows = [connection_data(conn) for conn in qs]
    device_pks = keys_by_label.get('dcim.device', set())
    cables = [
        link for link in cable_links(user, device_pks)
        if link['source'] in present and link['target'] in present
    ]
    return {'runs_on': runs_on, 'part_of': part_of, 'flows': flows, 'cables': cables}


def missing_keys(user, node_keys):
    """
    Objects related to the nodes of a canvas that are not on it yet:
      * services running on devices/VMs of the canvas
      * VMs pinned to devices of the canvas, and the devices of VMs on the canvas
      * parents of services on the canvas
      * services of applications on the canvas, and applications of services on the canvas
      * the other endpoint of every connection touching an object on the canvas
      * devices cabled to devices on the canvas (switches, routers, …)
    """
    present = set(node_keys)
    keys_by_label = parse_keys(node_keys)
    found = set()

    for label in ('dcim.device', 'virtualization.virtualmachine'):
        pks = keys_by_label.get(label)
        if pks:
            ct = ContentType.objects.get_by_natural_key(*label.split('.'))
            for pk in Service.objects.restrict(user, 'view').filter(
                parent_object_type=ct, parent_object_id__in=pks
            ).values_list('pk', flat=True):
                found.add(make_key('ipam.service', pk))

    device_pks = keys_by_label.get('dcim.device')
    if device_pks:
        for pk in VirtualMachine.objects.restrict(user, 'view').filter(
            device__in=device_pks
        ).values_list('pk', flat=True):
            found.add(make_key('virtualization.virtualmachine', pk))
        for link in cable_links(user, device_pks):
            found.update((link['source'], link['target']))
    vm_pks = keys_by_label.get('virtualization.virtualmachine')
    if vm_pks:
        for device_id in VirtualMachine.objects.filter(
            pk__in=vm_pks, device__isnull=False
        ).values_list('device_id', flat=True):
            found.add(make_key('dcim.device', device_id))

    service_pks = keys_by_label.get('ipam.service')
    if service_pks:
        for ct_id, parent_id in Service.objects.filter(pk__in=service_pks).values_list(
            'parent_object_type', 'parent_object_id'
        ):
            label = ct_label(ContentType.objects.get_for_id(ct_id))
            if label in MODELS:
                found.add(make_key(label, parent_id))

    app_pks = keys_by_label.get(APPLICATION)
    if app_pks:
        for pk in Service.objects.restrict(user, 'view').filter(
            service_canvas_applications__in=app_pks
        ).values_list('pk', flat=True).distinct():
            found.add(make_key(SERVICE, pk))
    if service_pks:
        for pk in Application.objects.restrict(user, 'view').filter(
            services__in=service_pks
        ).values_list('pk', flat=True).distinct():
            found.add(make_key(APPLICATION, pk))

    if keys_by_label:
        qs = ServiceConnection.objects.restrict(user, 'view').filter(
            _endpoint_filter(keys_by_label, 'source') | _endpoint_filter(keys_by_label, 'target')
        ).select_related('source_type', 'target_type')
        for conn in qs:
            found.add(make_key(ct_label(conn.source_type), conn.source_id))
            found.add(make_key(ct_label(conn.target_type), conn.target_id))

    return sorted(found - present)
