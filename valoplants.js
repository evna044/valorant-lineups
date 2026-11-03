(() => {

const db = window.supabaseClient;
const API = "https://valorant-api.com/v1";
const $ = id => document.getElementById(id);

if (!db) {
    alert("Supabase n'est pas connecté.");
    return;
}

let maps = [];
let agents = [];
let map = null;
let lineups = [];
let strategies = [];
let admin = false;
let editing = null;
let oldImages = [];
let filter = "Toutes";

const form = $("vpForm");
const editor = $("vpEditor");
const login = $("vpLoginForm");

const tdm = [
    "District",
    "Kasbah",
    "Piazza",
    "Drift",
    "Glitch"
];

// CHARGEMENT INITIAL

async function init() {

    try {

        const [mr, ar] = await Promise.all([
            fetch("./data/maps.json"),
            fetch("./data/agents.json")
        ]);

        if (!mr.ok || !ar.ok) {
            throw Error("API VALORANT indisponible");
        }

        const [md, ad] = await Promise.all([
            mr.json(),
            ar.json()
        ]);

        maps = md.data
    .filter(m =>
        m.displayName &&
        !/HURM|TeamDeathmatch/i.test(m.mapUrl || "")
    )
    .sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
    );

        agents = ad.data
            .filter(a =>
                a.isPlayableCharacter 
            )
            .sort((a, b) =>
                a.displayName.localeCompare(b.displayName)
            );

        renderMaps();
        renderAgents();

        const { data } = await db.auth.getSession();
        await checkAdmin(data.session);

    } catch (e) {

        console.error(e);
        $("vpMapGrid").textContent =
            "Impossible de charger les maps.";

    }

}

// AFFICHER LES MAPS

function renderMaps() {

    const root = $("vpMapGrid");
    root.innerHTML = "";

    maps.forEach(m => {

        const b = document.createElement("button");

        b.className =
            "vp-map-card" +
            (map?.uuid === m.uuid ? " active" : "");

        const i = document.createElement("img");
        i.src = m.splash;
        i.alt = m.displayName;

        const s = document.createElement("span");
        s.textContent = m.displayName.toUpperCase();

        b.append(i, s);

        b.onclick = () => selectMap(m);

        root.append(b);

    });

}

// SÉLECTIONNER UNE MAP

async function selectMap(m) {

    map = m;
    filter = "Toutes";

    $("vpResultsSection").hidden = false;

    $("vpSelectedMapTitle").textContent =
        "STRATÉGIES / " + m.displayName.toUpperCase();

    document.querySelectorAll(
        "#vpCategoryFilters button"
    ).forEach(b => {
        b.classList.toggle(
            "active",
            b.dataset.category === "Toutes"
        );
    });

    renderMaps();

    try {

        await Promise.all([
            loadStrategies(),
            loadLineups()
        ]);

        renderLineupsPicker();

    } catch (error) {

        console.error(error);
        alert("Erreur de chargement : " + error.message);

    }

}

// CHARGER LES LINEUPS DE LA MAP

async function loadLineups() {

    const { data, error } = await db
        .from("lineups")
        .select("*")
        .eq("map", map.displayName)
        .order("created_at", { ascending: false });

    if (error) throw error;

    lineups = data || [];

}

// CHARGER LES STRATÉGIES

async function loadStrategies() {

    const { data, error } = await db
        .from("valoplants")
        .select("*")
        .eq("map", map.displayName)
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        $("vpStrategyGrid").textContent =
            "Erreur de chargement.";
        return;
    }

    const ids = (data || []).map(x => x.id);

    let ims = [];
    let links = [];

    if (ids.length) {

        const [a, b] = await Promise.all([

            db.from("valoplant_images")
                .select("*")
                .in("valoplant_id", ids)
                .order("position"),

            db.from("valoplant_lineups")
                .select("*")
                .in("valoplant_id", ids)

        ]);

        if (a.error) throw a.error;
        if (b.error) throw b.error;

        ims = a.data || [];
        links = b.data || [];

    }

    strategies = (data || []).map(s => ({

        ...s,

        images: ims.filter(i =>
            i.valoplant_id === s.id
        ),

        lineupIds: links
            .filter(l => l.valoplant_id === s.id)
            .map(l => l.lineup_id)

    }));

    renderStrategies();

}

// AFFICHER LES STRATÉGIES

function renderStrategies() {

    const root = $("vpStrategyGrid");
    root.innerHTML = "";

    const shown = strategies.filter(s =>
        filter === "Toutes" || s.category === filter
    );

    $("vpStrategyCount").textContent =
        shown.length + " STRATÉGIE(S)";

    if (!shown.length) {
        root.textContent =
            "Aucune stratégie pour cette map.";
        return;
    }

    shown.forEach(s => {

        const c = document.createElement("article");
        c.className = "vp-strategy-card";

        const img = document.createElement("img");
        img.src = s.images[0]?.image_url || map.splash;

        const h = document.createElement("h3");
        h.textContent = s.title;

        const tag = document.createElement("span");
        tag.className = "vp-tag";
        tag.textContent = s.category;

        const p = document.createElement("p");
        p.textContent = s.description || "Aucune description.";

        const view = document.createElement("button");
        view.className = "vp-detail-button";
        view.textContent = "VOIR LA STRATÉGIE";
        view.onclick = () => detail(s);

        c.append(img, h, tag, p, view);

        if (admin) {

            const edit = document.createElement("button");
            edit.className = "edit-button";
            edit.textContent = "MODIFIER";
            edit.onclick = () => editStrategy(s);

            const del = document.createElement("button");
            del.className = "delete-button";
            del.textContent = "SUPPRIMER";
            del.onclick = () => deleteStrategy(s);

            c.append(edit, del);

        }

        root.append(c);

    });

}

// AFFICHER LES AGENTS

function renderAgents(selected = []) {

    const root = $("vpAgents");
    root.innerHTML = "";

    agents.forEach(a => {

        const l = document.createElement("label");
        l.className = "vp-choice";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.name = "vpAgent";
        cb.value = a.displayName;
        cb.checked = selected.includes(a.displayName);

        cb.onchange = renderLineupsPicker;

        const im = document.createElement("img");
        im.src = a.displayIcon;

        const t = document.createElement("span");
        t.textContent = a.displayName;

        l.append(cb, im, t);
        root.append(l);

    });

}

// AGENTS SÉLECTIONNÉS

function selectedAgents() {

    return [
        ...document.querySelectorAll(
            'input[name="vpAgent"]:checked'
        )
    ].map(x => x.value);

}

// FILTRER LES LINEUPS

function renderLineupsPicker(selected = null) {

    const root = $("vpLineups");

    const keep = selected || [
        ...root.querySelectorAll("input:checked")
    ].map(x => x.value);

    const names = selectedAgents();

    const list = names.length
        ? lineups.filter(l => names.includes(l.agent))
        : lineups;

    root.innerHTML = "";

    if (!list.length) {
        root.textContent =
            "Aucune lineup correspondante sur cette map.";
        return;
    }

    list.forEach(x => {

        const l = document.createElement("label");
        l.className = "vp-choice";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.name = "vpLineup";
        cb.value = x.id;
        cb.checked = keep.includes(x.id);

        const t = document.createElement("span");
        t.textContent = x.agent + " — " + x.title;

        l.append(cb, t);
        root.append(l);

    });

}

// MODIFIER UNE STRATÉGIE

function editStrategy(s) {

    editing = s.id;

    oldImages = s.images.map(x => ({
        ...x,
        remove: false
    }));

    $("vpFormHeading").textContent =
        "MODIFIER LA STRATÉGIE";

    $("vpTitle").value = s.title;
    $("vpDescription").value = s.description || "";
    $("vpCategory").value = s.category;
    $("vpUrl").value = s.valoplant_url || "";
    $("vpImages").value = "";

    renderAgents(s.agents || []);
    renderOldImages();
    renderLineupsPicker(s.lineupIds);

    $("vpSave").textContent =
        "ENREGISTRER LES MODIFICATIONS →";

    $("vpCancel").hidden = false;

    editor.scrollIntoView({
        behavior: "smooth"
    });

}

// AFFICHER LES ANCIENNES IMAGES

function renderOldImages() {

    const root = $("vpOldImages");
    root.innerHTML = "";

    oldImages.forEach((x, n) => {

        const box = document.createElement("div");

        const im = document.createElement("img");
        im.src = x.image_url;

        const lab = document.createElement("label");

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = x.remove;

        cb.onchange = () => {
            oldImages[n].remove = cb.checked;
        };

        lab.append(
            cb,
            document.createTextNode(" Retirer")
        );

        box.append(im, lab);
        root.append(box);

    });

}

// RÉINITIALISER LE FORMULAIRE

function resetForm() {

    editing = null;
    oldImages = [];

    form.reset();

    $("vpFormHeading").textContent =
        "CRÉER UNE STRATÉGIE";

    $("vpSave").textContent =
        "ENREGISTRER LA STRATÉGIE →";

    $("vpCancel").hidden = true;
    $("vpOldImages").innerHTML = "";
    $("vpFileNames").textContent = "";

    renderAgents();
    renderLineupsPicker([]);

}

// NOM DE FICHIER SÉCURISÉ

function filename(n) {

    return n.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
    );

}

// ENVOYER UNE IMAGE

async function upload(file) {

    const path =
        "valoplants/" +
        crypto.randomUUID() +
        "-" +
        filename(file.name);

    const { error } = await db.storage
        .from("lineup-media")
        .upload(path, file);

    if (error) throw error;

    return db.storage
        .from("lineup-media")
        .getPublicUrl(path)
        .data.publicUrl;

}

// SUPPRIMER UNE IMAGE DU STOCKAGE

async function removeMedia(url) {

    const marker =
        "/storage/v1/object/public/lineup-media/";

    const i = (url || "").indexOf(marker);

    if (i < 0) return;

    const path = decodeURIComponent(
        url.slice(i + marker.length)
    );

    const { error } = await db.storage
        .from("lineup-media")
        .remove([path]);

    if (error) console.warn(error);

}

// ENREGISTRER UNE STRATÉGIE

form.addEventListener("submit", async e => {

    e.preventDefault();

    if (!admin || !map) {
        return alert("Accès administrateur requis.");
    }

    const url = $("vpUrl").value.trim();

    if (
        url &&
        !/^https:\/\/(www\.)?valoplant\.gg\//i.test(url)
    ) {
        return alert(
            "Utilise un lien https://valoplant.gg/ valide."
        );
    }

    const btn = $("vpSave");
    btn.disabled = true;

    try {

        const payload = {

            map: map.displayName,

            title: $("vpTitle").value.trim(),

            description:
                $("vpDescription").value.trim(),

            category: $("vpCategory").value,

            agents: selectedAgents(),

            valoplant_url: url

        };

        let id = editing;

        if (id) {

            const { error } = await db
                .from("valoplants")
                .update(payload)
                .eq("id", id);

            if (error) throw error;

        } else {

            const { data, error } = await db
                .from("valoplants")
                .insert([payload])
                .select("id")
                .single();

            if (error) throw error;

            id = data.id;

        }

        // Supprimer les anciennes images cochées

        for (const x of oldImages.filter(x => x.remove)) {

            const { error } = await db
                .from("valoplant_images")
                .delete()
                .eq("id", x.id);

            if (error) throw error;

            await removeMedia(x.image_url);

        }

        // Envoyer les nouvelles images

        const keep = oldImages.filter(x => !x.remove);
        const rows = [];

        for (const f of $("vpImages").files) {

            rows.push({

                valoplant_id: id,

                image_url: await upload(f),

                position: keep.length + rows.length

            });

        }

        if (rows.length) {

            const { error } = await db
                .from("valoplant_images")
                .insert(rows);

            if (error) throw error;

        }

        // Mettre à jour les lineups associées

        const { error: delError } = await db
            .from("valoplant_lineups")
            .delete()
            .eq("valoplant_id", id);

        if (delError) throw delError;

        const ids = [
            ...document.querySelectorAll(
                'input[name="vpLineup"]:checked'
            )
        ].map(x => x.value);

        if (ids.length) {

            const { error } = await db
                .from("valoplant_lineups")
                .insert(
                    ids.map(lineup_id => ({
                        valoplant_id: id,
                        lineup_id
                    }))
                );

            if (error) throw error;

        }

        alert(
            editing
                ? "Stratégie modifiée."
                : "Stratégie créée."
        );

        resetForm();

        await loadStrategies();

    } catch (err) {

        console.error(err);
        alert("Erreur : " + err.message);

    } finally {

        btn.disabled = false;

    }

});

// SUPPRIMER UNE STRATÉGIE

async function deleteStrategy(s) {

    if (!confirm("Supprimer « " + s.title + " » ?")) {
        return;
    }

    try {

        for (const x of s.images) {
            await removeMedia(x.image_url);
        }

        const { error } = await db
            .from("valoplants")
            .delete()
            .eq("id", s.id);

        if (error) throw error;

        await loadStrategies();

    } catch (e) {

        alert("Erreur : " + e.message);

    }

}

// DÉTAIL D'UNE STRATÉGIE

function detail(s) {

    const overlay = document.createElement("div");
    overlay.className = "vp-modal";

    const panel = document.createElement("div");
    panel.className = "vp-modal-inner";

    const close = document.createElement("button");
    close.className = "vp-close";
    close.textContent = "FERMER ✕";
    close.onclick = () => overlay.remove();

    const h = document.createElement("h2");
    h.textContent = s.title;

    const tag = document.createElement("span");
    tag.className = "vp-tag";
    tag.textContent = s.category;

    const desc = document.createElement("p");
    desc.textContent =
        s.description || "Aucune description.";

    const comp = document.createElement("p");

    comp.textContent = s.agents?.length
        ? "Composition : " + s.agents.join(", ")
        : "Composition non renseignée.";

    const imgs = document.createElement("div");
    imgs.className = "vp-modal-images";

    s.images.forEach(x => {

        const im = document.createElement("img");
        im.src = x.image_url;
        im.onclick = () => zoom(x.image_url);

        imgs.append(im);

    });

    const lh = document.createElement("h3");
    lh.textContent = "LINEUPS ASSOCIÉES";

    const lg = document.createElement("div");
    lg.className = "vp-modal-lineups";

    const linked = lineups.filter(l =>
        s.lineupIds.includes(l.id)
    );

    if (!linked.length) {
        lg.textContent = "Aucune lineup associée.";
    }

    linked.forEach(l => {

        const a = document.createElement("article");

        const t = document.createElement("strong");
        t.textContent = l.agent + " — " + l.title;

        a.append(t);

        if (l.description) {

            const p = document.createElement("p");
            p.textContent = l.description;
            a.append(p);

        }

        if (l.image_url) {

            const im = document.createElement("img");
            im.src = l.image_url;
            im.onclick = () => zoom(l.image_url);

            a.append(im);

        }

        if (l.video_url) {

            const v = document.createElement("video");
            v.src = l.video_url;
            v.controls = true;

            a.append(v);

        }

        lg.append(a);

    });

    panel.append(close, h, tag, desc, comp, imgs, lh, lg);

    if (s.valoplant_url) {

        const a = document.createElement("a");

        a.className = "vp-external";
        a.href = s.valoplant_url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "OUVRIR SUR VALOPLANT.GG ↗";

        panel.append(a);

    }

    overlay.append(panel);

    overlay.onclick = e => {
        if (e.target === overlay) overlay.remove();
    };

    document.body.append(overlay);

}

// AGRANDIR UNE IMAGE

function zoom(src) {

    const v = document.createElement("div");
    v.className = "image-viewer";

    const i = document.createElement("img");
    i.src = src;

    v.append(i);
    v.onclick = () => v.remove();

    document.body.append(v);

}

// FILTRES

$("vpCategoryFilters").onclick = e => {

    const b = e.target.closest("button[data-category]");

    if (!b) return;

    filter = b.dataset.category;

    document.querySelectorAll(
        "#vpCategoryFilters button"
    ).forEach(x => {
        x.classList.toggle("active", x === b);
    });

    renderStrategies();

};

// NOM DES IMAGES CHOISIES

$("vpImages").onchange = () => {

    $("vpFileNames").textContent = [
        ...$("vpImages").files
    ].map(x => x.name).join(", ") || "Aucune image choisie";

};

// ANNULER UNE MODIFICATION

$("vpCancel").onclick = resetForm;

// CONNEXION ADMIN

login.addEventListener("submit", async e => {

    e.preventDefault();

    $("vpAuthStatus").textContent = "Connexion...";

    const { error } = await db.auth.signInWithPassword({

        email: $("vpEmail").value.trim(),

        password: $("vpPassword").value

    });

    if (error) {
        $("vpAuthStatus").textContent =
            "Connexion impossible : " + error.message;
    }

});

// DÉCONNEXION

$("vpLogout").onclick = async () => {

    const { error } = await db.auth.signOut();

    if (error) alert(error.message);

};

// VÉRIFIER LES DROITS ADMIN

async function checkAdmin(session) {

    const user = session?.user;

    admin = false;

    if (user) {

        const { data, error } = await db.rpc("is_admin");

        if (error) {
            console.error(error);
        } else {
            admin = data === true;
        }

    }

    login.hidden = !!user;
    $("vpLogout").hidden = !user;
    editor.hidden = !admin;

    $("vpAuthStatus").textContent = !user
        ? "Connecte-toi pour gérer les stratégies."
        : admin
            ? "Connecté en tant qu'administrateur."
            : "Compte connecté : accès administrateur non autorisé.";

    renderStrategies();

}

// SUIVI DE LA SESSION

db.auth.onAuthStateChange((event, session) => {

    if (
        ["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED"].includes(event)
    ) {
        setTimeout(() => checkAdmin(session), 0);
    }

});

$("vpAdminPanel").hidden = false;

init();

})();
