"""
apps/products/migrations/0003_product_delivery_fee.py
"""

from django.db import migrations, models
import django.core.validators
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0002_stock_distribution'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='delivery_fee',
            field=models.DecimalField(
                max_digits=8,
                decimal_places=2,
                default=Decimal('0.00'),
                validators=[
                    django.core.validators.MinValueValidator(Decimal('0.00'))],
                help_text='Delivery charge for this product (KES). 0 = free delivery.',
            ),
        ),
    ]
