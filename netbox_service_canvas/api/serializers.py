from django.contrib.contenttypes.models import ContentType
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from dcim.api.serializers import SiteSerializer
from extras.api.serializers import TagSerializer
from ipam.api.serializers import ServiceSerializer
from ipam.models import Service
from netbox.api.fields import ChoiceField, ContentTypeField, SerializedPKRelatedField
from netbox.api.gfk_fields import GFKSerializerField
from netbox.api.serializers import (
    ChangeLogMessageSerializer,
    NetBoxModelSerializer,
    PrimaryModelSerializer,
    ValidatedModelSerializer,
)
from virtualization.api.serializers import ClusterSerializer

from ..choices import (
    ApplicationStatusChoices,
    ConnectionDirectionChoices,
    ConnectionKindChoices,
    ConnectionProtocolChoices,
    ConnectionStatusChoices,
)
from ..constants import CANVAS_NODE_MODELS, CONNECTION_ENDPOINT_MODELS, HOP_OBJECT_MODELS
from ..models import Application, Canvas, CanvasGroup, CanvasNode, CanvasNote, ConnectionHop, ServiceConnection

__all__ = (
    'ApplicationSerializer',
    'CanvasGroupSerializer',
    'CanvasLayoutSerializer',
    'CanvasNodeSerializer',
    'CanvasNoteSerializer',
    'CanvasSerializer',
    'ConnectionHopSerializer',
    'HopOrderSerializer',
    'ServiceConnectionSerializer',
)


class ApplicationSerializer(PrimaryModelSerializer):
    status = ChoiceField(choices=ApplicationStatusChoices, required=False)
    services = SerializedPKRelatedField(
        queryset=Service.objects.all(),
        serializer=ServiceSerializer,
        nested=True,
        required=False,
        many=True,
    )

    class Meta:
        model = Application
        fields = (
            'id', 'url', 'display_url', 'display', 'name', 'status', 'version', 'icon', 'web_url', 'services',
            'description', 'owner', 'comments', 'tags', 'custom_fields', 'created', 'last_updated',
        )
        brief_fields = ('id', 'url', 'display', 'name', 'status', 'version', 'icon', 'description')


class ServiceConnectionSerializer(PrimaryModelSerializer):
    source_type = ContentTypeField(
        queryset=ContentType.objects.filter(CONNECTION_ENDPOINT_MODELS),
    )
    source = GFKSerializerField(read_only=True)
    target_type = ContentTypeField(
        queryset=ContentType.objects.filter(CONNECTION_ENDPOINT_MODELS),
    )
    target = GFKSerializerField(read_only=True)
    direction = ChoiceField(choices=ConnectionDirectionChoices, required=False)
    protocol = ChoiceField(choices=ConnectionProtocolChoices)
    status = ChoiceField(choices=ConnectionStatusChoices, required=False)
    kind = ChoiceField(choices=ConnectionKindChoices, required=False)
    hop_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = ServiceConnection
        fields = (
            'id', 'url', 'display_url', 'display', 'source_type', 'source_id', 'source', 'target_type', 'target_id',
            'target', 'direction', 'protocol', 'port', 'data_description', 'status', 'kind', 'hop_count', 'description',
            'owner', 'comments', 'tags', 'custom_fields', 'created', 'last_updated',
        )
        brief_fields = ('id', 'url', 'display', 'direction', 'protocol', 'port', 'status', 'description')


class ConnectionHopSerializer(NetBoxModelSerializer):
    connection = ServiceConnectionSerializer(nested=True)
    object_type = ContentTypeField(
        queryset=ContentType.objects.filter(HOP_OBJECT_MODELS),
    )
    object = GFKSerializerField(read_only=True)
    order = serializers.IntegerField(min_value=1, required=False)

    class Meta:
        model = ConnectionHop
        fields = (
            'id', 'url', 'display_url', 'display', 'connection', 'order', 'object_type', 'object_id', 'object',
            'note', 'tags', 'custom_fields', 'created', 'last_updated',
        )
        brief_fields = ('id', 'url', 'display', 'order', 'object_type', 'object_id', 'note')

    def validate(self, data):
        # Append to the end of the connection if no position is given. In a bulk create the earlier hops of the same
        # request are not saved yet, so the positions handed out in this request are remembered in the context.
        connection = data.get('connection')
        if connection and not self.instance:
            taken = self.context.setdefault('_hop_orders', {})
            if not data.get('order'):
                last = ConnectionHop.objects.filter(connection=connection).order_by('-order') \
                    .values_list('order', flat=True).first()
                data['order'] = max(last or 0, taken.get(connection.pk, 0)) + 1
            taken[connection.pk] = max(taken.get(connection.pk, 0), data['order'])
        return super().validate(data)


class CanvasSerializer(PrimaryModelSerializer):
    site = SiteSerializer(nested=True, required=False, allow_null=True)
    cluster = ClusterSerializer(nested=True, required=False, allow_null=True)
    node_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Canvas
        fields = (
            'id', 'url', 'display_url', 'display', 'name', 'site', 'cluster', 'node_count', 'description', 'owner',
            'comments', 'tags', 'custom_fields', 'created', 'last_updated',
        )
        brief_fields = ('id', 'url', 'display', 'name', 'description')


class CanvasGroupSerializer(ChangeLogMessageSerializer, ValidatedModelSerializer):
    canvas = CanvasSerializer(nested=True)
    tag = TagSerializer(nested=True, required=False, allow_null=True)
    site = SiteSerializer(nested=True, required=False, allow_null=True)
    cluster = ClusterSerializer(nested=True, required=False, allow_null=True)

    class Meta:
        model = CanvasGroup
        fields = (
            'id', 'url', 'display', 'canvas', 'name', 'color', 'x', 'y', 'width', 'height', 'site', 'cluster', 'tag',
            'created', 'last_updated',
        )
        brief_fields = ('id', 'url', 'display', 'name', 'color')


class CanvasNodeSerializer(ChangeLogMessageSerializer, ValidatedModelSerializer):
    canvas = CanvasSerializer(nested=True)
    object_type = ContentTypeField(
        queryset=ContentType.objects.filter(CANVAS_NODE_MODELS),
    )
    object = GFKSerializerField(read_only=True)
    group = CanvasGroupSerializer(nested=True, required=False, allow_null=True)

    class Meta:
        model = CanvasNode
        fields = (
            'id', 'url', 'display', 'canvas', 'object_type', 'object_id', 'object', 'x', 'y', 'width', 'height',
            'group', 'created', 'last_updated',
        )
        brief_fields = ('id', 'url', 'display', 'object_type', 'object_id')


class CanvasNoteSerializer(ChangeLogMessageSerializer, ValidatedModelSerializer):
    canvas = CanvasSerializer(nested=True)

    class Meta:
        model = CanvasNote
        fields = (
            'id', 'url', 'display', 'canvas', 'text', 'color', 'x', 'y', 'width', 'height', 'created', 'last_updated',
        )
        brief_fields = ('id', 'url', 'display', 'color')


#
# Bulk layout
#

class LayoutGroupSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False, allow_null=True)
    # Client-side key for new groups, so that new nodes can reference a group created in the same request
    key = serializers.CharField(required=False, allow_blank=True, max_length=64)
    name = serializers.CharField(max_length=100)
    color = serializers.RegexField(r'^[0-9a-f]{6}$', required=False)
    x = serializers.FloatField()
    y = serializers.FloatField()
    width = serializers.FloatField(min_value=0)
    height = serializers.FloatField(min_value=0)


class LayoutNodeSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False, allow_null=True)
    object_type = ContentTypeField(
        queryset=ContentType.objects.filter(CANVAS_NODE_MODELS),
        required=False,
    )
    object_id = serializers.IntegerField(required=False, min_value=1)
    x = serializers.FloatField()
    y = serializers.FloatField()
    width = serializers.FloatField(required=False, allow_null=True, min_value=0)
    height = serializers.FloatField(required=False, allow_null=True, min_value=0)
    # Either an existing group ID, or the `key` of a group created in the same request
    group = serializers.IntegerField(required=False, allow_null=True)
    group_key = serializers.CharField(required=False, allow_blank=True, max_length=64)

    def validate(self, data):
        if not data.get('id') and not (data.get('object_type') and data.get('object_id')):
            raise serializers.ValidationError(_('New nodes require object_type and object_id.'))
        return data


class LayoutNoteSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False, allow_null=True)
    # Client-side key for new notes; the response maps it to the new database ID
    key = serializers.CharField(required=False, allow_blank=True, max_length=64)
    text = serializers.CharField(required=False, allow_blank=True, max_length=10000)
    color = serializers.RegexField(r'^[0-9a-f]{6}$', required=False)
    x = serializers.FloatField()
    y = serializers.FloatField()
    width = serializers.FloatField(min_value=0)
    height = serializers.FloatField(min_value=0)


class LayoutPointSerializer(serializers.Serializer):
    x = serializers.FloatField()
    y = serializers.FloatField()


class LayoutEdgeStyleSerializer(serializers.Serializer):
    # Bend points of the line in canvas coordinates; empty = automatic curve
    points = LayoutPointSerializer(many=True, required=False, default=list, max_length=50)
    # Line color; empty = color of the connection status
    color = serializers.RegexField(r'^([0-9a-f]{6})?$', required=False, allow_blank=True, default='')


class CanvasLayoutSerializer(serializers.Serializer):
    """
    Payload of PUT /api/plugins/service-canvas/canvases/<id>/layout/
    """
    nodes = LayoutNodeSerializer(many=True, required=False, default=list)
    groups = LayoutGroupSerializer(many=True, required=False, default=list)
    deleted_nodes = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    deleted_groups = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    notes = LayoutNoteSerializer(many=True, required=False, default=list)
    deleted_notes = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    # Complete map {"<connection id>": style}; omitted = leave the stored styles untouched
    edge_styles = serializers.DictField(child=LayoutEdgeStyleSerializer(), required=False)

    def validate_edge_styles(self, value):
        if len(value) > 5000 or any(not str(key).isdigit() for key in value):
            raise serializers.ValidationError(_('Keys must be connection IDs.'))
        return value


class HopOrderSerializer(serializers.Serializer):
    """
    Payload of POST /api/plugins/service-canvas/connections/<id>/reorder-hops/
    """
    hops = serializers.ListField(child=serializers.IntegerField(), allow_empty=True)
