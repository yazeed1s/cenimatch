package database

import (
	"cenimatch/internal/ports"
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// this mess is to allow atomic db operations.
// if we have a read/write that spans many tables, and is atomic in nature,
// we can wrap it in a transaction.

// example for this:
/*
func (c *Caller) op(ctx context.Context) error {
	return c.db.WithTx(ctx, func(txCtx context.Context) error {
		if err := c.repo.doThing1(txCtx); err != nil {
			return err
		}
		if err := c.repo.doThing2(txCtx); err != nil {
			return err
		}

		// doThing1 and doThing2 are now atomic.
		// if one fails, all fail.
		// the routine will exist and roll back any db transactions
		// in between
		return nil
	})
}
*/

type txKey struct{}

// handles db ops. manages transactions seamlessly.
// wraps either a pool or a tx.
type DBManager struct {
	pool *pgxpool.Pool
}

var _ ports.DBManager = (*DBManager)(nil)

// wraps the pool.
func NewDBManager(pool *pgxpool.Pool) *DBManager {
	if pool == nil {
		panic("database connection pool cannot be nil")
	}
	return &DBManager{pool: pool}
}

func (dm *DBManager) GetTx(ctx context.Context) pgx.Tx {
	tx, _ := ctx.Value(txKey{}).(pgx.Tx)
	return tx
}

func (dm *DBManager) InTx(ctx context.Context) bool {
	return dm.GetTx(ctx) != nil
}
func (dm *DBManager) GetExecutor(ctx context.Context) interface{} {
	if tx := dm.GetTx(ctx); tx != nil {
		return tx
	}
	return dm.pool
}

func (dm *DBManager) WithTx(ctx context.Context, fn func(txCtx context.Context) error) error {
	return dm.WithTxOptions(ctx, nil, fn)
}
func (dm *DBManager) WithTxOptions(
	ctx context.Context,
	opts *pgx.TxOptions,
	fn func(txCtx context.Context) error,
) error {
	if dm.InTx(ctx) {
		return fmt.Errorf("nested transactions are not supported")
	}

	var tx pgx.Tx
	var err error

	if opts != nil {
		tx, err = dm.pool.BeginTx(ctx, *opts)
	} else {
		tx, err = dm.pool.Begin(ctx)
	}

	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	txCtx := context.WithValue(ctx, txKey{}, tx)
	var c bool

	defer func() {
		if c {
			return
		}
		if p := recover(); p != nil {
			log.Printf("panic in tx: %v. rolling back. great job.", p)
			if rbErr := tx.Rollback(ctx); rbErr != nil {
				log.Printf("rollback failed after panic: %v. just not your day is it.", rbErr)
			}
			panic(p)
		}

		// if error
		if err != nil {
			log.Printf("rolling back tx due to error: %v. cleaning up the mess.", err)
			if rbErr := tx.Rollback(ctx); rbErr != nil {
				log.Printf("rollback failed: %v. it keeps getting worse.", rbErr)
			}
		}
	}()

	// if no errors, run and commit tx
	err = fn(txCtx)
	if err != nil {
		return fmt.Errorf("transaction function failed: %w", err)
	}

	if commitErr := tx.Commit(ctx); commitErr != nil {
		c = true
		log.Printf("commit failed: %v. so close.", commitErr)
		return fmt.Errorf("failed to commit transaction: %w", commitErr)
	}

	c = true
	log.Printf("tx committed")
	return nil
}

// interface satisfaction

func (dm *DBManager) Exec(
	ctx context.Context,
	query string,
	args ...any,
) (pgconn.CommandTag, error) {
	if tx := dm.GetTx(ctx); tx != nil {
		return tx.Exec(ctx, query, args...)
	}
	return dm.pool.Exec(ctx, query, args...)
}

func (dm *DBManager) QueryRow(ctx context.Context, query string, args ...any) pgx.Row {
	if tx := dm.GetTx(ctx); tx != nil {
		return tx.QueryRow(ctx, query, args...)
	}
	return dm.pool.QueryRow(ctx, query, args...)
}

func (dm *DBManager) Query(ctx context.Context, query string, args ...any) (pgx.Rows, error) {
	if tx := dm.GetTx(ctx); tx != nil {
		return tx.Query(ctx, query, args...)
	}
	return dm.pool.Query(ctx, query, args...)
}

// this exposes the raw pool. use with caution.
func (dm *DBManager) Pool() *pgxpool.Pool {
	return dm.pool
}

func (dm *DBManager) Close() error {
	if dm.pool != nil {
		dm.pool.Close()
	}
	return nil
}
