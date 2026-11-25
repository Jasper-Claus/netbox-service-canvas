"""
Referential integrity for the generic foreign keys of this plugin.

Django's GenericForeignKey does not cascade on delete, and adding GenericRelations to NetBox core models is not an
option (no core changes). Instead, a single `pre_delete` receiver reacts to the deletion of any object type this plugin
references:

* Device / VirtualMachine / Service deleted  -> CanvasNodes placing it are deleted.
* Endpoint of a ServiceConnection deleted    -> the ServiceConnection (and with it, its hops) is deleted.
* Object referenced by a ConnectionHop deleted -> the hop is deleted, and the remaining hops of the affected
                                                connections are renumbered 1..n.

All deletions are performed per object via `obj.delete()` (never via a bulk queryset delete or raw SQL). This way every
cascaded deletion produces its own ObjectChange with full pre-change data, which keeps the changelog complete and is
what netbox-branching relies on to replay changes made inside a branch.

Cascades inside NetBox are covered as well: deleting a Device makes Django cascade to its Services (GenericRelation)
and Interfaces, and `pre_delete` is sent for each of them individually.
"""
from django.contrib.contenttypes.models import ContentType
from django.db.models.signals import pre_delete
from django.dispatch import receiver

from .constants import CANVAS_NODE_TYPES, CONNECTION_ENDPOINT_TYPES, HOP_OBJECT_TYPES
from .models import CanvasNode, ConnectionHop, ServiceConnection

_NODE_LABELS = frozenset(f'{app}.{model}' for app, model in CANVAS_NODE_TYPES)
_ENDPOINT_LABELS = frozenset(f'{app}.{model}' for app, model in CONNECTION_ENDPOINT_TYPES)
_HOP_LABELS = frozenset(f'{app}.{model}' for app, model in HOP_OBJECT_TYPES)
_ALL_LABELS = _NODE_LABELS | _ENDPOINT_LABELS | _HOP_LABELS


def delete_canvas_nodes(ct, pk):
    for node in CanvasNode.objects.filter(object_type=ct, object_id=pk):
        node.delete()


def delete_connections(ct, pk):
    for connection in ServiceConnection.objects.filter(source_type=ct, source_id=pk) | \
            ServiceConnection.objects.filter(target_type=ct, target_id=pk):
        connection.delete()


def delete_hops(ct, pk):
    affected = set()
    for hop in ConnectionHop.objects.filter(object_type=ct, object_id=pk):
        affected.add(hop.connection_id)
        hop.delete()
    for connection_id in affected:
        ConnectionHop.renumber(connection_id)


@receiver(pre_delete, dispatch_uid='netbox_service_canvas_gfk_cleanup')
def handle_referenced_object_delete(sender, instance, **kwargs):
    label = sender._meta.label_lower
    if label not in _ALL_LABELS or instance.pk is None:
        return

    ct = ContentType.objects.get_for_model(sender)
    if label in _NODE_LABELS:
        delete_canvas_nodes(ct, instance.pk)
    # Connections first: their hops go with them, so they need no renumbering
    if label in _ENDPOINT_LABELS:
        delete_connections(ct, instance.pk)
    if label in _HOP_LABELS:
        delete_hops(ct, instance.pk)
