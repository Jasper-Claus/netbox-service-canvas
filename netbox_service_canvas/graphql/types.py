from typing import TYPE_CHECKING, Annotated

import strawberry
import strawberry_django

from netbox.graphql.types import NetBoxObjectType, ObjectType, PrimaryObjectType

from .. import models
from .filters import CanvasFilter, CanvasGroupFilter, CanvasNodeFilter, ConnectionHopFilter, ServiceConnectionFilter

if TYPE_CHECKING:
    from dcim.graphql.types import DeviceType, InterfaceType, SiteType
    from extras.graphql.types import TagType
    from ipam.graphql.types import IPAddressType, PrefixType, ServiceType, VLANType, VRFType
    from netbox.graphql.types import ContentTypeType
    from virtualization.graphql.types import ClusterType, VirtualMachineType, VMInterfaceType
    from vpn.graphql.types import TunnelType

__all__ = (
    'CanvasGroupType',
    'CanvasNodeType',
    'CanvasType',
    'ConnectionHopType',
    'ServiceConnectionType',
)

DeviceT = Annotated['DeviceType', strawberry.lazy('dcim.graphql.types')]
VirtualMachineT = Annotated['VirtualMachineType', strawberry.lazy('virtualization.graphql.types')]
ServiceT = Annotated['ServiceType', strawberry.lazy('ipam.graphql.types')]
ContentTypeT = Annotated['ContentTypeType', strawberry.lazy('netbox.graphql.types')]

EndpointUnion = Annotated[ServiceT | DeviceT | VirtualMachineT, strawberry.union('ServiceCanvasEndpointType')]
NodeObjectUnion = Annotated[ServiceT | DeviceT | VirtualMachineT, strawberry.union('ServiceCanvasNodeObjectType')]
HopObjectUnion = Annotated[
    ServiceT
    | Annotated['InterfaceType', strawberry.lazy('dcim.graphql.types')]
    | Annotated['VMInterfaceType', strawberry.lazy('virtualization.graphql.types')]
    | Annotated['VLANType', strawberry.lazy('ipam.graphql.types')]
    | Annotated['VRFType', strawberry.lazy('ipam.graphql.types')]
    | Annotated['PrefixType', strawberry.lazy('ipam.graphql.types')]
    | Annotated['IPAddressType', strawberry.lazy('ipam.graphql.types')]
    | Annotated['TunnelType', strawberry.lazy('vpn.graphql.types')]
    | DeviceT
    | VirtualMachineT,
    strawberry.union('ServiceCanvasHopObjectType'),
]


@strawberry_django.type(models.ServiceConnection, fields='__all__', filters=ServiceConnectionFilter, pagination=True)
class ServiceConnectionType(PrimaryObjectType):
    source_type: ContentTypeT | None
    target_type: ContentTypeT | None
    hops: list[Annotated['ConnectionHopType', strawberry.lazy('netbox_service_canvas.graphql.types')]]

    @strawberry_django.field
    def source(self) -> EndpointUnion | None:
        return self.source

    @strawberry_django.field
    def target(self) -> EndpointUnion | None:
        return self.target


@strawberry_django.type(models.ConnectionHop, fields='__all__', filters=ConnectionHopFilter, pagination=True)
class ConnectionHopType(NetBoxObjectType):
    connection: Annotated['ServiceConnectionType', strawberry.lazy('netbox_service_canvas.graphql.types')]
    object_type: ContentTypeT | None

    @strawberry_django.field
    def object(self) -> HopObjectUnion | None:
        return self.object


@strawberry_django.type(models.Canvas, fields='__all__', filters=CanvasFilter, pagination=True)
class CanvasType(PrimaryObjectType):
    site: Annotated['SiteType', strawberry.lazy('dcim.graphql.types')] | None
    cluster: Annotated['ClusterType', strawberry.lazy('virtualization.graphql.types')] | None
    nodes: list[Annotated['CanvasNodeType', strawberry.lazy('netbox_service_canvas.graphql.types')]]
    groups: list[Annotated['CanvasGroupType', strawberry.lazy('netbox_service_canvas.graphql.types')]]


@strawberry_django.type(models.CanvasGroup, fields='__all__', filters=CanvasGroupFilter, pagination=True)
class CanvasGroupType(ObjectType):
    color: str
    canvas: Annotated['CanvasType', strawberry.lazy('netbox_service_canvas.graphql.types')]
    site: Annotated['SiteType', strawberry.lazy('dcim.graphql.types')] | None
    cluster: Annotated['ClusterType', strawberry.lazy('virtualization.graphql.types')] | None
    tag: Annotated['TagType', strawberry.lazy('extras.graphql.types')] | None


@strawberry_django.type(models.CanvasNode, fields='__all__', filters=CanvasNodeFilter, pagination=True)
class CanvasNodeType(ObjectType):
    canvas: Annotated['CanvasType', strawberry.lazy('netbox_service_canvas.graphql.types')]
    object_type: ContentTypeT | None
    group: Annotated['CanvasGroupType', strawberry.lazy('netbox_service_canvas.graphql.types')] | None

    @strawberry_django.field
    def object(self) -> NodeObjectUnion | None:
        return self.object

