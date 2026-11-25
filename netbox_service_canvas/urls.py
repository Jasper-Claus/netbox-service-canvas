from django.urls import include, path

from utilities.urls import get_model_urls

from . import views  # noqa: F401  (registers the model views)

app_name = 'netbox_service_canvas'

urlpatterns = (
    path('canvases/', include(get_model_urls('netbox_service_canvas', 'canvas', detail=False))),
    path('canvases/<int:pk>/', include(get_model_urls('netbox_service_canvas', 'canvas'))),

    path('connections/', include(get_model_urls('netbox_service_canvas', 'serviceconnection', detail=False))),
    path('connections/<int:pk>/', include(get_model_urls('netbox_service_canvas', 'serviceconnection'))),

    path('hops/', include(get_model_urls('netbox_service_canvas', 'connectionhop', detail=False))),
    path('hops/<int:pk>/', include(get_model_urls('netbox_service_canvas', 'connectionhop'))),
)
