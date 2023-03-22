const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

let allCommands = [];

allCommands.push({
	data: new SlashCommandBuilder()
		.setName('ajout-lexique')
		.setDescription('Ajoute une définition au lexique')
		.addStringOption(option =>
			option
				.setName('mot-s')
				.setDescription('Le mot ou la suite de mots à ajouter au lexique')
				.setRequired(true))
		.addStringOption(option =>
			option
				.setName('def')
				.setDescription('La définition du mot ou de la suite de mots')
				.setRequired(true)),

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		let word = interaction.options.getString('mot-s');
		let def = interaction.options.getString('def');

		if(dataManager.LexiconManager.addWordAndDefinition(interaction.guild.id, word, def))
		{
			interaction.reply({content: 'La définition de "' + word + '" a été ajouté au lexique', ephemeral: true});
			return;
		}

		let content = 'La définition de "' + word + '" existe déjà dans le lexique avec la définition : "' + dataManager.LexiconManager.getDefinition(interaction.guild.id, word) + '"';
		content += '\nVoulez-vous la remplacer par "' + def + '" ?';

		let actionRow = new ActionRowBuilder();
		actionRow.addComponents(
			new ButtonBuilder()
				.setCustomId('replace')
				.setLabel('Remplacer')
				.setStyle(ButtonStyle.Success),

			new ButtonBuilder()
				.setCustomId('cancel')
				.setLabel('Ne pas remplacer')
				.setStyle(ButtonStyle.Danger)
		);

		let newMessage = await interaction.reply({content: content, ephemeral: true, components: [actionRow]});
		let filter = (button) => button.user.id === interaction.user.id;
		let collector = newMessage.createMessageComponentCollector({filter, time: 60 * 60 * 1000});

		collector.once('collect', async function(component) 
		{
			if(component.customId === 'replace')
			{
				dataManager.LexiconManager.editWordAndDefinition(interaction.guild.id, word, def);
				interaction.editReply({content: 'La définition de "' + word + '" a été remplacée dans le lexique', ephemeral: true, components: []});
			}
			else
			{
				interaction.editReply({content: 'La définition de "' + word + '" n\'a pas été remplacée dans le lexique', ephemeral: true, components: []});
			}
		});
	}
});

allCommands.push({
	data: new SlashCommandBuilder()
		.setName('suppression-lexique')
		.setDescription('Supprime un mot et sa définition au lexique')
		.addStringOption(option =>
			option
				.setName('mot-s')
				.setDescription('Le mot ou la suite de mots à supprimer du lexique')
				.setRequired(true)),

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		let word = interaction.options.getString('mot-s');

		if(dataManager.LexiconManager.removeWord(interaction.guild.id, word))
		{
			interaction.reply({content: 'La définition de "' + word + '" a été supprimée du lexique', ephemeral: true});
		}
		else
		{
			interaction.reply({content: 'La définition de "' + word + '" n\'existe pas dans le lexique', ephemeral: true});
		}
	}
});

allCommands.push({
	data: new SlashCommandBuilder()
		.setName('lexique')
		.setDescription('Rechercher la définition d\'un mot ou d\'une suite de mots dans le lexique')
		.addStringOption(option =>
			option
				.setName('mot-s')
				.setDescription('Le mot ou la suite de mots à rechercher dans le lexique')
				.setRequired(true)),

	async execute(interaction, dataManager) {
		dataManager.initGuildData(interaction.guild.id);

		let word = interaction.options.getString('mot-s');
		let def = dataManager.LexiconManager.getDefinition(interaction.guild.id, word);

		if(def === null)
		{
			interaction.reply({content: 'La définition de "' + word + '" n\'existe pas dans le lexique', ephemeral: true});
			return;
		}

		let actionRow = new ActionRowBuilder();
		actionRow.addComponents(
			new ButtonBuilder()
				.setCustomId('send-all')
				.setLabel('L\'envoyer à tout le monde')
				.setStyle(ButtonStyle.Secondary),
		);

		let newMessage = await interaction.reply({content: '"' + word + '" : "' + def + '"', ephemeral: true, components: [actionRow]});
	
		let filter = (button) => button.user.id === interaction.user.id;
		let collector = newMessage.createMessageComponentCollector({filter, time: 60 * 60 * 1000});

		collector.once('collect', async function(component)
		{
			interaction.editReply({content: 'Définition envoyée !', ephemeral: false, components: []});
			interaction.channel.send('"' + word + '" : "' + def + '"');
		});
	}
});

module.exports = {
	allCommands
};