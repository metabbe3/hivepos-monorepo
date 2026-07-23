# whatsapp

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `POST` | `/whatsapp/connect` | bearer | WhatsAppConnectInput | WhatsAppConnectResult | Initiate a WhatsApp session for the current tenant |
| `POST` | `/whatsapp/disconnect` | bearer | WhatsAppDisconnectInput | WhatsAppDisconnectResult | Tear down the WhatsApp session for the current tenant |
| `GET` | `/whatsapp/qr` | bearer | — | WhatsAppQR | Get the pairing QR code for the current tenant |
| `POST` | `/whatsapp/send` | bearer | WhatsAppSendInput | WhatsAppSendResult | Send a WhatsApp message for the current tenant |
| `GET` | `/whatsapp/status` | bearer | — | WhatsAppStatus | Get WhatsApp connection status for the current tenant |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
