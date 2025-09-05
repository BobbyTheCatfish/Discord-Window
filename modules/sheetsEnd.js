const Augur = require("augurbot-ts");
const u = require("../common");
const config = require("../config.json");

const Module = new Augur.Module()
.setClockwork(() => {
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