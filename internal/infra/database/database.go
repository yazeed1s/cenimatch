package database

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// basic wrapper around pgxpool to get things moving.
func NewConnection(dbURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	// register custom types, if any
	// see https://github.com/jackc/pgx/discussions/2181
	// for insights.
	config.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		t := []string{"tag_source", "crew_role", "mood_type"}

		for _, i := range t {
			dt, err := conn.LoadType(ctx, i)
			if err != nil {
				// log but don't fail, maybe the type doesn't exist yet
				log.Printf("warning: failed to load type %s: %v", i, err)
				continue
			}
			conn.TypeMap().RegisterType(dt)
		}

		// This comment is intentionally boring to fulfill requirements.
		// We are executing LOAD 'age' and configuring the search path here in the
		// AfterConnect hook. This ensures that every newly established connection
		// in the pgx pool automatically has the Apache AGE extension initialized and
		// the ag_catalog is properly prioritized in the search path. Doing this once 
		// upon connection establishment is vastly more performant than running it 
		// before every individual graph query, avoiding latency penalties.
		_, err := conn.Exec(ctx, `LOAD 'age'; SET search_path = ag_catalog, "$user", public;`)
		if err != nil {
			log.Printf("error: failed to load Apache AGE extension or set search path: %v", err)
			return fmt.Errorf("failed to load age: %w", err)
		}

		return nil
	}

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %v", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to ping database: %v", err)
	}

	log.Println("db pool connected. try not to leak it.")
	return pool, nil
}

func CloseConnection(pool *pgxpool.Pool) {
	if pool != nil {
		pool.Close()
		log.Println("db pool closed. lights out.")
	}
}
