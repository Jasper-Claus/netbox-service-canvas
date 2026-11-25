import uuid

from django.contrib.contenttypes.models import ContentType
from django.test import RequestFactory, TestCase

from core.models import ObjectChange
from dcim.choices import InterfaceTypeChoices
from dcim.models import Interface
from ipam.models import VRF
from netbox.context_managers import event_tracking
from utilities.testing import create_test_user

from ..models import Canvas, CanvasNode, ConnectionHop, ServiceConnection
from .utils import create_base_objects, create_connection


class DeletionSignalTest(TestCase):
    """
    GenericForeignKeys do not cascade; signals.py takes care of it. See the module docstring there.
    """

    def setUp(self):
        self.o = create_base_objects()
        self.canvas = Canvas.objects.create(name='Homelab')
        for key in ('device1', 'device2', 'vm1', 'speedtest', 'traefik', 'grafana', 'prometheus'):
            CanvasNode.objects.create(canvas=self.canvas, object=self.o[key])

    def _nodes_for(self, obj):
        ct = ContentType.objects.get_for_model(obj)
        return CanvasNode.objects.filter(object_type=ct, object_id=obj.pk)

    def test_service_delete_removes_nodes_and_connections(self):
        grafana = self.o['grafana']
        c1 = create_connection(self.o['speedtest'], grafana)
        c2 = create_connection(grafana, self.o['prometheus'])
        c3 = create_connection(self.o['speedtest'], self.o['prometheus'])
        ConnectionHop.objects.create(connection=c1, order=1, object=self.o['traefik'])

        grafana_pk = grafana.pk
        grafana.delete()

        ct = ContentType.objects.get_for_model(grafana)
        self.assertFalse(CanvasNode.objects.filter(object_type=ct, object_id=grafana_pk).exists())
        self.assertFalse(ServiceConnection.objects.filter(pk__in=[c1.pk, c2.pk]).exists())
        self.assertFalse(ConnectionHop.objects.filter(connection_id=c1.pk).exists())
        self.assertTrue(ServiceConnection.objects.filter(pk=c3.pk).exists())

    def test_device_delete_cascades_to_its_services(self):
        """
        Deleting a device makes Django cascade to its services (GenericRelation); the signal must fire for those too.
        """
        speedtest, traefik = self.o['speedtest'], self.o['traefik']
        conn = create_connection(speedtest, self.o['grafana'])
        unrelated = create_connection(self.o['grafana'], self.o['prometheus'])

        self.o['device1'].delete()

        self.assertFalse(ServiceConnection.objects.filter(pk=conn.pk).exists())
        self.assertTrue(ServiceConnection.objects.filter(pk=unrelated.pk).exists())
        remaining = {node.object_id for node in CanvasNode.objects.filter(
            object_type=ContentType.objects.get_for_model(speedtest))}
        self.assertNotIn(speedtest.pk, remaining)
        self.assertNotIn(traefik.pk, remaining)
        self.assertEqual(CanvasNode.objects.filter(canvas=self.canvas).count(), 4)

    def test_vm_delete_removes_node_and_endpoint_connections(self):
        vm = self.o['vm1']
        conn = create_connection(vm, self.o['device2'])
        vm.delete()
        self.assertFalse(self._nodes_for(vm).exists())
        self.assertFalse(ServiceConnection.objects.filter(pk=conn.pk).exists())

    def test_hop_object_delete_removes_hop_and_renumbers(self):
        vrf = VRF.objects.create(name='Tailscale')
        interface = Interface.objects.create(
            device=self.o['device2'], name='wg0', type=InterfaceTypeChoices.TYPE_VIRTUAL
        )
        conn = create_connection(self.o['speedtest'], self.o['grafana'])
        ConnectionHop.objects.create(connection=conn, order=1, object=self.o['traefik'])
        ConnectionHop.objects.create(connection=conn, order=2, object=vrf)
        ConnectionHop.objects.create(connection=conn, order=3, object=interface)

        vrf.delete()

        hops = list(conn.hops.order_by('order'))
        self.assertEqual([h.order for h in hops], [1, 2])
        self.assertEqual([h.object for h in hops], [self.o['traefik'], interface])

    def test_hop_service_delete_keeps_connection(self):
        """A service that is only a hop (not an endpoint) removes the hop, not the connection."""
        conn = create_connection(self.o['speedtest'], self.o['grafana'])
        ConnectionHop.objects.create(connection=conn, order=1, object=self.o['traefik'])
        self.o['traefik'].delete()
        self.assertTrue(ServiceConnection.objects.filter(pk=conn.pk).exists())
        self.assertEqual(conn.hops.count(), 0)

    def test_cascaded_deletions_are_change_logged(self):
        """Every cascaded deletion produces an ObjectChange (required for netbox-branching)."""
        conn = create_connection(self.o['speedtest'], self.o['grafana'])
        user = create_test_user('signal-tester')

        request = RequestFactory().get('/')
        request.id = uuid.uuid4()
        request.user = user
        with event_tracking(request):
            self.o['grafana'].delete()

        logged = ObjectChange.objects.filter(
            changed_object_type=ContentType.objects.get_for_model(ServiceConnection),
            changed_object_id=conn.pk,
            action='delete',
        )
        self.assertTrue(logged.exists())
        node_ct = ContentType.objects.get_for_model(CanvasNode)
        self.assertTrue(ObjectChange.objects.filter(changed_object_type=node_ct, action='delete').exists())
