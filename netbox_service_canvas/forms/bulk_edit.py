from django import forms
from django.utils.translation import gettext_lazy as _

from dcim.models import Site
from netbox.forms import NetBoxModelBulkEditForm, PrimaryModelBulkEditForm
from utilities.forms import add_blank_choice
from utilities.forms.fields import DynamicModelChoiceField
from utilities.forms.rendering import FieldSet
from virtualization.models import Cluster

from ..choices import ConnectionDirectionChoices, ConnectionProtocolChoices, ConnectionStatusChoices
from ..constants import PORT_MAX, PORT_MIN
from ..models import Canvas, ConnectionHop, ServiceConnection

__all__ = (
    'CanvasBulkEditForm',
    'ConnectionHopBulkEditForm',
    'ServiceConnectionBulkEditForm',
)


class ServiceConnectionBulkEditForm(PrimaryModelBulkEditForm):
    direction = forms.ChoiceField(
        label=_('Direction'),
        choices=add_blank_choice(ConnectionDirectionChoices),
        required=False,
    )
    protocol = forms.ChoiceField(
        label=_('Protocol'),
        choices=add_blank_choice(ConnectionProtocolChoices),
        required=False,
    )
    port = forms.IntegerField(
        label=_('Port'),
        min_value=PORT_MIN,
        max_value=PORT_MAX,
        required=False,
    )
    data_description = forms.CharField(
        label=_('Data'),
        max_length=200,
        required=False,
    )
    status = forms.ChoiceField(
        label=_('Status'),
        choices=add_blank_choice(ConnectionStatusChoices),
        required=False,
    )

    model = ServiceConnection
    fieldsets = (
        FieldSet('direction', 'protocol', 'port', 'data_description', 'status', 'description'),
    )
    nullable_fields = ('port', 'data_description', 'description', 'comments')


class ConnectionHopBulkEditForm(NetBoxModelBulkEditForm):
    note = forms.CharField(
        label=_('Note'),
        max_length=200,
        required=False,
    )

    model = ConnectionHop
    fieldsets = (
        FieldSet('note'),
    )
    nullable_fields = ('note',)


class CanvasBulkEditForm(PrimaryModelBulkEditForm):
    site = DynamicModelChoiceField(
        label=_('Site'),
        queryset=Site.objects.all(),
        required=False,
    )
    cluster = DynamicModelChoiceField(
        label=_('Cluster'),
        queryset=Cluster.objects.all(),
        required=False,
    )

    model = Canvas
    fieldsets = (
        FieldSet('site', 'cluster', 'description'),
    )
    nullable_fields = ('site', 'cluster', 'description', 'comments')
