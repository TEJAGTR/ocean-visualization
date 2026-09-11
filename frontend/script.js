// ============================================================
// OCEAN DISASTER MANAGEMENT DASHBOARD
// ============================================================

const API_URL = "http://127.0.0.1:8000";

let oceanData = [];
let filteredData = [];
let selectedDepth = 1.5413750410079956;
let selectedVariable = "temperature";
let selectedModelTime = null;
let modelTimeIndex = 0;
let modelTimeValues = [];
let modelAnimationTimer = null;
// ============================================================
// LIVE USER LOCATION
// ============================================================

let userLatitude = null;
let userLongitude = null;
let userLocationWatchId = null;
let userLocationMarker = null;
let lastOceanSearchLatitude = null;
let lastOceanSearchLongitude = null;


let map = null;
let markersLayer = null;
let selectedMapMarker = null;

let globe = null;
let globeInitialized = false;

let selectedOceanLocation = null;

let temperatureChart = null;
let salinityChart = null;
let depthChart = null;


// ============================================================
// PAGE INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("🌊 Ocean Dashboard starting...");

    // Restore an alert selected from alerts.html BEFORE
    // the dashboard finishes initializing.
    restoreSelectedOceanAlert();

    initializeTheme();
    initializeMap();
    initializeVariableControl();
    updateColorbar();
    initializeTimeControl();
    initializeLiveLocationControl();
    loadModelTimes();
    initializeGlobe();


    const loadButton =
        document.getElementById("loadButton");

    if (loadButton) {
        loadButton.addEventListener(
            "click",
            loadOceanData
        );
    }

    const downloadButton =
        document.getElementById("downloadButton");

    if (downloadButton) {
        downloadButton.addEventListener(
            "click",
            downloadCSV
        );
    }

    const resetButton =
        document.getElementById("resetButton");

    if (resetButton) {
        resetButton.addEventListener(
            "click",
            resetFilters
        );
    }

    [
        "searchInput",
        "minTemperature",
        "maxTemperature",
        "minSalinity",
        "maxSalinity"
    ].forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {
            element.addEventListener(
                "input",
                applyFilters
            );
        }

    });

    window.addEventListener(
        "resize",
        () => {

            resizeGlobe();

            if (map) {
                setTimeout(
                    () => map.invalidateSize(),
                    300
                );
            }

        }
    );

    initializeDepthControl();

    loadOceanData();

    loadArgoData();

});


// ============================================================
// LOADING / ERROR
// ============================================================

function showLoading() {

    const element =
        document.getElementById(
            "loadingContainer"
        );

    if (element) {
        element.classList.remove("hidden");
    }

}


function hideLoading() {

    const element =
        document.getElementById(
            "loadingContainer"
        );

    if (element) {
        element.classList.add("hidden");
    }

}


function showError(message) {

    const container =
        document.getElementById(
            "errorContainer"
        );

    const messageElement =
        document.getElementById(
            "errorMessage"
        );

    if (container && messageElement) {

        messageElement.textContent =
            message;

        container.classList.remove(
            "hidden"
        );

    }

}


function hideError() {

    const container =
        document.getElementById(
            "errorContainer"
        );

    if (container) {
        container.classList.add("hidden");
    }

}
// ============================================================
// VARIABLE COLOR FUNCTION
// ============================================================

function getVariableColor(item) {

    // --------------------------------------------------------
    // TEMPERATURE
    // --------------------------------------------------------

    if (selectedVariable === "temperature") {

        const temperature =
            Number(
                item.temperature
            );

        return getTemperatureColor(
            temperature
        );
    }


    // --------------------------------------------------------
    // SALINITY
    // --------------------------------------------------------

    if (selectedVariable === "salinity") {

        const salinity =
            Number(
                item.salinity ??
                item.so
            );


        if (!Number.isFinite(salinity)) {
            return "#808080";
        }


        if (salinity < 33) {
            return "#2166ac";
        }


        if (salinity < 35) {
            return "#67a9cf";
        }


        if (salinity < 36) {
            return "#f7f7f7";
        }


        if (salinity < 37) {
            return "#ef8a62";
        }


        return "#b2182b";
    }


    // --------------------------------------------------------
    // CURRENT SPEED
    // --------------------------------------------------------

    if (selectedVariable === "current") {

        const u =
            Number(
                item.uo ??
                item.u ??
                0
            );


        const v =
            Number(
                item.vo ??
                item.v ??
                0
            );


        const speed =
            Math.sqrt(
                (u * u) +
                (v * v)
            );


        if (!Number.isFinite(speed)) {
            return "#808080";
        }


        if (speed < 0.10) {
            return "#2166ac";
        }


        if (speed < 0.25) {
            return "#67a9cf";
        }


        if (speed < 0.50) {
            return "#ffffbf";
        }


        if (speed < 1.00) {
            return "#fdae61";
        }


        return "#d73027";
    }


    return "#808080";
}


// ============================================================
// TEMPERATURE COLORS
// ============================================================

function getTemperatureColor(temperature) {

    if (selectedVariable === "temperature") {

        const value = Number(temperature);

        if (!Number.isFinite(value)) {
            return "#808080";
        }

        if (value < 10) {
            return "#2196f3";
        }

        if (value < 20) {
            return "#7ac943";
        }

        return "#ff7a00";
    }

    return "#808080";
}


function getMarkerColor(
    temperature
) {

    if (temperature < 10) {
        return "blue";
    }

    if (temperature < 20) {
        return "green";
    }

    return "orange";

}


// ============================================================
// MAP ICONS
// ============================================================

function createMarkerIcon(
    temperature
) {

    const color =
        getMarkerColor(
            temperature
        );

    return L.icon({

        iconUrl:
            `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,

        shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",

        iconSize:
            [25, 41],

        iconAnchor:
            [12, 41],

        popupAnchor:
            [1, -34],

        shadowSize:
            [41, 41]

    });

}


function createSelectedMapIcon() {

    return L.divIcon({

        className:
            "selected-ocean-marker",

        html: `
            <div class="selected-alert-marker">
                <div class="selected-alert-core"></div>
            </div>
        `,

        iconSize:
            [70, 70],

        iconAnchor:
            [35, 35]

    });

}


// ============================================================
// MAP
// ============================================================

function initializeMap() {

    if (map) {
        return;
    }

    const container =
        document.getElementById("map");

    if (!container) {
        return;
    }

    if (
        typeof L === "undefined"
    ) {

        console.error(
            "❌ Leaflet not loaded."
        );

        return;
    }

    map =
        L.map("map")
            .setView(
                [20, 0],
                2
            );


    L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
            maxZoom: 18,
            attribution:
                "Tiles © Esri"
        }
    ).addTo(map);


    markersLayer =
        L.layerGroup().addTo(map);


    console.log(
        "✅ Satellite map initialized."
    );

}
// ============================================================
// SHOW LIVE USER LOCATION ON MAP
// ============================================================

function updateUserLocationOnMap() {

    if (!map || userLatitude === null || userLongitude === null) {
        return;
    }

    const userLatLng = [
        userLatitude,
        userLongitude
    ];

    // Create marker the first time
    if (!userLocationMarker) {

        userLocationMarker = L.circleMarker(
            userLatLng,
            {
                radius: 9,
                color: "#ffffff",
                weight: 3,
                fillColor: "#2196f3",
                fillOpacity: 1
            }
        ).addTo(map);

        userLocationMarker.bindPopup(
            `
            <strong>📍 Your Live Location</strong><br>
            Latitude: ${userLatitude.toFixed(5)}°<br>
            Longitude: ${userLongitude.toFixed(5)}°
            `
        );

    } else {

        // Update existing marker
        userLocationMarker.setLatLng(userLatLng);

        userLocationMarker.setPopupContent(
            `
            <strong>📍 Your Live Location</strong><br>
            Latitude: ${userLatitude.toFixed(5)}°<br>
            Longitude: ${userLongitude.toFixed(5)}°
            `
        );
    }

    // Move map to user's location
    map.setView(
        userLatLng,
        8,
        {
            animate: true
        }
    );

    console.log(
        "📍 User location shown on 2D map:",
        userLatitude,
        userLongitude
    );
}
// ============================================================
// GET USER LIVE LOCATION
// ============================================================

function startLiveLocation() {

    if (!navigator.geolocation) {
        alert("Geolocation is not supported by this browser.");
        return;
    }

    console.log("📍 Requesting live user location...");

    // Stop an existing location watcher
    if (userLocationWatchId !== null) {
        navigator.geolocation.clearWatch(userLocationWatchId);
    }

    userLocationWatchId = navigator.geolocation.watchPosition(
        position => {

            userLatitude = position.coords.latitude;
            userLongitude = position.coords.longitude;

            console.log(
                "📍 Live location:",
                userLatitude,
                userLongitude
            );

            updateUserLocationOnMap();
updateUserLocationOnGlobe();

if (
    lastOceanSearchLatitude === null ||
    lastOceanSearchLongitude === null ||
    Math.abs(userLatitude - lastOceanSearchLatitude) > 0.01 ||
    Math.abs(userLongitude - lastOceanSearchLongitude) > 0.01
) {
    lastOceanSearchLatitude = userLatitude;
    lastOceanSearchLongitude = userLongitude;

    findNearestOceanData();
}

        },

        error => {

            console.error(
                "❌ Live location error:",
                error
            );

            if (error.code === 1) {
                alert(
                    "Location permission was denied. " +
                    "Please allow location access in your browser."
                );
            } else if (error.code === 2) {
                alert("Your location could not be determined.");
            } else if (error.code === 3) {
                alert("Location request timed out.");
            }

        },

        {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 10000
        }
    );
}


function createMapPopup(
    item,
    selected = false
) {

    return `

        <div class="ocean-map-popup">

            <div class="popup-title">
                ${
                    selected
                    ? "🚨 Selected Alert"
                    : "🌊 Ocean Data"
                }
            </div>

            <hr>

            📍 <b>Latitude:</b>
            ${Number(item.latitude).toFixed(4)}°

            <br>

            📍 <b>Longitude:</b>
            ${Number(item.longitude).toFixed(4)}°

            <br>

            🌡️ <b>Temperature:</b>
            ${
                Number.isFinite(
                    Number(item.temperature)
                )
                ? Number(item.temperature).toFixed(2) + " °C"
                : "N/A"
            }

            <br>

            🌊 <b>Depth:</b>
            ${
                Number.isFinite(
                    Number(item.depth)
                )
                ? Number(item.depth).toFixed(2) + " m"
                : "N/A"
            }

            <br>

            🧂 <b>Salinity:</b>
            ${
                Number.isFinite(
                    Number(item.salinity)
                )
                ? Number(item.salinity).toFixed(2)
                : "N/A"
            }

            <br>

            🌊 <b>UO:</b>
            ${
                Number.isFinite(
                    Number(item.uo)
                )
                ? Number(item.uo).toFixed(3)
                : "N/A"
            }

            ${
                Number.isFinite(
                    Number(item.uo)
                )
                ? " m/s"
                : ""
            }

            <br>

            🌊 <b>VO:</b>
            ${
                Number.isFinite(
                    Number(item.vo)
                )
                ? Number(item.vo).toFixed(3)
                : "N/A"
            }

            ${
                Number.isFinite(
                    Number(item.vo)
                )
                ? " m/s"
                : ""
            }

            ${
                selected
                ?
                `
                    <br><br>

                    <strong>
                        🚨 Alert location selected
                    </strong>
                `
                :
                ""
            }

        </div>

    `;

}


function updateMap(data) {

    initializeMap();

    if (
        !map ||
        !markersLayer
    ) {
        return;
    }

    markersLayer.clearLayers();

    if (selectedMapMarker) {

        try {

            map.removeLayer(
                selectedMapMarker
            );

        }
        catch (error) {

            console.warn(
                "⚠️ Could not remove selected marker:",
                error
            );

        }

        selectedMapMarker = null;

    }


    const bounds = [];


    data.forEach(item => {

        const lat =
            Number(item.latitude);

        const lng =
            Number(item.longitude);

        const temp =
            Number(item.temperature);


        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lng)
        ) {
            return;
        }


        const marker =
            L.marker(
                [lat, lng],
                {
                    icon:
                        createMarkerIcon(
                            temp
                        )
                }
            );


        marker.bindPopup(
            createMapPopup(item)
        );


        markersLayer.addLayer(
            marker
        );


        bounds.push([
            lat,
            lng
        ]);

    });


    if (bounds.length > 1) {

        map.fitBounds(
            bounds,
            {
                padding:
                    [40, 40],
                maxZoom:
                    4
            }
        );

    }
    else if (bounds.length === 1) {

        map.setView(
            bounds[0],
            5
        );

    }


    // IMPORTANT:
    // Alert location takes priority over normal
    // model-data bounds.
    if (
        window.location.hash === "#map" &&
        selectedOceanLocation
    ) {

        setTimeout(
            focusSelectedMapLocation,
            200
        );

    }

}


// ============================================================
// RESTORE SELECTED OCEAN ALERT
// ============================================================

function restoreSelectedOceanAlert() {

    const savedAlert =
        localStorage.getItem(
            "selectedOceanAlert"
        );


    if (!savedAlert) {
        return;
    }


    try {

        const alertData =
            JSON.parse(
                savedAlert
            );


        const latitude =
            Number(
                alertData.latitude
            );


        const longitude =
            Number(
                alertData.longitude
            );


        if (
            !Number.isFinite(
                latitude
            ) ||
            !Number.isFinite(
                longitude
            )
        ) {

            console.error(
                "❌ Invalid saved alert coordinates:",
                alertData
            );


            localStorage.removeItem(
                "selectedOceanAlert"
            );


            return;

        }


        selectedOceanLocation = {

            latitude:
                latitude,

            longitude:
                longitude,

            temperature:
                alertData.temperature !==
                    undefined &&
                alertData.temperature !==
                    null
                ?
                Number(
                    alertData.temperature
                )
                :
                null,

            salinity:
                alertData.salinity !==
                    undefined &&
                alertData.salinity !==
                    null
                ?
                Number(
                    alertData.salinity
                )
                :
                null,

            depth:
                alertData.depth !==
                    undefined &&
                alertData.depth !==
                    null
                ?
                Number(
                    alertData.depth
                )
                :
                null,

            score:
                alertData.score !==
                    undefined &&
                alertData.score !==
                    null
                ?
                Number(
                    alertData.score
                )
                :
                null,

            severity:
                alertData.severity ||
                null,

            isOceanAlert:
                true

        };


        console.log(
            "📍 Restored selected ocean alert:",
            selectedOceanLocation
        );

    }
    catch (error) {

        console.error(
            "❌ Failed to restore selected ocean alert:",
            error
        );

    }


    // Remove the saved copy.
    // The active selectedOceanLocation remains available
    // for the current page.
    localStorage.removeItem(
        "selectedOceanAlert"
    );

}


// ============================================================
// GET SELECTED OCEAN LOCATION
// ============================================================

function getSelectedOceanLocation() {

    if (
        !selectedOceanLocation
    ) {
        return null;
    }


    return {

        latitude:
            Number(
                selectedOceanLocation.latitude
            ),

        longitude:
            Number(
                selectedOceanLocation.longitude
            ),

        temperature:
            selectedOceanLocation.temperature !==
                undefined
            ?
            Number(
                selectedOceanLocation.temperature
            )
            :
            null,

        salinity:
            selectedOceanLocation.salinity !==
                undefined
            ?
            Number(
                selectedOceanLocation.salinity
            )
            :
            null,

        depth:
            selectedOceanLocation.depth !==
                undefined
            ?
            Number(
                selectedOceanLocation.depth
            )
            :
            null,

        score:
            selectedOceanLocation.score !==
                undefined
            ?
            Number(
                selectedOceanLocation.score
            )
            :
            null,

        severity:
            selectedOceanLocation.severity ||
            null

    };

}


// ============================================================
// FOCUS SELECTED MAP LOCATION
// ============================================================

function focusSelectedMapLocation() {

    const selected =
        getSelectedOceanLocation();


    if (
        !selected ||
        !map
    ) {
        return;
    }


    const lat =
        Number(
            selected.latitude
        );


    const lng =
        Number(
            selected.longitude
        );


    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {

        console.error(
            "❌ Invalid selected map coordinates:",
            selected
        );

        return;

    }


    // Move directly to the alert coordinate.
    // This works even when the coordinate isn't
    // one of the currently loaded model points.
    map.setView(
        [lat, lng],
        7,
        {
            animate:
                true
        }
    );


    if (selectedMapMarker) {

        try {

            map.removeLayer(
                selectedMapMarker
            );

        }
        catch (error) {}

        selectedMapMarker =
            null;

    }


    selectedMapMarker =
        L.marker(
            [lat, lng],
            {
                icon:
                    createSelectedMapIcon(),

                zIndexOffset:
                    10000
            }
        )
        .addTo(map);


    selectedMapMarker.bindPopup(
        createMapPopup(
            selected,
            true
        )
    );


    selectedMapMarker.openPopup();


    setTimeout(
        () => {

            if (map) {
                map.invalidateSize();
            }

        },
        300
    );


    console.log(
        "🎯 Map focused on alert:",
        {
            latitude:
                lat,

            longitude:
                lng
        }
    );

}

// ============================================================
// VARIABLE CONTROL
// ============================================================

function initializeVariableControl() {

    // Prevent duplicate controls
    if (
        document.getElementById(
            "oceanVariableControl"
        )
    ) {
        return;
    }


    const globeSection =
        document.getElementById(
            "globeContainer"
        );


    if (!globeSection) {
        return;
    }


    const control =
        document.createElement("div");

    control.id =
        "oceanVariableControl";


    control.innerHTML = `

        <div class="variable-control-title">
            🎨 Visualization Variable
        </div>

        <select
            id="variableSelector"
            class="variable-selector"
        >

            <option value="temperature">
                🌡️ Temperature
            </option>

            <option value="salinity">
                🧂 Salinity
            </option>

            <option value="current">
                🌊 Current Speed
            </option>

        </select>

        <div
            id="variableDescription"
            class="variable-description"
        >
            Temperature (°C)
        </div>

    `;


    // Put the control above the globe
    globeSection.parentElement.insertBefore(
        control,
        globeSection
    );


    const selector =
        document.getElementById(
            "variableSelector"
        );


    if (selector) {

        selector.addEventListener(
            "change",
            event => {

                selectedVariable =
                    event.target.value;


                console.log(
                    "🎨 Visualization variable:",
                    selectedVariable
                );


                updateVariableDescription();
                updateColorbar();


                // Redraw current data
                if (
                    filteredData &&
                    filteredData.length > 0
                ) {

                    updateGlobe(
                        filteredData
                    );

                    updateMap(
                        filteredData
                    );

                }

            }
        );

    }

}

// ============================================================
// LIVE LOCATION BUTTON
// ============================================================

function initializeLiveLocationControl() {

    if (document.getElementById("liveLocationButton")) {
        return;
    }

    const button = document.createElement("button");

    button.id = "liveLocationButton";

    button.innerHTML = "📍 Use My Live Location";

    button.style.position = "absolute";
    button.style.top = "20px";
    button.style.left = "20px";
    button.style.zIndex = "1000";
    button.style.padding = "10px 16px";
    button.style.borderRadius = "8px";
    button.style.border = "none";
    button.style.cursor = "pointer";
    button.style.fontWeight = "600";

    button.addEventListener("click", () => {

        console.log("📍 Live location button clicked.");

        startLiveLocation();

    });

    document.body.appendChild(button);
}
// ============================================================
// MODEL TIME CONTROL
// ============================================================

function initializeTimeControl() {

    if (
        document.getElementById(
            "oceanTimeControl"
        )
    ) {
        return;
    }


    const globeSection =
        document.getElementById(
            "globeContainer"
        );


    if (!globeSection) {
        return;
    }


    const control =
        document.createElement("div");

    control.id =
        "oceanTimeControl";


    control.innerHTML = `

        <div class="time-control-title">
            ⏱️ Model Time
        </div>

        <div class="time-control-row">

            <button
                id="previousTimeButton"
                class="time-button"
                type="button"
            >
                ◀
            </button>

            <input
                id="modelTimeSlider"
                type="range"
                min="0"
                max="0"
                value="0"
                step="1"
            >

            <button
                id="nextTimeButton"
                class="time-button"
                type="button"
            >
                ▶
            </button>

        </div>

        <div
            id="modelTimeLabel"
            class="model-time-label"
        >
            Loading model time...
        </div>

        <button
            id="playTimeButton"
            class="play-time-button"
            type="button"
        >
            ▶ Play
        </button>

    `;


    globeSection.parentElement.insertBefore(
        control,
        globeSection
    );


    const slider =
        document.getElementById(
            "modelTimeSlider"
        );


    const previousButton =
        document.getElementById(
            "previousTimeButton"
        );


    const nextButton =
        document.getElementById(
            "nextTimeButton"
        );


    const playButton =
        document.getElementById(
            "playTimeButton"
        );


    if (slider) {

        slider.addEventListener(
            "input",
            event => {

                modelTimeIndex =
                    Number(
                        event.target.value
                    );

                applySelectedModelTime();

            }
        );

    }


    if (previousButton) {

        previousButton.addEventListener(
            "click",
            () => {

                if (
                    modelTimeValues.length === 0
                ) {
                    return;
                }


                modelTimeIndex =
                    Math.max(
                        0,
                        modelTimeIndex - 1
                    );


                updateTimeSlider();


                applySelectedModelTime();

            }
        );

    }


    if (nextButton) {

        nextButton.addEventListener(
            "click",
            () => {

                if (
                    modelTimeValues.length === 0
                ) {
                    return;
                }


                modelTimeIndex =
                    Math.min(
                        modelTimeValues.length - 1,
                        modelTimeIndex + 1
                    );


                updateTimeSlider();


                applySelectedModelTime();

            }
        );

    }


    if (playButton) {

        playButton.addEventListener(
            "click",
            toggleModelAnimation
        );

    }

}
// ============================================================
// LOAD MODEL TIMES
// ============================================================

async function loadModelTimes() {

    try {

        console.log(
            "⏱️ Loading model times..."
        );


        const response =
            await fetch(
                `${API_URL}/api/model/times`
            );


        if (!response.ok) {

            throw new Error(
                `Model time request failed: ${response.status}`
            );

        }


        const data =
            await response.json();


        console.log(
            "📅 Model time response:",
            data
        );


        if (
            data.status !== "success" ||
            !Array.isArray(data.times)
        ) {

            throw new Error(
                "Invalid model time response"
            );

        }


        modelTimeValues =
            data.times;


        console.log(
            "📅 Available model dates:",
            modelTimeValues
        );


        if (
            modelTimeValues.length > 0
        ) {

            modelTimeIndex = 0;

            selectedModelTime =
                modelTimeValues[0];

            updateTimeSlider();

        }
        else {

            const label =
                document.getElementById(
                    "modelTimeLabel"
                );

            if (label) {

                label.textContent =
                    "No model time available";

            }

        }

    }
    catch (error) {

        console.error(
            "❌ Failed to load model times:",
            error
        );


        const label =
            document.getElementById(
                "modelTimeLabel"
            );

        if (label) {

            label.textContent =
                "Unable to load model time";

        }

    }

}


// ============================================================
// UPDATE TIME SLIDER
// ============================================================

function updateTimeSlider() {

    const slider =
        document.getElementById(
            "modelTimeSlider"
        );


    const label =
        document.getElementById(
            "modelTimeLabel"
        );


    if (!slider) {
        return;
    }


    if (
        modelTimeValues.length === 0
    ) {

        slider.min = 0;
        slider.max = 0;
        slider.value = 0;

        if (label) {
            label.textContent =
                "No model time available";
        }

        return;
    }


    slider.min = 0;

    slider.max =
        modelTimeValues.length - 1;

    slider.value =
        modelTimeIndex;


    const currentTime =
        modelTimeValues[
            modelTimeIndex
        ];


    if (label) {

        label.textContent =
            formatModelTime(
                currentTime
            );

    }

}


// ============================================================
// FORMAT MODEL TIME
// ============================================================

function formatModelTime(value) {

    if (!value) {
        return "Unknown time";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(value);

    }


    return date.toLocaleString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


// ============================================================
// APPLY SELECTED MODEL TIME
// ============================================================

function applySelectedModelTime() {

    if (
        modelTimeValues.length === 0
    ) {
        return;
    }


    selectedModelTime =
        modelTimeValues[
            modelTimeIndex
        ];


    updateTimeSlider();


    console.log(
        "⏱️ Selected model time:",
        selectedModelTime
    );


    // Refresh the currently displayed data.
    if (
        typeof loadOceanData ===
        "function"
    ) {

        loadOceanData();

    }

}


// ============================================================
// PLAY / PAUSE MODEL ANIMATION
// ============================================================

function toggleModelAnimation() {

    const button =
        document.getElementById(
            "playTimeButton"
        );


    if (modelAnimationTimer) {

        clearInterval(
            modelAnimationTimer
        );

        modelAnimationTimer = null;


        if (button) {
            button.textContent =
                "▶ Play";
        }


        return;
    }


    if (
        modelTimeValues.length === 0
    ) {

        return;
    }


    modelAnimationTimer =
        setInterval(
            () => {

                modelTimeIndex++;


                if (
                    modelTimeIndex >=
                    modelTimeValues.length
                ) {

                    modelTimeIndex = 0;

                }


                updateTimeSlider();


                applySelectedModelTime();

            },
            1500
        );


    if (button) {
        button.textContent =
            "⏸ Pause";
    }

}


// ------------------------------------------------------------
// Update variable description
// ------------------------------------------------------------

function updateVariableDescription() {

    const description =
        document.getElementById(
            "variableDescription"
        );


    if (!description) {
        return;
    }


    if (
        selectedVariable ===
        "temperature"
    ) {

        description.textContent =
            "Temperature (°C)";

    }


    else if (
        selectedVariable ===
        "salinity"
    ) {

        description.textContent =
            "Salinity (PSU)";

    }


    else if (
        selectedVariable ===
        "current"
    ) {

        description.textContent =
            "Current Speed (m/s)";

    }

}
// ============================================================
// COLORBAR
// ============================================================

function updateColorbar() {

    let colorbar =
        document.getElementById(
            "oceanColorbar"
        );


    // Create colorbar if it does not exist
    if (!colorbar) {

        colorbar =
            document.createElement("div");

        colorbar.id =
            "oceanColorbar";

        document.body.appendChild(
            colorbar
        );
    }


    let title = "";
    let min = "";
    let max = "";
    let unit = "";
    let gradient = "";


    // --------------------------------------------------------
    // TEMPERATURE
    // --------------------------------------------------------

    if (
        selectedVariable ===
        "temperature"
    ) {

        title =
            "Temperature";

        min = "0";
        max = "35";

        unit = "°C";

        gradient =
            "linear-gradient(to right, " +
            "#000082, " +
            "#0078ff, " +
            "#00c8b4, " +
            "#ffdc00, " +
            "#dc0000" +
            ")";
    }


    // --------------------------------------------------------
    // SALINITY
    // --------------------------------------------------------

    else if (
        selectedVariable ===
        "salinity"
    ) {

        title =
            "Salinity";

        min = "30";
        max = "38";

        unit = "PSU";

        gradient =
            "linear-gradient(to right, " +
            "#1e3ca0, " +
            "#288cd8, " +
            "#00bea0, " +
            "#e6d232, " +
            "#b42828" +
            ")";
    }


    // --------------------------------------------------------
    // CURRENT SPEED
    // --------------------------------------------------------

    else if (
        selectedVariable ===
        "current"
    ) {

        title =
            "Current Speed";

        min = "0";
        max = "2";

        unit = "m/s";

        gradient =
            "linear-gradient(to right, " +
            "#142878, " +
            "#2882dc, " +
            "#28c8b4, " +
            "#f0c828, " +
            "#dc281e" +
            ")";
    }


    colorbar.innerHTML = `

        <div class="colorbar-title">
            ${title} (${unit})
        </div>

        <div
            class="colorbar-gradient"
            style="
                background:
                ${gradient};
            "
        ></div>

        <div class="colorbar-labels">

            <span>
                ${min} ${unit}
            </span>

            <span>
                ${max} ${unit}
            </span>

        </div>

    `;
}

// ============================================================
// 3D GLOBE
// ============================================================

function initializeGlobe() {

    if (globeInitialized) {
        return;
    }

    const container =
        document.getElementById(
            "globeContainer"
        );

    if (!container) {
        return;
    }


    if (
        typeof Globe ===
        "undefined"
    ) {

        console.error(
            "❌ Globe.gl not loaded."
        );

        return;
    }


    globe =
        Globe()(container)

            .backgroundColor(
                "rgba(0,0,0,0)"
            )

            .showAtmosphere(
                true
            )

            .atmosphereColor(
                "#4fc3f7"
            )

            .atmosphereAltitude(
                0.18
            )

            .globeImageUrl(
                "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            )

            .bumpImageUrl(
                "https://unpkg.com/three-globe/example/img/earth-topology.png"
            )

            .pointLat(
                "latitude"
            )

            .pointLng(
                "longitude"
            )

            .pointColor(
    item =>
        getVariableColor(item)
)

            .pointRadius(
                () =>
                    0.08
            )

            .pointAltitude(
                () =>
                    0.015
            )

            .pointLabel(
                item => {

                    return `

                        <div style="
                            background:rgba(0,0,0,0.88);
                            padding:10px;
                            border-radius:8px;
                            color:white;
                            font-family:Arial;
                            font-size:13px;
                        ">

                            <b>🌊 Ocean Data</b>

                            <br><br>

                            📍 <b>Latitude:</b>
                            ${Number(
                                item.latitude
                            ).toFixed(4)}°

                            <br>

                            📍 <b>Longitude:</b>
                            ${Number(
                                item.longitude
                            ).toFixed(4)}°

                            <br>

                            🌡️ <b>Temperature:</b>
                            ${Number(
                                item.temperature
                            ).toFixed(2)} °C

                            <br>

                            🌊 <b>Depth:</b>
                            ${Number(
                                item.depth
                            ).toFixed(2)} m

                            <br>

                            🧂 <b>Salinity:</b>
                            ${
                                Number.isFinite(
                                    Number(
                                        item.salinity
                                    )
                                )
                                ?
                                Number(
                                    item.salinity
                                ).toFixed(2)
                                :
                                "N/A"
                            }

                            <br>

                            🌊 <b>Eastward Current:</b>
                            ${
                                Number.isFinite(
                                    Number(
                                        item.uo
                                    )
                                )
                                ?
                                Number(
                                    item.uo
                                ).toFixed(3) +
                                " m/s"
                                :
                                "N/A"
                            }

                            <br>

                            🌊 <b>Northward Current:</b>
                            ${
                                Number.isFinite(
                                    Number(
                                        item.vo
                                    )
                                )
                                ?
                                Number(
                                    item.vo
                                ).toFixed(3) +
                                " m/s"
                                :
                                "N/A"
                            }

                        </div>

                    `;

                }
            )

            .onPointClick(
                item => {

                    selectedOceanLocation =
                        item;


                    console.log(
                        "📍 Ocean point selected:",
                        item
                    );

                }
            );


    globeInitialized =
        true;


    console.log(
        "✅ 3D Globe initialized."
    );


    resizeGlobe();

}
// ============================================================
// SHOW LIVE USER LOCATION ON 3D GLOBE
// ============================================================

function updateUserLocationOnGlobe() {

    if (
        !globe ||
        userLatitude === null ||
        userLongitude === null
    ) {
        return;
    }

    // Move the 3D globe camera to the user's location
    if (!window.userGlobeFocused) {

    globe.pointOfView(
        {
            lat: userLatitude,
            lng: userLongitude,
            altitude: 1.8
        },
        1000
    );

    window.userGlobeFocused = true;
}

    // Add a highlighted location point
    globe
        .ringsData([
            {
                lat: userLatitude,
                lng: userLongitude
            }
        ])
        .ringLat(d => d.lat)
        .ringLng(d => d.lng)
        .ringColor(() => "#00ffff")
        .ringMaxRadius(5)
        .ringPropagationSpeed(2)
        .ringRepeatPeriod(1000);

    console.log(
        "🌐 User location shown on 3D globe:",
        userLatitude,
        userLongitude
    );
}

// ============================================================
// FIND NEAREST OCEAN MODEL DATA TO USER
// ============================================================

function findNearestOceanData() {

    if (
        userLatitude === null ||
        userLongitude === null
    ) {
        console.log("⚠️ User location not available.");
        return null;
    }

    if (
        !window.oceanData ||
        window.oceanData.length === 0
    ) {
        console.log("⚠️ Ocean model data not loaded.");
        return null;
    }

    let nearestPoint = null;
    let smallestDistance = Infinity;

    window.oceanData.forEach(point => {

        const latDifference =
            point.latitude - userLatitude;

        const lonDifference =
            point.longitude - userLongitude;

        const distance =
            Math.sqrt(
                latDifference * latDifference +
                lonDifference * lonDifference
            );

        if (distance < smallestDistance) {

            smallestDistance = distance;
            nearestPoint = point;

        }
    });

    if (!nearestPoint) {
        console.log("⚠️ No nearby ocean data found.");
        return null;
    }

    console.log(
        "🌊 Nearest ocean model point:",
        nearestPoint
    );

    console.log(
        "📏 Approximate distance:",
        smallestDistance,
        "degrees"
    );
    showNearbyOceanData(
    nearestPoint,
    smallestDistance
);

    return {
        point: nearestPoint,
        distanceDegrees: smallestDistance
    };
}
// ============================================================
// SHOW NEARBY OCEAN DATA
// ============================================================

function showNearbyOceanData(point, distanceDegrees) {

    let card = document.getElementById("nearbyOceanDataCard");

    if (!card) {

        card = document.createElement("div");

        card.id = "nearbyOceanDataCard";

        card.style.position = "fixed";
        card.style.right = "20px";
        card.style.top = "80px";
        card.style.bottom = "auto";
        card.style.zIndex = "2000";
        card.style.width = "280x";
        card.style.padding = "14px";
        card.style.borderRadius = "12px";
        card.style.background = "rgba(10, 20, 35, 0.95)";
        card.style.color = "white";
        card.style.boxShadow = "0 8px 25px rgba(0,0,0,0.35)";
        card.style.fontFamily = "Arial, sans-serif";

        document.body.appendChild(card);
    }

    card.innerHTML = `
        <div style="font-size:18px;font-weight:bold;margin-bottom:12px;">
            📍 Ocean Data Near You
        </div>

        <div style="margin-bottom:10px;">
            <strong>Your location</strong><br>
            ${userLatitude.toFixed(4)}°,
            ${userLongitude.toFixed(4)}°
        </div>

        <div style="margin-bottom:10px;">
            <strong>Nearest model point</strong><br>
            ${Number(point.latitude).toFixed(4)}°,
            ${Number(point.longitude).toFixed(4)}°
        </div>

        <div>🌡 Temperature:
            <strong>
                ${Number(point.temperature).toFixed(2)} °C
            </strong>
        </div>

        <div>🧂 Salinity:
            <strong>
                ${Number(point.salinity).toFixed(2)}
            </strong>
        </div>

        <div>📏 Depth:
            <strong>
                ${Number(point.depth).toFixed(2)} m
            </strong>
        </div>

        <div style="margin-top:8px;">
            📐 Distance:
            <strong>
                ${distanceDegrees.toFixed(2)}°
            </strong>
        </div>
    `;
}


// ============================================================
// RESIZE GLOBE
// ============================================================

function resizeGlobe() {

    if (!globe) {
        return;
    }


    const container =
        document.getElementById(
            "globeContainer"
        );


    if (!container) {
        return;
    }


    const width =
        container.clientWidth;

    const height =
        container.clientHeight;


    if (
        width <= 0 ||
        height <= 0
    ) {
        return;
    }


    globe
        .width(width)
        .height(height);

}


// ============================================================
// UPDATE GLOBE
// ============================================================

function updateGlobe(data) {

    if (!globeInitialized) {
        initializeGlobe();
    }


    if (!globe) {
        return;
    }


    // Keep all data available for analysis/live-location,
// but render a lighter subset on the 3D globe.
const globeDisplayData = data.filter(
    (point, index) => index % 2 === 0
);

globe.pointsData(
    globeDisplayData
);


    updateCurrentVectors(
        data
    );


    resizeGlobe();


    // Focus the alert after the globe data has rendered.
    if (
        window.location.hash ===
            "#globeContainer" &&
        selectedOceanLocation
    ) {

        setTimeout(
            focusSelectedGlobeLocation,
            200
        );

    }

}


// ============================================================
// FOCUS SELECTED GLOBE LOCATION
// ============================================================

function focusSelectedGlobeLocation() {

    const selected =
        getSelectedOceanLocation();


    if (
        !selected ||
        !globe
    ) {
        return;
    }


    const lat =
        Number(
            selected.latitude
        );


    const lng =
        Number(
            selected.longitude
        );


    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {

        console.error(
            "❌ Invalid selected globe coordinates:",
            selected
        );

        return;

    }


    try {

        // Rotate globe directly to alert.
        globe.pointOfView(
            {
                lat:
                    lat,

                lng:
                    lng,

                altitude:
                    1.6

            },
            1200
        );


        // Red alert ring.
        // This works even if the alert is not
        // an exact model-data point.
        globe

            .ringsData(
                [
                    {
                        latitude:
                            lat,

                        longitude:
                            lng
                    }
                ]
            )

            .ringLat(
                item =>
                    item.latitude
            )

            .ringLng(
                item =>
                    item.longitude
            )

            .ringColor(
                () => [
                    "#ff0000",
                    "#ff8c00"
                ]
            )

            .ringMaxRadius(
                5
            )

            .ringPropagationSpeed(
                2
            )

            .ringRepeatPeriod(
                900
            );


        console.log(
            "🎯 Globe focused on alert:",
            {
                latitude:
                    lat,

                longitude:
                    lng
            }
        );

    }
    catch (error) {

        console.error(
            "❌ Failed to focus globe:",
            error
        );

    }

}


// ============================================================
// LOAD MODEL DATA
// ============================================================

async function loadOceanData() {

    try {

        showLoading();

        hideError();


        console.log(
            "🌊 Loading ocean model data..."
        );


        // ----------------------------------------------------
        // TEMPERATURE
        // ----------------------------------------------------

        const temperatureResponse =
            await fetch(
                `${API_URL}/api/model/data?variable=thetao&depth=${selectedDepth}&time_index=${modelTimeIndex}&max_points=10000`
            );


        if (
            !temperatureResponse.ok
        ) {

            throw new Error(
                `Temperature request failed: ${temperatureResponse.status}`
            );

        }


        const temperatureData =
            await temperatureResponse.json();


        if (
            temperatureData.status !==
            "success"
        ) {

            throw new Error(
                temperatureData.message ||
                "Temperature data failed"
            );

        }


        // ----------------------------------------------------
        // SALINITY
        // ----------------------------------------------------

        const salinityResponse =
            await fetch(
                `${API_URL}/api/model/data?variable=so&depth=${selectedDepth}&time_index=${modelTimeIndex}&max_points=10000`
            );


        if (
            !salinityResponse.ok
        ) {

            throw new Error(
                `Salinity request failed: ${salinityResponse.status}`
            );

        }


        const salinityData =
            await salinityResponse.json();


        if (
            salinityData.status !==
            "success"
        ) {

            throw new Error(
                salinityData.message ||
                "Salinity data failed"
            );

        }


        // ----------------------------------------------------
        // UO
        // ----------------------------------------------------

        const uoResponse =
            await fetch(
                `${API_URL}/api/model/data?variable=uo&depth=${selectedDepth}&time_index=${modelTimeIndex}&max_points=10000`
            );


        const uoData =
            await uoResponse.json();


        // ----------------------------------------------------
        // VO
        // ----------------------------------------------------

        const voResponse =
            await fetch(
                `${API_URL}/api/model/data?variable=vo&depth=${selectedDepth}&time_index=${modelTimeIndex}&max_points=10000`
            );


        const voData =
            await voResponse.json();


        console.log(
            "uo response:",
            uoResponse.status
        );


        console.log(
            "vo response:",
            voResponse.status
        );


        // ----------------------------------------------------
        // SALINITY MAP
        // ----------------------------------------------------

        const salinityMap =
            new Map();


        salinityData.points.forEach(
            point => {

                const key =
                    `${point.latitude.toFixed(5)}-${point.longitude.toFixed(5)}`;


                salinityMap.set(
                    key,
                    point.value
                );

            }
        );


        // ----------------------------------------------------
        // UO MAP
        // ----------------------------------------------------

        const uoMap =
            new Map();


        if (
            uoData.status ===
            "success"
        ) {

            uoData.points.forEach(
                point => {

                    const key =
                        `${point.latitude.toFixed(5)}-${point.longitude.toFixed(5)}`;


                    uoMap.set(
                        key,
                        point.value
                    );

                }
            );

        }


        // ----------------------------------------------------
        // VO MAP
        // ----------------------------------------------------

        const voMap =
            new Map();


        if (
            voData.status ===
            "success"
        ) {

            voData.points.forEach(
                point => {

                    const key =
                        `${point.latitude.toFixed(5)}-${point.longitude.toFixed(5)}`;


                    voMap.set(
                        key,
                        point.value
                    );

                }
            );

        }


        // ----------------------------------------------------
        // COMBINE DATA
        // ----------------------------------------------------

        oceanData =
            temperatureData.points.map(
                point => {

                    const key =
                        `${point.latitude.toFixed(5)}-${point.longitude.toFixed(5)}`;


                    return {

                        latitude:
                            point.latitude,

                        longitude:
                            point.longitude,

                        depth:
                            temperatureData.depth_selected,

                        temperature:
                            point.value,

                        salinity:
                            salinityMap.get(
                                key
                            ) ?? null,

                        uo:
                            uoMap.get(
                                key
                            ) ?? null,

                        vo:
                            voMap.get(
                                key
                            ) ?? null

                    };

                }
            );


        filteredData =
            [...oceanData];


        // ----------------------------------------------------
        // UPDATE EVERYTHING
        // ----------------------------------------------------

        updateMap(
            filteredData
        );


        updateGlobe(
            filteredData
        );


        updateStatistics(
            filteredData
        );


        updateInsights(
            filteredData
        );


        displayTable(
            filteredData
        );


        updateCharts(
            filteredData
        );


        hideLoading();
        window.oceanData = oceanData;




        console.log(
            "✅ Loaded",
            oceanData.length,
            "points"
        );

    }
    catch (error) {

        console.error(
            "❌ Failed to load ocean data:",
            error
        );


        hideLoading();


        showError(
            error.message ||
            "Failed to load ocean data"
        );

    }

}

// ============================================================
// FILTERS
// ============================================================

function applyFilters() {

    const searchInput =
        document.getElementById(
            "searchInput"
        );


    const minTemperatureInput =
        document.getElementById(
            "minTemperature"
        );


    const maxTemperatureInput =
        document.getElementById(
            "maxTemperature"
        );


    const minSalinityInput =
        document.getElementById(
            "minSalinity"
        );


    const maxSalinityInput =
        document.getElementById(
            "maxSalinity"
        );


    const search =
        searchInput
        ?
        searchInput.value
            .trim()
            .toLowerCase()
        :
        "";


    const minTemperature =
        minTemperatureInput &&
        minTemperatureInput.value !== ""
        ?
        Number(
            minTemperatureInput.value
        )
        :
        -Infinity;


    const maxTemperature =
        maxTemperatureInput &&
        maxTemperatureInput.value !== ""
        ?
        Number(
            maxTemperatureInput.value
        )
        :
        Infinity;


    const minSalinity =
        minSalinityInput &&
        minSalinityInput.value !== ""
        ?
        Number(
            minSalinityInput.value
        )
        :
        -Infinity;


    const maxSalinity =
        maxSalinityInput &&
        maxSalinityInput.value !== ""
        ?
        Number(
            maxSalinityInput.value
        )
        :
        Infinity;


    filteredData =
        oceanData.filter(
            item => {

                const temperature =
                    Number(
                        item.temperature
                    );


                const salinity =
                    Number(
                        item.salinity
                    );


                const locationText =
                    `${item.latitude} ${item.longitude}`
                        .toLowerCase();


                const matchesSearch =
                    search === "" ||
                    locationText.includes(
                        search
                    );


                const matchesTemperature =
                    temperature >=
                        minTemperature &&
                    temperature <=
                        maxTemperature;


                const matchesSalinity =
                    salinity >=
                        minSalinity &&
                    salinity <=
                        maxSalinity;


                return (
                    matchesSearch &&
                    matchesTemperature &&
                    matchesSalinity
                );

            }
        );


    updateMap(
        filteredData
    );


    updateGlobe(
        filteredData
    );


    updateStatistics(
        filteredData
    );


    updateInsights(
        filteredData
    );


    displayTable(
        filteredData
    );


    updateCharts(
        filteredData
    );

}


// ============================================================
// RESET FILTERS
// ============================================================

function resetFilters() {

    [
        "searchInput",
        "minTemperature",
        "maxTemperature",
        "minSalinity",
        "maxSalinity"
    ].forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {
            element.value = "";
        }

    });


    selectedOceanLocation =
        null;


    if (globe) {

        globe.ringsData([]);

    }


    filteredData =
        [...oceanData];


    updateMap(
        filteredData
    );


    updateGlobe(
        filteredData
    );


    updateStatistics(
        filteredData
    );


    updateInsights(
        filteredData
    );


    displayTable(
        filteredData
    );


    updateCharts(
        filteredData
    );

}


// ============================================================
// STATISTICS
// ============================================================

function updateStatistics(data) {

    const totalElement =
        document.getElementById(
            "totalPoints"
        );


    const averageTemperature =
        document.getElementById(
            "averageTemperature"
        );


    const maximumDepth =
        document.getElementById(
            "maximumDepth"
        );


    const averageSalinity =
        document.getElementById(
            "averageSalinity"
        );


    const dataCountBadge =
        document.getElementById(
            "dataCountBadge"
        );


    const temperatures =
        data
            .map(
                item =>
                    Number(
                        item.temperature
                    )
            )
            .filter(
                Number.isFinite
            );


    const salinities =
        data
            .map(
                item =>
                    Number(
                        item.salinity
                    )
            )
            .filter(
                Number.isFinite
            );


    const depths =
        data
            .map(
                item =>
                    Number(
                        item.depth
                    )
            )
            .filter(
                Number.isFinite
            );


    const temperatureAverage =
        temperatures.length
        ?
        temperatures.reduce(
            (a, b) =>
                a + b,
            0
        )
        /
        temperatures.length
        :
        0;


    const salinityAverage =
        salinities.length
        ?
        salinities.reduce(
            (a, b) =>
                a + b,
            0
        )
        /
        salinities.length
        :
        0;


    const deepest =
        depths.length
        ?
        Math.max(
            ...depths
        )
        :
        0;


    if (totalElement) {

        totalElement.textContent =
            data.length.toLocaleString();

    }


    if (dataCountBadge) {

        dataCountBadge.textContent =
            `${data.length.toLocaleString()} Records`;

    }


    if (averageTemperature) {

        averageTemperature.textContent =
            `${temperatureAverage.toFixed(2)} °C`;

    }


    if (maximumDepth) {

        maximumDepth.textContent =
            `${deepest.toFixed(2)} m`;

    }


    if (averageSalinity) {

        averageSalinity.textContent =
            salinityAverage.toFixed(2);

    }

}


// ============================================================
// OCEAN INSIGHTS
// ============================================================

function updateInsights(data) {

    const hottest =
        document.getElementById(
            "hottestLocation"
        );


    const coldest =
        document.getElementById(
            "coldestLocation"
        );


    const deepest =
        document.getElementById(
            "deepestLocation"
        );


    const highestSalinity =
        document.getElementById(
            "highestSalinityLocation"
        );


    if (
        data.length ===
        0
    ) {

        [
            hottest,
            coldest,
            deepest,
            highestSalinity
        ].forEach(
            element => {

                if (element) {

                    element.textContent =
                        "No data";

                }

            }
        );

        return;

    }


    const validTemperature =
        data.filter(
            item =>
                Number.isFinite(
                    Number(
                        item.temperature
                    )
                )
        );


    const validDepth =
        data.filter(
            item =>
                Number.isFinite(
                    Number(
                        item.depth
                    )
                )
        );


    const validSalinity =
        data.filter(
            item =>
                Number.isFinite(
                    Number(
                        item.salinity
                    )
                )
        );


    if (
        hottest &&
        validTemperature.length
    ) {

        const item =
            validTemperature.reduce(
                (a, b) =>
                    Number(
                        b.temperature
                    )
                    >
                    Number(
                        a.temperature
                    )
                    ?
                    b
                    :
                    a
            );


        hottest.innerHTML =
            `${Number(
                item.temperature
            ).toFixed(2)} °C<br>
             📍 ${
                Number(
                    item.latitude
                ).toFixed(2)
             },
             ${
                Number(
                    item.longitude
                ).toFixed(2)
             }`;

    }


    if (
        coldest &&
        validTemperature.length
    ) {

        const item =
            validTemperature.reduce(
                (a, b) =>
                    Number(
                        b.temperature
                    )
                    <
                    Number(
                        a.temperature
                    )
                    ?
                    b
                    :
                    a
            );


        coldest.innerHTML =
            `${Number(
                item.temperature
            ).toFixed(2)} °C<br>
             📍 ${
                Number(
                    item.latitude
                ).toFixed(2)
             },
             ${
                Number(
                    item.longitude
                ).toFixed(2)
             }`;

    }


    if (
        deepest &&
        validDepth.length
    ) {

        const item =
            validDepth.reduce(
                (a, b) =>
                    Number(
                        b.depth
                    )
                    >
                    Number(
                        a.depth
                    )
                    ?
                    b
                    :
                    a
            );


        deepest.innerHTML =
            `${Number(
                item.depth
            ).toFixed(2)} m<br>
             📍 ${
                Number(
                    item.latitude
                ).toFixed(2)
             },
             ${
                Number(
                    item.longitude
                ).toFixed(2)
             }`;

    }


    if (
        highestSalinity &&
        validSalinity.length
    ) {

        const item =
            validSalinity.reduce(
                (a, b) =>
                    Number(
                        b.salinity
                    )
                    >
                    Number(
                        a.salinity
                    )
                    ?
                    b
                    :
                    a
            );


        highestSalinity.innerHTML =
            `${Number(
                item.salinity
            ).toFixed(2)}<br>
             📍 ${
                Number(
                    item.latitude
                ).toFixed(2)
             },
             ${
                Number(
                    item.longitude
                ).toFixed(2)
             }`;

    }

}


// ============================================================
// OCEAN DATA TABLE
// ============================================================

function displayTable(data) {

    const container =
        document.getElementById(
            "dataContainer"
        );


    if (!container) {
        return;
    }


    if (
        data.length ===
        0
    ) {

        container.innerHTML = `

            <div class="no-data-message">

                No ocean data matches
                the selected filters.

            </div>

        `;

        return;

    }


    let html = `

        <div style="
            overflow-x:auto;
            width:100%;
        ">

            <table>

                <thead>

                    <tr>

                        <th>#</th>

                        <th>
                            Latitude
                        </th>

                        <th>
                            Longitude
                        </th>

                        <th>
                            Depth (m)
                        </th>

                        <th>
                            Temperature (°C)
                        </th>

                        <th>
                            Salinity
                        </th>

                        <th>
                            Eastward Current (m/s)
                        </th>

                        <th>
                            Northward Current (m/s)
                        </th>

                    </tr>

                </thead>

                <tbody>

    `;


    data.forEach(
        (item, index) => {

            html += `

                <tr>

                    <td>
                        ${index + 1}
                    </td>

                    <td>
                        ${Number(
                            item.latitude
                        ).toFixed(3)}
                    </td>

                    <td>
                        ${Number(
                            item.longitude
                        ).toFixed(3)}
                    </td>

                    <td>
                        ${Number(
                            item.depth
                        ).toFixed(2)}
                    </td>

                    <td>
                        ${Number(
                            item.temperature
                        ).toFixed(2)}
                    </td>

                    <td>
                        ${
                            Number.isFinite(
                                Number(
                                    item.salinity
                                )
                            )
                            ?
                            Number(
                                item.salinity
                            ).toFixed(2)
                            :
                            "N/A"
                        }
                    </td>

                    <td>
                        ${
                            Number.isFinite(
                                Number(
                                    item.uo
                                )
                            )
                            ?
                            Number(
                                item.uo
                            ).toFixed(3)
                            :
                            "N/A"
                        }
                    </td>

                    <td>
                        ${
                            Number.isFinite(
                                Number(
                                    item.vo
                                )
                            )
                            ?
                            Number(
                                item.vo
                            ).toFixed(3)
                            :
                            "N/A"
                        }
                    </td>

                </tr>

            `;

        }
    );


    html += `

                </tbody>

            </table>

        </div>

    `;


    container.innerHTML =
        html;

}


// ============================================================
// CHARTS
// ============================================================

function updateCharts(data) {

    updateTemperatureChart(
        data
    );

    updateSalinityChart(
        data
    );

    updateDepthChart(
        data
    );

}


function updateTemperatureChart(data) {

    const canvas =
        document.getElementById(
            "temperatureChart"
        );


    if (
        !canvas ||
        typeof Chart ===
        "undefined"
    ) {
        return;
    }


    const values =
        data
            .map(
                item =>
                    Number(
                        item.temperature
                    )
            )
            .filter(
                Number.isFinite
            );


    const labels = [
        "<5",
        "5-10",
        "10-15",
        "15-20",
        "20-25",
        "25-30",
        ">30"
    ];


    const counts =
        new Array(
            labels.length
        ).fill(0);


    values.forEach(
        value => {

            if (value < 5)
                counts[0]++;
            else if (value < 10)
                counts[1]++;
            else if (value < 15)
                counts[2]++;
            else if (value < 20)
                counts[3]++;
            else if (value < 25)
                counts[4]++;
            else if (value < 30)
                counts[5]++;
            else
                counts[6]++;

        }
    );


    if (temperatureChart) {
        temperatureChart.destroy();
    }


    temperatureChart =
        new Chart(
            canvas,
            {

                type:
                    "bar",

                data: {

                    labels:
                        labels,

                    datasets: [

                        {

                            label:
                                "Temperature",

                            data:
                                counts

                        }

                    ]

                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {

                            display:
                                false

                        }

                    }

                }

            }
        );

}


function updateSalinityChart(data) {

    const canvas =
        document.getElementById(
            "salinityChart"
        );


    if (
        !canvas ||
        typeof Chart ===
        "undefined"
    ) {
        return;
    }


    const values =
        data
            .map(
                item =>
                    Number(
                        item.salinity
                    )
            )
            .filter(
                Number.isFinite
            );


    const labels = [
        "<30",
        "30-31",
        "31-32",
        "32-33",
        "33-34",
        "34-35",
        "35-36",
        "36-37",
        ">37"
    ];


    const counts =
        new Array(
            labels.length
        ).fill(0);


    values.forEach(
        value => {

            if (value < 30)
                counts[0]++;
            else if (value < 31)
                counts[1]++;
            else if (value < 32)
                counts[2]++;
            else if (value < 33)
                counts[3]++;
            else if (value < 34)
                counts[4]++;
            else if (value < 35)
                counts[5]++;
            else if (value < 36)
                counts[6]++;
            else if (value < 37)
                counts[7]++;
            else
                counts[8]++;

        }
    );


    if (salinityChart) {
        salinityChart.destroy();
    }


    salinityChart =
        new Chart(
            canvas,
            {

                type:
                    "bar",

                data: {

                    labels:
                        labels,

                    datasets: [

                        {

                            label:
                                "Salinity",

                            data:
                                counts

                        }

                    ]

                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {

                            display:
                                false

                        }

                    }

                }

            }
        );

}


function updateDepthChart(data) {

    const canvas =
        document.getElementById(
            "depthChart"
        );


    if (
        !canvas ||
        typeof Chart ===
        "undefined"
    ) {
        return;
    }


    const values =
        data
            .map(
                item =>
                    Number(
                        item.depth
                    )
            )
            .filter(
                Number.isFinite
            );


    if (depthChart) {
        depthChart.destroy();
    }


    depthChart =
        new Chart(
            canvas,
            {

                type:
                    "line",

                data: {

                    labels:
                        values.map(
                            (
                                value,
                                index
                            ) =>
                                index + 1
                        ),

                    datasets: [

                        {

                            label:
                                "Depth",

                            data:
                                values,

                            tension:
                                0.25

                        }

                    ]

                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {

                            display:
                                false

                        }

                    }

                }

            }
        );

}

// ============================================================
// DEPTH CONTROL
// ============================================================

async function initializeDepthControl() {

    const slider =
        document.getElementById(
            "depthSlider"
        );


    const valueLabel =
        document.getElementById(
            "depthValue"
        );


    if (
        !slider ||
        !valueLabel
    ) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/api/model/depths`
            );


        const data =
            await response.json();


        if (
            data.status !==
            "success" ||
            !data.depths.length
        ) {

            throw new Error(
                "Unable to load model depths"
            );

        }


        const depths =
            data.depths;


        slider.min =
            0;


        slider.max =
            depths.length - 1;


        slider.step =
            1;


        let index =
            depths.findIndex(
                depth =>
                    Math.abs(
                        depth -
                        selectedDepth
                    ) < 0.01
            );


        if (
            index ===
            -1
        ) {

            index =
                0;


            selectedDepth =
                depths[0];

        }


        slider.value =
            index;


        valueLabel.textContent =
            `${selectedDepth.toFixed(1)} m`;


        slider.addEventListener(
            "change",
            async () => {

                const selectedIndex =
                    Number(
                        slider.value
                    );


                selectedDepth =
                    depths[
                        selectedIndex
                    ];


                valueLabel.textContent =
                    `${selectedDepth.toFixed(1)} m`;


                await loadOceanData();

            }
        );

    }
    catch (error) {

        console.error(
            "❌ Failed to load depths:",
            error
        );

    }

}


// ============================================================
// CURRENT VECTORS
// ============================================================

function updateCurrentVectors(
    data
) {

    if (!globe) {
        return;
    }


    const currentData =
        data

            .filter(
                point =>
                    point.uo !== null &&
                    point.vo !== null
            )

            .filter(
                (
                    point,
                    index
                ) =>
                    index % 25 ===
                    0
            )

            .map(
                point => {

                    const speed =
                        Math.sqrt(
                            point.uo *
                                point.uo +
                            point.vo *
                                point.vo
                        );


                    const scale =
                        8;


                    return {

                        startLat:
                            point.latitude,

                        startLng:
                            point.longitude,

                        endLat:
                            point.latitude +
                            point.vo *
                            scale,

                        endLng:
                            point.longitude +
                            point.uo *
                            scale,

                        speed:
                            speed

                    };

                }
            );


    console.log(
        "🌊 Current vectors generated:",
        currentData.length
    );


    globe

        .arcsData(
            currentData
        )

        .arcStartLat(
            "startLat"
        )

        .arcStartLng(
            "startLng"
        )

        .arcEndLat(
            "endLat"
        )

        .arcEndLng(
            "endLng"
        )

        .arcColor(
            () =>
                "#00e5ff"
        )

        .arcAltitude(
            0.02
        )

        .arcStroke(
            1.5
        )

        .arcDashLength(
            0.7
        )

        .arcDashGap(
            0.3
        )

        .arcDashAnimateTime(
            0
        );

}


// ============================================================
// ARGO
// ============================================================

async function loadArgoData() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/argo/data`
            );


        const data =
            await response.json();


        if (
            data.status !==
            "success"
        ) {

            throw new Error(
                data.message ||
                "Failed to load Argo data"
            );

        }


        console.log(
            "🌊 Argo profiles loaded:",
            data.count
        );


        window.argoProfiles =
            data.profiles;


        if (!globe) {

            console.warn(
                "⚠️ Globe not ready for Argo markers"
            );

            return;

        }


        // ----------------------------------------------------
        // YELLOW ARGO MARKERS
        // ----------------------------------------------------

        globe

            .labelsData(
                data.profiles
            )

            .labelLat(
                profile =>
                    profile.latitude
            )

            .labelLng(
                profile =>
                    profile.longitude
            )

            .labelText(
                () =>
                    "●"
            )

            .labelColor(
                () =>
                    "#ffff00"
            )

            .labelSize(
                () =>
                    1.8
            )

            .labelDotRadius(
                () =>
                    0.35
            )

            .labelAltitude(
                () =>
                    0.025
            )

            .labelResolution(
                4
            )

            .onLabelClick(
    profile => {
        console.log(
            "📍 Argo profile selected:",
            profile
        );

        loadArgoProfile(profile);
    }
);


        console.log(
            "🟡 Argo markers added to globe:",
            data.profiles.length
        );

    }

    catch (error) {

        console.error(
            "❌ Failed to load Argo data:",
            error
        );

    }

}
// ============================================================
// ARGO PROFILE PANEL
// ============================================================

function showArgoProfilePanel(profileData, markerInfo) {

    // Remove an existing panel
    const oldPanel =
        document.getElementById("argoProfilePanel");

    if (oldPanel) {
        oldPanel.remove();
    }


    // Create panel
    const panel =
        document.createElement("div");

    panel.id = "argoProfilePanel";


    panel.innerHTML = `

        <div class="argo-profile-header">

            <div>

                <h2>
                    🟡 Argo Profile
                </h2>

                <div class="argo-profile-info">

                    Latitude:
                    ${Number(markerInfo.latitude).toFixed(3)}°

                    &nbsp;&nbsp;

                    Longitude:
                    ${Number(markerInfo.longitude).toFixed(3)}°

                    <br>

                    Time:
                    ${markerInfo.time || "Unknown"}

                </div>

            </div>


            <button
                id="closeArgoProfile"
                class="argo-close-button"
            >
                ✕
            </button>

        </div>


        <div class="argo-chart-card">

            <h3>
                🌡️ Temperature vs Depth
            </h3>

            <div class="argo-chart-wrapper">

                <canvas
                    id="argoTemperatureChart"
                ></canvas>

            </div>

        </div>


        <div class="argo-chart-card">

            <h3>
                🧂 Salinity vs Depth
            </h3>

            <div class="argo-chart-wrapper">
    <canvas
        id="argoSalinityChart"
    ></canvas>
</div>

<button
    class="compare-model-btn"
    id="compareArgoModelBtn"
>
    🔍 Compare with Model
</button>

</div>
`;


    document.body.appendChild(panel);


    // Close button
    document
        .getElementById("closeArgoProfile")
        .addEventListener(
            "click",
            () => {

                if (
                    window.argoTemperatureProfileChart
                ) {

                    window
                        .argoTemperatureProfileChart
                        .destroy();

                    window
                        .argoTemperatureProfileChart =
                        null;
                }


                if (
                    window.argoSalinityProfileChart
                ) {

                    window
                        .argoSalinityProfileChart
                        .destroy();

                    window
                        .argoSalinityProfileChart =
                        null;
                }


                panel.remove();

            }
        );


    // Draw charts
    renderArgoProfileCharts(
        profileData
    );

}
// ============================================================
// ARGO PROFILE LOADER
// ============================================================

let selectedArgoProfile = null;


// ------------------------------------------------------------
// Load one Argo profile
// ------------------------------------------------------------

async function loadArgoProfile(profile) {

    try {

        console.log(
            "🌊 Loading Argo profile:",
            profile
        );


        // Get profile index
        const profileIndex =
            profile.profile_index ??
            profile.profileIndex ??
            profile.index;


        if (
            profileIndex === undefined ||
            profileIndex === null
        ) {

            console.error(
                "❌ Argo profile index not found:",
                profile
            );

            alert(
                "Unable to load this Argo profile."
            );

            return;
        }


        console.log(
            "📊 Argo profile index:",
            profileIndex
        );


        // Request actual profile data
        const response =
            await fetch(
                `${API_URL}/api/argo/profile/${profileIndex}`
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        console.log(
            "✅ Argo profile received:",
            data
        );


        if (
            data.status !==
            "success"
        ) {

            throw new Error(
                data.message ||
                "Argo profile not found"
            );

        }


        selectedArgoProfile =
            data.profile;


        showArgoProfilePanel(
            data.profile,
            profile
        );


    } catch (error) {

        console.error(
            "❌ Failed to load Argo profile:",
            error
        );


        alert(
            "Unable to load the Argo profile.\n\n" +
            error.message
        );

    }

}
async function compareArgoWithModel(profile) {
    try {
        console.log("🔍 Comparing Argo profile with model:", profile);

        const response = await fetch(
            `/api/argo/profile/${profile.profile_index}`
        );

        const data = await response.json();

        if (data.status !== "success") {
            throw new Error(data.message || "Failed to load Argo profile");
        }

        const argoProfile = data.profile;

        // Find the closest model point to the Argo location
        let closestPoint = null;
        let minDistance = Infinity;

        if (window.oceanData) {
            window.oceanData.forEach(point => {
                const dLat = point.latitude - argoProfile.latitude;
                const dLon = point.longitude - argoProfile.longitude;

                const distance = Math.sqrt(
                    dLat * dLat + dLon * dLon
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    closestPoint = point;
                }
            });
        }

        if (!closestPoint) {
            alert("No model data available near this Argo profile.");
            return;
        }

        console.log("📊 Closest model point:", closestPoint);

        showComparisonPanel(
            argoProfile,
            closestPoint,
            minDistance
        );

    } catch (error) {
        console.error("❌ Model vs Argo comparison failed:", error);
        alert("Unable to compare Argo and model data.");
    }
}
function showComparisonPanel(argoProfile, modelPoint, distance) {

    const oldPanel = document.getElementById("comparisonPanel");

    if (oldPanel) {
        oldPanel.remove();
    }

    const panel = document.createElement("div");

    panel.id = "comparisonPanel";

    panel.innerHTML = `
        <div class="comparison-header">
            <h3>Model vs Argo</h3>
            <button onclick="document.getElementById('comparisonPanel').remove()">×</button>
        </div>

        <div class="comparison-location">
            <strong>Argo Location</strong><br>
            Latitude: ${argoProfile.latitude.toFixed(3)}°<br>
            Longitude: ${argoProfile.longitude.toFixed(3)}°
        </div>

        <div class="comparison-table">

            <div class="comparison-row comparison-title">
                <span>Variable</span>
                <span>Argo</span>
                <span>Model</span>
                <span>Anomaly</span>
            </div>

            <div class="comparison-row">
                <span>Temperature</span>
                <span id="argoTempValue">—</span>
                <span id="modelTempValue">—</span>
                <span id="tempAnomalyValue">—</span>
            </div>

            <div class="comparison-row">
                <span>Salinity</span>
                <span id="argoSalinityValue">—</span>
                <span id="modelSalinityValue">—</span>
                <span id="salinityAnomalyValue">—</span>
            </div>

        </div>

        <div class="comparison-distance">
            Model distance from Argo:
            <strong>${distance.toFixed(3)}°</strong>
        </div>

        <div id="comparisonStatus" class="comparison-status">
            Calculating anomalies...
        </div>
    `;

    document.body.appendChild(panel);

    calculateComparisonValues(
        argoProfile,
        modelPoint
    );
}
function calculateComparisonValues(argoProfile, modelPoint) {

    const argoLevels = argoProfile.levels || [];

    if (argoLevels.length === 0) {
        document.getElementById("comparisonStatus").textContent =
            "No Argo measurement levels available.";
        return;
    }

    // Use the shallowest valid Argo observation
    const validLevel = argoLevels.find(level =>
        Number.isFinite(level.temperature) ||
        Number.isFinite(level.salinity)
    );
const compareButton = panel.querySelector("#compareArgoModelBtn");

if (compareButton) {
    console.log("🔍 Compare button connected.");

    compareButton.onclick = function () {
        console.log("🔍 Compare button clicked!");
        console.log("📍 Marker info:", markerInfo);

        compareArgoWithModel(markerInfo);
    };
}
    if (!validLevel) {
        document.getElementById("comparisonStatus").textContent =
            "No valid Argo temperature/salinity observations.";
        return;
    }

    const argoTemp = Number(validLevel.temperature);
    const argoSalinity = Number(validLevel.salinity);

    const modelTemp = Number(modelPoint.temperature);
    const modelSalinity = Number(modelPoint.salinity);

    let tempAnomaly = null;
    let salinityAnomaly = null;

    if (Number.isFinite(argoTemp) && Number.isFinite(modelTemp)) {
        tempAnomaly = modelTemp - argoTemp;
    }

    if (
        Number.isFinite(argoSalinity) &&
        Number.isFinite(modelSalinity)
    ) {
        salinityAnomaly = modelSalinity - argoSalinity;
    }

    document.getElementById("argoTempValue").textContent =
        Number.isFinite(argoTemp)
            ? `${argoTemp.toFixed(2)} °C`
            : "—";

    document.getElementById("modelTempValue").textContent =
        Number.isFinite(modelTemp)
            ? `${modelTemp.toFixed(2)} °C`
            : "—";

    document.getElementById("tempAnomalyValue").textContent =
        Number.isFinite(tempAnomaly)
            ? `${tempAnomaly >= 0 ? "+" : ""}${tempAnomaly.toFixed(2)} °C`
            : "—";

    document.getElementById("argoSalinityValue").textContent =
        Number.isFinite(argoSalinity)
            ? argoSalinity.toFixed(2)
            : "—";

    document.getElementById("modelSalinityValue").textContent =
        Number.isFinite(modelSalinity)
            ? modelSalinity.toFixed(2)
            : "—";

    document.getElementById("salinityAnomalyValue").textContent =
        Number.isFinite(salinityAnomaly)
            ? `${salinityAnomaly >= 0 ? "+" : ""}${salinityAnomaly.toFixed(2)}`
            : "—";

    const status = document.getElementById("comparisonStatus");

    const anomalies = [];

    if (Number.isFinite(tempAnomaly)) {
        anomalies.push(Math.abs(tempAnomaly));
    }

    if (Number.isFinite(salinityAnomaly)) {
        anomalies.push(Math.abs(salinityAnomaly));
    }

    const significant =
        anomalies.some(value => value >= 1.0);

    if (significant) {
        status.textContent =
            "⚠ Significant model-observation difference detected.";

        status.classList.add("comparison-warning");
    } else {
        status.textContent =
            "✓ Model and Argo observations are reasonably close.";

        status.classList.add("comparison-normal");
    }
}
// ============================================================
// ARGO PROFILE CHART RENDERER
// ============================================================

function renderArgoProfileCharts(profileData) {

    console.log(
        "📊 Rendering Argo profile charts:",
        profileData
    );


    // --------------------------------------------------------
    // Find the actual profile levels
    // --------------------------------------------------------

    const levels =
        profileData.levels ||
        profileData.data ||
        profileData.profile ||
        profileData;


    if (!Array.isArray(levels)) {

        console.error(
            "❌ Could not find Argo profile levels:",
            profileData
        );

        alert(
            "Argo profile data could not be displayed."
        );

        return;
    }


    // --------------------------------------------------------
    // Extract temperature and salinity points
    // --------------------------------------------------------

    const temperaturePoints = [];
    const salinityPoints = [];


    levels.forEach(row => {

        const depth = Number(
            row.depth ??
            row.pressure ??
            row.PRES ??
            row.PRES_ADJUSTED ??
            row.DEPTH
        );


        const temperature = Number(
            row.temperature ??
            row.temp ??
            row.TEMP ??
            row.TEMP_ADJUSTED ??
            row.thetao
        );


        const salinity = Number(
            row.salinity ??
            row.psal ??
            row.PSAL ??
            row.PSAL_ADJUSTED ??
            row.so
        );


        if (
            Number.isFinite(depth) &&
            Number.isFinite(temperature)
        ) {

            temperaturePoints.push({
                x: temperature,
                y: depth
            });

        }


        if (
            Number.isFinite(depth) &&
            Number.isFinite(salinity)
        ) {

            salinityPoints.push({
                x: salinity,
                y: depth
            });

        }

    });


    console.log(
        "🌡️ Temperature points:",
        temperaturePoints.length
    );

    console.log(
        "🧂 Salinity points:",
        salinityPoints.length
    );


    // --------------------------------------------------------
    // Check Chart.js
    // --------------------------------------------------------

    if (typeof Chart === "undefined") {

        console.error(
            "❌ Chart.js is not loaded."
        );

        alert(
            "Chart.js is not loaded on this page."
        );

        return;
    }


    // --------------------------------------------------------
    // Destroy previous charts
    // --------------------------------------------------------

    if (window.argoTemperatureProfileChart) {

        window
            .argoTemperatureProfileChart
            .destroy();

        window
            .argoTemperatureProfileChart =
            null;
    }


    if (window.argoSalinityProfileChart) {

        window
            .argoSalinityProfileChart
            .destroy();

        window
            .argoSalinityProfileChart =
            null;
    }


    // --------------------------------------------------------
    // Temperature chart
    // --------------------------------------------------------

    const temperatureCanvas =
        document.getElementById(
            "argoTemperatureChart"
        );


    if (
        temperatureCanvas &&
        temperaturePoints.length > 0
    ) {

        window.argoTemperatureProfileChart =
            new Chart(
                temperatureCanvas.getContext("2d"),
                {

                    type: "line",

                    data: {

                        datasets: [

                            {

                                label:
                                    "Temperature (°C)",

                                data:
                                    temperaturePoints,

                                parsing: false,

                                tension: 0.15,

                                pointRadius: 2,

                                borderWidth: 2

                            }

                        ]

                    },


                    options: {

                        responsive: true,

                        maintainAspectRatio: false,


                        scales: {

                            x: {

                                type: "linear",

                                title: {

                                    display: true,

                                    text:
                                        "Temperature (°C)"

                                }

                            },


                            y: {

                                reverse: true,

                                title: {

                                    display: true,

                                    text:
                                        "Depth / Pressure"

                                }

                            }

                        },


                        plugins: {

                            legend: {

                                display: true

                            },


                            tooltip: {

                                callbacks: {

                                    label:
                                        function(context) {

                                            return (
                                                "Temperature: " +
                                                context.parsed.x.toFixed(2) +
                                                " °C, Depth: " +
                                                context.parsed.y.toFixed(2)
                                            );

                                        }

                                }

                            }

                        }

                    }

                }
            );

    }


    // --------------------------------------------------------
    // Salinity chart
    // --------------------------------------------------------

    const salinityCanvas =
        document.getElementById(
            "argoSalinityChart"
        );


    if (
        salinityCanvas &&
        salinityPoints.length > 0
    ) {

        window.argoSalinityProfileChart =
            new Chart(
                salinityCanvas.getContext("2d"),
                {

                    type: "line",

                    data: {

                        datasets: [

                            {

                                label:
                                    "Salinity (PSU)",

                                data:
                                    salinityPoints,

                                parsing: false,

                                tension: 0.15,

                                pointRadius: 2,

                                borderWidth: 2

                            }

                        ]

                    },


                    options: {

                        responsive: true,

                        maintainAspectRatio: false,


                        scales: {

                            x: {

                                type: "linear",

                                title: {

                                    display: true,

                                    text:
                                        "Salinity (PSU)"

                                }

                            },


                            y: {

                                reverse: true,

                                title: {

                                    display: true,

                                    text:
                                        "Depth / Pressure"

                                }

                            }

                        },


                        plugins: {

                            legend: {

                                display: true

                            },


                            tooltip: {

                                callbacks: {

                                    label:
                                        function(context) {

                                            return (
                                                "Salinity: " +
                                                context.parsed.x.toFixed(2) +
                                                " PSU, Depth: " +
                                                context.parsed.y.toFixed(2)
                                            );

                                        }

                                }

                            }

                        }

                    }

                }
            );

    }


    // --------------------------------------------------------
    // No-data messages
    // --------------------------------------------------------

    if (temperaturePoints.length === 0) {

        console.warn(
            "⚠️ No temperature values found in Argo profile."
        );

    }


    if (salinityPoints.length === 0) {

        console.warn(
            "⚠️ No salinity values found in Argo profile."
        );

    }

}

// ============================================================
// CSV DOWNLOAD
// ============================================================

function downloadCSV() {

    if (
        filteredData.length ===
        0
    ) {

        alert(
            "No ocean data available."
        );

        return;

    }


    let csv =
        "Latitude,Longitude,Depth (m),Temperature (°C),Salinity,UO (m/s),VO (m/s)\n";


    filteredData.forEach(
        item => {

            csv +=
                `${item.latitude},` +
                `${item.longitude},` +
                `${item.depth},` +
                `${item.temperature},` +
                `${item.salinity ?? ""},` +
                `${item.uo ?? ""},` +
                `${item.vo ?? ""}\n`;

        }
    );


    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;


    link.download =
        "indian_ocean_data.csv";


    document.body.appendChild(
        link
    );


    link.click();


    document.body.removeChild(
        link
    );


    URL.revokeObjectURL(
        url
    );

}


// ============================================================
// THEME
// ============================================================

function initializeTheme() {

    const button =
        document.getElementById(
            "themeToggle"
        );


    if (!button) {
        return;
    }


    const saved =
        localStorage.getItem(
            "oceanDashboardTheme"
        );


    if (
        saved ===
        "dark"
    ) {

        document.body.classList.add(
            "dark-mode"
        );


        button.textContent =
            "☀️ Light Mode";

    }
    else {

        button.textContent =
            "🌙 Dark Mode";

    }


    button.addEventListener(
        "click",
        () => {

            document.body.classList.toggle(
                "dark-mode"
            );


            const dark =
                document.body.classList.contains(
                    "dark-mode"
                );


            button.textContent =
                dark
                ?
                "☀️ Light Mode"
                :
                "🌙 Dark Mode";


            localStorage.setItem(
                "oceanDashboardTheme",
                dark
                ?
                "dark"
                :
                "light"
            );

        }
    );

}


// ============================================================
// DASHBOARD NAVIGATION
// ============================================================

function handleDashboardNavigation() {

    const hash =
        window.location.hash;


    if (
        hash ===
        "#map"
    ) {

        setTimeout(
            () => {

                initializeMap();


                if (map) {

                    map.invalidateSize();

                }


                focusSelectedMapLocation();

            },
            1000
        );

    }


    if (
        hash ===
        "#globeContainer"
    ) {

        setTimeout(
            () => {

                initializeGlobe();

                resizeGlobe();

                focusSelectedGlobeLocation();

            },
            1200
        );

    }

}


window.addEventListener(
    "load",
    handleDashboardNavigation
);


window.addEventListener(
    "hashchange",
    handleDashboardNavigation
);


// ============================================================
// SELECTED ALERT MARKER STYLE
// ============================================================

const markerStyle =
    document.createElement(
        "style"
    );


markerStyle.textContent = `

.selected-alert-marker {

    width:70px;
    height:70px;

    border-radius:50%;

    display:flex;

    align-items:center;

    justify-content:center;

    background:
        rgba(239,68,68,0.20);

    box-shadow:
        0 0 0 8px rgba(239,68,68,0.15),
        0 0 0 16px rgba(239,68,68,0.08);

    animation:
        selectedAlertPulse 1.5s infinite;

}


.selected-alert-core {

    width:32px;
    height:32px;

    border-radius:50%;

    background:#ef4444;

    border:5px solid white;

    box-shadow:
        0 0 20px rgba(239,68,68,0.9);

}


@keyframes selectedAlertPulse {

    0% {

        transform:
            scale(.85);

        opacity:
            1;

    }

    50% {

        transform:
            scale(1.12);

        opacity:
            .8;

    }

    100% {

        transform:
            scale(.85);

        opacity:
            1;

    }

}

`;


document.head.appendChild(
    markerStyle
);


console.log(
    "✅ Improved Ocean Dashboard loaded."
);
// ============================================================
// ARGO PROFILE PANEL STYLES
// ============================================================

const argoProfileStyle = document.createElement("style");

argoProfileStyle.textContent = `

    #argoProfilePanel {

        position: fixed;

        top: 50%;

        left: 50%;

        transform: translate(-50%, -50%);

        width: min(900px, 92vw);

        max-height: 90vh;

        overflow-y: auto;

        z-index: 99999;

        background: rgba(15, 23, 42, 0.97);

        color: white;

        border-radius: 16px;

        padding: 20px;

        box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.55);

        backdrop-filter: blur(12px);

        font-family:
            Arial,
            sans-serif;
    }


    .argo-profile-header {

        display: flex;

        justify-content: space-between;

        align-items: flex-start;

        gap: 20px;

        margin-bottom: 18px;
    }


    .argo-profile-header h2 {

        margin: 0 0 8px 0;

        font-size: 22px;

        font-weight: 700;
    }


    .argo-profile-info {

        font-size: 13px;

        line-height: 1.6;

        opacity: 0.85;
    }


    .argo-close-button {

        border: none;

        background: rgba(255, 255, 255, 0.12);

        color: white;

        width: 36px;

        height: 36px;

        border-radius: 50%;

        cursor: pointer;

        font-size: 18px;

        flex-shrink: 0;
    }


    .argo-close-button:hover {

        background: rgba(255, 255, 255, 0.25);
    }


    .argo-chart-card {

        background: rgba(255, 255, 255, 0.06);

        border-radius: 12px;

        padding: 15px;

        margin-bottom: 18px;
    }


    .argo-chart-card h3 {

        margin: 0 0 12px 0;

        font-size: 16px;

        font-weight: 600;
    }


    .argo-chart-wrapper {

        position: relative;

        width: 100%;

        height: 300px;
    }


    #argoProfilePanel canvas {

        width: 100% !important;

        height: 100% !important;
    }


    @media (max-width: 600px) {

        #argoProfilePanel {

            width: 94vw;

            padding: 14px;
        }


        .argo-chart-wrapper {

            height: 240px;
        }


        .argo-profile-header h2 {

            font-size: 18px;
        }

    }

`;

document.head.appendChild(argoProfileStyle);

// ============================================================
// VARIABLE CONTROL STYLES
// ============================================================

const variableControlStyle =
    document.createElement("style");

variableControlStyle.textContent = `

    #oceanVariableControl {

        width: min(900px, 92vw);

        margin: 0 auto 14px auto;

        padding: 14px 18px;

        box-sizing: border-box;

        background:
            rgba(15, 23, 42, 0.92);

        border-radius: 12px;

        display: flex;

        align-items: center;

        gap: 14px;

        flex-wrap: wrap;

        color: white;

        box-shadow:
            0 8px 25px rgba(0, 0, 0, 0.2);
    }


    .variable-control-title {

        font-weight: 700;

        font-size: 15px;
    }


    .variable-selector {

        min-width: 190px;

        padding: 9px 12px;

        border-radius: 8px;

        border: 1px solid
            rgba(255, 255, 255, 0.25);

        background:
            rgba(255, 255, 255, 0.1);

        color: white;

        font-size: 14px;

        cursor: pointer;
    }


    .variable-selector option {

        background: #0f172a;

        color: white;
    }


    .variable-description {

        font-size: 13px;

        opacity: 0.75;
    }


    @media (max-width: 600px) {

        #oceanVariableControl {

            flex-direction: column;

            align-items: stretch;
        }


        .variable-selector {

            width: 100%;
        }

    }

`;

document.head.appendChild(
    variableControlStyle
);
// ============================================================
// COLORBAR STYLES
// ============================================================

const colorbarStyle =
    document.createElement("style");

colorbarStyle.textContent = `

    #oceanColorbar {

        position: fixed;

        right: 25px;

        bottom: 25px;

        width: 230px;

        padding: 12px 14px;

        background:
            rgba(15, 23, 42, 0.92);

        color: white;

        border-radius: 10px;

        z-index: 9998;

        box-shadow:
            0 8px 25px
            rgba(0, 0, 0, 0.35);

        backdrop-filter: blur(8px);

        font-family:
            Arial,
            sans-serif;
    }


    .colorbar-title {

        font-size: 13px;

        font-weight: 700;

        margin-bottom: 8px;

        text-align: center;
    }


    .colorbar-gradient {

        width: 100%;

        height: 16px;

        border-radius: 5px;

        border: 1px solid
            rgba(255,255,255,0.25);
    }


    .colorbar-labels {

        display: flex;

        justify-content:
            space-between;

        margin-top: 5px;

        font-size: 11px;

        opacity: 0.85;
    }


    @media (max-width: 600px) {

        #oceanColorbar {

            right: 10px;

            bottom: 10px;

            width: 190px;
        }

    }

`;

document.head.appendChild(
    colorbarStyle
);
// ============================================================
// 🚨 FORCE DISASTER RISK DASHBOARD UPDATE
// ============================================================

function forceRiskDashboardUpdate() {

    console.log(
        "🚨 FORCE RISK UPDATE",
        "Ocean data:",
        oceanData ? oceanData.length : 0
    );

    // --------------------------------------------------------
    // Check whether real ocean data exists
    // --------------------------------------------------------

    if (
        typeof oceanData === "undefined" ||
        !Array.isArray(oceanData) ||
        oceanData.length === 0
    ) {
        console.log(
            "⏳ Risk dashboard waiting for oceanData..."
        );

        return;
    }


    // --------------------------------------------------------
    // Find dashboard elements
    // --------------------------------------------------------

    const overallRisk =
        document.getElementById(
            "overallRisk"
        );

    const riskSummary =
        document.getElementById(
            "riskSummary"
        );

    const riskObservationCount =
        document.getElementById(
            "riskObservationCount"
        );

    const temperatureRisk =
        document.getElementById(
            "temperatureRisk"
        );

    const temperatureRiskDetails =
        document.getElementById(
            "temperatureRiskDetails"
        );

    const salinityRisk =
        document.getElementById(
            "salinityRisk"
        );

    const salinityRiskDetails =
        document.getElementById(
            "salinityRiskDetails"
        );

    const depthRisk =
        document.getElementById(
            "depthRisk"
        );

    const depthRiskDetails =
        document.getElementById(
            "depthRiskDetails"
        );


    console.log(
        "🔎 Risk HTML elements:",
        {
            overallRisk: !!overallRisk,
            riskSummary: !!riskSummary,
            riskObservationCount: !!riskObservationCount,
            temperatureRisk: !!temperatureRisk,
            temperatureRiskDetails: !!temperatureRiskDetails,
            salinityRisk: !!salinityRisk,
            salinityRiskDetails: !!salinityRiskDetails,
            depthRisk: !!depthRisk,
            depthRiskDetails: !!depthRiskDetails
        }
    );


    // --------------------------------------------------------
    // Read REAL data
    // --------------------------------------------------------

    const temperatures =
        oceanData
            .map(
                item =>
                    Number(
                        item.temperature
                    )
            )
            .filter(
                Number.isFinite
            );


    const salinities =
        oceanData
            .map(
                item =>
                    Number(
                        item.salinity
                    )
            )
            .filter(
                Number.isFinite
            );


    const depths =
        oceanData
            .map(
                item =>
                    Number(
                        item.depth
                    )
            )
            .filter(
                Number.isFinite
            );


    console.log(
        "🌡 Real temperatures:",
        temperatures.length
    );

    console.log(
        "🧂 Real salinities:",
        salinities.length
    );

    console.log(
        "🌊 Real depths:",
        depths.length
    );


    // --------------------------------------------------------
    // TEMPERATURE
    // --------------------------------------------------------

    const minTemperature =
        temperatures.length > 0
        ?
        Math.min(
            ...temperatures
        )
        :
        null;


    const maxTemperature =
        temperatures.length > 0
        ?
        Math.max(
            ...temperatures
        )
        :
        null;


    const averageTemperature =
        temperatures.length > 0
        ?
        temperatures.reduce(
            (a, b) => a + b,
            0
        ) / temperatures.length
        :
        null;


    let temperatureLevel =
        "normal";

    let temperatureRiskCount =
        0;


    temperatures.forEach(
        value => {

            if (
                value >= 28 ||
                value <= 0
            ) {

                temperatureLevel =
                    "critical";

                temperatureRiskCount++;
            }

            else if (
                value >= 26 ||
                value <= 5
            ) {

                if (
                    temperatureLevel !==
                    "critical"
                ) {

                    temperatureLevel =
                        "high";
                }

                temperatureRiskCount++;
            }

            else if (
                value >= 24 ||
                value <= 8
            ) {

                if (
                    temperatureLevel !==
                    "critical" &&
                    temperatureLevel !==
                    "high"
                ) {

                    temperatureLevel =
                        "moderate";
                }

                temperatureRiskCount++;
            }
        }
    );


    // --------------------------------------------------------
    // SALINITY
    // --------------------------------------------------------

    const minSalinity =
        salinities.length > 0
        ?
        Math.min(
            ...salinities
        )
        :
        null;


    const maxSalinity =
        salinities.length > 0
        ?
        Math.max(
            ...salinities
        )
        :
        null;


    const averageSalinity =
        salinities.length > 0
        ?
        salinities.reduce(
            (a, b) => a + b,
            0
        ) / salinities.length
        :
        null;


    let salinityLevel =
        "normal";

    let salinityRiskCount =
        0;


    salinities.forEach(
        value => {

            if (
                value < 28 ||
                value > 38
            ) {

                salinityLevel =
                    "critical";

                salinityRiskCount++;
            }

            else if (
                value < 30 ||
                value > 37
            ) {

                if (
                    salinityLevel !==
                    "critical"
                ) {

                    salinityLevel =
                        "high";
                }

                salinityRiskCount++;
            }

            else if (
                value < 31 ||
                value > 36
            ) {

                if (
                    salinityLevel !==
                    "critical" &&
                    salinityLevel !==
                    "high"
                ) {

                    salinityLevel =
                        "moderate";
                }

                salinityRiskCount++;
            }
        }
    );


    // --------------------------------------------------------
    // DEPTH
    // --------------------------------------------------------

    const maximumDepth =
        depths.length > 0
        ?
        Math.max(
            ...depths
        )
        :
        null;


    let depthLevel =
        "normal";

    let depthRiskCount =
        0;


    depths.forEach(
        value => {

            if (
                value > 5000
            ) {

                depthLevel =
                    "critical";

                depthRiskCount++;
            }

            else if (
                value > 4000
            ) {

                if (
                    depthLevel !==
                    "critical"
                ) {

                    depthLevel =
                        "high";
                }

                depthRiskCount++;
            }

            else if (
                value > 2000
            ) {

                if (
                    depthLevel !==
                    "critical" &&
                    depthLevel !==
                    "high"
                ) {

                    depthLevel =
                        "moderate";
                }

                depthRiskCount++;
            }
        }
    );


    // --------------------------------------------------------
    // OVERALL RISK
    // --------------------------------------------------------

    const score = {

        normal: 0,

        moderate: 1,

        high: 2,

        critical: 3
    };


    let overallLevel =
        "normal";


    [
        temperatureLevel,
        salinityLevel,
        depthLevel
    ].forEach(
        level => {

            if (
                score[level] >
                score[overallLevel]
            ) {

                overallLevel =
                    level;
            }
        }
    );


    const riskCount =
        temperatureRiskCount +
        salinityRiskCount +
        depthRiskCount;


    // --------------------------------------------------------
    // TEXT
    // --------------------------------------------------------

    const overallText = {

        normal:
            "🟢 NORMAL",

        moderate:
            "🟡 MODERATE",

        high:
            "🟠 HIGH",

        critical:
            "🔴 CRITICAL"
    };


    const conditionText = {

        normal:
            "🟢 Normal",

        moderate:
            "🟡 Moderate",

        high:
            "🟠 High",

        critical:
            "🔴 Critical"
    };


    // --------------------------------------------------------
    // UPDATE OVERALL RISK
    // --------------------------------------------------------

    if (overallRisk) {

        overallRisk.textContent =
            overallText[
                overallLevel
            ];

        overallRisk.className =
            `risk-level ${overallLevel}`;

        overallRisk.style.color =
            overallLevel === "normal"
            ?
            "#22c55e"
            :
            overallLevel === "moderate"
            ?
            "#eab308"
            :
            overallLevel === "high"
            ?
            "#f97316"
            :
            "#ef4444";
    }


    // --------------------------------------------------------
    // UPDATE RISK COUNT
    // --------------------------------------------------------

    if (riskObservationCount) {

        riskObservationCount.textContent =
            riskCount.toLocaleString();
    }


    // --------------------------------------------------------
    // UPDATE SUMMARY
    // --------------------------------------------------------

    if (riskSummary) {

        if (
            overallLevel ===
            "normal"
        ) {

            riskSummary.textContent =
                `Ocean conditions are currently normal across ${oceanData.length.toLocaleString()} observations.`;
        }

        else {

            riskSummary.textContent =
                `${riskCount.toLocaleString()} observations require attention based on the prototype risk thresholds.`;
        }
    }


    // --------------------------------------------------------
    // TEMPERATURE DISPLAY
    // --------------------------------------------------------

    if (temperatureRisk) {

        temperatureRisk.textContent =
            conditionText[
                temperatureLevel
            ];

        temperatureRisk.className =
            `condition-${temperatureLevel}`;
    }


    if (temperatureRiskDetails) {

        if (
            temperatures.length > 0
        ) {

            temperatureRiskDetails.textContent =
                `Observed range: ${minTemperature.toFixed(2)} °C to ${maxTemperature.toFixed(2)} °C | Average: ${averageTemperature.toFixed(2)} °C | ${temperatureRiskCount.toLocaleString()} observations outside the prototype normal range.`;
        }

        else {

            temperatureRiskDetails.textContent =
                "Temperature data unavailable.";
        }
    }


    // --------------------------------------------------------
    // SALINITY DISPLAY
    // --------------------------------------------------------

    if (salinityRisk) {

        salinityRisk.textContent =
            conditionText[
                salinityLevel
            ];

        salinityRisk.className =
            `condition-${salinityLevel}`;
    }


    if (salinityRiskDetails) {

        if (
            salinities.length > 0
        ) {

            salinityRiskDetails.textContent =
                `Observed range: ${minSalinity.toFixed(2)} to ${maxSalinity.toFixed(2)} PSU | Average: ${averageSalinity.toFixed(2)} PSU | ${salinityRiskCount.toLocaleString()} observations outside the prototype normal range.`;
        }

        else {

            salinityRiskDetails.textContent =
                "Salinity data unavailable.";
        }
    }


    // --------------------------------------------------------
    // DEPTH DISPLAY
    // --------------------------------------------------------

    if (depthRisk) {

        depthRisk.textContent =
            conditionText[
                depthLevel
            ];

        depthRisk.className =
            `condition-${depthLevel}`;
    }


    if (depthRiskDetails) {

        if (
            depths.length > 0
        ) {

            depthRiskDetails.textContent =
                `Maximum observed depth: ${maximumDepth.toFixed(2)} m | ${depthRiskCount.toLocaleString()} observations outside the prototype depth range.`;
        }

        else {

            depthRiskDetails.textContent =
                "Depth data unavailable.";
        }
    }


    console.log(
        "✅ RISK DASHBOARD UPDATED:",
        {
            totalPoints:
                oceanData.length,

            overall:
                overallLevel,

            temperature:
                temperatureLevel,

            salinity:
                salinityLevel,

            depth:
                depthLevel,

            riskObservations:
                riskCount,

            averageTemperature,

            averageSalinity,

            maximumDepth
        }
    );
}


// ============================================================
// AUTOMATIC RISK DASHBOARD WATCHER
// ============================================================

// Run after page is ready
document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "🚨 Risk watcher started"
        );

        setTimeout(
            forceRiskDashboardUpdate,
            1000
        );

        setTimeout(
            forceRiskDashboardUpdate,
            3000
        );

        setTimeout(
            forceRiskDashboardUpdate,
            5000
        );
    }
);


// Keep checking because oceanData is loaded asynchronously
setInterval(
    () => {

        if (
            typeof oceanData !==
            "undefined" &&
            Array.isArray(oceanData) &&
            oceanData.length > 0
        ) {

            forceRiskDashboardUpdate();
        }

    },
    2000
);