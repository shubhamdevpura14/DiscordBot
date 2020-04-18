// Handles exporting chat messages to an excel workbook

'use strict';

const excel = require("exceljs");
const fs = require("fs");
const utils = require("./utils");

module.exports = async function(event) {
	const clickedButton = event.srcElement;

	const statusBox = this.querySelector("#excel-status");
	const status = new utils.Status(clickedButton, statusBox, this);
	status.message("Choose a destination folder.");

	const date = new Date().toLocaleString("en-US", {timeZone:"America/New_York"}).replace(/[(?:, )\/]/g, "-");
	const path = await ipcRenderer.invoke('save-excel', `backup-${date}.xlsx`);
	if (!path) return status.error("Download canceled.");

	status.waiting("Fetching messages...");

	let filters = utils.filters(this);

	let section = this.querySelector("#section-backup");
	let workbook = null;
	let guilds = utils.guilds(section);

	for (let i = 0; i < guilds.length; ++i) {
		const guildName = guilds[i].name, id = guilds[i].id;
		const {channels, users} = utils.channels(section, id);

		let sheet = null;
		try {
			for (let j = 0; j < channels.length; ++j) {
				const channel = channels[j];

				let lastMessageId = filters.to;
				let msgs, messageCount = 0;
				while (msgs = await channel.fetchMessages({limit: 100, before: lastMessageId})) {
					//read 100 messages at a time
					await utils.wait();
					if (msgs.size <= 1) break;

					for (let [, msg] of msgs) {
						lastMessageId = msg.id;
						if ((!msg.content && !msg.attachments.size) || (users.size && !users.has(msg.author.id))) continue;
						if (filters.limit === messageCount || lastMessageId < filters.from) break;

						if (!workbook) workbook = new excel.stream.xlsx.WorkbookWriter({filename: path});
						if (!sheet) {
							sheet = workbook.addWorksheet(id);
							sheet.addRow([guildName]).commit();
							sheet.addRow(["Channel ID", "Channel Name", "Date Sent", "Author", "Content", "Attachments"]).commit();
						}

						let date = new Date(msg.createdTimestamp).toLocaleString("en-US", {timeZone:"America/New_York"});
						let attachments = "";
						for (let [, attachment] of msg.attachments)
							attachments += attachment.url + ", ";
						sheet.addRow([channel.id, channel.name, date, msg.author.tag, msg.content, attachments]).commit();
						messageCount += 1;
					}
					if (filters.limit === messageCount || lastMessageId < filters.from) break;
				}
			}
		} catch (err) {
			this.querySelector("#notes").append(`An error occured while scraping: ${err.message}`);
		}
		if (sheet) sheet.commit();
	}

	const DMs = utils.DMs(section);
	for (let i = 0; i < DMs.length; ++i) {
		let DM = DMs[i];
		let name = DM.type === "dm" ? DM.recipient.tag : `Group (${[...DM.recipients.values()].map(user => user.tag).join(", ")})`;
		let lastMessageId = filters.to;
		let msgs, messageCount = 0;
		let sheet = null;
		while (msgs = await DM.fetchMessages({limit: 100, before: lastMessageId})) {
			//read 100 DMs at a time
			await utils.wait();
			if (msgs.size <= 1) break;

			for (let [, msg] of msgs) {
				lastMessageId = msg.id;
				if (!msg.content && !msg.attachments.size) continue;
				if (filters.limit === messageCount || lastMessageId < filters.from) break;

				if (!workbook) workbook = new excel.stream.xlsx.WorkbookWriter({filename: path});
				if (!sheet) {
					sheet = workbook.addWorksheet(name);
					sheet.addRow(["DMs with " + name]).commit();
					sheet.addRow(["Date Sent", "Author", "Content", "Attachments"]).commit();
				}

				const date = new Date(msg.createdTimestamp).toLocaleString("en-US", {timeZone:"America/New_York"});
				let attachments = "";
				for (let [, attachment] of msg.attachments)
					attachments += attachment.url + ", ";
				sheet.addRow([date, msg.author.tag, msg.content, attachments]).commit();
				messageCount += 1;
			}
			if (filters.limit === messageCount || lastMessageId < filters.from) break;
		}
		if (sheet) sheet.commit();
	}

	if (!workbook) return status.error("There were no messages to back up.");

	workbook.commit();
	status.success("Messages backed up successfully.");
}