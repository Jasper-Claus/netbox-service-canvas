from netbox.search import SearchIndex

from .models import Canvas, ServiceConnection


class CanvasIndex(SearchIndex):
    model = Canvas
    fields = (
        ('name', 100),
        ('description', 500),
        ('comments', 5000),
    )
    display_attrs = ('site', 'cluster', 'description')


class ServiceConnectionIndex(SearchIndex):
    model = ServiceConnection
    fields = (
        ('data_description', 300),
        ('description', 500),
        ('comments', 5000),
    )
    display_attrs = ('protocol', 'port', 'status', 'description')


indexes = [CanvasIndex, ServiceConnectionIndex]
