from django import forms
from django.contrib.contenttypes.models import ContentType
from django.utils.translation import gettext_lazy as _

from dcim.models import Site
from netbox.forms import NetBoxModelImportForm, PrimaryModelImportForm
from utilities.forms.fields import CSVChoiceField, CSVContentTypeField, CSVModelChoiceField
from virtualization.models import Cluster

from ..choices import ConnectionDirectionChoices, ConnectionProtocolChoices, ConnectionStatusChoices
from ..constants import CONNECTION_ENDPOINT_MODELS, HOP_OBJECT_MODELS
from ..models import Canvas, ConnectionHop, ServiceConnection

__all__ = (
    'CanvasImportForm',
    'ConnectionHopImportForm',
    'ServiceConnectionImportForm',
)


class ServiceConnectionImportForm(PrimaryModelImportForm):
    source_type = CSVContentTypeField(
        queryset=ContentType.objects.filter(CONNECTION_ENDPOINT_MODELS),
        label=_('Source type (app.model)'),
        help_text=_('e.g. ipam.service, dcim.device, virtualization.virtualmachine'),
    )
    source_id = forms.IntegerField(
        label=_('Source ID'),
    )
    target_type = CSVContentTypeField(
        queryset=ContentType.objects.filter(CONNECTION_ENDPOINT_MODELS),
        label=_('Target type (app.model)'),
    )
    target_id = forms.IntegerField(
        label=_('Target ID'),
    )
    direction = CSVChoiceField(
        label=_('Direction'),
        choices=ConnectionDirectionChoices,
        required=False,
        help_text=_('uni (default) or bi'),
    )
    protocol = CSVChoiceField(
        label=_('Protocol'),
        choices=ConnectionProtocolChoices,
    )
    status = CSVChoiceField(
        label=_('Status'),
        choices=ConnectionStatusChoices,
        required=False,
        help_text=_('active (default), planned or disabled'),
    )

    class Meta:
        model = ServiceConnection
        fields = (
            'source_type', 'source_id', 'target_type', 'target_id', 'direction', 'protocol', 'port',
            'data_description', 'status', 'description', 'owner', 'comments', 'tags',
        )

    def clean_direction(self):
        return self.cleaned_data.get('direction') or ConnectionDirectionChoices.DIRECTION_UNI

    def clean_status(self):
        return self.cleaned_data.get('status') or ConnectionStatusChoices.STATUS_ACTIVE


class ConnectionHopImportForm(NetBoxModelImportForm):
    connection = CSVModelChoiceField(
        label=_('Connection (ID)'),
        queryset=ServiceConnection.objects.all(),
        to_field_name='pk',
    )
    object_type = CSVContentTypeField(
        queryset=ContentType.objects.filter(HOP_OBJECT_MODELS),
        label=_('Object type (app.model)'),
        help_text=_('e.g. ipam.service, ipam.vrf, vpn.tunnel, dcim.interface'),
    )
    object_id = forms.IntegerField(
        label=_('Object ID'),
    )

    class Meta:
        model = ConnectionHop
        fields = ('connection', 'order', 'object_type', 'object_id', 'note', 'tags')


class CanvasImportForm(PrimaryModelImportForm):
    site = CSVModelChoiceField(
        label=_('Site'),
        queryset=Site.objects.all(),
        to_field_name='name',
        required=False,
    )
    cluster = CSVModelChoiceField(
        label=_('Cluster'),
        queryset=Cluster.objects.all(),
        to_field_name='name',
        required=False,
    )

    class Meta:
        model = Canvas
        fields = ('name', 'site', 'cluster', 'description', 'owner', 'comments', 'tags')
