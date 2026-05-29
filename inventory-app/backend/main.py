"""
Inventory Management API
FastAPI + SQLAlchemy + PostgreSQL
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import create_engine, select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from models import Base, Product, Customer, Order, OrderItem

# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@db:5432/inventory"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Inventory Management API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

# --- Product ---

class ProductCreate(BaseModel):
    sku: str
    name: str
    price: float
    stock: int = 0
    category: Optional[str] = None

    @field_validator("price")
    @classmethod
    def price_nonneg(cls, v: float) -> float:
        if v < 0:
            raise ValueError("price must be non-negative")
        return v

    @field_validator("stock")
    @classmethod
    def stock_nonneg(cls, v: int) -> int:
        if v < 0:
            raise ValueError("stock must be non-negative")
        return v


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    category: Optional[str] = None


class ProductOut(BaseModel):
    id: int
    sku: str
    name: str
    price: float
    stock: int
    category: Optional[str]

    model_config = {"from_attributes": True}


# --- Customer ---

class CustomerCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None


class CustomerOut(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str]

    model_config = {"from_attributes": True}


# --- Order ---

class OrderItemIn(BaseModel):
    product_id: int
    quantity: int

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("quantity must be positive")
        return v


class OrderCreate(BaseModel):
    customer_id: int
    notes: Optional[str] = None
    items: List[OrderItemIn]


class OrderItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float

    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: int
    customer_id: int
    status: str
    notes: Optional[str]
    total: float
    created_at: str
    items: List[OrderItemOut]

    model_config = {"from_attributes": True}


# --- Stats ---

class DashboardStats(BaseModel):
    total_products: int
    total_customers: int
    total_orders: int
    total_revenue: float
    low_stock_count: int


# ---------------------------------------------------------------------------
# Products endpoints
# ---------------------------------------------------------------------------

@app.get("/products", response_model=List[ProductOut])
def list_products(db: Session = Depends(get_db)):
    return db.scalars(select(Product).order_by(Product.id)).all()


@app.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(Product).where(Product.sku == payload.sku))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"SKU '{payload.sku}' already exists"
        )
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@app.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.patch("/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@app.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    try:
        db.delete(product)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete product referenced by existing orders"
        )


# ---------------------------------------------------------------------------
# Customers endpoints
# ---------------------------------------------------------------------------

@app.get("/customers", response_model=List[CustomerOut])
def list_customers(db: Session = Depends(get_db)):
    return db.scalars(select(Customer).order_by(Customer.id)).all()


@app.post("/customers", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(Customer).where(Customer.email == payload.email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{payload.email}' is already registered"
        )
    customer = Customer(**payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@app.get("/customers/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@app.patch("/customers/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db)):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer


@app.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    try:
        db.delete(customer)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete customer with existing orders"
        )


# ---------------------------------------------------------------------------
# Orders endpoints  (inventory validation + stock deduction happen here)
# ---------------------------------------------------------------------------

@app.get("/orders", response_model=List[OrderOut])
def list_orders(db: Session = Depends(get_db)):
    orders = db.scalars(select(Order).order_by(Order.id)).all()
    return [_serialize_order(o) for o in orders]


@app.post("/orders", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    # Validate customer
    customer = db.get(Customer, payload.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    if not payload.items:
        raise HTTPException(status_code=422, detail="Order must contain at least one item")

    # Validate all products and stock before any mutation (fail-fast)
    resolved: list[tuple[Product, int]] = []
    for item in payload.items:
        product = db.get(Product, item.product_id)
        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Product id={item.product_id} not found"
            )
        if product.stock < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Insufficient stock for '{product.name}' (SKU {product.sku}): "
                    f"requested {item.quantity}, available {product.stock}"
                )
            )
        resolved.append((product, item.quantity))

    # All checks passed — create order, deduct stock, build items
    order = Order(
        customer_id=payload.customer_id,
        notes=payload.notes,
        status="pending",
        total=0.0,
    )
    db.add(order)
    db.flush()  # get order.id without committing

    total = 0.0
    for product, qty in resolved:
        product.stock -= qty
        line = OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=qty,
            unit_price=product.price,
        )
        db.add(line)
        total += product.price * qty

    order.total = round(total, 2)
    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@app.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _serialize_order(order)


@app.patch("/orders/{order_id}/status", response_model=OrderOut)
def update_order_status(order_id: int, new_status: str, db: Session = Depends(get_db)):
    allowed = {"pending", "confirmed", "shipped", "delivered", "cancelled"}
    if new_status not in allowed:
        raise HTTPException(status_code=422, detail=f"Status must be one of: {allowed}")
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = new_status
    db.commit()
    db.refresh(order)
    return _serialize_order(order)


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------

@app.get("/stats", response_model=DashboardStats)
def get_stats(db: Session = Depends(get_db)):
    total_products  = db.scalar(select(func.count()).select_from(Product)) or 0
    total_customers = db.scalar(select(func.count()).select_from(Customer)) or 0
    total_orders    = db.scalar(select(func.count()).select_from(Order)) or 0
    total_revenue   = db.scalar(select(func.coalesce(func.sum(Order.total), 0))) or 0.0
    low_stock_count = db.scalar(
        select(func.count()).select_from(Product).where(Product.stock <= 5)
    ) or 0
    return DashboardStats(
        total_products=total_products,
        total_customers=total_customers,
        total_orders=total_orders,
        total_revenue=round(float(total_revenue), 2),
        low_stock_count=low_stock_count,
    )


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _serialize_order(order: Order) -> dict:
    return {
        "id": order.id,
        "customer_id": order.customer_id,
        "status": order.status,
        "notes": order.notes,
        "total": order.total,
        "created_at": order.created_at.isoformat() if order.created_at else "",
        "items": [
            {
                "id": i.id,
                "product_id": i.product_id,
                "quantity": i.quantity,
                "unit_price": i.unit_price,
            }
            for i in order.items
        ],
    }
