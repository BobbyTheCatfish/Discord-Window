// @ts-check
const Augur = require("augurbot-ts");
const u = require("../common");

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
        Content: u.replace(msg) || "Attachment"
    }]);
});

module.exports = Module;