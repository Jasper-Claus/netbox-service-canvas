from django.contrib.contenttypes.models import ContentType
from django.urls import reverse
from rest_framework import status

from core.models import ObjectChange
from ipam.models import VRF
from users.models import ObjectPermission
from utilities.testing import APITestCase, APIViewTestCases

from ..models import Canvas, CanvasGroup, CanvasNode, ConnectionHop, ServiceConnection
from .utils import create_base_objects, create_connection

NAMESPACE = 'plugins-api:netbox_service_canvas'


class ServiceConnectionAPITest(APIViewTestCases.APIViewTestCase):
    model = ServiceConnection
    view_namespace = NAMESPACE
    brief_fields = ['description', 'direction', 'display', 'id', 'port', 'protocol', 'status', 'url']
    graphql_base_name = 'service_canvas_connection'
    bulk_update_data = {
        'status': 'planned',
    }

    @classmethod
    def setUpTestData(cls):
        o = create_base_objects()
        create_connection(o['speedtest'], o['grafana'], port=3000)
        create_connection(o['grafana'], o['prometheus'], port=9090)
        create_connection(o['device1'], o['vm1'])
        cls.create_data = [
            {
                'source_type': 'ipam.service', 'source_id': o['prometheus'].pk,
                'target_type': 'ipam.service', 'target_id': o['speedtest'].pk,
                'protocol': 'http', 'port': 80, 'data_description': 'Metrics',
            },
            {
                'source_type': 'dcim.device', 'source_id': o['device2'].pk,
                'target_type': 'virtualization.virtualmachine', 'target_id': o['vm1'].pk,
                'protocol': 'nfs', 'direction': 'bi', 'status': 'planned',
            },
            {
                'source_type': 'ipam.service', 'source_id': o['traefik'].pk,
                'target_type': 'ipam.service', 'target_id': o['grafana'].pk,
                'protocol': 'https', 'port': 3000,
            },
        ]

    def test_reject_disallowed_type(self):
        self.add_permissions('netbox_service_canvas.add_serviceconnection')
        data = dict(self.create_data[0], source_type='dcim.site')
        response = self.client.post(self._get_list_url(), data, format='json', **self.header)
        self.assertHttpStatus(response, status.HTTP_400_BAD_REQUEST)

    def test_reject_source_equals_target(self):
        self.add_permissions('netbox_service_canvas.add_serviceconnection')
        data = dict(self.create_data[0], target_id=self.create_data[0]['source_id'])
        response = self.client.post(self._get_list_url(), data, format='json', **self.header)
        self.assertHttpStatus(response, status.HTTP_400_BAD_REQUEST)


class ConnectionHopAPITest(APIViewTestCases.APIViewTestCase):
    model = ConnectionHop
    view_namespace = NAMESPACE
    brief_fields = ['display', 'id', 'note', 'object_id', 'object_type', 'order', 'url']
    graphql_base_name = 'service_canvas_connection_hop'
    bulk_update_data = {
        'note': 'updated',
    }

    @classmethod
    def setUpTestData(cls):
        o = create_base_objects()
        vrfs = [VRF.objects.create(name=f'VRF {i}') for i in range(1, 7)]
        connection = create_connection(o['speedtest'], o['grafana'])
        other = create_connection(o['prometheus'], o['grafana'])
        for i, vrf in enumerate(vrfs[:3], start=1):
            ConnectionHop.objects.create(connection=connection, order=i, object=vrf)
        cls.create_data = [
            {'connection': other.pk, 'order': 1, 'object_type': 'ipam.service', 'object_id': o['traefik'].pk},
            {'connection': other.pk, 'order': 2, 'object_type': 'ipam.vrf', 'object_id': vrfs[3].pk},
            # no order given: appended
            {'connection': other.pk, 'object_type': 'ipam.vrf', 'object_id': vrfs[4].pk, 'note': 'append'},
        ]


class CanvasAPITest(APIViewTestCases.APIViewTestCase):
    model = Canvas
    view_namespace = NAMESPACE
    brief_fields = ['description', 'display', 'id', 'name', 'url']
    graphql_base_name = 'service_canvas_canvas'
    create_data = [
        {'name': 'Canvas 4'},
        {'name': 'Canvas 5', 'description': 'Storage'},
        {'name': 'Canvas 6'},
    ]
    bulk_update_data = {
        'description': 'New description',
    }

    @classmethod
    def setUpTestData(cls):
        Canvas.objects.bulk_create([Canvas(name=f'Canvas {i}') for i in range(1, 4)])


class CanvasLayoutAPITest(APITestCase):
    """
    PUT /api/plugins/service-canvas/canvases/<id>/layout/
    """

    @classmethod
    def setUpTestData(cls):
        cls.o = create_base_objects()
        cls.canvas = Canvas.objects.create(name='Homelab')
        cls.node = CanvasNode.objects.create(canvas=cls.canvas, object=cls.o['device1'], x=0, y=0)

    def url(self):
        return reverse(f'{NAMESPACE}-api:canvas-layout', kwargs={'pk': self.canvas.pk})

    def grant_all(self):
        self.add_permissions(
            'netbox_service_canvas.view_canvas', 'netbox_service_canvas.change_canvas',
            'netbox_service_canvas.add_canvasnode', 'netbox_service_canvas.change_canvasnode',
            'netbox_service_canvas.delete_canvasnode', 'netbox_service_canvas.view_canvasnode',
            'netbox_service_canvas.add_canvasgroup', 'netbox_service_canvas.change_canvasgroup',
            'netbox_service_canvas.delete_canvasgroup', 'netbox_service_canvas.view_canvasgroup',
        )

    def test_get_layout(self):
        self.add_permissions('netbox_service_canvas.view_canvas')
        response = self.client.get(self.url(), **self.header)
        self.assertHttpStatus(response, status.HTTP_200_OK)
        self.assertEqual(response.data['nodes'][0]['object_type'], 'dcim.device')

    def test_put_requires_change_permission(self):
        self.add_permissions('netbox_service_canvas.view_canvas')
        response = self.client.put(self.url(), {'nodes': []}, format='json', **self.header)
        self.assertHttpStatus(response, status.HTTP_404_NOT_FOUND)

    def test_put_requires_node_permission(self):
        self.add_permissions('netbox_service_canvas.view_canvas', 'netbox_service_canvas.change_canvas')
        payload = {'nodes': [{'id': self.node.pk, 'x': 100, 'y': 100}]}
        response = self.client.put(self.url(), payload, format='json', **self.header)
        self.assertHttpStatus(response, status.HTTP_403_FORBIDDEN)

    def test_put_creates_updates_and_groups(self):
        self.grant_all()
        payload = {
            'groups': [{'key': 'g1', 'name': 'Proxmox', 'color': 'ff0000', 'x': 0, 'y': 0, 'width': 500,
                        'height': 300}],
            'nodes': [
                {'id': self.node.pk, 'x': 103, 'y': 47, 'group_key': 'g1'},
                {'object_type': 'ipam.service', 'object_id': self.o['grafana'].pk, 'x': 200, 'y': 200},
            ],
        }
        response = self.client.put(self.url(), payload, format='json', **self.header)
        self.assertHttpStatus(response, status.HTTP_200_OK)
        self.node.refresh_from_db()
        # Snapped to the 10px grid
        self.assertEqual((self.node.x, self.node.y), (100, 50))
        group = CanvasGroup.objects.get(canvas=self.canvas)
        self.assertEqual(self.node.group, group)
        self.assertEqual(response.data['created_groups'], {'g1': group.pk})
        self.assertEqual(self.canvas.nodes.count(), 2)

    def test_unchanged_nodes_are_not_written(self):
        """Autosave must not flood the changelog: unchanged rows produce no ObjectChange."""
        self.grant_all()
        payload = {'nodes': [{'id': self.node.pk, 'x': 0, 'y': 0}]}
        before = ObjectChange.objects.count()
        response = self.client.put(self.url(), payload, format='json', **self.header)
        self.assertHttpStatus(response, status.HTTP_200_OK)
        self.assertEqual(response.data['updated'], 0)
        self.assertEqual(ObjectChange.objects.count(), before)

    def test_changed_node_is_change_logged_with_snapshot(self):
        self.grant_all()
        payload = {'nodes': [{'id': self.node.pk, 'x': 300, 'y': 0}]}
        self.client.put(self.url(), payload, format='json', **self.header)
        change = ObjectChange.objects.get(
            changed_object_type=ContentType.objects.get_for_model(CanvasNode), changed_object_id=self.node.pk,
        )
        self.assertEqual(change.prechange_data['x'], 0)
        self.assertEqual(change.postchange_data['x'], 300)

    def test_delete_nodes(self):
        self.grant_all()
        payload = {'deleted_nodes': [self.node.pk]}
        response = self.client.put(self.url(), payload, format='json', **self.header)
        self.assertHttpStatus(response, status.HTTP_200_OK)
        self.assertFalse(CanvasNode.objects.filter(pk=self.node.pk).exists())

    def test_invalid_payload_is_atomic(self):
        self.grant_all()
        payload = {'nodes': [
            {'id': self.node.pk, 'x': 500, 'y': 500},
            {'object_type': 'dcim.device', 'object_id': 999999, 'x': 0, 'y': 0},
        ]}
        response = self.client.put(self.url(), payload, format='json', **self.header)
        self.assertHttpStatus(response, status.HTTP_400_BAD_REQUEST)
        self.node.refresh_from_db()
        self.assertEqual(self.node.x, 0)

    def test_node_of_other_canvas_rejected(self):
        self.grant_all()
        other = Canvas.objects.create(name='Other')
        foreign = CanvasNode.objects.create(canvas=other, object=self.o['device2'])
        payload = {'nodes': [{'id': foreign.pk, 'x': 10, 'y': 10}]}
        response = self.client.put(self.url(), payload, format='json', **self.header)
        self.assertHttpStatus(response, status.HTTP_400_BAD_REQUEST)

    def test_object_permission_constraint(self):
        """Constrained permissions (e.g. only one canvas) are enforced."""
        self.add_permissions('netbox_service_canvas.view_canvas')
        perm = ObjectPermission(name='only-other', actions=['change'], constraints={'name': 'Other'})
        perm.save()
        perm.users.add(self.user)
        perm.object_types.add(ContentType.objects.get_for_model(Canvas))
        response = self.client.put(self.url(), {'nodes': []}, format='json', **self.header)
        self.assertHttpStatus(response, status.HTTP_404_NOT_FOUND)

    def test_group_membership_kept_when_omitted(self):
        self.grant_all()
        group = CanvasGroup.objects.create(canvas=self.canvas, name='G', x=0, y=0, width=300, height=200)
        CanvasNode.objects.filter(pk=self.node.pk).update(group=group)
        response = self.client.put(
            self.url(), {'nodes': [{'id': self.node.pk, 'x': 20, 'y': 20}]}, format='json', **self.header
        )
        self.assertHttpStatus(response, status.HTTP_200_OK)
        self.node.refresh_from_db()
        self.assertEqual(self.node.group, group)
        # An explicit null removes the node from its group
        response = self.client.put(
            self.url(), {'nodes': [{'id': self.node.pk, 'x': 20, 'y': 20, 'group': None}]}, format='json',
            **self.header,
        )
        self.assertHttpStatus(response, status.HTTP_200_OK)
        self.node.refresh_from_db()
        self.assertIsNone(self.node.group)


class CanvasGraphAPITest(APITestCase):
    """
    GET /api/plugins/service-canvas/canvases/<id>/graph/ and .../missing/
    """

    @classmethod
    def setUpTestData(cls):
        cls.o = create_base_objects()
        cls.canvas = Canvas.objects.create(name='Homelab')
        for key in ('device1', 'speedtest', 'grafana'):
            CanvasNode.objects.create(canvas=cls.canvas, object=cls.o[key], x=0, y=0)
        cls.flow = create_connection(cls.o['speedtest'], cls.o['grafana'], port=3000)
        # Not shown by default: prometheus is not on the canvas
        create_connection(cls.o['grafana'], cls.o['prometheus'], port=9090)

    def graph_url(self, action='graph'):
        return reverse(f'{NAMESPACE}-api:canvas-{action}', kwargs={'pk': self.canvas.pk})

    def grant_view(self):
        self.add_permissions(
            'netbox_service_canvas.view_canvas', 'netbox_service_canvas.view_serviceconnection',
            'dcim.view_device', 'ipam.view_service', 'virtualization.view_virtualmachine',
        )

    def test_graph(self):
        self.grant_view()
        response = self.client.get(self.graph_url(), **self.header)
        self.assertHttpStatus(response, status.HTTP_200_OK)
        speedtest = f"ipam.service:{self.o['speedtest'].pk}"
        device1 = f"dcim.device:{self.o['device1'].pk}"
        self.assertEqual(set(response.data['objects']), {
            device1, speedtest, f"ipam.service:{self.o['grafana'].pk}",
        })
        desc = response.data['objects'][speedtest]
        self.assertEqual(desc['type'], 'service')
        self.assertEqual(desc['service']['parent_key'], device1)
        self.assertEqual(desc['service']['ports'], [80])
        # Services take the status of their parent
        self.assertEqual(desc['status']['value'], self.o['device1'].status)
        self.assertEqual(response.data['edges']['runs_on'], [
            {'id': f'runs_on:{speedtest}', 'source': speedtest, 'target': device1},
        ])
        flows = response.data['edges']['flows']
        self.assertEqual([f['id'] for f in flows], [self.flow.pk])
        self.assertEqual(flows[0]['port'], 3000)
        self.assertEqual(flows[0]['hop_count'], 0)

    def test_graph_include_unsaved(self):
        self.grant_view()
        prometheus = f"ipam.service:{self.o['prometheus'].pk}"
        response = self.client.get(self.graph_url() + f'?include={prometheus},bogus:1', **self.header)
        self.assertHttpStatus(response, status.HTTP_200_OK)
        self.assertIn(prometheus, response.data['objects'])
        self.assertEqual(len(response.data['edges']['flows']), 2)

    def test_graph_respects_object_permissions(self):
        self.add_permissions(
            'netbox_service_canvas.view_canvas', 'netbox_service_canvas.view_serviceconnection', 'ipam.view_service',
        )
        response = self.client.get(self.graph_url(), **self.header)
        self.assertHttpStatus(response, status.HTTP_200_OK)
        # Devices are not viewable -> no descriptor and no runs_on edge
        self.assertNotIn(f"dcim.device:{self.o['device1'].pk}", response.data['objects'])
        self.assertEqual(response.data['edges']['runs_on'], [])

    def test_graph_requires_canvas_permission(self):
        response = self.client.get(self.graph_url(), **self.header)
        self.assertHttpStatus(response, status.HTTP_403_FORBIDDEN)

    def test_missing(self):
        self.grant_view()
        response = self.client.get(self.graph_url('missing'), **self.header)
        self.assertHttpStatus(response, status.HTTP_200_OK)
        self.assertEqual(set(response.data['objects']), {
            f"ipam.service:{self.o['traefik'].pk}",      # runs on device1
            f"dcim.device:{self.o['device2'].pk}",       # parent of grafana
            f"ipam.service:{self.o['prometheus'].pk}",   # connected to grafana
        })


class ReorderHopsAPITest(APITestCase):
    """
    POST /api/plugins/service-canvas/connections/<id>/reorder-hops/
    """

    @classmethod
    def setUpTestData(cls):
        o = create_base_objects()
        cls.connection = create_connection(o['speedtest'], o['grafana'])
        vrfs = [VRF.objects.create(name=f'VRF {i}') for i in range(3)]
        cls.hops = [
            ConnectionHop.objects.create(connection=cls.connection, order=i + 1, object=vrf)
            for i, vrf in enumerate(vrfs)
        ]

    def url(self):
        return reverse(f'{NAMESPACE}-api:serviceconnection-reorder-hops', kwargs={'pk': self.connection.pk})

    def test_reorder(self):
        self.add_permissions(
            'netbox_service_canvas.view_serviceconnection', 'netbox_service_canvas.change_connectionhop',
        )
        new_order = [self.hops[2].pk, self.hops[0].pk, self.hops[1].pk]
        response = self.client.post(self.url(), {'hops': new_order}, format='json', **self.header)
        self.assertHttpStatus(response, status.HTTP_200_OK)
        self.assertEqual([h['id'] for h in response.data], new_order)
        stored = ConnectionHop.objects.filter(connection=self.connection).order_by('order')
        self.assertEqual(list(stored.values_list('pk', flat=True)), new_order)
        # Every moved hop is change-logged
        self.assertEqual(ObjectChange.objects.filter(
            changed_object_type=ContentType.objects.get_for_model(ConnectionHop)).count(), 3)

    def test_reorder_requires_all_hops(self):
        self.add_permissions(
            'netbox_service_canvas.view_serviceconnection', 'netbox_service_canvas.change_connectionhop',
        )
        response = self.client.post(self.url(), {'hops': [self.hops[0].pk]}, format='json', **self.header)
        self.assertHttpStatus(response, status.HTTP_400_BAD_REQUEST)

    def test_reorder_requires_change_permission(self):
        self.add_permissions('netbox_service_canvas.view_serviceconnection')
        response = self.client.post(
            self.url(), {'hops': [h.pk for h in reversed(self.hops)]}, format='json', **self.header
        )
        self.assertHttpStatus(response, status.HTTP_403_FORBIDDEN)
