package server

import (
	"cenimatch/internal/infra/http/handlers"
	"cenimatch/internal/ports"
	"cenimatch/internal/service"
	"context"
	"fmt"
	"net"
	"net/http"
	"time"

	custommiddleware "cenimatch/internal/infra/http/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type Server struct {
	router *chi.Mux
	server *http.Server
}

func NewServer(
	port int,
	allowedOrigins []string,
	jwt ports.JWTGenerator,
	authService *service.AuthService,
	onboardingService *service.OnboardingService,
	movieRepo ports.MovieRepository,
	chatService *service.ChatService,
) *Server {

	r := chi.NewRouter()
	cors := custommiddleware.DefaultCORSConfig()
	if len(allowedOrigins) > 0 {
		// Keep local dev origins and extend with configured public origins.
		cors.AllowedOrigins = append(cors.AllowedOrigins, allowedOrigins...)
	}
	r.Use(custommiddleware.CORS(cors))

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)

	r.Get("/health", handlers.Health())

	movieHandler := handlers.NewMovieHandler(movieRepo)
	authHandler := handlers.NewAuthHandler(authService)
	onboardingHandler := handlers.NewOnboardingHandler(onboardingService)
	chatHandler := handlers.NewChatHandler(chatService)

	r.Route("/api", func(api chi.Router) {
		api.Post("/auth/register", authHandler.Register())
		api.Post("/auth/signup", authHandler.Signup())
		api.Post("/auth/login", authHandler.Login())
		api.Post("/auth/refresh", authHandler.Refresh())
		api.Post("/auth/logout", authHandler.Logout())

		api.Get("/movies", movieHandler.ListMovies())
		api.Get("/movies/search", movieHandler.SearchMovies())
		api.Get("/movies/{id}", movieHandler.GetMovieByID())
		api.Get("/movies/{id}/crew", movieHandler.GetMovieCrew())
		api.Get("/movies/{id}/related", movieHandler.GetRelatedMovies())
		api.Get("/movies/{id}/graph-related", movieHandler.GetGraphRelatedMovies())

		api.Post("/chat", chatHandler.Chat())

		api.Group(func(protected chi.Router) {
			protected.Use(custommiddleware.Auth(jwt))
			protected.Post("/users/onboard", onboardingHandler.SaveOnboarding())
			protected.Get("/recommendations/graph", movieHandler.GetGraphUserRecommendations())
		})
	})

	// we can, later make the timeouts configurable
	s := &http.Server{
		Addr:         fmt.Sprintf(":%d", port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 0,
		IdleTimeout:  300 * time.Second,
	}

	return &Server{
		router: r,
		server: s,
	}
}

func (s *Server) Router() *chi.Mux {
	return s.router
}

func (s *Server) Start() error {
	fmt.Println("running http server", s.server.Addr)
	return s.server.ListenAndServe()
}

func (s *Server) StartWithListener(listener net.Listener) error {
	fmt.Println(
		"starting http server with custom listener",
		listener.Addr().String(),
	)
	return s.server.Serve(listener)
}

func (s *Server) Shutdown(timeout time.Duration) error {
	fmt.Println("shutting down http server")
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	err := s.server.Shutdown(ctx)
	return err
}
