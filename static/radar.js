// =============================================================================
// Constants and Configuration
// =============================================================================

const RINGS = ['Not Recommended', 'In Discovery', 'Adopted']; // Inner to Outer visually
const QUADRANTS = ['Platforms', 'Tools', 'Programming Languages & Frameworks', 'Techniques'];

// Colors (Keep status colors consistent, adjust UI elements)
const RING_COLORS = {
    'Adopted': '#006400', // Dark Green
    'In Discovery': '#B8860B', // DarkGoldenrod (better contrast than yellow on light/dark)
    'Not Recommended': '#8B0000' // Dark Red
};

const LIGHT_THEME_COLORS = {
    defaultNode: '#ccc',
    ringStroke: '#ddd',
    ringLabel: '#666',
    quadLine: '#aaa',
    quadLabel: '#333',
    nodeLabel: '#333'
};

const DARK_THEME_COLORS = {
    defaultNode: '#718096', // gray-500
    ringStroke: '#4a5568', // gray-600
    ringLabel: '#a0aec0', // gray-400
    quadLine: '#718096', // gray-500
    quadLabel: '#e2e8f0', // gray-200
    nodeLabel: '#e2e8f0'  // gray-200
};

const DEFAULT_NODE_COLOR = '#ccc';

// Radar Dimensions and Layout (relative to container)
const RADAR_MARGIN = 0; // Margin around the radar for labels (Reduced from 40)
const QUADRANT_LABEL_OFFSET = 40; // Distance of quadrant labels from outer ring - Increased from 25
const RING_LABEL_Y_OFFSET = 15; // Vertical offset for ring labels inside rings

// Node Appearance and Simulation
const NODE_RADIUS = 6;
const NODE_LABEL_X_OFFSET = 10;
const NODE_LABEL_Y_OFFSET = 4;
const NODE_FONT_SIZE = '10px';
const NODE_COLLIDE_RADIUS = 35; // Increased from 20 to prevent overlapping (includes label space)
const NODE_FORCE_STRENGTH = 0.05; // Strength of positioning forces - Reduced from 0.1
const SIMULATION_TICKS = 200; // How long to run the simulation
const RING_LABEL_EXCLUSION_RADIUS = 40; // Radius around ring labels where nodes can't appear

// UI Selectors
const RADAR_CONTAINER_SELECTOR = '.radar-container';
const RADAR_SVG_SELECTOR = '#radar';
const DETAILS_PANEL_SELECTOR = '#details-panel';
const DETAILS_TITLE_SELECTOR = '#details-title';
const DETAILS_CONTENT_SELECTOR = '#details-content';
const QUADRANT_FILTER_SELECTOR = '#quadrant-filter';
const STATUS_FILTER_SELECTOR = '#status-filter';
const LIST_CONTAINER_SELECTOR = '#quadrants-list';

// Misc
const RESIZE_DEBOUNCE_DELAY = 250; // ms delay for resize redraw

// =============================================================================
// Global State
// =============================================================================

let radarData = []; // Holds the raw data fetched from the server
let lastModified = ""; // Holds the last modified date
let selectedNodeId = null; // Track currently selected node

// =============================================================================
// Utility Functions
// =============================================================================

/** Checks if the system preference is set to dark mode */
function isDarkMode() {
    // Reverted to only check system preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Debounce function to limit the rate at which a function can fire.
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay.
 * @param {boolean} immediate Trigger the function on the leading edge instead of the trailing.
 * @returns {Function} The debounced function.
 */
function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

/**
 * Creates drag behavior handlers for the D3 simulation.
 * @param {object} simulation The D3 force simulation.
 * @returns {object} D3 drag behavior object.
 */
function setupDrag(simulation) {
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x; // Fix node position during drag
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0); // Resume simulation cooling
    // Allow simulation to reposition nodes slightly after drag if needed
    // Set fx/fy to null only if you want the node to snap back to simulation forces
     d.fx = null;
     d.fy = null;
    // If you want the node to stay exactly where dragged, keep fx/fy set:
    // d.fx = event.x;
    // d.fy = event.y;
  }

  return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
}

// =============================================================================
// UI Interaction Functions (Details Panel, Filters, List)
// =============================================================================

/**
 * Shows the details panel for a selected technology item.
 * @param {object} item The data object for the selected item.
 */
function showDetails(item) {
    const panel = document.querySelector(DETAILS_PANEL_SELECTOR);
    const title = document.querySelector(DETAILS_TITLE_SELECTOR);
    const content = document.querySelector(DETAILS_CONTENT_SELECTOR);

    if (!panel || !title || !content) {
        console.error("Details panel elements not found.");
        return;
    }

    // If clicking the same node again, hide panel and clear selection
    if (selectedNodeId === item.id) {
        closeDetails();
        return;
    }

    // Store the selected node id
    selectedNodeId = item.id;

    title.textContent = item.label;
    content.innerHTML = `
        <div class="details-item mb-4">
            <h4 class="font-semibold text-gray-600 dark:text-gray-400 mb-1">Quadrant</h4>
            <p class="text-gray-800 dark:text-gray-200">${item.quadrant}</p>
        </div>
        <div class="details-item mb-4">
            <h4 class="font-semibold text-gray-600 dark:text-gray-400 mb-1">Ring</h4>
            <p class="text-gray-800 dark:text-gray-200">${item.ring}</p>
        </div>
        <div class="details-item mb-4">
            <h4 class="font-semibold text-gray-600 dark:text-gray-400 mb-1">Owner</h4>
            <p class="text-gray-800 dark:text-gray-200">${item.owners || 'N/A'}</p>
        </div>
        <div class="details-item mb-4">
            <h4 class="font-semibold text-gray-600 dark:text-gray-400 mb-1">Description</h4>
            <p class="text-gray-800 dark:text-gray-200 text-sm">${item.description || 'No description available.'}</p>
        </div>
        ${item.moved ? '<div class="details-item"><p class="moved text-sm italic text-gray-500 dark:text-gray-400 mt-2">* This item has been moved recently.</p></div>' : ''}
    `;

    panel.classList.add('open');
    // Add class to adjust right position based on Tailwind width
    panel.classList.remove('right-[-400px]');
    panel.classList.add('right-0');
}

/**
 * Closes the details panel.
 */
function closeDetails() {
    const panel = document.querySelector(DETAILS_PANEL_SELECTOR);
    if (panel) {
        panel.classList.remove('open');
        // Reset right position
        panel.classList.remove('right-0');
        panel.classList.add('right-[-400px]');
        selectedNodeId = null; // Clear selected node when closing panel
    }
}

/**
 * Applies filters based on selected quadrant and status, then redraws the list.
 */
function applyFilters() {
    const quadrantFilter = document.querySelector(QUADRANT_FILTER_SELECTOR)?.value ?? '';
    const statusFilter = document.querySelector(STATUS_FILTER_SELECTOR)?.value ?? '';

    const filteredData = radarData.filter(item => {
        const matchesQuadrant = quadrantFilter === '' || item.quadrant === quadrantFilter;
        const matchesStatus = statusFilter === '' || item.ring === statusFilter;
        return matchesQuadrant && matchesStatus;
    });

    createList(filteredData); // Redraw the list view with filtered data
    // Note: This currently doesn't filter the radar itself, only the list.
    // To filter the radar, call drawRadar(filteredData);
}

/**
 * Creates the list view of technologies grouped by quadrant.
 * @param {Array} data The array of technology items to display.
 */
function createList(data) {
    const container = d3.select(LIST_CONTAINER_SELECTOR);
    container.selectAll('*').remove(); // Clear previous list

    QUADRANTS.forEach(quadrant => {
        const quadrantData = data.filter(item => item.quadrant === quadrant);
        if (quadrantData.length === 0) return; // Skip empty quadrants

        const quadrantDiv = container.append('div')
            .attr('class', 'quadrant mb-6'); // Added margin bottom

        quadrantDiv.append('h3')
            .attr('class', 'text-xl font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-2 mb-3') // Added dark mode classes
            .text(quadrant);

        const list = quadrantDiv.append('ul')
            .attr('class', 'technology-list space-y-2'); // Added vertical space between items

        list.selectAll('.technology-item')
            .data(quadrantData, d => d.label) // Use label as key
            .join('li')
            // Add dark variants for list item background, text, and hover state
            .attr('class', 'technology-item p-3 bg-gray-50 dark:bg-gray-700 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition duration-150 ease-in-out')
            .on('click', (event, d) => showDetails(d)) // Show details on click
            .html(d => `
                <span class="label font-medium text-gray-800 dark:text-gray-200">${d.label}</span>
                <span class="ring text-sm text-gray-500 dark:text-gray-400 ml-2">(${d.ring})</span>
                <p class="description text-sm text-gray-600 dark:text-gray-400 mt-1">${d.description || ''}</p>
                ${d.moved ? '<p class="moved text-xs italic text-gray-500 dark:text-gray-400 mt-1">Moved</p>' : ''}
            `);
             // Optional: Add moved indicator to list item
    });
}


// =============================================================================
// Radar Drawing Functions
// =============================================================================

/**
 * Sets up the main SVG container and calculates dimensions.
 * @returns {object} Containing svg, radarGroup, size, center, and radius.
 */
function setupRadarSVG() {
    // Select the container and SVG
    const container = d3.select(RADAR_CONTAINER_SELECTOR);
    if (container.empty()) {
        console.error(`Radar container not found: ${RADAR_CONTAINER_SELECTOR}`);
        return { svg: null, radarGroup: null, width: 0, height: 0 };
    }

    // Clear existing SVG content
    container.select('svg').selectAll('*').remove();
    const svg = container.select('svg');

    // Get dimensions based on the container
    const boundingRect = container.node().getBoundingClientRect();
    const width = boundingRect.width;
    const height = boundingRect.height; // Use full container height

    // Create the main group for the radar, centered
    const radius = Math.min(width, height) / 2 - RADAR_MARGIN; // Calculate radius based on smallest dimension
    const radarGroup = svg.append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`); // Center the radar group

    // Add Legend in the top-left corner of the SVG container
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', 'translate(20, 20)'); // Position legend slightly offset from top-left

    const legendItemHeight = 20;
    const legendColorWidth = 15;
    const legendTextOffset = 5;

    const legendItems = legend.selectAll('.legend-item')
        // Use Object.entries to get key-value pairs for colors
        .data(Object.entries(RING_COLORS))
        .enter()
        .append('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(0, ${i * legendItemHeight})`);

    legendItems.append('rect')
        .attr('width', legendColorWidth)
        .attr('height', legendColorWidth)
        .style('fill', d => d[1]); // d[1] is the color value

    legendItems.append('text')
        .attr('x', legendColorWidth + legendTextOffset)
        .attr('y', legendColorWidth / 2) // Center text vertically relative to the rect
        .attr('dy', '0.35em') // Vertical alignment adjustment
        .style('font-size', '12px')
        // Use theme-aware colors for text
        .style('fill', () => isDarkMode() ? DARK_THEME_COLORS.quadLabel : LIGHT_THEME_COLORS.quadLabel)
        .text(d => d[0]); // d[0] is the ring name

    // Return all necessary elements including the calculated radius
    return { svg, radarGroup, width, height, radius };
}

/**
 * Calculates the radius and angle scales for positioning items.
 * @param {number} radius The maximum radius of the radar.
 * @returns {object} Containing radiusScale and angleSlice.
 */
function calculateScales(radius) {
    const radiusScale = d3.scaleLinear()
        .domain([0, RINGS.length]) // Domain goes from center (0) to outer ring edge
        .range([0, radius]);

    const angleSlice = (Math.PI * 2) / QUADRANTS.length;

    return { radiusScale, angleSlice };
}

/**
 * Draws the concentric rings and their labels.
 * @param {object} radarGroup The D3 selection of the main radar group.
 * @param {object} radiusScale The D3 scale for radius.
 * @returns {Array} Array of ring label positions.
 */
function drawRingsAndLabels(radarGroup, radiusScale) {
    const themeColors = isDarkMode() ? DARK_THEME_COLORS : LIGHT_THEME_COLORS;
    const ringLabelPositions = [];
    
    // Draw rings (from outer to inner)
    RINGS.forEach((ring, i) => {
        // Index `i` maps to visual rings (0=inner), but scale maps 0=center.
        // We need radius based on reversed index for drawing.
        const ringIndexForScale = RINGS.length - i;
        const r = radiusScale(ringIndexForScale);

        radarGroup.append('circle')
            .attr('r', r)
            .attr('fill', 'none')
            .attr('stroke', themeColors.ringStroke)
            .attr('stroke-width', 1)
            .attr('class', `ring ring-${i}`); // Add class for potential styling

        // Add ring labels inside the rings (except for the center)
        if (ringIndexForScale > 0) {
             const labelY = -radiusScale(ringIndexForScale) + RING_LABEL_Y_OFFSET;
             const labelX = 0;
             
             // Store label position for collision avoidance
             ringLabelPositions.push({
                x: labelX,
                y: labelY
             });
             
             radarGroup.append('text')
                .attr('x', labelX)
                // Position label slightly above the middle of the ring band
                .attr('y', labelY)
                .attr('text-anchor', 'middle')
                .attr('font-size', '14px')
                .attr('font-weight', 'bold') // Make ring labels bold
                .attr('fill', themeColors.ringLabel)
                .attr('class', 'ring-label')
                .text(RINGS[i]); // Use original index for correct label
        }
    });
    
    return ringLabelPositions;
}

/**
 * Draws the quadrant lines and their labels.
 * @param {object} radarGroup The D3 selection of the main radar group.
 * @param {number} radius The maximum radius of the radar.
 * @param {number} angleSlice The angle allocated to each quadrant.
 */
function drawQuadrantLinesAndLabels(radarGroup, radius, angleSlice) {
    const themeColors = isDarkMode() ? DARK_THEME_COLORS : LIGHT_THEME_COLORS;
    QUADRANTS.forEach((quadrant, i) => {
        const angle = i * angleSlice;
        // Calculate line end points based on standard SVG angles (0=right, 90=down)
        // We adjust by -PI/2 to make 0 degrees point upwards.
        const lineAngle = angle - Math.PI / 2;
        const x = Math.cos(lineAngle) * radius;
        const y = Math.sin(lineAngle) * radius;

        // Draw quadrant line
        radarGroup.append('line')
            .attr('x1', 0)
            .attr('y1', 0)
            .attr('x2', x)
            .attr('y2', y)
            .attr('stroke', themeColors.quadLine)
            .attr('stroke-width', 1)
            .attr('class', `quadrant-line quadrant-line-${i}`);

        // Calculate label position (middle of the quadrant slice, outside the main radius)
        const labelAngle = lineAngle + angleSlice / 2;
        const labelRadius = radius + QUADRANT_LABEL_OFFSET;
        const labelX = Math.cos(labelAngle) * labelRadius;
        const labelY = Math.sin(labelAngle) * labelRadius;

        const textElement = radarGroup.append('text')
            .attr('x', labelX)
            .attr('y', labelY)
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle')
            .attr('font-weight', 'bold')
            .attr('font-size', '16px')
            .attr('fill', themeColors.quadLabel)
            .attr('class', 'quadrant-label'); // Keep class for consistency

        // Check if the quadrant label needs splitting
        if (quadrant === 'Programming Languages & Frameworks') {
            textElement.append('tspan')
                .text('Programming Languages')
                .attr('x', labelX) // Reset x for centering
                .attr('dy', '-0.6em'); // Adjust line spacing (upwards)
            textElement.append('tspan')
                .text('& Frameworks')
                .attr('x', labelX) // Reset x for centering
                .attr('dy', '1.2em'); // Adjust line spacing (downwards)
        } else {
            textElement.text(quadrant);
        }
    });
}

/**
 * Prepares the data array for the D3 force simulation.
 * Calculates target positions for each node based on ring and quadrant.
 * @param {Array} data The raw technology data.
 * @param {object} radiusScale The D3 scale for radius.
 * @param {number} angleSlice The angle allocated to each quadrant.
 * @returns {Array} The array of node objects with calculated properties.
 */
function prepareNodesForSimulation(data, radiusScale, angleSlice) {
    return data.map((item, index) => {
        const ringIndex = RINGS.indexOf(item.ring); // 0 = inner ring
        const quadrantIndex = QUADRANTS.indexOf(item.quadrant); // 0 = first quadrant

        if (ringIndex === -1 || quadrantIndex === -1) {
            // Invalid ring or quadrant - assign to center
            return { ...item, id: index, x: 0, y: 0, targetX: 0, targetY: 0, valid: false };
        }

        // Calculate target radius: middle of the assigned ring band
        const ringIndexForScaleOuter = RINGS.length - ringIndex; // Scale index for outer edge of ring
        const ringIndexForScaleInner = RINGS.length - (ringIndex + 1); // Scale index for inner edge of ring
        const targetRadius = (radiusScale(ringIndexForScaleOuter) + radiusScale(ringIndexForScaleInner)) / 2;

        // Calculate target angle: within the quadrant slice, slightly offset for spread
        const baseAngle = quadrantIndex * angleSlice - Math.PI / 2; // Start angle of quadrant (pointing up)
        // Spread items within 80% of the slice width, centered
        const angleOffset = (angleSlice * 0.1) + ((index / data.length) * (angleSlice * 0.8));
        const targetAngle = baseAngle + angleOffset;

        // Calculate target X/Y relative to the radar center (0,0)
        const targetX = Math.cos(targetAngle) * targetRadius;
        const targetY = Math.sin(targetAngle) * targetRadius;

        return {
            ...item,
            id: `node-${index}`, // Ensure unique ID
            x: targetX, // Initial position set to target
            y: targetY,
            targetX: targetX, // Store target for simulation forces
            targetY: targetY,
            targetRadius: targetRadius, // Store target radius for avoidLabel force
            valid: true
        };
    }).filter(node => node.valid); // Filter out nodes with invalid ring/quadrant
}

/**
 * Creates, configures, and runs the D3 force simulation.
 * @param {Array} nodes The array of node objects.
 * @param {Array} ringLabelPositions Array of ring label positions to avoid
 * @returns {object} The configured D3 force simulation object.
 */
function createAndRunSimulation(nodes, ringLabelPositions) {
    const simulation = d3.forceSimulation(nodes)
        // Prevent nodes from overlapping significantly
        .force("collide", d3.forceCollide().radius(NODE_COLLIDE_RADIUS))
        // Pull nodes towards their target X/Y positions
        .force("x", d3.forceX(d => d.targetX).strength(NODE_FORCE_STRENGTH))
        .force("y", d3.forceY(d => d.targetY).strength(NODE_FORCE_STRENGTH))
        // Add custom force to avoid label positions without affecting ring placement
        .force("avoidLabels", d => {
            // Check if node is too close to any ring label
            for (const labelPos of ringLabelPositions) {
                const dx = d.x - labelPos.x;
                const dy = d.y - labelPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < RING_LABEL_EXCLUSION_RADIUS) {
                    // If too close to a label, gently push away in the same circular arc
                    // This maintains the correct ring radius while moving around the circle
                    const angle = Math.atan2(d.y, d.x);
                    const ringRadius = Math.sqrt(d.targetX * d.targetX + d.targetY * d.targetY);
                    
                    // Calculate new position at same radius but slightly different angle
                    const newAngle = angle + 0.1; // Small angle shift
                    d.vx += (Math.cos(newAngle) * ringRadius - d.x) * 0.05;
                    d.vy += (Math.sin(newAngle) * ringRadius - d.y) * 0.05;
                }
            }
        })
        .stop(); // Stop simulation initially, we'll tick manually

    // Run the simulation for a fixed number of ticks to settle positions
    simulation.tick(SIMULATION_TICKS);

    return simulation; // Return simulation in case drag needs it later
}

/**
 * Draws the nodes (circles and labels) onto the radar.
 * @param {object} radarGroup The D3 selection of the main radar group.
 * @param {Array} nodes The array of node objects (after simulation).
 * @param {object} simulation The D3 force simulation object (for drag behavior).
 */
function drawNodesOnRadar(radarGroup, nodes, simulation) {
    const themeColors = isDarkMode() ? DARK_THEME_COLORS : LIGHT_THEME_COLORS;
    // Create node groups (group for circle and text)
    const node = radarGroup.selectAll(".node")
        .data(nodes, d => d.id) // Use unique ID as key
        .join("g")
        .attr("class", "node")
        .style("cursor", "pointer")
        .on('click', (event, d) => showDetails(d))
        .call(setupDrag(simulation)); // Apply drag behavior

    // Add circles to nodes
    node.append("circle")
        .attr("r", NODE_RADIUS)
        .attr("fill", d => RING_COLORS[d.ring] || themeColors.defaultNode)
        .attr("class", d => `ring-${RINGS.indexOf(d.ring)}`); // Class based on ring

    // Add labels to nodes
    node.append("text")
        .attr("x", NODE_LABEL_X_OFFSET)
        .attr("y", NODE_LABEL_Y_OFFSET) // Vertically center roughly
        .attr("font-size", () => window.innerWidth < 768 ? '8px' : NODE_FONT_SIZE) // Responsive font size
        .attr("fill", themeColors.nodeLabel)
        .style("text-decoration", d => d.moved ? "underline" : "none") // Underline if moved
        .text(d => d.label);

    // Set final node positions after simulation ticks
    node.attr("transform", d => `translate(${d.x}, ${d.y})`);
}


/**
 * Main function to draw the entire radar visualization.
 * Fetches data, sets up SVG, draws components, and runs simulation.
 * @param {Array} data The array of technology items.
 */
function drawRadar(data) {
    if (!data || data.length === 0) {
        // Clear the radar
        d3.select(RADAR_SVG_SELECTOR).selectAll('*').remove();
        return;
    }

    // 1. Setup SVG and Dimensions
    const setup = setupRadarSVG();
    if (!setup || !setup.radarGroup) { // Check if setup or radarGroup is null
        console.error("Failed to setup radar SVG or radarGroup is missing.");
        return; // Exit if setup failed
    }
    // Correctly destructure radius along with other needed properties
    const { radarGroup, radius, width, height } = setup; 

    // Check if radius is valid
    if (typeof radius !== 'number' || radius <= 0) {
        console.error("Invalid radius calculated:", radius);
        return;
    }

    // 2. Calculate Scales
    const { radiusScale, angleSlice } = calculateScales(radius);

    // 3. Draw Static Elements
    const ringLabelPositions = drawRingsAndLabels(radarGroup, radiusScale);
    drawQuadrantLinesAndLabels(radarGroup, radius, angleSlice);

    // 4. Prepare Node Data
    const nodes = prepareNodesForSimulation(data, radiusScale, angleSlice);
    if (nodes.length === 0) {
        return;
    }

    // 5. Setup and Run Simulation
    const simulation = createAndRunSimulation(nodes, ringLabelPositions);

    // 6. Draw Nodes
    drawNodesOnRadar(radarGroup, nodes, simulation);
}


// =============================================================================
// Initialization and Event Listeners
// =============================================================================

/**
 * Fetches the radar data from the API and initializes the visualization.
 */
function initializeRadar() {
    // Fetch data from API
    fetch('/api/radar')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Store in global variable for filtering
            radarData = data.items || [];
            lastModified = data.lastModified || "";

            // Apply initial theme based *only* on system preference
            const htmlElement = document.documentElement;
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                htmlElement.classList.add('dark');
            } else {
                htmlElement.classList.remove('dark');
            }
            // Removed logic for checking localStorage and setting toggle state

            // Initialize radar and list views (will use the correct theme)
            drawRadar(radarData);
            createList(radarData);

            // Setup event listeners
            window.addEventListener('resize', debounce(() => {
                // Redraw radar on resize (list is CSS responsive)
                drawRadar(radarData);
            }, RESIZE_DEBOUNCE_DELAY));

            // Listen for changes in color scheme preference and apply directly
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
                console.log("System color scheme changed. Redrawing...");
                if (event.matches) {
                    htmlElement.classList.add('dark');
                } else {
                    htmlElement.classList.remove('dark');
                }
                // Redraw both radar and list to apply new theme colors
                drawRadar(radarData);
                createList(radarData);
                // Removed check for localStorage override
            });

            // Make utility functions globally accessible
            window.closeDetails = closeDetails;
            window.applyFilters = applyFilters;
        })
        .catch(error => {
            console.error('Error loading radar data:', error);
            document.querySelector(RADAR_CONTAINER_SELECTOR).innerHTML = `
                <div class="error-message">
                    <p>Unable to load radar data. Please try again later.</p>
                    <p>Error: ${error.message}</p>
                </div>`;
        });
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', initializeRadar);
