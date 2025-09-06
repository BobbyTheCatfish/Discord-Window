// @ts-check
const { GoogleSpreadsheet } = require("google-spreadsheet");
const Discord = require("discord.js");
const moment = require("moment-timezone");
const config = require("./config.json");
const sfr = require("./sf.json");
const sft = require("./sft.json");
const sf = config.devMode ? sft : sfr;

const sheet = new GoogleSpreadsheet(config.google.sheet);
let loaded;

function isLoaded() {
    return loaded;
}

async function loadSheet(attempt = 0) {
    try {
        await sheet.useServiceAccountAuth(config.google.creds);
        await sheet.loadInfo();

        loaded = true;
    } catch (error) {
        if (attempt > 4) {
            console.error("Couldn't load sheet info.");
            process.exit();
        }

        console.log(`Couldn't load sheet info (Attempt ${attempt + 1}). Retrying in 1 minute...`);

        setTimeout(() => {
            loadSheet(attempt + 1);
        }, 60_000);
    }
}

let paused = false;

/** @param {boolean} newState */
function setPaused(newState) {
    paused = newState;
}

function isPaused() {
    return paused;
}

const idsToSheets = new Discord.Collection()
    .set(sf.icarusDev, { id: sf.icarusDev, name: "Icarus Dev" })
    .set(sf.logistics, { id: sf.logistics, name: "Logistics" })
    .set(sf.modDiscussion, { id: sf.modDiscussion, name: "Mod Discussion" })
    .set(sf.team, { id: sf.team, name: "Team" });

/** @param {moment.MomentInput} [t] */
const time = (t) => moment(t).tz("America/Denver").format("MMMM Do @ h:mm A");

/**
 * @param {Discord.Client} client
 * @param {string} userID
 */
function avatar(client, userID) {
    const usr = client.users.cache.get(userID);
    return `=IMAGE("${usr?.displayAvatarURL({ size: 256, extension: "jpeg" })}")`;
}

/** @param {Discord.Message} [msg]*/
function header(msg) {
    if (!msg) return `📤 BobbyTheCatfish  ${time()}`;
    return `📥 ${msg.member?.displayName ?? msg.author.displayName}  ${time(msg.createdAt)}`;
}

/** @param {Discord.Message} msg */
function replace(msg) {
    const emojiRegex = /<a?(:.+:)\d{10,}>/;
    return msg.content.replace(emojiRegex, (str) => {
        return str.match(/:[^:<>]+:/)?.[0] ?? "";
    }) || null;
}

/** @param {Discord.Message<true>} msg  */
function mapMessage(msg) {
    let rows = [`${header(msg)}\n${replace(msg)}`];
    rows.push();

    if (msg.stickers.size > 0) rows.push(`=IMAGE("${msg.stickers.first()?.url}")`);
    if (msg.attachments.size > 0) rows = rows.concat(msg.attachments.map(m => `=IMAGE("${m.url}")`));
    return rows.map(r => ({
        PFP: avatar(msg.client, msg.author.id),
        Message: r,
        MessageID: msg.id,
        ChannelID: msg.channel.id,
        Channel: msg.channel.name
    }));
}

module.exports = {
    sheet,
    idsToSheets,
    isLoaded,
    loadSheet,
    isPaused,
    setPaused,
    avatar,
    header,
    replace,
    mapMessage
};