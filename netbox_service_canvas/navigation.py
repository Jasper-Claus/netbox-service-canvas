from django.utils.translation import gettext_lazy as _

from netbox.plugins import PluginMenu, PluginMenuButton, PluginMenuItem


def _item(model, label, url_base):
    return PluginMenuItem(
        link=f'plugins:netbox_service_canvas:{url_base}_list',
        link_text=label,
        permissions=[f'netbox_service_canvas.view_{model}'],
        buttons=(
            PluginMenuButton(
                link=f'plugins:netbox_service_canvas:{url_base}_add',
                title=_('Add'),
                icon_class='mdi mdi-plus-thick',
                permissions=[f'netbox_service_canvas.add_{model}'],
            ),
            PluginMenuButton(
                link=f'plugins:netbox_service_canvas:{url_base}_bulk_import',
                title=_('Import'),
                icon_class='mdi mdi-upload',
                permissions=[f'netbox_service_canvas.add_{model}'],
            ),
        ),
    )


menu = PluginMenu(
    label=_('Service Canvas'),
    groups=(
        (_('Canvas'), (
            _item('canvas', _('Canvases'), 'canvas'),
        )),
        (_('Applications'), (
            _item('application', _('Applications'), 'application'),
        )),
        (_('Connections'), (
            _item('serviceconnection', _('Service Connections'), 'serviceconnection'),
            _item('connectionhop', _('Connection Hops'), 'connectionhop'),
        )),
    ),
    icon_class='mdi mdi-graph-outline',
)
