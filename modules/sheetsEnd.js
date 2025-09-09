// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const moment = require("moment-timezone");
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
    const id = row.ChannelID ?? u.idsToSheets.find(f => f.sheet === sheetName && f.sheet !== "Other")?.id;
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

/** @param {boolean} newState  */
function pause(newState) {
    u.setPaused(newState);
    return newState ? "[Paused]" : "[Resumed]";
}

function restart() {
    setTimeout(async () => {
        await Module.client.destroy();
        process.exit();
    }, 5 * 60_000);

    return '[Restarting...]';
}

function ping() {
    return `[Pong] ${u.time()}`;
}

/** @type {Command} */
function follow(name, rows, row) {
    if (!row.ChannelID) return "[No ID]";

    const channel = getChannel(name, row);
    if (typeof channel === "string") return channel;

    if (u.idsToSheets.has(channel.id)) return "[Already Following]";
    u.idsToSheets.set(channel.id, { id: channel.id, name: channel.name, sheet: "Other" });

    return "[Followed]";
}

/** @type {Command} */
function unfollow(name, rows, row) {
    if (!row.ChannelID) return "[No ID]";

    const channel = getChannel(name, row);
    if (typeof channel === "string") return channel;

    if (!u.idsToSheets.has(channel.id)) return "[Not Following]";
    u.idsToSheets.delete(channel.id);

    return "[Followed]";
}

function following() {
    return u.idsToSheets.map(s => s.name).join("\n") || "None";
}

/** @type {Command} */
function sendMsg(name, rows, row) {
    const channel = getChannel(name, row);
    if (typeof channel === "string") return channel;

    const content = row.MessageID;
    if (!content) return "[No Message Content]";

    channel.send(content);
    return "[Sent]";
}

/** @type {Record<string, Command>} */
const commands = {
    ping,
    restart,
    send: sendMsg,
    follow,
    unfollow,
    following,
    fetch,
    pause: () => pause(true),
    resume: () => pause(false)
};

Module.setClockwork(() => {
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
    }, config.pollRateSeoonds * 1000);
});