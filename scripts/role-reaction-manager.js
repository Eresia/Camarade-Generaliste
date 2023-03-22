const { EmbedBuilder } = require('discord.js');
const DiscordUtils = require('./discord-utils.js');

let collectors = {};

async function initAllReactCollectorOnMessage(dataManager, guild)
{
    let guildData = dataManager.getServerData(guild.id);

    for(let categoryName in guildData.roleCategories)
    {
        await initReactCollectorOnMessage(dataManager, guild, categoryName);
    }
}

async function initReactCollectorOnMessage(dataManager, guild, categoryName)
{
	let guildData = dataManager.getServerData(guild.id);

    removeReactCollector(dataManager, guild, categoryName);

    if(!(categoryName in guildData.roleCategories))
    {
        return;
    }

    let message = await DiscordUtils.getMessageById(guild.client, guildData.roleCategories[categoryName].channelId, guildData.roleCategories[categoryName].messageId);

    if(message == null)
    {
        return;
    }

    await message.edit({embeds: [createRoleReactionEmbedMessage(dataManager, guild, categoryName)]});

    if(!(guild.id in collectors))
    {
        collectors[guild.id] = {};
    }

    let filter = function(reaction, user)
    {
        if(user.bot)
        {
            return false;
        }

        if(!(reaction.emoji.name in guildData.roleCategories[categoryName].roles))
        {
            return false;
        }

        return true;
    };

    let collector = message.createReactionCollector({filter, dispose: true, max: 0});

    collector.on('collect', async function(reaction, user)
    {
        if(!(reaction.emoji.name in guildData.roleCategories[categoryName].roles))
        {
            return;
        }

        let role = await DiscordUtils.getRoleById(guild, guildData.roleCategories[categoryName].roles[reaction.emoji.name].roleId);

        if(role == null)
        {
            return;
        }

        let member = await DiscordUtils.getMemberById(guild, user.id);

        if(member == null)
        {
            return;
        }

        try
        {
            await member.roles.add(role);
        }
        catch(error)
        {
            dataManager.logError(guild, error + '\n(Try to add role ' + role.name + ' to ' + member.user.username + ')');
            console.log(error);
        }
    });

    collector.on('remove', async function(reaction, user)
    {
        if(!(reaction.emoji.name in guildData.roleCategories[categoryName].roles))
        {
            return;
        }

        let role = await DiscordUtils.getRoleById(guild, guildData.roleCategories[categoryName].roles[reaction.emoji.name].roleId);
        
        if(role == null)
        {
            return;
        }

        let member = await DiscordUtils.getMemberById(guild, user.id);

        if(member == null)
        {
            return;
        }

        try
        {
            await member.roles.remove(role);
        }
        catch(error)
        {
            console.log(error);
        }
    });

    collectors[guild.id][categoryName] = collector;
}

function removeReactCollector(dataManager, guild, categoryName)
{
	let guildData = dataManager.getServerData(guild.id);

    if(!(guild.id in collectors))
    {
        return;
    }

    if(!(categoryName in collectors[guild.id]))
    {
        return;
    }

    collectors[guild.id][categoryName].stop();
    delete collectors[guild.id][categoryName];
}

function createRoleReactionEmbedMessage(dataManager, guild, categoryName)
{
	let guildData = dataManager.getServerData(guild.id);

    let resultEmbed = new EmbedBuilder();

    let description = guildData.roleCategories[categoryName].display;
    description += '\n\n';

    for(let emoji in guildData.roleCategories[categoryName].roles)
    {
        description += emoji + ' - ' + guildData.roleCategories[categoryName].roles[emoji].name + '\n';
    }

    resultEmbed.setDescription(description);

    return resultEmbed;

}

module.exports = 
{
    initAllReactCollectorOnMessage,
    initReactCollectorOnMessage,
    removeReactCollector,
    createRoleReactionEmbedMessage
}