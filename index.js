// @ts-check
const Discord = require("discord.js")
const { GoogleSpreadsheet } = require("google-spreadsheet");
const config = require("./config.json");
const sf = require("./sf.json")

const client = new Discord.Client({ intents: ["MessageContent", "GuildMembers", "GuildMessages", "Guilds", "DirectMessages"], allowedMentions: { parse: ['roles', 'users']} })
const sheet = new GoogleSpreadsheet(config.google.sheet)
let loaded = false;

client.login(config.botToken);

client.on("ready", async () => {
    console.log("Bot is ready");

    await sheet.useServiceAccountAuth(config.google.creds)
    await sheet.loadInfo();

    loaded = true;
    console.log("Sheet is loaded")

    // handle sheet > server
    let updatePromises = [];
    let sendPromises = [];
    const doStuff = async (sheetName, id) => {
        // @ts-ignore
        const chanSheet = await sheet.sheetsByTitle[sheetName].getRows()
        const pending = chanSheet.filter(c => c["Reply"] && c["Ready"] && !c["Replied"])
        for (const pend of pending) {
            pend.Replied = "Yup";
            // @ts-expect-error
            sendPromises.push(client.channels.cache.get(id)?.send(`${config.msgPrefix}: \`${pend.Reply}\``))
            updatePromises.push(pend.save())
        }
    }

    // Check sheet for commands every 30 seconds
    setInterval(async () => {
        if (updatePromises.length > 0 || sendPromises.length > 0) return;
        await Promise.all(idsToSheets.map((name, sflk) => doStuff(name, sflk)))
        await Promise.all(updatePromises)
        await Promise.all(sendPromises)
        updatePromises = [];
        sendPromises = [];
    }, 30_000)
})

/** @param {Discord.Message} msg */
function replace(msg) {
    const emojiRegex = /<a?(:.+:)\d{10,}>/;
    return msg.content.replace(emojiRegex, (str) => {
        return str.match(/:[^:<>]+:/)?.[0] ?? ""
    }) || null
}

const idsToSheets = new Discord.Collection()
    .set(sf.icarusDev, "Icarus Dev")
    .set(sf.logistics, "Logistics")
    .set(sf.modDiscussion, "Mod Discussion")
    .set(sf.team, "Team")


// handle server > sheet
client.on("messageCreate", async (msg) => {
    if (msg.author.bot || msg.author.system || msg.webhookId || !loaded) return;

    const sheetName = idsToSheets.get(msg.channelId);
    if (!sheetName) return;

    const worksheet = sheet.sheetsByTitle[sheetName];
    if (!worksheet) return;

    // @ts-ignore
    worksheet.addRows([{
        Author: msg.author.displayName,
        "Sent At": msg.createdTimestamp,
        Content: replace(msg) || "Attachment"
    }])
})


/******************
 * ERROR HANDLING *
 ******************/

/**
 * Handles a command exception/error. Most likely called from a catch.
 * Reports the error and lets the user know.
 * @param {Error | null} [error] The error to report.
 * @param {any} message Any Discord.Message, Discord.BaseInteraction, or text string.
 */
async function errorHandler(error, message = null) {
    if (!error || (error.name === "AbortError")) return;

    console.error(Date());

    const embed = new Discord.EmbedBuilder({ color: 0x427654}).setTitle(error?.name?.toString() ?? "Error");

    if (message instanceof Discord.Message) {
        const loc = (message.inGuild() ? `${message.guild?.name} > ${message.channel?.name}` : "DM");
        console.error(`${message.author.username} in ${loc}: ${message.cleanContent}`);

        embed.addFields(
            { name: "User", value: message.author.username, inline: true },
            { name: "Location", value: loc, inline: true },
            { name: "Command", value: message.cleanContent || "`undefined`", inline: true }
        );
    } else if (typeof message === "string") {
        console.error(message);
        embed.addFields({ name: "Message", value: message });
    }

    console.trace(error);

    let stack = (error.stack ? error.stack : error.toString());
    if (stack.length > 4096) stack = stack.slice(0, 4000);

    embed.setDescription(stack);
    return new Discord.WebhookClient({ url: config.errorHook }).send({ embeds: [embed], username: "Bobby's Window Errors", avatarURL: "https://www.thompsoncreek.com/wp-content/uploads/2021/05/shutterstock_315289424-scaled.jpg" });
}

// LAST DITCH ERROR HANDLING
process.on("unhandledRejection", (error, p) => p.catch(e => errorHandler(e, "Unhandled Rejection")));
process.on("uncaughtException", (error) => errorHandler(error, "Uncaught Exception"));