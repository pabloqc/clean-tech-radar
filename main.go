package main

import (
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"os"

	"gopkg.in/yaml.v3"
)

const (
	port         = ":8080"
	dataFilePath = "data/radar.yaml"
	templatePath = "templates/index.html"
)

// RadarData represents the complete radar data structure.
type RadarData struct {
	LastModified string      `yaml:"LastModified" json:"lastModified"`
	Items        []RadarItem `yaml:"Items" json:"items"`
}

// RadarItem represents a technology item in the radar.
type RadarItem struct {
	Label       string `yaml:"Label" json:"label"`
	Quadrant    string `yaml:"Quadrant" json:"quadrant"`
	Ring        string `yaml:"Ring" json:"ring"`
	Moved       bool   `yaml:"Moved" json:"moved"`
	Description string `yaml:"Description" json:"description"`
	Owners      string `yaml:"Owners" json:"owners"`
}

// AppError represents an application error with HTTP status code.
type AppError struct {
	Code    int
	Message string
	Err     error
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return e.Message + ": " + e.Err.Error()
	}
	return e.Message
}

// loadRadarData reads and parses the radar data from a YAML file.
func loadRadarData() (RadarData, error) {
	file, err := os.ReadFile(dataFilePath)
	if err != nil {
		return RadarData{}, &AppError{Code: http.StatusInternalServerError, Message: "Failed to read radar data", Err: err}
	}

	var yamlMap map[string]interface{}
	if err := yaml.Unmarshal(file, &yamlMap); err != nil {
		return RadarData{}, &AppError{Code: http.StatusInternalServerError, Message: "Failed to parse radar data", Err: err}
	}

	// Create our RadarData structure
	var radarData RadarData

	// Get LastModified field
	if lastModified, ok := yamlMap["LastModified"]; ok {
		if str, ok := lastModified.(string); ok {
			radarData.LastModified = str
		}
	}

	// Get Items field and parse the items
	if items, ok := yamlMap["Items"].([]interface{}); ok {
		for _, item := range items {
			if itemMap, ok := item.(map[string]interface{}); ok {
				radarItem := RadarItem{}

				if label, ok := itemMap["Label"].(string); ok {
					radarItem.Label = label
				}
				if quadrant, ok := itemMap["Quadrant"].(string); ok {
					radarItem.Quadrant = quadrant
				}
				if ring, ok := itemMap["Ring"].(string); ok {
					radarItem.Ring = ring
				}
				if moved, ok := itemMap["Moved"].(bool); ok {
					radarItem.Moved = moved
				}
				if desc, ok := itemMap["Description"].(string); ok {
					radarItem.Description = desc
				}
				if owners, ok := itemMap["Owners"].(string); ok {
					radarItem.Owners = owners
				}

				radarData.Items = append(radarData.Items, radarItem)
			}
		}
	}

	return radarData, nil
}

// handleError writes an error response to the client.
func handleError(w http.ResponseWriter, err error) {
	if appErr, ok := err.(*AppError); ok {
		http.Error(w, appErr.Message, appErr.Code)
	} else {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
	log.Printf("Error: %v", err)
}

// apiHandler serves the radar data as a JSON API.
func apiHandler(w http.ResponseWriter, r *http.Request) {
	data, err := loadRadarData()
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(data); err != nil {
		handleError(w, &AppError{Code: http.StatusInternalServerError, Message: "Failed to encode response", Err: err})
	}
}

// indexHandler serves the main HTML page.
func indexHandler(w http.ResponseWriter, r *http.Request) {
	tmpl, err := template.ParseFiles(templatePath)
	if err != nil {
		handleError(w, &AppError{Code: http.StatusInternalServerError, Message: "Failed to load template", Err: err})
		return
	}

	data, err := loadRadarData()
	if err != nil {
		handleError(w, err)
		return
	}

	if err := tmpl.Execute(w, data); err != nil {
		handleError(w, &AppError{Code: http.StatusInternalServerError, Message: "Failed to render template", Err: err})
	}
}

// healthHandler responds with a simple OK status.
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

// setupRoutes configures the HTTP routes.
func setupRoutes() {
	http.HandleFunc("/", indexHandler)
	http.HandleFunc("/api/radar", apiHandler)
	http.HandleFunc("/health", healthHandler)
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))
}

func main() {
	setupRoutes()

	log.Printf("Server running at http://localhost%s", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
