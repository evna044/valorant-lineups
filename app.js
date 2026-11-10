let agents = [];
let maps = [];

let selectedAgent = null;
let selectedMap = null;
let activeRole = "Tous";

const agentGrid = document.getElementById("agentGrid");
const mapOptions = document.getElementById("mapOptions");
const mapTrigger = document.getElementById("mapTrigger");
const mapMenu = document.getElementById("mapMenu");
const validateButton = document.getElementById("validateButton");

const roleNames = {
    Duelist: "Duelliste",
    Duelliste: "Duelliste",
    Initiator: "Initiateur",
    Initiateur: "Initiateur",
    Controller: "Contrôleur",
    Contrôleur: "Contrôleur",
    Sentinel: "Sentinelle",
    Sentinelle: "Sentinelle"
};

// CHARGEMENT DES DONNÉES

async function loadData() {
    try {
        const [agentsResponse, mapsResponse] = await Promise.all([
            fetch("./data/agents.json"),
            fetch("./data/maps.json")
        ]);

        if (!agentsResponse.ok || !mapsResponse.ok) {
            throw new Error("Impossible de charger les fichiers JSON locaux.");
        }

        const agentData = await agentsResponse.json();
        const mapData = await mapsResponse.json();

        agents = agentData.data
            .filter(agent => agent.isPlayableCharacter === true && agent.displayIcon)
            .sort((a, b) => a.displayName.localeCompare(b.displayName));

        maps = mapData.data
            .filter(map => STANDARD_MAPS.includes(map.displayName))
            .sort((a, b) => a.displayName.localeCompare(b.displayName));

        renderAgents();
        renderMaps();

        const countElem = document.getElementById("agentCount");
        if (countElem) countElem.textContent = `${agents.length} AGENTS`;

    } catch (error) {
        if (agentGrid) agentGrid.textContent = "Impossible de charger les agents.";
        if (mapOptions) mapOptions.textContent = "Impossible de charger les maps.";
        console.error("Erreur de chargement :", error);
    }
}

// AFFICHER LES AGENTS

function renderAgents() {
    if (!agentGrid) return;
    agentGrid.innerHTML = "";

    const visibleAgents = agents.filter(agent => {
        const role = roleNames[agent.role?.displayName] || "Autre";
        return activeRole === "Tous" || role === activeRole;
    });

    visibleAgents.forEach(agent => {
        const button = document.createElement("button");
        button.className = "agent-card";
        if (selectedAgent?.uuid === agent.uuid) {
            button.classList.add("selected");
        }
        button.type = "button";

        const image = document.createElement("img");
        image.className = "agent-portrait";
        image.src = agent.displayIcon || agent.fullPortrait;
        image.alt = agent.displayName;
        image.loading = "lazy";

        const infoDiv = document.createElement("div");
        infoDiv.className = "agent-info";

        const name = document.createElement("h3");
        name.textContent = agent.displayName.toUpperCase();

        const roleSpan = document.createElement("p");
        roleSpan.textContent = roleNames[agent.role?.displayName] || "Autre";

        infoDiv.append(name, roleSpan);
        button.append(image, infoDiv);

        button.addEventListener("click", () => {
            selectedAgent = agent;
            renderAgents();

            const infoElem = document.getElementById("agentInfo");
            if (infoElem) infoElem.textContent = `Agent sélectionné : ${agent.displayName}`;

            updateValidation();
        });

        agentGrid.appendChild(button);
    });
}

// AFFICHER LES MAPS

function renderMaps() {
    if (!mapOptions) return;
    mapOptions.innerHTML = "";

    maps.forEach(map => {
        const button = document.createElement("button");
        button.className = "map-card";
        button.type = "button";

        if (selectedMap?.uuid === map.uuid) {
            button.classList.add("selected");
        }

        const infoDiv = document.createElement("div");
        infoDiv.className = "map-info";
        const name = document.createElement("h3");
        name.textContent = map.displayName.toUpperCase();
        infoDiv.appendChild(name);

        button.appendChild(infoDiv);

        button.addEventListener("click", () => {
            selectedMap = map;

            if (mapTrigger) {
                mapTrigger.innerHTML = "";

                const content = document.createElement("span");
                content.id = "mapTriggerContent";
                content.textContent = `MAP : ${map.displayName.toUpperCase()}`;

                const arrow = document.createElement("span");
                arrow.className = "chevron";
                arrow.textContent = " ⌄";

                mapTrigger.append(content, arrow);
                mapTrigger.classList.add("has-map");
            }

            if (mapMenu) mapMenu.hidden = true;
            if (mapTrigger) mapTrigger.setAttribute("aria-expanded", "false");

            const mapInfoElem = document.getElementById("mapInfo");
            if (mapInfoElem) mapInfoElem.textContent = `Map sélectionnée : ${map.displayName}`;

            renderMaps();
            updateValidation();
        });

        mapOptions.appendChild(button);
    });
}

// OUVRIR ET FERMER LE MENU DES MAPS

if (mapTrigger) {
    mapTrigger.addEventListener("click", () => {
        if (!mapMenu) return;
        mapMenu.hidden = !mapMenu.hidden;
        mapTrigger.setAttribute("aria-expanded", String(!mapMenu.hidden));
    });
}

document.addEventListener("click", event => {
    if (!event.target.closest(".map-picker") && mapMenu && mapTrigger) {
        mapMenu.hidden = true;
        mapTrigger.setAttribute("aria-expanded", "false");
    }
});

// FILTRES DES AGENTS

const roleFiltersElem = document.getElementById("roleFilters");
if (roleFiltersElem) {
    roleFiltersElem.addEventListener("click", event => {
        const button = event.target.closest(".filter");
        if (!button) return;

        activeRole = button.dataset.role;

        document.querySelectorAll(".filter").forEach(filter => {
            filter.classList.toggle("active", filter === button);
        });

        renderAgents();
    });
}

// VÉRIFIER LA SÉLECTION

function updateValidation() {
    const ready = Boolean(selectedAgent && selectedMap);
    if (validateButton) validateButton.disabled = !ready;

    const valMsg = document.getElementById("validationMessage");
    if (valMsg) {
        valMsg.textContent = ready
            ? "Tu peux maintenant accéder à tes lineups."
            : "Sélectionne un agent et une map.";
    }
}

// VALIDER

if (validateButton) {
    validateButton.addEventListener("click", () => {
        if (!selectedAgent || !selectedMap) return;

        const selection = {
            agent: {
                name: selectedAgent.displayName,
                uuid: selectedAgent.uuid
            },
            map: {
                name: selectedMap.displayName,
                uuid: selectedMap.uuid
            }
        };

        sessionStorage.setItem("valorantSelection", JSON.stringify(selection));
        window.location.href = "lineups.html";
    });
}

// DÉMARRER
loadData();
