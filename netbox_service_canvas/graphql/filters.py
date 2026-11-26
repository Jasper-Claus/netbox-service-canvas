from typing import TYPE_CHECKING, Annotated

import strawberry
import strawberry_django
from strawberry.scalars import ID
from strawberry_django import StrFilterLookup

from netbox.graphql.filters import ChangeLoggedModelFilter, NetBoxModelFilter, PrimaryModelFilter

from .. import models

if TYPE_CHECKING:
    from netbox.graphql.filter_lookups import IntegerLookup

__all__ = (
    'ApplicationFilter',
    'CanvasFilter',
    'CanvasGroupFilter',
    'CanvasNodeFilter',
    'CanvasNoteFilter',
    'ConnectionHopFilter',
    'ServiceConnectionFilter',
)


@strawberry_django.filter_type(models.ServiceConnection, lookups=True)
class ServiceConnectionFilter(PrimaryModelFilter):
    source_type_id: ID | None = strawberry_django.filter_field()
    source_id: ID | None = strawberry_django.filter_field()
    target_type_id: ID | None = strawberry_django.filter_field()
    target_id: ID | None = strawberry_django.filter_field()
    direction: StrFilterLookup[str] | None = strawberry_django.filter_field()
    protocol: StrFilterLookup[str] | None = strawberry_django.filter_field()
    port: Annotated['IntegerLookup', strawberry.lazy('netbox.graphql.filter_lookups')] | None = (
        strawberry_django.filter_field()
    )
    data_description: StrFilterLookup[str] | None = strawberry_django.filter_field()
    status: StrFilterLookup[str] | None = strawberry_django.filter_field()
    kind: StrFilterLookup[str] | None = strawberry_django.filter_field()


@strawberry_django.filter_type(models.ConnectionHop, lookups=True)
class ConnectionHopFilter(NetBoxModelFilter):
    connection: (
        Annotated['ServiceConnectionFilter', strawberry.lazy('netbox_service_canvas.graphql.filters')] | None
    ) = strawberry_django.filter_field()
    connection_id: ID | None = strawberry_django.filter_field()
    order: Annotated['IntegerLookup', strawberry.lazy('netbox.graphql.filter_lookups')] | None = (
        strawberry_django.filter_field()
    )
    object_type_id: ID | None = strawberry_django.filter_field()
    object_id: ID | None = strawberry_django.filter_field()
    note: StrFilterLookup[str] | None = strawberry_django.filter_field()


@strawberry_django.filter_type(models.Canvas, lookups=True)
class CanvasFilter(PrimaryModelFilter):
    name: StrFilterLookup[str] | None = strawberry_django.filter_field()
    site_id: ID | None = strawberry_django.filter_field()
    cluster_id: ID | None = strawberry_django.filter_field()


@strawberry_django.filter_type(models.CanvasGroup, lookups=True)
class CanvasGroupFilter(ChangeLoggedModelFilter):
    canvas_id: ID | None = strawberry_django.filter_field()
    name: StrFilterLookup[str] | None = strawberry_django.filter_field()


@strawberry_django.filter_type(models.CanvasNode, lookups=True)
class CanvasNodeFilter(ChangeLoggedModelFilter):
    canvas_id: ID | None = strawberry_django.filter_field()
    object_type_id: ID | None = strawberry_django.filter_field()
    object_id: ID | None = strawberry_django.filter_field()
    group_id: ID | None = strawberry_django.filter_field()


@strawberry_django.filter_type(models.Application, lookups=True)
class ApplicationFilter(PrimaryModelFilter):
    name: StrFilterLookup[str] | None = strawberry_django.filter_field()
    status: StrFilterLookup[str] | None = strawberry_django.filter_field()
    version: StrFilterLookup[str] | None = strawberry_django.filter_field()
    icon: StrFilterLookup[str] | None = strawberry_django.filter_field()
    web_url: StrFilterLookup[str] | None = strawberry_django.filter_field()


@strawberry_django.filter_type(models.CanvasNote, lookups=True)
class CanvasNoteFilter(ChangeLoggedModelFilter):
    canvas_id: ID | None = strawberry_django.filter_field()
    text: StrFilterLookup[str] | None = strawberry_django.filter_field()
