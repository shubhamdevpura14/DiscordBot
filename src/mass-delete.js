// Handles mass deletion of messages

'use strict';

const bot = require("./bot")();
const utils = require("./utils");

module.exports = async function() {
	const popupButton = this.querySelector(".mass-delete-popup");
	const statusBox = this.querySelector("#deletion-status");
	const status = new utils.Status(popupButton, statusBox, this);
	status.waiting("Deleting messages...");

	let section = this.querySelector("#section-mass-delete");

	let guilds = utils.guilds(section);
	let hasMessages = false;
	for (let i = 0; i < guilds.length; ++i) {
		try {
			const id = guilds[i].id;
			const {channels} = utils.channels(section, id);

			for (let j = 0; j < channels.length; ++j) {
				const channel = channels[j];

				let msgs, lastMessageId = '';
				while (msgs = await channel.fetchMessages({limit: 100, before: lastMessageId})) {
					//read 100 messages at a time
					await utils.wait();
					if (msgs.size <= 1) break;

					for (let [, msg] of msgs) {
						lastMessageId = msg.id;
						if (msg.author.id !== bot.user.id) continue;
						hasMessages = true;
						if (msg.type === 'DEFAULT') {
							await msg.edit(":ok_hand:");
							await utils.wait();
						}
						msg.delete();
						await utils.wait();
					}
				}
			}
		} catch (err) {
			this.querySelector("#notes").append(`<div>An error occured while deleting: ${err.message}</div>`);
		}
	}

	const DMs = utils.DMs(section);
	for (let i = 0; i < DMs.length; ++i) {
		let DM = DMs[i];
		let msgs, lastMessageId = '';
		while (msgs = await DM.fetchMessages({limit: 100, before: lastMessageId})) {
			//read 100 messages at a time
			await utils.wait();
			if (msgs.size <= 1) break;

			for (let [, msg] of msgs) {
				lastMessageId = msg.id;
				if (msg.author.id !== bot.user.id) continue;
				hasMessages = true;
				if (msg.type === 'DEFAULT') {
					await msg.edit(":ok_hand:");
					await utils.wait();
				}
				msg.delete();
				await utils.wait();
			}
		}
	}

	if (!hasMessages) return status.error("There were no messages to delete.");

	status.success("Messages edited and deleted successfully.");
}