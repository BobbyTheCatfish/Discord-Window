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

function setIsLoaded() {
    loaded = true;
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
    setIsLoaded
};