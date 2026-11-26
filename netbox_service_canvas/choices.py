from django.utils.translation import gettext_lazy as _

from utilities.choices import ChoiceSet


class ConnectionDirectionChoices(ChoiceSet):
    DIRECTION_UNI = 'uni'
    DIRECTION_BI = 'bi'

    CHOICES = (
        (DIRECTION_UNI, _('Unidirectional')),
        (DIRECTION_BI, _('Bidirectional')),
    )


class ConnectionProtocolChoices(ChoiceSet):
    PROTOCOL_TCP = 'tcp'
    PROTOCOL_UDP = 'udp'
    PROTOCOL_HTTP = 'http'
    PROTOCOL_HTTPS = 'https'
    PROTOCOL_MQTT = 'mqtt'
    PROTOCOL_GRPC = 'grpc'
    PROTOCOL_SMB = 'smb'
    PROTOCOL_NFS = 'nfs'
    PROTOCOL_OTHER = 'other'

    CHOICES = (
        (PROTOCOL_TCP, 'TCP'),
        (PROTOCOL_UDP, 'UDP'),
        (PROTOCOL_HTTP, 'HTTP'),
        (PROTOCOL_HTTPS, 'HTTPS'),
        (PROTOCOL_MQTT, 'MQTT'),
        (PROTOCOL_GRPC, 'gRPC'),
        (PROTOCOL_SMB, 'SMB'),
        (PROTOCOL_NFS, 'NFS'),
        (PROTOCOL_OTHER, _('Other')),
    )


class ConnectionStatusChoices(ChoiceSet):
    key = 'ServiceConnection.status'

    STATUS_ACTIVE = 'active'
    STATUS_PLANNED = 'planned'
    STATUS_DISABLED = 'disabled'

    CHOICES = [
        (STATUS_ACTIVE, _('Active'), 'green'),
        (STATUS_PLANNED, _('Planned'), 'cyan'),
        (STATUS_DISABLED, _('Disabled'), 'gray'),
    ]


class ApplicationStatusChoices(ChoiceSet):
    key = 'Application.status'

    STATUS_ACTIVE = 'active'
    STATUS_PLANNED = 'planned'
    STATUS_STAGING = 'staging'
    STATUS_DECOMMISSIONING = 'decommissioning'
    STATUS_OFFLINE = 'offline'

    CHOICES = [
        (STATUS_ACTIVE, _('Active'), 'green'),
        (STATUS_PLANNED, _('Planned'), 'cyan'),
        (STATUS_STAGING, _('Staging'), 'blue'),
        (STATUS_DECOMMISSIONING, _('Decommissioning'), 'yellow'),
        (STATUS_OFFLINE, _('Offline'), 'gray'),
    ]


class ConnectionKindChoices(ChoiceSet):
    """
    How a connection affects the impact analysis.
      * uses:  the source needs the target (default). If the target fails, the source is affected.
      * proxy: the target is reached through the source (reverse proxy, load balancer, gateway). If the source fails,
               the target is no longer reachable.
    """
    KIND_USES = 'uses'
    KIND_PROXY = 'proxy'

    CHOICES = (
        (KIND_USES, _('Uses (source needs target)')),
        (KIND_PROXY, _('Proxy (target is reached through source)')),
    )


class ApplicationIconChoices(ChoiceSet):
    """
    Icons for applications on the canvas (Material Design Icons, bundled with NetBox).
    """
    CHOICES = (
        ('mdi-apps', _('Application')),
        ('mdi-web', _('Web app')),
        ('mdi-database', _('Database')),
        ('mdi-chart-line', _('Monitoring')),
        ('mdi-file-document-outline', _('Logs')),
        ('mdi-swap-horizontal', _('Reverse proxy')),
        ('mdi-dns', _('DNS')),
        ('mdi-shield-lock-outline', _('Security')),
        ('mdi-account-key-outline', _('Authentication')),
        ('mdi-harddisk', _('Storage')),
        ('mdi-backup-restore', _('Backup')),
        ('mdi-email-outline', _('Mail')),
        ('mdi-message-text-outline', _('Chat')),
        ('mdi-image-multiple-outline', _('Photos')),
        ('mdi-filmstrip', _('Media')),
        ('mdi-music', _('Music')),
        ('mdi-file-document-multiple-outline', _('Documents')),
        ('mdi-home-automation', _('Home automation')),
        ('mdi-docker', _('Containers')),
        ('mdi-source-branch', _('Code')),
        ('mdi-download', _('Downloads')),
        ('mdi-vpn', _('VPN')),
        ('mdi-printer', _('Printing')),
        ('mdi-cog-outline', _('Tool')),
    )
