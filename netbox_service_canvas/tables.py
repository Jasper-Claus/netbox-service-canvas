import django_tables2 as tables
from django.utils.translation import gettext_lazy as _

from netbox.tables import NetBoxTable, PrimaryModelTable, columns

from .models import Canvas, ConnectionHop, ServiceConnection

__all__ = (
    'CanvasTable',
    'ConnectionHopTable',
    'ObjectServiceConnectionTable',
    'ServiceConnectionTable',
)

RELATION_TEMPLATE = (
    '{% load i18n %}'
    '{% if value == "outgoing" %}'
    '<span class="badge text-bg-blue"><i class="mdi mdi-arrow-right"></i> {% trans "outgoing" %}</span>'
    '{% elif value == "incoming" %}'
    '<span class="badge text-bg-purple"><i class="mdi mdi-arrow-left"></i> {% trans "incoming" %}</span>'
    '{% else %}'
    '<span class="badge text-bg-teal"><i class="mdi mdi-swap-horizontal"></i> {% trans "both" %}</span>'
    '{% endif %}'
)


class ServiceConnectionTable(PrimaryModelTable):
    id = tables.Column(
        linkify=True,
        verbose_name=_('ID'),
    )
    source_type = columns.ContentTypeColumn(
        verbose_name=_('Source type'),
    )
    source = tables.Column(
        verbose_name=_('Source'),
        linkify=True,
        orderable=False,
    )
    direction = columns.ChoiceFieldColumn(
        verbose_name=_('Direction'),
    )
    target_type = columns.ContentTypeColumn(
        verbose_name=_('Target type'),
    )
    target = tables.Column(
        verbose_name=_('Target'),
        linkify=True,
        orderable=False,
    )
    protocol = columns.ChoiceFieldColumn(
        verbose_name=_('Protocol'),
    )
    status = columns.ChoiceFieldColumn(
        verbose_name=_('Status'),
    )
    hop_count = columns.LinkedCountColumn(
        viewname='plugins:netbox_service_canvas:connectionhop_list',
        url_params={'connection_id': 'pk'},
        verbose_name=_('Hops'),
    )
    tags = columns.TagColumn(
        url_name='plugins:netbox_service_canvas:serviceconnection_list',
    )

    class Meta(PrimaryModelTable.Meta):
        model = ServiceConnection
        fields = (
            'pk', 'id', 'source_type', 'source', 'direction', 'target_type', 'target', 'protocol', 'port',
            'data_description', 'status', 'hop_count', 'description', 'comments', 'tags', 'created', 'last_updated',
        )
        default_columns = (
            'pk', 'id', 'source', 'direction', 'target', 'protocol', 'port', 'data_description', 'status',
            'hop_count',
        )


class ObjectServiceConnectionTable(ServiceConnectionTable):
    """
    Used on the "Connections" tab of devices, VMs and services; `relation` is annotated by the view.
    """
    relation = columns.TemplateColumn(
        template_code=RELATION_TEMPLATE,
        verbose_name=_('Relation'),
    )

    class Meta(ServiceConnectionTable.Meta):
        fields = ('relation', *ServiceConnectionTable.Meta.fields)
        default_columns = (
            'pk', 'relation', 'source', 'target', 'protocol', 'port', 'data_description', 'status', 'hop_count',
        )


class ConnectionHopTable(NetBoxTable):
    connection = tables.Column(
        verbose_name=_('Connection'),
        linkify=True,
    )
    order = tables.Column(
        verbose_name=_('#'),
        linkify=True,
    )
    object_type = columns.ContentTypeColumn(
        verbose_name=_('Type'),
    )
    object = tables.Column(
        verbose_name=_('Via'),
        linkify=True,
        orderable=False,
    )
    tags = columns.TagColumn(
        url_name='plugins:netbox_service_canvas:connectionhop_list',
    )

    class Meta(NetBoxTable.Meta):
        model = ConnectionHop
        fields = (
            'pk', 'id', 'connection', 'order', 'object_type', 'object', 'note', 'tags', 'created', 'last_updated',
        )
        default_columns = ('pk', 'connection', 'order', 'object_type', 'object', 'note')


class CanvasTable(PrimaryModelTable):
    name = tables.Column(
        verbose_name=_('Name'),
        linkify=True,
    )
    site = tables.Column(
        verbose_name=_('Site'),
        linkify=True,
    )
    cluster = tables.Column(
        verbose_name=_('Cluster'),
        linkify=True,
    )
    node_count = tables.Column(
        verbose_name=_('Nodes'),
    )
    tags = columns.TagColumn(
        url_name='plugins:netbox_service_canvas:canvas_list',
    )

    class Meta(PrimaryModelTable.Meta):
        model = Canvas
        fields = (
            'pk', 'id', 'name', 'site', 'cluster', 'node_count', 'description', 'comments', 'tags', 'created',
            'last_updated',
        )
        default_columns = ('pk', 'name', 'site', 'cluster', 'node_count', 'description')
