const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const DiscordUtils = require('../scripts/discord-utils.js');

let allCommands = [];

allCommands.push({
	data: new SlashCommandBuilder()
		.setName('create-category')
		.setDescription('Create category where you can add roles later')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addStringOption(option =>
			option
				.setName('category-name')
				.setDescription('Name of the category')
				.setRequired(true)
		)
		.addStringOption(option =>
			option
				.setName('display-sentence')
				.setDescription('Displayed sentences for the category')
				.setRequired(true)
		),

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		let guildData = dataManager.getServerData(interaction.guild.id);
		let name = interaction.options.getString('category-name');
		let display = interaction.options.getString('display-sentence');

		if(name in guildData.roleCategories)
		{
			interaction.reply({content: 'Category "' + name + '" already exist', ephemeral: true});
			return;
		}

		guildData.roleCategories[name] = {display: display, roles : {}, channelId: -1, messageId: -1};
		dataManager.writeInData(interaction.guild.id);
		dataManager.refreshCommandForGuild(interaction.guild);

		interaction.reply({content: 'Category "' + name + '" created', ephemeral: true});
	}
});

allCommands.push({
	data: new SlashCommandBuilder()
		.setName('delete-category')
		.setDescription('Delete category')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addStringOption(option =>
			option
				.setName('category-name')
				.setDescription('Name of the category')
				.setRequired(true)
		),

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		let guildData = dataManager.getServerData(interaction.guild.id);
		let name = interaction.options.getString('category-name');

		if(!(name in guildData.roleCategories))
		{
			interaction.reply({content: 'Category "' + name + '" don\'t exist', ephemeral: true});
			return;
		}

		dataManager.RoleReactionManager.removeReactCollector(dataManager, interaction.guild, name);

		delete guildData.roleCategories[name];
		dataManager.writeInData(interaction.guild.id);
		dataManager.refreshCommandForGuild(interaction.guild);

		interaction.reply({content: 'Category "' + name + '" removed', ephemeral: true});
	}
});

allCommands.push({
	data: new SlashCommandBuilder()
		.setName('send-category-message'),

	dynamicCommandCreator: createCreateCategoryMessageCommand,

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		let guildData = dataManager.getServerData(interaction.guild.id);
		let categoryName = interaction.options.getString('category');

		if(!(categoryName in guildData.roleCategories))
		{
			interaction.reply({content: 'Category "' + categoryName + '" don\'t exist', ephemeral: true});
			return;
		}

		let embed = dataManager.RoleReactionManager.createRoleReactionEmbedMessage(dataManager, interaction.guild, categoryName);
		let newMessage = await interaction.channel.send({embeds: [embed]});

		await interaction.deferReply({ephemeral: true});

		for(let emoji in guildData.roleCategories[categoryName].roles)
		{
			try
			{
				await newMessage.react(emoji);
			}
			catch(error)
			{
				delete guildData.roleCategories[categoryName].roles[emoji];
				embed = medataManager.RoleReactionManager.createRoleReactionEmbedMessage(dataManager, interaction.guild, categoryName);
				await newMessage.edit({embeds: [embed]});
			}
		}

		guildData.roleCategories[categoryName].channelId = newMessage.channel.id;
		guildData.roleCategories[categoryName].messageId = newMessage.id;

		dataManager.RoleReactionManager.initReactCollectorOnMessage(dataManager, interaction.guild, categoryName);

		dataManager.writeInData(interaction.guild.id);
		interaction.editReply({content: 'Message created', ephemeral: true});
	}
});

allCommands.push({
	data: new SlashCommandBuilder()
		.setName('edit-category-displayed-sentence'),

	dynamicCommandCreator: createEditCategoryDisplayCommand,

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		let guildData = dataManager.getServerData(interaction.guild.id);
		let categoryName = interaction.options.getString('category');
		let display = interaction.options.getString('sentence');

		if(!(categoryName in guildData.roleCategories))
		{
			interaction.reply({content: 'Category "' + categoryName + '" don\'t exist', ephemeral: true});
			return;
		}

		guildData.roleCategories[categoryName].display = display;
		let reactMessage = await DiscordUtils.getMessageById(interaction.client, guildData.roleCategories[categoryName].channelId, guildData.roleCategories[categoryName].messageId);

		if(reactMessage != null)
		{
			let embed = dataManager.RoleReactionManager.createRoleReactionEmbedMessage(dataManager, interaction.guild, categoryName);
			await reactMessage.edit({embeds: [embed]});
		}

		dataManager.writeInData(interaction.guild.id);

		interaction.reply({content: 'Sentence edited !' + categoryName, ephemeral: true});
	}
});

allCommands.push({
	data: new SlashCommandBuilder()
		.setName('add-role-to-category'),

	dynamicCommandCreator: createAddEmojiRoleCommand,

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		let guildData = dataManager.getServerData(interaction.guild.id);
		let categoryName = interaction.options.getString('category');
		let name = interaction.options.getString('name');
		let emoji = interaction.options.getString('emoji');
		let role = interaction.options.getRole('role');

		if(!(categoryName in guildData.roleCategories))
		{
			interaction.reply({content: 'Category "' + categoryName + '" don\'t exist', ephemeral: true});
			return;
		}

		for(let currentEmoji in guildData.roleCategories[categoryName].roles)
		{
			if(guildData.roleCategories[categoryName].roles[currentEmoji].roleId == role.id)
			{
				await interaction.reply({ content: 'Role already set for this category', ephemeral: true });
				return;
			}

			if(currentEmoji == emoji)
			{
				await interaction.reply({ content: 'Emoji already set', ephemeral: true });
				return;
			}
		}

		const regexEmoji = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/gi;
		if(!regexEmoji.test(emoji) && ((emoji.charAt(0) != ':' ) || (emoji.charAt(emoji.length - 1) != ':' )))
		{
			await interaction.reply({ content: 'Emoji is not valid', ephemeral: true });
			return;
		}

		if(name == null)
		{
			name = role.name;
		}

		guildData.roleCategories[categoryName].roles[emoji] = {roleId: role.id, name: name};
		let reactMessage = await DiscordUtils.getMessageById(interaction.client, guildData.roleCategories[categoryName].channelId, guildData.roleCategories[categoryName].messageId);

		if(reactMessage != null)
		{
			let embed = dataManager.RoleReactionManager.createRoleReactionEmbedMessage(dataManager, interaction.guild, categoryName);
			await reactMessage.edit({embeds: [embed]});

			try
			{
				await reactMessage.react(emoji);
			}
			catch(error)
			{
				await interaction.reply({ content: 'Can\'t react with this emoji', ephemeral: true });
				return;
			}
		}

		dataManager.writeInData(interaction.guild.id);

		interaction.reply({content: 'Role ' + role.name + ' added to category ' + categoryName, ephemeral: true});
	}
});

allCommands.push({
	data: new SlashCommandBuilder()
		.setName('remove-role-from-category'),

	dynamicCommandCreator: createRemoveEmojiRoleCommand,

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		let guildData = dataManager.getServerData(interaction.guild.id);
		let categoryName = interaction.options.getString('category');
		let emoji = interaction.options.getString('emoji');
		let role = interaction.options.getRole('role');

		if(!(categoryName in guildData.roleCategories))
		{
			interaction.reply({content: 'Category "' + categoryName + '" don\'t exist', ephemeral: true});
			return;
		}

		let targetEmoji = null;

		if(emoji == null)
		{
			if(role == null)
			{
				await interaction.reply({ content: 'Need to precise emoji or role to remove', ephemeral: true });
				return;
			}

			for(let currentEmoji in guildData.roleCategories[categoryName].roles)
			{
				if(guildData.roleCategories[categoryName].roles[currentEmoji].roleId == role.id)
				{
					targetEmoji = currentEmoji;
					break;
				}
			}
		}
		else
		{
			for(let currentEmoji in guildData.roleCategories[categoryName].roles)
			{
				if(currentEmoji == emoji)
				{
					targetEmoji = currentEmoji;
					break;
				}
			}
		}

		if(targetEmoji == null)
		{
			await interaction.reply({ content: 'Can\'t find the role or emoji to remove', ephemeral: true });
			return;
		}

		let reactMessage = await DiscordUtils.getMessageById(interaction.client, guildData.roleCategories[categoryName].channelId, guildData.roleCategories[categoryName].messageId);

		if(reactMessage != null)
		{
			let embed = dataManager.RoleReactionManager.createRoleReactionEmbedMessage(dataManager, interaction.guild, categoryName);
			await reactMessage.edit({embeds: [embed]});

			let reaction = reactMessage.reactions.resolve(targetEmoji);
			if(reaction != null)
			{
				reaction.remove();
			}
		}

		delete guildData.roleCategories[categoryName].roles[targetEmoji];
		dataManager.writeInData(interaction.guild.id);
		interaction.reply({content: 'Role removed from category ' + categoryName, ephemeral: true});
	}
});

function setCategoryOption(data, dataManager, guild)
{
	let guildData = dataManager.getServerData(guild.id);

	let categories = [];

	for(let categoryName in guildData.roleCategories)
	{
		categories.push({name: categoryName, value: categoryName});
	}

	if(categories.length == 0)
	{
		return null;
	}

	data.addStringOption(function(option)
	{
		option.setName('category');
		option.setDescription('Category name');
		option.setRequired(true);

		for(let i = 0; i < categories.length; i++)
		{
			option.addChoices(categories[i]);
		}

		return option;
	});

	return data;
}

function createCreateCategoryMessageCommand(name, dataManager, guild)
{
	let data = new SlashCommandBuilder();

	data.setName(name);
	data.setDescription('Create category message and react');
	data.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

	return setCategoryOption(data, dataManager, guild);
}

function createEditCategoryDisplayCommand(name, dataManager, guild)
{
	let data = new SlashCommandBuilder();

	data.setName(name);
	data.setDescription('Edit category displayed sentence');
	data.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

	data = setCategoryOption(data, dataManager, guild);
	data.addStringOption(option =>
		option
			.setName('sentence')
			.setDescription('sentence to display')
			.setRequired(true)
	);

	return data;
}

function createAddEmojiRoleCommand(name, dataManager, guild)
{
	let data = new SlashCommandBuilder();

	data.setName(name);
	data.setDescription('Can get this role with this emoji');
	data.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

	data = setCategoryOption(data, dataManager, guild);

	if(data == null)
	{
		return null;
	}

	data.addStringOption(option =>
		option
			.setName('emoji')
			.setDescription('emoji to react')
			.setRequired(true)
	);

	data.addRoleOption(option =>
		option
			.setName('role')
			.setDescription('role to add')
			.setRequired(true)
	);

	data.addStringOption(option =>
		option
			.setName('name')
			.setDescription('Name displayed for emoji (default : role name)')
			.setRequired(false)
	);

	return data;
}

function createRemoveEmojiRoleCommand(name, dataManager, guild)
{
	let data = new SlashCommandBuilder();

	data.setName(name);
	data.setDescription('Remove role access with emoji');
	data.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

	data = setCategoryOption(data, dataManager, guild);

	if(data == null)
	{
		return null;
	}

	data.addStringOption(option =>
		option
			.setName('emoji')
			.setDescription('emoji to react')
			.setRequired(false)
	);

	data.addRoleOption(option =>
		option
			.setName('role')
			.setDescription('role to remove')
			.setRequired(false)
	);

	return data;
}

module.exports = {
	allCommands
};