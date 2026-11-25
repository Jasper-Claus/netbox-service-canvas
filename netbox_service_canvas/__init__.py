from netbox.plugins import PluginConfig

__version__ = '0.3.0'


class ServiceCanvasConfig(PluginConfig):
    name = 'netbox_service_canvas'
    verbose_name = 'Service Canvas'
    description = 'Interactive canvas for services, their hosts and the connections between them'
    version = __version__
    author = 'Jasper Claus'
    base_url = 'service-canvas'
    graphql_schema = 'graphql.schema.schema'
    min_version = '4.5.0'
    max_version = '4.5.99'
    default_settings = {
        # Grid size (px) used for snapping and for rounding stored coordinates.
        'grid_size': 10,
    }

    def ready(self):
        super().ready()
        # Connect GFK cleanup handlers (see signals.py for details)
        from . import signals  # noqa: F401


config = ServiceCanvasConfig
