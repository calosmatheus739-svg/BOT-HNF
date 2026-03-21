require("dotenv").config();
const { Client, GatewayIntentBits, Events, EmbedBuilder } = require("discord.js");
const express = require("express");
const axios   = require("axios");

// ═══════════════════════════════════════════════════════════════
// ENV
// ═══════════════════════════════════════════════════════════════
const {
    DISCORD_TOKEN,
    ROBLOX_API_KEY,
    ROBLOX_UNIVERSE_ID,
    ADMIN_CHANNEL_ID,
    ALLOWED_ROLE_ID,
    PORT = "3000",
} = process.env;

// ═══════════════════════════════════════════════════════════════
// ANTI-DUPLICATE
// Cada mensagem tem um ID único do Discord.
// Guardamos por 60s — cobre qualquer reconexão de WebSocket
// e evita que 2 deployments ativos disparem o mesmo comando.
// IMPORTANTE: no Railway, mantenha APENAS 1 deployment ativo.
// ═══════════════════════════════════════════════════════════════
const _seen = new Map(); // id → timestamp
function seen(id) {
    if (_seen.has(id)) return true;
    _seen.set(id, Date.now());
    setTimeout(() => _seen.delete(id), 60_000);
    return false;
}

// ═══════════════════════════════════════════════════════════════
// ROBLOX MESSAGING SERVICE
// ═══════════════════════════════════════════════════════════════
async function roblox(payload) {
    await axios.post(
        `https://apis.roblox.com/messaging-service/v1/universes/${ROBLOX_UNIVERSE_ID}/topics/AdminCommands`,
        { message: JSON.stringify(payload) },
        { headers: { "x-api-key": ROBLOX_API_KEY, "Content-Type": "application/json" } }
    );
}

// ═══════════════════════════════════════════════════════════════
// COMANDOS — espelho exato do TreatService.lua
// ═══════════════════════════════════════════════════════════════
const SKINS = {
    ":witch":         { skins: ["AgathaHarknessBad", "AgathaHarknessYouth"] },
    ":firefairy":     { skins: ["Bloom", "DarkBloom"] },
    ":devilfied":     { skins: ["MagikDevil"] },
    ":promraven":     { skins: ["PromRaven"] },
    ":unpromraven":   { skins: ["PromRaven"],            remove: true },
    ":esdeath":       { skins: ["IceWitchEsdeath"] },
    ":starlight":     { skins: ["AgathaLight"] },
    ":promqueen":     { skins: ["ZatProm"] },
    ":unpromqueen":   { skins: ["ZatProm"],              remove: true },
    ":promdevil":     { skins: ["Roman"] },
    ":unpromdevil":   { skins: ["Roman"],                remove: true },
    ":madisonfied":   { skins: ["Y2KMadison"] },
    ":unmadisonfied": { skins: ["Y2KMadison"],           remove: true },
    ":goldified":     { skins: ["SabrinaGoldenRuler"] },
    ":ungoldified":   { skins: ["SabrinaGoldenRuler"],   remove: true },
    ":lordified":     { skins: ["ChildKlarion"] },
    ":unlordified":   { skins: ["ChildKlarion"],         remove: true },
    ":childpink":     { skins: ["ChildKlarionPink"] },
    ":unchildpink":   { skins: ["ChildKlarionPink"],     remove: true },
    ":starog":        { skins: ["AgathaLightCivil"] },
    ":unstarog":      { skins: ["AgathaLightCivil"],     remove: true },
    ":lorefied":      { skins: ["WednesdayLore"] },
    ":unlorefied":    { skins: ["WednesdayLore"],        remove: true },
    ":promified":     { skins: ["GwenProm"] },
    ":unpromified":   { skins: ["GwenProm"],             remove: true },
    ":sunnygwen":     { skins: ["SunnyGwen"] },
    ":unsunnygwen":   { skins: ["SunnyGwen"],            remove: true },
    ":bride":         { skins: ["InvisibleWomanBride"] },
    ":unbride":       { skins: ["InvisibleWomanBride"],  remove: true },
    ":carrie":        { skins: ["ElevenCarrie"] },
    ":uncarrie":      { skins: ["ElevenCarrie"],         remove: true },
    ":sakura":        { skins: ["PsylockeSakura"] },
    ":unsakura":      { skins: ["PsylockeSakura"],       remove: true },
    ":smantis":       { skins: ["SquidWorker"] },
    ":spanther":      { skins: ["SquidSoldier"] },
    ":doll":          { skins: ["RobotDoll"] },
    ":koriy2k":       { skins: ["SolarisY2K"] },
    ":cosmic":        { skins: ["DarkPhoenixCosmic"] },
    ":redqueen":      { skins: ["RedQueen"] },
    ":unredqueen":    { skins: ["RedQueen"],             remove: true },
    ":unzee":         { skins: ["ZatannaZeZe"],          remove: true },
};

const ROLES = {
    ":iconic":        { role: "Iconic",      give: true  },
    ":uniconic":      { role: "Iconic",      give: false },
    ":honored":       { role: "Honored",     give: true  },
    ":unhonored":     { role: "Honored",     give: false },
    ":prestigious":   { role: "Prestigious", give: true  },
    ":unprestigious": { role: "Prestigious", give: false },
    ":risingstar":    { role: "RisingStar",  give: true  },
    ":unrisingstar":  { role: "RisingStar",  give: false },
    ":tester":        { role: "Tester",      give: true  },
    ":untester":      { role: "Tester",      give: false },
    ":contributor":   { role: "Contributor", give: true  },
    ":uncontributor": { role: "Contributor", give: false },
    ":joker":         { role: "Joker",       give: true  },
    ":unjoker":       { role: "Joker",       give: false },
};

const TAGS = {
    ":givevip":     "VipTag",
    ":giverainbow": "RainbowTag",
    ":givepink":    "PinkTag",
};

// ═══════════════════════════════════════════════════════════════
// EMBEDS
// ═══════════════════════════════════════════════════════════════
function embed(color, title, fields = []) {
    const e = new EmbedBuilder().setColor(color).setTitle(title).setTimestamp();
    if (fields.length) e.addFields(fields);
    return { embeds: [e] };
}

const OK   = (title, fields) => embed(0x57F287, `✅  ${title}`, fields);
const ERR  = (title, fields) => embed(0xED4245, `❌  ${title}`, fields);
const INFO = (title, fields) => embed(0x5865F2, `ℹ️  ${title}`, fields);

function field(name, value, inline = true) { return { name, value: `\`${value}\``, inline }; }

// ═══════════════════════════════════════════════════════════════
// DISCORD CLIENT
// ═══════════════════════════════════════════════════════════════
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.on(Events.MessageCreate, async (msg) => {
    // ── Filtros iniciais ──────────────────────────────────────
    if (msg.author.bot)                      return;
    if (msg.channel.id !== ADMIN_CHANNEL_ID) return;
    if (seen(msg.id))                        return; // anti-duplicate

    const member = msg.member;
    if (!member?.roles.cache.has(ALLOWED_ROLE_ID)) return; // sem permissão → ignora silenciosamente

    const parts  = msg.content.trim().split(/\s+/);
    const cmd    = parts[0].toLowerCase();
    const target = parts[1];
    const sender = msg.author.username;

    // ── Deleta a mensagem de comando (canal limpo) ────────────
    msg.delete().catch(() => {});

    try {

        // ── :giveskin <player> <Skin1,Skin2> ─────────────────
        if (cmd === ":giveskin") {
            if (!target || !parts[2])
                return msg.channel.send(ERR("Uso incorreto", [field("Sintaxe", ":giveskin <player> <Skin1,Skin2,...>")]));
            const skins = parts[2].split(",").map(s => s.trim()).filter(Boolean);
            for (const skin of skins) await roblox({ cmd: "giveskin", identifier: target, skin, sender });
            return msg.channel.send(OK("Skin enviada", [
                field("Player",  target),
                field("Skin(s)", skins.join(", ")),
                field("Admin",   sender),
            ]));
        }

        // ── :removeskin <player> <Skin1,Skin2> ───────────────
        if (cmd === ":removeskin") {
            if (!target || !parts[2])
                return msg.channel.send(ERR("Uso incorreto", [field("Sintaxe", ":removeskin <player> <Skin1,Skin2,...>")]));
            const skins = parts[2].split(",").map(s => s.trim()).filter(Boolean);
            for (const skin of skins) await roblox({ cmd: "removeskin", identifier: target, skin, sender });
            return msg.channel.send(OK("Skin removida", [
                field("Player",  target),
                field("Skin(s)", skins.join(", ")),
                field("Admin",   sender),
            ]));
        }

        // ── :coins <player> <quantidade> ─────────────────────
        if (cmd === ":coins") {
            const amount = parseInt(parts[2]);
            if (!target || isNaN(amount))
                return msg.channel.send(ERR("Uso incorreto", [field("Sintaxe", ":coins <player> <quantidade>")]));
            await roblox({ cmd: "coins", identifier: target, amount, sender });
            return msg.channel.send(OK("Coins enviadas", [
                field("Player",     target),
                field("Quantidade", amount.toLocaleString()),
                field("Admin",      sender),
            ]));
        }

        // ── :givevip / :giverainbow / :givepink ──────────────
        if (TAGS[cmd]) {
            if (!target)
                return msg.channel.send(ERR("Uso incorreto", [field("Sintaxe", `${cmd} <player>`)]));
            const tag = TAGS[cmd];
            await roblox({ cmd: "givetag", identifier: target, tag, sender });
            return msg.channel.send(OK("Tag enviada", [
                field("Player", target),
                field("Tag",    tag),
                field("Admin",  sender),
            ]));
        }

        // ── :givetag <player> <tagName> ──────────────────────
        if (cmd === ":givetag") {
            if (!target || !parts[2])
                return msg.channel.send(ERR("Uso incorreto", [field("Sintaxe", ":givetag <player> <tagName>")]));
            await roblox({ cmd: "givetag", identifier: target, tag: parts[2], sender });
            return msg.channel.send(OK("Tag enviada", [
                field("Player", target),
                field("Tag",    parts[2]),
                field("Admin",  sender),
            ]));
        }

        // ── :setrole <player> <role> <true|false> ────────────
        if (cmd === ":setrole") {
            if (!target || !parts[2] || parts[3] === undefined)
                return msg.channel.send(ERR("Uso incorreto", [field("Sintaxe", ":setrole <player> <role> <true/false>")]));
            const give = parts[3] === "true";
            await roblox({ cmd: "setrole", identifier: target, role: parts[2], give, sender });
            return msg.channel.send(OK(give ? "Role concedida" : "Role removida", [
                field("Player", target),
                field("Role",   parts[2]),
                field("Admin",  sender),
            ]));
        }

        // ── :disablepowers / :enablepowers ───────────────────
        if (cmd === ":disablepowers" || cmd === ":enablepowers") {
            const enable = cmd === ":enablepowers";
            await roblox({ cmd: cmd.slice(1), sender });
            return msg.channel.send(OK(enable ? "Poderes ativados" : "Poderes desativados", [
                field("Afeta",  "Todos os players"),
                field("Admin",  sender),
            ]));
        }

        // ── Skin shortcuts (:lorefied, :witch, etc.) ─────────
        if (SKINS[cmd]) {
            if (!target)
                return msg.channel.send(ERR("Uso incorreto", [field("Sintaxe", `${cmd} <player>`)]));
            const { skins, remove } = SKINS[cmd];
            for (const skin of skins)
                await roblox({ cmd: remove ? "removeskin" : "giveskin", identifier: target, skin, sender });
            return msg.channel.send(OK(remove ? "Skin removida" : "Skin enviada", [
                field("Player",  target),
                field("Skin(s)", skins.join(", ")),
                field("Admin",   sender),
            ]));
        }

        // ── Role shortcuts (:iconic, :honored, etc.) ─────────
        if (ROLES[cmd]) {
            if (!target)
                return msg.channel.send(ERR("Uso incorreto", [field("Sintaxe", `${cmd} <player>`)]));
            const { role, give } = ROLES[cmd];
            await roblox({ cmd: "setrole", identifier: target, role, give, sender });
            return msg.channel.send(OK(give ? "Role concedida" : "Role removida", [
                field("Player", target),
                field("Role",   role),
                field("Admin",  sender),
            ]));
        }

    } catch (err) {
        console.error(`[ERRO] ${cmd} →`, err.message);
        msg.channel.send(ERR("Falha na comunicação com o Roblox", [
            field("Comando", cmd),
            field("Erro",    err.message, false),
        ]));
    }
});

client.once(Events.ClientReady, () => {
    console.log(`[Bot] Online como ${client.user.tag}`);
    client.user.setActivity("HNF Admin", { type: 3 }); // "Watching HNF Admin"
});

// ═══════════════════════════════════════════════════════════════
// HTTP — Railway keepalive
// ═══════════════════════════════════════════════════════════════
const app = express();
app.use(express.json());
app.get("/", (_req, res) => res.send("HNF Bot online ✅"));
app.listen(Number(PORT), () => console.log(`[Bot] HTTP na porta ${PORT}`));

client.login(DISCORD_TOKEN);
