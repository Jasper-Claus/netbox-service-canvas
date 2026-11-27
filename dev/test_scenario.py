"""
Test scenario for line bending/colours, proxy connections, hops and application icons.
Creates the site "Testlabor" with a small homelab and the canvas "Testlabor". Run with:
  docker compose exec -T netbox /opt/netbox/netbox/manage.py nbshell < ~/netbox-service-canvas/dev/test_scenario.py
Idempotent: existing objects are reused, nothing is deleted.

Scenario:
  Internet access:  wireguard (opnsense) --proxy--> traefik --proxy--> paperless / immich / nextcloud / vaultwarden
                                                     traefik --proxy--> authelia --proxy--> grafana   (proxy chain)
  Dependencies:     paperless, immich, nextcloud -> postgres / redis;  grafana -> prometheus;  traefik -> unbound (DNS)
  Hops:             immich -> nfs and paperless -> smb run through the opnsense router
  Hosts:            pve1 runs proxy-vm, docker-vm, db-vm;  pve2 runs auth-vm, monitoring-vm;  truenas, opnsense
"""
from django.contrib.contenttypes.models import ContentType

from dcim.models import Device, DeviceRole, DeviceType, Manufacturer, Site
from ipam.models import Service
from netbox_service_canvas.models import (
    Application, Canvas, CanvasGroup, CanvasNode, CanvasNote, ConnectionHop, ServiceConnection,
)
from virtualization.models import Cluster, ClusterType, VirtualMachine

site, _ = Site.objects.get_or_create(name='Testlabor', slug='testlabor')
mf, _ = Manufacturer.objects.get_or_create(name='Generic', slug='generic')
dt, _ = DeviceType.objects.get_or_create(manufacturer=mf, model='Server', slug='server')
role_server, _ = DeviceRole.objects.get_or_create(name='Server', slug='server')
role_router, _ = DeviceRole.objects.get_or_create(name='Router', slug='router')
ct, _ = ClusterType.objects.get_or_create(name='Proxmox', slug='proxmox')
cluster, _ = Cluster.objects.get_or_create(name='pve-test', type=ct, defaults={'scope': site})


def device(name, role=role_server, in_cluster=False):
    obj, _ = Device.objects.get_or_create(name=name, site=site,
                                          defaults={'device_type': dt, 'role': role})
    if in_cluster and obj.cluster_id != cluster.pk:
        # A VM can only be pinned to a device of its own cluster
        obj.cluster = cluster
        obj.save()
    return obj


def vm(name, host):
    obj = VirtualMachine.objects.filter(name=name, cluster=cluster).first()
    if obj is None:
        obj = VirtualMachine(name=name, cluster=cluster, site=site, device=host)
        obj.full_clean()
        obj.save()
    return obj


def service(parent, name, port, protocol='tcp'):
    parent_ct = ContentType.objects.get_for_model(parent)
    obj = Service.objects.filter(name=name, parent_object_type=parent_ct, parent_object_id=parent.pk).first()
    if obj is None:
        obj = Service(parent=parent, name=name, protocol=protocol, ports=[port])
        obj.save()
    return obj


def application(name, icon, services, version='', url=''):
    obj = Application.objects.filter(name=name).first()
    if obj is None:
        obj = Application(name=name, icon=icon, version=version, web_url=url)
        obj.full_clean()
        obj.save()
    obj.services.add(*services)
    return obj


def connection(source, target, protocol, port=None, data='', kind='uses', status='active', direction='uni',
               hops=()):
    conn = ServiceConnection.objects.filter(
        ServiceConnection.endpoint_q(source) & ServiceConnection.endpoint_q(target)
    ).first()
    if conn is None:
        conn = ServiceConnection(source=source, target=target, protocol=protocol, port=port, kind=kind,
                                 data_description=data, status=status, direction=direction)
        conn.full_clean()
        conn.save()
        for order, hop in enumerate(hops, start=1):
            ConnectionHop.objects.create(connection=conn, order=order, object=hop)
    return conn


# Hosts
opnsense = device('opnsense', role_router)
pve1 = device('pve1', in_cluster=True)
pve2 = device('pve2', in_cluster=True)
truenas = device('truenas')
proxy_vm = vm('proxy-vm', pve1)
docker_vm = vm('docker-vm', pve1)
db_vm = vm('db-vm', pve1)
auth_vm = vm('auth-vm', pve2)
monitoring_vm = vm('monitoring-vm', pve2)

# Services
wireguard = service(opnsense, 'wireguard', 51820, 'udp')
unbound = service(opnsense, 'unbound', 53, 'udp')
traefik = service(proxy_vm, 'traefik', 443)
authelia = service(auth_vm, 'authelia', 9091)
paperless = service(docker_vm, 'paperless', 8000)
immich = service(docker_vm, 'immich', 2283)
nextcloud = service(docker_vm, 'nextcloud', 80)
vaultwarden = service(docker_vm, 'vaultwarden', 8081)
grafana = service(monitoring_vm, 'grafana', 3000)
prometheus = service(monitoring_vm, 'prometheus', 9090)
postgres = service(db_vm, 'postgres', 5432)
redis = service(db_vm, 'redis', 6379)
nfs = service(truenas, 'nfs', 2049)
smb = service(truenas, 'smb', 445)

# Applications (with icons)
apps = [
    application('Paperless-ngx', 'mdi-file-document-outline', [paperless], '2.14', 'https://paperless.lab'),
    application('Immich', 'mdi-image-multiple-outline', [immich], '1.120', 'https://photos.lab'),
    application('Nextcloud', 'mdi-file-document-multiple-outline', [nextcloud], '30', 'https://cloud.lab'),
    application('Vaultwarden', 'mdi-shield-lock-outline', [vaultwarden], '1.32', 'https://vault.lab'),
    application('Grafana Monitoring', 'mdi-chart-line', [grafana, prometheus], '11.3'),
    application('PostgreSQL', 'mdi-database', [postgres], '16'),
]

# Proxy connections: the target is only reachable through the source
connection(wireguard, traefik, 'https', 443, 'VPN-Zugriff von unterwegs', kind='proxy')
connection(traefik, authelia, 'https', 9091, 'Login', kind='proxy')
connection(traefik, paperless, 'https', 8000, kind='proxy')
connection(traefik, immich, 'https', 2283, kind='proxy')
connection(traefik, nextcloud, 'https', 80, kind='proxy')
connection(traefik, vaultwarden, 'https', 8081, kind='proxy')
connection(authelia, grafana, 'https', 3000, 'nur nach Login', kind='proxy')

# Dependencies: the source needs the target
connection(traefik, unbound, 'udp', 53, 'DNS-Namensauflösung')
connection(paperless, postgres, 'tcp', 5432, 'Dokument-Metadaten')
connection(paperless, redis, 'tcp', 6379, 'Task-Queue')
connection(immich, postgres, 'tcp', 5432, 'Foto-Metadaten')
connection(nextcloud, postgres, 'tcp', 5432)
connection(nextcloud, redis, 'tcp', 6379, 'Cache')
connection(grafana, prometheus, 'http', 9090, 'Metriken')
connection(immich, nfs, 'nfs', 2049, 'Fotos', hops=[opnsense])
connection(paperless, smb, 'smb', 445, 'Scan-Eingang', hops=[opnsense])
connection(vaultwarden, nfs, 'nfs', 2049, 'Backup', status='planned')

# Canvas
canvas, _ = Canvas.objects.get_or_create(name='Testlabor', defaults={'site': site})
columns = [
    [opnsense, wireguard, unbound, pve1, pve2],
    [proxy_vm, traefik, auth_vm, authelia],
    [docker_vm, paperless, immich, nextcloud, vaultwarden, monitoring_vm, grafana, prometheus],
    apps[:5],
    [db_vm, postgres, redis, apps[5], truenas, nfs, smb],
]
for col, objects in enumerate(columns):
    for row, obj in enumerate(objects):
        CanvasNode.objects.get_or_create(
            canvas=canvas, object_type=ContentType.objects.get_for_model(obj), object_id=obj.pk,
            defaults={'x': col * 340, 'y': row * 130},
        )

if not canvas.notes.exists():
    CanvasNote.objects.create(canvas=canvas, x=0, y=720, width=320, height=230, color='ffe066', text=(
        'Testideen:\n'
        '1. traefik anklicken > Impact-Analyse: alles dahinter wird gelb (nicht erreichbar)\n'
        '2. authelia ausfallen lassen: grafana wird gelb (Proxy-Kette)\n'
        '3. opnsense ausfallen lassen: Hops brechen, immich/paperless werden orange\n'
        '4. postgres ausfallen lassen: Apps werden orange\n'
        '5. Linie anklicken (Bearbeiten an): +-Punkte ziehen, Farbe wählen'
    ))
if not canvas.groups.exists():
    CanvasGroup.objects.create(canvas=canvas, name='Internet-Zugang', x=-30, y=-50, width=720, height=330,
                               color='4299e1')

print('Testlabor ready:', canvas.nodes.count(), 'nodes on canvas', canvas.pk)
