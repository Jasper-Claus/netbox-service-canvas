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
