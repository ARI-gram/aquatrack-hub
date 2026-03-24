"""
apps/products/inventory.py

InventoryManager — single place for all stock calculations.

Main warehouse stock:
    available = total_received − total_distributed

Van stock (per vehicle):
    van_stock[plate] = total_distributed_to_plate
    (future: subtract van deliveries when that feature is built)
"""

from django.db.models import Sum
from typing import Optional


class InventoryManager:

    # ── Main warehouse ────────────────────────────────────────────────────────

    @staticmethod
    def get_available_stock(product_id) -> int:
        """
        Returns how many units are currently in the main warehouse.
        Formula: total received  −  total distributed to vans
        """
        from apps.products.models import StockEntry, StockDistribution

        received = (
            StockEntry.objects
            .filter(product_id=product_id)
            .aggregate(total=Sum('quantity'))['total'] or 0
        )
        distributed = (
            StockDistribution.objects
            .filter(product_id=product_id)
            .aggregate(total=Sum('quantity'))['total'] or 0
        )
        return max(0, received - distributed)

    @staticmethod
    def get_stock_for_products(product_ids: list) -> dict:
        """
        Bulk version — returns {str(product_id): available_qty} for a list.
        One query per table instead of N queries.
        """
        from apps.products.models import StockEntry, StockDistribution

        received_qs = (
            StockEntry.objects
            .filter(product_id__in=product_ids)
            .values('product_id')
            .annotate(total=Sum('quantity'))
        )
        distributed_qs = (
            StockDistribution.objects
            .filter(product_id__in=product_ids)
            .values('product_id')
            .annotate(total=Sum('quantity'))
        )

        received = {str(r['product_id']): r['total'] for r in received_qs}
        distributed = {str(d['product_id']): d['total']
                       for d in distributed_qs}

        return {
            str(pid): max(0, received.get(str(pid), 0) - distributed.get(str(pid), 0))
            for pid in product_ids
        }

    # ── Van / vehicle stock ───────────────────────────────────────────────────

    @staticmethod
    def get_van_stock(vehicle_number: str) -> list:
        """
        Returns a list of {product, quantity} for everything currently
        loaded on a specific van.
        """
        from apps.products.models import StockDistribution

        qs = (
            StockDistribution.objects
            .filter(vehicle_number=vehicle_number)
            .values('product_id', 'product__name', 'product__unit')
            .annotate(total=Sum('quantity'))
        )
        return [
            {
                'product_id':   str(row['product_id']),
                'product_name': row['product__name'],
                'unit':         row['product__unit'],
                'quantity':     row['total'],
            }
            for row in qs
        ]

    @staticmethod
    def get_van_stock_for_product(vehicle_number: str, product_id) -> int:
        """How many units of a specific product are on a given van."""
        from apps.products.models import StockDistribution

        total = (
            StockDistribution.objects
            .filter(vehicle_number=vehicle_number, product_id=product_id)
            .aggregate(total=Sum('quantity'))['total'] or 0
        )
        return max(0, total)

    # ── Validation helper ─────────────────────────────────────────────────────

    @staticmethod
    def can_distribute(product_id, quantity: int) -> tuple[bool, int]:
        """
        Returns (ok, available_in_warehouse).
        ok is False if the warehouse doesn't have enough stock.
        """
        available = InventoryManager.get_available_stock(product_id)
        return available >= quantity, available
