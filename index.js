// @ts-check
const Augur = require("augurbot-ts");
const Discord = require("discord.js");
const u = require("./common");
const config = require("./config.json");

const client = new Augur.AugurClient({
    events: ["messageCreate", "guildUpdate", "guildMemberUpdate"],
    ownerId: config.ownerId,
    token: config.botToken,
    prefix: config.prefix,
}, {
    clientOptions: {
        allowedMentions: { parse: ["roles", "users"] },
        failIfNotExists: false
    },
    delayStart: u.loadSheet,
    modules: "modules"
});

client.login(config.botToken);


/******************
 * ERROR HANDLING *
 ******************/

/**
 * Handles a command exception/error. Most likely called from a catch.
 * Reports the error and lets the user know.
 * @param {Error | null} [error] The error to report.
 * @param {any} message Any Discord.Message, Discord.BaseInteraction, or text string.
 */
async function errorHandler(error, message = null) {
    if (!error || (error.name === "AbortError")) return;

    console.error(Date());

    const embed = new Discord.EmbedBuilder({ color: 0x427654 }).setTitle(error?.name?.toString() ?? "Error");

    if (message instanceof Discord.Message) {
        const loc = (message.inGuild() ? `${message.guild?.name} > ${message.channel?.name}` : "DM");
        console.error(`${message.author.username} in ${loc}: ${message.cleanContent}`);

        embed.addFields(
            { name: "User", value: message.author.username, inline: true },
            { name: "Location", value: loc, inline: true },
            { name: "Command", value: message.cleanContent || "`undefined`", inline: true }
        );
    } else if (typeof message === "string") {
        console.error(message);
        embed.addFields({ name: "Message", value: message });
    }

    console.trace(error);

    let stack = (error.stack ? error.stack : error.toString());
    if (stack.length > 4096) stack = stack.slice(0, 4000);

    embed.setDescription(stack);
    return new Discord.WebhookClient({ url: config.errorHook }).send({ embeds: [embed], username: "Bobby's Window Errors", avatarURL: "https://www.thompsoncreek.com/wp-content/uploads/2021/05/shutterstock_315289424-scaled.jpg" });
}

// LAST DITCH ERROR HANDLING
process.on("unhandledRejection", (error, p) => p.catch(e => errorHandler(e, "Unhandled Rejection")));
process.on("uncaughtException", (error) => errorHandler(error, "Uncaught Exception"));