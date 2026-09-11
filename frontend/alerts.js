// ============================================================
// 🚨 OCEAN DISASTER ALERTS
// COMPLETE UPDATED alerts.js
// ============================================================

const API_URL = "http://127.0.0.1:8000";

let allAlerts = [];
let filteredAlerts = [];


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeControls();

        loadAlerts();

    }
);


// ============================================================
// CONTROLS
// ============================================================

function initializeControls() {

    const searchInput =
        document.getElementById(
            "searchInput"
        );

    const riskFilter =
        document.getElementById(
            "riskFilter"
        );

    const resetButton =
        document.getElementById(
            "resetButton"
        );


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            applyFilters
        );

    }


    if (riskFilter) {

        riskFilter.addEventListener(
            "change",
            applyFilters
        );

    }


    if (resetButton) {

        resetButton.addEventListener(
            "click",
            resetFilters
        );

    }

}


// ============================================================
// LOAD DATA
// ============================================================

async function loadAlerts() {

    try {

        setMonitoringStatus(
            "Loading",
            "Loading ocean monitoring information..."
        );


        const response =
            await fetch(
                `${API_URL}/ocean-data`
            );


        if (!response.ok) {

            throw new Error(
                `Server returned ${response.status}`
            );

        }


        const data =
            await response.json();


        if (!Array.isArray(data)) {

            throw new Error(
                "Invalid ocean data received."
            );

        }


        allAlerts =
            generateAlerts(
                data
            );


        filteredAlerts =
            [...allAlerts];


        updateSummary(
            allAlerts
        );


        renderAlerts(
            filteredAlerts
        );


        updateLastUpdated();


        setMonitoringStatus(
            "Active",
            `${allAlerts.length} ocean observations require attention.`
        );


    }
    catch (error) {

        console.error(
            "Alert loading error:",
            error
        );


        setMonitoringStatus(
            "Error",
            "Unable to connect to the ocean monitoring server."
        );


        const container =
            document.getElementById(
                "alertsContainer"
            );


        if (container) {

            container.innerHTML = `

                <div class="empty-alerts">

                    <div class="empty-alerts-icon">
                        ⚠️
                    </div>

                    <h3>
                        Unable to Load Alerts
                    </h3>

                    <p>
                        Please make sure the FastAPI backend
                        is running and try again.
                    </p>

                </div>

            `;

        }

    }

}


// ============================================================
// GENERATE ALERTS
// ============================================================

function generateAlerts(
    data
) {

    const alerts = [];


    data.forEach(
        (item, index) => {

            const temperature =
                Number(
                    item.temperature
                );

            const salinity =
                Number(
                    item.salinity
                );

            const depth =
                Number(
                    item.depth
                );

            const latitude =
                Number(
                    item.latitude
                );

            const longitude =
                Number(
                    item.longitude
                );


            if (

                !Number.isFinite(
                    temperature
                ) ||

                !Number.isFinite(
                    salinity
                ) ||

                !Number.isFinite(
                    depth
                ) ||

                !Number.isFinite(
                    latitude
                ) ||

                !Number.isFinite(
                    longitude
                )

            ) {

                return;

            }


            let score =
                0;


            const conditions = [];


            // ------------------------------------------------
            // TEMPERATURE
            // ------------------------------------------------

            if (
                temperature < 0 ||
                temperature > 30
            ) {

                score += 3;

                conditions.push(
                    `Extreme temperature: ${temperature.toFixed(2)} °C`
                );

            }
            else if (
                temperature < 8 ||
                temperature > 28
            ) {

                score += 2;

                conditions.push(
                    `Unusual temperature: ${temperature.toFixed(2)} °C`
                );

            }
            else if (
                temperature < 10 ||
                temperature > 25
            ) {

                score += 1;

                conditions.push(
                    `Elevated temperature: ${temperature.toFixed(2)} °C`
                );

            }


            // ------------------------------------------------
            // SALINITY
            // ------------------------------------------------

            if (
                salinity < 28 ||
                salinity > 38
            ) {

                score += 3;

                conditions.push(
                    `Extreme salinity condition: ${salinity.toFixed(2)}`
                );

            }
            else if (
                salinity < 30 ||
                salinity > 37
            ) {

                score += 2;

                conditions.push(
                    `Elevated salinity condition: ${salinity.toFixed(2)}`
                );

            }
            else if (
                salinity < 31 ||
                salinity > 36
            ) {

                score += 1;

                conditions.push(
                    `Unusual salinity condition: ${salinity.toFixed(2)}`
                );

            }


            // ------------------------------------------------
            // DEPTH
            // ------------------------------------------------

            if (
                depth > 5000
            ) {

                score += 3;

                conditions.push(
                    `Very deep observation: ${depth.toFixed(2)} m`
                );

            }
            else if (
                depth > 4000
            ) {

                score += 2;

                conditions.push(
                    `Deep ocean observation: ${depth.toFixed(2)} m`
                );

            }
            else if (
                depth > 2000
            ) {

                score += 1;

                conditions.push(
                    `Deep ocean observation: ${depth.toFixed(2)} m`
                );

            }


            // ------------------------------------------------
            // SEVERITY
            // ------------------------------------------------

            let severity =
                "normal";


            if (
                score >= 6
            ) {

                severity =
                    "critical";

            }
            else if (
                score >= 4
            ) {

                severity =
                    "high";

            }
            else if (
                score >= 2
            ) {

                severity =
                    "moderate";

            }


            if (
                severity !==
                "normal"
            ) {

                alerts.push({

                    id:
                        index,

                    latitude,

                    longitude,

                    temperature,

                    salinity,

                    depth,

                    score,

                    severity,

                    conditions

                });

            }

        }
    );


    // --------------------------------------------------------
    // SORT BY SEVERITY THEN SCORE
    // --------------------------------------------------------

    const order = {

        critical: 4,

        high: 3,

        moderate: 2

    };


    alerts.sort(
        (a, b) => {

            if (
                order[b.severity] !==
                order[a.severity]
            ) {

                return (
                    order[b.severity] -
                    order[a.severity]
                );

            }


            return (
                b.score -
                a.score
            );

        }
    );


    return alerts;

}


// ============================================================
// SUMMARY
// ============================================================

function updateSummary(
    alerts
) {

    const critical =
        alerts.filter(
            alert =>
                alert.severity ===
                "critical"
        ).length;


    const high =
        alerts.filter(
            alert =>
                alert.severity ===
                "high"
        ).length;


    const moderate =
        alerts.filter(
            alert =>
                alert.severity ===
                "moderate"
        ).length;


    setText(
        "totalAlerts",
        alerts.length
    );


    setText(
        "criticalAlerts",
        critical
    );


    setText(
        "highAlerts",
        high
    );


    setText(
        "moderateAlerts",
        moderate
    );

}


// ============================================================
// FILTER
// ============================================================

function applyFilters() {

    const searchInput =
        document.getElementById(
            "searchInput"
        );


    const riskFilter =
        document.getElementById(
            "riskFilter"
        );


    const search =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";


    const risk =
        riskFilter
            ? riskFilter.value
            : "all";


    filteredAlerts =
        allAlerts.filter(
            alert => {

                const locationText =
                    `${alert.latitude} ${alert.longitude}`
                        .toLowerCase();


                const matchesSearch =
                    search === "" ||
                    locationText.includes(
                        search
                    );


                const matchesRisk =
                    risk === "all" ||
                    alert.severity ===
                    risk;


                return (
                    matchesSearch &&
                    matchesRisk
                );

            }
        );


    renderAlerts(
        filteredAlerts
    );

}


// ============================================================
// RESET
// ============================================================

function resetFilters() {

    const searchInput =
        document.getElementById(
            "searchInput"
        );


    const riskFilter =
        document.getElementById(
            "riskFilter"
        );


    if (searchInput) {

        searchInput.value =
            "";

    }


    if (riskFilter) {

        riskFilter.value =
            "all";

    }


    filteredAlerts =
        [...allAlerts];


    renderAlerts(
        filteredAlerts
    );

}


// ============================================================
// RENDER ALERTS
// ============================================================

function renderAlerts(
    alerts
) {

    const container =
        document.getElementById(
            "alertsContainer"
        );


    const showingText =
        document.getElementById(
            "showingText"
        );


    const countBadge =
        document.getElementById(
            "alertCountBadge"
        );


    if (!container) {
        return;
    }


    if (showingText) {

        showingText.textContent =
            `Showing ${alerts.length} alerts`;

    }


    if (countBadge) {

        countBadge.textContent =
            `${alerts.length} Alerts`;

    }


    if (
        alerts.length ===
        0
    ) {

        container.innerHTML = `

            <div class="empty-alerts">

                <div class="empty-alerts-icon">
                    🟢
                </div>

                <h3>
                    No Alerts Found
                </h3>

                <p>
                    No ocean observations match
                    the selected filters.
                </p>

            </div>

        `;

        return;

    }


    container.innerHTML =
        alerts.map(
            (alert, index) =>
                createAlertCard(
                    alert,
                    index
                )
        ).join("");


    addAlertActions();

}


// ============================================================
// ALERT CARD
// ============================================================

function createAlertCard(
    alert,
    index
) {

    const riskText =
        alert.severity
            .toUpperCase();


    const riskIcon =
        alert.severity ===
        "critical"
            ? "🔴"
            : alert.severity ===
              "high"
                ? "🟠"
                : "🟡";


    const conditionsHTML =
        alert.conditions
            .map(
                condition =>
                    `<li>${escapeHTML(condition)}</li>`
            )
            .join("");


    return `

        <article
            class="
                alert-card
                ${alert.severity}
            "
        >

            <div class="alert-card-header">

                <div
                    class="
                        risk-badge
                        ${alert.severity}
                    "
                >

                    ${riskIcon}

                    ${riskText}
                    RISK

                </div>


                <div class="risk-score">

                    Risk Score:

                    <strong>
                        ${alert.score}
                    </strong>

                </div>

            </div>


            <h3>
                Ocean Observation Alert
            </h3>


            <div class="alert-location">

                📍

                <span>

                    ${alert.latitude.toFixed(4)}°,

                    ${alert.longitude.toFixed(4)}°

                </span>

            </div>


            <div class="observation-grid">

                <div class="observation-item">

                    <span>
                        🌡️ Temperature
                    </span>

                    <strong>
                        ${alert.temperature.toFixed(2)} °C
                    </strong>

                </div>


                <div class="observation-item">

                    <span>
                        🧂 Salinity
                    </span>

                    <strong>
                        ${alert.salinity.toFixed(2)}
                    </strong>

                </div>


                <div class="observation-item">

                    <span>
                        🌊 Depth
                    </span>

                    <strong>
                        ${alert.depth.toFixed(2)} m
                    </strong>

                </div>

            </div>


            <div class="conditions">

                <div class="conditions-title">

                    ⚠️ Detected Conditions

                </div>


                <ul>

                    ${conditionsHTML}

                </ul>

            </div>


            <div class="alert-actions">

                <button
                    type="button"
                    class="
                        alert-action
                        map-button
                    "
                    data-lat="${alert.latitude}"
                    data-lng="${alert.longitude}"
                    data-temp="${alert.temperature}"
                    data-salinity="${alert.salinity}"
                    data-depth="${alert.depth}"
                    data-score="${alert.score}"
                    data-severity="${alert.severity}"
                    data-target="map"
                >

                    🗺️ View on Map

                </button>


                <button
                    type="button"
                    class="
                        alert-action
                        globe-button
                    "
                    data-lat="${alert.latitude}"
                    data-lng="${alert.longitude}"
                    data-temp="${alert.temperature}"
                    data-salinity="${alert.salinity}"
                    data-depth="${alert.depth}"
                    data-score="${alert.score}"
                    data-severity="${alert.severity}"
                    data-target="globe"
                >

                    🌍 View on Globe

                </button>

            </div>

        </article>

    `;

}


// ============================================================
// ACTION BUTTONS
// ============================================================

function addAlertActions() {

    const buttons =
        document.querySelectorAll(
            ".alert-action"
        );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const latitude =
                        Number(
                            button.dataset.lat
                        );

                    const longitude =
                        Number(
                            button.dataset.lng
                        );

                    const temperature =
                        Number(
                            button.dataset.temp
                        );

                    const salinity =
                        Number(
                            button.dataset.salinity
                        );

                    const depth =
                        Number(
                            button.dataset.depth
                        );

                    const score =
                        Number(
                            button.dataset.score
                        );

                    const severity =
                        button.dataset.severity;

                    const target =
                        button.dataset.target;


                    // ----------------------------------------
                    // VALIDATE COORDINATES
                    // ----------------------------------------

                    if (
                        !Number.isFinite(
                            latitude
                        ) ||
                        !Number.isFinite(
                            longitude
                        )
                    ) {

                        console.error(
                            "❌ Invalid alert coordinates:",
                            {
                                latitude,
                                longitude
                            }
                        );

                        alert(
                            "Unable to locate this ocean alert."
                        );

                        return;

                    }


                    // ----------------------------------------
                    // SAVE COMPLETE SELECTED ALERT
                    // ----------------------------------------

                    const selectedAlert = {

                        latitude:
                            latitude,

                        longitude:
                            longitude,

                        temperature:
                            Number.isFinite(
                                temperature
                            )
                                ? temperature
                                : null,

                        salinity:
                            Number.isFinite(
                                salinity
                            )
                                ? salinity
                                : null,

                        depth:
                            Number.isFinite(
                                depth
                            )
                                ? depth
                                : null,

                        score:
                            Number.isFinite(
                                score
                            )
                                ? score
                                : null,

                        severity:
                            severity || null

                    };


                    localStorage.setItem(
                        "selectedOceanAlert",
                        JSON.stringify(
                            selectedAlert
                        )
                    );


                    // ------------------------------------------------
                    // ALSO STORE LEGACY COORDINATES
                    // This keeps compatibility with older script.js
                    // ------------------------------------------------

                    localStorage.setItem(
                        "selectedOceanLatitude",
                        String(
                            latitude
                        )
                    );


                    localStorage.setItem(
                        "selectedOceanLongitude",
                        String(
                            longitude
                        )
                    );


                    console.log(
                        "📍 Ocean alert selected:",
                        selectedAlert
                    );


                    // ----------------------------------------
                    // NAVIGATE
                    // ----------------------------------------

                    if (
                        target ===
                        "map"
                    ) {

                        window.location.href =
                            "index.html#map";

                    }
                    else {

                        window.location.href =
                            "index.html#globeContainer";

                    }

                }
            );

        }
    );

}


// ============================================================
// MONITORING STATUS
// ============================================================

function setMonitoringStatus(
    status,
    message
) {

    const statusElement =
        document.getElementById(
            "monitoringStatus"
        );


    const messageElement =
        document.getElementById(
            "monitoringMessage"
        );


    if (messageElement) {

        messageElement.textContent =
            message;

    }


    if (!statusElement) {
        return;
    }


    if (
        status ===
        "Active"
    ) {

        statusElement.textContent =
            "● ACTIVE";

        statusElement.style.color =
            "#4ade80";

    }
    else if (
        status ===
        "Error"
    ) {

        statusElement.textContent =
            "● OFFLINE";

        statusElement.style.color =
            "#f87171";

    }
    else {

        statusElement.textContent =
            "● LOADING";

        statusElement.style.color =
            "#facc15";

    }

}


// ============================================================
// LAST UPDATED
// ============================================================

function updateLastUpdated() {

    const now =
        new Date();


    const formatted =
        now.toLocaleString();


    setText(
        "lastUpdated",
        `Last updated: ${formatted}`
    );


    setText(
        "lastUpdatedBadge",
        "● Monitoring Active"
    );

}


// ============================================================
// TEXT HELPER
// ============================================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;

    }

}


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHTML(
    value
) {

    return String(
        value
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}


// ============================================================
// CONSOLE
// ============================================================

console.log(
    "🚨 Ocean Disaster Alerts loaded successfully."
);