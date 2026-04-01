# apps/products/migrations/0008_remove_storeconsumablemovement_client_and_more.py

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0007_storebottlemovement_storeconsumablemovement_and_more'),
    ]

    operations = [
        # Drop the whole tables in one shot — avoids SQLite index conflict
        # when removing individual fields while composite indexes still exist.
        migrations.DeleteModel(
            name='StoreBottleMovement',
        ),
        migrations.DeleteModel(
            name='StoreConsumableMovement',
        ),

        # Add new fields to existing movement models
        migrations.AddField(
            model_name='bottlemovement',
            name='payment_method',
            field=models.CharField(
                blank=True, default='CASH', help_text='Payment method — only for DIRECT_SALE', max_length=20),
        ),
        migrations.AddField(
            model_name='bottlemovement',
            name='total_amount',
            field=models.DecimalField(
                blank=True, decimal_places=2, help_text='Total sale amount — only for DIRECT_SALE', max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='bottlemovement',
            name='unit_price',
            field=models.DecimalField(
                blank=True, decimal_places=2, help_text='Sale price per unit — only for DIRECT_SALE', max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='consumablemovement',
            name='payment_method',
            field=models.CharField(
                blank=True, default='CASH', help_text='Payment method — only for DIRECT_SALE', max_length=20),
        ),
        migrations.AddField(
            model_name='consumablemovement',
            name='total_amount',
            field=models.DecimalField(
                blank=True, decimal_places=2, help_text='Total sale amount — only for DIRECT_SALE', max_digits=12, null=True),
        ),
    ]
