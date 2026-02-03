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

const mp = new MercadoPagoConfig({ accessToken: process.env.MP_TOKEN });
const payment = new Payment(mp);

/* ========= BANCO ========= */
const DB = 'db.json';
function db() {
  if (!fs.existsSync(DB)) fs.writeFileSync(DB, JSON.stringify({ produtos:{} }, null, 2));
  return JSON.parse(fs.readFileSync(DB));
}
function save(data){ fs.writeFileSync(DB, JSON.stringify(data,null,2)); }

/* ========= WEB SERVER ========= */
const app = express();
app.use(express.json());
app.listen(3000);

/* ========= DISCORD ========= */
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/* ========= SLASH COMMANDS ========= */
const commands = [
  new SlashCommandBuilder()
    .setName('criarproduto')
    .setDescription('Criar produto')
    .addStringOption(o => o.setName('nome').setDescription('Nome').setRequired(true))
    .addIntegerOption(o => o.setName('preco').setDescription('Preço').setRequired(true))
    .addStringOption(o => o.setName('imagem').setDescription('URL da imagem').setRequired(true)),

  new SlashCommandBuilder()
    .setName('addestoque')
    .setDescription('Adicionar estoque')
    .addStringOption(o => o.setName('id').setDescription('ID do produto').setRequired(true))
    .addIntegerOption(o => o.setName('qtd').setDescription('Quantidade').setRequired(true)),

  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Enviar painel da loja')
    .addChannelOption(o =>
      o.setName('canal')
       .setDescription('Canal da loja')
       .setRequired(true))
].map(c=>c.toJSON());

const rest = new REST({ version:'10'}).setToken(process.env.TOKEN);
(async()=>{
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID),{body:commands});
})();

/* ========= WEBHOOK MP ========= */
app.post('/webhook', async (req,res)=>{
  const id = req.body.data?.id;
  if(!id) return res.sendStatus(200);

  const info = await payment.get({id});
  if(info.status==='approved'){
    const produtoId = info.external_reference;
    const data = db();
    if(data.produtos[produtoId].estoque > 0){
      data.produtos[produtoId].estoque--;
      save(data);
    }
  }
  res.sendStatus(200);
});

/* ========= INTERAÇÕES ========= */
client.on('interactionCreate', async i=>{
  const data = db();

  if(i.isChatInputCommand()){

    if(i.commandName==='criarproduto'){
      const id = Date.now().toString();
      data.produtos[id]={
        nome:i.options.getString('nome'),
        preco:i.options.getInteger('preco'),
        imagem:i.options.getString('imagem'),
        estoque:0
      };
      save(data);
      return i.reply(`Produto criado! ID: ${id}`);
    }

    if(i.commandName==='addestoque'){
      const id = i.options.getString('id');
      data.produtos[id].estoque += i.options.getInteger('qtd');
      save(data);
      return i.reply('Estoque atualizado!');
    }

    if(i.commandName==='painel'){
      const canal = i.options.getChannel('canal');

      for(let id in data.produtos){
        const p = data.produtos[id];

        const embed = new EmbedBuilder()
          .setTitle(p.nome)
          .setDescription(`💰 R$${p.preco}\n📦 Estoque: ${p.estoque}`)
          .setImage(p.imagem);

        const btn = new ButtonBuilder()
          .setCustomId(id)
          .setLabel('Comprar')
          .setStyle(ButtonStyle.Success);

        await canal.send({
          embeds:[embed],
          components:[new ActionRowBuilder().addComponents(btn)]
        });
      }

      return i.reply({content:'Painel enviado!',ephemeral:true});
    }
  }

  if(i.isButton()){
    const p = data.produtos[i.customId];

    const pay = await payment.create({
      body:{
        transaction_amount:Number(p.preco),
        description:p.nome,
        payment_method_id:'pix',
        payer:{email:'cliente@email.com'},
        external_reference:i.customId
      }
    });

    const pix = pay.point_of_interaction.transaction_data.qr_code;
    const qr = pay.point_of_interaction.transaction_data.qr_code_base64;

    const embed = new EmbedBuilder()
      .setTitle('Pagamento PIX')
      .setDescription(`Copie e cole:\n${pix}`)
      .setImage(`data:image/png;base64,${qr}`);

    i.reply({embeds:[embed],ephemeral:true});
  }
});

client.login(process.env.TOKEN);