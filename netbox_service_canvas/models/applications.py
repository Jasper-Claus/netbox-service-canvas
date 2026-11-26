from django.db import models
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from netbox.models import PrimaryModel

from ..choices import ApplicationIconChoices, ApplicationStatusChoices

__all__ = (
    'Application',
)


class Application(PrimaryModel):
    """
    A piece of software as users know it (e.g. "Grafana", "Paperless"). An application is made up of one or more
    NetBox services; the hosts it runs on follow from those services (Service.parent). The link lives on this plugin's
    side as a many-to-many relation, so NetBox core models stay untouched.
    """
    name = models.CharField(
        verbose_name=_('name'),
        max_length=100,
        unique=True,
    )
    status = models.CharField(
        verbose_name=_('status'),
        max_length=50,
        choices=ApplicationStatusChoices,
        default=ApplicationStatusChoices.STATUS_ACTIVE,
    )
    version = models.CharField(
        verbose_name=_('version'),
        max_length=50,
        blank=True,
    )
    web_url = models.URLField(
        verbose_name=_('URL'),
        max_length=200,
        blank=True,
        help_text=_('Where users reach the application, e.g. https://grafana.example.com'),
    )
    icon = models.CharField(
        verbose_name=_('icon'),
        max_length=50,
        choices=ApplicationIconChoices,
        blank=True,
        help_text=_('Icon shown on the canvas'),
    )
    services = models.ManyToManyField(
        to='ipam.Service',
        related_name='service_canvas_applications',
        blank=True,
        verbose_name=_('services'),
    )

    clone_fields = ('status', 'version', 'icon')

    class Meta:
        ordering = ('name',)
        verbose_name = _('application')
        verbose_name_plural = _('applications')

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('plugins:netbox_service_canvas:application', args=[self.pk])

    def get_status_color(self):
        return ApplicationStatusChoices.colors.get(self.status)
