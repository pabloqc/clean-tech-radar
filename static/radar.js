// =============================================================================
// Constants and Configuration
// =============================================================================

const RINGS = ['Not Recommended', 'In Discovery', 'Adopted']; // Inner to Outer visually
const QUADRANTS = ['Platforms', 'Tools', 'Programming Languages & Frameworks', 'Techniques'];

const RING_COLORS = {
    'Adopted': '#006400', // Dark Green
    'In Discovery': '#FFD700', // Yellow
    'Not Recommended': '#FF0000' // Red
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
const NODE_COLLIDE_RADIUS = 20; // Collision radius (includes label space)
const NODE_FORCE_STRENGTH = 0.05; // Strength of positioning forces - Reduced from 0.1
const SIMULATION_TICKS = 200; // How long to run the simulation

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

// =============================================================================
// Utility Functions
// =============================================================================

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

    title.textContent = item.label;
    content.innerHTML = `
        <div class="details-item">
            <h4>Quadrant</h4>
            <p>${item.quadrant}</p>
        </div>
        <div class="details-item">
            <h4>Ring</h4>
            <p>${item.ring}</p>
        </div>
        <div class="details-item">
            <h4>Owner</h4>
            <p>${item.owners || 'N/A'}</p>
        </div>
        <div class="details-item">
            <h4>Description</h4>
            <p>${item.description || 'No description available.'}</p>
        </div>
        ${item.moved ? '<div class="details-item"><p class="moved">This item has moved</p></div>' : ''}
    `;

    panel.classList.add('open');
}

/**
 * Closes the details panel.
 */
function closeDetails() {
    const panel = document.querySelector(DETAILS_PANEL_SELECTOR);
    if (panel) {
        panel.classList.remove('open');
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
            .attr('class', 'quadrant');

        quadrantDiv.append('h3').text(quadrant);

        const list = quadrantDiv.append('ul')
            .attr('class', 'technology-list'); // Added class for potential styling

        list.selectAll('.technology-item')
            .data(quadrantData, d => d.label) // Use label as key
            .join('li')
            .attr('class', 'technology-item')
            .on('click', (event, d) => showDetails(d)) // Show details on click
            .html(d => `
                <span class="label">${d.label}</span>
                <span class="ring">(${d.ring})</span>
                <p class="description">${d.description || ''}</p>
                ${d.moved ? '<p class="moved" style="font-style: italic; color: grey;">Moved</p>' : ''}
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
    const container = document.querySelector(RADAR_CONTAINER_SELECTOR);
    if (!container) {
        console.error("Radar container not found:", RADAR_CONTAINER_SELECTOR);
        return null;
    }
    const width = container.clientWidth;
    const height = container.clientHeight;
    const size = Math.min(width, height);
    const center = { x: size / 2, y: size / 2 };
    const radius = size / 2 - RADAR_MARGIN;

    const svg = d3.select(RADAR_SVG_SELECTOR)
        .attr('width', size)
        .attr('height', size)
        .attr('viewBox', [0, 0, size, size]);

    // Clear previous content
    svg.selectAll('*').remove();

    // Create a group for the radar, centered in the SVG
    const radarGroup = svg.append('g')
        .attr('transform', `translate(${center.x},${center.y})`);

    return { svg, radarGroup, size, center, radius };
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
 */
function drawRingsAndLabels(radarGroup, radiusScale) {
    // Draw rings (from outer to inner)
    RINGS.forEach((ring, i) => {
        // Index `i` maps to visual rings (0=inner), but scale maps 0=center.
        // We need radius based on reversed index for drawing.
        const ringIndexForScale = RINGS.length - i;
        const r = radiusScale(ringIndexForScale);

        radarGroup.append('circle')
            .attr('r', r)
            .attr('fill', 'none')
            .attr('stroke', '#ddd')
            .attr('stroke-width', 1)
            .attr('class', `ring ring-${i}`); // Add class for potential styling

        // Add ring labels inside the rings (except for the center)
        if (ringIndexForScale > 0) {
             const labelY = -radiusScale(ringIndexForScale - 0.5) ; // Position label in middle of ring band
             radarGroup.append('text')
                .attr('x', 0)
                // Position label slightly above the middle of the ring band
                .attr('y', -radiusScale(ringIndexForScale) + RING_LABEL_Y_OFFSET)
                .attr('text-anchor', 'middle')
                .attr('font-size', '14px')
                .attr('font-weight', 'bold') // Make ring labels bold
                .attr('fill', '#666')
                .attr('class', 'ring-label')
                .text(RINGS[i]); // Use original index for correct label
        }
    });
}

/**
 * Draws the quadrant lines and their labels.
 * @param {object} radarGroup The D3 selection of the main radar group.
 * @param {number} radius The maximum radius of the radar.
 * @param {number} angleSlice The angle allocated to each quadrant.
 */
function drawQuadrantLinesAndLabels(radarGroup, radius, angleSlice) {
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
            .attr('stroke', '#aaa')
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
            console.warn(`Item "${item.label}" has invalid ring or quadrant:`, item.ring, item.quadrant);
            // Assign default position or skip? For now, assign center.
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
            valid: true
        };
    }).filter(node => node.valid); // Filter out nodes with invalid ring/quadrant
}

/**
 * Creates, configures, and runs the D3 force simulation.
 * @param {Array} nodes The array of node objects.
 * @returns {object} The configured D3 force simulation object.
 */
function createAndRunSimulation(nodes) {
    const simulation = d3.forceSimulation(nodes)
        // Prevent nodes from overlapping significantly
        .force("collide", d3.forceCollide().radius(NODE_COLLIDE_RADIUS))
        // Pull nodes towards their target X/Y positions
        .force("x", d3.forceX(d => d.targetX).strength(NODE_FORCE_STRENGTH))
        .force("y", d3.forceY(d => d.targetY).strength(NODE_FORCE_STRENGTH))
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
        .attr("fill", d => RING_COLORS[d.ring] || DEFAULT_NODE_COLOR)
        .attr("class", d => `ring-${RINGS.indexOf(d.ring)}`); // Class based on ring

    // Add labels to nodes
    node.append("text")
        .attr("x", NODE_LABEL_X_OFFSET)
        .attr("y", NODE_LABEL_Y_OFFSET) // Vertically center roughly
        .attr("font-size", NODE_FONT_SIZE)
        .attr("fill", "#333")
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
        console.warn("No data provided to drawRadar.");
        // Optionally clear the radar or show a message
        d3.select(RADAR_SVG_SELECTOR).selectAll('*').remove();
        return;
    }

    // 1. Setup SVG and Dimensions
    const setup = setupRadarSVG();
    if (!setup) return; // Exit if container not found
    const { radarGroup, radius } = setup;

    // 2. Calculate Scales
    const { radiusScale, angleSlice } = calculateScales(radius);

    // 3. Draw Static Elements
    drawRingsAndLabels(radarGroup, radiusScale);
    drawQuadrantLinesAndLabels(radarGroup, radius, angleSlice);

    // 4. Prepare Node Data
    const nodes = prepareNodesForSimulation(data, radiusScale, angleSlice);
     if (nodes.length === 0) {
         console.warn("No valid nodes to draw after preparation.");
         return;
     }

    // 5. Setup and Run Simulation
    const simulation = createAndRunSimulation(nodes);

    // 6. Draw Nodes
    drawNodesOnRadar(radarGroup, nodes, simulation);
}


// =============================================================================
// Initialization and Event Listeners
// =============================================================================

/**
 * Fetches radar data from the API and initiates drawing.
 */
function initializeRadar() {
    fetch('/api/radar')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (!data || !Array.isArray(data)) {
                 console.error("Invalid data received from API:", data);
                 throw new Error("Invalid data format received from API.");
            }
            radarData = data; // Store globally
            drawRadar(radarData); // Initial draw of the radar
            createList(radarData); // Initial draw of the list
        })
        .catch(error => {
            console.error('Error fetching or processing radar data:', error);
            // Display an error message to the user?
            const container = d3.select(RADAR_CONTAINER_SELECTOR);
            if(container) {
                container.html('<p style="color: red; text-align: center;">Could not load radar data.</p>');
            }
        });
}

// Debounced resize handler
const handleResize = debounce(() => {
    if (radarData.length > 0) {
        console.log("Redrawing radar due to resize."); // Log resize redraw
        drawRadar(radarData);
    }
}, RESIZE_DEBOUNCE_DELAY);

// Add event listeners when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeRadar(); // Fetch data and draw initially

    // Add resize listener
    window.addEventListener('resize', handleResize);

    // Add listeners for filters (if they exist)
    const quadrantFilter = document.querySelector(QUADRANT_FILTER_SELECTOR);
    const statusFilter = document.querySelector(STATUS_FILTER_SELECTOR);
    if (quadrantFilter) quadrantFilter.addEventListener('change', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);

    // Add listener for details panel close button (assuming one exists)
    const closeBtn = document.querySelector(`${DETAILS_PANEL_SELECTOR} .close-button`);
    if (closeBtn) {
        closeBtn.addEventListener('click', closeDetails);
    } else {
        // Fallback: Close panel if clicking outside the details content (basic)
        // This might interfere with other clicks, use with caution or a dedicated overlay.
        // document.addEventListener('click', (event) => {
        //     const panel = document.querySelector(DETAILS_PANEL_SELECTOR);
        //     if (panel && panel.classList.contains('open') && !panel.contains(event.target)) {
        //          // Basic check if click is outside panel
        //          // Check if the click target is NOT the node itself
        //          if (!event.target.closest('.node')) {
        //              closeDetails();
        //          }
        //     }
        // });
    }
});
