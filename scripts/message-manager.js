const DiscordUtils = require('./discord-utils.js');
const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const minTimeBeetweenMessage = 1000 * 60 * 1;
const maxObjectSize = 50;
const maxMessageSize = 2000 - maxObjectSize;

let messageData = {};
let questionCollectors = {};

function createQuestionEmbed(obj, messageContent)
{
    let embed = new EmbedBuilder();
    embed.setTitle('Nouvelle question anonyme');
    embed.setDescription('Objet : ' + obj + '\n\n' + messageContent);
    return embed;
}

function createPropalEmbed(obj, messageContent)
{
    let embed = new EmbedBuilder();
    embed.setTitle('Nouvelle proposition');
    embed.setDescription('Objet : ' + obj + '\n\n' + messageContent);
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
            return 'Vous devez attendre encore ' + Math.ceil((minTimeBeetweenMessage - diff) / 1000) + ' secondes avant de pouvoir reposer une question anonyme ou une proposition.';
        }
    }

    return null;
}

async function sendModalMessage(dataManager, guild, user, obj, messageContent, channelId, emojiToReact = [])
{
    let userId = user.id;
    let guildData = dataManager.getServerData(guild.id);

    let userError = checkUserError(dataManager, guild, userId);
    if(userError != null)
    {
        return userError;
    }

    if(obj.length == 0)
    {
        return 'Votre objet est vide, je ne peux l\'envoyer tel quel, j\'en suis désolé.';
    }

    if(messageContent.length == 0)
    {
        return 'Votre message est vide, je ne peux l\'envoyer tel quel, j\'en suis désolé.';
    }

    if((obj.length > maxObjectSize) || (messageContent.length > maxMessageSize))
    {
        let errorMessage;

        if(obj.length > maxObjectSize)
        {
            errorMessage = 'Votre objet est trop long (maximum : ' + maxObjectSize + ' caractères)';
        }
        else
        {
            errorMessage = 'Votre message est trop long (maximum : ' + maxMessageSize + ' caractères)';
        }

        try
        {
            await user.createDM();
            await user.send('\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\n\nUne copie de votre message pour ne pas le perdre :\n\n\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_');
            await user.send('Objet : ' + obj + '\n\n');
            for(let i = 0; i < (messageContent.length / maxMessageSize); i++)
            {
                await user.send(messageContent.substring(i * maxMessageSize, (i + 1) * maxMessageSize));
            }

            return errorMessage + ', je ne peux l\'envoyer tel quel, j\'en suis désolé. Pour que vous ne perdiez pas, je vous l\'ai renvoyé en MP.';
        }
        catch(error)
        {
            console.log(error);
            return errorMessage + ', je ne peux l\'envoyer tel quel, j\'en suis désolé. Une erreur m\'a empeché de vous l\'envoyer en MP.';
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

    let channel = await DiscordUtils.getChannelById(guild.client, channelId);

    if(channel == null)
    {
        dataManager.logError(guild, 'Error: The channel for question or propal don\'t exist exist');
        return 'Le channel pour envoyer votre message n\'est pas correctement paramétré. Un message anonyme a été envoyé à votre administrateur pour le prévenir.';
    }

    if(messageData[guild.id][userId].length >= 4)
    {
        messageData[guild.id][userId].shift();
    }

	let message;
    
    try
    {
        message = await channel.send({embeds: [createQuestionEmbed(obj, messageContent)]});
    }
    catch(error)
    {
        dataManager.logError(guild, 'Error: Can\'t send message in anonymous channel ' + error.message);
        return 'Je n\'ai pas les droits pour envoyer le message. Un message anonyme a été envoyé à votre administrateur pour le prévenir.';
    }

    messageData[guild.id][userId].push({'messageId': message.id, date: actualDate});

    try
    {
        for(let i = 0; i < emojiToReact.length; i++)
        {
            await message.react(emojiToReact[i]);
        }
        await message.startThread({name: obj});
    }
    catch(error)
    {
        dataManager.logError(guild, 'Error: Can\'t create thead for anonymous messages : ' + error.message);
    }

    return 'Message envoyé anonymement !';
}

async function collectQuestions(dataManager, guild)
{
    let channelId = dataManager.getServerData(guild.id).askButtonChannel;
    let channel = await DiscordUtils.getChannelById(guild.client, channelId);

    removeCollector(guild, 'ask');

    if(channel == null)
    {
        return;
    }

    const questionModal = new ModalBuilder()
								.setCustomId('anonymous-question-modal')
								.setTitle('Question anonyme');

    const objectRow = new ActionRowBuilder()
        .addComponents(
            new TextInputBuilder()
                .setCustomId('question-object')
                .setLabel('Objet de la question')
                .setStyle(TextInputStyle.Short)
        );
    
    const questionRow = new ActionRowBuilder()
        .addComponents(
            new TextInputBuilder()
                .setCustomId('question-text')
                .setLabel('Contenu de la question')
                .setStyle(TextInputStyle.Paragraph)
        );

    questionModal.addComponents(objectRow, questionRow);

    const filter = i => i.customId === 'ask';

    if(!(guild.id in questionCollectors))
    {
        questionCollectors[guild.id] = {};
    }

    questionCollectors[guild.id].ask = channel.createMessageComponentCollector({ filter, time: 0 });

    questionCollectors[guild.id].ask.on('collect', async function(button)
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

async function collectPropal(dataManager, guild)
{
    let channelId = dataManager.getServerData(guild.id).propalButtonChannel;
    let channel = await DiscordUtils.getChannelById(guild.client, channelId);

    removeCollector(guild, 'propal');

    if(channel == null)
    {
        return;
    }

    const propalModal = new ModalBuilder()
								.setCustomId('propal-modal')
								.setTitle('Proposition');

    const objectRow = new ActionRowBuilder()
        .addComponents(
            new TextInputBuilder()
                .setCustomId('propal-object')
                .setLabel('Objet de la proposition')
                .setStyle(TextInputStyle.Short)
        );
    
    const propalRow = new ActionRowBuilder()
        .addComponents(
            new TextInputBuilder()
                .setCustomId('propal-text')
                .setLabel('Contenu de la proposition')
                .setStyle(TextInputStyle.Paragraph)
        );

        propalModal.addComponents(objectRow, propalRow);

    const filter = i => i.customId === 'propal';

    if(!(guild.id in questionCollectors))
    {
        questionCollectors[guild.id] = {};
    }

    questionCollectors[guild.id].propal = channel.createMessageComponentCollector({ filter, time: 0 });

    questionCollectors[guild.id].propal.on('collect', async function(button)
    {
        let userError = checkUserError(dataManager, guild, button.user.id);
        if(userError != null)
        {
            button.reply({content: userError, ephemeral: true});
            return;
        }
        
        button.showModal(propalModal);
    });
}

function removeCollector(guild, type)
{
    if(guild.id in questionCollectors)
    {
        if(type in questionCollectors[guild.id])
        {
            questionCollectors[guild.id][type].stop();
            delete questionCollectors[guild.id][type];
        }
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
	sendModalMessage,
    collectQuestions,
    collectPropal,
    removeCollector,
    getAuthor
}