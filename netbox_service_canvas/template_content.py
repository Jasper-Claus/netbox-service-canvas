"""
Content injected into NetBox core pages (no core templates are modified):

* Device / VirtualMachine / Service: button "Show on canvas" (dropdown of all canvases containing the object).
  The "Connections" tab itself is registered in views.py via register_model_view().
* Service: full-width panel listing its connections, with a shortcut to add a new one.
"""
from django.contrib.contenttypes.models import ContentType
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from netbox.plugins import PluginTemplateExtension
from netbox.ui import actions
from netbox.ui.panels import ObjectsTablePanel

from .models import Canvas


class ShowOnCanvasButton(PluginTemplateExtension):
    models = ['dcim.device', 'virtualization.virtualmachine', 'ipam.service', 'netbox_service_canvas.application']

    def buttons(self):
        obj = self.context['object']
        request = self.context['request']
        if not request.user.has_perm('netbox_service_canvas.view_canvas'):
            return ''
        ct = ContentType.objects.get_for_model(obj)
        canvases = Canvas.objects.restrict(request.user, 'view').filter(
            nodes__object_type=ct, nodes__object_id=obj.pk
        ).distinct()
        focus = f'{ct.app_label}.{ct.model}:{obj.pk}'
        links = [
            (canvas, f"{reverse('plugins:netbox_service_canvas:canvas_editor', args=[canvas.pk])}?focus={focus}")
            for canvas in canvases
        ]
        return self.render('netbox_service_canvas/inc/show_on_canvas_button.html', extra_context={
            'canvas_links': links,
            'add_url': reverse('plugins:netbox_service_canvas:canvas_list'),
        })


class ServiceConnectionsPanel(PluginTemplateExtension):
    models = ['ipam.service']

    def full_width_page(self):
        obj = self.context['object']
        if not self.context['request'].user.has_perm('netbox_service_canvas.view_serviceconnection'):
            return ''
        panel = ObjectsTablePanel(
            'netbox_service_canvas.serviceconnection',
            filters={'service_id': obj.pk},
            title=_('Service connections'),
            actions=[
                actions.AddObject(
                    'netbox_service_canvas.serviceconnection',
                    url_params={
                        'source_type': ContentType.objects.get_for_model(obj).pk,
                        'source': obj.pk,
                    },
                    label=_('Add connection'),
                ),
            ],
        )
        return panel.render(self.context)


class ApplicationsPanel(PluginTemplateExtension):
    """
    Applications a service belongs to, or whose services run on a device / virtual machine.
    """
    models = ['ipam.service', 'dcim.device', 'virtualization.virtualmachine']
    filter_names = {
        'ipam.service': 'service_id',
        'dcim.device': 'device_id',
        'virtualization.virtualmachine': 'virtual_machine_id',
    }

    def right_page(self):
        obj = self.context['object']
        if not self.context['request'].user.has_perm('netbox_service_canvas.view_application'):
            return ''
        label = obj._meta.label_lower
        panel = ObjectsTablePanel(
            'netbox_service_canvas.application',
            filters={self.filter_names[label]: obj.pk},
            title=_('Applications'),
            actions=[
                actions.AddObject(
                    'netbox_service_canvas.application',
                    url_params={'services': obj.pk} if label == 'ipam.service' else {},
                    label=_('Add application'),
                ),
            ],
        )
        return panel.render(self.context)


template_extensions = [ApplicationsPanel, ShowOnCanvasButton, ServiceConnectionsPanel]
