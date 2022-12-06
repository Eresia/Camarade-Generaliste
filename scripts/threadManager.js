const DiscordUtils = require('./discord-utils.js');

let threadListeners = {};

const endSentenceChar = ['.', '!', '?', ';'];

async function refreshAllThreadListener(dataManager, guild)
{
    let guildData = dataManager.getServerData(guild.id);

    for(let channelId in guildData.autoCreateThreads)
    {
        await refreshThreadListener(guild, channelId, guildData.autoCreateThreads[channelId].format);
    }
}

async function refreshThreadListener(guild, channelId, format)
{
    deleteThreadListener(guild, channelId);

    let channel = await DiscordUtils.getChannelById(guild.client, channelId);
    if(channel == null)
    {
        return;
    }

    let filter = function(m)
    {
        return !m.member.user.bot;
    }

    let collector = channel.createMessageCollector({filter, max: 0});

    collector.on('collect', async function(message)
    {
        let threadName = '';

        switch(format)
        {
            case 'SENTENCE':
            {
                for(let i = 0; i < Math.min(message.content.length, 100); i++)
                {
                    if(endSentenceChar.includes(message.content[i]))
                    {
                        threadName += message.content[i];
                        break;
                    }

                    if(message.content[i] == '\n')
                    {
                        break;
                    }

                    threadName += message.content[i];
                }
                break;
            }

            case 'NAME':
            default:
            {
                threadName = await DiscordUtils.getUserNameById(guild, message.member.user.id);
            }
        }

        message.startThread({name: threadName});
    });

    if(!(guild.id in threadListeners))
    {
        threadListeners[guild.id] = {};
    }

    threadListeners[guild.id][channelId] = collector;
}

async function deleteThreadListener(guild, channelId)
{
    if(!(guild.id in threadListeners))
    {
        return;
    }

    if(!(channelId in threadListeners[guild.id]))
    {
        return;
    }

    threadListeners[guild.id][channelId.id].stop();
    delete threadListeners[guild.id][channelId.id];
}

module.exports = 
{
	refreshAllThreadListener,
    refreshThreadListener,
    deleteThreadListener
}