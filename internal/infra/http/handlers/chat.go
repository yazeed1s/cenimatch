package handlers

import (
	"cenimatch/internal/infra/http/utils"
	"cenimatch/internal/llm"
	"cenimatch/internal/service"
	"encoding/json"
	"net/http"
)

type ChatHandler struct {
	chat *service.ChatService
}

func NewChatHandler(chat *service.ChatService) *ChatHandler {
	return &ChatHandler{chat: chat}
}

type chatRequest struct {
	Messages []llm.Message `json:"messages"`
}

// Chat handles natural language db queries
func (h *ChatHandler) Chat() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req chatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			utils.BadRequest(w, "invalid request body")
			return
		}

		if len(req.Messages) == 0 {
			utils.BadRequest(w, "messages array is required")
			return
		}

		if len(req.Messages) > 20 {
			req.Messages = req.Messages[len(req.Messages)-20:]
		}

		resp, err := h.chat.Query(r.Context(), req.Messages)
		if err != nil {
			utils.InternalServerError(w, err.Error())
			return
		}

		utils.Success(w, resp)
	}
}
