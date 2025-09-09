// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const u = require("../common");
const config = require("../config.json");

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
    if (!msg.inGuild() || !u.isLoaded() || (msg.author.bot && msg.content.startsWith(config.msgPrefix))) return;

    const sheetInfo = u.idsToSheets.get(msg.channelId);
    if (!sheetInfo) return;

    const worksheet = u.sheet.sheetsByTitle[sheetInfo.sheet];
    if (!worksheet) return;

    // @ts-ignore
    worksheet.addRows(u.mapMessage(msg));

    /** @type {string[]} */
    let attachents = [];
    if (msg.stickers.size > 0) attachents.push(msg.stickers.first()?.url ?? "STICKER");
    if (msg.attachments.size > 0) attachents = attachents.concat(msg.attachments.map(a => a.url));

    // @ts-expect-error
    if (attachents.length > 0) u.sheet.sheetsByTitle[sheetInfo.sheet].addRows(attachents.map(a => ({ Message: `=IMAGE("${a}")`, MessageID: msg.id, ChannelID: msg.channel.id, Channel: msg.channel.name, PFP: u.avatar(Module, msg.author.id) })));
})
.addEvent("ready", async () => {
    // @ts-ignore
    const existingChannels = await u.sheet.sheetsByTitle.Channels.getRows();
    const existingChannelCollection = new Discord.Collection(existingChannels.map(c => [c.ID, c]));

    const mainServer = await Module.client.guilds.fetch(u.sf.mainServer);
    const channels = mainServer.channels.cache.filter(c => c.isTextBased() && !c.isVoiceBased());

    const diff = channels.subtract(existingChannelCollection);
    if (diff.size === 0) return;

    // @ts-ignore
    u.sheet.sheetsByTitle.Channels.addRows(diff.map((ch) => ({ ID: ch.id, Channel: ch.name })));
});

module.exports = Module;