import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ─── tiny fetch helpers ───────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}
const get    = (p)       => api(p);
const post   = (p, body) => api(p, { method: "POST",  body: JSON.stringify(body) });
const patch  = (p, body) => api(p, { method: "PATCH", body: JSON.stringify(body) });
const del    = (p)       => api(p, { method: "DELETE" });

// ─── status badge colours ─────────────────────────────────────────────────
const STATUS_COLORS = {
  pending:   "#e6a817",
  confirmed: "#3b82f6",
  shipped:   "#8b5cf6",
  delivered: "#22c55e",
  cancelled: "#ef4444",
};

// ─── small UI atoms ───────────────────────────────────────────────────────
function Badge({ status }) {
  return (
    <span style={{
      background: STATUS_COLORS[status] || "#6b7280",
      color: "#fff",
      fontSize: "0.7rem",
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      padding: "2px 8px",
      borderRadius: 4,
    }}>{status}</span>
  );
}

function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 9999,
      background: type === "error" ? "#ef4444" : "#22c55e",
      color: "#fff", padding: "12px 20px", borderRadius: 8,
      boxShadow: "0 4px 24px rgba(0,0,0,.35)",
      fontWeight: 600, fontSize: "0.9rem", maxWidth: 380,
      animation: "slideUp .25s ease",
    }}>
      {msg}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{
      background: "#1a1f2e", border: `1px solid ${accent}33`,
      borderRadius: 12, padding: "20px 24px", flex: 1, minWidth: 140,
    }}>
      <div style={{ color: accent, fontSize: "1.9rem", fontWeight: 800,
                    fontFamily: "'DM Mono', monospace" }}>{value}</div>
      <div style={{ color: "#8892a4", fontSize: "0.75rem",
                    textTransform: "uppercase", letterSpacing: "0.1em",
                    marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.65)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#151923", border: "1px solid #2a3448",
        borderRadius: 14, padding: 28, width: "100%", maxWidth: 520,
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ color: "#e2e8f0", margin: 0, fontSize: "1.1rem" }}>{title}</h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#8892a4",
            fontSize: "1.4rem", cursor: "pointer", lineHeight: 1,
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── shared form field ────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6,
                    color: "#8892a4", fontSize: "0.78rem",
                    textTransform: "uppercase", letterSpacing: "0.08em" }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle = {
  background: "#1a1f2e", border: "1px solid #2a3448", borderRadius: 7,
  color: "#e2e8f0", padding: "9px 12px", fontSize: "0.9rem",
  outline: "none", width: "100%", boxSizing: "border-box",
};

const btnPrimary = {
  background: "#3b82f6", color: "#fff", border: "none",
  borderRadius: 7, padding: "10px 20px", fontWeight: 700,
  fontSize: "0.88rem", cursor: "pointer", letterSpacing: "0.03em",
};

const btnDanger = {
  ...btnPrimary, background: "#ef4444",
};

// ─── Products tab ─────────────────────────────────────────────────────────
function ProductsTab({ toast }) {
  const [products, setProducts] = useState([]);
  const [form, setForm]         = useState({ sku:"", name:"", price:"", stock:"", category:"" });
  const [editId, setEditId]     = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading]   = useState(false);

  const load = useCallback(() => get("/products").then(setProducts), []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setForm({ sku:"", name:"", price:"", stock:"", category:"" });
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setForm({ sku: p.sku, name: p.name, price: p.price,
              stock: p.stock, category: p.category || "" });
    setEditId(p.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (editId) {
        await patch(`/products/${editId}`, {
          name: form.name, price: parseFloat(form.price),
          stock: parseInt(form.stock), category: form.category || null,
        });
        toast("Product updated", "ok");
      } else {
        await post("/products", {
          ...form, price: parseFloat(form.price), stock: parseInt(form.stock),
        });
        toast("Product created", "ok");
      }
      setShowForm(false);
      load();
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this product?")) return;
    try { await del(`/products/${id}`); toast("Product deleted", "ok"); load(); }
    catch (e) { toast(e.message, "error"); }
  };

  return (
    <section>
      <div style={{ display:"flex", justifyContent:"space-between",
                    alignItems:"center", marginBottom:20 }}>
        <h2 style={{ color:"#e2e8f0", margin:0 }}>Products</h2>
        <button style={btnPrimary} onClick={openNew}>+ Add Product</button>
      </div>

      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse",
                        fontSize:"0.88rem", color:"#c8d0de" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #2a3448", color:"#8892a4",
                         textTransform:"uppercase", fontSize:"0.72rem",
                         letterSpacing:"0.08em" }}>
              {["SKU","Name","Category","Price","Stock",""].map(h => (
                <th key={h} style={{ textAlign:"left", padding:"8px 12px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} style={{ borderBottom:"1px solid #1e2536" }}>
                <td style={{ padding:"10px 12px", fontFamily:"'DM Mono',monospace",
                             color:"#3b82f6" }}>{p.sku}</td>
                <td style={{ padding:"10px 12px" }}>{p.name}</td>
                <td style={{ padding:"10px 12px", color:"#8892a4" }}>{p.category || "—"}</td>
                <td style={{ padding:"10px 12px" }}>${p.price.toFixed(2)}</td>
                <td style={{ padding:"10px 12px" }}>
                  <span style={{ color: p.stock <= 5 ? "#ef4444" : "#22c55e",
                                 fontWeight: p.stock <= 5 ? 700 : 400 }}>
                    {p.stock}
                  </span>
                </td>
                <td style={{ padding:"10px 12px", display:"flex", gap:8 }}>
                  <button onClick={() => openEdit(p)} style={{
                    ...btnPrimary, padding:"5px 12px", fontSize:"0.78rem",
                  }}>Edit</button>
                  <button onClick={() => handleDelete(p.id)} style={{
                    ...btnDanger, padding:"5px 12px", fontSize:"0.78rem",
                  }}>Del</button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign:"center", padding:32,
                                           color:"#4a5568" }}>No products yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editId ? "Edit Product" : "New Product"}
               onClose={() => setShowForm(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {!editId && (
              <Field label="SKU *">
                <input style={inputStyle} value={form.sku}
                       onChange={e => setForm(f => ({...f, sku: e.target.value}))} />
              </Field>
            )}
            <Field label="Name *">
              <input style={inputStyle} value={form.name}
                     onChange={e => setForm(f => ({...f, name: e.target.value}))} />
            </Field>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Field label="Price *">
                <input style={inputStyle} type="number" step="0.01" min="0"
                       value={form.price}
                       onChange={e => setForm(f => ({...f, price: e.target.value}))} />
              </Field>
              <Field label="Stock">
                <input style={inputStyle} type="number" min="0" value={form.stock}
                       onChange={e => setForm(f => ({...f, stock: e.target.value}))} />
              </Field>
            </div>
            <Field label="Category">
              <input style={inputStyle} value={form.category}
                     onChange={e => setForm(f => ({...f, category: e.target.value}))} />
            </Field>
            <button style={{...btnPrimary, marginTop:8}} onClick={handleSubmit}
                    disabled={loading}>
              {loading ? "Saving…" : editId ? "Update Product" : "Create Product"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

// ─── Customers tab ────────────────────────────────────────────────────────
function CustomersTab({ toast }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm]           = useState({ name:"", email:"", phone:"" });
  const [editId, setEditId]       = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [loading, setLoading]     = useState(false);

  const load = useCallback(() => get("/customers").then(setCustomers), []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setForm({ name:"", email:"", phone:"" });
    setEditId(null); setShowForm(true);
  };
  const openEdit = (c) => {
    setForm({ name: c.name, email: c.email, phone: c.phone || "" });
    setEditId(c.id); setShowForm(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (editId) {
        await patch(`/customers/${editId}`, { name: form.name, phone: form.phone || null });
        toast("Customer updated", "ok");
      } else {
        await post("/customers", form);
        toast("Customer created", "ok");
      }
      setShowForm(false); load();
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this customer?")) return;
    try { await del(`/customers/${id}`); toast("Customer deleted", "ok"); load(); }
    catch (e) { toast(e.message, "error"); }
  };

  return (
    <section>
      <div style={{ display:"flex", justifyContent:"space-between",
                    alignItems:"center", marginBottom:20 }}>
        <h2 style={{ color:"#e2e8f0", margin:0 }}>Customers</h2>
        <button style={btnPrimary} onClick={openNew}>+ Add Customer</button>
      </div>

      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse",
                        fontSize:"0.88rem", color:"#c8d0de" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #2a3448", color:"#8892a4",
                         textTransform:"uppercase", fontSize:"0.72rem",
                         letterSpacing:"0.08em" }}>
              {["Name","Email","Phone",""].map(h => (
                <th key={h} style={{ textAlign:"left", padding:"8px 12px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id} style={{ borderBottom:"1px solid #1e2536" }}>
                <td style={{ padding:"10px 12px" }}>{c.name}</td>
                <td style={{ padding:"10px 12px", color:"#3b82f6" }}>{c.email}</td>
                <td style={{ padding:"10px 12px", color:"#8892a4" }}>{c.phone || "—"}</td>
                <td style={{ padding:"10px 12px", display:"flex", gap:8 }}>
                  <button onClick={() => openEdit(c)} style={{
                    ...btnPrimary, padding:"5px 12px", fontSize:"0.78rem",
                  }}>Edit</button>
                  <button onClick={() => handleDelete(c.id)} style={{
                    ...btnDanger, padding:"5px 12px", fontSize:"0.78rem",
                  }}>Del</button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign:"center", padding:32,
                                           color:"#4a5568" }}>No customers yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editId ? "Edit Customer" : "New Customer"}
               onClose={() => setShowForm(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Field label="Name *">
              <input style={inputStyle} value={form.name}
                     onChange={e => setForm(f => ({...f, name: e.target.value}))} />
            </Field>
            {!editId && (
              <Field label="Email *">
                <input style={inputStyle} type="email" value={form.email}
                       onChange={e => setForm(f => ({...f, email: e.target.value}))} />
              </Field>
            )}
            <Field label="Phone">
              <input style={inputStyle} value={form.phone}
                     onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
            </Field>
            <button style={{...btnPrimary, marginTop:8}} onClick={handleSubmit}
                    disabled={loading}>
              {loading ? "Saving…" : editId ? "Update Customer" : "Create Customer"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

// ─── Orders tab ───────────────────────────────────────────────────────────
function OrdersTab({ toast }) {
  const [orders,    setOrders]    = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products,  setProducts]  = useState([]);
  const [showForm,  setShowForm]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [form, setForm] = useState({
    customer_id: "", notes: "", items: [{ product_id: "", quantity: 1 }],
  });

  const load = useCallback(() => {
    Promise.all([
      get("/orders"),
      get("/customers"),
      get("/products"),
    ]).then(([o, c, p]) => { setOrders(o); setCustomers(c); setProducts(p); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const addItem    = () => setForm(f => ({...f,
    items: [...f.items, { product_id: "", quantity: 1 }]}));
  const removeItem = (i) => setForm(f => ({...f,
    items: f.items.filter((_, idx) => idx !== i)}));
  const updateItem = (i, key, val) => setForm(f => {
    const items = [...f.items];
    items[i] = {...items[i], [key]: val};
    return {...f, items};
  });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        customer_id: parseInt(form.customer_id),
        notes: form.notes || null,
        items: form.items
          .filter(i => i.product_id && i.quantity > 0)
          .map(i => ({ product_id: parseInt(i.product_id),
                       quantity: parseInt(i.quantity) })),
      };
      await post("/orders", payload);
      toast("Order placed — stock deducted", "ok");
      setShowForm(false);
      setForm({ customer_id:"", notes:"", items:[{ product_id:"", quantity:1 }] });
      load();
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  const handleStatusChange = async (id, status) => {
    try {
      await patch(`/orders/${id}/status?new_status=${status}`, {});
      toast("Status updated", "ok"); load();
    } catch (e) { toast(e.message, "error"); }
  };

  const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));

  return (
    <section>
      <div style={{ display:"flex", justifyContent:"space-between",
                    alignItems:"center", marginBottom:20 }}>
        <h2 style={{ color:"#e2e8f0", margin:0 }}>Orders</h2>
        <button style={btnPrimary} onClick={() => setShowForm(true)}>+ New Order</button>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {orders.length === 0 && (
          <div style={{ textAlign:"center", padding:48, color:"#4a5568" }}>
            No orders yet
          </div>
        )}
        {[...orders].reverse().map(o => (
          <div key={o.id} style={{
            background:"#1a1f2e", border:"1px solid #2a3448",
            borderRadius:10, padding:"16px 20px",
          }}>
            <div style={{ display:"flex", justifyContent:"space-between",
                          flexWrap:"wrap", gap:10, marginBottom:10 }}>
              <div>
                <span style={{ color:"#8892a4", fontSize:"0.78rem" }}>Order #</span>
                <span style={{ color:"#e2e8f0", fontWeight:700,
                               fontFamily:"'DM Mono',monospace",
                               marginLeft:4 }}>{o.id}</span>
                <span style={{ color:"#8892a4", fontSize:"0.78rem",
                               marginLeft:12 }}>·</span>
                <span style={{ color:"#c8d0de", marginLeft:12 }}>
                  {customerMap[o.customer_id] || `Customer #${o.customer_id}`}
                </span>
              </div>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <Badge status={o.status} />
                <span style={{ color:"#22c55e", fontWeight:700,
                               fontFamily:"'DM Mono',monospace" }}>
                  ${o.total.toFixed(2)}
                </span>
              </div>
            </div>

            <div style={{ display:"flex", gap:8, flexWrap:"wrap",
                          marginBottom: o.notes ? 8 : 0 }}>
              {o.items.map(item => {
                const prod = products.find(p => p.id === item.product_id);
                return (
                  <span key={item.id} style={{
                    background:"#0f1420", border:"1px solid #2a3448",
                    borderRadius:5, padding:"3px 10px",
                    color:"#8892a4", fontSize:"0.78rem",
                  }}>
                    {prod?.name || `Product #${item.product_id}`} × {item.quantity}
                  </span>
                );
              })}
            </div>

            {o.notes && (
              <div style={{ color:"#6b7280", fontSize:"0.78rem",
                            fontStyle:"italic", marginTop:6 }}>
                {o.notes}
              </div>
            )}

            <div style={{ marginTop:10, display:"flex", gap:6, flexWrap:"wrap" }}>
              {["pending","confirmed","shipped","delivered","cancelled"]
                .filter(s => s !== o.status)
                .map(s => (
                  <button key={s} onClick={() => handleStatusChange(o.id, s)} style={{
                    background:"transparent", border:`1px solid ${STATUS_COLORS[s]}55`,
                    color: STATUS_COLORS[s], borderRadius:5,
                    padding:"3px 10px", fontSize:"0.72rem",
                    cursor:"pointer", fontWeight:600, letterSpacing:"0.05em",
                  }}>→ {s}</button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <Modal title="New Order" onClose={() => setShowForm(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Field label="Customer *">
              <select style={inputStyle} value={form.customer_id}
                      onChange={e => setForm(f => ({...f, customer_id: e.target.value}))}>
                <option value="">— select customer —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                ))}
              </select>
            </Field>

            <Field label="Notes">
              <input style={inputStyle} value={form.notes}
                     onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
            </Field>

            <div style={{ color:"#8892a4", fontSize:"0.78rem",
                          textTransform:"uppercase", letterSpacing:"0.08em",
                          marginBottom:2 }}>Items *</div>

            {form.items.map((item, i) => (
              <div key={i} style={{ display:"grid",
                                    gridTemplateColumns:"1fr 100px 36px", gap:8 }}>
                <select style={inputStyle} value={item.product_id}
                        onChange={e => updateItem(i, "product_id", e.target.value)}>
                  <option value="">— product —</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (stock: {p.stock})
                    </option>
                  ))}
                </select>
                <input style={inputStyle} type="number" min="1"
                       value={item.quantity}
                       onChange={e => updateItem(i, "quantity", e.target.value)} />
                <button onClick={() => removeItem(i)} style={{
                  ...btnDanger, padding:"9px 8px", fontSize:"1rem",
                }}>×</button>
              </div>
            ))}

            <button onClick={addItem} style={{
              background:"transparent", border:"1px dashed #2a3448",
              color:"#8892a4", borderRadius:7, padding:"8px",
              cursor:"pointer", fontSize:"0.83rem",
            }}>+ Add Item</button>

            <button style={{...btnPrimary, marginTop:8}} onClick={handleSubmit}
                    disabled={loading}>
              {loading ? "Placing order…" : "Place Order"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────
export default function App() {
  const [tab,   setTab]   = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [toast, setToast] = useState({ msg:"", type:"ok" });

  const showToast = (msg, type = "ok") => setToast({ msg, type });

  const loadStats = () =>
    get("/stats").then(setStats).catch(() => {});

  useEffect(() => {
    loadStats();
    const id = setInterval(loadStats, 15000);
    return () => clearInterval(id);
  }, []);

  const tabs = ["dashboard","products","customers","orders"];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f1420; font-family: 'Inter', sans-serif; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0f1420; }
        ::-webkit-scrollbar-thumb { background: #2a3448; border-radius: 3px; }
        select option { background: #1a1f2e; }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ display:"flex", minHeight:"100vh" }}>

        {/* Sidebar */}
        <nav style={{
          width: 220, background:"#0b0f1a",
          borderRight:"1px solid #1e2536",
          display:"flex", flexDirection:"column",
          padding:"28px 0", flexShrink:0,
        }}>
          <div style={{ padding:"0 24px 28px" }}>
            <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:800,
                          fontSize:"1.25rem", color:"#e2e8f0",
                          letterSpacing:"-0.02em" }}>
              Inven<span style={{ color:"#3b82f6" }}>tory</span>
            </div>
            <div style={{ color:"#4a5568", fontSize:"0.7rem",
                          letterSpacing:"0.12em", textTransform:"uppercase",
                          marginTop:2 }}>Management</div>
          </div>

          {tabs.map(t => (
            <button key={t} onClick={() => { setTab(t); loadStats(); }} style={{
              background: tab === t ? "#1a1f2e" : "transparent",
              border: "none",
              borderLeft: tab === t ? "3px solid #3b82f6" : "3px solid transparent",
              color: tab === t ? "#e2e8f0" : "#6b7280",
              padding:"12px 24px", cursor:"pointer", textAlign:"left",
              fontSize:"0.88rem", fontWeight: tab === t ? 600 : 400,
              letterSpacing:"0.02em", textTransform:"capitalize",
              transition:"all .15s",
            }}>
              {{ dashboard:"📊", products:"📦", customers:"👤", orders:"🧾" }[t]} {t}
            </button>
          ))}
        </nav>

        {/* Main */}
        <main style={{ flex:1, padding:"32px", overflowY:"auto",
                       animation:"fadeIn .3s ease" }}>
          {tab === "dashboard" && stats && (
            <section>
              <h2 style={{ color:"#e2e8f0", marginBottom:24,
                           fontFamily:"'Syne',sans-serif" }}>Dashboard</h2>
              <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:32 }}>
                <StatCard label="Products"    value={stats.total_products}  accent="#3b82f6" />
                <StatCard label="Customers"   value={stats.total_customers} accent="#8b5cf6" />
                <StatCard label="Orders"      value={stats.total_orders}    accent="#22c55e" />
                <StatCard label="Revenue"
                          value={`$${stats.total_revenue.toLocaleString("en-US",
                                 {minimumFractionDigits:2})}`}
                          accent="#f59e0b" />
                <StatCard label="Low Stock"   value={stats.low_stock_count} accent="#ef4444" />
              </div>

              <div style={{
                background:"#1a1f2e", border:"1px solid #2a3448",
                borderRadius:12, padding:"20px 24px",
              }}>
                <div style={{ color:"#8892a4", fontSize:"0.75rem",
                              textTransform:"uppercase", letterSpacing:"0.1em",
                              marginBottom:12 }}>Quick Actions</div>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                  {["products","customers","orders"].map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{
                      ...btnPrimary, background:"#1e2a3d",
                      border:"1px solid #3b82f633",
                      textTransform:"capitalize",
                    }}>Manage {t}</button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {tab === "dashboard" && !stats && (
            <div style={{ color:"#4a5568", padding:48, textAlign:"center" }}>
              Connecting to API…
            </div>
          )}

          {tab === "products"  && <ProductsTab  toast={showToast} />}
          {tab === "customers" && <CustomersTab toast={showToast} />}
          {tab === "orders"    && <OrdersTab    toast={showToast} />}
        </main>
      </div>

      <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({msg:"",type:"ok"})} />
    </>
  );
}
