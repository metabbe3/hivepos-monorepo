# hivePOS — Flutter Integration Guide

Everything you need to build a native Android/iOS client for hivePOS. The API is
already mobile-ready: bearer-token auth, tenant context baked into the token,
and a uniform JSON envelope. See [`openapi.yaml`](./openapi.yaml) for the full
machine-readable reference.

## 1. Base URL & tenant routing

```yaml
# pubspec.yaml
dependencies:
  dio: ^5.4.0
  flutter_secure_storage: ^9.0.0
```

```dart
const String baseUrl = 'https://hivepos.id'; // or http://localhost:3007 in dev
```

**Authenticated calls need NO subdomain and NO `?tenant=` param.** `tenantId`,
`branchId`, permissions and feature flags are all inside the JWT you get at
login. The server reads them from the token (not the host) on every request.

Only the **public** endpoints need tenant context, because they have no token:
send `?tenant=<slug>` (or the `x-tenant-slug` header):

```dart
// Public order tracking — tenant required (no auth):
final res = await dio.get('/api/track/ORD-1234?tenant=berkah');
```

## 2. Authentication

### 2.1 Login → token

```dart
final res = await dio.post('/api/auth/login', data: {
  'email': email,
  'password': password,
  // 'scope': 'super-admin', // only for platform staff
});
final token  = res.data['data']['token'] as String;
final user   = res.data['data']['user'] as Map<String, dynamic>;
final expiresAt = res.data['data']['expiresAt'] as int; // unix ms, ~8h ahead

await const FlutterSecureStorage().write(key: 'hivepos_token', value: token);
```

- **Store the token in `flutter_secure_storage`** (Android Keystore / iOS
  Keychain). Never `SharedPreferences` — that's plaintext.
- The token is a NextAuth session JWT. Send it as
  `Authorization: Bearer <token>` everywhere else.
- **8-hour lifetime, no refresh token.** When it expires you get `401` →
  re-authenticate with `/api/auth/login`.
- **Single-session enforced.** If the user logs in elsewhere, or an admin
  revokes sessions, `sessionVersion` bumps and your token starts returning
  `401`. Poll `/api/auth/session-version` periodically (or just react to `401`)
  and re-login.

### 2.2 Handling 401

Treat any `401` (`error.code == "UNAUTHENTICATED"`) as "token dead": clear
stored token and route to the login screen. Don't silently retry forever.

### 2.3 Login errors

| Status | `error.code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Malformed email/password |
| 401 | `UNAUTHENTICATED` | Wrong email/password |
| 403 | `FORBIDDEN` | Account pending approval / suspended |
| 429 | `RATE_LIMITED` | >10 login attempts/min from this IP — back off |

## 3. The response contract

Every response uses one envelope. Check `success` first.

```jsonc
// Success (single)
{ "success": true, "data": { /* the object */ } }

// Success (paginated list)
{ "success": true, "data": [ /* objects */ ],
  "meta": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 } }

// Error
{ "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Nama wajib diisi.",
    "details": [ { "field": "items.0.quantity", "message": "Must be positive" } ]
  } }
```

### Status codes

`200` ok · `201` created · `400` validation/business · `401` unauthenticated ·
`403` forbidden · `404` not found · `409` conflict · `429` rate-limited ·
`500`/`502` server. **Deletes return `200 { data: { deleted: true } }` — there
is no `204`.**

### `error.code` enum (localize on these, not `message`)

`VALIDATION_ERROR`, `INVALID_INPUT`, `UNAUTHENTICATED`, `FORBIDDEN`,
`INSUFFICIENT_PERMISSION`, `NOT_FOUND`, `CONFLICT`, `BUSINESS_RULE_VIOLATION`,
`INVALID_STATUS_TRANSITION`, `INSUFFICIENT_BALANCE`, `OUTLET_LOCKED`,
`SUBSCRIPTION_LIMIT_REACHED`, `RATE_LIMITED`, `DATABASE_ERROR`,
`EXTERNAL_SERVICE_ERROR`, `INTERNAL_ERROR`.

## 4. Type mapping (Dart)

| API | Dart |
|---|---|
| money / Decimal | `double` (server sends a JSON number, e.g. `150000.0`) |
| date / timestamp | `DateTime` via `DateTime.parse(iso)` (ISO-8601, UTC) |
| id | `String` (UUID) |
| nullable fields | `null` in JSON → nullable Dart field (don't assume presence) |
| `permissions[]` | `List<String>` like `["orders:read","orders:create"]` |

> Use `double` for money only for display/transport. For exact arithmetic (e.g.
> summing a drawer), keep values in integer **rupiah** (`(amount * 100).round()`)
> to avoid float drift.

## 5. RBAC & permissions

The login `user` object includes `permissions` (`resource:action`) and `role`.

- Before showing/doing an action, gate on `permissions.contains("$resource:$action")`
  for a snappy UI. The server enforces it anyway — never trust client gating for
  security.
- `role == "SUPER_ADMIN"` bypasses all checks.
- Missing permission → `403` (`INSUFFICIENT_PERMISSION` or `FORBIDDEN`).
- Subscription expired / plan limit → `403` with `OUTLET_LOCKED` or
  `SUBSCRIPTION_LIMIT_REACHED`.

## 6. Branch context

`user.branchId` may be the literal string `"ALL"` when the user manages multiple
outlets (`user` has no `isAllOutlets` field — check `branchId == "ALL"`). List
endpoints then return data across all branches the user can see. You don't send
a branch on requests; the token carries it. (Switching branch is a web-only
session-update flow today.)

## 7. Offline sync (idempotency)

`POST /api/orders` and `POST /api/customers` accept an **`X-Client-Id`** request
header. Generate a UUID per locally-created record; if the same `X-Client-Id`
arrives twice (retry after reconnect), the server returns the original record
instead of creating a duplicate. Send it from a background sync queue.

## 8. File uploads (order photos)

`POST /api/orders/{id}/photos` is `multipart/form-data` with two fields:
`kind` (`before` | `after` | `damage`) and `file` (image). Photos are compressed
to WebP server-side and expire after ~30 days.

```dart
final form = FormData.fromMap({
  'kind': 'before',
  'file': await MultipartFile.fromFile(filePath, filename: 'before.jpg'),
});
await dio.post('/api/orders/$orderId/photos', data: form);
```

> Requires the `orderPhotos` feature flag (Pro plan). If disabled, expect `403`.

## 9. Endpoints to avoid on mobile

`/api/printers/scan`, `/api/printers/test`, `/api/print` (LAN TCP printing),
`/api/pwa/nonce`, `/api/super-admin/pwa/force-update` (PWA service worker),
`/api/user/profile/oauth-link/start` (browser OAuth redirect). See
[`README.md`](./README.md) for the full table.

## 10. Copy-paste: a minimal client

```dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class HivePosApi {
  HivePosApi(this.baseUrl) {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Accept': 'application/json'},
    ));
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (opts, handler) async {
        final token = await const FlutterSecureStorage().read(key: 'hivepos_token');
        if (token != null) opts.headers['Authorization'] = 'Bearer $token';
        handler.next(opts);
      },
      onError: (e, handler) {
        // 401 → token dead: clear it, surface a "re-login needed" state.
        if (e.response?.statusCode == 401) {
          const FlutterSecureStorage().delete(key: 'hivepos_token');
        }
        handler.next(e);
      },
    ));
  }

  late final Dio _dio;

  /// Unwraps the { success, data } envelope; throws [ApiException] on failure.
  Future<dynamic> _call(String method, String path, {dynamic data, Map<String, dynamic>? query}) async {
    try {
      final res = await _dio.request(path, data: data, queryParameters: query, options: Options(method: method));
      final body = res.data as Map<String, dynamic>;
      if (body['success'] == true) return body['data'];
      throw ApiException(body['error'] as Map<String, dynamic>);
    } on DioException catch (e) {
      final errBody = e.response?.data;
      if (errBody is Map<String, dynamic> && errBody['success'] == false) {
        throw ApiException(errBody['error'] as Map<String, dynamic>);
      }
      rethrow;
    }
  }

  // ── Auth ──
  Future<Map<String, dynamic>> login(String email, String password, {String? scope}) async {
    final data = await _call('POST', '/api/auth/login',
        data: {'email': email, 'password': password, if (scope != null) 'scope': scope});
    await const FlutterSecureStorage().write(key: 'hivepos_token', value: data['token'] as String);
    return data as Map<String, dynamic>;
  }

  Future<void> logout() async {
    await const FlutterSecureStorage().delete(key: 'hivepos_token');
  }

  // ── Sample calls ──
  Future<List<dynamic>> listOrders({int page = 1, int limit = 20}) async {
    final data = await _call('GET', '/api/orders', query: {'page': page, 'limit': limit});
    return data as List<dynamic>;
  }

  Future<Map<String, dynamic>> createOrder(Map<String, dynamic> order, {String? clientId}) async {
    return (await _call('POST', '/api/orders', data: order)) as Map<String, dynamic>;
    // pass clientId via header in a real offline-sync path
  }

  Future<Map<String, dynamic>> payOrder(String orderId, {required double amount, required String method}) async {
    return (await _call('POST', '/api/orders/$orderId/payments',
        data: {'amount': amount, 'paymentMethod': method})) as Map<String, dynamic>;
  }
}

class ApiException implements Exception {
  ApiException(this.error);
  final Map<String, dynamic> error; // { code, message, details? }
  String get code => error['code'] as String;
  String get message => error['message'] as String;
  @override
  String toString() => 'ApiException($code): $message';
}
```

## 11. Security checklist

- ✅ Store the token in `flutter_secure_storage` (Keystore/Keychain).
- ✅ Clear the token on `401`.
- ⚠️ Consider **certificate pinning** (`dio` + a pinned cert/SPKI) for
  production, especially on untrusted networks.
- ⚠️ Respect the login rate limit (10/min/IP) — don't auto-retry failed logins
  in a tight loop.
- ⚠️ Don't log request/response bodies in release builds (they can contain PII
  / phone numbers / balances).

## 12. Quick smoke test (curl)

```bash
BASE=http://localhost:3007

# 1. login
TOKEN=$(curl -s $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"owner@demo.id","password":"demo"}' | jq -r '.data.token')
echo "token: ${TOKEN:0:20}..."

# 2. use it
curl -s $BASE/api/orders -H "Authorization: Bearer $TOKEN" | jq '.success, (.data | length)'
curl -s $BASE/api/auth/session-version -H "Authorization: Bearer $TOKEN" | jq

# 3. errors
curl -s $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"owner@demo.id","password":"wrong"}' | jq '.error.code' # → UNAUTHENTICATED
```
