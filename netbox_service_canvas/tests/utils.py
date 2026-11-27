from ipam.choices import ServiceProtocolChoices
from ipam.models import Service
from utilities.testing import create_test_device, create_test_virtualmachine

from ..choices import ConnectionProtocolChoices
from ..compat import service_create_kwargs
from ..models import ServiceConnection


def create_service(parent, name, port=80):
    return Service.objects.create(
        parent=parent, name=name, **service_create_kwargs(ServiceProtocolChoices.PROTOCOL_TCP, [port]),
    )


def create_connection(source, target, **kwargs):
    kwargs.setdefault('protocol', ConnectionProtocolChoices.PROTOCOL_HTTP)
    connection = ServiceConnection(source=source, target=target, **kwargs)
    connection.full_clean()
    connection.save()
    return connection


def create_base_objects():
    """
    Two devices and one VM, each running services:
      device1: speedtest(80), traefik(443)
      device2: grafana(3000)
      vm1:     prometheus(9090)
    """
    device1 = create_test_device('Device 1')
    device2 = create_test_device('Device 2')
    vm1 = create_test_virtualmachine('VM 1')
    return {
        'device1': device1,
        'device2': device2,
        'vm1': vm1,
        'speedtest': create_service(device1, 'speedtest', 80),
        'traefik': create_service(device1, 'traefik', 443),
        'grafana': create_service(device2, 'grafana', 3000),
        'prometheus': create_service(vm1, 'prometheus', 9090),
    }
