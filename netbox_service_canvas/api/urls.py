from netbox.api.routers import NetBoxRouter

from . import views

app_name = 'netbox_service_canvas-api'

router = NetBoxRouter()
router.APIRootView = views.ServiceCanvasRootView

router.register('applications', views.ApplicationViewSet)
router.register('canvases', views.CanvasViewSet)
router.register('canvas-groups', views.CanvasGroupViewSet)
router.register('canvas-nodes', views.CanvasNodeViewSet)
router.register('canvas-notes', views.CanvasNoteViewSet)
router.register('connections', views.ServiceConnectionViewSet)
router.register('connection-hops', views.ConnectionHopViewSet)

urlpatterns = router.urls
