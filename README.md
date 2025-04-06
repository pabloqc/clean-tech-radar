# Clean Tech Radar

Clean Tech Radar is a web application that visualizes technology adoption across different quadrants and rings. It allows users to filter technologies by quadrant and status, and view detailed information about each technology.

## Acknowledgments

This project is inspired by the [ThoughtWorks Technology Radar](https://www.thoughtworks.com/radar), a tool that helps organizations understand and track technology trends.

## Features

- **Interactive Radar Visualization**: Displays technologies in a radar chart with three rings: Adopted, In Discovery, and Not Recommended.
- **Filtering Options**: Filter technologies by quadrant (Platforms, Tools, Programming Languages & Frameworks, Techniques) and status.
- **Details Panel**: Click on a technology to view detailed information in a side panel.

## Setup and Installation

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd clean-tech-radar
   ```

2. **Install Dependencies**:
   Ensure you have Go installed. Initialize the Go module and install dependencies:
   ```bash
   go mod init clean-tech-radar
   go mod tidy
   ```

3. **Run the Application**:
   Start the server:
   ```bash
   go run main.go
   ```

4. **Access the Application**:
   Open your web browser and go to [http://localhost:8080](http://localhost:8080).

## Using Docker

1. **Build the Docker Image**:
   ```bash
   docker build -t clean-tech-radar .
   ```

2. **Run the Container**:
   ```bash
   docker run -p 8080:8080 clean-tech-radar
   ```

3. **Access the Application**:
   Open your web browser and go to [http://localhost:8080](http://localhost:8080).

## Project Structure

- `main.go`: The main Go application file that sets up the server and API endpoints.
- `data/radar.yaml`: YAML file containing the technology data displayed on the radar.
- `templates/index.html`: The main HTML template for the web application, including the structure and layout.
- `static/radar.js`: The primary JavaScript file responsible for fetching data, rendering the D3.js radar visualization, handling user interactions (filtering, details panel), and managing dark mode.
- `Dockerfile`: Defines the steps to build the application's Docker container image.

## Dependencies

- **Go**: The application is built using Go for the backend.
- **D3.js**: Used for rendering the radar visualization.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. 