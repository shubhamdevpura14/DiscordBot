// Handles exporting attachments to a zip file

'use strict';

const fs = require("fs");
const https = require("https");
const utils = require("./utils");

module.exports = async function(event) {
	const clickedButton = event.srcElement;

	let statusBox = this.querySelector("#attachment-status");
	const status = new utils.Status(clickedButton, statusBox, this);
	status.message("Choose a destination folder.");

	let section = this.querySelector("#section-backup");
	let filters = utils.filters(this);

	let folder = await ipcRenderer.invoke('folder-prompt', `Select a folder to export attachments to`);
	if (!folder) return status.error("Download canceled.");

	status.waiting("Fetching attachments...");
	const date = new Date().toLocaleString("en-US", {timeZone:"America/New_York"}).replace(/[(?:, )\/]/g, "-");
	folder = `${folder}/attachments-${date}`;

	let promises = [], errors = 0;
	let guilds = utils.guilds(section);
	let messageCount = 0, DMCount = 0;
	for (let i = 0; i < guilds.length; ++i) {
		const guildName = guilds[i].name, id = guilds[i].id;
		const {channels, users} = utils.channels(section, id);

		for (let j = 0; j < channels.length; ++j) {
			const channel = channels[j];

			let lastMessageId = filters.to;
			let msgs;
			while (msgs = await channel.fetchMessages({limit: 100, before: lastMessageId})) {
				//read 100 messages at a time
				await utils.wait();
				if (msgs.size <= 1) break;

				for (let [, msg] of msgs) {
					lastMessageId = msg.id;
					if (!msg.attachments.size || (users.size && !users.has(msg.author.id))) continue;
					if (filters.limit === messageCount || lastMessageId < filters.from) break;

					let path = `${folder}/${guildName}-${id}/${channel.name}-${channel.id}`;
					await fs.promises.mkdir(path, {recursive: true});
					for (let [, attachment] of msg.attachments) {
						let promise = new Promise(resolve => {
							const fileName = attachment.id + attachment.url.slice(attachment.url.lastIndexOf('.'));
							const resolveError = () => {
								errors += 1;
								resolve();
							}
							let stream = fs.createWriteStream(`${path}/${fileName}`);
							stream.on('finish', resolve);
							stream.on('error', resolveError);
							https.get(attachment.url, res => res.pipe(stream)).on('error', resolveError);
						});
						promises.push(promise);

						// Only download 5 attachments at a time
						if (promises.length === 5) {
							await Promise.all(promises);
							promises = [];
						}
						messageCount += 1;
						if (filters.limit === messageCount) break;
					}
				}
				if (filters.limit === messageCount || lastMessageId < filters.from) break;
			}
		}
	}

	const DMs = utils.DMs(section);
	for (let i = 0; i < DMs.length; ++i) {
		let DM = DMs[i];
		let name = DM.type === "dm" ? DM.recipient.tag : `Group (${[...DM.recipients.values()].map(user => user.tag).join(", ")})`;
		let lastMessageId = filters.to;
		let msgs;
		while (msgs = await DM.fetchMessages({limit: 100, before: lastMessageId})) {
			//read 100 messages at a time
			await utils.wait();
			if (msgs.size <= 1) break;

			for (let [, msg] of msgs) {
				lastMessageId = msg.id;
				if (!msg.attachments.size) continue;
				if (filters.limit === DMCount || lastMessageId < filters.from) break;

				let path = `${folder}/${name}`;
				await fs.promises.mkdir(path, {recursive: true});
				for (let [, attachment] of msg.attachments) {
					let promise = new Promise(resolve => {
						const fileName = attachment.id + attachment.url.slice(attachment.url.lastIndexOf('.'));
						const resolveError = () => {
							errors += 1;
							resolve();
						}
						let stream = fs.createWriteStream(`${path}/${fileName}`);
						stream.on('finish', resolve);
						stream.on('error', resolveError);
						https.get(attachment.url, res => res.pipe(stream)).on('error', resolveError);
					});
					promises.push(promise);
					if (promises.length === 5) {
						await Promise.all(promises);
						promises = [];
					}

					DMCount += 1;
					if (filters.limit === DMCount) break;
				}
			}
			if (filters.limit === DMCount || lastMessageId < filters.from) break;
		}
	}

	if (!DMCount && !messageCount) return status.error("No attachments were found.");

	await Promise.all(promises);

	let statusMessage = "Attachments saved successfully.";
	if (errors) statusMessage = `Attachments saved with ${errors} error(s).`;
	status.success(statusMessage);
}