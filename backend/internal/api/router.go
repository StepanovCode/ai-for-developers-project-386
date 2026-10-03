package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api/handlers"
)

func NewRouter() http.Handler {
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())
	// No trusted forwarding headers until a deployment proxy is configured.
	router.ForwardedByClientIP = false
	router.GET("/api/health", handlers.Health)
	return router
}
