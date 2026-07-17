# POS-SaaS: Dynamic Forms Architecture

## Current State Analysis

| Page | Lines | Form Fields | Module-Specific? |
|------|-------|-------------|-----------------|
| Order Creation | 940 | customer, services[], weight, payment, discount | ✅ Laundry-specific |
| Branch Settings | 984 | name, address, phone, lat/lng, hours, receipt, printer | ❌ Universal |
| Services | 768 | name, price, unit, category, commission | ⚠️ Partial |
| Inventory | 592 | name, quantity, unit, reorder threshold, notes | ❌ Universal |
| Expenses | 522 | amount, category, notes, date | ❌ Universal |
| Customers | 482 | name, phone, address, notes | ❌ Universal |
| Staff/Users | 230 | name, email, phone, role, branch | ❌ Universal |
| Profile | 165 | name, email, phone, password | ❌ Universal |
| **TOTAL** | **4,683** | | |

## Recommendation: Hybrid Approach

### 1. Dynamic Forms (for shared CRUD) — saves ~2,000+ lines

These forms are nearly identical across all modules:
- Customer form
- Expense form  
- Inventory form
- Staff form
- Profile form
- Branch settings

**How it works:**
```typescript
// Schema example (customer form)
const customerSchema: FormSchema = {
  fields: [
    { name: "name", label: "Nama", type: "text", required: true, placeholder: "Nama pelanggan" },
    { name: "phone", label: "Telepon", type: "tel", required: true, placeholder: "08xxx" },
    { name: "address", label: "Alamat", type: "textarea", required: false },
    { name: "notes", label: "Catatan", type: "textarea", required: false },
  ],
  submitLabel: "Simpan Pelanggan",
  apiEndpoint: "/api/customers",
};

// Usage in page
<DynamicForm schema={customerSchema} onSuccess={() => refresh()} />
```

### 2. Hand-Coded (for module-specific UX)

Order creation is fundamentally different per module:
- **Laundry**: per-kg pricing, garment breakdown, express surcharge
- **Salon**: service duration, stylist assignment, appointment time
- **F&B**: menu items, modifiers, table number, split bill

These CANNOT be dynamic — the UX is the product.

## What I Recommend Building

### DynamicForm Component (POC)

```
components/dynamic/
├── dynamic-form.tsx       // Core renderer (~200 lines)
├── field-types.ts         // Type definitions
├── validators.ts          // Schema-based validation
└── schemas/               // Per-module form definitions
    ├── customer.ts
    ├── expense.ts
    ├── inventory.ts
    ├── staff.ts
    └── profile.ts
```

### Benefits
- **Add new module** = add 1 schema file, not rewrite 6 forms
- **Change a field** = change 1 line in schema, not hunt across files
- **Validation** = declarative in schema, not repeated per form
- **i18n** = schema keys auto-resolve via t() function
- **RBAC** = schema can conditionally show/hide fields by role

### Trade-offs
- Order creation stays hand-coded (correct — UX matters)
- Services form stays partially hand-coded (complex batch edit UI)
- Learning curve for team on schema format
- Less pixel-perfect control (but can override per-field)
