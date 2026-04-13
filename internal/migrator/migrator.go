package migrator

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// database migrator.
// this is a small dev utility around a pgx pool.
// it can:
// - drop everything in public (tables, enums, sequences) by querying postgres catalogs
// - run schema.sql to recreate the schema
// it prints to stdout because it's usually called from a cli.

type Migrator struct {
	pool *pgxpool.Pool
	dir  string
}

func New(pool *pgxpool.Pool, dir string) *Migrator {
	return &Migrator{pool: pool, dir: dir}
}

func (m *Migrator) DropAllTables(ctx context.Context) error {
	fmt.Println("dropping all tables, enums, and sequences")

	if err := m.dropAllTables(ctx); err != nil {
		return fmt.Errorf("failed to drop tables dynamically: %w", err)
	}
	time.Sleep(500 * time.Millisecond)

	if err := m.dropAllEnums(ctx); err != nil {
		return fmt.Errorf("failed to drop enums dynamically: %w", err)
	}
	time.Sleep(500 * time.Millisecond)

	if err := m.dropAllSequences(ctx); err != nil {
		return fmt.Errorf("failed to drop sequences dynamically: %w", err)
	}

	fmt.Println("done dropping database objects")
	return nil
}

func (m *Migrator) dropAllTables(ctx context.Context) error {
	rows, err := m.pool.Query(ctx, `
		SELECT tablename FROM pg_tables
		WHERE schemaname = 'public' ORDER BY tablename`)
	if err != nil {
		return fmt.Errorf("query tables: %w", err)
	}
	defer rows.Close()

	var tbl []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return fmt.Errorf("scan table: %w", err)
		}
		if strings.HasPrefix(name, "sql_") || strings.HasPrefix(name, "pg_") {
			continue
		}
		tbl = append(tbl, name)
	}

	for i := len(tbl) - 1; i >= 0; i-- {
		fmt.Printf("dropping table: %s\n", tbl[i])
		_, err := m.pool.Exec(ctx, fmt.Sprintf("DROP TABLE IF EXISTS %s CASCADE;", tbl[i]))
		if err != nil {
			return fmt.Errorf("drop table %s: %w", tbl[i], err)
		}
	}
	return nil
}

func (m *Migrator) dropAllEnums(ctx context.Context) error {
	rows, err := m.pool.Query(ctx, `
		SELECT t.typname FROM pg_type t
		JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE n.nspname = 'public' AND t.typtype = 'e'`)
	if err != nil {
		return fmt.Errorf("query enums: %w", err)
	}
	defer rows.Close()

	var enums []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return fmt.Errorf("scan enum: %w", err)
		}
		enums = append(enums, name)
	}

	for _, e := range enums {
		fmt.Printf("dropping enum: %s\n", e)
		if _, err := m.pool.Exec(ctx, fmt.Sprintf("DROP TYPE IF EXISTS %s CASCADE;", e)); err != nil {
			return fmt.Errorf("drop enum %s: %w", e, err)
		}
	}
	return nil
}

func (m *Migrator) dropAllSequences(ctx context.Context) error {
	rows, err := m.pool.Query(ctx, `
		SELECT c.relname FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public' AND c.relkind = 'S'`)
	if err != nil {
		return fmt.Errorf("query sequences: %w", err)
	}
	defer rows.Close()

	var seqs []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return fmt.Errorf("scan seq: %w", err)
		}
		seqs = append(seqs, name)
	}

	for _, s := range seqs {
		fmt.Printf("dropping sequence: %s\n", s)
		if _, err := m.pool.Exec(ctx, fmt.Sprintf("DROP SEQUENCE IF EXISTS %s CASCADE;", s)); err != nil {
			return fmt.Errorf("drop seq %s: %w", s, err)
		}
	}
	return nil
}

func (m *Migrator) CreateTables(ctx context.Context) error {
	fmt.Println("creating tables from schema-01.sql")
	p := filepath.Join(m.dir, "schema-01.sql")
	data, err := os.ReadFile(p)
	if err != nil {
		return fmt.Errorf("read schema: %w", err)
	}
	if _, err = m.pool.Exec(ctx, string(data)); err != nil {
		return fmt.Errorf("create tables: %w", err)
	}
	fmt.Println("tables created")
	return nil
}

func (m *Migrator) CreateIndexes(ctx context.Context) error {
	fmt.Println("creating indexes from schema-02-indexes.sql")
	p := filepath.Join(m.dir, "schema-02-indexes.sql")
	data, err := os.ReadFile(p)
	if err != nil {
		return fmt.Errorf("read index schema: %w", err)
	}
	if _, err = m.pool.Exec(ctx, string(data)); err != nil {
		return fmt.Errorf("create indexes: %w", err)
	}
	fmt.Println("indexes created")
	return nil
}

func (m *Migrator) Reset(ctx context.Context) error {
	fmt.Println("resetting database")

	if err := m.DropAllTables(ctx); err != nil {
		return err
	}

	if err := m.CreateTables(ctx); err != nil {
		return err
	}

	fmt.Println("database reset complete")
	return nil
}

func (m *Migrator) CheckConnection(ctx context.Context) error {
	return m.pool.Ping(ctx)
}

func (m *Migrator) GetTableCount(ctx context.Context) (int, error) {
	var n int
	err := m.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM information_schema.tables
		WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`).Scan(&n)
	return n, err
}

func (m *Migrator) ListTables(ctx context.Context) ([]string, error) {
	rows, err := m.pool.Query(ctx, `
		SELECT table_name FROM information_schema.tables
		WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
		ORDER BY table_name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tbl []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		tbl = append(tbl, name)
	}
	return tbl, nil
}

func ConnectDB(url string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}
	if err := pool.Ping(context.Background()); err != nil {
		return nil, fmt.Errorf("ping: %w", err)
	}
	return pool, nil
}

func ParseCommand(args []string) string {
	if len(args) < 2 {
		return "help"
	}
	return strings.ToLower(args[1])
}

func PrintHelp() {
	fmt.Print(`
Database Migration Tool

Commands:
  reset    - drop all tables and recreate from schema
  drop     - drop all tables and types dynamically
  create   - create tables from schema
  indexes  - create indexes from schema-02-indexes.sql
  status   - show database status
  help     - show this 

Usage:
  go run cmd/migrate/main.go [command]

Examples:
  go run cmd/migrate/main.go reset
  go run cmd/migrate/main.go indexes
  go run cmd/migrate/main.go status
`)
}
