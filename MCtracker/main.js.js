// ==================== QUOTES ====================
const Quotes = [
    "for bedrock and java!",
    "made by toetoes 69",
    "Skin tracking active!",
    "Looking up databases...",
    "MCtracker v1.0"
];
document.addEventListener('DOMContentLoaded', () => {
    const num = Math.floor(Math.random() * Quotes.length);
    const el = document.getElementById("quote");
    if (el) el.textContent = Quotes[num];
});

// ==================== SOUND ====================
function btnMinecraft() {
    const sound = document.getElementById("btnAudioClick");
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {});
    }
}

// ==================== TUTORIAL TOGGLE ====================
const tutorialBtn = document.getElementById('tutorialBtn');
const bedrockTutorial = document.getElementById('bedrockTutorial');
const javaRadio = document.getElementById('java');
const bedrockRadio = document.getElementById('bedrock');

function updateTutorialVisibility() {
    if (bedrockRadio && bedrockRadio.checked) {
        if (tutorialBtn) tutorialBtn.style.display = 'block';
    } else {
        if (tutorialBtn) tutorialBtn.style.display = 'none';
        if (bedrockTutorial) bedrockTutorial.style.display = 'none';
    }
}
if (javaRadio && bedrockRadio) {
    javaRadio.addEventListener('change', updateTutorialVisibility);
    bedrockRadio.addEventListener('change', updateTutorialVisibility);
}
if (tutorialBtn) {
    tutorialBtn.addEventListener('click', () => {
        if (bedrockTutorial) {
            bedrockTutorial.style.display = (bedrockTutorial.style.display === 'block') ? 'none' : 'block';
        }
    });
}
updateTutorialVisibility();

// ==================== PROXY & FETCH UTILS ====================
const PROXIES = [
    { name: 'allorigins', build: url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` },
    { name: 'corsproxy', build: url => `https://corsproxy.io/?${encodeURIComponent(url)}` },
    { name: 'codetabs', build: url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}` },
    { name: 'thingproxy', build: url => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}` }
];

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

async function fetchWithTimeout(url, timeout = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return res;
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }
}

// Fetches with retries (maxAttempts) over shuffled proxy list
async function fetchWithProxies(url, returnRaw = false, maxAttempts = 3) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const proxies = shuffleArray(PROXIES);
        for (const proxy of proxies) {
            try {
                const proxyUrl = proxy.build(url);
                const resp = await fetchWithTimeout(proxyUrl, 8000);
                if (!resp.ok) continue;
                const data = returnRaw ? await resp.text() : await resp.json();
                if (returnRaw && typeof data === 'object') continue;
                return data;
            } catch (e) {
                continue;
            }
        }
        if (attempt < maxAttempts - 1) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    throw new Error("All proxies failed after multiple attempts");
}

// ==================== IMAGE CDN (CORS safe) ====================
function getTextureCDN(textureId) {
    if (!textureId) return null;
    let baseUrl = textureId.startsWith('http') ? textureId : `https://textures.minecraft.net/texture/${textureId}`;
    const cleanUrl = baseUrl.replace(/^https?:\/\//, '');
    return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&output=png`;
}

// ==================== MCPROFILE.IO SCRAPER (only source for Bedrock) ====================
async function fetchFromMcprofile(username) {
    try {
        // Try JSON API first
        const data = await fetchWithProxies(
            `https://mcprofile.io/api/v1/bedrock/gamertag/${encodeURIComponent(username)}`,
            false,
            2
        );
        if (data && !data.error) {
            return {
                textureId: data.textureid || data.textureId || data.TextureId || null,
                xuid: data.xuid || null,
                gamerscore: data.gamescore || data.gamerscore || null,
                gamertag: data.gamertag || username
            };
        }
    } catch (apiErr) {
        // Fallback to HTML scraping
        try {
            const html = await fetchWithProxies(
                `https://mcprofile.io/profile/${encodeURIComponent(username)}`,
                true,
                2
            );
            if (!html || html.includes("404 Not Found")) return null;
            const textureMatch = html.match(/["']?textureid["']?\s*:\s*["']([a-f0-9_-]+)["']/i);
            const xuidMatch = html.match(/["']?xuid["']?\s*:\s*["']([0-9]+)["']/i);
            const scoreMatch = html.match(/["']?(?:gamescore|gamerscore)["']?\s*:\s*["']?([0-9]+)["']?/i);
            const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
            return {
                textureId: textureMatch ? textureMatch[1] : null,
                xuid: xuidMatch ? xuidMatch[1] : null,
                gamerscore: scoreMatch ? scoreMatch[1] : null,
                gamertag: nameMatch ? nameMatch[1].trim() : username
            };
        } catch (scrapeErr) {
            return null;
        }
    }
}

// ==================== BEDROCK GATHERER ====================
async function fetchBedrock(username) {
    const profile = await fetchFromMcprofile(username);
    if (!profile || !profile.textureId) {
        throw new Error("No skin found for this Bedrock player.");
    }
    return {
        gamertag: profile.gamertag || username,
        id: profile.xuid || 'N/A',
        idType: 'XUID',
        isBedrock: true,
        skinTexture: profile.textureId,
        capeUrl: null,
        gamerscore: profile.gamerscore || 'N/A'
    };
}

// ==================== JAVA GATHERER ====================
async function fetchJava(username) {
    const data = await fetchWithProxies(
        `https://api.ashcon.app/mojang/v2/user/${encodeURIComponent(username)}`,
        false,
        2
    );
    return {
        gamertag: data.username,
        id: data.uuid,
        idType: 'UUID',
        isBedrock: false,
        skinTexture: data.textures?.skin?.url || null,
        capeUrl: data.textures?.cape?.url || null,
        gamerscore: 'N/A'
    };
}

// ==================== 3D VIEWER MANAGEMENT ====================
let currentSkinViewer = null;

function destroyViewer() {
    if (currentSkinViewer) {
        currentSkinViewer.dispose();
        currentSkinViewer = null;
    }
}

// ==================== DISPLAY PLAYER ====================
function displayPlayer(player) {
    destroyViewer();
    const resultDiv = document.getElementById('result');
    if (!resultDiv) return;

    const skinUrl = getTextureCDN(player.skinTexture);
    const capeUrl = getTextureCDN(player.capeUrl);

    const platformHTML = player.isBedrock
        ? `<p><strong>Platform:</strong> <span style="color:#55ff55;">Bedrock Edition</span></p>
           <p><strong>Xbox Profile:</strong> <a href="https://xboxgamertag.com/search/${encodeURIComponent(player.gamertag)}" target="_blank">🔗 View on Xbox</a></p>`
        : `<p><strong>Platform:</strong> <span style="color:#aaa;">Java Edition</span></p>`;

    resultDiv.innerHTML = `
        <div class="split-result-layout">
            <div class="player-details-pane">
                <h2>${player.gamertag}</h2>
                <p><strong>${player.idType}:</strong> ${player.id}</p>
                <p><strong>Gamerscore:</strong> ${player.gamerscore}</p>
                ${platformHTML}
                
                <div style="margin-top:20px; max-width:260px;">
                    <div id="downloadContainer">
                        ${skinUrl 
                            ? `<div class="mainBtn" onclick="btnMinecraft(); window.open('${skinUrl}', '_blank')"><div class="textBtn">📥 Download Skin</div></div>`
                            : '<span style="color:#ff5555;">No texture asset</span>'}
                    </div>
                </div>

                ${capeUrl ? `
                    <div style="margin-top:15px;">
                        <p style="color:#aaa; font-size:0.8rem; margin-bottom:5px;">Cape preview:</p>
                        <img src="${capeUrl}" alt="Cape" style="image-rendering:pixelated; width:60px; border:2px solid #000;">
                    </div>
                ` : ''}
            </div>

            <div class="skin-render-pane">
                <div class="skin-container">
                    <canvas id="skin_canvas"></canvas>
                </div>
            </div>
        </div>
    `;

    if (skinUrl) {
        try {
            const canvas = document.getElementById('skin_canvas');
            if (!canvas) return;
            currentSkinViewer = new skinview3d.SkinViewer({
                canvas,
                width: 280,
                height: 360,
                skin: skinUrl
            });
            currentSkinViewer.animation = new skinview3d.IdleAnimation();
            currentSkinViewer.controls.enableRotate = true;
            currentSkinViewer.controls.enableZoom = false;

            if (capeUrl) {
                currentSkinViewer.loadCape(capeUrl);
            }
        } catch (e) {
            console.error("SkinViewer init failed:", e);
            const skinContainer = document.querySelector('.skin-container');
            if (skinContainer) skinContainer.innerHTML = '<p style="color:#ff5555;">Renderer error.</p>';
        }
    } else {
        const skinContainer = document.querySelector('.skin-container');
        if (skinContainer) skinContainer.innerHTML = '<p style="color:#ff5555;">No skin available.</p>';
    }
}

// ==================== SEARCH HANDLER ====================
const searchButton = document.getElementById('searchButton');
if (searchButton) {
    searchButton.addEventListener('click', async () => {
        btnMinecraft();
        const username = document.getElementById('usernameInput')?.value.trim();
        const editionRadio = document.querySelector('input[name="edition"]:checked');
        const edition = editionRadio ? editionRadio.value : 'bedrock';
        const displayPane = document.getElementById('displayPane');
        const resultDiv = document.getElementById('result');

        if (!username) {
            if (displayPane) displayPane.style.display = 'block';
            if (resultDiv) resultDiv.innerHTML = '<p class="status-msg error">Enter a username / gamertag.</p>';
            return;
        }

        if (displayPane) displayPane.style.display = 'block';
        if (resultDiv) resultDiv.innerHTML = '<p class="status-msg loading">Scanning databases...</p>';

        try {
            const player = edition === 'java' ? await fetchJava(username) : await fetchBedrock(username);
            displayPlayer(player);
        } catch (err) {
            if (resultDiv) resultDiv.innerHTML = `<p class="status-msg error">${err.message}</p>`;
        }
    });
}

// Enter key triggers search
const usernameInput = document.getElementById('usernameInput');
if (usernameInput) {
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && searchButton) searchButton.click();
    });
}