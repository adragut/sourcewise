# sourcewise

React prototype and FastAPI backend for SourceWise import tooling.

## Backend (FastAPI)

From the project root:

1. Create a virtual environment and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate  # on Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
```

2. Run the FastAPI server:

```bash
uvicorn backend.main:app --reload
```

The API will be available at `http://localhost:8000`. Useful endpoints:

- `GET /health` – simple health check
- `GET /search` – product search backed by the in-memory catalog
- `POST /landed-cost` – landed cost breakdown for a product, quantity, and transport method
- `POST /consolidation/plan` – consolidation summary and per-product costs for a cart
