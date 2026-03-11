from typing import List, Optional

from .data import CATALOG
from .schemas import Platform, ProductOut


def _from_catalog(keyword: str, platform: Optional[Platform]) -> List[ProductOut]:
    """
    Temporary provider implementation that pulls from the in-memory CATALOG.
    This keeps the /search contract stable while we later swap in real API calls
    to Alibaba / AliExpress.
    """
    key = None
    q_lower = keyword.lower()
    for k in CATALOG.keys():
        if k.split(" ")[0] in q_lower:
            key = k
            break
    if key is None:
        key = "casti wireless"

    results: list[ProductOut] = list(CATALOG[key])
    if platform and platform != "all":
        results = [p for p in results if p.platform == platform]
    return results


def search_alibaba(keyword: str) -> List[ProductOut]:
    # TODO: replace with real Alibaba API integration
    return _from_catalog(keyword, "alibaba")


def search_aliexpress(keyword: str) -> List[ProductOut]:
    # TODO: replace with real AliExpress API integration
    return _from_catalog(keyword, "aliexpress")


def search_all(keyword: str) -> List[ProductOut]:
    # Used when platform=all
    return _from_catalog(keyword, None)

