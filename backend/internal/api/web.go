package api

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"strings"
)

// NewWebHandler keeps API requests on the API router and serves a built SPA.
// An empty directory preserves the API-only development server.
func NewWebHandler(apiHandler http.Handler, directory string) (http.Handler, error) {
	if directory == "" {
		return apiHandler, nil
	}
	index, err := os.OpenInRoot(directory, "index.html")
	if err != nil {
		return nil, fmt.Errorf("open frontend index: %w", err)
	}
	defer func() { _ = index.Close() }()
	info, err := index.Stat()
	if err != nil || !info.Mode().IsRegular() {
		return nil, fmt.Errorf("frontend index must be a regular file")
	}
	contents, err := io.ReadAll(index)
	if err != nil {
		return nil, fmt.Errorf("read frontend index: %w", err)
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api" || strings.HasPrefix(r.URL.Path, "/api/") {
			apiHandler.ServeHTTP(w, r)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		hasFileExtension := false
		for _, segment := range strings.Split(r.URL.Path, "/") {
			if strings.HasPrefix(segment, ".") {
				http.NotFound(w, r)
				return
			}
			hasFileExtension = hasFileExtension || path.Ext(segment) != ""
		}
		name := strings.TrimPrefix(r.URL.Path, "/")
		if name != "" && name != "index.html" {
			file, err := os.OpenInRoot(directory, name)
			if err == nil {
				defer func() { _ = file.Close() }()
				stat, err := file.Stat()
				if err != nil || !stat.Mode().IsRegular() {
					http.NotFound(w, r)
					return
				}
				http.ServeContent(w, r, stat.Name(), stat.ModTime(), file)
				return
			}
			if !os.IsNotExist(err) || hasFileExtension || name == "assets" || strings.HasPrefix(name, "assets/") {
				http.NotFound(w, r)
				return
			}
		}
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeContent(w, r, "index.html", info.ModTime(), bytes.NewReader(contents))
	}), nil
}
