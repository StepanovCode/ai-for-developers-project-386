package api

import (
	"bytes"
	"encoding/json"
	"github.com/StepanovCode/ai-for-developers-project-386/backend/internal/domain"
	"io"
	"math"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// Normalize before schema validation: lengths in the contract describe trimmed
// input. Decode with UseNumber to preserve integer precision for the validator.
// Unknown fields are retained so that the schema can reject them.
func normalizeBody(c *gin.Context) {
	var fields []string
	switch c.FullPath() {
	case "/api/event-types":
		fields = []string{"name", "description"}
	case "/api/bookings":
		fields = []string{"guestName"}
	default:
		return
	}
	if c.Request.Method != http.MethodPost {
		return
	}
	decoder := json.NewDecoder(http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20))
	decoder.UseNumber()
	var body map[string]any
	if err := decoder.Decode(&body); err != nil || body == nil {
		writeError(c, validationError())
		return
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		writeError(c, validationError())
		return
	}
	for _, field := range fields {
		if value, ok := body[field].(string); ok {
			body[field] = strings.TrimSpace(value)
		}
	}
	if c.FullPath() == "/api/event-types" {
		name, nameOK := body["name"].(string)
		description, descriptionOK := body["description"].(string)
		duration, durationOK := body["durationMinutes"].(json.Number)
		number, numberErr := duration.Float64()
		if !durationOK || numberErr != nil || number != math.Trunc(number) || number < 1 || number > 480 {
			number = 0
		}
		_, err := domain.ValidateEvent(name, description, int(number))
		if validation, ok := err.(*domain.ValidationError); ok {
			if !nameOK {
				validation.Fields["name"] = []string{"Название обязательно"}
			}
			if !descriptionOK {
				validation.Fields["description"] = []string{"Описание обязательно"}
			}
			public := validationError()
			public.FieldErrors = validation.Fields
			writeError(c, public)
			return
		}
	}
	encoded, err := json.Marshal(body)
	if err != nil {
		writeError(c, err)
		return
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(encoded))
	c.Request.ContentLength = int64(len(encoded))
}
