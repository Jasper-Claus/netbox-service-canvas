// Mirrors netbox_service_canvas/choices.py
export const PROTOCOLS: Array<[string, string]> = [
  ['tcp', 'TCP'],
  ['udp', 'UDP'],
  ['http', 'HTTP'],
  ['https', 'HTTPS'],
  ['mqtt', 'MQTT'],
  ['grpc', 'gRPC'],
  ['smb', 'SMB'],
  ['nfs', 'NFS'],
  ['other', 'Other'],
];

export const DIRECTIONS: Array<[string, string]> = [
  ['uni', 'Unidirektional (Quelle → Ziel)'],
  ['bi', 'Bidirektional'],
];

export const STATUSES: Array<[string, string]> = [
  ['active', 'Active'],
  ['planned', 'Planned'],
  ['disabled', 'Disabled'],
];

export const APPLICATION_STATUSES: Array<[string, string]> = [
  ['active', 'Active'],
  ['planned', 'Planned'],
  ['staging', 'Staging'],
  ['decommissioning', 'Decommissioning'],
  ['offline', 'Offline'],
];

export const SERVICE_TRANSPORTS: Array<[string, string]> = [
  ['tcp', 'TCP'],
  ['udp', 'UDP'],
  ['sctp', 'SCTP'],
];

export const HOP_TYPES = [
  { label: 'ipam.service', title: 'Service' },
  { label: 'dcim.interface', title: 'Interface' },
  { label: 'virtualization.vminterface', title: 'VM-Interface' },
  { label: 'ipam.vlan', title: 'VLAN' },
  { label: 'ipam.vrf', title: 'VRF' },
  { label: 'ipam.prefix', title: 'Prefix' },
  { label: 'ipam.ipaddress', title: 'IP-Adresse' },
  { label: 'vpn.tunnel', title: 'Tunnel' },
  { label: 'dcim.device', title: 'Device' },
  { label: 'virtualization.virtualmachine', title: 'Virtuelle Maschine' },
];

/** Guess an application protocol from a service port. */
export function guessProtocol(port: number | undefined, transport: string | undefined): string {
  switch (port) {
    case 80:
    case 8080:
      return 'http';
    case 443:
    case 8443:
      return 'https';
    case 1883:
    case 8883:
      return 'mqtt';
    case 445:
      return 'smb';
    case 2049:
      return 'nfs';
    default:
      return transport === 'udp' ? 'udp' : 'tcp';
  }
}
