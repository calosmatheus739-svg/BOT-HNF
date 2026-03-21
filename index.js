require("dotenv").config();
const { Client, GatewayIntentBits, Events } = require("discord.js");
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const DISCORD_TOKEN      = process.env.DISCORD_TOKEN;
const ROBLOX_API_KEY     = process.env.ROBLOX_API_KEY;
const ROBLOX_UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;
const ADMIN_CHANNEL_ID   = process.env.ADMIN_CHANNEL_ID;
const ALLOWED_ROLE_ID    = process.env.ALLOWED_ROLE_ID;
const PORT               = process.env.PORT || 3000;

// ============================================================
// DEDUPLICADOR — impede processar a mesma mensagem 2x ou 3x
// (acontece quando múltiplos deploys ficam ativos no Railway)
// ============================================================
const processedMessages = new Set();
function isDuplicate(id) {
    if (processedMessages.has(id)) return true;
    processedMessages.add(id);
    setTimeout(() => processedMessages.delete(id), 10_000);
    return false;
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

async function sendToRoblox(data) {
    const url = `https://apis.roblox.com/messaging-service/v1/universes/${ROBLOX_UNIVERSE_ID}/topics/AdminCommands`;
    const res = await axios.post(
        url,
        { message: JSON.stringify(data) },
        { headers: { "x-api-key": ROBLOX_API_KEY, "Content-Type": "application/json" } }
    );
    return res.status === 200;
}

const SKIN_COMMANDS = {
    ":witch":          { skins: ["AgathaHarknessBad", "AgathaHarknessYouth"] },
    ":firefairy":      { skins: ["Bloom", "DarkBloom"] },
    ":devilfied":      { skins: ["MagikDevil"] },
    ":promraven":      { skins: ["PromRaven"] },
    ":unpromraven":    { skins: ["PromRaven"],           remove: true },
    ":esdeath":        { skins: ["IceWitchEsdeath"] },
    ":starlight":      { skins: ["AgathaLight"] },
    ":promqueen":      { skins: ["ZatProm"] },
    ":unpromqueen":    { skins: ["ZatProm"],             remove: true },
    ":promdevil":      { skins: ["Roman"] },
    ":unpromdevil":    { skins: ["Roman"],               remove: true },
    ":madisonfied":    { skins: ["Y2KMadison"] },
    ":unmadisonfied":  { skins: ["Y2KMadison"],          remove: true },
    ":goldified":      { skins: ["SabrinaGoldenRuler"] },
    ":ungoldified":    { skins: ["SabrinaGoldenRuler"],  remove: true },
    ":lordified":      { skins: ["ChildKlarion"] },
    ":unlordified":    { skins: ["ChildKlarion"],        remove: true },
    ":childpink":      { skins: ["ChildKlarionPink"] },
    ":unchildpink":    { skins: ["ChildKlarionPink"],    remove: true },
    ":starog":         { skins: ["AgathaLightCivil"] },
    ":unstarog":       { skins: ["AgathaLightCivil"],    remove: true },
    ":lorefied":       { skins: ["WednesdayLore"] },
    ":unlorefied":     { skins: ["WednesdayLore"],       remove: true },
    ":promified":      { skins: ["GwenProm"] },
    ":unpromified":    { skins: ["GwenProm"],            remove: true },
    ":sunnygwen":      { skins: ["SunnyGwen"] },
    ":unsunnygwen":    { skins: ["SunnyGwen"],           remove: true },
    ":bride":          { skins: ["InvisibleWomanBride"] },
    ":unbride":        { skins: ["InvisibleWomanBride"], remove: true },
    ":carrie":         { skins: ["ElevenCarrie"] },
    ":uncarrie":       { skins: ["ElevenCarrie"],        remove: true },
    ":sakura":         { skins: ["PsylockeSakura"] },
    ":unsakura":       { skins: ["PsylockeSakura"],      remove: true },
    ":smantis":        { skins: ["SquidWorker"] },
    ":spanther":       { skins: ["SquidSoldier"] },
    ":doll":           { skins: ["RobotDoll"] },
    ":koriy2k":        { skins: ["SolarisY2K"] },
    ":cosmic":         { skins: ["DarkPhoenixCosmic"] },
    ":redqueen":       { skins: ["RedQueen"] },
    ":unredqueen":     { skins: ["RedQueen"],            remove: true },
    ":unzee":          { skins: ["ZatannaZeZe"],         remove: true },
};

const ROLE_COMMANDS = {
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

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== ADMIN_CHANNEL_ID) return;

    // bloqueia duplicatas causadas por múltiplas instâncias no Railway
    if (isDuplicate(message.id)) return;

    const member = message.member;
    if (!member || !member.roles.cache.has(ALLOWED_ROLE_ID))
        return message.reply("❌ Você não tem permissão.");

    const args       = message.content.trim().split(/\s+/);
    const cmd        = args[0].toLowerCase();
    const identifier = args[1];
    const sender     = message.author.username;

    // :giveskin <player> <Skin1,Skin2,...>
    if (cmd === ":giveskin") {
        const skinsRaw = args[2];
        if (!identifier || !skinsRaw)
            return message.reply("❌ Uso: `:giveskin <player> <Skin1,Skin2,...>`");
        const skins = skinsRaw.split(",").map(s => s.trim()).filter(Boolean);
        let ok = 0;
        for (const skin of skins)
            if (await sendToRoblox({ cmd: "giveskin", identifier, skin, sender }).catch(() => false)) ok++;
        return message.reply(`✅ **${ok}/${skins.length}** skin(s) enviada(s) para **${identifier}**.`);
    }

    // :removeskin <player> <Skin1,Skin2,...>
    if (cmd === ":removeskin") {
        const skinsRaw = args[2];
        if (!identifier || !skinsRaw)
            return message.reply("❌ Uso: `:removeskin <player> <Skin1,Skin2,...>`");
        const skins = skinsRaw.split(",").map(s => s.trim()).filter(Boolean);
        let ok = 0;
        for (const skin of skins)
            if (await sendToRoblox({ cmd: "removeskin", identifier, skin, sender }).catch(() => false)) ok++;
        return message.reply(`✅ **${ok}/${skins.length}** skin(s) removida(s) de **${identifier}**.`);
    }

    // :coins <player> <quantidade>
    if (cmd === ":coins") {
        const amount = parseInt(args[2]);
        if (!identifier || isNaN(amount))
            return message.reply("❌ Uso: `:coins <player> <quantidade>`");
        const ok = await sendToRoblox({ cmd: "coins", identifier, amount, sender }).catch(() => false);
        return message.reply(ok
            ? `✅ **${amount.toLocaleString()}** coins enviadas para **${identifier}**.`
            : "❌ Falha ao enviar para o Roblox.");
    }

    // :givevip / :giverainbow / :givepink
    if ([":givevip", ":giverainbow", ":givepink"].includes(cmd)) {
        if (!identifier) return message.reply(`❌ Uso: \`${cmd} <player>\``);
        const tagMap = { ":givevip": "VipTag", ":giverainbow": "RainbowTag", ":givepink": "PinkTag" };
        const tag = tagMap[cmd];
        const ok = await sendToRoblox({ cmd: "givetag", identifier, tag, sender }).catch(() => false);
        return message.reply(ok
            ? `✅ Tag **${tag}** enviada para **${identifier}**.`
            : "❌ Falha ao enviar para o Roblox.");
    }

    // :givetag <player> <tagName>
    if (cmd === ":givetag") {
        const tag = args[2];
        if (!identifier || !tag) return message.reply("❌ Uso: `:givetag <player> <tagName>`");
        const ok = await sendToRoblox({ cmd: "givetag", identifier, tag, sender }).catch(() => false);
        return message.reply(ok
            ? `✅ Tag **${tag}** enviada para **${identifier}**.`
            : "❌ Falha ao enviar para o Roblox.");
    }

    // :setrole <player> <role> <true/false>
    if (cmd === ":setrole") {
        const role = args[2], giveStr = args[3];
        if (!identifier || !role || giveStr === undefined)
            return message.reply("❌ Uso: `:setrole <player> <role> <true/false>`");
        const give = giveStr === "true";
        const ok = await sendToRoblox({ cmd: "setrole", identifier, role, give, sender }).catch(() => false);
        return message.reply(ok
            ? `✅ Role **${role}** ${give ? "dada a" : "removida de"} **${identifier}**.`
            : "❌ Falha ao enviar para o Roblox.");
    }

    // :disablepowers / :enablepowers
    if (cmd === ":disablepowers" || cmd === ":enablepowers") {
        const ok = await sendToRoblox({ cmd: cmd.slice(1), sender }).catch(() => false);
        return message.reply(ok
            ? `✅ **${cmd === ":enablepowers" ? "Poderes ativados" : "Poderes desativados"}** para todos.`
            : "❌ Falha ao enviar para o Roblox.");
    }

    // skin shortcuts (:lorefied, :promified, :witch, etc.)
    if (SKIN_COMMANDS[cmd]) {
        if (!identifier) return message.reply(`❌ Uso: \`${cmd} <player>\``);
        const { skins, remove } = SKIN_COMMANDS[cmd];
        const action = remove ? "removeskin" : "giveskin";
        let ok = 0;
        for (const skin of skins)
            if (await sendToRoblox({ cmd: action, identifier, skin, sender }).catch(() => false)) ok++;
        return message.reply(
            `✅ **${ok}/${skins.length}** skin(s) ${remove ? "removida(s) de" : "enviada(s) para"} **${identifier}**: \`${skins.join(", ")}\``
        );
    }

    // role shortcuts (:iconic, :honored, etc.)
    if (ROLE_COMMANDS[cmd]) {
        if (!identifier) return message.reply(`❌ Uso: \`${cmd} <player>\``);
        const { role, give } = ROLE_COMMANDS[cmd];
        const ok = await sendToRoblox({ cmd: "setrole", identifier, role, give, sender }).catch(() => false);
        return message.reply(ok
            ? `✅ Role **${role}** ${give ? "dada a" : "removida de"} **${identifier}**.`
            : "❌ Falha ao enviar para o Roblox.");
    }
});

app.get("/", (req, res) => res.send("HNF Bot online ✅"));
app.listen(PORT, () => console.log(`[Bot] HTTP na porta ${PORT}`));
client.once(Events.ClientReady, () => console.log(`[Bot] Conectado como ${client.user.tag}`));
client.login(DISCORD_TOKEN);
