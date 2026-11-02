const API = "https://valorant-api.com/v1";

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
    Initiator: "Initiateur",
    Controller: "Contrôleur",
    Sentinel: "Sentinelle"
};

// MAPS TDM À EXCLURE
const tdmMaps = [
    "District",
    "Kasbah",
    "Piazza",
    "Drift",
    "Glitch"
];

// CHARGEMENT DES DONNEES

async function loadData() {

    try {

        const [agentResponse, mapResponse] = await Promise.all([
            fetch(`${API}/agents?isPlayableCharacter=true`),
            fetch(`${API}/maps`)
        ]);

        if (!agentResponse.ok || !mapResponse.ok) {
            throw new Error("Erreur API");
        }

        const agentData = await agentResponse.json();
        const mapData = await mapResponse.json();

        agents = agentData.data
            .filter(agent =>
                agent.isPlayableCharacter &&
                agent.displayIcon
            )
            .sort((a, b) =>
                a.displayName.localeCompare(b.displayName)
            );

        maps = mapData.data
            .filter(map => {

                const name = map.displayName || "";
                const url = map.mapUrl || "";

                return (
                    map.displayIcon &&
                    map.splash &&
                    !tdmMaps.includes(name) &&
                    !/HURM|TeamDeathmatch/i.test(url)
                );

            })
            .sort((a, b) =>
                a.displayName.localeCompare(b.displayName)
            );

        renderAgents();
        renderMaps();

        document.getElementById("agentCount").textContent =
            `${agents.length} AGENTS`;

    } catch (error) {

        agentGrid.textContent = "Impossible de charger les agents.";
        mapOptions.textContent = "Impossible de charger les maps.";

        console.error(error);

    }

}

// AFFICHER LES AGENTS

function renderAgents() {

    agentGrid.innerHTML = "";

    const visibleAgents = agents.filter(agent => {

        const role =
            roleNames[agent.role?.displayName] || "Autre";

        return activeRole === "Tous" || role === activeRole;

    });

    visibleAgents.forEach(agent => {

        const button = document.createElement("button");

        button.className = "agent-option";

        if (selectedAgent?.uuid === agent.uuid) {
            button.classList.add("selected");
        }

        button.type = "button";

        const image = document.createElement("img");

        image.src = agent.fullPortrait || agent.displayIcon;
        image.alt = agent.displayName;
        image.loading = "lazy";

        const name = document.createElement("span");

        name.className = "agent-name";
        name.textContent = agent.displayName;

        button.append(image, name);

        button.addEventListener("click", () => {

            selectedAgent = agent;

            renderAgents();

            document.getElementById("agentInfo").textContent =
                `Agent sélectionné : ${agent.displayName}`;

            updateValidation();

        });

        agentGrid.appendChild(button);

    });

}

// AFFICHER LES MAPS

function renderMaps() {

    mapOptions.innerHTML = "";

    maps.forEach(map => {

        const button = document.createElement("button");

        button.className = "map-option";
        button.type = "button";

        if (selectedMap?.uuid === map.uuid) {
            button.classList.add("selected");
        }

        const image = document.createElement("img");

        image.src = map.splash;
        image.alt = map.displayName;

        const name = document.createElement("span");

        name.textContent = map.displayName.toUpperCase();

        button.append(image, name);

        button.addEventListener("click", () => {

            selectedMap = map;

            mapTrigger.innerHTML = "";

            const content = document.createElement("span");
            content.id = "mapTriggerContent";

            const selectedImage = document.createElement("img");
            selectedImage.src = map.splash;
            selectedImage.alt = map.displayName;

            const selectedName = document.createElement("span");
            selectedName.className = "map-trigger-name";
            selectedName.textContent = map.displayName.toUpperCase();

            content.append(selectedImage, selectedName);

            const arrow = document.createElement("span");
            arrow.className = "chevron";
            arrow.textContent = "⌄";

            mapTrigger.append(content, arrow);
            mapTrigger.classList.add("has-map");

            mapMenu.hidden = true;

            mapTrigger.setAttribute("aria-expanded", "false");

            document.getElementById("mapInfo").textContent =
                `Map sélectionnée : ${map.displayName}`;

            renderMaps();

            updateValidation();

        });

        mapOptions.appendChild(button);

    });

}

// OUVRIR LE MENU

mapTrigger.addEventListener("click", () => {

    mapMenu.hidden = !mapMenu.hidden;

    mapTrigger.setAttribute(
        "aria-expanded",
        String(!mapMenu.hidden)
    );

});

// FERMER LE MENU

document.addEventListener("click", event => {

    if (!event.target.closest(".map-picker")) {

        mapMenu.hidden = true;

        mapTrigger.setAttribute("aria-expanded", "false");

    }

});

// FILTRES DES AGENTS

document.getElementById("roleFilters")
    .addEventListener("click", event => {

        const button = event.target.closest(".filter");

        if (!button) return;

        activeRole = button.dataset.role;

        document.querySelectorAll(".filter").forEach(filter => {

            filter.classList.toggle(
                "active",
                filter === button
            );

        });

        renderAgents();

    });

// VERIFIER LA SELECTION

function updateValidation() {

    const ready = Boolean(selectedAgent && selectedMap);

    validateButton.disabled = !ready;

    document.getElementById("validationMessage").textContent =
        ready
            ? "Tu peux maintenant accéder à tes lineups."
            : "Sélectionne un agent et une map.";

}

// VALIDER

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

    sessionStorage.setItem(
        "valorantSelection",
        JSON.stringify(selection)
    );

    window.location.href = "lineups.html";

});

// DEMARRER

loadData();