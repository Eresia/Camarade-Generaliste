const { SlashCommandBuilder } = require('discord.js');
const DiscordUtils = require('../scripts/discord-utils.js');

let allCommands = [];

async function setChannel(interaction, dataManager, channelDescription, channelName, callback)
{
	const channel = interaction.options.getChannel('channel-tag');

	dataManager.getServerData(interaction.guild.id)[channelName] = channel.id;
	dataManager.writeInData(interaction.guild.id);

	await interaction.reply('Channel ' + DiscordUtils.getChannelStringById(channel.id) + ' is now ' + channelDescription);

	if(callback != null)
	{
		callback(dataManager, interaction);
	}
}

let allChannelCommands = {
	data: new SlashCommandBuilder()
				.setName("channel")
				.setDescription('Set gestion channels'),

	commandChannels : {},

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		if(!interaction.member.permissions.has("ADMINISTRATOR"))
		{
			await interaction.reply({ content: 'You don\'t have permission for this command', ephemeral: true });
			return;
		}

		let subcommand = interaction.options.getSubcommand();

		await setChannel(interaction, dataManager, this.commandChannels[subcommand].description, this.commandChannels[subcommand].name, this.commandChannels[subcommand].callback);
	}
}

function addChannelCommand(command, channelDescription, channelName, callback = null)
{
	allChannelCommands.data.addSubcommand(subcommand =>
		subcommand
			.setName(command)
			.setDescription('Set ' + channelDescription + ' channel')
			.addChannelOption(option => 
				option
					.setName('channel-tag')
					.setDescription('Tag of the ' + channelDescription + ' channel')
					.setRequired(true)
			)
	);

	allChannelCommands.commandChannels[command] = {name: channelName, description: channelDescription, callback: callback};
}

addChannelCommand('error-log', 'error log channel', 'errorLogChannel');
addChannelCommand('anonymous-question', 'anonymous question channel', 'anonymousQuestionChannel');
addChannelCommand('propal', 'propal channel', 'propalChannel');

module.exports = {
	allCommands
};

allCommands.push(allChannelCommands);