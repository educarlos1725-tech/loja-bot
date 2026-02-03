require('dotenv').config();
const fs = require('fs');
const express = require('express');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes
} = require('discord.js');

const { MercadoPagoConfig, Payment } = require('mercadopago');

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_TOKEN
});
const payment = new Payment(mpClient);

const DB_FILE = 'database.json';

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ produtos: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

const app = express();
app.use(express.json());
app.get('/', (req, res) => res.send('OK'));
app.listen(3000);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log('Bot online');
});

const commands = [
  new SlashCommandBuilder()
    .setName('addproduto')
    .setDescription('Criar produto')
    .addStringOption(o =>
      o.setName('nome')
        .setDescription('Nome')
        .setRequired(true))
    .addIntegerOption(o =>
      o.setName('preco')
        .setDescription('Preço')
        .setRequired(true))
    .addStringOption(o =>
      o.setName('imagem')
        .setDescription('Imagem')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Mostrar loja')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );
})();

client.on('interactionCreate', async (i) => {
  if (i.isChatInputCommand()) {

    if (i.commandName === 'addproduto') {
      const db = readDB();
      const id = Date.now().toString();

      db.produtos[id] = {
        nome: i.options.getString('nome'),
        preco: i.options.getInteger('preco'),
        imagem: i.options.getString('imagem')
      };

      writeDB(db);
      return i.reply('Produto criado');
    }

    if (i.commandName === 'painel') {
      const db = readDB();

      for (let id in db.produtos) {
        const p = db.produtos[id];

        const embed = new EmbedBuilder()
          .setTitle(p.nome)
          .setDescription(`R$ ${p.preco}`)
          .setImage(p.imagem);

        await i.channel.send({ embeds: [embed] });
      }

      return i.reply({ content: 'Loja enviada', ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);