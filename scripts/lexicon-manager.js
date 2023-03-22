const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, '../lexicons');
let lexicon = {};

async function initLexicon(dataManager, guild)
{
    if(!fs.existsSync(directoryPath))
    {
        fs.mkdirSync(directoryPath);
    }
    
    let file = path.join(directoryPath, guild.id + '.json');
    if(!fs.existsSync(file))
    {
        lexicon[guild.id] = {};
    }
    else
    {
        lexicon[guild.id] = await JSON.parse(await fs.promises.readFile(file, 'utf8'));
    }
}

function isWordExist(guildId, word)
{
    return word in lexicon[guildId];
}

function addWordAndDefinition(guildId, word, definition)
{
    if(isWordExist(guildId, word))
    {
        return false;
    }

    lexicon[guildId][word] = definition;
    writeData(guildId);
    return true;
}

function editWordAndDefinition(guildId, word, definition)
{
    if(!isWordExist(guildId, word))
    {
        return false;
    }

    lexicon[guildId][word] = definition;
    writeData(guildId);
    return true;
}

function removeWord(guildId, word)
{
    if(!isWordExist(guildId, word))
    {
        return false;
    }

    delete lexicon[guildId][word];
    writeData(guildId);
    return true;
}

function getDefinition(guildId, word)
{
    if(!isWordExist(guildId, word))
    {
        return null;
    }

    return lexicon[guildId][word];
}

function writeData(guildId)
{
    fs.writeFileSync(path.join(directoryPath, guildId + '.json'), JSON.stringify(lexicon[guildId]));
}

module.exports =
{
    initLexicon,
    isWordExist,
    addWordAndDefinition,
    editWordAndDefinition,
    removeWord,
    getDefinition
}