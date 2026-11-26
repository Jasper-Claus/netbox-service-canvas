from django import forms
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ObjectDoesNotExist
from django.utils.translation import gettext_lazy as _

from dcim.models import Device, Site
from ipam.models import Service
from netbox.forms import NetBoxModelForm, PrimaryModelForm
from utilities.forms.fields import ContentTypeChoiceField, DynamicModelChoiceField, DynamicModelMultipleChoiceField
from utilities.forms.rendering import FieldSet, InlineFields
from utilities.forms.utils import get_field_value
from utilities.forms.widgets import HTMXSelect
from utilities.templatetags.builtins.filters import bettertitle
from virtualization.models import Cluster

from ..constants import CONNECTION_ENDPOINT_MODELS, HOP_OBJECT_MODELS
from ..models import Application, Canvas, ConnectionHop, ServiceConnection

__all__ = (
    'ApplicationForm',
    'CanvasForm',
    'ConnectionHopForm',
    'ServiceConnectionForm',
)


class GenericObjectFormMixin:
    """
    Wires a ContentType selector (`<prefix>_type`, re-rendered via HTMX) to a dynamic object selector (`<prefix>`).
    This mirrors how NetBox core handles Service.parent.
    """
    generic_fields = ()

    def _init_generic_fields(self):
        for prefix in self.generic_fields:
            ct_id = get_field_value(self, f'{prefix}_type')
            if not ct_id:
                continue
            try:
                model = ContentType.objects.get(pk=ct_id).model_class()
            except ObjectDoesNotExist:
                continue
            field = self.fields[prefix]
            field.queryset = model.objects.all()
            field.widget.attrs['selector'] = model._meta.label_lower
            field.disabled = False
            field.label = _(bettertitle(model._meta.verbose_name))

            # Switching the type of an existing object invalidates the previously selected object
            if self.instance.pk and str(ct_id) != str(getattr(self.instance, f'{prefix}_type_id')):
                self.initial[prefix] = None

    @staticmethod
    def _initial_from_instance(kwargs, prefixes):
        initial = kwargs.get('initial', {}).copy()
        if instance := kwargs.get('instance'):
            for prefix in prefixes:
                if getattr(instance, f'{prefix}_id', None):
                    initial[prefix] = getattr(instance, prefix)
        kwargs['initial'] = initial
        return kwargs


def _object_field(label):
    return DynamicModelChoiceField(
        label=label,
        queryset=Device.objects.none(),  # replaced once a type has been selected
        required=True,
        disabled=True,
        selector=True,
    )


class ServiceConnectionForm(GenericObjectFormMixin, PrimaryModelForm):
    generic_fields = ('source', 'target')

    source_type = ContentTypeChoiceField(
        queryset=ContentType.objects.filter(CONNECTION_ENDPOINT_MODELS),
        widget=HTMXSelect(),
        label=_('Source type'),
    )
    source = _object_field(_('Source'))
    target_type = ContentTypeChoiceField(
        queryset=ContentType.objects.filter(CONNECTION_ENDPOINT_MODELS),
        widget=HTMXSelect(),
        label=_('Target type'),
    )
    target = _object_field(_('Target'))

    fieldsets = (
        FieldSet('source_type', 'source', name=_('Source')),
        FieldSet('target_type', 'target', name=_('Target')),
        FieldSet(
            'direction', 'status', 'kind',
            InlineFields('protocol', 'port', label=_('Protocol / Port')),
            'data_description', 'description', 'tags',
            name=_('Connection'),
        ),
    )

    class Meta:
        model = ServiceConnection
        fields = (
            'source_type', 'target_type', 'direction', 'protocol', 'port', 'data_description', 'status',
            'kind', 'description', 'owner', 'comments', 'tags',
        )

    def __init__(self, *args, **kwargs):
        kwargs = self._initial_from_instance(kwargs, self.generic_fields)
        super().__init__(*args, **kwargs)
        self._init_generic_fields()

    def clean(self):
        super().clean()
        self.instance.source = self.cleaned_data.get('source')
        self.instance.target = self.cleaned_data.get('target')
        return self.cleaned_data


class ConnectionHopForm(GenericObjectFormMixin, NetBoxModelForm):
    generic_fields = ('object',)

    connection = DynamicModelChoiceField(
        label=_('Connection'),
        queryset=ServiceConnection.objects.all(),
        selector=True,
    )
    object_type = ContentTypeChoiceField(
        queryset=ContentType.objects.filter(HOP_OBJECT_MODELS),
        widget=HTMXSelect(),
        label=_('Object type'),
    )
    object = _object_field(_('Object'))
    order = forms.IntegerField(
        label=_('Order'),
        min_value=1,
        required=False,
        help_text=_('Position within the connection (1 = first hop after the source). Leave empty to append.'),
    )

    fieldsets = (
        FieldSet('connection', 'order', 'object_type', 'object', 'note', 'tags', name=_('Hop')),
    )

    class Meta:
        model = ConnectionHop
        fields = ('connection', 'order', 'object_type', 'note', 'tags')

    def __init__(self, *args, **kwargs):
        kwargs = self._initial_from_instance(kwargs, self.generic_fields)
        super().__init__(*args, **kwargs)
        self._init_generic_fields()

    def clean(self):
        super().clean()
        self.instance.object = self.cleaned_data.get('object')
        connection = self.cleaned_data.get('connection')
        if connection and not self.cleaned_data.get('order'):
            last = ConnectionHop.objects.filter(connection=connection).exclude(pk=self.instance.pk) \
                .order_by('-order').values_list('order', flat=True).first()
            self.cleaned_data['order'] = (last or 0) + 1
            self.instance.order = self.cleaned_data['order']
        return self.cleaned_data


class CanvasForm(PrimaryModelForm):
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

    fieldsets = (
        FieldSet('name', 'description', 'tags', name=_('Canvas')),
        FieldSet('site', 'cluster', name=_('Scope')),
    )

    class Meta:
        model = Canvas
        fields = ('name', 'site', 'cluster', 'description', 'owner', 'comments', 'tags')


class ApplicationForm(PrimaryModelForm):
    services = DynamicModelMultipleChoiceField(
        label=_('Services'),
        queryset=Service.objects.all(),
        required=False,
        help_text=_('The NetBox services this application consists of'),
    )

    fieldsets = (
        FieldSet('name', 'status', 'version', 'icon', 'web_url', 'description', 'tags', name=_('Application')),
        FieldSet('services', name=_('Services')),
    )

    class Meta:
        model = Application
        fields = (
            'name', 'status', 'version', 'icon', 'web_url', 'services', 'description', 'owner', 'comments', 'tags',
        )
