// Handles copying messages from one server to another in which you have channel creation permissions

'use strict';

const bot = require("./bot")();
const utils = require("./utils");

module.exports = async function(event) {
	const clickedButton = event.srcElement;
	if (!clickedButton.classList.contains('clone-to')) return;

	const popupButton = this.querySelector(".backup-to-server");
	const statusBox = this.querySelector("#clone-status");
	const status = new utils.Status(popupButton, statusBox, this);

	const targetGuild = bot.guilds.get(clickedButton.value);
	if (!targetGuild) return status.error("You are no longer in that server.");
	if (!targetGuild.members.get(bot.user.id).hasPermission(0x800 | 0x10000 | 0x10))
		return status.error("You no longer have channel creation access in that server.");

	status.waiting(`Copying messages to server ${clickedButton.innerHTML}...`);

	let section = this.querySelector("#section-backup");
	const filters = utils.filters(this);
	const date = new Date().toLocaleString("en-US", {timeZone:"America/New_York"});
	const category = await targetGuild.createChannel(date, {type: "category"});

	let guilds = utils.guilds(section);
	for (let i = 0; i < guilds.length; ++i) {
		try {
			const guildName = guilds[i].name, id = guilds[i].id;
			const guildAcronym = guilds[i].nameAcronym;
			const {channels, users} = utils.channels(section, id);

			for (let j = 0; j < channels.length; ++j) {
				const channel = channels[j];

				let lastMessageId = filters.to;
				let msgs, newChannel, messageCount = 0;
				while (msgs = await channel.fetchMessages({limit: 100, before: lastMessageId})) {
					//read 100 messages at a time
					await utils.wait();
					if (msgs.size <= 1) break;

					for (let [, msg] of msgs) {
						lastMessageId = msg.id;
						if ((!msg.content && !msg.attachments.size) || (users.size && !users.has(msg.author.id))) continue;
						if (filters.limit === messageCount || lastMessageId < filters.from) break;
						messageCount += 1;
						if (!newChannel) {
							if (bot.user.bot) newChannel = await targetGuild.createChannel(`${guildName} (${id}): ${channel.name} (${channel.id})`, {type: "text"});
							//keep only first 99 chars (user account naming limit)
							else newChannel = await targetGuild.createChannel(`${guildAcronym}: ${channel.name}`.slice(0, 99), {type: "text"});
							await newChannel.setParent(category);
							await utils.wait();
						}
						let date = msg.createdAt.toLocaleString("en-US", {timeZone:"America/New_York"});
						let newMessage = `(_sent on ${date}_) **${msg.author.tag}**: ${msg.content}`;
						if (msg.attachments.size) {
							newMessage += `\n\nAttachments: `;
							for (let [, attachment] of msg.attachments) newMessage += attachment.url;
						}
						// Send message in chunks of 2000 at a time (2000 is the character limit)
						// 2000 = 1996 of the message's characters + 4 characters prepended for formatting
						for (let limit = 0; limit < newMessage.length; limit += 1996) {
							await newChannel.send('>>> ' + newMessage.slice(limit, limit + 1996));
							await utils.wait();
						}
					}
					if (filters.limit === messageCount || lastMessageId < filters.from) break;
				}
			}
		} catch (err) {
			this.querySelector("#notes").append(`An error occured while scraping: ${err.message}`);
		}
	}
	if (!category.children.size) {
		category.delete("No messages to scrape");
		return status.error("There were no messages to back up.");
	}
	return status.success("Messages cloned successfully.");
}