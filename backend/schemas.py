from typing import List, Literal

from pydantic import BaseModel


Platform = Literal["alibaba", "aliexpress"]
TransportMethod = Literal["air", "sea_lcl", "sea_fcl"]
ConsolidationMode = Literal["multi_supplier", "air_sea", "warehouse_cn", "group_buyers"]


class ProductOut(BaseModel):
    id: int
    platform: Platform
    name: str
    supplier: str
    price_eur: float
    moq: int
    lead_days: int
    rating: float
    reviews: int
    verified: bool
    audited: bool
    ta: bool
    kg: float
    hs: str
    cat: str
    img: str


class SearchResponse(BaseModel):
    results: List[ProductOut]


class LandedCostRequest(BaseModel):
    product_id: int
    quantity: int
    transport_method: TransportMethod


class LandedCostBreakdown(BaseModel):
    prod: float
    freight: float
    duties: float
    vat: float
    ins: float
    broker: float
    total: float
    unit: float
    duty_rate: float


class CartItem(BaseModel):
    product_id: int
    quantity: int


class PerProductCost(BaseModel):
    product_id: int
    quantity: int
    unit_cost: float
    total_cost: float


class ConsolidationPlanRequest(BaseModel):
    items: List[CartItem]
    mode: ConsolidationMode


class ConsolidationPlan(BaseModel):
    total_weight: float
    total_value: float
    recommended_method: TransportMethod
    freight_cost: float
    air_freight_cost: float
    sea_freight_cost: float
    savings_vs_air: float
    per_product_costs: List[PerProductCost]

