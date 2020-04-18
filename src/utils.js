// Useful functions that are repeated used throughout the application

'use strict';

const bot = require("./bot")();
const SnowflakeUtil = require("discord.js").SnowflakeUtil;

let statusCount = 0;

module.exports = {
	// Pauses execution for some time (600 ms)
	// Used to avoid hitting the rate limit while making API calls
	wait: async () => new Promise(resolve => setTimeout(resolve, 600)),

	// Retrieve selected servers from UI
	guilds: section => {
		return [...section.querySelectorAll(`.server-list .guild`)]
			.filter(elem => !!elem.checked)
			.map(elem => bot.guilds.get(elem.value));
	},
	// Retrieve selected channels and users in a server
	channels: (section, guildID) => {
		const guild = bot.guilds.get(guildID);
		const channels = [...section.querySelectorAll(`.guild-${guildID} > .channels > input`)]
			.filter(elem => !!elem.checked)
			.map(elem => guild.channels.get(elem.value))
			// Filter out non text channels and channels the bot doesn't have access to
			.filter(channel => channel && channel.type === 'text' && channel.members.has(bot.user.id));
		if (section.id !== "section-backup") return {channels: channels};

		const users = new Map(
			[...section.querySelectorAll(`#section-backup .guild-${guildID} > .users > input`)]
				.filter(elem => !!elem.checked)
				.map(elem => [elem.value, true])
		);
		return {channels: channels, users: users};
	},
	// Retrieve selected DMs
	DMs: section => {
		const dmBox = section.querySelector(`.server-list .dmbox`);
		if (!dmBox || !dmBox.checked) return [];
		let checkedBoxes = [...section.querySelectorAll(`.server-list .dms input`)]
			.filter(elem => elem.checked)

		return checkedBoxes.map(elem => bot.channels.get(elem.value));
	},
	// Retrieve selected filters from UI
	// Filters are only present in the backup section, so there's no need to explicitly pass the section
	// as an argument
	filters: document => {
		let filters = {from:"", to:""};
		if (!document.querySelector(`#section-backup .filter-section input.more-filters`).checked) return filters;

		let dateFilterTypes = document.querySelectorAll(`.more-filters .date-choice`);
		for (let i = 0; i < dateFilterTypes.length; ++i) {
			const dateFilterType = dateFilterTypes[i];
			if (!dateFilterType.checked) continue;
			filters.from = document.querySelector(`.${dateFilterType.value} .from`);
			filters.from = (filters.from && filters.from.value) ? SnowflakeUtil.generate(new Date(filters.from.value)) : '';
			filters.to = document.querySelector(`.${dateFilterType.value} .to`);
			filters.to = (filters.to && filters.to.value) ? SnowflakeUtil.generate(new Date(filters.to.value)) : '';
		}
		let messageLimit = document.querySelector(".limit-checkbox");
		if (messageLimit.checked) filters.limit = Number(document.querySelector(".limit-number").value) || '';
		return filters;
	},

	// Generate status messages in the UI
	Status: class {
		constructor(source, status, document) {
			statusCount += 1;
			this.source = source;
			this.status = status;
			this.document = document;
			this.disable();
		}
		message(message) {
			this.status.innerHTML = message;
		}
		waiting(message) {
			this.status.innerHTML = `<span class="blinking">${message}</span>`;
		}
		error(message) {
			this.status.innerHTML = `<span style="color:#ff7777" class="fade-out">${message}</span>`;
			this.done();
		}
		success(message) {
			this.status.innerHTML = `<span style="color:#00d39b" class="fade-out">${message}</span>`;
			this.done();
		}
		disable() {
			let logout = this.document.getElementById("logout"),
				refresh = this.document.getElementById("refresh");
			this.source.disabled = logout.disabled = refresh.disabled = true;
			this.source.style.cursor = logout.style.cursor = refresh.style.cursor = "not-allowed";
		}
		done() {
			this.source.disabled = false;
			this.source.style.cursor = "pointer";
			statusCount -= 1;
			if (statusCount > 0) return;

			let logout = this.document.getElementById("logout"),
				refresh = this.document.getElementById("refresh");
			this.source.disabled = logout.disabled = refresh.disabled = false;
			this.source.style.cursor = logout.style.cursor = refresh.style.cursor = "pointer";
		}
	},
};

