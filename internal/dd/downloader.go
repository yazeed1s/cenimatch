// downloader.go
//
// generic file downloader. does not care where files come from
// or what format they are in. you give it a list of sources,
// each source has a url, an auth method, and an output format.
// the downloader fetches them, extracts zips if needed, and
// puts everything into the output directory.
//
// downloads run concurrently with a configurable worker count.
// auth is pluggable through the AuthMethod interface so you
// can add new auth strategies (oauth, cookies, etc) without
// touching the download logic.

package dd

import (
	"archive/zip"
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

type AuthMethod interface {
	Apply(req *http.Request)
}

type NoAuth struct{}

func (NoAuth) Apply(_ *http.Request) {}

type BearerToken struct {
	Token string
}

func (b BearerToken) Apply(req *http.Request) {
	req.Header.Set("Authorization", "Bearer "+b.Token)
}

type BasicAuth struct {
	Username string
	Password string
}

func (b BasicAuth) Apply(req *http.Request) {
	req.SetBasicAuth(b.Username, b.Password)
}

type APIKey struct {
	Header string
	Value  string
}

func (a APIKey) Apply(req *http.Request) {
	req.Header.Set(a.Header, a.Value)
}

type Downloader struct {
	OutDir  string
	Workers int
	Client  *http.Client
}

func NewDownloader(dir string, w int) *Downloader {
	if w < 1 {
		w = 4
	}
	return &Downloader{
		OutDir:  dir,
		Workers: w,
		Client:  &http.Client{},
	}
}

func (d *Downloader) DownloadAll(src []Source) error {
	var (
		wg   sync.WaitGroup
		mu   sync.Mutex
		errs []error
		sem  = make(chan struct{}, d.Workers)
	)

	for i, s := range src {
		wg.Add(1)
		go func(idx int, s Source) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			fmt.Printf("[%d/%d] %s\n", idx+1, len(src), s.Name)
			if err := d.Download(s); err != nil {
				mu.Lock()
				errs = append(errs, fmt.Errorf("%s: %w", s.Name, err))
				mu.Unlock()
				fmt.Printf("%s failed: %v\n", s.Name, err)
				return
			}
			fmt.Printf("%s done\n", s.Name)
		}(i, s)
	}

	wg.Wait()

	if len(errs) > 0 {
		return fmt.Errorf("%d download(s) failed: %v", len(errs), errs)
	}
	return nil
}

func (d *Downloader) Download(src Source) error {
	dr := filepath.Join(d.OutDir, src.Name)
	if err := os.MkdirAll(dr, 0o755); err != nil {
		return fmt.Errorf("mkdir %s: %w", dr, err)
	}

	if src.Zip {
		return d.downloadAndExtract(src, dr)
	}
	return d.downloadFile(src, dr)
}

func (d *Downloader) downloadFile(src Source, dir string) error {
	fname := filepath.Base(src.URL)
	dpath := filepath.Join(dir, fname)
	isGzip := strings.HasSuffix(strings.ToLower(fname), ".gz")

	if isGzip {
		extractedName := strings.TrimSuffix(fname, ".gz")
		extractedPath := filepath.Join(dir, extractedName)

		if fileExists(extractedPath) {
			fmt.Printf("skip %s (already extracted)\n", extractedName)
			return nil
		}

		if !fileExists(dpath) {
			if err := d.fetch(src.URL, dpath, src.Auth); err != nil {
				return err
			}
		} else {
			fmt.Printf("skip %s (exists)\n", fname)
		}

		return gunzipFile(dpath, extractedPath)
	}

	if fileExists(dpath) {
		fmt.Printf("skip %s (exists)\n", fname)
		return nil
	}

	return d.fetch(src.URL, dpath, src.Auth)
}

func (d *Downloader) downloadAndExtract(src Source, dir string) error {
	zipp := filepath.Join(dir, src.Name+".zip")

	if !fileExists(zipp) {
		if err := d.fetch(src.URL, zipp, src.Auth); err != nil {
			return err
		}
	} else {
		fmt.Printf("skip %s (zip exists)\n", src.Name)
	}

	fmt.Printf("extracting...\n")
	return unzip(zipp, dir)
}

func (d *Downloader) fetch(url, dest string, auth AuthMethod) error {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	if auth != nil {
		auth.Apply(req)
	}

	resp, err := d.Client.Do(req)
	if err != nil {
		return fmt.Errorf("GET %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("GET %s: %s", url, resp.Status)
	}

	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()

	size, err := io.Copy(out, resp.Body)
	if err != nil {
		return fmt.Errorf("writing %s: %w", dest, err)
	}
	fmt.Printf("saved %s (%s)\n", filepath.Base(dest), humanBytes(size))
	return nil
}

func gunzipFile(src, dest string) error {
	in, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("open gzip %s: %w", src, err)
	}
	defer in.Close()

	gz, err := gzip.NewReader(in)
	if err != nil {
		return fmt.Errorf("read gzip %s: %w", src, err)
	}
	defer gz.Close()

	out, err := os.Create(dest)
	if err != nil {
		return fmt.Errorf("create %s: %w", dest, err)
	}
	defer out.Close()

	size, err := io.Copy(out, gz)
	if err != nil {
		return fmt.Errorf("extract %s: %w", dest, err)
	}
	fmt.Printf("extracted %s (%s)\n", filepath.Base(dest), humanBytes(size))
	return nil
}

func unzip(src, dir string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return fmt.Errorf("open zip %s: %w", src, err)
	}
	defer r.Close()

	for _, f := range r.File {
		t := filepath.Join(dir, f.Name)

		if !strings.HasPrefix(filepath.Clean(t), filepath.Clean(dir)+string(os.PathSeparator)) {
			return fmt.Errorf("illegal zip path: %s", f.Name)
		}

		if f.FileInfo().IsDir() {
			os.MkdirAll(t, 0o755)
			continue
		}

		if err := extractFile(f, t); err != nil {
			return err
		}
	}
	return nil
}

func extractFile(f *zip.File, t string) error {
	if err := os.MkdirAll(filepath.Dir(t), 0o755); err != nil {
		return err
	}
	rc, err := f.Open()
	if err != nil {
		return err
	}
	defer rc.Close()

	w, err := os.Create(t)
	if err != nil {
		return err
	}
	defer w.Close()

	_, err = io.Copy(w, rc)
	return err
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func humanBytes(b int64) string {
	switch {
	case b >= 1<<30:
		return fmt.Sprintf("%.1f GB", float64(b)/float64(1<<30))
	case b >= 1<<20:
		return fmt.Sprintf("%.1f MB", float64(b)/float64(1<<20))
	case b >= 1<<10:
		return fmt.Sprintf("%.1f KB", float64(b)/float64(1<<10))
	default:
		return fmt.Sprintf("%d B", b)
	}
}
