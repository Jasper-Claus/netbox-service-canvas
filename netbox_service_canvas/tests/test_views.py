from django.contrib.contenttypes.models import ContentType
from django.urls import reverse

from dcim.models import Device
from extras.models import Tag
from ipam.models import VRF, Service
from utilities.testing import TestCase, ViewTestCases, create_tags

from ..models import Application, Canvas, ConnectionHop, ServiceConnection
from .utils import create_base_objects, create_connection


class PluginURLMixin:
    def _get_base_url(self):
        return f'plugins:netbox_service_canvas:{self.model._meta.model_name}_{{}}'


class ServiceConnectionViewTest(PluginURLMixin, ViewTestCases.PrimaryObjectViewTestCase):
    model = ServiceConnection
    # GFK form fields cannot be compared to model attributes directly
    validation_excluded_fields = ('source', 'target')

    @classmethod
    def setUpTestData(cls):
        o = create_base_objects()
        connections = (
            create_connection(o['speedtest'], o['grafana']),
            create_connection(o['grafana'], o['prometheus']),
            create_connection(o['traefik'], o['grafana']),
        )
        tags = create_tags('Alpha', 'Bravo', 'Charlie')
        service_ct = ContentType.objects.get_for_model(Service)

        cls.form_data = {
            'source_type': service_ct.pk,
            'source': o['prometheus'].pk,
            'target_type': ContentType.objects.get_for_model(Device).pk,
            'target': o['device1'].pk,
            'direction': 'uni',
            'kind': 'uses',
            'protocol': 'https',
            'port': 9100,
            'data_description': 'Metrics',
            'status': 'active',
            'description': 'Scrape',
            'tags': [t.pk for t in tags],
        }
        cls.csv_data = (
            'source_type,source_id,target_type,target_id,protocol,port,data_description',
            f"ipam.service,{o['prometheus'].pk},ipam.service,{o['speedtest'].pk},http,80,Metrics",
            f"ipam.service,{o['speedtest'].pk},ipam.service,{o['traefik'].pk},https,443,",
            f"dcim.device,{o['device2'].pk},virtualization.virtualmachine,{o['vm1'].pk},nfs,,Backups",
        )
        cls.csv_update_data = (
            'id,status,data_description',
            f'{connections[0].pk},planned,A',
            f'{connections[1].pk},disabled,B',
            f'{connections[2].pk},active,C',
        )
        cls.bulk_edit_data = {
            'protocol': 'mqtt',
            'status': 'planned',
            'description': 'New description',
        }


class ConnectionHopViewTest(PluginURLMixin, ViewTestCases.PrimaryObjectViewTestCase):
    model = ConnectionHop
    validation_excluded_fields = ('object',)

    @classmethod
    def setUpTestData(cls):
        o = create_base_objects()
        connection = create_connection(o['speedtest'], o['grafana'])
        other = create_connection(o['prometheus'], o['grafana'])
        vrfs = [VRF.objects.create(name=f'VRF {i}') for i in range(1, 8)]
        hops = [
            ConnectionHop.objects.create(connection=connection, order=i, object=vrfs[i - 1]) for i in (1, 2, 3)
        ]
        tags = create_tags('Alpha', 'Bravo', 'Charlie')
        cls.form_data = {
            'connection': other.pk,
            'order': 1,
            'object_type': ContentType.objects.get_for_model(Service).pk,
            'object': o['traefik'].pk,
            'note': 'reverse proxy',
            'tags': [t.pk for t in tags],
        }
        cls.csv_data = (
            'connection,order,object_type,object_id,note',
            f'{other.pk},2,ipam.vrf,{vrfs[3].pk},Tailscale',
            f'{other.pk},3,ipam.vrf,{vrfs[4].pk},',
            f'{other.pk},4,ipam.vrf,{vrfs[5].pk},',
        )
        cls.csv_update_data = (
            'id,note',
            f'{hops[0].pk},a',
            f'{hops[1].pk},b',
            f'{hops[2].pk},c',
        )
        cls.bulk_edit_data = {
            'note': 'bulk',
        }


class CanvasViewTest(PluginURLMixin, ViewTestCases.PrimaryObjectViewTestCase):
    model = Canvas

    @classmethod
    def setUpTestData(cls):
        canvases = Canvas.objects.bulk_create([Canvas(name=f'Canvas {i}') for i in range(1, 4)])
        create_tags('Alpha', 'Bravo', 'Charlie')
        cls.form_data = {
            'name': 'Canvas X',
            'description': 'Homelab',
            'tags': [t.pk for t in Tag.objects.all()],
        }
        cls.csv_data = (
            'name,description',
            'Canvas 4,Fourth',
            'Canvas 5,Fifth',
            'Canvas 6,Sixth',
        )
        cls.csv_update_data = (
            'id,description',
            f'{canvases[0].pk},A',
            f'{canvases[1].pk},B',
            f'{canvases[2].pk},C',
        )
        cls.bulk_edit_data = {
            'description': 'New description',
        }


class ApplicationViewTest(PluginURLMixin, ViewTestCases.PrimaryObjectViewTestCase):
    model = Application

    @classmethod
    def setUpTestData(cls):
        o = create_base_objects()
        apps = (
            Application.objects.create(name='Grafana'),
            Application.objects.create(name='Prometheus'),
            Application.objects.create(name='Paperless'),
        )
        apps[0].services.set([o['grafana']])
        tags = create_tags('Alpha', 'Bravo', 'Charlie')
        cls.form_data = {
            'name': 'Home Assistant',
            'status': 'planned',
            'version': '2026.11',
            'web_url': 'https://ha.example.com',
            'services': [o['speedtest'].pk, o['traefik'].pk],
            'description': 'Smart home',
            'tags': [t.pk for t in tags],
        }
        cls.csv_data = (
            'name,status,version,services',
            f"Traefik,active,3.2,{o['traefik'].pk}",
            f"Speedtest Tracker,planned,,{o['speedtest'].pk}",
            'Nextcloud,,29,',
        )
        cls.csv_update_data = (
            'id,version',
            f'{apps[0].pk},1',
            f'{apps[1].pk},2',
            f'{apps[2].pk},3',
        )
        cls.bulk_edit_data = {
            'status': 'offline',
            'version': 'latest',
        }


class ApplicationTabsTest(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.o = create_base_objects()
        cls.app = Application.objects.create(name='Grafana')
        cls.app.services.set([cls.o['grafana']])
        create_connection(cls.o['speedtest'], cls.o['grafana'], data_description='Speedtest results')

    def test_services_tab(self):
        self.add_permissions('netbox_service_canvas.view_application', 'ipam.view_service')
        url = reverse('plugins:netbox_service_canvas:application_services', kwargs={'pk': self.app.pk})
        response = self.client.get(url)
        self.assertHttpStatus(response, 200)
        self.assertContains(response, 'grafana')

    def test_connections_tab_includes_services(self):
        self.add_permissions('netbox_service_canvas.view_application', 'netbox_service_canvas.view_serviceconnection')
        url = reverse('plugins:netbox_service_canvas:application_service_connections', kwargs={'pk': self.app.pk})
        response = self.client.get(url)
        self.assertHttpStatus(response, 200)
        self.assertContains(response, 'Speedtest results')

    def test_applications_panel_on_service(self):
        self.add_permissions('ipam.view_service', 'netbox_service_canvas.view_application')
        response = self.client.get(self.o['grafana'].get_absolute_url())
        self.assertHttpStatus(response, 200)
        self.assertContains(response, 'Applications')


class ConnectionsTabTest(TestCase):
    """
    "Connections" tab on Device, VirtualMachine and Service.
    """

    @classmethod
    def setUpTestData(cls):
        cls.o = create_base_objects()
        cls.connection = create_connection(cls.o['speedtest'], cls.o['grafana'], data_description='Speedtest results')

    def test_service_tab(self):
        self.add_permissions('ipam.view_service', 'netbox_service_canvas.view_serviceconnection')
        url = reverse('ipam:service_service_connections', kwargs={'pk': self.o['grafana'].pk})
        response = self.client.get(url)
        self.assertHttpStatus(response, 200)
        self.assertContains(response, 'Speedtest results')

    def test_device_tab_includes_services(self):
        """Connections of services running on a device are listed on the device."""
        self.add_permissions('dcim.view_device', 'netbox_service_canvas.view_serviceconnection')
        url = reverse('dcim:device_service_connections', kwargs={'pk': self.o['device1'].pk})
        response = self.client.get(url)
        self.assertHttpStatus(response, 200)
        self.assertContains(response, 'Speedtest results')

    def test_vm_tab(self):
        self.add_permissions('virtualization.view_virtualmachine', 'netbox_service_canvas.view_serviceconnection')
        url = reverse('virtualization:virtualmachine_service_connections', kwargs={'pk': self.o['vm1'].pk})
        self.assertHttpStatus(self.client.get(url), 200)


class FeatureTabsTest(TestCase):
    """
    Changelog and journal tabs need a <model_name>.html base template per model.
    """

    @classmethod
    def setUpTestData(cls):
        o = create_base_objects()
        connection = create_connection(o['speedtest'], o['grafana'])
        cls.objects = (
            Application.objects.create(name='Grafana'),
            Canvas.objects.create(name='Homelab'),
            connection,
            ConnectionHop.objects.create(connection=connection, order=1, object=VRF.objects.create(name='Tailscale')),
        )

    def test_changelog_and_journal(self):
        self.user.is_superuser = True
        self.user.save()
        for obj in self.objects:
            name = obj._meta.model_name
            for tab in ('changelog', 'journal'):
                with self.subTest(model=name, tab=tab):
                    url = reverse(f'plugins:netbox_service_canvas:{name}_{tab}', kwargs={'pk': obj.pk})
                    self.assertHttpStatus(self.client.get(url), 200)


class CanvasEditorViewTest(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.canvas = Canvas.objects.create(name='Homelab')

    def url(self):
        return reverse('plugins:netbox_service_canvas:canvas_editor', kwargs={'pk': self.canvas.pk})

    def test_editor_requires_view_permission(self):
        self.assertHttpStatus(self.client.get(self.url()), 403)

    def test_editor_read_only_flags(self):
        self.add_permissions('netbox_service_canvas.view_canvas')
        response = self.client.get(self.url())
        self.assertHttpStatus(response, 200)
        self.assertContains(response, 'nsc-editor-config')
        self.assertContains(response, 'netbox_service_canvas/dist/canvas.js')
        perms = response.context['editor_config']['perms']
        self.assertFalse(perms['edit_layout'])
        self.assertFalse(perms['add_connection'])
        self.assertFalse(perms['edit_notes'])
        self.assertFalse(perms['add_application'])
        self.assertFalse(perms['add_device'])

    def test_editor_edit_flags(self):
        self.add_permissions(
            'netbox_service_canvas.view_canvas', 'netbox_service_canvas.change_canvas',
            'netbox_service_canvas.add_canvasnode', 'netbox_service_canvas.change_canvasnode',
            'netbox_service_canvas.delete_canvasnode', 'netbox_service_canvas.add_serviceconnection',
        )
        response = self.client.get(self.url() + '?focus=dcim.device:1')
        perms = response.context['editor_config']['perms']
        self.assertTrue(perms['edit_layout'])
        self.assertFalse(perms['edit_groups'])
        self.assertTrue(perms['add_connection'])
        self.assertFalse(perms['edit_notes'])
        self.assertEqual(response.context['editor_config']['focus'], 'dcim.device:1')

    def test_editor_note_and_application_flags(self):
        self.add_permissions(
            'netbox_service_canvas.view_canvas', 'netbox_service_canvas.change_canvas',
            'netbox_service_canvas.add_canvasnote', 'netbox_service_canvas.change_canvasnote',
            'netbox_service_canvas.delete_canvasnote', 'netbox_service_canvas.add_application',
            'netbox_service_canvas.change_application',
        )
        perms = self.client.get(self.url()).context['editor_config']['perms']
        self.assertTrue(perms['edit_notes'])
        self.assertTrue(perms['add_application'])
        self.assertTrue(perms['change_application'])
        self.assertFalse(perms['edit_layout'])
