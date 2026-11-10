// =========================================================================
// LISTE DES PLANT SPOTS PRÉ-DÉFINIS
// =========================================================================
const PLANT_SPOTS_LIST = [
    "Default",
    "Open",
    "Triple Boxes",
    "Site",
    "Under",
    "Bridge",
    "BackSite"
];

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

    document.getElementById("currentAgent").textContent = selection.agent.name;
    document.getElementById("currentMap").textContent = selection.map.name;

    const form = document.getElementById("lineupForm");
    const container = document.getElementById("lineupsContainer");

    const imageInput = document.getElementById("lineupImage");
    const videoInput = document.getElementById("lineupVideo");

    const categorySelect = document.getElementById("lineupCategory");
    const postPlantFormFields = document.getElementById("postPlantFormFields");
    const lineupSiteInput = document.getElementById("lineupSite");
    const lineupPlantSpotSelect = document.getElementById("lineupPlantSpot");

    const exportButton = document.getElementById("exportButton");
    const importInput = document.getElementById("importInput");
    const categoryFilters = document.getElementById("categoryFilters");

    const postPlantSubFilters = document.getElementById("postPlantSubFilters");
    const filterSiteSelect = document.getElementById("filterSite");
    const filterPlantSpotSelect = document.getElementById("filterPlantSpot");

    let allLineups = [];
    let activeCategories = [];
    let isAdmin = false;

    // Initialisation des selects plant spots
    function initPlantSpotSelects() {
        if (lineupPlantSpotSelect) {
            lineupPlantSpotSelect.innerHTML = '<option value="">-- Choisir une plant --</option>';
            PLANT_SPOTS_LIST.forEach(spot => {
                const opt = document.createElement("option");
                opt.value = spot;
                opt.textContent = spot;
                lineupPlantSpotSelect.appendChild(opt);
            });
        }

        if (filterPlantSpotSelect) {
            filterPlantSpotSelect.innerHTML = '<option value="Toutes">Toutes les plants</option>';
            PLANT_SPOTS_LIST.forEach(spot => {
                const opt = document.createElement("option");
                opt.value = spot;
                opt.textContent = spot;
                filterPlantSpotSelect.appendChild(opt);
            });
        }
    }

    initPlantSpotSelects();

    function updateFormCategoryFields() {
        const selectedCat = categorySelect.value;
        if (selectedCat === "Post-plant") {
            postPlantFormFields.hidden = false;
        } else {
            postPlantFormFields.hidden = true;
            lineupSiteInput.value = "";
            lineupPlantSpotSelect.value = "";
        }
    }

    categorySelect.addEventListener("change", updateFormCategoryFields);

    // Panneau Admin
    const loginPanel = document.createElement("section");
    loginPanel.className = "admin-login";
    loginPanel.innerHTML = `
        <h2>ESPACE ADMINISTRATEUR</h2>
        <p id="authStatus">Connecte-toi pour gérer les lineups.</p>
        <form id="loginForm">
            <input type="email" id="adminEmail" placeholder="Adresse e-mail" required>
            <input type="password" id="adminPassword" placeholder="Mot de passe" required>
            <button type="submit">SE CONNECTER</button>
        </form>
        <button type="button" id="logoutButton" hidden>SE DÉCONNECTER</button>
    `;

    form.parentElement.insertBefore(loginPanel, form);

    const loginForm = document.getElementById("loginForm");
    const logoutButton = document.getElementById("logoutButton");
    const authStatus = document.getElementById("authStatus");

    form.hidden = true;

    async function checkAdmin(session = null) {
        const user = session?.user || null;
        isAdmin = false;

        if (user) {
            const { data, error } = await supabaseClient.rpc("is_admin");
            if (!error) {
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
            authStatus.textContent = "Compte connecté : accès non autorisé.";
        }

        form.hidden = !isAdmin;
        const importLabel = document.querySelector('label[for="importInput"]');
        if (importLabel) importLabel.hidden = !isAdmin;

        renderLineups();
    }

    loginForm.addEventListener("submit", async event => {
        event.preventDefault();
        const email = document.getElementById("adminEmail").value.trim();
        const password = document.getElementById("adminPassword").value;

        authStatus.textContent = "Connexion en cours...";
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            authStatus.textContent = "Connexion impossible : " + error.message;
        }
    });

    logoutButton.addEventListener("click", async () => {
        await supabaseClient.auth.signOut();
        editingLineupId = null;
        form.reset();
        updateFormCategoryFields();
    });

    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT") {
            setTimeout(() => checkAdmin(session), 0);
        }
    });

    imageInput.addEventListener("change", () => {
        document.getElementById("imageFileName").textContent = imageInput.files[0]?.name || "Aucune image choisie";
    });

    videoInput.addEventListener("change", () => {
        document.getElementById("videoFileName").textContent = videoInput.files[0]?.name || "Aucune vidéo choisie";
    });

    function safeFileName(name) {
        return name.replace(/[^a-zA-Z0-9._-]/g, "_");
    }

    async function uploadMedia(file, folder) {
        if (!file) return null;
        const path = `${folder}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error } = await supabaseClient.storage.from("lineup-media").upload(path, file, { upsert: false });
        if (error) throw error;
        const { data } = supabaseClient.storage.from("lineup-media").getPublicUrl(path);
        return data.publicUrl;
    }

    async function deleteMedia(url) {
        if (!url) return;
        const marker = "/storage/v1/object/public/lineup-media/";
        const index = url.indexOf(marker);
        if (index === -1) return;
        const path = decodeURIComponent(url.substring(index + marker.length));
        await supabaseClient.storage.from("lineup-media").remove([path]);
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!isAdmin) return;

        const title = document.getElementById("lineupTitle").value.trim();
        const description = document.getElementById("lineupDescription").value.trim();
        const category = document.getElementById("lineupCategory").value;
        const site = category === "Post-plant" ? lineupSiteInput.value : null;
        const plant_spot = category === "Post-plant" ? lineupPlantSpotSelect.value : null;

        if (!title) return;

        const submitButton = form.querySelector("button[type='submit']");
        submitButton.disabled = true;

        try {
            const existingLineup = allLineups.find(l => l.id === editingLineupId);
            let imageUrl = existingLineup?.image_url || null;
            let videoUrl = existingLineup?.video_url || null;

            const oldImageUrl = imageUrl;
            const oldVideoUrl = videoUrl;

            if (imageInput.files[0]) imageUrl = await uploadMedia(imageInput.files[0], "images");
            if (videoInput.files[0]) videoUrl = await uploadMedia(videoInput.files[0], "videos");

            const lineup = {
                agent: selection.agent.name,
                map: selection.map.name,
                title,
                description,
                category,
                site,
                plant_spot,
                image_url: imageUrl,
                video_url: videoUrl
            };

            let result = editingLineupId
                ? await supabaseClient.from("lineups").update(lineup).eq("id", editingLineupId)
                : await supabaseClient.from("lineups").insert([lineup]);

            if (result.error) throw result.error;

            if (imageUrl !== oldImageUrl) await deleteMedia(oldImageUrl);
            if (videoUrl !== oldVideoUrl) await deleteMedia(oldVideoUrl);

            editingLineupId = null;
            form.reset();
            updateFormCategoryFields();

            document.getElementById("imageFileName").textContent = "Aucune image choisie";
            document.getElementById("videoFileName").textContent = "Aucune vidéo choisie";
            submitButton.textContent = "ENREGISTRER LA LINEUP →";

            await renderLineups();
        } catch (error) {
            console.error(error);
            alert("Erreur lors de l'enregistrement : " + error.message);
        } finally {
            submitButton.disabled = false;
        }
    });

    async function renderLineups() {
        const { data, error } = await supabaseClient
            .from("lineups")
            .select("*")
            .eq("agent", selection.agent.name)
            .eq("map", selection.map.name)
            .order("created_at", { ascending: false });

        if (error) {
            container.textContent = "Impossible de charger les lineups.";
            return;
        }

        allLineups = data || [];
        const selectedSite = filterSiteSelect.value;
        const selectedPlantSpot = filterPlantSpotSelect.value;

        const filteredLineups = allLineups.filter(lineup => {
            const cat = lineup.category || "Autre";
            const categoryMatches = activeCategories.length === 0 || activeCategories.includes(cat);
            if (!categoryMatches) return false;

            if (activeCategories.includes("Post-plant")) {
                if (selectedSite !== "Tous" && lineup.site !== selectedSite) return false;
                if (selectedPlantSpot !== "Toutes" && lineup.plant_spot !== selectedPlantSpot) return false;
            }
            return true;
        });

        container.innerHTML = "";

        if (filteredLineups.length === 0) {
            container.textContent = "Aucune lineup pour cette sélection.";
            return;
        }

        filteredLineups.forEach(lineup => {
            const card = document.createElement("article");
            card.className = "lineup-card";

            const title = document.createElement("h3");
            title.textContent = lineup.title;

            const category = document.createElement("span");
            category.className = "lineup-category";
            let categoryText = lineup.category || "Autre";
            if (lineup.category === "Post-plant" && (lineup.site || lineup.plant_spot)) {
                const details = [lineup.site ? `Site ${lineup.site}` : "", lineup.plant_spot].filter(Boolean).join(" • ");
                categoryText += ` (${details})`;
            }
            category.textContent = categoryText;

            card.append(title, category);

            if (lineup.description?.trim()) {
                const description = document.createElement("p");
                description.textContent = lineup.description;
                card.appendChild(description);
            }

            if (lineup.image_url) {
                const image = document.createElement("img");
                image.src = lineup.image_url;
                image.alt = lineup.title;
                image.className = "lineup-media";
                image.addEventListener("click", () => openImageViewer(image.src));
                card.appendChild(image);
            }

            if (lineup.video_url) {
                const video = document.createElement("video");
                video.src = lineup.video_url;
                video.controls = true;
                video.className = "lineup-media";
                card.appendChild(video);
            }

            if (isAdmin) {
                const editButton = document.createElement("button");
                editButton.type = "button";
                editButton.className = "edit-button";
                editButton.textContent = "MODIFIER";
                editButton.addEventListener("click", () => {
                    editingLineupId = lineup.id;
                    document.getElementById("lineupTitle").value = lineup.title;
                    document.getElementById("lineupDescription").value = lineup.description || "";
                    document.getElementById("lineupCategory").value = lineup.category || "Autre";
                    updateFormCategoryFields();

                    if (lineup.category === "Post-plant") {
                        lineupSiteInput.value = lineup.site || "";
                        lineupPlantSpotSelect.value = lineup.plant_spot || "";
                    }

                    imageInput.value = "";
                    videoInput.value = "";
                    document.getElementById("imageFileName").textContent = lineup.image_url ? "Image déjà enregistrée" : "Aucune image choisie";
                    document.getElementById("videoFileName").textContent = lineup.video_url ? "Vidéo déjà enregistrée" : "Aucune vidéo choisie";
                    form.querySelector("button[type='submit']").textContent = "ENREGISTRER LES MODIFICATIONS →";
                    form.scrollIntoView({ behavior: "smooth", block: "center" });
                });
                card.appendChild(editButton);

                const deleteButton = document.createElement("button");
                deleteButton.type = "button";
                deleteButton.className = "delete-button";
                deleteButton.textContent = "SUPPRIMER";
                deleteButton.addEventListener("click", async () => {
                    if (!confirm("Supprimer cette lineup ?")) return;
                    await supabaseClient.from("lineups").delete().eq("id", lineup.id);
                    await deleteMedia(lineup.image_url);
                    await deleteMedia(lineup.video_url);
                    await renderLineups();
                });
                card.appendChild(deleteButton);
            }

            container.appendChild(card);
        });
    }

    if (categoryFilters) {
        categoryFilters.addEventListener("click", event => {
            const button = event.target.closest(".category-filter");
            if (!button) return;

            const category = button.dataset.category;
            if (category === "Toutes") {
                activeCategories = [];
            } else if (activeCategories.includes(category)) {
                activeCategories = activeCategories.filter(item => item !== category);
            } else {
                activeCategories.push(category);
            }

            document.querySelectorAll(".category-filter").forEach(filter => {
                const fc = filter.dataset.category;
                filter.classList.toggle("active", fc === "Toutes" ? activeCategories.length === 0 : activeCategories.includes(fc));
            });

            if (activeCategories.includes("Post-plant")) {
                postPlantSubFilters.hidden = false;
            } else {
                postPlantSubFilters.hidden = true;
                filterSiteSelect.value = "Tous";
                filterPlantSpotSelect.value = "Toutes";
            }

            renderLineups();
        });
    }

    filterSiteSelect.addEventListener("change", renderLineups);
    filterPlantSpotSelect.addEventListener("change", renderLineups);

    function openImageViewer(src) {
        const viewer = document.createElement("div");
        viewer.className = "image-viewer";
        const image = document.createElement("img");
        image.src = src;
        viewer.appendChild(image);
        document.body.appendChild(viewer);

        const closeViewer = () => viewer.remove();
        viewer.addEventListener("click", closeViewer);
        document.addEventListener("keydown", e => { if (e.key === "Escape") closeViewer(); });
    }

    supabaseClient.auth.getSession().then(({ data }) => {
        checkAdmin(data.session);
    });
}
