from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Deferrable, F, Q
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from netbox.models import NetBoxModel, PrimaryModel

from ..choices import ConnectionDirectionChoices, ConnectionProtocolChoices, ConnectionStatusChoices
from ..constants import CONNECTION_ENDPOINT_MODELS, HOP_OBJECT_MODELS, PORT_MAX, PORT_MIN

__all__ = (
    'ConnectionHop',
    'ServiceConnection',
)


def _validate_object_type(instance, field_name, allowed_q):
    """
    Raise a ValidationError if the ContentType assigned to `field_name` is not matched by `allowed_q`.
    """
    ct_id = getattr(instance, f'{field_name}_id', None)
    if ct_id and not ContentType.objects.filter(allowed_q, pk=ct_id).exists():
        raise ValidationError({
            field_name: _('Objects of this type are not permitted here.')
        })


class ServiceConnection(PrimaryModel):
    """
    A logical communication flow between two endpoints (normally Service → Service). "Who talks to whom,
    over which protocol, carrying which data". The path it takes is described by ordered ConnectionHops.
    """
    source_type = models.ForeignKey(
        to='contenttypes.ContentType',
        on_delete=models.PROTECT,
        related_name='+',
        limit_choices_to=CONNECTION_ENDPOINT_MODELS,
        verbose_name=_('source type'),
    )
    source_id = models.PositiveBigIntegerField(
        verbose_name=_('source ID'),
    )
    source = GenericForeignKey(
        ct_field='source_type',
        fk_field='source_id',
    )
    target_type = models.ForeignKey(
        to='contenttypes.ContentType',
        on_delete=models.PROTECT,
        related_name='+',
        limit_choices_to=CONNECTION_ENDPOINT_MODELS,
        verbose_name=_('target type'),
    )
    target_id = models.PositiveBigIntegerField(
        verbose_name=_('target ID'),
    )
    target = GenericForeignKey(
        ct_field='target_type',
        fk_field='target_id',
    )
    direction = models.CharField(
        verbose_name=_('direction'),
        max_length=10,
        choices=ConnectionDirectionChoices,
        default=ConnectionDirectionChoices.DIRECTION_UNI,
    )
    protocol = models.CharField(
        verbose_name=_('protocol'),
        max_length=20,
        choices=ConnectionProtocolChoices,
    )
    port = models.PositiveIntegerField(
        verbose_name=_('port'),
        blank=True,
        null=True,
        validators=[MinValueValidator(PORT_MIN), MaxValueValidator(PORT_MAX)],
    )
    data_description = models.CharField(
        verbose_name=_('data'),
        max_length=200,
        blank=True,
        help_text=_('What is transferred, e.g. "metrics" or "backups"'),
    )
    status = models.CharField(
        verbose_name=_('status'),
        max_length=20,
        choices=ConnectionStatusChoices,
        default=ConnectionStatusChoices.STATUS_ACTIVE,
    )

    clone_fields = (
        'source_type', 'source_id', 'target_type', 'direction', 'protocol', 'port', 'data_description', 'status',
    )

    class Meta:
        ordering = ('pk',)
        indexes = (
            models.Index(fields=('source_type', 'source_id')),
            models.Index(fields=('target_type', 'target_id')),
        )
        constraints = (
            models.CheckConstraint(
                condition=~Q(source_type=F('target_type'), source_id=F('target_id')),
                name='%(app_label)s_%(class)s_source_not_target',
                violation_error_message=_('Source and target must be different objects.'),
            ),
        )
        verbose_name = _('service connection')
        verbose_name_plural = _('service connections')

    def __str__(self):
        arrow = '↔' if self.direction == ConnectionDirectionChoices.DIRECTION_BI else '→'
        return f'{self.source or "?"} {arrow} {self.target or "?"}'

    def get_absolute_url(self):
        return reverse('plugins:netbox_service_canvas:serviceconnection', args=[self.pk])

    def get_status_color(self):
        return ConnectionStatusChoices.colors.get(self.status)

    def clean(self):
        _validate_object_type(self, 'source_type', CONNECTION_ENDPOINT_MODELS)
        _validate_object_type(self, 'target_type', CONNECTION_ENDPOINT_MODELS)

        # Validates that both GFK targets exist (NetBox BaseModel.clean)
        super().clean()

        if (
            self.source_type_id and self.source_type_id == self.target_type_id and
            self.source_id and self.source_id == self.target_id
        ):
            raise ValidationError(_('Source and target must be different objects.'))

    @property
    def is_planned(self):
        return self.status == ConnectionStatusChoices.STATUS_PLANNED

    @staticmethod
    def endpoint_q(obj):
        """
        Return a Q object matching all connections where `obj` is either source or target.
        """
        ct = ContentType.objects.get_for_model(obj)
        return Q(source_type=ct, source_id=obj.pk) | Q(target_type=ct, target_id=obj.pk)


class ConnectionHop(NetBoxModel):
    """
    One intermediate station of a ServiceConnection ("via"), e.g. a reverse proxy, a VRF or a tunnel.
    Hops are ordered 1..n within their connection.
    """
    connection = models.ForeignKey(
        to='netbox_service_canvas.ServiceConnection',
        on_delete=models.CASCADE,
        related_name='hops',
        verbose_name=_('connection'),
    )
    order = models.PositiveSmallIntegerField(
        verbose_name=_('order'),
        default=1,
        validators=[MinValueValidator(1)],
    )
    object_type = models.ForeignKey(
        to='contenttypes.ContentType',
        on_delete=models.PROTECT,
        related_name='+',
        limit_choices_to=HOP_OBJECT_MODELS,
        verbose_name=_('object type'),
    )
    object_id = models.PositiveBigIntegerField(
        verbose_name=_('object ID'),
    )
    object = GenericForeignKey(
        ct_field='object_type',
        fk_field='object_id',
    )
    note = models.CharField(
        verbose_name=_('note'),
        max_length=200,
        blank=True,
    )

    clone_fields = ('connection', 'object_type')

    class Meta:
        ordering = ('connection', 'order', 'pk')
        indexes = (
            models.Index(fields=('object_type', 'object_id')),
        )
        constraints = (
            # Deferred, so that hops can be reordered within a single transaction
            models.UniqueConstraint(
                fields=('connection', 'order'),
                name='%(app_label)s_%(class)s_unique_connection_order',
                deferrable=Deferrable.DEFERRED,
                violation_error_message=_('Hop order must be unique per connection.'),
            ),
        )
        verbose_name = _('connection hop')
        verbose_name_plural = _('connection hops')

    def __str__(self):
        return f'#{self.order} {self.object or "?"}'

    def get_absolute_url(self):
        return reverse('plugins:netbox_service_canvas:connectionhop', args=[self.pk])

    def clean(self):
        _validate_object_type(self, 'object_type', HOP_OBJECT_MODELS)
        super().clean()

        # Deferred unique constraints are not checked by Django's model validation, so check explicitly to
        # report a validation error instead of failing at commit time.
        if self.connection_id and self.order:
            duplicate = ConnectionHop.objects.filter(connection_id=self.connection_id, order=self.order) \
                .exclude(pk=self.pk).exists()
            if duplicate:
                raise ValidationError({'order': _('This connection already has a hop at this position.')})

    @classmethod
    def renumber(cls, connection_id):
        """
        Compact the order values of a connection's hops to 1..n, keeping their relative order. Each changed hop is
        saved individually (with a pre-change snapshot) so that the change is recorded in the changelog, which is
        also what netbox-branching relies on. Compacting upwards never collides with an existing order value.
        """
        hops = cls.objects.filter(connection_id=connection_id).order_by('order', 'pk')
        for index, hop in enumerate(hops, start=1):
            if hop.order != index:
                hop.snapshot()
                hop.order = index
                hop.save()
