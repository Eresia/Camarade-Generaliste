const path = require('path');
const fs = require('fs');
const { Client, Events, Collection, GatewayIntentBits, REST } = require('discord.js');
const { Routes } = require('discord-api-types/v9');
const DataManager = require('./scripts/data-manager.js');
const MessageManager = require('./scripts/message-manager.js');
const RoleReactionManager = require('./scripts/role-reaction-manager.js');
const ThreadManager = require('./scripts/thread-manager.js');
const LexiconManager = require('./scripts/lexicon-manager.js');
const DiscordUtils = require('./scripts/discord-utils.js');
const { exit } = require('process');

const needRefreshCommands = true;
const sendInitError = true;
const caughtException = true;

if(!fs.existsSync('config.json'))
{
	let basic_config = {};
	basic_config.clientId = "";
	basic_config.token = "";
	basic_config.errorLogGuild = "";

	fs.writeFileSync('config.json', JSON.stringify(basic_config, null, 4));

	console.log('Need to fill config.json with discord bot informations');
	exit(0);
}

const config = JSON.parse(fs.readFileSync('./config.json'));

if(!('clientId' in config) || !('token' in config))
{
	if(!('clientId' in config))
	{
		config.clientId = "";
	}

	if(!('token' in config))
	{
		config.token = "";
	}

	fs.writeFileSync('config.json', JSON.stringify(config, null, 4));
	console.log('Need to fill config.json with discord bot informations');
	return;
}

if(config.clientId.length == 0 || config.token.length == 0)
{
	console.log('Need to fill config.json with discord bot informations');
	exit(0);
}

if(!('errorLogGuild' in config) || config.errorLogGuild.length == 0)
{
	config.errorLogGuild = "";
	fs.writeFileSync('config.json', JSON.stringify(config, null, 4));
	console.log('No error log guild specified');
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

const rest = new REST({ version: '9' }).setToken(config.token);
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
DataManager.LexiconManager = LexiconManager;

let isInit = false;

client.on('ready', async function () {
	console.log("Connected");

	if (!client.application?.owner) await client.application?.fetch();

	await refreshCommands();

	client.on(Events.InteractionCreate, async function(interaction)
	{		
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
				DataManager.logError(interaction.guild, 'Command ' + interaction.commandName + ' Error :\n\n' + executionError);
			} 
			catch(replyError)
			{
				try 
				{
					await interaction.editReply('There was an error while executing this command!');
					DataManager.logError(interaction.guild, 'Command ' + interaction.commandName + ' Error :\n\n' + replyError + '\n' + executionError);
				}
				catch(cantReplyError)
				{
					DataManager.logError(interaction.guild, 'Command ' + interaction.commandName + ' Error : Answer is too long');
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
		LexiconManager.initLexicon(DataManager, guild);
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
		await rest.put(Routes.applicationGuildCommands(config.clientId, guild.id), { body: guildCommandData });
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
		try
		{
			await channel.send('Info: ' + error);
		}
		catch(error)
		{
			console.log('Can\'t log error : ' + error);
		}
	}
}

if(caughtException && config.errorLogGuild.length > 0)
{
	process.once('uncaughtException', async function (err)
	{
		await DataManager.logError(await DiscordUtils.getGuildById(client, config.errorLogGuild), 'Uncaught exception: ' + err);
		console.log('Uncaught exception: ' + err);
		exit(1);
	});
}

DataManager.refreshCommandForGuild = refreshCommandForGuild;
DataManager.logError = logError;

client.login(config.token);