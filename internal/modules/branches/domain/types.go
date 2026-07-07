package domain

import (
	"encoding/json"
	"time"
)

// Branch is the per-tenant outlet entity. JSON columns (operatingHours,
// pickupSlots) decode into json.RawMessage to preserve shape; the Int array
// (workDays) decodes into a []int32.
type Branch struct {
	ID                string          `json:"id"`
	Name              string          `json:"name"`
	Address           *string         `json:"address"`
	Phone             *string         `json:"phone"`
	InvoiceFooter     *string         `json:"invoiceFooter"`
	IsActive          bool            `json:"isActive"`
	TenantID          string          `json:"tenantId"`
	Latitude          *float64        `json:"latitude"`
	Longitude         *float64        `json:"longitude"`
	OperatingHours    json.RawMessage `json:"operatingHours,omitempty"`
	WhatsappLink      *string         `json:"whatsappLink"`
	GoogleMapsLink    *string         `json:"googleMapsLink"`
	PrinterHost       *string         `json:"printerHost"`
	PrinterPort       int             `json:"printerPort"`
	PrinterName       *string         `json:"printerName"`
	PrinterEnabled    bool            `json:"printerEnabled"`
	PrinterLastSeen   *time.Time      `json:"printerLastSeen,omitempty"`
	PrinterPaperSize  string          `json:"printerPaperSize"`
	CoverageEnd       *time.Time      `json:"coverageEnd,omitempty"`
	IsFreeTier        bool            `json:"isFreeTier"`
	Slug              *string         `json:"slug"`
	PickupSlots       json.RawMessage `json:"pickupSlots,omitempty"`
	WorkDays          []int32         `json:"workDays"`
	CreatedAt         time.Time       `json:"createdAt"`
	UpdatedAt         time.Time       `json:"updatedAt"`
}
