const path = require('path');
const fs = require('fs');
const { Client, Events, Collection, GatewayIntentBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const DataManager = require('./scripts/data-manager.js');
const MessageManager = require('./scripts/message-manager.js');
const RoleReactionManager = require('./scripts/role-reaction-manager.js');
const ThreadManager = require('./scripts/threadManager.js');
const DiscordUtils = require('./scripts/discord-utils.js');
const { exit } = require('process');

const needRefreshCommands = false;
const sendInitError = true;

if(!fs.existsSync('config.json'))
{
	let basic_config = {};
	basic_config.clientId = "";
	basic_config.token = "";

	fs.writeFileSync('config.json', JSON.stringify(basic_config, null, 4));

	console.log('Need to fill config.json with discord bot informations');
	exit(0);
}

const { clientId, token } = require('./config.json');

if(clientId.length == 0 || token.length == 0)
{
	console.log('Need to fill config.json with discord bot informations');
	exit(0);
}

const guildValues = 
[
	{name : 'errorLogChannel', defaultValue : -1},
	{name : 'anonymousQuestionChannel', defaultValue : -1},
	{name : 'propalChannel', defaultValue : -1},
	{name : 'bannedUsers', defaultValue : []},
	{name : 'askButtonChannel', defaultValue : -1},
	{name : 'propalButtonChannel', defaultValue : -1},
	{name : 'roleCategories', defaultValue : {}},
	{name : 'deleteArchivedThreads', defaultValue: false},
	{name : 'autoCreateThreads', defaultValue: {}}
];

const rest = new REST({ version: '9' }).setToken(token);
const client = new Client({ intents: 
	[
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildEmojisAndStickers,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.MessageContent,
	] 
});

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

client.commands = new Collection();
let commandData = [];
let dynamicCommandData = [];

for (const file of commandFiles) {
	let commands = require(`./commands/${file}`);
	const allCommands = commands.allCommands;

	for(let i = 0; i < allCommands.length; i++)
	{
		if('dynamicCommandCreator' in allCommands[i])
		{
			dynamicCommandData.push({name: allCommands[i].data.name, creator: allCommands[i].dynamicCommandCreator});
		}
		else
		{
			commandData.push(allCommands[i].data.toJSON());
		}

		client.commands.set(allCommands[i].data.name, allCommands[i]);
	}
}

DataManager.initData(path.join(__dirname, 'data'), guildValues);
DataManager.MessageManager = MessageManager;
DataManager.RoleReactionManager = RoleReactionManager;
DataManager.ThreadManager = ThreadManager;

let isInit = false;

client.on('ready', async function () {
	console.log("Connected");

	if (!client.application?.owner) await client.application?.fetch();

	await refreshCommands();

	client.on(Events.InteractionCreate, async function(interaction)
	{
		if(interaction.isModalSubmit())
		{
			switch(interaction.customId)
			{
				case 'anonymous-question-modal':
				{
					let obj = interaction.fields.getTextInputValue('question-object');
					let question = interaction.fields.getTextInputValue('question-text');

					await interaction.deferReply({ephemeral: true});

					let result = await MessageManager.sendModalMessage(DataManager, interaction.guild, interaction.user, obj, question, DataManager.getServerData(interaction.guild.id).anonymousQuestionChannel);

					interaction.editReply({content: result, ephemeral: true});
					break;
				}

				case 'propal-modal':
				{
					let obj = interaction.fields.getTextInputValue('propal-object');
					let propal = interaction.fields.getTextInputValue('propal-text');

					await interaction.deferReply({ephemeral: true});

					let result = await MessageManager.sendModalMessage(DataManager, interaction.guild, interaction.user, obj, propal, DataManager.getServerData(interaction.guild.id).propalChannel, ['✅', '❌']);

					interaction.editReply({content: result, ephemeral: true});
					break;
				}
			}
			return;
		}
		if(!interaction.isCommand() && !interaction.isUserContextMenuCommand())
		{
			return;
		}

		const command = client.commands.get(interaction.commandName);

		if (!command)
		{
			return;
		}

		try 
		{
			await command.execute(interaction, DataManager);
		} 
		catch (executionError) {
			console.error(executionError);
			try 
			{
				await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
				DataManager.logError(interaction.guild, 'Command Error :\n\n' + executionError);
			} 
			catch(replyError)
			{
				try 
				{
					await interaction.editReply('There was an error while executing this command!');
					DataManager.logError(interaction.guild, 'Command Error :\n\n' + replyError);
				}
				catch(cantReplyError)
				{
					DataManager.logError(interaction.guild, 'Answer is too long');
				}
			}
		}
	});

	client.on(Events.ThreadUpdate, function(oldThread, newThread)
	{
		if(!DataManager.getServerData(newThread.guild.id).deleteArchivedThreads)
		{
			return;
		}

		if(oldThread.archived && !newThread.archived)
		{
			newThread.delete('Delete ' + newThread.name + ' after archiving');
		}
	});

	client.on(Events.GuildCreate, function(guild)
	{
		DataManager.initGuildData(guild.id);
		refreshCommandForGuild(guild);
	});

	client.on(Events.GuildDelete, function(guild)
	{
		MessageManager.removeCollector(guild, 'ask');
		MessageManager.removeCollector(guild, 'propal');
		DataManager.removeGuildData(guild.id);
	});

	await client.guilds.fetch();

	if(isInit)
	{
		return;
	}

	client.guilds.cache.forEach(async (guild) => {
		if(sendInitError)
		{
			DataManager.logError(guild, 'Bot Starting');
		}

		MessageManager.collectQuestions(DataManager, guild);
		MessageManager.collectPropal(DataManager, guild);
		RoleReactionManager.initAllReactCollectorOnMessage(DataManager, guild);
		ThreadManager.refreshAllThreadListener(DataManager, guild);
	});
	
	isInit = true;
});

async function refreshCommands()
{
	await client.guilds.fetch();

	for(let[guildId, guild] of client.guilds.cache)
	{
		if(needRefreshCommands || DataManager.getServerData(guildId) == null)
		{
			DataManager.initGuildData(guildId);
			await refreshCommandForGuild(guild);
		}
	}
}

async function refreshCommandForGuild(guild)
{
	let guildCommandData = commandData.map(x => x);
	for(let i = 0; i < dynamicCommandData.length; i++)
	{
		let data = dynamicCommandData[i].creator(dynamicCommandData[i].name, DataManager, guild);
		if(data == null)
		{
			continue;
		}

		guildCommandData.push(data.toJSON());
	}

	try
	{
		await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: guildCommandData });
		console.log('Successfully registered application commands for guild ' + guild.name);
	}
	catch(error)
	{
		console.log('Can\'t registered command for guild ' + guild.name + ': ' + error);
	}
}

async function logError(guild, error)
{
	let guildData = DataManager.getServerData(guild.id);
	let channel = await DiscordUtils.getChannelById(guild.client, guildData.errorLogChannel);

	if(channel != null)
	{
		channel.send('Info: ' + error);
	}
}

DataManager.refreshCommandForGuild = refreshCommandForGuild;
DataManager.logError = logError;

client.login(token);