package infrastructure

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/hivepos/api/internal/modules/branches/application"
	"github.com/hivepos/api/internal/modules/branches/domain"
)

type PgBranchRepository struct {
	db *sql.DB
}

func NewPgBranchRepository(db *sql.DB) *PgBranchRepository {
	return &PgBranchRepository{db: db}
}

// branchColumns lists every column we SELECT. JSON columns (operatingHours,
// pickupSlots) are read as raw []byte; the workDays int[] is cast to ::text and
// parsed with parseIntArray.
const branchColumns = `id, name, address, phone, "invoiceFooter", "isActive", "tenantId",
	latitude, longitude, "operatingHours", "whatsappLink", "googleMapsLink",
	"printerHost", "printerPort", "printerName", "printerEnabled", "printerLastSeen",
	"printerPaperSize", "coverageEnd", "isFreeTier", slug, "pickupSlots",
	"workDays"::text, "createdAt", "updatedAt"`

// nullableJSON scans a possibly-NULL JSON column into a json.RawMessage.
// PostgreSQL returns driver.Value <nil> for NULL; json.RawMessage cannot
// receive a nil, so we funnel through sql.NullString and yield an empty
// RawMessage (which marshals as omitted/empty) when the column is NULL.
func nullableJSON(dst *json.RawMessage, ns sql.NullString) {
	if !ns.Valid {
		*dst = json.RawMessage(nil)
		return
	}
	*dst = append((*dst)[:0], ns.String...)
}

// parseIntArray parses a postgres int[] text representation like {1,2,3}.
func parseIntArray(s string) []int32 {
	s = strings.TrimSpace(s)
	if s == "" || s == "{}" || s == "NULL" {
		return []int32{}
	}
	s = strings.TrimPrefix(s, "{")
	s = strings.TrimSuffix(s, "}")
	parts := strings.Split(s, ",")
	out := make([]int32, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if n, err := strconv.Atoi(p); err == nil {
			out = append(out, int32(n))
		}
	}
	return out
}

// jsonArrayOrNull marshals a Go value to JSON for an INSERT/UPDATE, returning
// NULL when marshalling yields "null".
func jsonArrayOrNull(v interface{}) (interface{}, error) {
	if v == nil {
		return nil, nil
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	if string(raw) == "null" {
		return nil, nil
	}
	return raw, nil
}

func (r *PgBranchRepository) Create(ctx context.Context, b *domain.Branch) error {
	operatingHours, err := jsonArrayOrNull(b.OperatingHours)
	if err != nil {
		return fmt.Errorf("marshal operatingHours: %w", err)
	}
	pickupSlots, err := jsonArrayOrNull(b.PickupSlots)
	if err != nil {
		return fmt.Errorf("marshal pickupSlots: %w", err)
	}
	workDays := workDaysOrDefault(b.WorkDays)
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "Branch" (name, address, phone, "invoiceFooter", "isActive", "tenantId",
			latitude, longitude, "operatingHours", "whatsappLink", "googleMapsLink",
			"printerHost", "printerPort", "printerName", "printerEnabled",
			"printerPaperSize", "isFreeTier", slug, "pickupSlots", "workDays", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW())
		RETURNING id, "createdAt", "updatedAt"`,
		b.Name, b.Address, b.Phone, b.InvoiceFooter, b.IsActive, b.TenantID,
		b.Latitude, b.Longitude, operatingHours, b.WhatsappLink, b.GoogleMapsLink,
		b.PrinterHost, b.PrinterPort, b.PrinterName, b.PrinterEnabled,
		b.PrinterPaperSize, b.IsFreeTier, b.Slug, pickupSlots, workDays,
	).Scan(&b.ID, &b.CreatedAt, &b.UpdatedAt)
}

// workDaysOrDefault coerces a nil/empty slice into the default {1,2,3,4,5,6}.
func workDaysOrDefault(wd []int32) string {
	if len(wd) == 0 {
		wd = []int32{1, 2, 3, 4, 5, 6}
	}
	parts := make([]string, len(wd))
	for i, d := range wd {
		parts[i] = strconv.Itoa(int(d))
	}
	return "{" + strings.Join(parts, ",") + "}"
}

func (r *PgBranchRepository) FindByID(ctx context.Context, id, tenantID string) (*domain.Branch, error) {
	b := &domain.Branch{}
	var (
		workDaysText   []byte
		operatingHours sql.NullString
		pickupSlots    sql.NullString
	)
	err := r.db.QueryRowContext(ctx, `
		SELECT `+branchColumns+` FROM "Branch" WHERE id = $1 AND "tenantId" = $2`, id, tenantID,
	).Scan(
		&b.ID, &b.Name, &b.Address, &b.Phone, &b.InvoiceFooter, &b.IsActive, &b.TenantID,
		&b.Latitude, &b.Longitude, &operatingHours, &b.WhatsappLink, &b.GoogleMapsLink,
		&b.PrinterHost, &b.PrinterPort, &b.PrinterName, &b.PrinterEnabled, &b.PrinterLastSeen,
		&b.PrinterPaperSize, &b.CoverageEnd, &b.IsFreeTier, &b.Slug, &pickupSlots,
		&workDaysText, &b.CreatedAt, &b.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding branch: %w", err)
	}
	nullableJSON(&b.OperatingHours, operatingHours)
	nullableJSON(&b.PickupSlots, pickupSlots)
	b.WorkDays = parseIntArray(string(workDaysText))
	return b, nil
}

func (r *PgBranchRepository) List(ctx context.Context, tenantID string, filter application.ListFilter) ([]*domain.Branch, int64, error) {
	where := `WHERE "tenantId" = $1`
	args := []interface{}{tenantID}
	idx := 2
	if filter.Search != "" {
		where += fmt.Sprintf(` AND name ILIKE $%d`, idx)
		args = append(args, "%"+filter.Search+"%")
		idx++
	}
	if filter.Active != "" {
		where += fmt.Sprintf(` AND "isActive" = $%d`, idx)
		args = append(args, filter.Active == "true")
		idx++
	}

	var total int64
	r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "Branch" `+where, args...).Scan(&total)

	offset := (filter.Page - 1) * filter.Limit
	query := fmt.Sprintf(`SELECT %s FROM "Branch" %s ORDER BY "createdAt" DESC LIMIT $%d OFFSET $%d`, branchColumns, where, idx, idx+1)
	args = append(args, filter.Limit, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying branches: %w", err)
	}
	defer rows.Close()

	var list []*domain.Branch
	for rows.Next() {
		b := &domain.Branch{}
		var (
			workDaysText   []byte
			operatingHours sql.NullString
			pickupSlots    sql.NullString
		)
		err := rows.Scan(
			&b.ID, &b.Name, &b.Address, &b.Phone, &b.InvoiceFooter, &b.IsActive, &b.TenantID,
			&b.Latitude, &b.Longitude, &operatingHours, &b.WhatsappLink, &b.GoogleMapsLink,
			&b.PrinterHost, &b.PrinterPort, &b.PrinterName, &b.PrinterEnabled, &b.PrinterLastSeen,
			&b.PrinterPaperSize, &b.CoverageEnd, &b.IsFreeTier, &b.Slug, &pickupSlots,
			&workDaysText, &b.CreatedAt, &b.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		nullableJSON(&b.OperatingHours, operatingHours)
		nullableJSON(&b.PickupSlots, pickupSlots)
		b.WorkDays = parseIntArray(string(workDaysText))
		list = append(list, b)
	}
	return list, total, nil
}

// ListItems returns the curated list DTO with per-branch counts, matching the TS
// BranchListItemDTO. Unpaginated (TS returns all outlets for the tenant).
func (r *PgBranchRepository) ListItems(ctx context.Context, tenantID string, filter application.ListFilter) ([]*application.BranchListItem, error) {
	where := `WHERE b."tenantId" = $1`
	args := []interface{}{tenantID}
	if filter.Search != "" {
		where += fmt.Sprintf(` AND b.name ILIKE $%d`, len(args)+1)
		args = append(args, "%"+filter.Search+"%")
	}
	if filter.Active != "" {
		where += fmt.Sprintf(` AND b."isActive" = $%d`, len(args)+1)
		args = append(args, filter.Active == "true")
	}
	query := fmt.Sprintf(`
		SELECT b.id, b.name, b.address, b.phone, b."invoiceFooter", b."isActive", b."isFreeTier", b."coverageEnd", b."createdAt",
			(SELECT COUNT(*) FROM "User" u WHERE u."branchId" = b.id),
			(SELECT COUNT(*) FROM "Order" o WHERE o."branchId" = b.id),
			(SELECT COUNT(*) FROM "Service" s WHERE s."branchId" = b.id),
			(SELECT COUNT(*) FROM "Customer" c WHERE c."branchId" = b.id)
		FROM "Branch" b %s ORDER BY b."createdAt" DESC`, where)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("querying branch items: %w", err)
	}
	defer rows.Close()

	var out []*application.BranchListItem
	for rows.Next() {
		it := &application.BranchListItem{}
		if err := rows.Scan(
			&it.ID, &it.Name, &it.Address, &it.Phone, &it.InvoiceFooter, &it.IsActive, &it.IsFreeTier, &it.CoverageEnd, &it.CreatedAt,
			&it.Counts.Users, &it.Counts.Orders, &it.Counts.Services, &it.Counts.Customers,
		); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, nil
}

func (r *PgBranchRepository) Update(ctx context.Context, b *domain.Branch) error {
	operatingHours, err := jsonArrayOrNull(b.OperatingHours)
	if err != nil {
		return fmt.Errorf("marshal operatingHours: %w", err)
	}
	pickupSlots, err := jsonArrayOrNull(b.PickupSlots)
	if err != nil {
		return fmt.Errorf("marshal pickupSlots: %w", err)
	}
	workDays := workDaysOrDefault(b.WorkDays)
	_, err = r.db.ExecContext(ctx, `
		UPDATE "Branch" SET name=$1, address=$2, phone=$3, "invoiceFooter"=$4, "isActive"=$5,
			latitude=$6, longitude=$7, "operatingHours"=$8, "whatsappLink"=$9, "googleMapsLink"=$10,
			"printerHost"=$11, "printerPort"=$12, "printerName"=$13, "printerEnabled"=$14,
			"printerPaperSize"=$15, "isFreeTier"=$16, slug=$17, "pickupSlots"=$18, "workDays"=$19,
			"updatedAt"=NOW() WHERE id=$20`,
		b.Name, b.Address, b.Phone, b.InvoiceFooter, b.IsActive,
		b.Latitude, b.Longitude, operatingHours, b.WhatsappLink, b.GoogleMapsLink,
		b.PrinterHost, b.PrinterPort, b.PrinterName, b.PrinterEnabled,
		b.PrinterPaperSize, b.IsFreeTier, b.Slug, pickupSlots, workDays, b.ID)
	return err
}

func (r *PgBranchRepository) Delete(ctx context.Context, id, tenantID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM "Branch" WHERE id=$1 AND "tenantId"=$2`, id, tenantID)
	return err
}
