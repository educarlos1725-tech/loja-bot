require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const QuickDB = require('quick.db');
const db = new QuickDB.QuickDB();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

client.once('ready', async () => {
  console.log(`Logado como ${client.user.tag}`);

  await client.application.commands.set([
    { name: 'admin', description: 'Painel admin da loja' }
  ]);
});

client.on('interactionCreate', async (i) => {

  // PAINEL ADMIN
  if (i.isChatInputCommand() && i.commandName === 'admin') {
    await i.deferReply({ ephemeral: true });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('criar_produto').setLabel('Criar Produto').setStyle(ButtonStyle.Success),
      new ButtonBuilder()