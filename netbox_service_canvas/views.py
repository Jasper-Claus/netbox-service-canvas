from django.contrib.contenttypes.models import ContentType
from django.db.models import Case, CharField, Count, Q, Value, When
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from dcim.models import Device
from extras.ui.panels import CustomFieldsPanel, TagsPanel
from ipam.models import Service
from ipam.tables import ServiceTable
from netbox.plugins import get_plugin_config
from netbox.ui import actions, layout
from netbox.ui.panels import CommentsPanel, ObjectsTablePanel
from netbox.views import generic
from utilities.views import ViewTab, register_model_view
from virtualization.models import VirtualMachine

from . import filtersets, forms, tables
from .choices import ConnectionDirectionChoices
from .models import Application, Canvas, ConnectionHop, ServiceConnection
from .ui import panels

#
# Service connections
#


@register_model_view(ServiceConnection, 'list', path='', detail=False)
class ServiceConnectionListView(generic.ObjectListView):
    queryset = ServiceConnection.objects.prefetch_related('source', 'target').annotate(hop_count=Count('hops'))
    filterset = filtersets.ServiceConnectionFilterSet
    filterset_form = forms.ServiceConnectionFilterForm
    table = tables.ServiceConnectionTable


@register_model_view(ServiceConnection)
class ServiceConnectionView(generic.ObjectView):
    queryset = ServiceConnection.objects.all()
    template_name = 'generic/object.html'
    layout = layout.SimpleLayout(
        left_panels=[
            panels.ServiceConnectionPanel(),
        ],
        right_panels=[
            CustomFieldsPanel(),
            TagsPanel(),
            CommentsPanel(),
        ],
        bottom_panels=[
            ObjectsTablePanel(
                'netbox_service_canvas.connectionhop',
                filters={'connection_id': lambda ctx: ctx['object'].pk},
                title=_('Hops (via)'),
                actions=[
                    actions.AddObject(
                        'netbox_service_canvas.connectionhop',
                        url_params={'connection': lambda ctx: ctx['object'].pk},
                        label=_('Add hop'),
                    ),
                ],
            ),
        ],
    )


@register_model_view(ServiceConnection, 'add', detail=False)
@register_model_view(ServiceConnection, 'edit')
class ServiceConnectionEditView(generic.ObjectEditView):
    queryset = ServiceConnection.objects.all()
    form = forms.ServiceConnectionForm


@register_model_view(ServiceConnection, 'delete')
class ServiceConnectionDeleteView(generic.ObjectDeleteView):
    queryset = ServiceConnection.objects.all()


@register_model_view(ServiceConnection, 'bulk_import', path='import', detail=False)
class ServiceConnectionBulkImportView(generic.BulkImportView):
    queryset = ServiceConnection.objects.all()
    model_form = forms.ServiceConnectionImportForm


@register_model_view(ServiceConnection, 'bulk_edit', path='edit', detail=False)
class ServiceConnectionBulkEditView(generic.BulkEditView):
    queryset = ServiceConnection.objects.prefetch_related('source', 'target').annotate(hop_count=Count('hops'))
    filterset = filtersets.ServiceConnectionFilterSet
    table = tables.ServiceConnectionTable
    form = forms.ServiceConnectionBulkEditForm


@register_model_view(ServiceConnection, 'bulk_delete', path='delete', detail=False)
class ServiceConnectionBulkDeleteView(generic.BulkDeleteView):
    queryset = ServiceConnection.objects.prefetch_related('source', 'target').annotate(hop_count=Count('hops'))
    filterset = filtersets.ServiceConnectionFilterSet
    table = tables.ServiceConnectionTable


#
# Connection hops
#

@register_model_view(ConnectionHop, 'list', path='', detail=False)
class ConnectionHopListView(generic.ObjectListView):
    queryset = ConnectionHop.objects.prefetch_related('object')
    filterset = filtersets.ConnectionHopFilterSet
    filterset_form = forms.ConnectionHopFilterForm
    table = tables.ConnectionHopTable


@register_model_view(ConnectionHop)
class ConnectionHopView(generic.ObjectView):
    queryset = ConnectionHop.objects.all()
    template_name = 'generic/object.html'
    layout = layout.SimpleLayout(
        left_panels=[
            panels.ConnectionHopPanel(),
        ],
        right_panels=[
            CustomFieldsPanel(),
            TagsPanel(),
        ],
    )


@register_model_view(ConnectionHop, 'add', detail=False)
@register_model_view(ConnectionHop, 'edit')
class ConnectionHopEditView(generic.ObjectEditView):
    queryset = ConnectionHop.objects.all()
    form = forms.ConnectionHopForm


@register_model_view(ConnectionHop, 'delete')
class ConnectionHopDeleteView(generic.ObjectDeleteView):
    queryset = ConnectionHop.objects.all()


@register_model_view(ConnectionHop, 'bulk_import', path='import', detail=False)
class ConnectionHopBulkImportView(generic.BulkImportView):
    queryset = ConnectionHop.objects.all()
    model_form = forms.ConnectionHopImportForm


@register_model_view(ConnectionHop, 'bulk_edit', path='edit', detail=False)
class ConnectionHopBulkEditView(generic.BulkEditView):
    queryset = ConnectionHop.objects.prefetch_related('object')
    filterset = filtersets.ConnectionHopFilterSet
    table = tables.ConnectionHopTable
    form = forms.ConnectionHopBulkEditForm


@register_model_view(ConnectionHop, 'bulk_delete', path='delete', detail=False)
class ConnectionHopBulkDeleteView(generic.BulkDeleteView):
    queryset = ConnectionHop.objects.prefetch_related('object')
    filterset = filtersets.ConnectionHopFilterSet
    table = tables.ConnectionHopTable


#
# Applications
#

@register_model_view(Application, 'list', path='', detail=False)
class ApplicationListView(generic.ObjectListView):
    queryset = Application.objects.prefetch_related('services').annotate(service_count=Count('services'))
    filterset = filtersets.ApplicationFilterSet
    filterset_form = forms.ApplicationFilterForm
    table = tables.ApplicationTable


@register_model_view(Application)
class ApplicationView(generic.ObjectView):
    queryset = Application.objects.all()
    template_name = 'generic/object.html'
    layout = layout.SimpleLayout(
        left_panels=[
            panels.ApplicationPanel(),
        ],
        right_panels=[
            CustomFieldsPanel(),
            TagsPanel(),
            CommentsPanel(),
        ],
    )


@register_model_view(Application, 'add', detail=False)
@register_model_view(Application, 'edit')
class ApplicationEditView(generic.ObjectEditView):
    queryset = Application.objects.all()
    form = forms.ApplicationForm


@register_model_view(Application, 'delete')
class ApplicationDeleteView(generic.ObjectDeleteView):
    queryset = Application.objects.all()


@register_model_view(Application, 'bulk_import', path='import', detail=False)
class ApplicationBulkImportView(generic.BulkImportView):
    queryset = Application.objects.all()
    model_form = forms.ApplicationImportForm


@register_model_view(Application, 'bulk_edit', path='edit', detail=False)
class ApplicationBulkEditView(generic.BulkEditView):
    queryset = Application.objects.prefetch_related('services').annotate(service_count=Count('services'))
    filterset = filtersets.ApplicationFilterSet
    table = tables.ApplicationTable
    form = forms.ApplicationBulkEditForm


@register_model_view(Application, 'bulk_delete', path='delete', detail=False)
class ApplicationBulkDeleteView(generic.BulkDeleteView):
    queryset = Application.objects.prefetch_related('services').annotate(service_count=Count('services'))
    filterset = filtersets.ApplicationFilterSet
    table = tables.ApplicationTable


@register_model_view(Application, 'services', path='services')
class ApplicationServicesView(generic.ObjectChildrenView):
    queryset = Application.objects.all()
    child_model = Service
    table = ServiceTable
    tab = ViewTab(
        label=_('Services'),
        badge=lambda obj: obj.services.count(),
        permission='ipam.view_service',
        weight=500,
    )

    def get_children(self, request, parent):
        return parent.services.restrict(request.user, 'view').prefetch_related('parent', 'ipaddresses')


#
# Canvases
#

@register_model_view(Canvas, 'list', path='', detail=False)
class CanvasListView(generic.ObjectListView):
    queryset = Canvas.objects.annotate(node_count=Count('nodes'))
    filterset = filtersets.CanvasFilterSet
    filterset_form = forms.CanvasFilterForm
    table = tables.CanvasTable


@register_model_view(Canvas)
class CanvasView(generic.ObjectView):
    queryset = Canvas.objects.all()
    template_name = 'generic/object.html'
    layout = layout.SimpleLayout(
        left_panels=[
            panels.CanvasPanel(),
        ],
        right_panels=[
            CustomFieldsPanel(),
            TagsPanel(),
            CommentsPanel(),
        ],
    )


@register_model_view(Canvas, 'add', detail=False)
@register_model_view(Canvas, 'edit')
class CanvasEditView(generic.ObjectEditView):
    queryset = Canvas.objects.all()
    form = forms.CanvasForm


@register_model_view(Canvas, 'delete')
class CanvasDeleteView(generic.ObjectDeleteView):
    queryset = Canvas.objects.all()


@register_model_view(Canvas, 'bulk_import', path='import', detail=False)
class CanvasBulkImportView(generic.BulkImportView):
    queryset = Canvas.objects.all()
    model_form = forms.CanvasImportForm


@register_model_view(Canvas, 'bulk_edit', path='edit', detail=False)
class CanvasBulkEditView(generic.BulkEditView):
    queryset = Canvas.objects.annotate(node_count=Count('nodes'))
    filterset = filtersets.CanvasFilterSet
    table = tables.CanvasTable
    form = forms.CanvasBulkEditForm


@register_model_view(Canvas, 'bulk_delete', path='delete', detail=False)
class CanvasBulkDeleteView(generic.BulkDeleteView):
    queryset = Canvas.objects.annotate(node_count=Count('nodes'))
    filterset = filtersets.CanvasFilterSet
    table = tables.CanvasTable


#
# "Connections" tab on Device, VirtualMachine and Service (Phase 2)
#

def _member_services(obj):
    """
    Services whose connections count for `obj`: the services running on a device/VM, or those of an application.
    """
    if isinstance(obj, (Device, VirtualMachine)):
        ct = ContentType.objects.get_for_model(obj)
        return Service.objects.filter(parent_object_type=ct, parent_object_id=obj.pk)
    if isinstance(obj, Application):
        return obj.services.all()
    return Service.objects.none()


def _connection_q(obj):
    """
    Connections where `obj` is an endpoint. For devices, VMs and applications, connections of their services are
    included.
    """
    q = ServiceConnection.endpoint_q(obj)
    for service in _member_services(obj):
        q |= ServiceConnection.endpoint_q(service)
    return q


def _source_q(obj):
    """Q matching connections whose *source* is `obj` (or one of its services)."""
    q = Q(source_type=ContentType.objects.get_for_model(obj), source_id=obj.pk)
    service_ids = _member_services(obj).values_list('pk')
    return q | Q(source_type=ContentType.objects.get_for_model(Service), source_id__in=service_ids)


def connection_count(obj):
    return ServiceConnection.objects.filter(_connection_q(obj)).count()


class ObjectConnectionsView(generic.ObjectChildrenView):
    child_model = ServiceConnection
    table = tables.ObjectServiceConnectionTable
    filterset = filtersets.ServiceConnectionFilterSet
    filterset_form = forms.ServiceConnectionFilterForm
    tab = ViewTab(
        label=_('Connections'),
        badge=connection_count,
        permission='netbox_service_canvas.view_serviceconnection',
        weight=2100,
        hide_if_empty=True,
    )

    def get_children(self, request, parent):
        return ServiceConnection.objects.restrict(request.user, 'view').filter(_connection_q(parent)).annotate(
            relation=Case(
                When(direction=ConnectionDirectionChoices.DIRECTION_BI, then=Value('bidirectional')),
                When(_source_q(parent), then=Value('outgoing')),
                default=Value('incoming'),
                output_field=CharField(),
            ),
            hop_count=Count('hops'),
        ).prefetch_related('source', 'target')


@register_model_view(Device, 'service_connections', path='service-connections')
class DeviceConnectionsView(ObjectConnectionsView):
    queryset = Device.objects.all()


@register_model_view(VirtualMachine, 'service_connections', path='service-connections')
class VirtualMachineConnectionsView(ObjectConnectionsView):
    queryset = VirtualMachine.objects.all()


@register_model_view(Service, 'service_connections', path='service-connections')
class ServiceConnectionsView(ObjectConnectionsView):
    queryset = Service.objects.all()


@register_model_view(Application, 'service_connections', path='connections')
class ApplicationConnectionsView(ObjectConnectionsView):
    queryset = Application.objects.all()
    tab = ViewTab(
        label=_('Connections'),
        badge=connection_count,
        permission='netbox_service_canvas.view_serviceconnection',
        weight=600,
    )


#
# Canvas editor (Phase 3+)
#

@register_model_view(Canvas, 'editor', path='editor')
class CanvasEditorView(generic.ObjectView):
    """
    Hosts the React canvas editor. All data is loaded by the frontend through the REST API using the user's session,
    so permissions are enforced by the API; the flags passed here only control which UI elements are shown.
    """
    queryset = Canvas.objects.all()
    template_name = 'netbox_service_canvas/canvas_editor.html'
    tab = ViewTab(
        label=_('Editor'),
        weight=50,
        permission='netbox_service_canvas.view_canvas',
    )

    def get_extra_context(self, request, instance):
        user = request.user
        can_change_canvas = Canvas.objects.restrict(user, 'change').filter(pk=instance.pk).exists()

        def has(perm):
            return user.has_perm(perm)

        config = {
            'canvas': {
                'id': instance.pk,
                'name': instance.name,
                'site_id': instance.site_id,
                'cluster_id': instance.cluster_id,
            },
            'urls': {
                'api': reverse('api-root'),
                'plugin_api': reverse('plugins-api:netbox_service_canvas-api:api-root'),
                'canvas': instance.get_absolute_url(),
            },
            'grid_size': get_plugin_config('netbox_service_canvas', 'grid_size'),
            'perms': {
                'change_canvas': can_change_canvas,
                'edit_layout': can_change_canvas and all(has(f'netbox_service_canvas.{p}') for p in (
                    'add_canvasnode', 'change_canvasnode', 'delete_canvasnode',
                )),
                'edit_groups': can_change_canvas and all(has(f'netbox_service_canvas.{p}') for p in (
                    'add_canvasgroup', 'change_canvasgroup', 'delete_canvasgroup',
                )),
                'add_connection': has('netbox_service_canvas.add_serviceconnection'),
                'change_connection': has('netbox_service_canvas.change_serviceconnection'),
                'delete_connection': has('netbox_service_canvas.delete_serviceconnection'),
                'add_hop': has('netbox_service_canvas.add_connectionhop'),
                'change_hop': has('netbox_service_canvas.change_connectionhop'),
                'delete_hop': has('netbox_service_canvas.delete_connectionhop'),
                'add_service': has('ipam.add_service'),
                'change_service': has('ipam.change_service'),
                'add_application': has('netbox_service_canvas.add_application'),
                'change_application': has('netbox_service_canvas.change_application'),
                'edit_notes': can_change_canvas and all(has(f'netbox_service_canvas.{p}') for p in (
                    'add_canvasnote', 'change_canvasnote', 'delete_canvasnote',
                )),
            },
            'focus': request.GET.get('focus', ''),
        }
        return {'editor_config': config}
