// Initialize the map with a default center (will be updated with the first API response)
let map;
try {
  map = L.map("map").setView([0, 0], 35);

  // Add Mapbox tiles
  L.tileLayer("https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWFydGF6YWhtYWQiLCJhIjoiY201emFmZXA3MDBxdDJ4cjB3czFlaXBiaCJ9.4yiETNVYRuKk8Pa6qITo3A", {
    attribution: '© Mapbox © OpenStreetMap contributors',
  }).addTo(map);
} catch (error) {
  console.error("Error initializing map:", error);
  // Add a visible error message to the page
  document.getElementById("map").innerHTML =
    '<div class="map-error">Error loading map</div>';
}

// Object to store bus marker (since we're tracking one bus)
let busMarker = null;
let isFirstUpdate = true; // Flag to check if it's the first update

// Custom bus icon with SVG
const busIcon = L.divIcon({
  className: "bus-icon",
  html: `<div class="bus-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#2980b9" width="32" height="32">
                <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
            </svg>
        </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Function to fetch bus location data from API
async function fetchBusLocation() {
  try {
    const response = await fetch(
      "http://16.171.19.250:5000/get-vertices",
      {
        // Ensure that CORS is handled properly on the backend for this request to succeed
        // You may need to update the backend to allow CORS
      }
    );

    if (!response.ok) {
      // Detailed error message from the server
      throw new Error("Fetching Error");
    }

    const data = await response.json();

    if (data && data.V1 && data.V2) {
      updateBusLocation(data);
    } else {
      throw new Error("Invalid data format received from API");
    }
  } catch (error) {
    console.error(error);
    updateSidebarInfo(null); // Update sidebar to show connection error
  }
}

// Function to start periodic updates
function startPeriodicUpdates() {
  console.log("Starting periodic updates...");
  // Fetch immediately when starting
  fetchBusLocation();

  // Then fetch every 3 seconds
  const intervalId = setInterval(fetchBusLocation, 5000);

  // Cleanup on page unload
  window.addEventListener("unload", () => {
    clearInterval(intervalId);
  });
}

// Function to update bus location with smooth animation
function updateBusLocation(locationData) {
  try {
    const latitude = parseFloat(locationData.V1);
    const longitude = parseFloat(locationData.V2);

    // Check if coordinates are valid numbers
    if (isNaN(latitude) || isNaN(longitude)) {
      throw new Error("Invalid coordinates received from API");
    }

    if (!busMarker) {
      busMarker = L.marker([latitude, longitude], {
        icon: busIcon,
      }).addTo(map);
    } else {
      const startPos = busMarker.getLatLng();
      const endPos = L.latLng(latitude, longitude);
      animateMarker(busMarker, startPos, endPos, 500);
    }

    if (isFirstUpdate) {
      map.setView([latitude, longitude], 35);
      isFirstUpdate = false;
    }

    updateSidebarInfo(locationData);
  } catch (error) {
    console.error("Error updating bus location:", error);
  }
}

// Function to animate marker movement
function animateMarker(marker, startPos, endPos, duration) {
  const frames = Math.min(Math.ceil(duration / 16), 100); // Max 100 frames
  let frame = 0;

  function animate() {
    frame++;
    const progress = frame / frames;

    const lat = startPos.lat + (endPos.lat - startPos.lat) * progress;
    const lng = startPos.lng + (endPos.lng - startPos.lng) * progress;

    marker.setLatLng([lat, lng]);

    if (frame < frames) {
      requestAnimationFrame(animate);
    }
  }

  animate();
}

// Function to update sidebar information
function updateSidebarInfo(locationData) {
  const dataContainer = document.getElementById("data-container");
  const existingCard = document.getElementById("bus-card");

  const cardContent = `
      <h3>Bus Location</h3>
      <p><span class="status-indicator ${
        locationData ? "status-active" : "status-inactive"
      }"></span> 
         ${locationData ? "Active" : "Connecting..."}</p>
      <p><strong>Last Updated:</strong> ${new Date().toLocaleTimeString()}</p>
      <p><strong>Location:</strong> ${
        locationData
          ? `${locationData.V1}, ${locationData.V2}`
          : "Waiting for data..."
      }</p>
  `;

  if (existingCard) {
    existingCard.innerHTML = cardContent;
  } else {
    const busCard = document.createElement("div");
    busCard.id = "bus-card";
    busCard.className = "location-card";
    busCard.innerHTML = cardContent;

    // Only add click event if we have valid location data
    if (locationData) {
      busCard.addEventListener("click", () => {
        try {
          const lat = parseFloat(locationData.V1);
          const lng = parseFloat(locationData.V2);
          if (!isNaN(lat) && !isNaN(lng)) {
            map.setView([lat, lng], 35);
            if (busMarker) {
              busMarker.openPopup();
            }
          }
        } catch (error) {
          console.error("Error centering map:", error);
        }
      });
    }

    dataContainer.appendChild(busCard);
  }
}

// Function to center the map on the current bus location
function centerMap() {
  if (busMarker) {
    const busLatLng = busMarker.getLatLng();
    map.setView(busLatLng, 35); // Center the map on bus's location
  }
}

// Add event listener to the center button
document.getElementById("center-map-btn").addEventListener("click", centerMap);

// Initialize when page loads
window.addEventListener("load", startPeriodicUpdates);

// Add some CSS styles for the bus icon
const style = document.createElement("style");
style.textContent = `
  .bus-pointer {
      font-size: 24px;
      transition: transform 0.5s;
  }

  .bus-icon {
      transition: transform 0.5s;
  }
`;
document.head.appendChild(style);
