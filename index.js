require("dotenv").config();
const { Client, GatewayIntentBits, Events } = require("discord.js");
const express = require("express");
const axios   = require("axios");

// ── ENV ────────────────────────────────────────────────────────
const DISCORD_TOKEN      = process.env.DISCORD_TOKEN;
const ROBLOX_API_KEY     = process.env.ROBLOX_API_KEY;
const ROBLOX_UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;
const ADMIN_CHANNEL_ID   = process.env.ADMIN_CHANNEL_ID;
const ALLOWED_ROLE_ID    = process.env.ALLOWED_ROLE_ID;
const PORT               = process.env.PORT || 3000;

// ── DISCORD CLIENT (uma única instância, sem sharding) ─────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// ── DEDUP ──────────────────────────────────────────────────────
// Guarda IDs de mensagens já processadas nesta instância.
// Resolve duplicatas causadas por reconexões do WebSocket do discord.js.
// Para garantir UMA instância no Railway: mantenha APENAS 1 deployment ativo.
const handled = new Set();
function alreadyHandled(id) {
    if (handled.has(id)) return true;
    handled.add(id);
    setTimeout(() => handled.delete(id), 30_000);
    return false;
}

// ── ROBLOX MESSAGING ───────────────────────────────────────────
async function sendToRoblox(payload) {
    await axios.post(
        `https://apis.roblox.com/messaging-service/v1/universes/${ROBLOX_UNIVERSE_ID}/topics/AdminCommands`,
        { message: JSON.stringify(payload) },
        { headers: { "x-api-key": ROBLOX_API_KEY, "Content-Type": "application/json" } }
    );
}

// ── COMANDOS ───────────────────────────────────────────────────
const SKIN_MAP = {
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

const ROLE_MAP = {
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

const TAG_MAP = {
    ":givevip":     "VipTag",
    ":giverainbow": "RainbowTag",
    ":givepink":    "PinkTag",
};

// ── HANDLER ────────────────────────────────────────────────────
client.on(Events.MessageCreate, async (msg) => {
    // Filtros básicos
    if (msg.author.bot)                          return;
    if (msg.channel.id !== ADMIN_CHANNEL_ID)     return;
    if (alreadyHandled(msg.id))                  return;

    // Permissão
    if (!msg.member?.roles.cache.has(ALLOWED_ROLE_ID))
        return msg.reply("❌ Você não tem permissão.");

    const args   = msg.content.trim().split(/\s+/);
    const cmd    = args[0].toLowerCase();
    const target = args[1] ?? null;
    const sender = msg.author.username;

    try {

        // ── :giveskin <player> <Skin1,Skin2,...> ──────────────
        if (cmd === ":giveskin") {
            if (!target || !args[2]) return msg.reply("❌ Uso: `:giveskin <player> <Skin1,Skin2,...>`");
            const skins = args[2].split(",").map(s => s.trim()).filter(Boolean);
            for (const skin of skins)
                await sendToRoblox({ cmd: "giveskin", identifier: target, skin, sender });
            return msg.reply(`✅ ${skins.length} skin(s) enviada(s) para **${target}**: \`${skins.join(", ")}\``);
        }

        // ── :removeskin <player> <Skin1,Skin2,...> ────────────
        if (cmd === ":removeskin") {
            if (!target || !args[2]) return msg.reply("❌ Uso: `:removeskin <player> <Skin1,Skin2,...>`");
            const skins = args[2].split(",").map(s => s.trim()).filter(Boolean);
            for (const skin of skins)
                await sendToRoblox({ cmd: "removeskin", identifier: target, skin, sender });
            return msg.reply(`✅ ${skins.length} skin(s) removida(s) de **${target}**: \`${skins.join(", ")}\``);
        }

        // ── :coins <player> <quantidade> ──────────────────────
        if (cmd === ":coins") {
            const amount = parseInt(args[2]);
            if (!target || isNaN(amount)) return msg.reply("❌ Uso: `:coins <player> <quantidade>`");
            await sendToRoblox({ cmd: "coins", identifier: target, amount, sender });
            return msg.reply(`✅ **${amount.toLocaleString()}** coins enviadas para **${target}**.`);
        }

        // ── :givevip / :giverainbow / :givepink ───────────────
        if (TAG_MAP[cmd]) {
            if (!target) return msg.reply(`❌ Uso: \`${cmd} <player>\``);
            const tag = TAG_MAP[cmd];
            await sendToRoblox({ cmd: "givetag", identifier: target, tag, sender });
            return msg.reply(`✅ Tag **${tag}** enviada para **${target}**.`);
        }

        // ── :givetag <player> <tagName> ───────────────────────
        if (cmd === ":givetag") {
            if (!target || !args[2]) return msg.reply("❌ Uso: `:givetag <player> <tagName>`");
            await sendToRoblox({ cmd: "givetag", identifier: target, tag: args[2], sender });
            return msg.reply(`✅ Tag **${args[2]}** enviada para **${target}**.`);
        }

        // ── :setrole <player> <role> <true|false> ─────────────
        if (cmd === ":setrole") {
            if (!target || !args[2] || args[3] === undefined)
                return msg.reply("❌ Uso: `:setrole <player> <role> <true/false>`");
            const give = args[3] === "true";
            await sendToRoblox({ cmd: "setrole", identifier: target, role: args[2], give, sender });
            return msg.reply(`✅ Role **${args[2]}** ${give ? "dada a" : "removida de"} **${target}**.`);
        }

        // ── :disablepowers / :enablepowers ────────────────────
        if (cmd === ":disablepowers" || cmd === ":enablepowers") {
            await sendToRoblox({ cmd: cmd.slice(1), sender });
            return msg.reply(`✅ **${cmd === ":enablepowers" ? "Poderes ativados" : "Poderes desativados"}** para todos.`);
        }

        // ── Skin shortcuts (:lorefied, :witch, etc.) ──────────
        if (SKIN_MAP[cmd]) {
            if (!target) return msg.reply(`❌ Uso: \`${cmd} <player>\``);
            const { skins, remove } = SKIN_MAP[cmd];
            for (const skin of skins)
                await sendToRoblox({ cmd: remove ? "removeskin" : "giveskin", identifier: target, skin, sender });
            return msg.reply(
                `✅ \`${skins.join(", ")}\` ${remove ? "removida(s) de" : "enviada(s) para"} **${target}**.`
            );
        }

        // ── Role shortcuts (:iconic, :honored, etc.) ──────────
        if (ROLE_MAP[cmd]) {
            if (!target) return msg.reply(`❌ Uso: \`${cmd} <player>\``);
            const { role, give } = ROLE_MAP[cmd];
            await sendToRoblox({ cmd: "setrole", identifier: target, role, give, sender });
            return msg.reply(`✅ Role **${role}** ${give ? "dada a" : "removida de"} **${target}**.`);
        }

    } catch (err) {
        console.error(`[ERRO] ${cmd}:`, err.message);
        return msg.reply(`❌ Erro ao enviar para o Roblox: \`${err.message}\``);
    }
});

// ── HTTP (Railway keepalive) ───────────────────────────────────
const app = express();
app.use(express.json());
app.get("/", (_req, res) => res.send("HNF Bot online ✅"));
app.listen(PORT, () => console.log(`[Bot] HTTP na porta ${PORT}`));

// ── START ──────────────────────────────────────────────────────
client.once(Events.ClientReady, () => console.log(`[Bot] Online como ${client.user.tag}`));
client.login(DISCORD_TOKEN);
