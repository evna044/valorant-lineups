
let editingLineupId = null;

const selectionData = sessionStorage.getItem("valorantSelection");

if (!selectionData) {
    window.location.href = "index.html";
} else {
    const selection = JSON.parse(selectionData);
    const supabaseClient = window.supabaseClient;

    if (!supabaseClient) {
        alert("Erreur : Supabase n'est pas correctement connecté.");
        throw new Error("Supabase client introuvable");
    }

    document.getElementById("currentAgent").textContent =
        selection.agent.name;

    document.getElementById("currentMap").textContent =
        selection.map.name;

    const form = document.getElementById("lineupForm");
    const container = document.getElementById("lineupsContainer");

    const imageInput = document.getElementById("lineupImage");
    const videoInput = document.getElementById("lineupVideo");

    const exportButton = document.getElementById("exportButton");
    const importInput = document.getElementById("importInput");
    const categoryFilters = document.getElementById("categoryFilters");

    let allLineups = [];
    let activeCategories = [];
    let isAdmin = false;

    // --------------------------------------------------
    // INTERFACE DE CONNEXION
    // --------------------------------------------------

    const loginPanel = document.createElement("section");
    loginPanel.className = "admin-login";
    loginPanel.innerHTML = `
        <h2>ESPACE ADMINISTRATEUR</h2>
        <p id="authStatus">Connecte-toi pour gérer les lineups.</p>

        <form id="loginForm">
            <input
                type="email"
                id="adminEmail"
                placeholder="Adresse e-mail"
                required
            >

            <input
                type="password"
                id="adminPassword"
                placeholder="Mot de passe"
                required
            >

            <button type="submit">SE CONNECTER</button>
        </form>

        <button type="button" id="logoutButton" hidden>
            SE DÉCONNECTER
        </button>
    `;

    form.parentElement.insertBefore(loginPanel, form);

    const loginForm = document.getElementById("loginForm");
    const logoutButton = document.getElementById("logoutButton");
    const authStatus = document.getElementById("authStatus");

    // Les visiteurs ne voient pas le formulaire d'ajout.
    form.hidden = true;

    // --------------------------------------------------
    // VÉRIFICATION DES DROITS ADMINISTRATEUR
    // --------------------------------------------------

    async function checkAdmin(session = null) {
    let user = session?.user || null;

    isAdmin = false;

    if (user) {
        const { data, error } = await supabaseClient.rpc("is_admin");

        if (error) {
            console.error("Erreur de vérification admin :", error);
        } else {
            isAdmin = data === true;
        }
    }

    loginForm.hidden = !!user;
    logoutButton.hidden = !user;

    if (!user) {
        authStatus.textContent = "Connecte-toi pour gérer les lineups.";
    } else if (isAdmin) {
        authStatus.textContent = "Connecté en tant qu'administrateur.";
    } else {
        authStatus.textContent =
            "Compte connecté : accès administrateur non autorisé.";
    }

    form.hidden = !isAdmin;

    if (importInput) {
        const importContainer =
            importInput.closest("label") || importInput.parentElement;

        if (importContainer) {
            importContainer.hidden = !isAdmin;
        }
    }

    renderLineups();
}
    // Connexion avec e-mail et mot de passe
    loginForm.addEventListener("submit", async event => {
        event.preventDefault();

        const email = document.getElementById("adminEmail").value.trim();
        const password =
            document.getElementById("adminPassword").value;

        authStatus.textContent = "Connexion en cours...";

        const { error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            authStatus.textContent = "Connexion impossible : " + error.message;
            return;
        }

        await checkAdmin();

        if (!isAdmin) {
    authStatus.textContent =
        "Connexion réussie, mais vérification des droits impossible. Réessaie dans un instant.";

    return;
}
    });

    // Déconnexion
    logoutButton.addEventListener("click", async () => {
        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            alert("Erreur lors de la déconnexion.");
            return;
        }

        editingLineupId = null;
        form.reset();

        await checkAdmin();
    });

    // Mise à jour lors d'un changement de session
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT") {
        setTimeout(() => checkAdmin(session), 0);
    }
});

    // --------------------------------------------------
    // AFFICHAGE DES NOMS DES FICHIERS
    // --------------------------------------------------

    imageInput.addEventListener("change", () => {
        document.getElementById("imageFileName").textContent =
            imageInput.files[0]?.name || "Aucune image choisie";
    });

    videoInput.addEventListener("change", () => {
        document.getElementById("videoFileName").textContent =
            videoInput.files[0]?.name || "Aucune vidéo choisie";
    });

    // --------------------------------------------------
    // STOCKAGE DES IMAGES ET VIDÉOS
    // --------------------------------------------------

    function safeFileName(name) {
        return name.replace(/[^a-zA-Z0-9._-]/g, "_");
    }

    async function uploadMedia(file, folder) {
        if (!file) return null;

        const path =
            `${folder}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

        const { error } = await supabaseClient.storage
            .from("lineup-media")
            .upload(path, file, {
                upsert: false
            });

        if (error) {
            throw error;
        }

        const { data } = supabaseClient.storage
            .from("lineup-media")
            .getPublicUrl(path);

        return data.publicUrl;
    }

    async function deleteMedia(url) {
        if (!url) return;

        const marker = "/storage/v1/object/public/lineup-media/";

        const index = url.indexOf(marker);

        if (index === -1) return;

        const path = decodeURIComponent(
            url.substring(index + marker.length)
        );

        const { error } = await supabaseClient.storage
            .from("lineup-media")
            .remove([path]);

        if (error) {
            console.error("Impossible de supprimer le média :", error);
        }
    }

    // --------------------------------------------------
    // AJOUT ET MODIFICATION
    // --------------------------------------------------

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (!isAdmin) {
            alert("Tu dois être administrateur.");
            return;
        }

        const title =
            document.getElementById("lineupTitle").value.trim();

        const description =
            document.getElementById("lineupDescription").value.trim();

        const category =
            document.getElementById("lineupCategory").value;

        if (!title) return;

        const submitButton =
            form.querySelector("button[type='submit']");

        submitButton.disabled = true;

        try {
            const existingLineup = allLineups.find(
                lineup => lineup.id === editingLineupId
            );

            let imageUrl = existingLineup?.image_url || null;
            let videoUrl = existingLineup?.video_url || null;

            // Envoyer une nouvelle image si elle a été choisie
            if (imageInput.files[0]) {
                const oldImageUrl = imageUrl;

                imageUrl = await uploadMedia(
                    imageInput.files[0],
                    "images"
                );

                if (oldImageUrl) {
                    await deleteMedia(oldImageUrl);
                }
            }

            // Envoyer une nouvelle vidéo si elle a été choisie
            if (videoInput.files[0]) {
                const oldVideoUrl = videoUrl;

                videoUrl = await uploadMedia(
                    videoInput.files[0],
                    "videos"
                );

                if (oldVideoUrl) {
                    await deleteMedia(oldVideoUrl);
                }
            }

            const lineup = {
                agent: selection.agent.name,
                map: selection.map.name,
                title,
                description,
                category,
                image_url: imageUrl,
                video_url: videoUrl
            };

            let result;

            if (editingLineupId) {
                result = await supabaseClient
                    .from("lineups")
                    .update(lineup)
                    .eq("id", editingLineupId);
            } else {
                result = await supabaseClient
                    .from("lineups")
                    .insert([lineup]);
            }

            if (result.error) throw result.error;

            editingLineupId = null;
            form.reset();

            document.getElementById("imageFileName").textContent =
                "Aucune image choisie";

            document.getElementById("videoFileName").textContent =
                "Aucune vidéo choisie";

            submitButton.textContent = "ENREGISTRER LA LINEUP →";

            await renderLineups();

        } catch (error) {
            console.error(error);
            alert("Erreur lors de l'enregistrement : " + error.message);
        } finally {
            submitButton.disabled = false;
        }
    });

    // --------------------------------------------------
    // AFFICHAGE DES LINEUPS
    // --------------------------------------------------

    async function renderLineups() {
        const { data, error } = await supabaseClient
            .from("lineups")
            .select("*")
            .eq("agent", selection.agent.name)
            .eq("map", selection.map.name)
            .order("created_at", { ascending: false });

        if (error) {
            console.error(error);
            container.textContent =
                "Impossible de charger les lineups.";
            return;
        }

        allLineups = data || [];

        const filteredLineups = allLineups.filter(lineup => {
            return (
                activeCategories.length === 0 ||
                activeCategories.includes(lineup.category)
            );
        });

        container.innerHTML = "";

        if (filteredLineups.length === 0) {
            container.textContent =
                "Aucune lineup pour cette sélection.";
            return;
        }

        filteredLineups.forEach(lineup => {
            const card = document.createElement("article");
            card.className = "lineup-card";

            const title = document.createElement("h3");
            title.textContent = lineup.title;

            const category = document.createElement("span");
            category.className = "lineup-category";
            category.textContent = lineup.category || "Autre";

            card.append(title, category);

            if (lineup.description?.trim()) {
                const description = document.createElement("p");
                description.textContent = lineup.description;
                card.appendChild(description);
            }

            // IMAGE
            if (lineup.image_url) {
                const image = document.createElement("img");

                image.src = lineup.image_url;
                image.alt = lineup.title;
                image.className = "lineup-media";

                image.addEventListener("click", () => {
                    openImageViewer(image.src);
                });

                image.addEventListener("contextmenu", event => {
                    event.preventDefault();
                    openImageViewer(image.src);
                });

                card.appendChild(image);
            }

            // VIDÉO
            if (lineup.video_url) {
                const video = document.createElement("video");

                video.src = lineup.video_url;
                video.controls = true;
                video.className = "lineup-media";

                card.appendChild(video);
            }

            // BOUTONS ADMINISTRATEUR
            if (isAdmin) {
                const editButton = document.createElement("button");

                editButton.type = "button";
                editButton.className = "edit-button";
                editButton.textContent = "MODIFIER";

                editButton.addEventListener("click", () => {
                    editingLineupId = lineup.id;

                    document.getElementById("lineupTitle").value =
                        lineup.title;

                    document.getElementById("lineupDescription").value =
                        lineup.description || "";

                    document.getElementById("lineupCategory").value =
                        lineup.category || "Autre";

                    imageInput.value = "";
                    videoInput.value = "";

                    document.getElementById("imageFileName").textContent =
                        lineup.image_url
                            ? "Image déjà enregistrée"
                            : "Aucune image choisie";

                    document.getElementById("videoFileName").textContent =
                        lineup.video_url
                            ? "Vidéo déjà enregistrée"
                            : "Aucune vidéo choisie";

                    form.querySelector("button[type='submit']").textContent =
                        "ENREGISTRER LES MODIFICATIONS →";

                    form.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });
                });

                card.appendChild(editButton);

                const deleteButton = document.createElement("button");

                deleteButton.type = "button";
                deleteButton.className = "delete-button";
                deleteButton.textContent = "SUPPRIMER";

                deleteButton.addEventListener("click", async () => {
                    if (!confirm("Supprimer cette lineup ?")) return;

                    const { error } = await supabaseClient
                        .from("lineups")
                        .delete()
                        .eq("id", lineup.id);

                    if (error) {
                        alert("Erreur lors de la suppression : " + error.message);
                        return;
                    }

                    await deleteMedia(lineup.image_url);
                    await deleteMedia(lineup.video_url);

                    await renderLineups();
                });

                card.appendChild(deleteButton);
            }

            container.appendChild(card);
        });
    }

    // --------------------------------------------------
    // FILTRES PAR CATÉGORIE
    // --------------------------------------------------

    if (categoryFilters) {
        categoryFilters.addEventListener("click", event => {
            const button = event.target.closest(".category-filter");
            if (!button) return;

            const category = button.dataset.category;

            if (category === "Toutes") {
                activeCategories = [];
            } else if (activeCategories.includes(category)) {
                activeCategories = activeCategories.filter(
                    item => item !== category
                );
            } else {
                activeCategories.push(category);
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

    // --------------------------------------------------
    // ZOOM SUR LES IMAGES
    // --------------------------------------------------

    function openImageViewer(src) {
        const viewer = document.createElement("div");
        viewer.className = "image-viewer";

        const image = document.createElement("img");
        image.src = src;
        image.alt = "Image agrandie";

        viewer.appendChild(image);
        document.body.appendChild(viewer);

        const closeViewer = () => {
            viewer.remove();
            document.removeEventListener("keydown", closeOnEscape);
        };

        const closeOnEscape = event => {
            if (event.key === "Escape") closeViewer();
        };

        viewer.addEventListener("click", closeViewer);
        document.addEventListener("keydown", closeOnEscape);
    }

    // --------------------------------------------------
    // CONVERSION DES FICHIERS POUR L'EXPORT JSON
    // --------------------------------------------------

    async function convertUrlToBase64(url) {
        if (!url) return null;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Impossible de récupérer un média.");
        }

        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                resolve({
                    name: url.split("/").pop().split("?")[0],
                    type: blob.type,
                    data: reader.result
                });
            };

            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    function convertBase64ToFile(fileData) {
        if (!fileData?.data || !fileData?.name) return null;

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

    // --------------------------------------------------
    // EXPORT JSON
    // --------------------------------------------------

    exportButton.addEventListener("click", async () => {
        try {
            const selectedLineups = allLineups;

            const exported = await Promise.all(
                selectedLineups.map(async lineup => ({
                    agent: lineup.agent,
                    map: lineup.map,
                    title: lineup.title,
                    description: lineup.description || "",
                    category: lineup.category || "Autre",
                    createdAt: lineup.created_at,
                    image: await convertUrlToBase64(lineup.image_url),
                    video: await convertUrlToBase64(lineup.video_url)
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
            alert("Erreur lors de l'exportation : " + error.message);
        }
    });

    // --------------------------------------------------
    // IMPORT JSON
    // --------------------------------------------------

    importInput.addEventListener("change", async event => {
        if (!isAdmin) {
            alert("Seuls les administrateurs peuvent importer des lineups.");
            event.target.value = "";
            return;
        }

        const file = event.target.files[0];
        if (!file) return;

        try {
            const imported = JSON.parse(await file.text());

            if (!Array.isArray(imported)) {
                throw new Error("Format JSON invalide.");
            }

            const selectedLineups = imported.filter(lineup =>
                lineup.agent === selection.agent.name &&
                lineup.map === selection.map.name
            );

            let importedCount = 0;

            for (const lineup of selectedLineups) {
                const imageFile = convertBase64ToFile(lineup.image);
                const videoFile = convertBase64ToFile(lineup.video);

                const imageUrl = imageFile
                    ? await uploadMedia(imageFile, "images")
                    : null;

                const videoUrl = videoFile
                    ? await uploadMedia(videoFile, "videos")
                    : null;

                const { error } = await supabaseClient
                    .from("lineups")
                    .insert([{
                        agent: selection.agent.name,
                        map: selection.map.name,
                        title: lineup.title,
                        description: lineup.description || "",
                        category: lineup.category || "Autre",
                        image_url: imageUrl,
                        video_url: videoUrl
                    }]);

                if (error) throw error;

                importedCount++;
            }

            alert(`${importedCount} lineup(s) importée(s).`);

            await renderLineups();

        } catch (error) {
            console.error(error);
            alert("Erreur lors de l'importation : " + error.message);
        } finally {
            event.target.value = "";
        }
    });

    // --------------------------------------------------
    // DÉMARRAGE
    // --------------------------------------------------

    supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
        console.error("Erreur de session :", error);
        return;
    }

    checkAdmin(data.session);
});
}
