// =============================================================================
// Constants and Configuration
// =============================================================================

const RINGS = ['Not Recommended', 'In Discovery', 'Adopted']; // Inner to Outer visually
const QUADRANTS = ['Platforms', 'Tools', 'Programming Languages & Frameworks', 'Techniques'];

// Vivid node colors for better visibility
const RING_COLORS = {
    'Adopted': '#00C000', // Bright Green
    'In Discovery': '#FFA500', // Orange
    'Not Recommended': '#FF0000'  // Bright Red
};

// Theme-specific UI colors
const THEME_COLORS = {
    light: {
        defaultNode: '#ccc',
        ringStroke: '#ddd',
        ringLabel: '#666',
        quadLine: '#aaa',
        quadLabel: '#333',
        nodeLabel: '#333',
        background: 'bg-gray-100',
        text: 'text-gray-900'
    },
    dark: {
        defaultNode: '#718096',
        ringStroke: '#4a5568',
        ringLabel: '#a0aec0',
        quadLine: '#718096',
        quadLabel: '#e2e8f0',
        nodeLabel: '#e2e8f0',
        background: 'bg-gray-900',
        text: 'text-gray-100'
    }
};

// Layout and appearance settings
const LAYOUT = {
    margin: 0,
    quadrantLabelOffset: 40,
    ringLabelYOffset: 15,
    nodeRadius: 6,
    nodeLabelXOffset: 10,
    nodeLabelYOffset: 4,
    nodeFontSize: '10px',
    nodeCollideRadius: 35,
    forceStrength: 0.05,
    simulationTicks: 200,
    ringLabelExclusionRadius: 40,
    resizeDebounceDelay: 250
};

// UI Selectors
const SELECTORS = {
    radarContainer: '.radar-container',
    radarSvg: '#radar',
    detailsPanel: '#details-panel',
    detailsTitle: '#details-title',
    detailsContent: '#details-content',
    quadrantFilter: '#quadrant-filter',
    statusFilter: '#status-filter',
    listContainer: '#quadrants-list',
    themeToggle: '#theme-toggle'
};

// =============================================================================
// Global State
// =============================================================================

let radarData = [];
let lastModified = "";
let selectedNodeId = null;
let currentTheme = 'system';
let activeFilters = { ring: null, quadrant: null };

// =============================================================================
// Utility Functions
// =============================================================================

/** Creates a debounced function that delays invoking func */
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/** Filters data based on active filters */
function filterData(data) {
    if (!activeFilters.ring && !activeFilters.quadrant) return data;
    
    return data.filter(item => {
        const matchesRing = !activeFilters.ring || item.ring === activeFilters.ring;
        const matchesQuadrant = !activeFilters.quadrant || item.quadrant === activeFilters.quadrant;
        return matchesRing && matchesQuadrant;
    });
}

/** Updates UI to reflect current filter state */
function updateFiltersUI() {
    // Update dropdowns
    const quadrantFilterEl = document.querySelector(SELECTORS.quadrantFilter);
    const statusFilterEl = document.querySelector(SELECTORS.statusFilter);
    
    if (quadrantFilterEl) quadrantFilterEl.value = activeFilters.quadrant || '';
    if (statusFilterEl) statusFilterEl.value = activeFilters.ring || '';
    
    // Update filtered view
    createList(filterData(radarData));
    drawRadar(radarData);
}

/** Resets all active filters and updates UI */
function resetFilters() {
    activeFilters.ring = null;
    activeFilters.quadrant = null;
    updateFiltersUI();
}

/** Gets current theme colors based on dark mode state */
function getThemeColors() {
    return isDarkMode() ? THEME_COLORS.dark : THEME_COLORS.light;
}

/** Checks if dark mode should be active based on current theme preference */
function isDarkMode() {
    if (currentTheme === 'light') return false;
    if (currentTheme === 'dark') return true;
    // If 'system', use system preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Creates drag behavior handlers for D3 simulation */
function setupDrag(simulation) {
    return d3.drag()
        .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        })
        .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
        })
        .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        });
}

// =============================================================================
// Theme Management
// =============================================================================

/** Toggles between light, dark and system themes */
function toggleTheme() {
    // Cycle through themes: system -> light -> dark -> system
    const THEMES = ['system', 'light', 'dark'];
    const currentIndex = THEMES.indexOf(currentTheme);
    currentTheme = THEMES[(currentIndex + 1) % THEMES.length];
    
    // Save to localStorage and apply
    localStorage.setItem('themePreference', currentTheme);
    applyTheme();
    
    // Update UI
    const toggleButton = document.querySelector(SELECTORS.themeToggle);
    if (toggleButton) {
        toggleButton.textContent = `Theme: ${currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1)}`;
    }
    
    drawRadar(radarData);
}

/** Applies the current theme to the document */
function applyTheme() {
    const htmlElement = document.documentElement;
    if (isDarkMode()) {
        htmlElement.classList.add('dark');
    } else {
        htmlElement.classList.remove('dark');
    }
    void htmlElement.offsetHeight; // Force a reflow
}

/** Initialize theme from localStorage or system preference */
function initTheme() {
    currentTheme = localStorage.getItem('themePreference') || 'system';
    applyTheme();
    
    const toggleButton = document.querySelector(SELECTORS.themeToggle);
    if (toggleButton) {
        toggleButton.textContent = `Theme: ${currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1)}`;
        toggleButton.addEventListener('click', toggleTheme);
    }
    
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (currentTheme === 'system') {
            applyTheme();
            drawRadar(radarData);
        }
    });
}

// =============================================================================
// UI Interaction Functions
// =============================================================================

/** Shows the details panel for a selected technology item */
function showDetails(item) {
    const panel = document.querySelector(SELECTORS.detailsPanel);
    const title = document.querySelector(SELECTORS.detailsTitle);
    const content = document.querySelector(SELECTORS.detailsContent);

    if (!panel || !title || !content) {
        console.error("Details panel elements not found.");
        return;
    }

    // Toggle panel if clicking the same node again
    if (selectedNodeId === item.id) {
        closeDetails();
        return;
    }

    selectedNodeId = item.id;
    const ringColor = RING_COLORS[item.ring];

    title.textContent = item.label;
    content.innerHTML = `
        <div class="ring-indicator mb-4 flex items-center">
            <div class="w-4 h-4 rounded-full mr-2" style="background-color: ${ringColor};"></div>
            <span class="font-medium text-gray-800 dark:text-gray-200">${item.ring}</span>
        </div>
        <div class="details-item mb-4">
            <h4 class="font-semibold text-gray-600 dark:text-gray-400 mb-1">Quadrant</h4>
            <p class="text-gray-800 dark:text-gray-200">${item.quadrant}</p>
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
    panel.classList.remove('right-[-400px]');
    panel.classList.add('right-0');
}

/** Closes the details panel */
function closeDetails() {
    const panel = document.querySelector(SELECTORS.detailsPanel);
    if (panel) {
        panel.classList.remove('open');
        panel.classList.remove('right-0');
        panel.classList.add('right-[-400px]');
        selectedNodeId = null;
    }
}

/** Applies filters based on selected quadrant and status */
function applyFilters() {
    const quadrantFilter = document.querySelector(SELECTORS.quadrantFilter)?.value ?? '';
    const statusFilter = document.querySelector(SELECTORS.statusFilter)?.value ?? '';
    
    activeFilters.quadrant = quadrantFilter || null;
    activeFilters.ring = statusFilter || null;
    
    updateFiltersUI();
}

/** Creates the list view of technologies grouped by quadrant */
function createList(data) {
    const container = d3.select(SELECTORS.listContainer);
    container.selectAll('*').remove();
    
    const themeColors = getThemeColors();

    QUADRANTS.forEach(quadrant => {
        const quadrantData = data.filter(item => item.quadrant === quadrant);
        if (quadrantData.length === 0) return;

        const quadrantDiv = container.append('div')
            .attr('class', 'quadrant mb-6');

        quadrantDiv.append('h3')
            .attr('class', 'text-xl font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-2 mb-3')
            .text(quadrant);

        const list = quadrantDiv.append('ul')
            .attr('class', 'technology-list space-y-2');

        list.selectAll('.technology-item')
            .data(quadrantData, d => d.label)
            .join('li')
            .attr('class', 'technology-item p-3 bg-gray-50 dark:bg-gray-700 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition duration-150 ease-in-out')
            .on('click', (event, d) => showDetails(d))
            .html(d => {
                const color = RING_COLORS[d.ring];
                return `
                    <div class="flex items-center">
                        <div class="mr-2 w-3 h-3 rounded-full" style="background-color: ${color};"></div>
                        <span class="label font-medium text-gray-800 dark:text-gray-200">${d.label}</span>
                        <span class="ring text-sm text-gray-500 dark:text-gray-400 ml-2">(${d.ring})</span>
                    </div>
                    <p class="description text-sm text-gray-600 dark:text-gray-400 mt-1">${d.description || ''}</p>
                    ${d.moved ? '<p class="moved text-xs italic text-gray-500 dark:text-gray-400 mt-1">Moved</p>' : ''}
                `;
            });
    });
}

// =============================================================================
// Radar Drawing Functions
// =============================================================================

/** Sets up the radar SVG container and calculates dimensions */
function setupRadarSVG() {
    const container = d3.select(SELECTORS.radarContainer);
    if (container.empty()) {
        console.error(`Radar container not found: ${SELECTORS.radarContainer}`);
        return null;
    }

    container.select('svg').selectAll('*').remove();
    const svg = container.select('svg');

    const boundingRect = container.node().getBoundingClientRect();
    const width = boundingRect.width;
    const height = boundingRect.height;

    const radius = Math.min(width, height) / 2 - LAYOUT.margin;
    const radarGroup = svg.append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);

    // Add Legend
    setupLegend(svg);

    return { svg, radarGroup, width, height, radius };
}

/** Sets up the color legend and makes it interactive */
function setupLegend(svg) {
    const themeColors = getThemeColors();
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', 'translate(20, 20)');

    const legendItemHeight = 20;
    const legendColorWidth = 15;
    const legendTextOffset = 5;

    const legendItems = legend.selectAll('.legend-item')
        .data(Object.entries(RING_COLORS))
        .enter()
        .append('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(0, ${i * legendItemHeight})`)
        .style('cursor', 'pointer')
        .on('click', (event, d) => {
            activeFilters.ring = activeFilters.ring === d[0] ? null : d[0];
            updateFiltersUI();
        });

    legendItems.append('rect')
        .attr('width', legendColorWidth)
        .attr('height', legendColorWidth)
        .style('fill', d => d[1]);

    legendItems.append('text')
        .attr('x', legendColorWidth + legendTextOffset)
        .attr('y', legendColorWidth / 2)
        .attr('dy', '0.35em')
        .style('font-size', '12px')
        .style('fill', themeColors.quadLabel)
        .style('font-weight', d => activeFilters.ring === d[0] ? 'bold' : 'normal')
        .text(d => d[0]);
}

/** Draws radar rings, quadrants, and their labels */
function drawRadarStructure(radarGroup, radius) {
    const themeColors = getThemeColors();
    const ringLabelPositions = [];
    const radiusScale = d3.scaleLinear()
        .domain([0, RINGS.length])
        .range([0, radius]);
    const angleSlice = (Math.PI * 2) / QUADRANTS.length;
    
    // Draw rings
    RINGS.forEach((ring, i) => {
        const ringIndexForScale = RINGS.length - i;
        const r = radiusScale(ringIndexForScale);

        radarGroup.append('circle')
            .attr('r', r)
            .attr('fill', 'none')
            .attr('stroke', themeColors.ringStroke)
            .attr('stroke-width', 1)
            .attr('class', `ring ring-${i}`);

        if (ringIndexForScale > 0) {
             const labelY = -radiusScale(ringIndexForScale) + LAYOUT.ringLabelYOffset;
             ringLabelPositions.push({ x: 0, y: labelY });
             
             radarGroup.append('text')
                .attr('x', 0)
                .attr('y', labelY)
                .attr('text-anchor', 'middle')
                .attr('font-size', '14px')
                .attr('font-weight', 'bold')
                .attr('fill', themeColors.ringLabel)
                .attr('class', 'ring-label')
                .text(RINGS[i]);
        }
    });
    
    // Draw quadrant lines and labels
    QUADRANTS.forEach((quadrant, i) => {
        const angle = i * angleSlice;
        const lineAngle = angle - Math.PI / 2;
        const x = Math.cos(lineAngle) * radius;
        const y = Math.sin(lineAngle) * radius;

        radarGroup.append('line')
            .attr('x1', 0)
            .attr('y1', 0)
            .attr('x2', x)
            .attr('y2', y)
            .attr('stroke', themeColors.quadLine)
            .attr('stroke-width', 1)
            .attr('class', `quadrant-line quadrant-line-${i}`);

        const labelAngle = lineAngle + angleSlice / 2;
        const labelRadius = radius + LAYOUT.quadrantLabelOffset;
        const labelX = Math.cos(labelAngle) * labelRadius;
        const labelY = Math.sin(labelAngle) * labelRadius;

        const textElement = radarGroup.append('text')
            .attr('x', labelX)
            .attr('y', labelY)
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle')
            .attr('font-weight', activeFilters.quadrant === quadrant ? 'bolder' : 'bold')
            .attr('font-size', '16px')
            .attr('fill', themeColors.quadLabel)
            .attr('class', 'quadrant-label')
            .attr('data-quadrant', quadrant)
            .style('cursor', 'pointer')
            .on('click', () => {
                activeFilters.quadrant = activeFilters.quadrant === quadrant ? null : quadrant;
                updateFiltersUI();
            });

        if (quadrant === 'Programming Languages & Frameworks') {
            textElement.append('tspan')
                .text('Programming Languages')
                .attr('x', labelX)
                .attr('dy', '-0.6em');
            textElement.append('tspan')
                .text('& Frameworks')
                .attr('x', labelX)
                .attr('dy', '1.2em');
        } else {
            textElement.text(quadrant);
        }
    });
    
    return { radiusScale, angleSlice, ringLabelPositions };
}

/** Prepares the data array for the D3 force simulation */
function prepareNodesForSimulation(data, radiusScale, angleSlice) {
    return data.map((item, index) => {
        const ringIndex = RINGS.indexOf(item.ring);
        const quadrantIndex = QUADRANTS.indexOf(item.quadrant);

        if (ringIndex === -1 || quadrantIndex === -1) {
            return { ...item, id: index, x: 0, y: 0, targetX: 0, targetY: 0, valid: false };
        }

        const ringIndexForScaleOuter = RINGS.length - ringIndex;
        const ringIndexForScaleInner = RINGS.length - (ringIndex + 1);
        const targetRadius = (radiusScale(ringIndexForScaleOuter) + radiusScale(ringIndexForScaleInner)) / 2;

        const baseAngle = quadrantIndex * angleSlice - Math.PI / 2;
        const angleOffset = (angleSlice * 0.1) + ((index / data.length) * (angleSlice * 0.8));
        const targetAngle = baseAngle + angleOffset;

        const targetX = Math.cos(targetAngle) * targetRadius;
        const targetY = Math.sin(targetAngle) * targetRadius;

        return {
            ...item,
            id: `node-${index}`,
            x: targetX,
            y: targetY,
            targetX,
            targetY,
            targetRadius,
            valid: true
        };
    }).filter(node => node.valid);
}

/** Creates and runs the D3 force simulation to position nodes */
function positionNodes(nodes, ringLabelPositions) {
    const simulation = d3.forceSimulation(nodes)
        .force("collide", d3.forceCollide().radius(LAYOUT.nodeCollideRadius))
        .force("x", d3.forceX(d => d.targetX).strength(LAYOUT.forceStrength))
        .force("y", d3.forceY(d => d.targetY).strength(LAYOUT.forceStrength))
        .force("avoidLabels", d => {
            for (const labelPos of ringLabelPositions) {
                const dx = d.x - labelPos.x;
                const dy = d.y - labelPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < LAYOUT.ringLabelExclusionRadius) {
                    const angle = Math.atan2(d.y, d.x);
                    const ringRadius = Math.sqrt(d.targetX * d.targetX + d.targetY * d.targetY);
                    const newAngle = angle + 0.1;
                    d.vx += (Math.cos(newAngle) * ringRadius - d.x) * 0.05;
                    d.vy += (Math.sin(newAngle) * ringRadius - d.y) * 0.05;
                }
            }
        })
        .stop();

    simulation.tick(LAYOUT.simulationTicks);
    return simulation;
}

/** Draws the nodes and updates their visibility based on active filters */
function drawNodes(radarGroup, nodes, simulation) {
    const themeColors = getThemeColors();
    
    // Calculate opacity based on filters
    const getNodeOpacity = d => {
        if (!activeFilters.ring && !activeFilters.quadrant) return 1;
        const matchesRing = !activeFilters.ring || d.ring === activeFilters.ring;
        const matchesQuadrant = !activeFilters.quadrant || d.quadrant === activeFilters.quadrant;
        return (matchesRing && matchesQuadrant) ? 1 : 0.2;
    };
    
    const node = radarGroup.selectAll(".node")
        .data(nodes, d => d.id)
        .join("g")
        .attr("class", "node")
        .style("cursor", "pointer")
        .on('click', (event, d) => showDetails(d))
        .call(setupDrag(simulation));

    node.append("circle")
        .attr("r", LAYOUT.nodeRadius)
        .attr("fill", d => RING_COLORS[d.ring] || themeColors.defaultNode)
        .attr("class", d => `ring-${RINGS.indexOf(d.ring)}`)
        .style("opacity", getNodeOpacity);

    node.append("text")
        .attr("x", LAYOUT.nodeLabelXOffset)
        .attr("y", LAYOUT.nodeLabelYOffset)
        .attr("font-size", () => window.innerWidth < 768 ? '8px' : LAYOUT.nodeFontSize)
        .attr("fill", themeColors.nodeLabel)
        .style("text-decoration", d => d.moved ? "underline" : "none")
        .style("opacity", getNodeOpacity)
        .text(d => d.label);

    node.attr("transform", d => `translate(${d.x}, ${d.y})`);
    
    // Update legend and quadrant label styling
    updateFilterVisuals();
}

/** Updates visual indicators for active filters */
function updateFilterVisuals() {
    // Update legend text weight
    d3.selectAll('.legend-item text')
        .style('font-weight', d => activeFilters.ring === d[0] ? 'bold' : 'normal');
        
    // Update quadrant labels weight
    d3.selectAll('.quadrant-label').each(function() {
        const element = d3.select(this);
        const quadrant = element.attr('data-quadrant');
        
        if (quadrant) {
            element.attr('font-weight', activeFilters.quadrant === quadrant ? 'bolder' : 'bold');
        } else {
            // Handle multi-line text for Programming Languages & Frameworks
            const text = element.text();
            if (text === 'Programming Languages' || text === '& Frameworks') {
                element.attr('font-weight', 
                    activeFilters.quadrant === 'Programming Languages & Frameworks' ? 'bolder' : 'bold');
            }
        }
    });
}

/** Main function to draw the entire radar visualization */
function drawRadar(data) {
    if (!data || data.length === 0) {
        d3.select(SELECTORS.radarSvg).selectAll('*').remove();
        return;
    }

    const setup = setupRadarSVG();
    if (!setup) return;
    
    const { radarGroup, radius } = setup;
    if (typeof radius !== 'number' || radius <= 0) {
        console.error("Invalid radius calculated:", radius);
        return;
    }

    // Draw radar structure (rings and quadrants)
    const { radiusScale, angleSlice, ringLabelPositions } = drawRadarStructure(radarGroup, radius);
    
    // Prepare and position nodes
    const nodes = prepareNodesForSimulation(data, radiusScale, angleSlice);
    if (nodes.length === 0) return;
    
    const simulation = positionNodes(nodes, ringLabelPositions);
    
    // Draw nodes with appropriate visibility
    drawNodes(radarGroup, nodes, simulation);
}

// =============================================================================
// Initialization and Event Listeners
// =============================================================================

/** Fetches the radar data and initializes the visualization */
function initializeRadar() {
    // Initialize theme
    initTheme();

    // Set up event handlers
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
    window.closeDetails = closeDetails;
    window.applyFilters = applyFilters;
    window.resetFilters = resetFilters;

    // Fetch data
    fetch('/api/radar')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            radarData = data.items || [];
            lastModified = data.lastModified || "";

            drawRadar(radarData);
            createList(radarData);

            // Handle window resize
            window.addEventListener('resize', debounce(() => drawRadar(radarData), LAYOUT.resizeDebounceDelay));
        })
        .catch(error => {
            console.error('Error loading radar data:', error);
            document.querySelector(SELECTORS.radarContainer).innerHTML = `
                <div class="error-message">
                    <p>Unable to load radar data. Please try again later.</p>
                    <p>Error: ${error.message}</p>
                </div>`;
        });
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', initializeRadar);
