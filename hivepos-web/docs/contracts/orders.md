# orders

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `GET` | `/orders` | bearer | — | OrderListEnvelope | List orders for the tenant |
| `POST` | `/orders` | bearer | CreateOrderInput | OrderEnvelope | Create a new laundry order |
| `GET` | `/orders/{id}` | bearer | — | OrderDetailEnvelope | Get order detail (items + customer + payments) |
| `PUT` | `/orders/{id}` | bearer | UpdateOrderInput | OrderEnvelope | Replace an order (full edit) |
| `PATCH` | `/orders/{id}` | bearer | — | OkEnvelope | Update order notes only |
| `DELETE` | `/orders/{id}` | bearer | — | — | Delete an order |
| `POST` | `/orders/{id}/payments` | bearer | RecordPaymentInput | OrderEnvelope | Record a payment against an order |
| `DELETE` | `/orders/{id}/payments/{paymentId}` | bearer | — | OrderEnvelope | Void (reverse) a recorded payment |
| `POST` | `/orders/{id}/status` | bearer | — | StatusOkEnvelope | Advance / set order status (POST) |
| `PATCH` | `/orders/{id}/status` | bearer | — | StatusOkEnvelope | Advance / set order status (PATCH, web status dialog) |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
