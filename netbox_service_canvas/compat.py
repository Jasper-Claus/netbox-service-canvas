"""
Differences between the NetBox versions the plugin supports (4.5 to 4.7).

NetBox 4.7 stores a service's protocols and ports in one field, ``port_mappings`` (for example
``['tcp/80', 'udp/53']``). ``protocol`` and ``ports`` are read-only there and both ``None`` for a service
with more than one protocol. NetBox 4.5 and 4.6 store ``protocol`` and ``ports`` directly.
"""
from ipam.choices import ServiceProtocolChoices

__all__ = ('service_create_kwargs', 'service_ports')

_PROTOCOL_LABELS = dict(ServiceProtocolChoices)


def _label(protocol):
    return str(_PROTOCOL_LABELS.get(protocol, protocol.upper()))


def _int_ports(ports):
    return sorted({int(p) for p in ports if str(p).isdigit()})


def service_ports(service):
    """
    The protocols and ports of a service in one shape for every NetBox version:

    - ``protocol``, ``protocol_label``: the single protocol, or empty for a service with several
    - ``ports``: all ports, sorted, across all protocols
    - ``mappings``: ``[(protocol, [ports])]`` in the stored order
    - ``label``: ready to display, e.g. ``TCP 80, 443`` or ``TCP 80 · UDP 53``
    - ``multi_protocol``: True if the service uses more than one protocol (only possible from NetBox 4.7)
    """
    mappings = getattr(service, 'port_mappings', None)
    if mappings is None:  # NetBox 4.5 / 4.6
        grouped = {service.protocol: list(service.ports or [])} if service.protocol else {}
    else:
        grouped = {}
        for mapping in mappings:
            protocol, _sep, port = str(mapping).partition('/')
            grouped.setdefault(protocol.lower(), []).append(port)
    groups = [(protocol, _int_ports(ports)) for protocol, ports in grouped.items()]
    single = groups[0][0] if len(groups) == 1 else ''
    return {
        'protocol': single,
        'protocol_label': _label(single) if single else '',
        'ports': sorted({port for _p, ports in groups for port in ports}),
        'mappings': groups,
        'label': ' · '.join(f"{_label(p)} {', '.join(map(str, ports))}".strip() for p, ports in groups),
        'multi_protocol': len(groups) > 1,
    }


def service_create_kwargs(protocol, ports):
    """Model keyword arguments for a new service with one protocol, for every NetBox version."""
    from ipam.models import Service

    if any(f.name == 'port_mappings' for f in Service._meta.get_fields()):
        return {'port_mappings': [f'{protocol}/{port}' for port in ports]}
    return {'protocol': protocol, 'ports': list(ports)}
