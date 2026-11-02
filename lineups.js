let editingLineupId = null;
const selectionData = sessionStorage.getItem("valorantSelection");

if (!selectionData) {
    window.location.href = "index.html";
} else {
    const selection = JSON.parse(selectionData);

    // Sélection actuelle
    document.getElementById("currentAgent").textContent = selection.agent.name;
    document.getElementById("currentMap").textContent = selection.map.name;

    // Variables
    let db;
    let allLineups = [];
    let activeCategories = [];
    let objectUrls = [];

    const form = document.getElementById("lineupForm");
    const container = document.getElementById("lineupsContainer");

    const imageInput = document.getElementById("lineupImage");
    const videoInput = document.getElementById("lineupVideo");

    // Affichage des noms des fichiers
    imageInput.addEventListener("change", () => {
        document.getElementById("imageFileName").textContent =
            imageInput.files[0]?.name || "Aucune image choisie";
    });

    videoInput.addEventListener("change", () => {
        document.getElementById("videoFileName").textContent =
            videoInput.files[0]?.name || "Aucune vidéo choisie";
    });

    // OUVERTURE DE LA BASE DE DONNÉES
    const request = indexedDB.open("ValorantLineups", 1);

    request.onupgradeneeded = event => {
        db = event.target.result;

        if (!db.objectStoreNames.contains("lineups")) {
            db.createObjectStore("lineups", {
                keyPath: "id",
                autoIncrement: true
            });
        }
    };

    request.onsuccess = event => {
        db = event.target.result;
        renderLineups();
    };

    request.onerror = () => {
        alert("Impossible d'ouvrir la base de données.");
    };

    // AJOUT ET MODIFICATION D'UNE LINEUP
    form.addEventListener("submit", event => {
        event.preventDefault();

        const title = document.getElementById("lineupTitle").value.trim();
        const description = document.getElementById("lineupDescription").value.trim();
        const category = document.getElementById("lineupCategory").value;

        if (!title) return;

        const existingLineup = allLineups.find(
            lineup => lineup.id === editingLineupId
        );

        const lineup = {
            id: editingLineupId || crypto.randomUUID(),
            agent: selection.agent.name,
            map: selection.map.name,
            title,
            description,
            category,
            image: imageInput.files[0] || existingLineup?.image || null,
            video: videoInput.files[0] || existingLineup?.video || null,
            createdAt: existingLineup?.createdAt || new Date().toISOString()
        };

        const transaction = db.transaction("lineups", "readwrite");

        transaction.objectStore("lineups").put(lineup);

        transaction.oncomplete = () => {
            editingLineupId = null;
            form.reset();

            document.getElementById("imageFileName").textContent =
                "Aucune image choisie";

            document.getElementById("videoFileName").textContent =
                "Aucune vidéo choisie";

            document.querySelector("#lineupForm button[type='submit']")
                .textContent = "ENREGISTRER LA LINEUP →";

            renderLineups();
        };

        transaction.onerror = () => {
            alert("Erreur lors de l'enregistrement de la lineup.");
        };
    });

    // AFFICHAGE DES LINEUPS
    function renderLineups() {
        if (!db) return;

        objectUrls.forEach(url => URL.revokeObjectURL(url));
        objectUrls = [];

        const transaction = db.transaction("lineups", "readonly");
        const request = transaction.objectStore("lineups").getAll();

        request.onsuccess = () => {
            allLineups = request.result;

            const filteredLineups = allLineups.filter(lineup => {
                const matchesSelection =
                    lineup.agent === selection.agent.name &&
                    lineup.map === selection.map.name;

                const matchesCategory =
                    activeCategories.length === 0 ||
                    activeCategories.includes(lineup.category);

                return matchesSelection && matchesCategory;
            });

            container.innerHTML = "";

            if (filteredLineups.length === 0) {
                container.textContent = "Aucune lineup pour cette sélection.";
                return;
            }

            filteredLineups.sort((a, b) =>
                new Date(b.createdAt) - new Date(a.createdAt)
            );

            filteredLineups.forEach(lineup => {
                const card = document.createElement("article");
                card.className = "lineup-card";

                const title = document.createElement("h3");
                title.textContent = lineup.title;

                const category = document.createElement("span");
                category.className = "lineup-category";
                category.textContent = lineup.category;

                card.append(title, category);

                if (lineup.description && lineup.description.trim() !== "") {
                    const description = document.createElement("p");
                    description.textContent = lineup.description;
                    card.appendChild(description);
                }

                // IMAGE
                if (lineup.image) {
                    const imageUrl = URL.createObjectURL(lineup.image);
                    objectUrls.push(imageUrl);

                    const image = document.createElement("img");
                    image.src = imageUrl;
                    image.alt = lineup.title;
                    image.className = "lineup-media";

                    image.addEventListener("click", () => {
                        openImageViewer(imageUrl);
                    });
                    image.addEventListener("contextmenu", event => {
                        event.preventDefault();
                        openImageViewer(imageUrl);
                    });

                    card.appendChild(image);
                }

                // VIDÉO
                if (lineup.video) {
                    const videoUrl = URL.createObjectURL(lineup.video);
                    objectUrls.push(videoUrl);

                    const video = document.createElement("video");
                    video.src = videoUrl;
                    video.controls = true;
                    video.className = "lineup-media";

                    card.appendChild(video);
                }
                // MODIFICATION
                const editButton = document.createElement("button");

                editButton.type = "button";
                editButton.className = "edit-button";
                editButton.textContent = "MODIFIER";

                editButton.addEventListener("click", () => {
                    editingLineupId = lineup.id;

                    document.getElementById("lineupTitle").value = lineup.title;
                    document.getElementById("lineupDescription").value =
                        lineup.description || "";

                    document.getElementById("lineupCategory").value =
                        lineup.category || "Autre";

                    imageInput.value = "";
                    videoInput.value = "";

                    document.getElementById("imageFileName").textContent =
                        lineup.image?.name || "Image déjà enregistrée";

                    document.getElementById("videoFileName").textContent =
                        lineup.video?.name || "Vidéo déjà enregistrée";

                    document.querySelector("#lineupForm button[type='submit']")
                        .textContent = "ENREGISTRER LES MODIFICATIONS →";

                    form.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });
                });

                card.appendChild(editButton);
                
                // SUPPRESSION
                const deleteButton = document.createElement("button");
                deleteButton.type = "button";
                deleteButton.className = "delete-button";
                deleteButton.textContent = "SUPPRIMER";

                deleteButton.addEventListener("click", () => {
                    if (!confirm("Supprimer cette lineup ?")) return;

                    const deleteTransaction =
                        db.transaction("lineups", "readwrite");

                    deleteTransaction.objectStore("lineups").delete(lineup.id);

                    deleteTransaction.oncomplete = () => {
                        renderLineups();
                    };
                });

                card.appendChild(deleteButton);
                container.appendChild(card);
            });
        };
    }

    // FILTRES PAR CATÉGORIE
    const categoryFilters = document.getElementById("categoryFilters");

    if (categoryFilters) {
        categoryFilters.addEventListener("click", event => {
            const button = event.target.closest(".category-filter");
            if (!button) return;

            const category = button.dataset.category;

            if (category === "Toutes") {
                activeCategories = [];
            } else {
                if (activeCategories.includes(category)) {
                    activeCategories = activeCategories.filter(
                        item => item !== category
                    );
                } else {
                    activeCategories.push(category);
                }
            }

            document.querySelectorAll(".category-filter").forEach(filter => {
                const filterCategory = filter.dataset.category;

                filter.classList.toggle(
                    "active",
                    filterCategory === "Toutes"
                        ? activeCategories.length === 0
                        : activeCategories.includes(filterCategory)
                );
            });

            renderLineups();
        });
    }

    // ZOOM SUR LES IMAGES
    function openImageViewer(src) {
        const viewer = document.createElement("div");
        viewer.className = "image-viewer";

        const image = document.createElement("img");
        image.src = src;
        image.alt = "Image agrandie";

        viewer.appendChild(image);
        document.body.appendChild(viewer);

        viewer.addEventListener("click", () => {
            viewer.remove();
        });

        const closeViewer = event => {
            if (event.key === "Escape") {
                viewer.remove();
                document.removeEventListener("keydown", closeViewer);
            }
        };

        document.addEventListener("keydown", closeViewer);

        viewer.addEventListener("click", () => {
            document.removeEventListener("keydown", closeViewer);
        });
    }

    // CONVERSION FILE EN BASE64
    function convertFileToBase64(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                resolve(null);
                return;
            }

            const reader = new FileReader();

            reader.onload = () => {
                resolve({
                    name: file.name,
                    type: file.type,
                    data: reader.result
                });
            };

            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // CONVERSION BASE64 EN FILE
    function convertBase64ToFile(fileData) {
        if (!fileData || !fileData.data || !fileData.name) {
            return null;
        }

        const parts = fileData.data.split(",");
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";

        const binary = atob(parts[1]);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        return new File([bytes], fileData.name, {
            type: fileData.type || mime
        });
    }

    // EXPORTER LES LINEUPS DE L'AGENT ET DE LA MAP ACTUELS
    document.getElementById("exportButton").addEventListener("click", () => {
        const transaction = db.transaction("lineups", "readonly");
        const request = transaction.objectStore("lineups").getAll();

        request.onsuccess = async () => {
            try {
                const selectedLineups = request.result.filter(lineup =>
                    lineup.agent === selection.agent.name &&
                    lineup.map === selection.map.name
                );

                const exported = await Promise.all(
                    selectedLineups.map(async lineup => ({
                        ...lineup,
                        image: await convertFileToBase64(lineup.image),
                        video: await convertFileToBase64(lineup.video)
                    }))
                );

                const blob = new Blob(
                    [JSON.stringify(exported, null, 2)],
                    { type: "application/json" }
                );

                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");

                link.href = url;
                link.download =
                    `lineups-${selection.agent.name}-${selection.map.name}.json`;

                link.click();
                URL.revokeObjectURL(url);
            } catch (error) {
                console.error(error);
                alert("Erreur lors de l'exportation.");
            }
        };
    });

    // IMPORTER UNIQUEMENT LES LINEUPS DE L'AGENT ET DE LA MAP ACTUELS
    document.getElementById("importInput").addEventListener("change", event => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = async () => {
            try {
                const imported = JSON.parse(reader.result);

                if (!Array.isArray(imported)) {
                    throw new Error("Format invalide");
                }

                const selectedLineups = imported.filter(lineup =>
                    lineup.agent === selection.agent.name &&
                    lineup.map === selection.map.name
                );

                const lineupsToImport = selectedLineups.map(lineup => ({
                    agent: selection.agent.name,
                    map: selection.map.name,
                    title: lineup.title,
                    description: lineup.description || "",
                    category: lineup.category || "Autre",
                    image: convertBase64ToFile(lineup.image),
                    video: convertBase64ToFile(lineup.video),
                    createdAt: lineup.createdAt || new Date().toISOString()
                }));

                const transaction = db.transaction("lineups", "readwrite");
                const store = transaction.objectStore("lineups");

                lineupsToImport.forEach(lineup => store.add(lineup));

                transaction.oncomplete = () => {
                    alert(`${lineupsToImport.length} lineup(s) importée(s).`);
                    renderLineups();
                    event.target.value = "";
                };

                transaction.onerror = () => {
                    alert("Erreur lors de l'importation.");
                };
            } catch (error) {
                console.error(error);
                alert("Fichier JSON invalide ou incompatible.");
                event.target.value = "";
            }
        };

        reader.readAsText(file);
    });
}
