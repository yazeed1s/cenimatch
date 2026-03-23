package container

import (
	"cenimatch/internal/config"
	"cenimatch/internal/infra/database"
	httpserver "cenimatch/internal/infra/http/server"
	"cenimatch/internal/ports"
	"fmt"
	"strconv"
	"time"
)

type Container struct {
	Cfg    *config.Config
	DB     *database.DBManager
	Server *httpserver.Server
}

func New(cfg *config.Config, jwt ports.JWTGenerator) (*Container, error) {
	pool, err := database.NewConnection(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("db: %w", err)
	}

	db := database.NewDBManager(pool)

	p, err := strconv.Atoi(cfg.Port)
	if err != nil {
		return nil, fmt.Errorf("invalid port %q: %w", cfg.Port, err)
	}

	srv := httpserver.NewServer(p, jwt)

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
