import strawberry
import strawberry_django

from .types import (
    ApplicationType,
    CanvasGroupType,
    CanvasNodeType,
    CanvasNoteType,
    CanvasType,
    ConnectionHopType,
    ServiceConnectionType,
)


@strawberry.type(name='Query')
class ServiceCanvasQuery:
    service_canvas_application: ApplicationType = strawberry_django.field()
    service_canvas_application_list: list[ApplicationType] = strawberry_django.field()

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

    service_canvas_note: CanvasNoteType = strawberry_django.field()
    service_canvas_note_list: list[CanvasNoteType] = strawberry_django.field()


schema = [ServiceCanvasQuery]
