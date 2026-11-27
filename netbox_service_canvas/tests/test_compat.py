from types import SimpleNamespace

from django.test import SimpleTestCase

from utilities.testing import TestCase, create_test_device

from ..compat import service_ports
from .utils import create_service


class ServicePortsTest(SimpleTestCase):
    def test_netbox_47_single_protocol(self):
        svc = SimpleNamespace(port_mappings=['tcp/443', 'tcp/80'])
        ports = service_ports(svc)
        self.assertEqual(ports['protocol'], 'tcp')
        self.assertEqual(ports['protocol_label'], 'TCP')
        self.assertEqual(ports['ports'], [80, 443])
        self.assertEqual(ports['label'], 'TCP 80, 443')
        self.assertFalse(ports['multi_protocol'])

    def test_netbox_47_multi_protocol(self):
        svc = SimpleNamespace(port_mappings=['tcp/53', 'udp/53', 'tcp/853'])
        ports = service_ports(svc)
        self.assertEqual(ports['protocol'], '')
        self.assertEqual(ports['ports'], [53, 853])
        self.assertEqual(ports['label'], 'TCP 53, 853 · UDP 53')
        self.assertTrue(ports['multi_protocol'])

    def test_netbox_45_fields(self):
        svc = SimpleNamespace(protocol='udp', ports=[51820])
        ports = service_ports(svc)
        self.assertEqual((ports['protocol'], ports['ports'], ports['label']), ('udp', [51820], 'UDP 51820'))

    def test_no_ports(self):
        self.assertEqual(service_ports(SimpleNamespace(port_mappings=[]))['label'], '')


class ServicePortsModelTest(TestCase):
    def test_real_service(self):
        svc = create_service(create_test_device('Compat device'), 'web', 8080)
        ports = service_ports(svc)
        self.assertEqual((ports['protocol'], ports['ports'], ports['label']), ('tcp', [8080], 'TCP 8080'))
