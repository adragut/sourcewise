# sourcewise

React prototype and FastAPI backend for **SourceWise**, a China → Romania import decision tool.

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

## Frontend (Vite + React)

From the project root:

1. Install Node dependencies:

```bash
cd frontend
npm install
```

2. Run the dev server:

```bash
npm run dev
```

The UI will be available at `http://localhost:5173/`.

The entrypoint is:

- `frontend/src/main.jsx` – mounts the React app
- `frontend/src/App.jsx` – renders the `SourceWise` UI from `frontend/sourcewise-ro.jsx`

Make sure the FastAPI backend is running on `http://127.0.0.1:8000` (or update `API_BASE` in `frontend/sourcewise-ro.jsx` if you change the port/host).
