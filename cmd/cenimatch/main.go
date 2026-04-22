package main

import (
	"cenimatch/internal/config"
	"cenimatch/internal/container"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
)

type App struct {
	C   *container.Container
	Cfg *config.Config
}

func NewApp() (*App, error) {
	config.LoadEnvironment()
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "config: %v\n", err)
		os.Exit(1)
	}

	c, err := container.New(cfg)
	if err != nil {
		return nil, fmt.Errorf("init: %w", err)
	}

	fmt.Printf("env=%s port=%s\n", cfg.Environment, cfg.Port)

	return &App{C: c, Cfg: cfg}, nil
}

func (a *App) Start() {
	go func() {
		if err := a.C.Start(); err != nil && err.Error() != "http: Server closed" {
			fmt.Fprintf(os.Stderr, "http: %v\n", err)
			os.Exit(1)
		}
	}()
}

func (a *App) Stop() {
	a.C.Shutdown()
}

func (a *App) Run() {
	a.Start()
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	fmt.Println("\nshutting down")
	a.Stop()
}

func main() {
	app, err := NewApp()
	if err != nil {
		log.Fatalf("cannot start: %s", err.Error())
	}
	app.Run()
}
