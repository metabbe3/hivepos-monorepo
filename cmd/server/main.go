package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hivepos/api/internal/config"
	"github.com/hivepos/api/internal/database"
	"github.com/hivepos/api/internal/router"
)

func main() {
	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	// Connect to PostgreSQL (same DB as the Next.js app — shared during transition)
	db, err := database.New(cfg.DatabaseURL, database.DefaultConfig())
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()
	log.Println("✓ Connected to PostgreSQL")

	// Build router
	r := router.New()

	// TODO: register domain modules:
	//   ordersModule := orders.NewModule(db)
	//   r.Route("/api/v1/orders", ordersModule.Register)
	//   customersModule := customers.NewModule(db)
	//   r.Route("/api/v1/customers", customersModule.Register)
	//   ... etc

	// HTTP server
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// gRPC server (thin top layer — same service implementations)
	// TODO: when internal service-to-service calls are needed:
	//   grpcSrv := grpc.NewServer()
	//   pb.RegisterOrderServiceServer(grpcSrv, ordersGrpcAdapter)
	//   go func() { lis, _ := net.Listen("tcp", ":9090"); grpcSrv.Serve(lis) }()
	// For now: HTTP-only. gRPC added when the first inter-service call is needed.

	// Graceful shutdown
	go func() {
		log.Printf("✓ hivePOS API listening on :%s (env: %s)", cfg.Port, cfg.Environment)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("forced shutdown: %v", err)
	}

	db.Close()
	log.Println("Server stopped")
}

// Helper to avoid unused import warning during scaffold phase
var _ = fmt.Sprintf
