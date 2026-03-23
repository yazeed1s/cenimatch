package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Environment            string
	DatabaseURL            string
	KaggleToken            string
	Port                   string
	JWTSecret              string
	JWTIssuer              string
	BcryptCost             int
	JWTExpiration          time.Duration
	RefreshTokenExpiration time.Duration
}

type dummyConfig struct {
	BcryptCost             int
	JWTExpiration          time.Duration
	RefreshTokenExpiration time.Duration
}

var dvals = dummyConfig{
	JWTExpiration:          24 * time.Hour,
	RefreshTokenExpiration: 30 * 24 * time.Hour,
	BcryptCost:             10,
}

type loader struct {
	err error
}

func (l *loader) required(key string) string {
	if l.err != nil {
		return ""
	}
	val := os.Getenv(key)
	if val == "" {
		l.err = fmt.Errorf("missing required environment variable: %s", key)
		return ""
	}
	return val
}

func (l *loader) optional(key string) string {
	if l.err != nil {
		return ""
	}
	return os.Getenv(key)
}

func (l *loader) requiredDuration(key string) time.Duration {
	val := l.required(key)
	if l.err != nil {
		return 0
	}
	return l.parseDuration(key, val)
}

func (l *loader) requiredInt(key string) int {
	val := l.required(key)
	if l.err != nil {
		return 0
	}
	return l.parseInt(key, val)
}

func (l *loader) requiredBool(key string) bool {
	val := l.required(key)
	if l.err != nil {
		return false
	}
	return strings.ToLower(val) == "true"
}

func (l *loader) optionalInt(key string, defaultVal int) int {
	if l.err != nil {
		return 0
	}
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	return l.parseInt(key, val)
}

func (l *loader) optionalDuration(key string, defaultVal time.Duration) time.Duration {
	if l.err != nil {
		return 0
	}
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	return l.parseDuration(key, val)
}

func (l *loader) parseDuration(key, val string) time.Duration {
	d, err := time.ParseDuration(val)
	if err != nil {
		l.err = fmt.Errorf("env %s has invalid duration format '%s': %w", key, val, err)
		return 0
	}
	return d
}

func (l *loader) parseInt(key, val string) int {
	i, err := strconv.Atoi(val)
	if err != nil {
		l.err = fmt.Errorf("env %s has invalid integer format '%s': %w", key, val, err)
		return 0
	}
	return i
}

// loads env vals
// prod: strictly from env.
// dev: use hardcoded defaults
func Load() (*Config, error) {
	l := &loader{}
	env := l.required("ENVIRONMENT")

	// Determine mode
	isProd := strings.ToLower(env) == "prod" || strings.ToLower(env) == "production"

	cfg := &Config{
		Environment: env,
		// infrastructure is always loaded from env,
		// regardless of mode
		DatabaseURL: l.required("DATABASE_URL"),
		KaggleToken: l.optional("KAGGLE_API_TOKEN"),
		JWTSecret:   l.required("JWT_SECRET"),
		JWTIssuer:   l.required("JWT_ISSUER"),
		Port:        l.required("PORT"),
	}

	if isProd {
		// production mode, strictly from env
		cfg.BcryptCost = l.requiredInt("BCRYPT_COST")
		cfg.JWTExpiration = l.requiredDuration("JWT_EXPIRATION")
		cfg.RefreshTokenExpiration = l.requiredDuration("REFRESH_TOKEN_EXPIRATION")
	} else {
		// dev mode, use dummy easy to work with values
		cfg.BcryptCost = dvals.BcryptCost
		cfg.JWTExpiration = dvals.JWTExpiration
		cfg.RefreshTokenExpiration = dvals.RefreshTokenExpiration
	}

	if l.err != nil {
		return nil, l.err
	}
	return cfg, nil
}
