package middleware

import (
	"fmt"
	"net/http"
	"strings"
)

// cors stuff

type CORSConfig struct {
	AllowedOrigins   []string
	AllowedMethods   []string
	AllowedHeaders   []string
	ExposedHeaders   []string
	AllowCredentials bool
	MaxAge           int
}

func DefaultCORSConfig() CORSConfig {
	return CORSConfig{
		AllowedOrigins: []string{
			"http://localhost:5173",
			"http://127.0.0.1:5173",
			"http://localhost:3000",
			// "*", // yes, this is wide open
		},
		AllowedMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodPatch,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowedHeaders: []string{
			"Accept",
			"Authorization",
			"Content-Type",
			"X-CSRF-Token",
			"X-Request-ID",
			"Cache-Control",
			"Last-Event-ID",
		},
		ExposedHeaders: []string{
			"Link",
			"X-Request-ID",
			"Content-Type",
		},
		AllowCredentials: true,
		MaxAge:           300, // 5 minutes-ish
	}
}

func ProductionCORSConfig(allowedOrigins []string) CORSConfig {
	return CORSConfig{
		AllowedOrigins: allowedOrigins,
		AllowedMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodPatch,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowedHeaders: []string{
			"Accept",
			"Authorization",
			"Content-Type",
			"X-CSRF-Token",
			"Last-Event-ID",
		},
		ExposedHeaders: []string{
			"Link",
		},
		AllowCredentials: true,
		MaxAge:           3600, // 1 hour
	}
}

func CORS(config CORSConfig) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			o := r.Header.Get("Origin")

			if o != "" && isOriginAllowed(o, config.AllowedOrigins) {
				w.Header().Set("Access-Control-Allow-Origin", o)
				w.Header().Add("Vary", "Origin")
			}

			if config.AllowCredentials {
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}

			if r.Method == http.MethodOptions {
				w.Header().
					Set("Access-Control-Allow-Methods", strings.Join(config.AllowedMethods, ", "))

				w.Header().
					Set("Access-Control-Allow-Headers", strings.Join(config.AllowedHeaders, ", "))

				if config.MaxAge > 0 {
					w.Header().Set("Access-Control-Max-Age", fmt.Sprintf("%d", config.MaxAge))
				}

				w.WriteHeader(http.StatusNoContent)
				return
			}

			if len(config.ExposedHeaders) > 0 {
				w.Header().
					Set("Access-Control-Expose-Headers", strings.Join(config.ExposedHeaders, ", "))
			}

			next.ServeHTTP(w, r)
		})
	}
}

func isOriginAllowed(o string, allowed []string) bool {
	for _, a := range allowed {
		if o == a {
			return true
		}
		if strings.HasPrefix(a, "*.") {
			d := strings.TrimPrefix(a, "*.")
			if strings.HasSuffix(o, d) {
				return true
			}
		}
		if a == "*" {
			return true
		}
	}
	return false
}
