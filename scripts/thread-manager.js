const DiscordUtils = require('./discord-utils.js');

let threadListeners = {};

const endSentenceChar = ['.', '!', '?', ';'];

async function refreshAllThreadListener(dataManager, guild)
{
    let guildData = dataManager.getServerData(guild.id);

    for(let channelId in guildData.autoCreateThreads)
    {
        await refreshThreadListener(dataManager, guild, channelId, guildData.autoCreateThreads[channelId].format);
    }
}

async function refreshThreadListener(dataManager, guild, channelId, format)
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

                    if(message.content.slice(i, i + 4) == 'http')
                    {
                        if(threadName.length == 0)
                        {
                            if(message.content[i + 4] == 's')
                            {
                                i += 5;
                            }
                            else
                            {
                                i += 4;
                            }

                            threadName = message.content.slice(i + 3).split('/')[0].split('?')[0];
                        }
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

        try
        {
            await message.startThread({name: threadName});
        }
        catch(error)
        {
            dataManager.logError(guild, error + '\nMessage: ' + message.url + '\nThread Name:' + threadName);
        }
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

    threadListeners[guild.id][channelId].stop();
    delete threadListeners[guild.id][channelId];
}

module.exports = 
{
	refreshAllThreadListener,
    refreshThreadListener,
    deleteThreadListener
}