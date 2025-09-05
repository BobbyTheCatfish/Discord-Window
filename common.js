// @ts-check
const { GoogleSpreadsheet } = require("google-spreadsheet");
const Discord = require("discord.js");
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

const idsToSheets = new Discord.Collection()
    .set(sf.icarusDev, "Icarus Dev")
    .set(sf.logistics, "Logistics")
    .set(sf.modDiscussion, "Mod Discussion")
    .set(sf.team, "Team");

module.exports = {
    sheet,
    idsToSheets,
    isLoaded,
    loadSheet
};