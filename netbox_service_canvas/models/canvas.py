from django.contrib.contenttypes.fields import GenericForeignKey
from django.core.exceptions import ValidationError
from django.db import models
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from netbox.models import ChangeLoggedModel, PrimaryModel
from utilities.fields import ColorField

from ..constants import CANVAS_NODE_MODELS
from .connections import _validate_object_type

__all__ = (
    'Canvas',
    'CanvasGroup',
    'CanvasNode',
    'CanvasNote',
)


class Canvas(PrimaryModel):
    """
    A named layout of services, devices and virtual machines. A canvas stores only placement; relationships shown on
    it (Service.parent and ServiceConnections) are regular NetBox data.
    """
    name = models.CharField(
        verbose_name=_('name'),
        max_length=100,
        unique=True,
    )
    site = models.ForeignKey(
        to='dcim.Site',
        on_delete=models.SET_NULL,
        related_name='+',
        blank=True,
        null=True,
        verbose_name=_('site'),
        help_text=_('Optional: limit the sidebar search and "add missing" to this site'),
    )
    cluster = models.ForeignKey(
        to='virtualization.Cluster',
        on_delete=models.SET_NULL,
        related_name='+',
        blank=True,
        null=True,
        verbose_name=_('cluster'),
        help_text=_('Optional: limit the sidebar search and "add missing" to this cluster'),
    )

    clone_fields = ('site', 'cluster')

    class Meta:
        ordering = ('name',)
        verbose_name = _('canvas')
        verbose_name_plural = _('canvases')

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('plugins:netbox_service_canvas:canvas', args=[self.pk])


#
# Layout models
#
# CanvasGroup and CanvasNode are deliberately lean (no tags, custom fields or journal), but they DO inherit
# ChangeLoggingMixin: they hold a foreign key to Canvas, and netbox-branching requires every model related to a
# branch-aware model to be branch-aware itself, which in turn requires change logging. Changelog volume is kept low
# by the bulk layout endpoint, which only saves rows whose geometry actually changed.
#

class CanvasGroup(ChangeLoggedModel):
    """
    A visual container on a canvas (e.g. "Proxmox", "Storage").
    """
    canvas = models.ForeignKey(
        to='netbox_service_canvas.Canvas',
        on_delete=models.CASCADE,
        related_name='groups',
        verbose_name=_('canvas'),
    )
    name = models.CharField(
        verbose_name=_('name'),
        max_length=100,
    )
    color = ColorField(
        verbose_name=_('color'),
        default='607d8b',
    )
    x = models.FloatField(default=0)
    y = models.FloatField(default=0)
    width = models.FloatField(default=400)
    height = models.FloatField(default=300)
    site = models.ForeignKey(
        to='dcim.Site',
        on_delete=models.SET_NULL,
        related_name='+',
        blank=True,
        null=True,
        verbose_name=_('site'),
        help_text=_('Auto-fill: objects of this site'),
    )
    cluster = models.ForeignKey(
        to='virtualization.Cluster',
        on_delete=models.SET_NULL,
        related_name='+',
        blank=True,
        null=True,
        verbose_name=_('cluster'),
        help_text=_('Auto-fill: virtual machines of this cluster'),
    )
    tag = models.ForeignKey(
        to='extras.Tag',
        on_delete=models.SET_NULL,
        related_name='+',
        blank=True,
        null=True,
        verbose_name=_('tag'),
        help_text=_('Auto-fill: objects with this tag'),
    )

    class Meta:
        ordering = ('canvas', 'name', 'pk')
        verbose_name = _('canvas group')
        verbose_name_plural = _('canvas groups')

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return self.canvas.get_absolute_url()


class CanvasNode(ChangeLoggedModel):
    """
    The placement of a Device, VirtualMachine or Service on a canvas.
    """
    canvas = models.ForeignKey(
        to='netbox_service_canvas.Canvas',
        on_delete=models.CASCADE,
        related_name='nodes',
        verbose_name=_('canvas'),
    )
    object_type = models.ForeignKey(
        to='contenttypes.ContentType',
        on_delete=models.PROTECT,
        related_name='+',
        limit_choices_to=CANVAS_NODE_MODELS,
        verbose_name=_('object type'),
    )
    object_id = models.PositiveBigIntegerField(
        verbose_name=_('object ID'),
    )
    object = GenericForeignKey(
        ct_field='object_type',
        fk_field='object_id',
    )
    x = models.FloatField(default=0)
    y = models.FloatField(default=0)
    width = models.FloatField(blank=True, null=True)
    height = models.FloatField(blank=True, null=True)
    group = models.ForeignKey(
        to='netbox_service_canvas.CanvasGroup',
        on_delete=models.SET_NULL,
        related_name='nodes',
        blank=True,
        null=True,
        verbose_name=_('group'),
    )

    class Meta:
        ordering = ('canvas', 'pk')
        indexes = (
            models.Index(fields=('object_type', 'object_id')),
        )
        constraints = (
            models.UniqueConstraint(
                fields=('canvas', 'object_type', 'object_id'),
                name='%(app_label)s_%(class)s_unique_canvas_object',
                violation_error_message=_('This object is already placed on the canvas.'),
            ),
        )
        verbose_name = _('canvas node')
        verbose_name_plural = _('canvas nodes')

    def __str__(self):
        return f'{self.canvas}: {self.object or "?"}'

    def get_absolute_url(self):
        return self.canvas.get_absolute_url()

    def clean(self):
        _validate_object_type(self, 'object_type', CANVAS_NODE_MODELS)
        super().clean()
        if self.group_id and self.canvas_id and self.group.canvas_id != self.canvas_id:
            raise ValidationError({'group': _('The group belongs to a different canvas.')})


class CanvasNote(ChangeLoggedModel):
    """
    A free-text sticky note on a canvas (hints, TODOs). Like groups and nodes it is layout data and change-logged.
    """
    canvas = models.ForeignKey(
        to='netbox_service_canvas.Canvas',
        on_delete=models.CASCADE,
        related_name='notes',
        verbose_name=_('canvas'),
    )
    text = models.TextField(
        verbose_name=_('text'),
        blank=True,
    )
    color = ColorField(
        verbose_name=_('color'),
        default='ffe082',
    )
    x = models.FloatField(default=0)
    y = models.FloatField(default=0)
    width = models.FloatField(default=220)
    height = models.FloatField(default=140)

    class Meta:
        ordering = ('canvas', 'pk')
        verbose_name = _('canvas note')
        verbose_name_plural = _('canvas notes')

    def __str__(self):
        first_line = (self.text or '').strip().splitlines()[0] if (self.text or '').strip() else ''
        return first_line[:50] or f'{_("Note")} #{self.pk}'

    def get_absolute_url(self):
        return self.canvas.get_absolute_url()
