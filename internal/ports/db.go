package ports

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DBManager is the interface for database operations.
// any db in use should satisfy this interface.
type DBManager interface {
	WithTx(ctx context.Context, fn func(txCtx context.Context) error) error
	WithTxOptions(
		ctx context.Context,
		opts *pgx.TxOptions,
		fn func(txCtx context.Context) error,
	) error
	InTx(ctx context.Context) bool
	GetTx(ctx context.Context) pgx.Tx
	GetExecutor(ctx context.Context) interface{}
	Exec(ctx context.Context, query string, args ...any) (pgconn.CommandTag, error)
	QueryRow(ctx context.Context, query string, args ...any) pgx.Row
	Query(ctx context.Context, query string, args ...any) (pgx.Rows, error)
	Pool() *pgxpool.Pool
	Close() error
}
