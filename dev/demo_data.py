"""
Demo data for the dev stack. Run with:
  docker compose exec -T netbox /opt/netbox/netbox/manage.py nbshell < ~/netbox-service-canvas/dev/demo_data.py
Idempotent: existing objects are reused.
"""
from django.contrib.contenttypes.models import ContentType

from dcim.models import Device, DeviceRole, DeviceType, Manufacturer, Site
from ipam.models import VRF, Service
from netbox_service_canvas.models import Canvas, CanvasNode, ConnectionHop, ServiceConnection
from virtualization.models import Cluster, ClusterType, VirtualMachine

site, _ = Site.objects.get_or_create(name='Homelab', slug='homelab')
mf, _ = Manufacturer.objects.get_or_create(name='Generic', slug='generic')
dt, _ = DeviceType.objects.get_or_create(manufacturer=mf, model='Server', slug='server')
role, _ = DeviceRole.objects.get_or_create(name='Server', slug='server')
ct, _ = ClusterType.objects.get_or_create(name='Proxmox', slug='proxmox')
cluster, _ = Cluster.objects.get_or_create(name='pve', type=ct, defaults={'scope': site})

rick, _ = Device.objects.get_or_create(name='rick', defaults={'site': site, 'device_type': dt, 'role': role})
nas, _ = Device.objects.get_or_create(name='nas', defaults={'site': site, 'device_type': dt, 'role': role})
monitoring, _ = VirtualMachine.objects.get_or_create(name='monitoring', defaults={'cluster': cluster})


def service(parent, name, port, protocol='tcp'):
    obj = Service.objects.filter(name=name).first()
    if obj is None:
        obj = Service(parent=parent, name=name, protocol=protocol, ports=[port])
        obj.save()
    return obj


traefik = service(rick, 'traefik', 443)
speedtest = service(rick, 'speedtest-tracker', 8080)
netbox = service(rick, 'netbox', 8080)
grafana = service(monitoring, 'grafana', 3000)
prometheus = service(monitoring, 'prometheus', 9090)
nfs = service(nas, 'nfs', 2049)

tailscale, _ = VRF.objects.get_or_create(name='Tailscale')


def connection(source, target, protocol, port=None, data='', status='active', direction='uni'):
    conn = ServiceConnection.objects.filter(
        ServiceConnection.endpoint_q(source) & ServiceConnection.endpoint_q(target)
    ).first()
    if conn is None:
        conn = ServiceConnection(source=source, target=target, protocol=protocol, port=port,
                                 data_description=data, status=status, direction=direction)
        conn.full_clean()
        conn.save()
    return conn


c1 = connection(speedtest, grafana, 'https', 3000, 'Messwerte')
if not c1.hops.exists():
    ConnectionHop.objects.create(connection=c1, order=1, object=traefik)
    ConnectionHop.objects.create(connection=c1, order=2, object=tailscale)
connection(prometheus, netbox, 'http', 8080, 'Service Discovery')
connection(prometheus, grafana, 'http', 9090, 'Metriken', direction='bi')
connection(rick, nfs, 'nfs', 2049, 'Backups', status='planned')

canvas, _ = Canvas.objects.get_or_create(name='Homelab', defaults={'site': site})
for i, obj in enumerate([rick, monitoring, nas, traefik, speedtest, netbox, grafana, prometheus, nfs]):
    CanvasNode.objects.get_or_create(
        canvas=canvas, object_type=ContentType.objects.get_for_model(obj), object_id=obj.pk,
        defaults={'x': (i % 3) * 300, 'y': (i // 3) * 200},
    )

print('Demo data ready:', ServiceConnection.objects.count(), 'connections,', canvas.nodes.count(), 'canvas nodes')
