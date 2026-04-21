package handlers

import (
	"cenimatch/internal/domain"
	"cenimatch/internal/infra/http/utils"
	"cenimatch/internal/service"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
)

type AuthHandler struct {
	auth *service.AuthService
}

func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

// POST /api/auth/register
func (h *AuthHandler) Register() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req domain.RegisterRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			utils.BadRequest(w, string(domain.CodeInvalidRequest))
			return
		}

		resp, code, err := h.auth.Register(r.Context(), req)
		if err != nil {
			fmt.Println("register error:", err)
			utils.Error(w, utils.StatusForCode(code), string(code))
			return
		}

		access, refresh, err := h.auth.IssueTokens(r.Context(), resp.User, tokenMeta(r))
		if err != nil {
			fmt.Println("token issue error:", err)
			utils.InternalServerError(w, string(domain.CodeInternalError))
			return
		}

		resp.AccessToken = access
		resp.RefreshToken = refresh
		utils.JSON(w, http.StatusCreated, resp)
	}
}

// POST /api/auth/signup (atomic register + onboarding)
func (h *AuthHandler) Signup() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req domain.SignupRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			utils.BadRequest(w, string(domain.CodeInvalidRequest))
			return
		}

		resp, code, err := h.auth.Signup(r.Context(), req)
		if err != nil {
			fmt.Println("signup error:", err)
			utils.Error(w, utils.StatusForCode(code), string(code))
			return
		}

		access, refresh, err := h.auth.IssueTokens(r.Context(), resp.User, tokenMeta(r))
		if err != nil {
			fmt.Println("token issue error:", err)
			utils.InternalServerError(w, string(domain.CodeInternalError))
			return
		}

		resp.AccessToken = access
		resp.RefreshToken = refresh
		utils.JSON(w, http.StatusCreated, resp)
	}
}

// POST /api/auth/login
func (h *AuthHandler) Login() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req domain.LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			utils.BadRequest(w, string(domain.CodeInvalidRequest))
			return
		}

		resp, code, err := h.auth.Login(r.Context(), req)
		if err != nil {
			utils.Error(w, utils.StatusForCode(code), string(code))
			return
		}

		access, refresh, err := h.auth.IssueTokens(r.Context(), resp.User, tokenMeta(r))
		if err != nil {
			utils.InternalServerError(w, string(domain.CodeInternalError))
			return
		}

		resp.AccessToken = access
		resp.RefreshToken = refresh
		utils.Success(w, resp)
	}
}

// POST /api/auth/refresh
func (h *AuthHandler) Refresh() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req domain.RefreshRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			utils.BadRequest(w, string(domain.CodeInvalidRequest))
			return
		}

		resp, code, err := h.auth.Refresh(r.Context(), req.RefreshToken)
		if err != nil {
			utils.Error(w, utils.StatusForCode(code), string(code))
			return
		}

		access, refresh, err := h.auth.IssueTokens(r.Context(), resp.User, tokenMeta(r))
		if err != nil {
			utils.InternalServerError(w, string(domain.CodeInternalError))
			return
		}

		resp.AccessToken = access
		resp.RefreshToken = refresh
		utils.Success(w, resp)
	}
}

// POST /api/auth/logout
func (h *AuthHandler) Logout() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req domain.RefreshRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
			h.auth.Logout(r.Context(), req.RefreshToken)
		}
		utils.Success(w, map[string]string{"status": "logged_out"})
	}
}

func tokenMeta(r *http.Request) service.TokenMeta {
	return service.TokenMeta{
		IP:        extractRemoteIP(r.RemoteAddr),
		UserAgent: r.UserAgent(),
	}
}

func extractRemoteIP(remoteAddr string) string {
	if remoteAddr == "" {
		return ""
	}

	if host, _, err := net.SplitHostPort(remoteAddr); err == nil {
		if net.ParseIP(host) != nil {
			return host
		}
	}

	if net.ParseIP(remoteAddr) != nil {
		return remoteAddr
	}

	return ""
}
