require('dotenv').config();
const express = require('express');
const mercadopago = require('mercadopago');
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
const { QuickDB } = require('quick.db');

const db = new QuickDB();
mercadopago.configure({ access_token: process.env.MP_TOKEN });

/* ========= WEB SERVER (Render) ========= */
const app = express();
app.use(express.json());
app.get('/', (req, res) => res.send('OK'));
app.listen(3000, () => console.log('Web ok'));

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
    .addStringOption(o => o.setName('nome').setRequired(true))
    .addIntegerOption(o => o.setName('preco').setRequired(true))
    .addStringOption(o => o.setName('pix').setRequired(true))
    .addStringOption(o => o.setName('imagem').setRequired(true)),

  new SlashCommandBuilder()
    .setName('addestoque')
    .setDescription('Adicionar estoque')
    .addStringOption(o => o.setName('id').setRequired(true))
    .addIntegerOption(o => o.setName('qtd').setRequired(true)),

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

  const payment = await mercadopago.payment.findById(id);
  if (payment.body.status === 'approved') {
    const produtoId = payment.body.external_reference;
    let produto = await db.get(`produtos.${produtoId}`);
    if (produto && produto.estoque > 0) {
      produto.estoque -= 1;
      await db.set(`produtos.${produtoId}`, produto);
      console.log(`Venda confirmada: ${produto.nome}`);
    }
  }
  res.sendStatus(200);
});

/* ========= INTERAÇÕES ========= */
client.on('interactionCreate', async (interaction) => {

  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === 'addproduto') {
      const id = Date.now().toString();
      await db.set(`produtos.${id}`, {
        nome: interaction.options.getString('nome'),
        preco: interaction.options.getInteger('preco'),
        pix: interaction.options.getString('pix'),
        imagem: interaction.options.getString('imagem'),
        estoque: 0
      });
      return interaction.reply(`✅ Produto criado!\nID: ${id}`);
    }

    if (interaction.commandName === 'addestoque') {
      const id = interaction.options.getString('id');
      const qtd = interaction.options.getInteger('qtd');
      let p = await db.get(`produtos.${id}`);
      p.estoque += qtd;
      await db.set(`produtos.${id}`, p);
      return interaction.reply(`📦 Estoque de ${p.nome}: ${p.estoque}`);
    }

    if (interaction.commandName === 'painel') {
      const produtos = await db.get('produtos') || {};
      for (let id in produtos) {
        const p = produtos[id];

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
      return interaction.reply({ content: '🛒 Loja:', ephemeral: true });
    }
  }

  /* ========= BOTÃO COMPRAR ========= */
  if (interaction.isButton()) {
    const produto = await db.get(`produtos.${interaction.customId}`);

    const pagamento = await mercadopago.payment.create({
      transaction_amount: Number(produto.preco),
      description: produto.nome,
      payment_method_id: 'pix',
      payer: { email: 'cliente@email.com' },
      external_reference: interaction.customId
    });

    const pix = pagamento.body.point_of_interaction.transaction_data.qr_code;
    const qr = pagamento.body.point_of_interaction.transaction_data.qr_code_base64;

    const embed = new EmbedBuilder()
      .setTitle(`Pague ${produto.nome}`)
      .setDescription(`PIX copia e cola:\n${pix}`)
      .setImage(`data:image/png;base64,${qr}`);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

});

client.login(process.env.TOKEN);
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot online');
});

app.listen(3000, () => {
  console.log('Web server ativo na porta 3000');
});