import django_filters
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from django.utils.translation import gettext as _

from dcim.models import Device, Site
from ipam.models import Service
from netbox.filtersets import ChangeLoggedModelFilterSet, NetBoxModelFilterSet, PrimaryModelFilterSet
from utilities.filters import MultiValueContentTypeFilter, MultiValueNumberFilter
from utilities.filtersets import register_filterset
from virtualization.models import Cluster, VirtualMachine

from .choices import (
    ApplicationStatusChoices,
    ConnectionDirectionChoices,
    ConnectionProtocolChoices,
    ConnectionStatusChoices,
)
from .models import Application, Canvas, CanvasGroup, CanvasNode, CanvasNote, ConnectionHop, ServiceConnection

__all__ = (
    'ApplicationFilterSet',
    'CanvasFilterSet',
    'CanvasGroupFilterSet',
    'CanvasNodeFilterSet',
    'CanvasNoteFilterSet',
    'ConnectionHopFilterSet',
    'ServiceConnectionFilterSet',
)


def _endpoint_q(model, ids):
    ct = ContentType.objects.get_for_model(model)
    return Q(source_type=ct, source_id__in=ids) | Q(target_type=ct, target_id__in=ids)


@register_filterset
class ServiceConnectionFilterSet(PrimaryModelFilterSet):
    source_type = MultiValueContentTypeFilter()
    target_type = MultiValueContentTypeFilter()
    source_type_id = django_filters.ModelMultipleChoiceFilter(
        queryset=ContentType.objects.all(),
        field_name='source_type',
        label=_('Source type (ID)'),
    )
    target_type_id = django_filters.ModelMultipleChoiceFilter(
        queryset=ContentType.objects.all(),
        field_name='target_type',
        label=_('Target type (ID)'),
    )
    direction = django_filters.MultipleChoiceFilter(choices=ConnectionDirectionChoices)
    protocol = django_filters.MultipleChoiceFilter(choices=ConnectionProtocolChoices)
    status = django_filters.MultipleChoiceFilter(choices=ConnectionStatusChoices)
    service_id = MultiValueNumberFilter(
        method='filter_service',
        label=_('Service (ID), as source or target'),
    )
    device_id = MultiValueNumberFilter(
        method='filter_device',
        label=_('Device (ID), as source or target, including services running on it'),
    )
    virtual_machine_id = MultiValueNumberFilter(
        method='filter_virtual_machine',
        label=_('Virtual machine (ID), as source or target, including services running on it'),
    )
    application_id = MultiValueNumberFilter(
        method='filter_application',
        label=_('Application (ID), as source or target, including its services'),
    )
    hop_type = MultiValueContentTypeFilter(
        field_name='hops__object_type',
        distinct=True,
        label=_('Hop object type'),
    )
    hop_id = MultiValueNumberFilter(
        field_name='hops__object_id',
        distinct=True,
        label=_('Hop object (ID)'),
    )

    class Meta:
        model = ServiceConnection
        fields = (
            'id', 'source_id', 'target_id', 'port', 'data_description', 'description',
        )

    def search(self, queryset, name, value):
        if not value.strip():
            return queryset
        return queryset.filter(
            Q(data_description__icontains=value) | Q(description__icontains=value) | Q(comments__icontains=value)
        )

    def filter_service(self, queryset, name, value):
        return queryset.filter(_endpoint_q(Service, value))

    def _filter_host(self, queryset, model, value):
        service_ids = Service.objects.filter(
            parent_object_type=ContentType.objects.get_for_model(model),
            parent_object_id__in=value,
        ).values_list('pk', flat=True)
        return queryset.filter(_endpoint_q(model, value) | _endpoint_q(Service, list(service_ids)))

    def filter_device(self, queryset, name, value):
        return self._filter_host(queryset, Device, value)

    def filter_virtual_machine(self, queryset, name, value):
        return self._filter_host(queryset, VirtualMachine, value)

    def filter_application(self, queryset, name, value):
        service_ids = Service.objects.filter(service_canvas_applications__in=value).values_list('pk', flat=True)
        return queryset.filter(_endpoint_q(Application, value) | _endpoint_q(Service, list(service_ids)))


@register_filterset
class ConnectionHopFilterSet(NetBoxModelFilterSet):
    connection_id = django_filters.ModelMultipleChoiceFilter(
        queryset=ServiceConnection.objects.all(),
        label=_('Connection (ID)'),
    )
    object_type = MultiValueContentTypeFilter()
    object_type_id = django_filters.ModelMultipleChoiceFilter(
        queryset=ContentType.objects.all(),
        field_name='object_type',
        label=_('Object type (ID)'),
    )

    class Meta:
        model = ConnectionHop
        fields = ('id', 'order', 'object_id', 'note')

    def search(self, queryset, name, value):
        if not value.strip():
            return queryset
        return queryset.filter(note__icontains=value)


@register_filterset
class CanvasFilterSet(PrimaryModelFilterSet):
    site_id = django_filters.ModelMultipleChoiceFilter(
        queryset=Site.objects.all(),
        label=_('Site (ID)'),
    )
    cluster_id = django_filters.ModelMultipleChoiceFilter(
        queryset=Cluster.objects.all(),
        label=_('Cluster (ID)'),
    )
    object_type = MultiValueContentTypeFilter(
        field_name='nodes__object_type',
        distinct=True,
        label=_('Contains object of type'),
    )
    object_id = MultiValueNumberFilter(
        field_name='nodes__object_id',
        distinct=True,
        label=_('Contains object (ID)'),
    )

    class Meta:
        model = Canvas
        fields = ('id', 'name', 'description')

    def search(self, queryset, name, value):
        if not value.strip():
            return queryset
        return queryset.filter(Q(name__icontains=value) | Q(description__icontains=value))


@register_filterset
class CanvasGroupFilterSet(ChangeLoggedModelFilterSet):
    canvas_id = django_filters.ModelMultipleChoiceFilter(
        queryset=Canvas.objects.all(),
        label=_('Canvas (ID)'),
    )

    class Meta:
        model = CanvasGroup
        fields = ('id', 'name', 'color')

    def search(self, queryset, name, value):
        if not value.strip():
            return queryset
        return queryset.filter(name__icontains=value)


@register_filterset
class CanvasNodeFilterSet(ChangeLoggedModelFilterSet):
    canvas_id = django_filters.ModelMultipleChoiceFilter(
        queryset=Canvas.objects.all(),
        label=_('Canvas (ID)'),
    )
    group_id = django_filters.ModelMultipleChoiceFilter(
        queryset=CanvasGroup.objects.all(),
        label=_('Group (ID)'),
    )
    object_type = MultiValueContentTypeFilter()

    class Meta:
        model = CanvasNode
        fields = ('id', 'object_id')

    def search(self, queryset, name, value):
        return queryset


@register_filterset
class ApplicationFilterSet(PrimaryModelFilterSet):
    status = django_filters.MultipleChoiceFilter(choices=ApplicationStatusChoices)
    service_id = django_filters.ModelMultipleChoiceFilter(
        field_name='services',
        queryset=Service.objects.all(),
        label=_('Service (ID)'),
    )
    device_id = MultiValueNumberFilter(
        method='filter_device',
        label=_('Device (ID) running one of its services'),
    )
    virtual_machine_id = MultiValueNumberFilter(
        method='filter_virtual_machine',
        label=_('Virtual machine (ID) running one of its services'),
    )

    class Meta:
        model = Application
        fields = ('id', 'name', 'version', 'web_url', 'description')

    def search(self, queryset, name, value):
        if not value.strip():
            return queryset
        return queryset.filter(
            Q(name__icontains=value) | Q(description__icontains=value) | Q(version__icontains=value)
            | Q(comments__icontains=value)
        )

    def _filter_host(self, queryset, model, value):
        return queryset.filter(
            services__parent_object_type=ContentType.objects.get_for_model(model),
            services__parent_object_id__in=value,
        ).distinct()

    def filter_device(self, queryset, name, value):
        return self._filter_host(queryset, Device, value)

    def filter_virtual_machine(self, queryset, name, value):
        return self._filter_host(queryset, VirtualMachine, value)


@register_filterset
class CanvasNoteFilterSet(ChangeLoggedModelFilterSet):
    canvas_id = django_filters.ModelMultipleChoiceFilter(
        queryset=Canvas.objects.all(),
        label=_('Canvas (ID)'),
    )

    class Meta:
        model = CanvasNote
        fields = ('id', 'color')

    def search(self, queryset, name, value):
        if not value.strip():
            return queryset
        return queryset.filter(text__icontains=value)
