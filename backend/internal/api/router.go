package api

import (
	"context"
	"fmt"
	"net/http"

	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/usecase"
	"github.com/gin-gonic/gin"
	ginmiddleware "github.com/oapi-codegen/gin-middleware"

	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/api/generated"
)

func NewRouter() http.Handler { return newRouter(server{}) }

func NewRouterWithApplication(events *usecase.Events) http.Handler {
	return newRouter(server{events: events})
}

func newRouter(handler generated.StrictServerInterface) http.Handler {
	spec, err := generated.GetSpec()
	if err != nil {
		panic(fmt.Errorf("load embedded API contract: %w", err))
	}
	if err := spec.Validate(context.Background()); err != nil {
		panic(fmt.Errorf("invalid embedded API contract: %w", err))
	}
	router := gin.New()
	router.Use(gin.Logger(), gin.CustomRecovery(func(c *gin.Context, recovered any) {
		writeError(c, fmt.Errorf("panic: %v", recovered))
	}))
	// No trusted forwarding headers until a deployment proxy is configured.
	router.ForwardedByClientIP = false
	router.Use(normalizeBody)
	router.Use(ginmiddleware.OapiRequestValidatorWithOptions(spec, &ginmiddleware.Options{
		ErrorHandler: func(c *gin.Context, _ string, status int) {
			if status == http.StatusNotFound {
				writeError(c, &HTTPError{Status: 404, Code: "NOT_FOUND", Message: "Маршрут не найден"})
				return
			}
			writeError(c, validationError())
		},
	}))
	strict := generated.NewStrictHandlerWithOptions(handler, nil, generated.StrictGinServerOptions{
		RequestErrorHandlerFunc:  func(c *gin.Context, _ error) { writeError(c, validationError()) },
		HandlerErrorFunc:         writeError,
		ResponseErrorHandlerFunc: func(c *gin.Context, err error) { writeError(c, fmt.Errorf("encode API response: %w", err)) },
	})
	generated.RegisterHandlersWithOptions(router, strict, generated.GinServerOptions{
		ErrorHandler: func(c *gin.Context, _ error, _ int) { writeError(c, validationError()) },
	})
	return router
}
