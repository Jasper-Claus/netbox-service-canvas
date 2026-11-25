from django.utils.translation import gettext_lazy as _

from netbox.ui import attrs, panels


class ServiceConnectionPanel(panels.ObjectAttributesPanel):
    source = attrs.GenericForeignKeyAttr('source', label=_('Source'), linkify=True)
    target = attrs.GenericForeignKeyAttr('target', label=_('Target'), linkify=True)
    direction = attrs.ChoiceAttr('direction', label=_('Direction'))
    protocol = attrs.ChoiceAttr('protocol', label=_('Protocol'))
    port = attrs.TextAttr('port', label=_('Port'))
    data_description = attrs.TextAttr('data_description', label=_('Data'))
    status = attrs.ChoiceAttr('status', label=_('Status'))
    description = attrs.TextAttr('description', label=_('Description'))


class ConnectionHopPanel(panels.ObjectAttributesPanel):
    connection = attrs.RelatedObjectAttr('connection', label=_('Connection'), linkify=True)
    order = attrs.TextAttr('order', label=_('Position'))
    object = attrs.GenericForeignKeyAttr('object', label=_('Via'), linkify=True)
    note = attrs.TextAttr('note', label=_('Note'))


class CanvasPanel(panels.ObjectAttributesPanel):
    name = attrs.TextAttr('name', label=_('Name'))
    site = attrs.RelatedObjectAttr('site', label=_('Site'), linkify=True)
    cluster = attrs.RelatedObjectAttr('cluster', label=_('Cluster'), linkify=True)
    description = attrs.TextAttr('description', label=_('Description'))


class ApplicationPanel(panels.ObjectAttributesPanel):
    name = attrs.TextAttr('name', label=_('Name'))
    status = attrs.ChoiceAttr('status', label=_('Status'))
    version = attrs.TextAttr('version', label=_('Version'))
    web_url = attrs.TemplatedAttr('web_url', label=_('URL'), template_name='netbox_service_canvas/inc/url_attr.html')
    description = attrs.TextAttr('description', label=_('Description'))
