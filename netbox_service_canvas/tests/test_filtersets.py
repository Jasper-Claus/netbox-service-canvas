from django.test import TestCase

from ipam.models import VRF

from ..filtersets import ApplicationFilterSet, CanvasFilterSet, ServiceConnectionFilterSet
from ..models import Application, Canvas, CanvasNode, ConnectionHop, ServiceConnection
from .utils import create_base_objects, create_connection


class ServiceConnectionFilterSetTest(TestCase):
    queryset = ServiceConnection.objects.all()

    @classmethod
    def setUpTestData(cls):
        cls.o = o = create_base_objects()
        cls.c1 = create_connection(o['speedtest'], o['grafana'], protocol='http', status='active')
        cls.c2 = create_connection(o['grafana'], o['prometheus'], protocol='https', status='planned')
        cls.c3 = create_connection(o['device1'], o['vm1'], protocol='nfs', status='disabled')
        vrf = VRF.objects.create(name='Tailscale')
        ConnectionHop.objects.create(connection=cls.c1, order=1, object=vrf)
        cls.vrf = vrf

    def filter(self, **params):
        return set(ServiceConnectionFilterSet(params, self.queryset).qs)

    def test_protocol(self):
        self.assertEqual(self.filter(protocol=['http', 'nfs']), {self.c1, self.c3})

    def test_status(self):
        self.assertEqual(self.filter(status=['planned']), {self.c2})

    def test_service_either_side(self):
        self.assertEqual(self.filter(service_id=[self.o['grafana'].pk]), {self.c1, self.c2})

    def test_device_includes_its_services(self):
        # device1 is an endpoint of c3 and runs speedtest (endpoint of c1)
        self.assertEqual(self.filter(device_id=[self.o['device1'].pk]), {self.c1, self.c3})

    def test_virtual_machine_includes_its_services(self):
        self.assertEqual(self.filter(virtual_machine_id=[self.o['vm1'].pk]), {self.c2, self.c3})

    def test_source_type(self):
        self.assertEqual(self.filter(source_type=['dcim.device']), {self.c3})

    def test_hop(self):
        self.assertEqual(self.filter(hop_type=['ipam.vrf'], hop_id=[self.vrf.pk]), {self.c1})

    def test_search(self):
        self.c2.data_description = 'Metrics'
        self.c2.save()
        self.assertEqual(self.filter(q='metr'), {self.c2})


class CanvasFilterSetTest(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.o = create_base_objects()
        cls.a = Canvas.objects.create(name='A')
        cls.b = Canvas.objects.create(name='B')
        CanvasNode.objects.create(canvas=cls.a, object=cls.o['grafana'])

    def test_contains_object(self):
        qs = CanvasFilterSet(
            {'object_type': ['ipam.service'], 'object_id': [self.o['grafana'].pk]}, Canvas.objects.all()
        ).qs
        self.assertEqual(set(qs), {self.a})


class ApplicationFilterSetTest(TestCase):
    queryset = Application.objects.all()
    filterset = ApplicationFilterSet

    @classmethod
    def setUpTestData(cls):
        cls.o = create_base_objects()
        grafana = Application.objects.create(name='Grafana', status='active', version='11')
        grafana.services.set([cls.o['grafana']])
        prometheus = Application.objects.create(name='Prometheus', status='planned')
        prometheus.services.set([cls.o['prometheus']])
        Application.objects.create(name='Paperless', status='offline')

    def test_status(self):
        self.assertEqual(self.filterset({'status': ['active', 'planned']}, self.queryset).qs.count(), 2)

    def test_service(self):
        self.assertEqual(self.filterset({'service_id': [self.o['grafana'].pk]}, self.queryset).qs.count(), 1)

    def test_runs_on_host(self):
        self.assertEqual(self.filterset({'device_id': [self.o['device2'].pk]}, self.queryset).qs.get().name, 'Grafana')
        self.assertEqual(
            self.filterset({'virtual_machine_id': [self.o['vm1'].pk]}, self.queryset).qs.get().name, 'Prometheus'
        )

    def test_search(self):
        self.assertEqual(self.filterset({'q': 'paper'}, self.queryset).qs.count(), 1)

    def test_connection_application_filter(self):
        app = Application.objects.get(name='Grafana')
        create_connection(self.o['speedtest'], self.o['grafana'])  # via its service
        create_connection(self.o['prometheus'], app)               # directly
        create_connection(self.o['speedtest'], self.o['traefik'])  # unrelated
        qs = ServiceConnectionFilterSet({'application_id': [app.pk]}, ServiceConnection.objects.all()).qs
        self.assertEqual(qs.count(), 2)
