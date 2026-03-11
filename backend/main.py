from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .data import find_product_by_id
from .schemas import (
    ConsolidationPlan,
    ConsolidationPlanRequest,
    ChatRequest,
    ChatResponse,
    LandedCostBreakdown,
    LandedCostRequest,
    ProductOut,
    SearchResponse,
)
from .services import calc_landed_cost, suggest_consolidation
from .providers import search_all, search_alibaba, search_aliexpress
from .chat import run_chat

app = FastAPI(title="SourceWise Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/search", response_model=SearchResponse)
def search_products(
    q: str,
    platform: str = "all",
    verified: bool = False,
    sort: str = "priceEUR",
) -> SearchResponse:
    if not q.strip():
        return SearchResponse(results=[])

    # Dispatch to providers (currently backed by the in-memory CATALOG;
    # later these can call real Alibaba / AliExpress APIs).
    if platform == "alibaba":
        results: list[ProductOut] = search_alibaba(q)
    elif platform == "aliexpress":
        results = search_aliexpress(q)
    else:
        results = search_all(q)

    if verified:
        results = [p for p in results if p.verified]

    def sort_key_func(p: ProductOut):
        if sort == "rating":
            return -p.rating
        if sort == "leadDays":
            return p.lead_days
        if sort == "moq":
            return p.moq
        # default: price
        return p.price_eur

    results.sort(key=sort_key_func)
    return SearchResponse(results=results)


@app.post("/landed-cost", response_model=LandedCostBreakdown)
def landed_cost(payload: LandedCostRequest) -> LandedCostBreakdown:
    product = find_product_by_id(payload.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    breakdown, _, _ = calc_landed_cost(
        product_id=payload.product_id,
        quantity=payload.quantity,
        method=payload.transport_method,
    )
    return breakdown


@app.post("/consolidation/plan", response_model=ConsolidationPlan)
def consolidation_plan(payload: ConsolidationPlanRequest) -> ConsolidationPlan:
    return suggest_consolidation(payload.items, payload.mode)


@app.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: int) -> ProductOut:
    product = find_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    return run_chat(payload)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

