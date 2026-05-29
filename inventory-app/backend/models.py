from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey,
    DateTime, CheckConstraint, Text
)
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime, timezone

Base = declarative_base()


class Product(Base):
    __tablename__ = "products"

    id       = Column(Integer, primary_key=True, index=True)
    sku      = Column(String(64), unique=True, nullable=False, index=True)
    name     = Column(String(255), nullable=False)
    price    = Column(Float, nullable=False)
    stock    = Column(Integer, nullable=False, default=0)
    category = Column(String(128), nullable=True)

    __table_args__ = (
        CheckConstraint("price >= 0",  name="ck_product_price_nonneg"),
        CheckConstraint("stock >= 0",  name="ck_product_stock_nonneg"),
    )

    order_items = relationship("OrderItem", back_populates="product")


class Customer(Base):
    __tablename__ = "customers"

    id    = Column(Integer, primary_key=True, index=True)
    name  = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(32), nullable=True)

    orders = relationship("Order", back_populates="customer")


class Order(Base):
    __tablename__ = "orders"

    id          = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="RESTRICT"),
                         nullable=False, index=True)
    status      = Column(String(32), nullable=False, default="pending")
    notes       = Column(Text, nullable=True)
    total       = Column(Float, nullable=False, default=0.0)
    created_at  = Column(DateTime(timezone=True),
                         default=lambda: datetime.now(timezone.utc))

    customer   = relationship("Customer", back_populates="orders")
    items      = relationship("OrderItem", back_populates="order",
                              cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id         = Column(Integer, primary_key=True, index=True)
    order_id   = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"),
                        nullable=False, index=True)
    quantity   = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)   # snapshot at order time

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_order_item_qty_pos"),
    )

    order   = relationship("Order",   back_populates="items")
    product = relationship("Product", back_populates="order_items")
