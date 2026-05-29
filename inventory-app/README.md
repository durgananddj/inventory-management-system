# Inventory Management System

Full-stack inventory management app: **FastAPI + SQLAlchemy + PostgreSQL** backend, **React + Nginx** frontend, orchestrated with **Docker Compose**.

---

## Project Structure

```
inventory-app/
├── backend/
│   ├── main.py            # FastAPI app, all endpoints
│   ├── models.py          # SQLAlchemy ORM models
│   ├── requirements.txt
│   └── Dockerfile         # Multi-stage Python build
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Full React SPA
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── Dockerfile         # Multi-stage Node → Nginx build
└── docker-compose.yml     # PostgreSQL + backend + frontend
```

---

## Quick Start

```bash
# 1. Clone / enter the project
cd inventory-app

# 2. Build and start all services
docker compose up --build

# App:     http://localhost
# API:     http://localhost:8000
# API docs: http://localhost:8000/docs
```

---

## Business Rules Enforced

| Rule | Where |
|---|---|
| Unique SKU per product | DB unique constraint + 409 check in `POST /products` |
| Unique customer email | DB unique constraint + 409 check in `POST /customers` |
| Non-negative price & stock | DB `CHECK` constraint + Pydantic validators |
| Sufficient stock before order | Pre-mutation validation loop in `POST /orders` (all-or-nothing) |
| Automatic stock deduction | Atomic flush inside `POST /orders` – stock decremented, order inserted, committed together |
| Item quantity must be positive | DB `CHECK` constraint + Pydantic validator |
| Cannot delete product referenced by orders | `RESTRICT` FK + 409 response |
| Cannot delete customer with orders | `RESTRICT` FK + 409 response |

---

## API Reference

### Products
| Method | Path | Description |
|---|---|---|
| GET | `/products` | List all products |
| POST | `/products` | Create product (unique SKU) |
| GET | `/products/{id}` | Get single product |
| PATCH | `/products/{id}` | Update name/price/stock/category |
| DELETE | `/products/{id}` | Delete (fails if has orders) |

### Customers
| Method | Path | Description |
|---|---|---|
| GET | `/customers` | List all customers |
| POST | `/customers` | Create customer (unique email) |
| GET | `/customers/{id}` | Get single customer |
| PATCH | `/customers/{id}` | Update name/phone |
| DELETE | `/customers/{id}` | Delete (fails if has orders) |

### Orders
| Method | Path | Description |
|---|---|---|
| GET | `/orders` | List all orders |
| POST | `/orders` | Create order + deduct stock |
| GET | `/orders/{id}` | Get single order with items |
| PATCH | `/orders/{id}/status` | Update status |

### Stats
| Method | Path | Description |
|---|---|---|
| GET | `/stats` | Dashboard counts & revenue |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@db:5432/inventory` | SQLAlchemy DSN |
| `VITE_API_URL` | `http://localhost:8000` | Backend URL (baked into frontend at build time) |

---

## Production Notes

- **Secrets**: Replace hardcoded `POSTGRES_PASSWORD` with Docker secrets or a `.env` file excluded from git.
- **HTTPS**: Add a reverse proxy (Traefik / Caddy) in front of Nginx for TLS termination.
- **CORS**: `allow_origins=["*"]` is suitable for development; restrict to your domain in production.
- **Workers**: Uvicorn is set to 2 workers; tune with `WEB_CONCURRENCY` env var or switch to Gunicorn+Uvicorn worker class.
- **Migrations**: Add [Alembic](https://alembic.sqlalchemy.org/) for schema migrations before going to production.
