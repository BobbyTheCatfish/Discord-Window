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
    const doStuff = async (sheetName, isBuiltIn) => {
        // @ts-ignore
        const chanSheet = await u.sheet.sheetsByTitle[sheetName].getRows();
        const cmds = chanSheet?.filter(c => c.Command && !c.Response) ?? [];

        for (const cmd of cmds) {
            const run = commands[cmd.Command](sheetName, chanSheet, cmd);
            cmd.Response = run ? typeof run === "string" ? run : '[Processing]' : '[Not Found]';
            sendPromises.push(cmd.save());
        }

        if (u.isPaused() || !isBuiltIn) return;

        const hour = moment().tz("America/Denver").hour();
        if (hour < 5) return;

        const toSend = chanSheet.filter(c => c.Reply && c.Ready && !c.Replied);
        for (const row of toSend) {
            const og = row.Message;
            row.Message = `${u.header()}\n${og}`;
            row.PFP = u.avatar(Module.client, config.ownerId);

            const channel = getChannel(sheetName, row);
            if (typeof channel === "string") {
                row.Replied = channel;
                await row.save();
            } else {
                const send = channel.send(`${config.msgPrefix}: \`${row.Reply}\``)
                    .then(async (msg) => {
                        row.MessageID = msg.id;
                        await row.save();
                    })
                    .catch(async () => {
                        row.Replied = "[Encountered Error]";
                        await row.save();
                    });
                sendPromises.push(send);
            }
            row.Replied = "[Sent]";
        }
    };

    return setInterval(async () => {
        if (!u.isLoaded()) return;
        if (sendPromises.length > 0) return;
        await Promise.all(u.idsToSheets.map((sheet) => doStuff(sheet.name, sheet.sheet !== "Other")));

        if (sendPromises.length > 0) {
            await Promise.all(sendPromises);
        }
        sendPromises = [];
    }, config.pollRateSeoonds * 1000);
})
.addEvent("ready", () => {
    setTimeout(() => {
        process.exit();
    }, 24 * 60 * 60_000);
});