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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

async function sendToRoblox(data) {
    const url = `https://apis.roblox.com/messaging-service/v1/universes/${ROBLOX_UNIVERSE_ID}/topics/AdminCommands`;
    const response = await axios.post(
        url,
        { message: JSON.stringify(data) },
        {
            headers: {
                "x-api-key": ROBLOX_API_KEY,
                "Content-Type": "application/json",
            },
        }
    );
    return response.status === 200;
}

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

    const member = message.member;
    if (!member || !member.roles.cache.has(ALLOWED_ROLE_ID)) {
        return message.reply("❌ Você não tem permissão.");
    }

    const args = message.content.trim().split(/\s+/);
    const cmd = args[0].toLowerCase();
    const identifier = args[1];

    // :giveskin
    if (cmd === ":giveskin") {
        const skinsRaw = args[2];
        if (!identifier || !skinsRaw)
            return message.reply("❌ Uso: `:giveskin <player> <Skin1,Skin2,...>`");

        const skins = skinsRaw.split(",").map(s => s.trim()).filter(Boolean);
        let success = 0;
        for (const skin of skins) {
            const ok = await sendToRoblox({ cmd: "giveskin", identifier, skin, sender: message.author.username }).catch(() => false);
            if (ok) success++;
        }
        return message.reply(`✅ **${success}/${skins.length}** skins enviadas para **${identifier}**.`);
    }

    // :removeskin
    if (cmd === ":removeskin") {
        const skinsRaw = args[2];
        if (!identifier || !skinsRaw)
            return message.reply("❌ Uso: `:removeskin <player> <Skin1,Skin2,...>`");

        const skins = skinsRaw.split(",").map(s => s.trim()).filter(Boolean);
        let success = 0;
        for (const skin of skins) {
            const ok = await sendToRoblox({ cmd: "removeskin", identifier, skin, sender: message.author.username }).catch(() => false);
            if (ok) success++;
        }
        return message.reply(`✅ **${success}/${skins.length}** skins removidas de **${identifier}**.`);
    }

    // :coins
    if (cmd === ":coins") {
        const amount = parseInt(args[2]);
        if (!identifier || isNaN(amount))
            return message.reply("❌ Uso: `:coins <player> <quantidade>`");

        const ok = await sendToRoblox({ cmd: "coins", identifier, amount, sender: message.author.username }).catch(() => false);
        return message.reply(ok
            ? `✅ **${amount}** coins enviadas para **${identifier}**.`
            : "❌ Falha ao enviar para o Roblox."
        );
    }

    // :givevip / :giverainbow / :givepink
    if ([":givevip", ":giverainbow", ":givepink"].includes(cmd)) {
        if (!identifier)
            return message.reply(`❌ Uso: \`${cmd} <player>\``);

        const tagMap = { ":givevip": "VipTag", ":giverainbow": "RainbowTag", ":givepink": "PinkTag" };
        const ok = await sendToRoblox({ cmd: "givetag", identifier, tag: tagMap[cmd], sender: message.author.username }).catch(() => false);
        return message.reply(ok
            ? `✅ Tag **${tagMap[cmd]}** enviada para **${identifier}**.`
            : "❌ Falha ao enviar para o Roblox."
        );
    }

    // roles
    if (ROLE_COMMANDS[cmd]) {
        if (!identifier)
            return message.reply(`❌ Uso: \`${cmd} <player>\``);

        const { role, give } = ROLE_COMMANDS[cmd];
        const ok = await sendToRoblox({ cmd: "setrole", identifier, role, give, sender: message.author.username }).catch(() => false);
        return message.reply(ok
            ? `✅ Role **${role}** ${give ? "dada" : "removida"} de **${identifier}**.`
            : "❌ Falha ao enviar para o Roblox."
        );
    }
});

app.get("/", (req, res) => res.send("HNF Bot online ✅"));
app.listen(PORT, () => console.log(`[Bot] Servidor HTTP rodando na porta ${PORT}`));

client.once(Events.ClientReady, () => console.log(`[Bot] Discord conectado como ${client.user.tag}`));
client.login(DISCORD_TOKEN);
