const { SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const DiscordUtils = require('../scripts/discord-utils.js');

let allCommands = [];

allCommands.push({
	data: new SlashCommandBuilder()
		.setName('create-ask')
		.setDescription('Ask anonymous question'),

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		const buttonRow = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('ask')
					.setLabel('Poser une question anonyme')
					.setStyle(ButtonStyle.Primary)
			);

		let message = await interaction.channel.send({components: [buttonRow]});

		dataManager.getServerData(interaction.guild.id).askChannel = message.channel.id;
		dataManager.writeInData(interaction.guild.id);

		dataManager.MessageManager.collectQuestions(dataManager, interaction.guild);
		
		interaction.reply({content: "Created", ephemeral: true});
	}
});

allCommands.push({
	data: new SlashCommandBuilder()
		.setName('ban-user')
		.setDescription('Ban user to anonymous questions')
		.addUserOption(option =>
			option
				.setName('user')
				.setDescription('User to ban')
				.setRequired(true)),

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		let guildData = dataManager.getServerData(interaction.guild.id);
		let user = interaction.options.getUser('user');

		if(guildData.bannedUsers.includes(user.id))
		{
			interaction.reply({content: 'User ' + DiscordUtils.getUserStringById(user.id) + ' is already banned', ephemeral: true});
			return;
		}

		guilData.bannedUsers.push(user.id);
		dataManager.writeInData(interaction.guild.id);

		dataManager.logError(interaction.guild, 'User ' + DiscordUtils.getUserStringById(user.id) + ' banned by ' + DiscordUtils.getUserStringById(interaction.user.id));
		interaction.reply({content: 'User ' + DiscordUtils.getUserStringById(user.id) + ' banned', ephemeral: true});
	}
});

allCommands.push({
	data: new SlashCommandBuilder()
		.setName('unban-user')
		.setDescription('Unban user to anonymous questions')
		.addUserOption(option =>
			option
				.setName('user')
				.setDescription('User to unban')
				.setRequired(true)),

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		let guildData = dataManager.getServerData(interaction.guild.id);
		let user = interaction.options.getUser('user');

		if(!guildData.bannedUsers.includes(user.id))
		{
			interaction.reply({content: 'User ' + DiscordUtils.getUserStringById(user.id) + ' is not banned', ephemeral: true});
			return;
		}

		guildData.bannedUsers.splice(guildData.bannedUsers.indexOf(user.id), 1);
		dataManager.writeInData(interaction.guild.id);

		dataManager.logError(interaction.guild, 'User ' + DiscordUtils.getUserStringById(user.id) + ' unbanned by ' + DiscordUtils.getUserStringById(interaction.user.id));
		interaction.reply({content: 'User ' + DiscordUtils.getUserStringById(user.id) + ' unbanned', ephemeral: true});
	}
});

allCommands.push({
	data: new ContextMenuCommandBuilder()
		.setName('Ban Anonymous User')
		.setType(ApplicationCommandType.Message),

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		let guildData = dataManager.getServerData(interaction.guild.id);

		if(interaction.targetMessage.author.id != interaction.client.user.id)
		{
			interaction.reply({content: 'Not anonymous message, can\'t ban the user', ephemeral: true});
			return;
		}

		let messageId = interaction.targetMessage.id;

		let userId = dataManager.MessageManager.getAuthor(dataManager, interaction.guild, messageId);

		if(userId == null)
		{
			interaction.reply({content: 'Can\'t find message author', ephemeral: true});
			return;
		}

		if(guildData.bannedUsers.includes(userId))
		{
			interaction.reply({content: 'User is already banned', ephemeral: true});
			return;
		}

		guildData.bannedUsers.push(userId);
		dataManager.writeInData(interaction.guild.id);

		dataManager.logError(interaction.guild, 'Sender of message ' + interaction.targetMessage.url + ' banned by ' + DiscordUtils.getUserStringById(interaction.user.id));
		interaction.reply({content: 'User banned', ephemeral: true});
	}
});

allCommands.push({
	data: new ContextMenuCommandBuilder()
		.setName('Unban Anonymous User')
		.setType(ApplicationCommandType.Message),

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		let guildData = dataManager.getServerData(interaction.guild.id);

		if(interaction.targetMessage.author.id != interaction.client.user.id)
		{
			interaction.reply({content: 'Not anonymous message, can\'t unban the user', ephemeral: true});
			return;
		}

		let messageId = interaction.targetMessage.id;

		let userId = dataManager.MessageManager.getAuthor(dataManager, interaction.guild, messageId);

		if(userId == null)
		{
			interaction.reply({content: 'Can\'t find message author', ephemeral: true});
			return;
		}

		if(!guildData.bannedUsers.includes(userId))
		{
			interaction.reply({content: 'User is not banned', ephemeral: true});
			return;
		}

		guildData.bannedUsers.splice(guildData.bannedUsers.indexOf(userId), 1);
		dataManager.writeInData(interaction.guild.id);

		dataManager.logError(interaction.guild, 'Sender of message ' + interaction.targetMessage.url + ' unbanned by ' + DiscordUtils.getUserStringById(interaction.user.id));
		interaction.reply({content: 'User unbanned', ephemeral: true});
	}
});

module.exports = {
	allCommands
};