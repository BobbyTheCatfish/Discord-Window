// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const moment = require("moment-timezone");
const u = require("../common");
const config = require("../config.json");

const Module = new Augur.Module();

/**
 * @typedef {(name: string, rows: u.Row[], row: u.Row) => string | boolean} Command
 */

/**
 * @param {string} sheetName
 * @param {u.Row} row
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

    channel.messages.fetch({ limit: 50, before: row.MessageID || undefined }).then(msgs => {
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

/** @type {Command} */
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
    /** @type {Promise<any>[]} */
    let sendPromises = [];
    /**
     * @param {string} sheetName
     * @param {boolean} isBuiltIn
     */
    const doStuff = async (sheetName, isBuiltIn) => {
        /** @type {u.Row[]} */
        // @ts-ignore
        const chanSheet = await u.sheet.sheetsByTitle[sheetName].getRows();

        const hourCheck = moment().tz("America/Denver").hour() < 5;

        for (const row of chanSheet) {
            let changed = false;
            if (row.Command && !row.Response) {
                const run = commands[row.Command](sheetName, chanSheet, row);
                row.Response = run ? typeof run === "string" ? run : '[Processing]' : '[Not Found]';
                changed = true;
            }

            if (!u.isPaused() && isBuiltIn && !hourCheck && row.Message && !row.MessageID && !row.PFP) {
                const ogMessage = row.Message;
                row.Message = `${u.header()}\n${ogMessage}`;
                row.PFP = u.avatar(Module.client, config.ownerId);

                const channel = getChannel(sheetName, row);
                if (typeof channel === "string") {
                    row.MessageID = channel;
                    await row.save();
                } else {
                    const send = channel.send(`${config.msgPrefix}: \`${ogMessage}\``)
                        .then(async (msg) => {
                            row.MessageID = msg.id;
                            changed = true;
                        })
                        .catch(async () => {
                            row.MessageID = "[Encountered Error]";
                            await row.save();
                        });
                    sendPromises.push(send);
                }
            }
            if (changed) sendPromises.push(row.save());

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
    }, config.pollRateSeconds * 1000);
})
.addEvent("ready", () => {
    setTimeout(() => {
        process.exit();
    }, 24 * 60 * 60_000);
});