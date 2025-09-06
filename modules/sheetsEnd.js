// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const u = require("../common");
const config = require("../config.json");

const Module = new Augur.Module();

/**
 * @typedef {Record<string, string>} Row
 * @typedef {(name: string, rows: Row[], row: Row) => string | boolean} Command
 */

/**
 * @param {string} sheetName
 * @param {Row} row
 * @returns {string | Discord.GuildTextBasedChannel}
 */
function getChannel(sheetName, row) {
    const id = row.ChannelID ?? u.idsToSheets.find(f => f.name === sheetName && f.name !== "Other")?.id;
    if (!id) return "[No ID]";

    const channel = Module.client.channels.cache.get(id);
    if (!channel) return "[No Channel]";

    if (!channel.isTextBased()) return "[Not Text Based]";
    if (channel.isDMBased()) return "[Not In LDSG]";
    return channel;
}

/** @type {Command} */
function fetch(name, rows, row) {
    const channel = getChannel(name, row);
    if (typeof channel === "string") return channel;

    channel.messages.fetch({ limit: 50 }).then(msgs => {
        const newRows = msgs.filter(m => !rows.find(r => r.MessageID === m.id))
            .map(m => u.mapMessage(m).reverse())
            .reverse()
            .flat();

        // @ts-ignore
        u.sheet.sheetsByTitle[name].addRows(newRows);
    });

    return true;
}

Module.setClockwork(() => {
    // handle sheet > server
    let updatePromises = [];
    let sendPromises = [];
    const doStuff = async (sheetName, id) => {
        // @ts-ignore
        const chanSheet = await u.sheet.sheetsByTitle[sheetName].getRows();
        const pending = chanSheet.filter(c => c.Reply && c.Ready && !c.Replied);
        for (const pend of pending) {
            pend.Replied = "Yup";
            // @ts-expect-error
            sendPromises.push(Module.client.channels.cache.get(id)?.send(`${config.msgPrefix}: \`${pend.Reply}\``));
            updatePromises.push(pend.save());
        }
    };

    return setInterval(async () => {
        if (updatePromises.length > 0 || sendPromises.length > 0) return;
        await Promise.all(u.idsToSheets.map((name, sflk) => doStuff(name, sflk)));
        await Promise.all(updatePromises);
        await Promise.all(sendPromises);
        updatePromises = [];
        sendPromises = [];
    }, 30_000);
});