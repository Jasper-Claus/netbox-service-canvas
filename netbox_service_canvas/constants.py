from django.db.models import Q

#
# Allowed object types for the generic relations of this plugin.
# Each tuple entry is (app_label, model). The Q objects are used as `limit_choices_to`
# and as queryset filters for ContentType selection in forms and serializers.
#

def _q(models):
    query = Q()
    for app_label, model in models:
        query |= Q(app_label=app_label, model=model)
    return query


# Endpoints of a ServiceConnection
CONNECTION_ENDPOINT_TYPES = (
    ('ipam', 'service'),
    ('dcim', 'device'),
    ('virtualization', 'virtualmachine'),
    ('netbox_service_canvas', 'application'),
)
CONNECTION_ENDPOINT_MODELS = _q(CONNECTION_ENDPOINT_TYPES)

# Intermediate stations ("via") of a ServiceConnection
HOP_OBJECT_TYPES = (
    ('ipam', 'service'),
    ('dcim', 'interface'),
    ('virtualization', 'vminterface'),
    ('ipam', 'vlan'),
    ('ipam', 'vrf'),
    ('ipam', 'prefix'),
    ('ipam', 'ipaddress'),
    ('vpn', 'tunnel'),
    ('dcim', 'device'),
    ('virtualization', 'virtualmachine'),
)
HOP_OBJECT_MODELS = _q(HOP_OBJECT_TYPES)

# Objects that can be placed on a canvas
CANVAS_NODE_TYPES = CONNECTION_ENDPOINT_TYPES
CANVAS_NODE_MODELS = CONNECTION_ENDPOINT_MODELS

PORT_MIN = 1
PORT_MAX = 65535
