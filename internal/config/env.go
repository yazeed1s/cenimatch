package config

import (
	"log"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

// this should look for the .env file
// in the project root directory(ies)
// and load it
func LoadEnvironment() {
	cwd, _ := os.Getwd()
	renv := filepath.Join(cwd, "../.env")
	paths := []string{
		".env",
		"../.env",
		"../../.env",
		"../../../.env",
		renv,
	}

	var l bool
	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			if err := godotenv.Load(p); err == nil {
				log.Printf(".env file loaded from %s\n", p)
				l = true
				break
			}
		}
	}

	if !l {
		log.Println("where is your .env?")
	}
}
