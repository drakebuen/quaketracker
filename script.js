document.addEventListener('DOMContentLoaded', () => {
    const mapElement = document.getElementById('map');
    const loadingElement = document.getElementById('loading');
    const legendElement = document.getElementById('legend');

    // --- Configuration ---
    // USGS GeoJSON Feed URL (UPDATED: Current Month's Significant Earthquakes)
    // const earthquakeDataURL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson'; // URL for significant earthquakes
    const earthquakeDataURL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson'; // URL for earthquakes with magnitude 4.5 and above in the last week
    // Note: You can change the URL to other feeds as per your requirement from USGS Earthquake Hazards Program.

    const mapCenter = [20, 0]; // Initial map center [latitude, longitude]
    const mapZoom = 2;        // Initial map zoom level (good for world view)

    // --- Initialize Leaflet Map ---
    const map = L.map(mapElement).setView(mapCenter, mapZoom);

    // Add Tile Layer (using CARTO Voyager for primarily English labels)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd', // CARTO uses subdomains a, b, c, d
        maxZoom: 20 // CARTO tiles often support higher zoom levels
    }).addTo(map);

    // --- Fetch and Process Earthquake Data ---
    fetch(earthquakeDataURL)
        .then(response => {
            // Check if the response status is OK (e.g., 200)
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json(); // Parse the response body as JSON
        })
        .then(data => {
            loadingElement.style.display = 'none'; // Hide loading indicator
            console.log("Earthquake data fetched:", data); // Log data for debugging

            // Check if the fetched data looks like valid GeoJSON with features
            if (data && data.features && Array.isArray(data.features)) {
                addEarthquakeMarkers(data.features); // Process the earthquake features
                createLegend(); // Create the legend based on depth colors
            } else {
                // Handle cases where data is fetched but might be empty or malformed
                mapElement.innerHTML = 'Data received from USGS, but it appears to contain no earthquake features or is in an unexpected format.';
                console.warn("Received data object lacks 'features' array or is not as expected:", data);
            }
        })
        .catch(error => {
            // Handle network errors, CORS issues (when running locally), or parsing errors
            loadingElement.style.display = 'none'; // Hide loading indicator
            console.error("Error fetching or processing earthquake data:", error);

            // Provide a helpful user message in the map container
            let userErrorMessage = `Error loading earthquake data: ${error.message}.`;

            // Specifically check for potential CORS issues when running from local file system
            if (window.location.protocol === 'file:') {
                userErrorMessage += '<br><br><b>Note:</b> Loading external data directly from a local file (file:///) can be blocked by browser security (CORS policy).';
                userErrorMessage += '<br><b>Solution:</b> Try running this page using a simple local web server (see console or project instructions).';
            } else if (error instanceof TypeError && error.message.includes('fetch')) {
                // Catch generic fetch errors (network, potentially CORS even not on file://)
                userErrorMessage += '<br><br>This might be a network issue, a temporary problem with the USGS server, or a browser security block (CORS). Please check your internet connection and try again. If the problem persists, check the browser console (F12) for more details.';
            } else {
                // General error fallback
                userErrorMessage += '<br><br>Please check your internet connection and ensure the USGS server is accessible. Try refreshing the page.';
            }
            // Display the error message within a styled div inside the map container
            mapElement.innerHTML = `<div style="padding: 20px; color: red; border: 1px solid red; background-color: #fee; margin: 10px;">${userErrorMessage}</div>`;
        });

    // --- Helper Functions ---

    /**
     * Adds earthquake circle markers to the map based on the GeoJSON features.
     * @param {Array} features - Array of earthquake features from GeoJSON.
     */
    function addEarthquakeMarkers(features) {
        features.forEach(feature => {
            // Ensure the feature has geometry and coordinates
            if (feature.geometry && feature.geometry.coordinates) {
                const coords = feature.geometry.coordinates; // [longitude, latitude, depth]
                const props = feature.properties;           // Contains mag, place, time, url etc.
                const magnitude = props.mag;
                const depth = coords[2]; // Depth is the third element

                // Leaflet requires coordinates in [latitude, longitude] order
                const latLng = [coords[1], coords[0]];

                // Create a circle marker (radius based on magnitude, color on depth)
                const circleMarker = L.circleMarker(latLng, {
                    radius: calculateRadius(magnitude), // Calculate radius based on magnitude
                    fillColor: getColor(magnitude),         // Get fill color based on depth
                    // color: "#000",                      // Border color for the circle
                    color: "#fff",                      // Border color for the circle (white)
                    weight: 0.5,                        // Border width
                    opacity: 1,                         // Border opacity
                    fillOpacity: 0.7                    // Fill opacity
                }).addTo(map); // Add the circle marker to the map

                // Create informative content for the tooltip (shown on hover)
                const tooltipContent = `
                    <b>Magnitude: ${magnitude !== null ? magnitude.toFixed(1) : 'N/A'}</b><br>
                    Location: ${props.place || 'Information unavailable'}<br>
                    Time: ${new Date(props.time).toLocaleString()}<br>
                    Depth: ${depth !== null ? depth.toFixed(1) + ' km' : 'N/A'}
                    ${props.url ? `<br><a href="${props.url}" target="_blank" rel="noopener noreferrer">More Info (USGS)</a>` : ''}
                `;

                // Bind the tooltip to the marker, making it appear on hover
                circleMarker.bindTooltip(tooltipContent, {
                    sticky: true // Tooltip follows the mouse cursor
                });
            } else {
                // Log a warning if a feature is missing geometry (should be rare for USGS feed)
                console.warn('Skipping feature without valid geometry/coordinates:', feature);
            }
        });
        console.log(`Added ${features.length} earthquake markers to the map.`);
    }

    /**
     * Calculates marker radius based on earthquake magnitude.
     * Uses a non-linear scale for better visual distinction and handles null/negative mags.
     * @param {number | null} magnitude - The magnitude of the earthquake.
     * @returns {number} - The radius in pixels for the circle marker.
     */
    function calculateRadius(magnitude) {
        // Handle null or undefined magnitude
        if (magnitude === null || typeof magnitude === 'undefined') {
            return 3; // Return a small default radius
        }
        // Handle negative magnitudes (can occur for very small events)
        if (magnitude < 0) {
            return 2; // Smallest radius for negative mags
        }
        // Simple non-linear scaling (mag^2) with a minimum radius of 3
        // Adjust the multiplier (0.5) or minimum (3) as needed for visual preference
        return Math.max(magnitude * magnitude * 0.5, 3);
    }

    /**
     * Determines marker fill color based on earthquake magnitude.
     * Uses a predefined color scale (stronger = darker colors).
     * @param {number | null} magnitude - The magnitude of the earthquake.
     * @returns {string} - The hex color code for the marker fill.
     */
    function getColor(magnitude) {
        // Handle null or undefined magnitude
        if (magnitude === null || typeof magnitude === 'undefined') {
            return '#cccccc'; // Default gray color for unknown magnitude
        }
        // Color scale based on magnitude (higher magnitude = darker colors)
        return magnitude >= 8 ? '#800026' : // Dark Red (Major 8+)
            magnitude >= 6 ? '#BD0026' : // Red (Strong 6-8)
                magnitude >= 5 ? '#E31A1C' : // Orange-Red (Moderate 5-6)
                    magnitude >= 4 ? '#FD8D3C' : // Orange (Light 4-5)
                        magnitude >= 2 ? '#FEB24C' : // Yellow-Orange (Minor 2-4)
                            '#FFEDA0';  // Light Yellow (Very Minor < 2)
    }

    /**
     * Creates and adds a map legend explaining the magnitude-based color coding.
     */
    function createLegend() {
        const grades = [0, 2, 4, 5, 6, 8]; // Magnitude ranges for legend breaks
        const legendContent = ['<h4>Magnitude</h4>']; // Legend title

        // Loop through magnitude intervals and generate a label with a colored square for each interval
        for (let i = 0; i < grades.length; i++) {
            const from = grades[i];
            const to = grades[i + 1];
            // Get color corresponding to the magnitude
            const color = getColor(from);

            // Add legend item HTML (colored square + range text)
            legendContent.push(
                `<i style="background:${color}"></i> ${from}${to ? '&ndash;' + to : '+'}`
            );
        }

        // Set the innerHTML of the legend container div
        legendElement.innerHTML = legendContent.join('<br>');
    }

}); // End DOMContentLoaded listener


