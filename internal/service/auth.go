package service

import (
	"cenimatch/internal/domain"
	"cenimatch/internal/infra/security"
	"cenimatch/internal/ports"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type AuthService struct {
	users   ports.UserRepository
	db      ports.DBManager
	hasher  ports.Hasher
	jwt     ports.JWTGenerator
	refresh ports.RefreshTokenGenerator
}

func NewAuthService(
	users ports.UserRepository,
	db ports.DBManager,
	hasher ports.Hasher,
	jwt ports.JWTGenerator,
	refresh ports.RefreshTokenGenerator,
) *AuthService {
	return &AuthService{
		users:   users,
		db:      db,
		hasher:  hasher,
		jwt:     jwt,
		refresh: refresh,
	}
}

// metadata that the http layer passes into token issuing.
// keeps the service unaware of *http.Request.
type TokenMeta struct {
	IP        string
	UserAgent string
}

func (s *AuthService) Register(ctx context.Context, req domain.RegisterRequest) (*domain.AuthResponse, domain.ErrorCode, error) {
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Password = strings.TrimSpace(req.Password)

	if req.Username == "" || req.Email == "" || req.Password == "" {
		return nil, domain.CodeInvalidRequest, fmt.Errorf("missing required fields")
	}
	if len(req.Password) < 8 {
		return nil, domain.CodeInvalidRequest, fmt.Errorf("password must be at least 8 characters")
	}

	hash, err := s.hasher.Hash(req.Password)
	if err != nil {
		return nil, domain.CodeInternalError, fmt.Errorf("hash: %w", err)
	}

	user := &domain.User{
		ID:           uuid.New(),
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: hash,
		IsActive:     true,
	}

	err = s.db.WithTx(ctx, func(txCtx context.Context) error {
		if err := s.users.CreateUser(txCtx, user); err != nil {
			return err
		}
		if _, err := s.db.Exec(txCtx,
			`INSERT INTO user_preferences (user_id) VALUES ($1)`, user.ID,
		); err != nil {
			return fmt.Errorf("create preferences: %w", err)
		}
		if _, err := s.db.Exec(txCtx,
			`INSERT INTO user_mood_profile (user_id) VALUES ($1)`, user.ID,
		); err != nil {
			return fmt.Errorf("create mood profile: %w", err)
		}
		return nil
	})
	if err != nil {
		if code := constraintErrorCode(err); code != "" {
			return nil, code, err
		}
		return nil, domain.CodeInternalError, err
	}

	return &domain.AuthResponse{User: user.Public()}, "", nil
}

// atomic signup: creates user + saves all onboarding data in one transaction.
// if any step fails, nothing is persisted.
func (s *AuthService) Signup(ctx context.Context, req domain.SignupRequest) (*domain.AuthResponse, domain.ErrorCode, error) {
	username := strings.TrimSpace(req.Username)
	email := strings.TrimSpace(strings.ToLower(req.Email))
	password := strings.TrimSpace(req.Password)

	if username == "" || email == "" || password == "" {
		return nil, domain.CodeInvalidRequest, fmt.Errorf("missing required fields")
	}
	if len(password) < 8 {
		return nil, domain.CodeInvalidRequest, fmt.Errorf("password must be at least 8 characters")
	}
	if len(req.Genres) == 0 {
		return nil, domain.CodeInvalidRequest, fmt.Errorf("at least one genre is required")
	}

	hash, err := s.hasher.Hash(password)
	if err != nil {
		return nil, domain.CodeInternalError, fmt.Errorf("hash: %w", err)
	}

	user := &domain.User{
		ID:           uuid.New(),
		Username:     username,
		Email:        email,
		PasswordHash: hash,
		IsActive:     true,
	}

	// build genre weights JSONB
	weights := make(map[string]float64, len(req.Genres))
	for _, g := range req.Genres {
		weights[g] = 1.0
	}
	weightsJSON, err := json.Marshal(weights)
	if err != nil {
		return nil, domain.CodeInternalError, fmt.Errorf("marshal genre weights: %w", err)
	}

	err = s.db.WithTx(ctx, func(txCtx context.Context) error {
		// 1. create user
		if err := s.users.CreateUser(txCtx, user); err != nil {
			return err
		}

		// 2. create preferences with onboarding data
		_, err := s.db.Exec(txCtx, `
			INSERT INTO user_preferences (user_id, genre_weights, runtime_pref, decade_low, decade_high)
			VALUES ($1, $2, $3, $4, $5)`,
			user.ID, weightsJSON, req.RuntimePref, req.DecadeLow, req.DecadeHigh,
		)
		if err != nil {
			return fmt.Errorf("create preferences: %w", err)
		}

		// 3. create mood profile with liked/disliked + default mood
		_, err = s.db.Exec(txCtx, `
			INSERT INTO user_mood_profile (user_id, liked, disliked, attributes)
			VALUES ($1, $2, $3, jsonb_build_object('default_mood', $4::text))`,
			user.ID, req.LikedIDs, req.DislikedIDs, req.DefaultMood,
		)
		if err != nil {
			return fmt.Errorf("create mood profile: %w", err)
		}

		return nil
	})
	if err != nil {
		if code := constraintErrorCode(err); code != "" {
			return nil, code, err
		}
		return nil, domain.CodeInternalError, err
	}

	return &domain.AuthResponse{User: user.Public()}, "", nil
}

func (s *AuthService) Login(ctx context.Context, req domain.LoginRequest) (*domain.AuthResponse, domain.ErrorCode, error) {
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if req.Email == "" || req.Password == "" {
		return nil, domain.CodeInvalidRequest, fmt.Errorf("missing required fields")
	}

	user, err := s.users.GetUserByEmail(ctx, req.Email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.CodeInvalidCredentials, err
		}
		return nil, domain.CodeInternalError, err
	}

	if err := s.hasher.Compare(req.Password, user.PasswordHash); err != nil {
		return nil, domain.CodeInvalidCredentials, err
	}

	_ = s.users.UpdateLastLogin(ctx, user.ID)

	return &domain.AuthResponse{User: user.Public()}, "", nil
}

func (s *AuthService) Refresh(ctx context.Context, rawToken string) (*domain.AuthResponse, domain.ErrorCode, error) {
	if rawToken == "" {
		return nil, domain.CodeInvalidRequest, fmt.Errorf("missing refresh token")
	}

	info, err := s.refresh.ParseRefreshToken(rawToken)
	if err != nil {
		return nil, domain.CodeRefreshTokenInvalid, err
	}

	secretHash := security.HashSecret(info.Secret)
	stored, err := s.users.GetRefreshToken(ctx, secretHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.CodeRefreshTokenInvalid, err
		}
		return nil, domain.CodeInternalError, err
	}

	if stored.RevokedAt != nil || time.Now().After(stored.ExpiresAt) || stored.ID != info.TokenID {
		return nil, domain.CodeRefreshTokenInvalid, fmt.Errorf("token expired or revoked")
	}

	_ = s.users.RevokeRefreshToken(ctx, stored.ID)

	user, err := s.users.GetUserByID(ctx, stored.UserID)
	if err != nil {
		return nil, domain.CodeInternalError, err
	}

	return &domain.AuthResponse{User: user.Public()}, "", nil
}

func (s *AuthService) Logout(ctx context.Context, rawToken string) {
	if rawToken == "" {
		return
	}
	info, err := s.refresh.ParseRefreshToken(rawToken)
	if err != nil {
		return
	}
	secretHash := security.HashSecret(info.Secret)
	stored, err := s.users.GetRefreshToken(ctx, secretHash)
	if err != nil {
		return
	}
	_ = s.users.RevokeRefreshToken(ctx, stored.ID)
}

// IssueTokens generates an access + refresh pair and stores the refresh token.
// called by the handler after a successful register/login/refresh.
func (s *AuthService) IssueTokens(ctx context.Context, user *domain.UserPublic, meta TokenMeta) (access, refresh string, err error) {
	access, err = s.jwt.GenerateAccessToken(user.ID, user.Username)
	if err != nil {
		return "", "", fmt.Errorf("access token: %w", err)
	}

	rawRefresh, err := s.refresh.GenerateRefreshToken()
	if err != nil {
		return "", "", fmt.Errorf("refresh token: %w", err)
	}

	info, err := s.refresh.ParseRefreshToken(rawRefresh)
	if err != nil {
		return "", "", fmt.Errorf("parse refresh: %w", err)
	}

	rt := &domain.RefreshToken{
		ID:        info.TokenID,
		UserID:    user.ID,
		TokenHash: security.HashSecret(info.Secret),
		ExpiresAt: time.Now().Add(s.refresh.Expiration()),
	}
	if meta.IP != "" {
		rt.IPAddress = &meta.IP
	}
	if meta.UserAgent != "" {
		rt.UserAgent = &meta.UserAgent
	}

	if err := s.users.StoreRefreshToken(ctx, rt); err != nil {
		return "", "", fmt.Errorf("store refresh: %w", err)
	}

	return access, rawRefresh, nil
}

// maps constraint violation errors to domain error codes
func constraintErrorCode(err error) domain.ErrorCode {
	msg := err.Error()
	if strings.Contains(msg, string(domain.CodeEmailAlreadyExists)) {
		return domain.CodeEmailAlreadyExists
	}
	if strings.Contains(msg, string(domain.CodeUsernameAlreadyExists)) {
		return domain.CodeUsernameAlreadyExists
	}
	return ""
}
