package http

import (
	"net/http"
)

func health() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("200 ok"))
	}
}
