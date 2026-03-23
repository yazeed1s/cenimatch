package middleware

import (
	"cenimatch/internal/infra/http/utils"
	"cenimatch/internal/ports"
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

type contextKey string

const ctxKey contextKey = "auth_user"

type AuthUser struct {
	ID       uuid.UUID
	Username string
}

func WithUser(ctx context.Context, user AuthUser) context.Context {
	return context.WithValue(ctx, ctxKey, user)
}

func UserFromContext(ctx context.Context) (AuthUser, bool) {
	user, ok := ctx.Value(ctxKey).(AuthUser)
	return user, ok
}

func UserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	user, ok := UserFromContext(ctx)
	if !ok {
		return uuid.Nil, false
	}
	return user.ID, true
}

// auth check
func Auth(j ports.JWTGenerator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractToken(r)
			if token == "" {
				utils.Unauthorized(w, "unauthorized")
				return
			}

			claims, err := j.ValidateAccessToken(token)
			if err != nil {
				fmt.Println("auth failed", err)
				utils.Unauthorized(w, "unauthorized")
				return
			}

			ctx := WithUser(r.Context(), AuthUser{
				ID:       claims.UserID,
				Username: claims.Username,
			})
			fmt.Println("authenticated request",
				"user_id", claims.UserID.String(),
				"username", claims.Username,
				"method", r.Method,
				"path", r.URL.Path,
			)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func extractBearerToken(r *http.Request) string {
	hdr := strings.TrimSpace(r.Header.Get("Authorization"))
	if hdr != "" {
		parts := strings.SplitN(hdr, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
			return strings.TrimSpace(parts[1])
		}
	}
	return ""
}

func extractToken(r *http.Request) string {
	if c, err := r.Cookie("access_token"); err == nil &&
		strings.TrimSpace(c.Value) != "" {
		return c.Value
	}
	return extractBearerToken(r)
}
