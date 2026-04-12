package server

import (
	"cenimatch/internal/infra/http/handlers"
	"cenimatch/internal/ports"
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
	router       *chi.Mux
	server       *http.Server
	jwtGenerator ports.JWTGenerator
}

func NewServer(port int, jwt ports.JWTGenerator, movieRepo ports.MovieRepository) *Server {

	r := chi.NewRouter()
	cors := custommiddleware.DefaultCORSConfig()
	r.Use(custommiddleware.CORS(cors))

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)

	r.Get("/health", handlers.Health())
	movieHandler := handlers.NewMovieHandler(movieRepo)
	r.Get("/movies", movieHandler.ListMovies())

	// we can, later make the timeouts configurable
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 0,
		IdleTimeout:  300 * time.Second,
	}

	return &Server{
		router:       r,
		server:       server,
		jwtGenerator: jwt,
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
