"""
apps/products/migrations/0002_stock_distribution.py
"""

import django.core.validators
import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='StockDistribution',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4, editable=False,
                    primary_key=True, serialize=False,
                )),
                ('vehicle_number', models.CharField(
                    db_index=True,
                    help_text='Number plate of the van receiving the stock',
                    max_length=20,
                )),
                ('quantity', models.PositiveIntegerField(
                    help_text='Number of units loaded onto the van',
                    validators=[django.core.validators.MinValueValidator(1)],
                )),
                ('distributed_at', models.DateTimeField(auto_now_add=True)),
                ('notes', models.TextField(blank=True)),
                ('distributed_by', models.ForeignKey(
                    help_text='Staff member who performed the distribution',
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='stock_distributions_made',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('driver', models.ForeignKey(
                    blank=True,
                    help_text='Driver assigned to the vehicle at the time of distribution',
                    limit_choices_to={'role': 'driver'},
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='stock_distributions_received',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('product', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='distributions',
                    to='products.product',
                )),
            ],
            options={
                'db_table': 'stock_distributions',
                'ordering': ['-distributed_at'],
            },
        ),
        migrations.AddIndex(
            model_name='stockdistribution',
            index=models.Index(
                fields=['product', 'distributed_at'],
                name='stock_dist_product_date_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='stockdistribution',
            index=models.Index(
                fields=['vehicle_number', 'distributed_at'],
                name='stock_dist_vehicle_date_idx',
            ),
        ),
    ]
