"""
apps/products/migrations/0004_product_dozens_unit.py

Adds DOZENS as a valid unit choice and the two dozen_* columns.
Depends on 0003_product_delivery_fee.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0003_product_delivery_fee'),
    ]

    operations = [
        # 1. Widen the unit field to accept 'DOZENS'
        #    (max_length stays 10 — 'DOZENS' is 6 chars, same as 'BOTTLES')
        migrations.AlterField(
            model_name='product',
            name='unit',
            field=models.CharField(
                choices=[
                    ('BOTTLES', 'Bottles'),
                    ('LITRES',  'Litres'),
                    ('DOZENS',  'Dozens'),
                ],
                default='BOTTLES',
                max_length=10,
            ),
        ),

        # 2. How many bottles/litres make one dozen (nullable — only set for DOZENS)
        migrations.AddField(
            model_name='product',
            name='dozen_quantity',
            field=models.PositiveSmallIntegerField(
                blank=True,
                null=True,
                help_text=(
                    'Number of base units (bottles or litres) that make up '
                    'one dozen for this product. Required when unit=DOZENS.'
                ),
            ),
        ),

        # 3. Which base unit the dozen is measured in
        migrations.AddField(
            model_name='product',
            name='dozen_base_unit',
            field=models.CharField(
                blank=True,
                null=True,
                max_length=10,
                choices=[
                    ('BOTTLES', 'Bottles'),
                    ('LITRES',  'Litres'),
                ],
                help_text=(
                    'Base unit for the dozen ratio (BOTTLES or LITRES). '
                    'Required when unit=DOZENS.'
                ),
            ),
        ),
    ]
