// Mirrors netbox_service_canvas/choices.py. Labels are English source texts; translate them with t() when rendering.
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
  ['uni', 'Unidirectional (source → target)'],
  ['bi', 'Bidirectional'],
];

/** How a connection counts in the impact analysis (ServiceConnection.kind). */
export const KINDS: Array<[string, string]> = [
  ['uses', 'Uses (source needs target)'],
  ['proxy', 'Proxy (target is reached through source)'],
];

/** Icons for applications (ApplicationIconChoices); the first one is the default. */
export const APPLICATION_ICONS: Array<[string, string]> = [
  ['mdi-apps', 'Application'],
  ['mdi-web', 'Web app'],
  ['mdi-database', 'Database'],
  ['mdi-chart-line', 'Monitoring'],
  ['mdi-file-document-outline', 'Logs'],
  ['mdi-swap-horizontal', 'Reverse proxy'],
  ['mdi-dns', 'DNS'],
  ['mdi-shield-lock-outline', 'Security'],
  ['mdi-account-key-outline', 'Authentication'],
  ['mdi-harddisk', 'Storage'],
  ['mdi-backup-restore', 'Backup'],
  ['mdi-email-outline', 'Mail'],
  ['mdi-message-text-outline', 'Chat'],
  ['mdi-image-multiple-outline', 'Photos'],
  ['mdi-filmstrip', 'Media'],
  ['mdi-music', 'Music'],
  ['mdi-file-document-multiple-outline', 'Documents'],
  ['mdi-home-automation', 'Home automation'],
  ['mdi-docker', 'Containers'],
  ['mdi-source-branch', 'Code'],
  ['mdi-download', 'Downloads'],
  ['mdi-vpn', 'VPN'],
  ['mdi-printer', 'Printing'],
  ['mdi-cog-outline', 'Tool'],
];

/** Colors offered for connection lines (rrggbb). */
export const LINE_COLORS: Array<[string, string]> = [
  ['206bc4', 'Blue'],
  ['4299e1', 'Light blue'],
  ['ae3ec9', 'Purple'],
  ['d63939', 'Red'],
  ['f76707', 'Orange'],
  ['f59f00', 'Yellow'],
  ['2fb344', 'Green'],
  ['616876', 'Gray'],
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
  { label: 'virtualization.vminterface', title: 'VM interface' },
  { label: 'ipam.vlan', title: 'VLAN' },
  { label: 'ipam.vrf', title: 'VRF' },
  { label: 'ipam.prefix', title: 'Prefix' },
  { label: 'ipam.ipaddress', title: 'IP address' },
  { label: 'vpn.tunnel', title: 'Tunnel' },
  { label: 'dcim.device', title: 'Device' },
  { label: 'virtualization.virtualmachine', title: 'Virtual machine' },
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
