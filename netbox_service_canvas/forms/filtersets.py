from django import forms
from django.contrib.contenttypes.models import ContentType
from django.utils.translation import gettext_lazy as _

from dcim.models import Device, Site
from ipam.models import Service
from netbox.forms import NetBoxModelFilterSetForm, PrimaryModelFilterSetForm
from utilities.forms.fields import (
    ContentTypeMultipleChoiceField,
    DynamicModelMultipleChoiceField,
    TagFilterField,
)
from utilities.forms.rendering import FieldSet
from virtualization.models import Cluster, VirtualMachine

from ..choices import ConnectionDirectionChoices, ConnectionProtocolChoices, ConnectionStatusChoices
from ..constants import CONNECTION_ENDPOINT_MODELS, HOP_OBJECT_MODELS
from ..models import Canvas, ConnectionHop, ServiceConnection

__all__ = (
    'CanvasFilterForm',
    'ConnectionHopFilterForm',
    'ServiceConnectionFilterForm',
)


class ServiceConnectionFilterForm(PrimaryModelFilterSetForm):
    model = ServiceConnection
    fieldsets = (
        FieldSet('q', 'filter_id', 'tag'),
        FieldSet('protocol', 'port', 'direction', 'status', name=_('Attributes')),
        FieldSet(
            'service_id', 'device_id', 'virtual_machine_id', 'source_type_id', 'target_type_id', name=_('Endpoints')
        ),
        FieldSet('owner_group_id', 'owner_id', name=_('Ownership')),
    )
    protocol = forms.MultipleChoiceField(
        label=_('Protocol'),
        choices=ConnectionProtocolChoices,
        required=False,
    )
    port = forms.IntegerField(
        label=_('Port'),
        required=False,
    )
    direction = forms.MultipleChoiceField(
        label=_('Direction'),
        choices=ConnectionDirectionChoices,
        required=False,
    )
    status = forms.MultipleChoiceField(
        label=_('Status'),
        choices=ConnectionStatusChoices,
        required=False,
    )
    service_id = DynamicModelMultipleChoiceField(
        queryset=Service.objects.all(),
        required=False,
        label=_('Service'),
    )
    device_id = DynamicModelMultipleChoiceField(
        queryset=Device.objects.all(),
        required=False,
        label=_('Device'),
    )
    virtual_machine_id = DynamicModelMultipleChoiceField(
        queryset=VirtualMachine.objects.all(),
        required=False,
        label=_('Virtual machine'),
    )
    source_type_id = ContentTypeMultipleChoiceField(
        queryset=ContentType.objects.filter(CONNECTION_ENDPOINT_MODELS),
        required=False,
        label=_('Source type'),
    )
    target_type_id = ContentTypeMultipleChoiceField(
        queryset=ContentType.objects.filter(CONNECTION_ENDPOINT_MODELS),
        required=False,
        label=_('Target type'),
    )
    tag = TagFilterField(model)


class ConnectionHopFilterForm(NetBoxModelFilterSetForm):
    model = ConnectionHop
    fieldsets = (
        FieldSet('q', 'filter_id', 'tag'),
        FieldSet('connection_id', 'object_type_id', name=_('Hop')),
    )
    connection_id = DynamicModelMultipleChoiceField(
        queryset=ServiceConnection.objects.all(),
        required=False,
        label=_('Connection'),
    )
    object_type_id = ContentTypeMultipleChoiceField(
        queryset=ContentType.objects.filter(HOP_OBJECT_MODELS),
        required=False,
        label=_('Object type'),
    )
    tag = TagFilterField(model)


class CanvasFilterForm(PrimaryModelFilterSetForm):
    model = Canvas
    fieldsets = (
        FieldSet('q', 'filter_id', 'tag'),
        FieldSet('site_id', 'cluster_id', name=_('Scope')),
        FieldSet('owner_group_id', 'owner_id', name=_('Ownership')),
    )
    site_id = DynamicModelMultipleChoiceField(
        queryset=Site.objects.all(),
        required=False,
        label=_('Site'),
    )
    cluster_id = DynamicModelMultipleChoiceField(
        queryset=Cluster.objects.all(),
        required=False,
        label=_('Cluster'),
    )
    tag = TagFilterField(model)
