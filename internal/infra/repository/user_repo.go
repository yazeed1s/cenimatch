package repository

import (
	"cenimatch/internal/domain"
	"cenimatch/internal/ports"
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type UserRepo struct {
	db ports.DBManager
}

func NewUserRepo(db ports.DBManager) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) CreateUser(ctx context.Context, user *domain.User) error {
	sql := `
		INSERT INTO users (id, username, email, password_hash)
		VALUES ($1, $2, $3, $4)
		RETURNING created_at, updated_at`

	err := r.db.QueryRow(ctx, sql,
		user.ID,
		user.Username,
		user.Email,
		user.PasswordHash,
	).Scan(&user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		return mapPgError(err)
	}
	return nil
}

func (r *UserRepo) GetUserByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	return r.getUser(ctx, `SELECT * FROM users WHERE id = $1`, id)
}

func (r *UserRepo) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	return r.getUser(ctx, `SELECT * FROM users WHERE email = $1`, email)
}

func (r *UserRepo) GetUserByUsername(ctx context.Context, username string) (*domain.User, error) {
	return r.getUser(ctx, `SELECT * FROM users WHERE username = $1`, username)
}

func (r *UserRepo) getUser(ctx context.Context, query string, arg interface{}) (*domain.User, error) {
	// explicit column list so we don't depend on SELECT * column order
	sql := `
		SELECT id, username, email, password_hash,
		       is_active, last_login, created_at, updated_at
		FROM users
		WHERE `

	// extract the WHERE clause from the passed query
	parts := strings.SplitN(query, "WHERE", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("bad query")
	}
	sql += strings.TrimSpace(parts[1])

	var u domain.User
	err := r.db.QueryRow(ctx, sql, arg).Scan(
		&u.ID,
		&u.Username,
		&u.Email,
		&u.PasswordHash,
		&u.IsActive,
		&u.LastLogin,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
		return nil, fmt.Errorf("query user: %w", err)
	}
	return &u, nil
}

func (r *UserRepo) UpdateLastLogin(ctx context.Context, id uuid.UUID) error {
	sql := `UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, sql, id)
	return err
}

func (r *UserRepo) StoreRefreshToken(ctx context.Context, token *domain.RefreshToken) error {
	sql := `
		INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, ip_address, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6)`

	_, err := r.db.Exec(ctx, sql,
		token.ID,
		token.UserID,
		token.TokenHash,
		token.ExpiresAt,
		token.IPAddress,
		token.UserAgent,
	)
	return err
}

func (r *UserRepo) GetRefreshToken(ctx context.Context, tokenHash string) (*domain.RefreshToken, error) {
	sql := `
		SELECT id, user_id, token_hash, expires_at, created_at, revoked_at, ip_address, user_agent
		FROM refresh_tokens
		WHERE token_hash = $1`

	var t domain.RefreshToken
	err := r.db.QueryRow(ctx, sql, tokenHash).Scan(
		&t.ID,
		&t.UserID,
		&t.TokenHash,
		&t.ExpiresAt,
		&t.CreatedAt,
		&t.RevokedAt,
		&t.IPAddress,
		&t.UserAgent,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *UserRepo) RevokeRefreshToken(ctx context.Context, id uuid.UUID) error {
	sql := `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`
	_, err := r.db.Exec(ctx, sql, id)
	return err
}

func (r *UserRepo) RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) error {
	sql := `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`
	_, err := r.db.Exec(ctx, sql, userID)
	return err
}

func (r *UserRepo) DeleteExpiredTokens(ctx context.Context, before time.Time) (int64, error) {
	sql := `DELETE FROM refresh_tokens WHERE expires_at < $1`
	tag, err := r.db.Exec(ctx, sql, before)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// maps postgres constraint violations to domain error codes
func mapPgError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		switch {
		case strings.Contains(pgErr.ConstraintName, "email"):
			return fmt.Errorf("%s", domain.CodeEmailAlreadyExists)
		case strings.Contains(pgErr.ConstraintName, "username"):
			return fmt.Errorf("%s", domain.CodeUsernameAlreadyExists)
		}
	}
	return err
}
