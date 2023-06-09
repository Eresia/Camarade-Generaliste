const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

let allCommands = [];

const emptyMessage = "\u200B";
const nbMaxEmbedField = 7;

function buildEmbedCommand()
{
	let command = new SlashCommandBuilder();
	command.setName('embed');
	command.setDescription('Add embed message');
	command.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
	command.addStringOption(option => 
		option
			.setName('message-id')
			.setDescription('If you want modify a message in the channel')
			.setRequired(false)
	);
	command.addStringOption(option => 
		option
			.setName('title')
			.setDescription('Title of the embed')
			.setRequired(false)
	);
	command.addStringOption(option => 
		option
			.setName('description')
			.setDescription('Description of the embed')
			.setRequired(false)
	);

	for(let i = 1; i <= nbMaxEmbedField; i++)
	{
		command.addStringOption(option => 
			option
				.setName('field' + i + '-title')
				.setDescription('Title of the field ' + i)
				.setRequired(false)
		);

		command.addStringOption(option => 
			option
				.setName('field' + i + '-description')
				.setDescription('Description of the field ' + i)
				.setRequired(false)
		);

		command.addBooleanOption(option => 
			option
				.setName('field' + i + '-inline')
				.setDescription('Is field ' + i + ' inline ?')
				.setRequired(false)
		);
	}

	return command;
}

allCommands.push({
	data: buildEmbedCommand(),

	async execute(interaction, dataManager) {

		let messageId = interaction.options.getString('message-id');
		let message = null;

		if(messageId != null)
		{
			message = await interaction.channel.messages.fetch(messageId);
			if(message == null)
			{
				interaction.reply({content: 'Can\'t find message id ' + messageId, ephemeral: true});
				return;
			}

			if(message.author.id != interaction.client.user.id)
			{
				interaction.reply({content: 'Message has to be one of mine', ephemeral: true});
				return;
			}
		}

		let embed = new EmbedBuilder();

		let title = interaction.options.getString('title');
		let description = interaction.options.getString('description');
		let fields = [];

		for(let i = 1; i <= nbMaxEmbedField; i++)
		{
			let fieldTitle = interaction.options.getString('field' + i + '-title');
			let fieldDescription = interaction.options.getString('field' + i + '-description');
			let fieldInline = interaction.options.getBoolean('field' + i + '-inline');

			if((fieldTitle == null) && (fieldDescription == null))
			{
				continue;
			}

			let field = 
			{
				name: (fieldTitle == null) ? emptyMessage : fieldTitle.replaceAll('\\n', '\n'),
				value: (fieldDescription == null) ? emptyMessage : fieldDescription.replaceAll('\\n', '\n'),
				inline: (fieldInline == null) ? false : fieldInline
			}

			fields.push(field);
		}

		if(title != null)
		{
			embed.setTitle(title.replaceAll('\\n', '\n'));
		}

		if(description != null)
		{
			embed.setDescription(description.replaceAll('\\n', '\n'));
		}

		if(fields.length != 0)
		{
			embed.addFields(fields);
		}

		if(embed.length == 0)
		{
			interaction.reply({content: 'Embed cannot be empty', ephemeral: true});
		}
		else
		{
			if(message == null)
			{
				await interaction.channel.send({ embeds: [embed] });
			}
			else
			{
				await message.edit({ embeds: [embed] });
			}
			
			interaction.reply({content: 'Embed generated', ephemeral: true});
		}
	}
});

allCommands.push({
	data: new SlashCommandBuilder()
			.setName('purge')
			.setDescription('Purge messages')
			.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
			.addSubcommand(subcommand =>
				subcommand
					.setName('messages')
					.setDescription('Purge any number of messages')
					.addIntegerOption(option => 
						option
							.setName('number')
							.setDescription('Number of messages to purge')
							.setRequired(true)
					)
				)
			.addSubcommand(subcommand =>
				subcommand
					.setName('channel')
					.setDescription('Purge all message of a channel')
					.addBooleanOption(option =>
						option
							.setName('replace-channel')
							.setDescription('Delete and recreate channel')
							.setRequired(false)
					)
				)
			.addSubcommand(subcommand =>
				subcommand
					.setName('threads')
					.setDescription('Purge all threads of a channel')
					.addBooleanOption(option =>
						option
							.setName('only-closed')
							.setDescription('Delete Only closed threads')
							.setRequired(true)
					)
				),

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		if(!interaction.member.permissions.has("ADMINISTRATOR"))
		{
			await interaction.reply({ content: 'You don\'t have permission for this command', ephemeral: true });
			return;
		}

		let subcommand = interaction.options.getSubcommand();
		await interaction.deferReply({ ephemeral: true });

		switch(subcommand)
		{
			case 'messages':
			{
				let number = interaction.options.getInteger('number');
				let messages = await interaction.channel.messages.fetch({limit: Math.min(100, number)});

				if(messages.size > 0)
				{
					await interaction.channel.bulkDelete(messages);
				}

				await interaction.editReply({content: 'Remove ' + messages.size + ' messages', ephemeral: true });
				break;
			}

			case 'channel':
			{
				let messages = await interaction.channel.messages.fetch({limit: 100});
				let nbMessages = 0;

				let replaceChannel = interaction.options.getBoolean('replace-channel');
				replaceChannel = (replaceChannel == null) ? false : replaceChannel;

				if(replaceChannel != null && replaceChannel)
				{
					let newChannel = await interaction.channel.clone(interaction.channel.name);
					await interaction.channel.delete();
				}
				else
				{
					while(messages.size > 0)
					{
						nbMessages += messages.size;
						await interaction.channel.bulkDelete(messages);
						messages = await interaction.channel.messages.fetch({limit: 100});
					}

					await interaction.editReply({content: 'Remove ' + nbMessages + ' messages', ephemeral: true });
				}
				
				break;
			}

			case 'threads':
			{
				let hasMoreThreads;
				let onlyClosed = interaction.options.getBoolean('only-closed');
				let nbThreadRemoved = 0;

				do
				{
					let fetchedThreads = await interaction.channel.threads.fetchArchived({type: 'private', fetchAll: true}, false);
					let threads = Array.from(fetchedThreads.threads.values());
					hasMoreThreads = fetchedThreads.hasMore;

					fetchedThreads = await interaction.channel.threads.fetchArchived({type: 'public'}, false);
					threads = threads.concat(Array.from(fetchedThreads.threads.values()));
					hasMoreThreads = hasMoreThreads || fetchedThreads.hasMore;
					
					if(!onlyClosed)
					{
						fetchedThreads = await interaction.channel.threads.fetchActive(false);
						threads = threads.concat(Array.from(fetchedThreads.threads.values()));
						hasMoreThreads = hasMoreThreads || fetchedThreads.hasMore;
					}

					for(let i = 0; i < threads.length; i++)
					{
						nbThreadRemoved++;
						await threads[i].delete();
					}
				} while(hasMoreThreads);
				
				await interaction.editReply({content: 'Remove ' + nbThreadRemoved + ' threads', ephemeral: true });
				break;
			}
		}
	}
});

allCommands.push({
	data: new SlashCommandBuilder()
		.setName('set-auto-delete-thread')
		.setDescription('Activate auto deletion of old threads')
		.addBooleanOption(option =>
			option
				.setName('delete')
				.setDescription('If you want delete old threads')
				.setRequired(true)),

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		let guildData = dataManager.getServerData(interaction.guild.id);
		let activeDelete = interaction.options.getBoolean('delete');

		guildData.deleteArchivedThreads = activeDelete;
		dataManager.writeInData(interaction.guild.id);
		
		interaction.reply({content: activeDelete ? 'Threads will be auto deleted' : 'Threads will be not auto deleted anymore', ephemeral: true});
	}
});

allCommands.push({
	data: new SlashCommandBuilder()
		.setName('set-channel-auto-thread')
		.setDescription('Activate auto creation of thread in the channel')
		.addStringOption(option =>
			option
				.setName('name-format')
				.setDescription('The format of the thread name (default : First sentence)')
				.setRequired(false)
				.addChoices(
					{ name: 'Name of user', value: 'NAME' },
					{ name: 'First sentence', value: 'SENTENCE' },
				))
		.addBooleanOption(option =>
			option
				.setName('active')
				.setDescription('If you want active auto creation (default : true)')
				.setRequired(false)),

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		let guildData = dataManager.getServerData(interaction.guild.id);
		let active = interaction.options.getBoolean('active');
		if(active == null)
		{
			active = true;
		}

		let format = interaction.options.getString('name-format');
		if((format != 'NAME') && (format != 'SENTENCE'))
		{
			format = 'SENTENCE';
		}

		if(!active)
		{
			if(interaction.channel.id in guildData.autoCreateThreads)
			{
				delete guildData.autoCreateThreads[interaction.channel.id];
				dataManager.writeInData(interaction.guild.id);
				dataManager.ThreadManager.deleteThreadListener(interaction.guild, interaction.channel.id);
			}

			interaction.reply({content: 'Auto thread desactived for this channel', ephemeral: true});
			return;
		}

		let changeFormat = false;

		if(interaction.channel.id in guildData.autoCreateThreads)
		{
			if(guildData.autoCreateThreads[interaction.channel.id].format == format)
			{
				interaction.reply({content: 'Auto thread already activated for this channel', ephemeral: true});
				return;
			}
			else
			{
				dataManager.ThreadManager.deleteThreadListener(interaction.guild, interaction.channel.id);
				changeFormat = true;
			}
		}
		
		await dataManager.ThreadManager.refreshThreadListener(dataManager, interaction.guild, interaction.channel.id, format);
		guildData.autoCreateThreads[interaction.channel.id] = {format: format};
		dataManager.writeInData(interaction.guild.id);
		
		if(changeFormat)
		{
			interaction.reply({content: 'Auto thread format changed for this channel', ephemeral: true});
			return;
		}
		else
		{
			interaction.reply({content: 'Auto thread activated for this channel', ephemeral: true});
		}
	}
});

module.exports = {
	allCommands
};