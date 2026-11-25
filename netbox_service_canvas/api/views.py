from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.routers import APIRootView

from netbox.api.viewsets import NetBoxModelViewSet
from netbox.plugins import get_plugin_config

from .. import filtersets, graph
from ..models import Application, Canvas, CanvasGroup, CanvasNode, CanvasNote, ConnectionHop, ServiceConnection
from . import serializers

LAYOUT_CHANGELOG_MESSAGE = 'Canvas layout saved'


class ServiceCanvasRootView(APIRootView):
    def get_view_name(self):
        return 'Service Canvas'


class ApplicationViewSet(NetBoxModelViewSet):
    queryset = Application.objects.prefetch_related('services', 'tags')
    serializer_class = serializers.ApplicationSerializer
    filterset_class = filtersets.ApplicationFilterSet


class ServiceConnectionViewSet(NetBoxModelViewSet):
    queryset = ServiceConnection.objects.prefetch_related('source', 'target', 'tags').annotate(
        hop_count=Count('hops')
    )
    serializer_class = serializers.ServiceConnectionSerializer
    filterset_class = filtersets.ServiceConnectionFilterSet

    @extend_schema(
        request=serializers.HopOrderSerializer, responses={200: serializers.ConnectionHopSerializer(many=True)}
    )
    @action(detail=True, methods=['post'], url_path='reorder-hops')
    def reorder_hops(self, request, pk=None):
        """
        Set the order of all hops of a connection in one transaction: {"hops": [<hop id>, ...]} (first = 1).
        Requires `change` permission on the connection hops.
        """
        # NetBox restricts POST requests to the "add" action; reordering needs "view" on the connection plus
        # "change" on its hops (checked below).
        connection = get_object_or_404(ServiceConnection.objects.restrict(request.user, 'view'), pk=pk)
        serializer = serializers.HopOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        hop_ids = serializer.validated_data['hops']

        hops = {hop.pk: hop for hop in ConnectionHop.objects.restrict(request.user, 'change').filter(
            connection=connection)}
        existing = set(ConnectionHop.objects.filter(connection=connection).values_list('pk', flat=True))
        if set(hop_ids) != existing or len(hop_ids) != len(existing):
            raise ValidationError({'hops': _('The list must contain every hop of this connection exactly once.')})
        if set(hops) != existing:
            raise PermissionDenied()

        with transaction.atomic():
            # The (connection, order) constraint is deferred, so intermediate duplicates are fine
            for index, hop_id in enumerate(hop_ids, start=1):
                hop = hops[hop_id]
                if hop.order != index:
                    hop.snapshot()
                    hop.order = index
                    hop.save()

        qs = ConnectionHop.objects.filter(connection=connection).order_by('order')
        data = serializers.ConnectionHopSerializer(qs, many=True, context={'request': request}).data
        return Response(data)


class ConnectionHopViewSet(NetBoxModelViewSet):
    queryset = ConnectionHop.objects.prefetch_related('connection', 'object', 'tags')
    serializer_class = serializers.ConnectionHopSerializer
    filterset_class = filtersets.ConnectionHopFilterSet


class CanvasGroupViewSet(NetBoxModelViewSet):
    queryset = CanvasGroup.objects.select_related('canvas', 'site', 'cluster', 'tag')
    serializer_class = serializers.CanvasGroupSerializer
    filterset_class = filtersets.CanvasGroupFilterSet


class CanvasNodeViewSet(NetBoxModelViewSet):
    queryset = CanvasNode.objects.select_related('canvas', 'group').prefetch_related('object')
    serializer_class = serializers.CanvasNodeSerializer
    filterset_class = filtersets.CanvasNodeFilterSet


class CanvasNoteViewSet(NetBoxModelViewSet):
    queryset = CanvasNote.objects.select_related('canvas')
    serializer_class = serializers.CanvasNoteSerializer
    filterset_class = filtersets.CanvasNoteFilterSet


def _snap(value, grid):
    if value is None or not grid:
        return value
    return round(value / grid) * grid


def _layout_data(canvas):
    return {
        'canvas': canvas.pk,
        'grid_size': get_plugin_config('netbox_service_canvas', 'grid_size'),
        'groups': [
            {
                'id': g.pk, 'name': g.name, 'color': g.color,
                'x': g.x, 'y': g.y, 'width': g.width, 'height': g.height,
            }
            for g in canvas.groups.all()
        ],
        'nodes': [
            {
                'id': n.pk, 'object_type': f'{n.object_type.app_label}.{n.object_type.model}',
                'object_id': n.object_id, 'x': n.x, 'y': n.y, 'width': n.width, 'height': n.height,
                'group': n.group_id,
            }
            for n in canvas.nodes.select_related('object_type')
        ],
        'notes': [
            {
                'id': n.pk, 'text': n.text, 'color': n.color,
                'x': n.x, 'y': n.y, 'width': n.width, 'height': n.height,
            }
            for n in canvas.notes.all()
        ],
    }


class LayoutWriter:
    """
    Applies a layout payload to a canvas. Only rows whose values actually change are written; each write goes through
    snapshot() + full_clean() + save() so that a regular ObjectChange is recorded (required by netbox-branching).
    Object-level permissions are enforced per row, like NetBox's own API views do.
    """
    def __init__(self, canvas, user, grid):
        self.canvas = canvas
        self.user = user
        self.grid = grid
        self.groups = {g.pk: g for g in canvas.groups.all()}
        self.nodes = {n.pk: n for n in canvas.nodes.all()}
        self.notes = {n.pk: n for n in canvas.notes.all()}
        self.group_keys = {}
        self.result = {'created_groups': {}, 'created_nodes': {}, 'created_notes': {}, 'updated': 0, 'deleted': 0}

    def _require(self, model, perm):
        codename = f'netbox_service_canvas.{perm}_{model._meta.model_name}'
        if not self.user.has_perm(codename):
            raise PermissionDenied(_('Missing permission: {codename}').format(codename=codename))

    def _verify(self, obj, perm):
        # Enforce object-level permission constraints on the saved state
        if not type(obj).objects.restrict(self.user, perm).filter(pk=obj.pk).exists():
            raise PermissionDenied()

    def _save(self, obj, perm):
        obj._changelog_message = LAYOUT_CHANGELOG_MESSAGE
        try:
            obj.full_clean()
        except DjangoValidationError as e:
            raise ValidationError(e.message_dict if hasattr(e, 'error_dict') else e.messages)
        obj.save()
        self._verify(obj, perm)

    def _apply(self, obj, values, perm):
        changed = {k: v for k, v in values.items() if getattr(obj, k) != v}
        if not changed:
            return
        self._require(type(obj), perm)
        self._verify(obj, perm)
        obj.snapshot()
        for k, v in changed.items():
            setattr(obj, k, v)
        self._save(obj, perm)
        self.result['updated'] += 1

    def delete(self, model, pks, registry):
        for pk in pks:
            obj = registry.pop(pk, None)
            if obj is None:
                continue  # already gone (or not part of this canvas)
            self._require(model, 'delete')
            self._verify(obj, 'delete')
            obj.snapshot()
            obj._changelog_message = LAYOUT_CHANGELOG_MESSAGE
            obj.delete()
            self.result['deleted'] += 1

    def write_groups(self, groups):
        for data in groups:
            values = {
                'name': data['name'],
                'x': _snap(data['x'], self.grid), 'y': _snap(data['y'], self.grid),
                'width': _snap(data['width'], self.grid), 'height': _snap(data['height'], self.grid),
            }
            if 'color' in data:
                values['color'] = data['color']
            if data.get('id'):
                group = self.groups.get(data['id'])
                if group is None:
                    raise ValidationError({'groups': _('Group {id} does not belong to this canvas.').format(
                        id=data['id'])})
                self._apply(group, values, 'change')
            else:
                self._require(CanvasGroup, 'add')
                group = CanvasGroup(canvas=self.canvas, **values)
                self._save(group, 'add')
                self.groups[group.pk] = group
                if data.get('key'):
                    self.group_keys[data['key']] = group
                    self.result['created_groups'][data['key']] = group.pk

    def _resolve_group(self, data):
        if data.get('group_key'):
            group = self.group_keys.get(data['group_key'])
            if group is None:
                raise ValidationError({'nodes': _('Unknown group key "{key}".').format(key=data['group_key'])})
            return group.pk
        group_id = data.get('group')
        if group_id and group_id not in self.groups:
            raise ValidationError({'nodes': _('Group {id} does not belong to this canvas.').format(id=group_id)})
        return group_id or None

    def write_nodes(self, nodes):
        for data in nodes:
            values = {'x': _snap(data['x'], self.grid), 'y': _snap(data['y'], self.grid)}
            # Only touch the group membership if the payload says something about it
            if 'group' in data or 'group_key' in data or not data.get('id'):
                values['group_id'] = self._resolve_group(data)
            if 'width' in data:
                values['width'] = _snap(data['width'], self.grid)
            if 'height' in data:
                values['height'] = _snap(data['height'], self.grid)
            if data.get('id'):
                node = self.nodes.get(data['id'])
                if node is None:
                    raise ValidationError({'nodes': _('Node {id} does not belong to this canvas.').format(
                        id=data['id'])})
                self._apply(node, values, 'change')
            else:
                self._require(CanvasNode, 'add')
                node = CanvasNode(
                    canvas=self.canvas, object_type=data['object_type'], object_id=data['object_id'], **values
                )
                self._save(node, 'add')
                self.nodes[node.pk] = node
                key = f"{data['object_type'].app_label}.{data['object_type'].model}:{data['object_id']}"
                self.result['created_nodes'][key] = node.pk


    def write_notes(self, notes):
        for data in notes:
            values = {
                'x': _snap(data['x'], self.grid), 'y': _snap(data['y'], self.grid),
                'width': _snap(data['width'], self.grid), 'height': _snap(data['height'], self.grid),
            }
            for field in ('text', 'color'):
                if field in data:
                    values[field] = data[field]
            if data.get('id'):
                note = self.notes.get(data['id'])
                if note is None:
                    raise ValidationError({'notes': _('Note {id} does not belong to this canvas.').format(
                        id=data['id'])})
                self._apply(note, values, 'change')
            else:
                self._require(CanvasNote, 'add')
                note = CanvasNote(canvas=self.canvas, **values)
                self._save(note, 'add')
                self.notes[note.pk] = note
                if data.get('key'):
                    self.result['created_notes'][data['key']] = note.pk


class CanvasViewSet(NetBoxModelViewSet):
    queryset = Canvas.objects.select_related('site', 'cluster').prefetch_related('tags').annotate(
        node_count=Count('nodes')
    )
    serializer_class = serializers.CanvasSerializer
    filterset_class = filtersets.CanvasFilterSet

    @extend_schema(methods=['get'], responses={200: dict})
    @extend_schema(methods=['put'], request=serializers.CanvasLayoutSerializer, responses={200: dict})
    @action(detail=True, methods=['get', 'put'], url_path='layout')
    def layout(self, request, pk=None):
        """
        GET: the stored layout (groups, nodes and notes) of a canvas.
        PUT: save the layout of a canvas in a single transaction. Requires `change` permission on the canvas plus the
        respective add/change/delete permissions on canvas nodes and groups. Only rows that actually changed are
        written, so autosave does not flood the changelog.
        """
        canvas = self.get_object()  # queryset is restricted to "view" (GET) or "change" (PUT)
        if request.method == 'GET':
            return Response(_layout_data(canvas))

        serializer = serializers.CanvasLayoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        writer = LayoutWriter(canvas, request.user, get_plugin_config('netbox_service_canvas', 'grid_size'))
        with transaction.atomic():
            writer.delete(CanvasNode, data['deleted_nodes'], writer.nodes)
            writer.delete(CanvasGroup, data['deleted_groups'], writer.groups)
            writer.delete(CanvasNote, data['deleted_notes'], writer.notes)
            writer.write_groups(data['groups'])
            writer.write_nodes(data['nodes'])
            writer.write_notes(data['notes'])

        canvas.refresh_from_db()
        return Response({**_layout_data(canvas), **writer.result})

    @extend_schema(responses={200: dict})
    @action(detail=True, methods=['get'], url_path='graph')
    def graph(self, request, pk=None):
        """
        Everything the canvas editor needs in one request: stored layout, a descriptor for every placed object and the
        edges between them (Service.parent and ServiceConnections). Optional `?include=<key>,<key>` adds unsaved
        objects (keys like "ipam.service:12") so that their edges can be shown before the layout is saved.
        """
        canvas = self.get_object()
        layout = _layout_data(canvas)
        keys = [n['object_type'] + ':' + str(n['object_id']) for n in layout['nodes']]
        extra = [k for raw in request.query_params.getlist('include') for k in raw.split(',') if k]
        all_keys = list(dict.fromkeys(keys + extra))
        descriptors = graph.describe_keys(request.user, graph.parse_keys(all_keys))
        visible = [k for k in all_keys if k in descriptors]
        return Response({
            **layout,
            'objects': descriptors,
            'edges': graph.build_edges(request.user, visible, descriptors),
        })

    @extend_schema(responses={200: dict})
    @action(detail=True, methods=['get'], url_path='missing')
    def missing(self, request, pk=None):
        """
        Objects related to the canvas' nodes that are not placed yet (services of placed hosts, parents of placed
        services, other endpoints of connections). `?include=` adds unsaved node keys, as for `graph`.
        """
        canvas = self.get_object()
        keys = [f'{n.object_type.app_label}.{n.object_type.model}:{n.object_id}'
                for n in canvas.nodes.select_related('object_type')]
        extra = [k for raw in request.query_params.getlist('include') for k in raw.split(',') if k]
        missing = graph.missing_keys(request.user, list(dict.fromkeys(keys + extra)))
        descriptors = graph.describe_keys(request.user, graph.parse_keys(missing))
        return Response({'objects': descriptors})
