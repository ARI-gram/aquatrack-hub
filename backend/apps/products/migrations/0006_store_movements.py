"""
apps/products/migrations/0006_store_movements.py

Adds:
  - Product.is_returnable
  - BottleMovement model
  - ConsumableMovement model
"""

import uuid
import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        # adjust to your latest migration
        ('products', '0005_rename_stock_dist_product_date_idx_stock_distr_product_772053_idx_and_more'),
        ('customers', '0001_initial'),               # adjust as needed
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [

        # ── 1. Add is_returnable to Product ──────────────────────────────────
        migrations.AddField(
            model_name='product',
            name='is_returnable',
            field=models.BooleanField(
                default=False,
                help_text='True = customers return this bottle (dispenser). False = consumable (sealed).',
            ),
        ),

        # ── 2. BottleMovement ─────────────────────────────────────────────────
        migrations.CreateModel(
            name='BottleMovement',
            fields=[
                ('id', models.UUIDField(
                    primary_key=True, default=uuid.uuid4, editable=False)),
                ('movement_type', models.CharField(
                    max_length=20,
                    choices=[
                        ('RECEIVE_EMPTY', 'Receive Empties'),
                        ('REFILL',        'Refill Empties'),
                        ('DISTRIBUTE',    'Distribute to Van'),
                        ('DIRECT_SALE',   'Direct Sale'),
                    ],
                )),
                ('qty_good',     models.PositiveIntegerField(default=0)),
                ('qty_damaged',  models.PositiveIntegerField(default=0)),
                ('qty_missing',  models.PositiveIntegerField(default=0)),
                ('qty_expected', models.PositiveIntegerField(
                    default=0,
                    help_text='Only used for RECEIVE_EMPTY.',
                )),
                ('vehicle_number', models.CharField(max_length=20, blank=True)),
                ('customer_name',  models.CharField(max_length=200, blank=True)),
                ('notes',          models.TextField(blank=True)),
                ('movement_date',  models.DateTimeField(auto_now_add=True)),
                ('product', models.ForeignKey(
                    to='products.Product',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='bottle_movements',
                )),
                ('driver', models.ForeignKey(
                    to=settings.AUTH_USER_MODEL,
                    on_delete=django.db.models.deletion.SET_NULL,
                    null=True, blank=True,
                    related_name='bottle_movements',
                )),
                ('customer', models.ForeignKey(
                    to='customers.Customer',
                    on_delete=django.db.models.deletion.SET_NULL,
                    null=True, blank=True,
                    related_name='bottle_movements',
                )),
                ('recorded_by', models.ForeignKey(
                    to=settings.AUTH_USER_MODEL,
                    on_delete=django.db.models.deletion.SET_NULL,
                    null=True,
                    related_name='bottle_movements_recorded',
                )),
            ],
            options={
                'db_table': 'bottle_movements',
                'ordering': ['-movement_date'],
            },
        ),
        migrations.AddIndex(
            model_name='bottlemovement',
            index=models.Index(
                fields=['product', 'movement_date'],
                name='bottle_mov_product_date_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='bottlemovement',
            index=models.Index(
                fields=['movement_type', 'movement_date'],
                name='bottle_mov_type_date_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='bottlemovement',
            index=models.Index(
                fields=['driver', 'movement_date'],
                name='bottle_mov_driver_date_idx',
            ),
        ),

        # ── 3. ConsumableMovement ─────────────────────────────────────────────
        migrations.CreateModel(
            name='ConsumableMovement',
            fields=[
                ('id', models.UUIDField(
                    primary_key=True, default=uuid.uuid4, editable=False)),
                ('movement_type', models.CharField(
                    max_length=20,
                    choices=[
                        ('RECEIVE',     'Receive Stock'),
                        ('DISTRIBUTE',  'Distribute to Van'),
                        ('DIRECT_SALE', 'Direct Sale'),
                    ],
                )),
                ('quantity', models.PositiveIntegerField(
                    validators=[django.core.validators.MinValueValidator(1)],
                )),
                ('vehicle_number', models.CharField(max_length=20, blank=True)),
                ('customer_name',  models.CharField(max_length=200, blank=True)),
                ('supplier_name',  models.CharField(max_length=200, blank=True)),
                ('unit_price', models.DecimalField(
                    max_digits=10, decimal_places=2, null=True, blank=True,
                )),
                ('notes',         models.TextField(blank=True)),
                ('movement_date', models.DateTimeField(auto_now_add=True)),
                ('product', models.ForeignKey(
                    to='products.Product',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='consumable_movements',
                )),
                ('driver', models.ForeignKey(
                    to=settings.AUTH_USER_MODEL,
                    on_delete=django.db.models.deletion.SET_NULL,
                    null=True, blank=True,
                    related_name='consumable_movements',
                )),
                ('customer', models.ForeignKey(
                    to='customers.Customer',
                    on_delete=django.db.models.deletion.SET_NULL,
                    null=True, blank=True,
                    related_name='consumable_movements',
                )),
                ('recorded_by', models.ForeignKey(
                    to=settings.AUTH_USER_MODEL,
                    on_delete=django.db.models.deletion.SET_NULL,
                    null=True,
                    related_name='consumable_movements_recorded',
                )),
            ],
            options={
                'db_table': 'consumable_movements',
                'ordering': ['-movement_date'],
            },
        ),
        migrations.AddIndex(
            model_name='consumablemovement',
            index=models.Index(
                fields=['product', 'movement_date'],
                name='consumable_mov_product_date_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='consumablemovement',
            index=models.Index(
                fields=['movement_type', 'movement_date'],
                name='consumable_mov_type_date_idx',
            ),
        ),
    ]
