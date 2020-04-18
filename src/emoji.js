'use strict';

const fs = require("fs");
const https = require("https");
const utils = require("./utils");

const bot = require("./bot")();

module.exports = async function(event) {
	let clickedButton = event.srcElement;
	if (!clickedButton.classList.contains('download-emoji')) return;

	let guildId = clickedButton.value;
	let statusBox = this.querySelector(`div.guild-${guildId} div.status`)

	const status = new utils.Status(clickedButton, statusBox, this);
	status.message("Choose a destination folder.");

	let guild = bot.guilds.get(guildId);
	if (!guild) return status.error("Your bot is no longer in this server.");

	let path = await ipcRenderer.invoke('folder-prompt', `Select a folder to export ${guild.name}'s emojis to`);
	if (!path) return status.error("Download canceled.");

	status.waiting("Fetching emojis...");
	const date = new Date().toLocaleString("en-US", {timeZone:"America/New_York"}).replace(/[(?:, )\/]/g, "-");
	path = `${path}/emojis-${guild.name.replace(/ /g, '-')}-${date}`;
	await fs.promises.mkdir(path);

	let promises = [];
	let errors = 0;
	for (let [, emoji] of guild.emojis) {
		let fileName = emoji.name + emoji.url.slice(emoji.url.lastIndexOf('.'));
		let promise = new Promise(resolve => {
			const resolveError = () => {
				errors += 1;
				resolve();
			}
			let stream = fs.createWriteStream(`${path}/${fileName}`);
			stream.on('finish', resolve);
			stream.on('error', resolveError);
			https.get(emoji.url, res => res.pipe(stream)).on('error', resolveError);
		});
		promises.push(promise);
		// Only download 5 attachments at a time
		if (promises.length === 5) {
			await Promise.all(promises);
			promises = [];
		}
	}
	await Promise.all(promises);

	let statusMessage = "Emojis saved successfully.";
	if (errors) statusMessage = `Emojis saved with ${errors} error(s).`;
	status.success(statusMessage);
}