// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const u = require("../common");

/** @param {Discord.Message} msg */
function replace(msg) {
    const emojiRegex = /<a?(:.+:)\d{10,}>/;
    return msg.content.replace(emojiRegex, (str) => {
        return str.match(/:[^:<>]+:/)?.[0] ?? "";
    }) || null;
}

const Module = new Augur.Module()
.addCommand({
    name: "restart",
    onlyOwner: true,
    process: async (msg) => {
        await msg.react("🛏️");
        await msg.client.destroy();
        return process.exit();
    }
})
.addEvent("messageCreate", async (msg) => {
    if (msg.author.bot || msg.author.system || msg.webhookId || !u.isLoaded()) return;

    const sheetName = u.idsToSheets.get(msg.channelId);
    if (!sheetName) return;

    const worksheet = u.sheet.sheetsByTitle[sheetName];
    if (!worksheet) return;

    // @ts-ignore
    worksheet.addRows([{
        Author: msg.author.displayName,
        "Sent At": msg.createdTimestamp,
        Content: replace(msg) || "Attachment"
    }]);
});

module.exports = Module;