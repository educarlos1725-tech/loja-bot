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

/* ========= MERCADO PAGO ========= */
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_TOKEN
});
const payment = new Payment(mpClient);

/* ========= BANCO JSON ========= */
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

/* ========= WEB SERVER (Render) ========= */
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('Bot online'));
app.listen(3000, () => console.log('Web server porta 3000'));

/* ========= DISCORD ========= */
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`Logado como ${client.user.tag}`);
});

/* ========= SLASH COMMANDS ========= */
const commands = [
  new SlashCommandBuilder()
    .setName('addproduto')
    .setDescription('Criar produto')
    .addStringOption(o =>
      o.setName('nome')
        .setDescription('Nome do produto')
        .setRequired(true))
    .addIntegerOption(o =>
      o.setName('preco')
        .setDescription('Preço do produto')
        .setRequired(true))
    .addStringOption(o =>
      o.setName('pix')
        .setDescription('Chave pix')
        .setRequired(true))
    .addStringOption(o =>
      o.setName('imagem')
        .setDescription('URL da imagem')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('addestoque')
    .setDescription('Adicionar estoque')
    .addStringOption(o =>
      o.setName('id')
        .setDescription('ID do produto')
        .setRequired(true))
    .addIntegerOption(o =>
      o.setName('qtd')
        .setDescription('Quantidade')
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

/* ========= WEBHOOK MERCADO PAGO ========= */
app.post('/webhook', async (req, res) => {
  const id = req.body.data?.id;
  if (!id) return res.sendStatus(200);

  const result = await payment.get({ id });

  if (result.status === 'approved') {
    const produtoId = result.external_reference;
    const db = readDB();

    if (db.produtos[produtoId] && db.produtos[produtoId].estoque > 0) {
      db.produtos[produtoId].estoque -= 1;
      writeDB(db);
      console.log(`Venda aprovada: ${db.produtos[produtoId].nome}`);
    }
  }

  res.sendStatus(200);
});

/* ========= INTERAÇÕES ========= */
client.on('interactionCreate', async (interaction) => {

  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === 'addproduto') {
      const id = Date.now().toString();
      const db = readDB();

      db.produtos[id] = {
        nome: interaction.options.getString('nome'),
        preco: interaction.options.getInteger('preco'),
        pix: interaction.options.getString('pix'),
        imagem: interaction.options.getString('imagem'),
        estoque: 0
      };

      writeDB(db);
      return interaction.reply(`✅ Produto criado! ID: ${id}`);
    }

    if (interaction.commandName === 'addestoque') {
      const id = interaction.options.getString('id');
      const qtd = interaction.options.getInteger('qtd');
      const db = readDB();

      db.produtos[id].estoque += qtd;
      writeDB(db);

      return interaction.reply(`📦 Estoque: ${db.produtos[id].estoque}`);
    }

    if (interaction.commandName === 'painel') {
      const db = readDB();

      for (let id in db.produtos) {
        const p = db.produtos[id];

        const embed = new EmbedBuilder()
          .setTitle(p.nome)
          .setDescription(`💰 R$${p.preco}\n📦 Estoque: ${p.estoque}`)
          .setImage(p.imagem);

        const botao = new ButtonBuilder()
          .setCustomId(id)
          .setLabel('Comprar')
          .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(botao);

        await interaction.channel.send({ embeds: [embed], components: [row] });
      }

      return interaction.reply({ content: '🛒 Loja enviada!', ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    const db = readDB();
    const produto = db.produtos[interaction.customId];

    const pagamento = await payment.create({
      body: {
        transaction_amount: Number(produto.preco),
        description: produto.nome,
        payment_method_id: 'pix',
        payer: { email: 'cliente@email.com' },
        external_reference: interaction.customId
      }
    });

    const pix = pagamento.point_of_interaction.transaction_data.qr_code;
    const qr = pagamento.point_of_interaction.transaction_data.qr_code_base64;

    const embed = new EmbedBuilder()
      .setTitle(`Pague ${produto.nome}`)
      .setDescription(`PIX copia e cola:\n${pix}`)
      .setImage(`data:image/png;base64,${qr}`);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

});

client.login(process.env.TOKEN);