document.addEventListener('DOMContentLoaded', () => {
    const mapElement = document.getElementById('map');
    const loadingElement = document.getElementById('loading');
    const legendElement = document.getElementById('legend');

    // --- Configuration ---
    // USGS GeoJSON Feed URL (Past Day, M1.0+)
    // You can change this URL to get different data sets (e.g., past hour, past 7 days, different magnitudes)
    // See: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
    const earthquakeDataURL = 'https://earthquake.usgs.gov/feed/v1.0/summary/1.0_day.geojson';

    const mapCenter = [20, 0]; // Initial map center [latitude, longitude]
    const mapZoom = 2;        // Initial map zoom level

    // --- Initialize Leaflet Map ---
    const map = L.map(mapElement).setView(mapCenter, mapZoom);

    // Add Tile Layer (using OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
    }).addTo(map);

    // --- Fetch and Process Earthquake Data ---
    fetch(earthquakeDataURL)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            loadingElement.style.display = 'none'; // Hide loading indicator
            console.log("Earthquake data fetched:", data); // Log data for debugging

            if (data && data.features) {
                addEarthquakeMarkers(data.features);
                createLegend(); // Create legend after data is loaded
            } else {
                mapElement.innerHTML = 'Failed to load earthquake data features.';
            }
        })
        .catch(error => {
            loadingElement.style.display = 'none'; // Hide loading indicator
            console.error("Error fetching or processing earthquake data:", error);
            mapElement.innerHTML = `Error loading earthquake data: ${error.message}. Please try refreshing the page.`;
        });

    // --- Helper Functions ---

    /**
     * Adds earthquake markers to the map.
     * @param {Array} features - Array of earthquake features from GeoJSON.
     */
    function addEarthquakeMarkers(features) {
        features.forEach(feature => {
            if (feature.geometry && feature.geometry.coordinates) {
                const coords = feature.geometry.coordinates;
                const props = feature.properties;
                const magnitude = props.mag;
                const depth = coords[2];

                // GeoJSON coordinates are [longitude, latitude, depth]
                // Leaflet needs [latitude, longitude]
                const latLng = [coords[1], coords[0]];

                // Create a circle marker
                const circleMarker = L.circleMarker(latLng, {
                    radius: calculateRadius(magnitude), // Size based on magnitude
                    fillColor: getColor(depth),      // Color based on depth
                    color: "#000",                     // Border color
                    weight: 0.5,                       // Border width
                    opacity: 1,
                    fillOpacity: 0.7
                }).addTo(map);

                // Create popup content
                const popupContent = `
                    <b>Magnitude: ${magnitude.toFixed(1)}</b><br>
                    Location: ${props.place || 'N/A'}<br>
                    Time: ${new Date(props.time).toLocaleString()}<br>
                    Depth: ${depth.toFixed(1)} km
                    ${props.url ? `<br><a href="${props.url}" target="_blank" rel="noopener noreferrer">More Info (USGS)</a>` : ''}
                `;

                // Bind popup to marker (appears on click)
                // circleMarker.bindPopup(popupContent);

                // Bind tooltip to marker (appears on hover)
                circleMarker.bindTooltip(popupContent, {
                    sticky: true // Tooltip follows the mouse
                });
            }
        });
    }

    /**
     * Calculates marker radius based on earthquake magnitude.
     * @param {number} magnitude - The magnitude of the earthquake.
     * @returns {number} - The radius for the circle marker.
     */
    function calculateRadius(magnitude) {
        if (magnitude < 0) return 2; // Min radius for negative magnitudes (can happen)
        // Exponential growth looks better than linear for magnitude representation
        return Math.max(magnitude * magnitude * 0.5, 3); // Ensure a minimum radius
    }

    /**
     * Determines marker color based on earthquake depth.
     * Deeper earthquakes get darker/different colors.
     * @param {number} depth - The depth of the earthquake in km.
     * @returns {string} - The hex color code.
     */
    function getColor(depth) {
        // Color scale based on depth
        return depth > 300 ? '#b30000' : // Dark Red (very deep)
            depth > 150 ? '#e34a33' : // Red
                depth > 70 ? '#fc8d59' : // Orange-Red
                    depth > 30 ? '#fdbb84' : // Orange
                        depth > 10 ? '#fee8c8' : // Light Orange/Yellow
                            '#fff7ec';  // Very Light Yellow (shallow)
    }


    /**
     * Creates and adds a legend to the map.
     */
    function createLegend() {
        const grades = [-10, 10, 30, 70, 150, 300]; // Depth ranges
        const legendContent = ['<h4>Depth (km)</h4>']; // Start with title

        // loop through our depth intervals and generate a label with a colored square for each interval
        for (let i = 0; i < grades.length; i++) {
            const from = grades[i];
            const to = grades[i + 1];
            const color = getColor(from + 1); // Get color for the start of the range

            legendContent.push(
                `<i style="background:${color}"></i> ${from}${to ? '&ndash;' + to : '+'}`
            );
        }

        legendElement.innerHTML = legendContent.join('<br>');
    }

}); // End DOMContentLoaded listener