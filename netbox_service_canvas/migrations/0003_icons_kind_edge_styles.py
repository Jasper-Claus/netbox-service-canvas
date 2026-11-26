from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('netbox_service_canvas', '0002_applications_notes'),
    ]

    operations = [
        migrations.AddField(
            model_name='application',
            name='icon',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='serviceconnection',
            name='kind',
            field=models.CharField(default='uses', max_length=10),
        ),
        migrations.AddField(
            model_name='canvas',
            name='edge_styles',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
