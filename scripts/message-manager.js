const DiscordUtils = require('../scripts/discord-utils.js');
const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const minTimeBeetweenMessage = 1000 * 60 * 1;
const maxMessageSize = 2000;

let messageData = {};
let questionCollectors = {};

function createQuestionEmbed(messageContent)
{
    let embed = new EmbedBuilder();
    embed.setTitle('Nouvelle question anonyme');
    embed.setDescription(messageContent);
    return embed;
}

function checkUserError(dataManager, guild, userId)
{
    let guildData = dataManager.getServerData(guild.id);

    if(guildData.bannedUsers.includes(userId))
    {
        return 'Vous avez été bannis des services de questions anonymes. Si vous pensez que c\'est une erreur, merci de contacter l\'administrateur·ice de votre serveur.';
    }

    if(!(guild.id in messageData))
    {
        return null;
    }

    if(!(userId in messageData[guild.id]))
    {
        return null;
    }

    let actualDate = Date.now();

    if(messageData[guild.id][userId].length != 0)
    {
        let diff = actualDate - messageData[guild.id][userId][messageData[guild.id][userId].length - 1].date;
        if(diff < minTimeBeetweenMessage)
        {
            return 'Vous devez attendre encore ' + Math.ceil((minTimeBeetweenMessage - diff) / 1000) + ' secondes avant de pouvoir reposer une question anonyme.';
        }
    }

    return null;
}

async function askQuestion(dataManager, guild, user, messageContent)
{
    let userId = user.id;
    let guildData = dataManager.getServerData(guild.id);

    let userError = checkUserError(dataManager, guild, userId);
    if(userError != null)
    {
        return userError;
    }

    if(messageContent.length == 0)
    {
        return 'Votre message est vide, je ne peux l\'envoyer tel quel, j\'en suis désolé.';
    }

    if(messageContent.length > maxMessageSize)
    {
        try
        {
            await user.createDM();
            await user.send('\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\n\nUne copie de votre message pour ne pas le perdre :\n\n\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_');
            for(let i = 0; i < (messageContent.length / maxMessageSize); i++)
            {
                await user.send(messageContent.substring(i * maxMessageSize, (i + 1) * maxMessageSize));
            }

            return 'Votre message est trop long (maximum : ' + maxMessageSize + ' caractères), je ne peux l\'envoyer tel quel, j\'en suis désolé. Pour que vous ne perdiez pas, je vous l\'ai renvoyé en MP.';
        }
        catch(error)
        {
            console.log(error);
            return 'Votre message est trop long (maximum : ' + maxMessageSize + ' caractères), je ne peux l\'envoyer tel quel, j\'en suis désolé. Une erreur m\'a empeché de vous l\'envoyer en MP.';
        }
    }

    if(!(guild.id in messageData))
    {
        messageData[guild.id] = {};
    }

    if(!(userId in messageData[guild.id]))
    {
        messageData[guild.id][userId] = [];
    }

    let actualDate = Date.now();

    let channel = await DiscordUtils.getChannelById(guild.client, guildData.anonymousQuestionChannel);

    if(channel == null)
    {
        dataManager.logError(guild, 'Error: No anonymous question channel exist');
        return 'Le channel de question anonyme n\'est pas correctement paramétré. Un message anonyme a été envoyé à votre administrateur pour le prévenir.';
    }

    if(messageData[guild.id][userId].length >= 4)
    {
        messageData[guild.id][userId].shift();
    }

	let message = await channel.send({embeds: [createQuestionEmbed(messageContent)]});

    messageData[guild.id][userId].push({'messageId': message.id, date: actualDate});
    return 'Message envoyé anonymement !';
}

async function collectQuestions(dataManager, guild)
{
    let channelId = dataManager.getServerData(guild.id).askChannel;
    let channel = await DiscordUtils.getChannelById(guild.client, channelId);

    removeCollector(guild);

    if(channel == null)
    {
        return;
    }

    const questionModal = new ModalBuilder()
								.setCustomId('anonymous-question-modal')
								.setTitle('Question anonyme');

    const questionRow = new ActionRowBuilder()
        .addComponents(
            new TextInputBuilder()
                .setCustomId('question-text')
                .setLabel('Posez votre question')
                .setStyle(TextInputStyle.Paragraph)
        );

    questionModal.addComponents(questionRow);

    const filter = i => i.customId === 'ask';
    questionCollectors[guild.id] = channel.createMessageComponentCollector({ filter, time: 0 });

    questionCollectors[guild.id].on('collect', async function(button)
    {
        let userError = checkUserError(dataManager, guild, button.user.id);
        if(userError != null)
        {
            button.reply({content: userError, ephemeral: true});
            return;
        }
        
        button.showModal(questionModal);
    });
}

function removeCollector(guild)
{
    if(guild.id in questionCollectors)
    {
        questionCollectors[guild.id].stop();
        delete questionCollectors[guild.id];
    }
}

function getAuthor(dataManager, guild, messageId)
{
    if(!(guild.id in messageData))
    {
        return null;
    }

    for(let userId in messageData[guild.id])
    {
        for(let i = 0; i < messageData[guild.id][userId].length; i++)
        {
            if(messageData[guild.id][userId][i].messageId == messageId)
            {
                return userId;
            }
        }
    }

    return null;
}

module.exports = 
{
	askQuestion,
    collectQuestions,
    removeCollector,
    getAuthor
}