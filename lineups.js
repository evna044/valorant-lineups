// =========================================================================
// LISTE DES PLANT SPOTS PRÉ-DÉFINIS (AJOUTER DE NOUVELLES OPTIONS ICI)
// =========================================================================
const PLANT_SPOTS_LIST = [
    "Default",
    "Open",
    "Triple Boxes",
    "Site"
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

    // --------------------------------------------------
    // INITIALISATION DES MENUS DÉROULANTS PLANT SPOTS
    // --------------------------------------------------
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

    // Affichage contextuel dans le formulaire
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

    // --------------------------------------------------
    // INTERFACE DE CONNEXION ADMIN
    // --------------------------------------------------

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
            authStatus.textContent = "Compte connecté : accès non autorisé.";
        }

        form.hidden = !isAdmin;

        const importLabel = document.querySelector('label[for="importInput"]');
        if (importLabel) {
            importLabel.hidden = !isAdmin;
        }

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
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            alert("Erreur lors de la déconnexion.");
            return;
        }
        editingLineupId = null;
        form.reset();
        updateFormCategoryFields();
    });

    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT") {
            setTimeout(() => checkAdmin(session), 0);
        }
    });

    // --------------------------------------------------
    // GESTION DES FICHIERS MÉDIAS
    // --------------------------------------------------

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
        const { error } = await supabaseClient.storage.from("lineup-media").remove([path]);
        if (error) console.error("Impossible de supprimer le média :", error);
    }

    // --------------------------------------------------
    // AJOUT & MODIFICATION
    // --------------------------------------------------

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!isAdmin) {
            alert("Tu dois être administrateur.");
            return;
        }

        const title = document.getElementById("lineupTitle").value.trim();
        const description = document.getElementById("lineupDescription").value.trim();
        const category = document.getElementById("lineupCategory").value;

        const site = category === "Post-plant" ? lineupSiteInput.value : null;
        const plant_spot = category === "Post-plant" ? lineupPlantSpotSelect.value : null;

        if (!title) return;

        const submitButton = form.querySelector("button[type='submit']");
        submitButton.disabled = true;

        try {
            const existingLineup = allLineups.find(lineup => lineup.id === editingLineupId);

            let imageUrl = existingLineup?.image_url || null;
            let videoUrl = existingLineup?.video_url || null;

            const oldImageUrl = imageUrl;
            const oldVideoUrl = videoUrl;

            if (imageInput.files[0]) {
                imageUrl = await uploadMedia(imageInput.files[0], "images");
            }
            if (videoInput.files[0]) {
                videoUrl = await uploadMedia(videoInput.files[0], "videos");
            }

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

            let result;
            if (editingLineupId) {
                result = await supabaseClient.from("lineups").update(lineup).eq("id", editingLineupId);
            } else {
                result = await supabaseClient.from("lineups").insert([lineup]);
            }

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

    // --------------------------------------------------
    // AFFICHAGE ET FILTRAGE DES LINEUPS
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

            // Filtres avancés si "Post-plant" est actif
            if (activeCategories.includes("Post-plant")) {
                if (selectedSite !== "Tous" && lineup.site !== selectedSite) {
                    return false;
                }
                if (selectedPlantSpot !== "Toutes" && lineup.plant_spot !== selectedPlantSpot) {
                    return false;
                }
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
                image.className = "lineup
