import re
from typing import List, Optional, Tuple

from .providers import search_all, search_alibaba, search_aliexpress
from .schemas import CartItem, ChatRequest, ChatResponse, ProductOut, TransportMethod
from .services import calc_landed_cost, suggest_consolidation
from .data import find_product_by_id


_METHOD_ALIASES = {
    "air": "air",
    "aer": "air",
    "aerian": "air",
    "plane": "air",
    "sea": "sea_lcl",
    "mare": "sea_lcl",
    "lcl": "sea_lcl",
    "fcl": "sea_fcl",
    "container": "sea_fcl",
}


def _pick_transport_method(prompt: str) -> TransportMethod:
    p = prompt.lower()
    for k, v in _METHOD_ALIASES.items():
        if re.search(rf"\b{re.escape(k)}\b", p):
            return v  # type: ignore[return-value]
    return "sea_lcl"


def _extract_qty(prompt: str) -> Optional[int]:
    # Try explicit "qty 500" or "500 buc"
    m = re.search(r"\bqty\s*(\d{1,7})\b", prompt.lower())
    if m:
        return int(m.group(1))
    m = re.search(r"\b(\d{1,7})\s*(buc|pcs|unit)\b", prompt.lower())
    if m:
        return int(m.group(1))
    return None


def _want(prompt: str, *keywords: str) -> bool:
    p = prompt.lower()
    return any(k in p for k in keywords)


def _provider_search(query: str, platform: str) -> List[ProductOut]:
    if platform == "alibaba":
        return search_alibaba(query)
    if platform == "aliexpress":
        return search_aliexpress(query)
    return search_all(query)


def run_chat(payload: ChatRequest) -> ChatResponse:
    prompt = payload.prompt.strip()
    if not prompt:
        return ChatResponse(message="Scrie un prompt (ex: „Caută casti wireless, compară top 3 și calculează costul pentru 500 buc cu LCL”).")

    # 1) Always do a search unless the prompt is explicitly only "consolidate current cart" (we don't store server cart yet).
    query = prompt
    results = _provider_search(query, payload.platform)

    # Sort by cheapest by default (like UI default)
    results_sorted = sorted(results, key=lambda p: p.price_eur)

    # 2) Compare
    compared: List[ProductOut] = []
    if _want(prompt, "compar", "compare", "vs", "versus", "⚖"):
        compared = results_sorted[:3]

    # 3) Consolidate (build a cart from top picks)
    cart: List[CartItem] = []
    consolidation_plan = None
    if _want(prompt, "consolid", "coș", "cart", "container", "📦"):
        qty = _extract_qty(prompt)
        for p in (compared or results_sorted[:2]):
            cart.append(CartItem(product_id=p.id, quantity=qty or p.moq or 100))
        consolidation_plan = suggest_consolidation(cart, mode="multi_supplier")

    # 4) Landed cost (for best/first product)
    landed_cost = None
    landed_cost_product = None
    method = _pick_transport_method(prompt)
    if _want(prompt, "cost", "calculator", "calcule", "landed", "🧮"):
        target = (compared or results_sorted[:1])[0] if results_sorted else None
        if target:
            qty = _extract_qty(prompt) or target.moq or 100
            breakdown, _, _ = calc_landed_cost(target.id, qty, method)
            landed_cost = breakdown
            landed_cost_product = find_product_by_id(target.id) or target

    # Message assembly (keep short, UI-focused)
    parts = []
    parts.append(f"Am găsit {len(results_sorted)} rezultate.")
    if compared:
        parts.append(f"Am selectat {len(compared)} pentru comparație.")
    if consolidation_plan:
        parts.append(f"Consolidare: {consolidation_plan.total_weight:.1f} kg, metodă recomandată {consolidation_plan.recommended_method}.")
    if landed_cost and landed_cost_product:
        parts.append(f"Cost landed pentru „{landed_cost_product.name}” ({method}): €{landed_cost.unit:.2f}/buc.")

    return ChatResponse(
        message=" ".join(parts),
        search_results=results_sorted,
        compared=compared,
        cart=cart,
        consolidation_plan=consolidation_plan,
        landed_cost=landed_cost,
        landed_cost_product=landed_cost_product,
        transport_method=method,
    )

