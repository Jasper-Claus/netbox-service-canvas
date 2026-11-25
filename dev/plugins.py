# Dev configuration: copy to <netbox-docker>/configuration/plugins.py
PLUGINS = [
    'netbox_service_canvas',
]

PLUGINS_CONFIG = {
    'netbox_service_canvas': {
        'grid_size': 10,
    },
}
