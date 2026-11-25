import strawberry
import strawberry_django

from .types import CanvasGroupType, CanvasNodeType, CanvasType, ConnectionHopType, ServiceConnectionType


@strawberry.type(name='Query')
class ServiceCanvasQuery:
    service_canvas_connection: ServiceConnectionType = strawberry_django.field()
    service_canvas_connection_list: list[ServiceConnectionType] = strawberry_django.field()

    service_canvas_connection_hop: ConnectionHopType = strawberry_django.field()
    service_canvas_connection_hop_list: list[ConnectionHopType] = strawberry_django.field()

    service_canvas_canvas: CanvasType = strawberry_django.field()
    service_canvas_canvas_list: list[CanvasType] = strawberry_django.field()

    service_canvas_group: CanvasGroupType = strawberry_django.field()
    service_canvas_group_list: list[CanvasGroupType] = strawberry_django.field()

    service_canvas_node: CanvasNodeType = strawberry_django.field()
    service_canvas_node_list: list[CanvasNodeType] = strawberry_django.field()


schema = [ServiceCanvasQuery]
