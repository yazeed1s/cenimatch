package main

import (
	"cenimatch/internal/config"
	"cenimatch/internal/migrator"
	"context"
	"fmt"
	"log"
	"os"
	"time"
)

func main() {
	config.LoadEnvironment()
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	cmd := migrator.ParseCommand(os.Args)

	p, err := migrator.ConnectDB(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer p.Close()

	m := migrator.New(p, "migration")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	switch cmd {
	case "reset":
		if err := m.Reset(ctx); err != nil {
			log.Fatalf("reset: %v", err)
		}
	case "drop":
		if err := m.DropAllTables(ctx); err != nil {
			log.Fatalf("drop: %v", err)
		}
	case "create":
		if err := m.CreateTables(ctx); err != nil {
			log.Fatalf("create: %v", err)
		}
	case "status":
		if err := status(ctx, m); err != nil {
			log.Fatalf("status: %v", err)
		}
	case "help":
		migrator.PrintHelp()
	default:
		fmt.Printf("unknown: %s\n", cmd)
		migrator.PrintHelp()
		os.Exit(1)
	}
}

func status(ctx context.Context, m *migrator.Migrator) error {
	if err := m.CheckConnection(ctx); err != nil {
		fmt.Printf("connection: no (%v)\n", err)
		return err
	}
	fmt.Println("connection: ok")

	n, err := m.GetTableCount(ctx)
	if err != nil {
		return fmt.Errorf("table count: %w", err)
	}
	fmt.Printf("tables: %d\n", n)

	if n > 0 {
		tbl, err := m.ListTables(ctx)
		if err != nil {
			return fmt.Errorf("list tables: %w", err)
		}
		for _, t := range tbl {
			fmt.Printf("  • %s\n", t)
		}
	}
	return nil
}
