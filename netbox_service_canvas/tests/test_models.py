from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from dcim.models import Site
from ipam.models import VRF

from ..choices import ConnectionDirectionChoices
from ..models import Canvas, CanvasGroup, CanvasNode, ConnectionHop, ServiceConnection
from .utils import create_base_objects, create_connection


class ServiceConnectionModelTest(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.o = create_base_objects()

    def test_create_service_to_service(self):
        connection = create_connection(self.o['speedtest'], self.o['grafana'], port=3000)
        self.assertEqual(connection.source, self.o['speedtest'])
        self.assertEqual(connection.target, self.o['grafana'])
        self.assertIn('→', str(connection))

    def test_bidirectional_str(self):
        connection = create_connection(
            self.o['grafana'], self.o['prometheus'], direction=ConnectionDirectionChoices.DIRECTION_BI
        )
        self.assertIn('↔', str(connection))

    def test_device_and_vm_endpoints_allowed(self):
        create_connection(self.o['device1'], self.o['vm1'])

    def test_source_equals_target_rejected(self):
        connection = ServiceConnection(source=self.o['grafana'], target=self.o['grafana'], protocol='http')
        with self.assertRaises(ValidationError):
            connection.full_clean()

    def test_source_equals_target_rejected_by_database(self):
        connection = ServiceConnection(source=self.o['grafana'], target=self.o['grafana'], protocol='http')
        with self.assertRaises(IntegrityError), transaction.atomic():
            connection.save()

    def test_disallowed_endpoint_type_rejected(self):
        site = Site.objects.first()
        connection = ServiceConnection(source=site, target=self.o['grafana'], protocol='http')
        with self.assertRaises(ValidationError) as cm:
            connection.full_clean()
        self.assertIn('source_type', cm.exception.message_dict)

    def test_nonexistent_target_rejected(self):
        connection = ServiceConnection(
            source=self.o['grafana'],
            target_type=ContentType.objects.get_for_model(self.o['grafana']),
            target_id=999999,
            protocol='http',
        )
        with self.assertRaises(ValidationError):
            connection.full_clean()

    def test_port_range(self):
        connection = ServiceConnection(source=self.o['speedtest'], target=self.o['grafana'], protocol='tcp',
                                       port=70000)
        with self.assertRaises(ValidationError):
            connection.full_clean()

    def test_endpoint_q(self):
        c1 = create_connection(self.o['speedtest'], self.o['grafana'])
        c2 = create_connection(self.o['prometheus'], self.o['speedtest'])
        create_connection(self.o['grafana'], self.o['prometheus'])
        found = set(ServiceConnection.objects.filter(ServiceConnection.endpoint_q(self.o['speedtest'])))
        self.assertEqual(found, {c1, c2})


class ConnectionHopModelTest(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.o = create_base_objects()
        cls.vrf = VRF.objects.create(name='Tailscale')
        cls.connection = create_connection(cls.o['speedtest'], cls.o['grafana'])

    def test_hop_allowed_types(self):
        hop = ConnectionHop(connection=self.connection, order=1, object=self.o['traefik'])
        hop.full_clean()
        hop.save()
        hop = ConnectionHop(connection=self.connection, order=2, object=self.vrf)
        hop.full_clean()
        hop.save()
        self.assertEqual(list(self.connection.hops.values_list('order', flat=True)), [1, 2])

    def test_hop_disallowed_type(self):
        hop = ConnectionHop(connection=self.connection, order=1, object=Site.objects.first())
        with self.assertRaises(ValidationError):
            hop.full_clean()

    def test_duplicate_order_rejected(self):
        ConnectionHop.objects.create(connection=self.connection, order=1, object=self.o['traefik'])
        hop = ConnectionHop(connection=self.connection, order=1, object=self.vrf)
        with self.assertRaises(ValidationError):
            hop.full_clean()

    def test_renumber(self):
        h1 = ConnectionHop.objects.create(connection=self.connection, order=2, object=self.o['traefik'])
        h2 = ConnectionHop.objects.create(connection=self.connection, order=5, object=self.vrf)
        ConnectionHop.renumber(self.connection.pk)
        h1.refresh_from_db()
        h2.refresh_from_db()
        self.assertEqual((h1.order, h2.order), (1, 2))


class CanvasModelTest(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.o = create_base_objects()
        cls.canvas = Canvas.objects.create(name='Homelab')
        cls.other = Canvas.objects.create(name='Other')

    def test_node_unique_per_canvas(self):
        CanvasNode.objects.create(canvas=self.canvas, object=self.o['grafana'])
        node = CanvasNode(canvas=self.canvas, object=self.o['grafana'])
        with self.assertRaises(ValidationError):
            node.full_clean()
        # Same object on a different canvas is fine
        node = CanvasNode(canvas=self.other, object=self.o['grafana'])
        node.full_clean()

    def test_node_disallowed_type(self):
        node = CanvasNode(canvas=self.canvas, object=Site.objects.first())
        with self.assertRaises(ValidationError):
            node.full_clean()

    def test_node_group_must_belong_to_canvas(self):
        group = CanvasGroup.objects.create(canvas=self.other, name='Storage')
        node = CanvasNode(canvas=self.canvas, object=self.o['device1'], group=group)
        with self.assertRaises(ValidationError):
            node.full_clean()

    def test_layout_models_are_change_logged(self):
        # Required for netbox-branching (see models/canvas.py)
        from netbox.models.features import ChangeLoggingMixin
        self.assertTrue(issubclass(CanvasNode, ChangeLoggingMixin))
        self.assertTrue(issubclass(CanvasGroup, ChangeLoggingMixin))
