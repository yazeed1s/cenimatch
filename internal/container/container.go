package container

import (
	"cenimatch/internal/config"
	"cenimatch/internal/infra/database"
	"cenimatch/internal/infra/http/server"
	"cenimatch/internal/infra/repository"
	"cenimatch/internal/infra/security"
	"cenimatch/internal/llm"
	"cenimatch/internal/service"
	"fmt"
	"strconv"
	"time"
)

type Container struct {
	Cfg    *config.Config
	DB     *database.DBManager
	Server *server.Server
}

func New(cfg *config.Config) (*Container, error) {
	pool, err := database.NewConnection(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("db: %w", err)
	}

	db := database.NewDBManager(pool)

	p, err := strconv.Atoi(cfg.Port)
	if err != nil {
		return nil, fmt.Errorf("invalid port %q: %w", cfg.Port, err)
	}

	// security implementations
	hasher := security.NewBcryptHasher(cfg.BcryptCost)
	jwt := security.NewJWTGen(cfg.JWTSecret, cfg.JWTIssuer, cfg.JWTExpiration)
	refreshGen := security.NewRefreshGen(cfg.RefreshTokenExpiration)

	// repositories
	movieRepo := repository.NewMovieRepo(db)
	userRepo := repository.NewUserRepo(db)

	// services
	authService := service.NewAuthService(userRepo, db, hasher, jwt, refreshGen)
	onboardingService := service.NewOnboardingService(db)
	feedbackService := service.NewFeedbackService(db)

	llmClient := llm.NewClient(cfg.OpenRouterAPIKey)
	chatService := service.NewChatService(llmClient, pool)

	srv := server.NewServer(
		p,
		cfg.CORSAllowedOrigins,
		jwt,
		authService,
		onboardingService,
		feedbackService,
		movieRepo,
		chatService,
	)

	return &Container{
		Cfg:    cfg,
		DB:     db,
		Server: srv,
	}, nil
}

func (c *Container) Start() error {
	return c.Server.Start()
}

func (c *Container) Shutdown() {
	c.Server.Shutdown(10 * time.Second)
	c.DB.Close()
}
