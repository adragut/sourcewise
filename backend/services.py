from typing import Literal, Tuple

from .data import BROKER_FEE, DUTY, FREIGHT, VAT_RO, find_product_by_id
from .schemas import (
    CartItem,
    ConsolidationMode,
    ConsolidationPlan,
    LandedCostBreakdown,
    LandedCostRequest,
    PerProductCost,
    TransportMethod,
)


def calc_landed_cost(product_id: int, quantity: int, method: TransportMethod) -> Tuple[LandedCostBreakdown, float, float]:
    """
    Mirror the frontend calcLanded logic in Python.

    Returns (breakdown, total_weight, total_value).
    """
    p = find_product_by_id(product_id)
    if not p:
        raise ValueError(f"Product {product_id} not found")

    prod = p.price_eur * quantity
    freight = p.kg * quantity * FREIGHT[method]
    duty_rate = DUTY.get(p.hs, 0.05)
    duties = (prod + freight) * duty_rate
    vat = (prod + freight + duties) * VAT_RO
    ins = prod * 0.005
    total = prod + freight + duties + vat + ins + BROKER_FEE

    breakdown = LandedCostBreakdown(
        prod=prod,
        freight=freight,
        duties=duties,
        vat=vat,
        ins=ins,
        broker=BROKER_FEE,
        total=total,
        unit=total / quantity,
        duty_rate=duty_rate,
    )

    total_weight = p.kg * quantity
    total_value = prod
    return breakdown, total_weight, total_value


def suggest_consolidation(
    items: list[CartItem],
    mode: ConsolidationMode,
) -> ConsolidationPlan:
    # Aggregate totals using sea freight as baseline, like frontend logic
    total_weight = 0.0
    total_value = 0.0

    for item in items:
        p = find_product_by_id(item.product_id)
        if not p:
            continue
        total_weight += p.kg * item.quantity
        total_value += p.price_eur * item.quantity

    sea_method: TransportMethod = "sea_fcl" if total_weight > 2000 else "sea_lcl"
    sea_freight = total_weight * FREIGHT[sea_method]
    air_freight = total_weight * FREIGHT["air"]
    savings = max(0.0, air_freight - sea_freight)

    per_product_costs: list[PerProductCost] = []
    for item in items:
        breakdown, _, _ = calc_landed_cost(item.product_id, item.quantity, sea_method)
        per_product_costs.append(
            PerProductCost(
                product_id=item.product_id,
                quantity=item.quantity,
                unit_cost=breakdown.unit,
                total_cost=breakdown.total,
            )
        )

    plan = ConsolidationPlan(
        total_weight=total_weight,
        total_value=total_value,
        recommended_method=sea_method,
        freight_cost=sea_freight,
        air_freight_cost=air_freight,
        sea_freight_cost=sea_freight,
        savings_vs_air=savings,
        per_product_costs=per_product_costs,
    )
    return plan

