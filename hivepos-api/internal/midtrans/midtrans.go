package midtrans

import (
	"bytes"
	"context"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// snapBaseURL returns the Midtrans Snap API base for the given env.
func snapBaseURL(env string) string {
	if env == "production" {
		return "https://app.midtrans.com/snap/v1/transactions"
	}
	return "https://app.sandbox.midtrans.com/snap/v1/transactions"
}

// ItemDetail mirrors one Midtrans item_details entry.
type ItemDetail struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Price    float64 `json:"price"`
	Quantity int     `json:"quantity"`
}

// TransactionRequest is the body POSTed to the Snap API.
type TransactionRequest struct {
	OrderID         string       // merchant order id (stored on SaaSPayment.providerOrderId)
	GrossAmount     float64      // total
	TenantName      string       // customer first_name (truncated to 50)
	OwnerEmail      string       // customer email
	Item            ItemDetail   // single subscription line
	CustomField1    string       // e.g. "outlets:N"
	CustomField2    string       // e.g. "months:N"
}

// TransactionResult is what the Snap API returns.
type TransactionResult struct {
	Token       string `json:"token"`
	RedirectURL string `json:"redirect_url"`
}

// CreateTransaction calls the Midtrans Snap API to mint a real Snap token.
// No SDK dependency — a plain authenticated POST (Basic serverKey:).
func CreateTransaction(ctx context.Context, serverKey, env string, req TransactionRequest) (*TransactionResult, error) {
	if serverKey == "" {
		return nil, fmt.Errorf("midtrans server key not configured")
	}
	body := map[string]any{
		"transaction_details": map[string]any{
			"order_id":     req.OrderID,
			"gross_amount": req.GrossAmount,
		},
		"item_details": []map[string]any{
			{"id": req.Item.ID, "name": req.Item.Name, "price": req.Item.Price, "quantity": req.Item.Quantity},
		},
		"customer_details": map[string]any{
			"first_name": truncate(req.TenantName, 50),
			"email":      req.OwnerEmail,
		},
	}
	if req.CustomField1 != "" || req.CustomField2 != "" {
		body["custom_field1"] = req.CustomField1
		body["custom_field2"] = req.CustomField2
	}
	raw, _ := json.Marshal(body)

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, snapBaseURL(env), bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	// Midtrans Snap uses Basic auth with the Server Key as the username and an empty password.
	httpReq.SetBasicAuth(serverKey, "")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("midtrans request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("midtrans %d: %s", resp.StatusCode, string(respBody))
	}

	var out TransactionResult
	if err := json.Unmarshal(respBody, &out); err != nil {
		return nil, fmt.Errorf("midtrans decode: %w", err)
	}
	if out.Token == "" {
		return nil, fmt.Errorf("midtrans: empty token in response: %s", string(respBody))
	}
	return &out, nil
}

// VerifySignature checks the Midtrans webhook signature_key.
// Signature = sha512(orderID + statusCode + grossAmount + serverKey).
func VerifySignature(serverKey, orderID, statusCode, grossAmount, signatureKey string) bool {
	if serverKey == "" || signatureKey == "" {
		return false
	}
	sum := sha512.Sum512([]byte(orderID + statusCode + grossAmount + serverKey))
	return hex.EncodeToString(sum[:]) == signatureKey
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
