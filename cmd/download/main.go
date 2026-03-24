// main.go
//
// cli tool to download project datasets. reads KAGGLE_API_TOKEN
// from env for kaggle sources. imdb sources need no auth.
//
// usage:
//   go run ./cmd/download/ --list
//   go run ./cmd/download/ -s imdb
//   go run ./cmd/download/ -s tmdb,netflix
//   go run ./cmd/download/ -o data/raw

package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"cenimatch/internal/config"
	"cenimatch/internal/dd"
)

func main() {
	dir := flag.String("o", "data/raw", "output directory")
	src := flag.String("s", "all", "which source: all, imdb, tmdb, kaggle-movies, netflix, or comma-separated")
	wrk := flag.Int("w", 4, "number of concurrent downloads")
	l := flag.Bool("list", false, "list available sources and exit")
	flag.Parse()

	config.LoadEnvironment()
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		os.Exit(1)
	}

	var a dd.AuthMethod
	if cfg.KaggleToken != "" {
		a = dd.BearerToken{Token: cfg.KaggleToken}
	}
	all := dd.AllSources(a)

	if *l {
		fmt.Println("sources=")
		for _, s := range all {
			fmt.Printf("  %-20s [%s] %s\n", s.Name, s.Format, s.URL)
		}
		return
	}

	sel, err := filt(all, *src)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	nk := false
	for _, s := range sel {
		if s.Auth != nil {
			nk = true
			break
		}
	}
	if nk && a == nil {
		fmt.Fprintf(os.Stderr, "error: kaggle sources need KAGGLE_API_TOKEN env var\n")
		os.Exit(1)
	}

	fmt.Printf("downloading %d source(s) %s\n\n", len(sel), *dir)

	dl := dd.NewDownloader(*dir, *wrk)
	if err := dl.DownloadAll(sel); err != nil {
		fmt.Fprintf(os.Stderr, "\nerror: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("\ndone")
}

func filt(all []dd.Source, f string) ([]dd.Source, error) {
	if f == "all" {
		return all, nil
	}

	al := map[string]string{
		"imdb":          "imdb-",
		"tmdb":          "tmdb-",
		"kaggle-movies": "kaggle-movies",
		"netflix":       "netflix-",
	}

	var res []dd.Source
	seen := make(map[string]bool)

	for _, tk := range strings.Split(f, ",") {
		tk = strings.TrimSpace(tk)
		pfx, ok := al[tk]
		if !ok {
			fd := false
			for _, s := range all {
				if s.Name == tk && !seen[s.Name] {
					res = append(res, s)
					seen[s.Name] = true
					fd = true
				}
			}
			if !fd {
				return nil, fmt.Errorf("unknown source %q (use --list)", tk)
			}
			continue
		}
		for _, s := range all {
			if strings.HasPrefix(s.Name, pfx) && !seen[s.Name] {
				res = append(res, s)
				seen[s.Name] = true
			}
		}
	}

	if len(res) == 0 {
		return nil, fmt.Errorf("no sources matched %q", f)
	}
	return res, nil
}
