require('dotenv').config();
const fs = require('fs');
const express = require('express');

/* ========= WEB SERVER RENDER ========= */
const app = express();
app.get('/', (req,res)=> res.send('Bot online'));
app.listen(3000, ()=> console.log('Web server porta 3000'));

/* ========= DISCORD ========= */
const {
  Client,
  GatewayIntentBits,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/* ========= BANCO ========= */
const DB = 'db.json';
function db(){
  if(!fs.existsSync(DB)){
    fs.writeFileSync(DB, JSON.stringify({
      config:{
        pix:'',
        cor:'#2b2d31',
        nomeBot:'',
        avatarBot:''
      },
      produtos:{}
    },null,2));
  }
  return JSON.parse(fs.readFileSync(DB));
}
function save(d){ fs.writeFileSync(DB, JSON.stringify(d,null,2)); }

/* ========= REGISTRAR /admin ========= */
client.once('ready', async ()=>{
  console.log('Bot Admin ON');

  await client.application.commands.set([
    { name:'admin', description:'Painel administrativo' }
  ]);
});

/* ========= INTERAÇÕES ========= */
client.on('interactionCreate', async (i)=>{
  const data = db();

  /* ===== /admin ===== */
  if(i.isChatInputCommand() && i.commandName==='admin'){
    await i.deferReply({ephemeral:true});

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pix').setLabel('Alterar PIX').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('visual').setLabel('Alterar Cor Embed').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('bot').setLabel('Alterar Bot').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('produto').setLabel('Criar Produto').setStyle(ButtonStyle.Danger)
    );

    return i.editReply({content:'⚙️ Painel Admin',components:[row]});
  }

  /* ===== BOTÕES ===== */
  if(i.isButton()){

    if(i.customId==='pix'){
      const modal = new ModalBuilder()
        .setCustomId('modal_pix')
        .setTitle('Alterar Chave PIX');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('pix_input')
            .setLabel('Nova chave PIX')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return i.showModal(modal);
    }

    if(i.customId==='visual'){
      const modal = new ModalBuilder()
        .setCustomId('modal_visual')
        .setTitle('Alterar Cor do Embed');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('cor_input')
            .setLabel('Cor HEX (#ffffff)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return i.showModal(modal);
    }

    if(i.customId==='bot'){
      const modal = new ModalBuilder()
        .setCustomId('modal_bot')
        .setTitle('Alterar Bot');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('nome_bot')
            .setLabel('Novo nome do bot')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('avatar_bot')
            .setLabel('URL nova foto')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return i.showModal(modal);
    }

    if(i.customId==='produto'){
      const modal = new ModalBuilder()
        .setCustomId('modal_produto')
        .setTitle('Criar Produto');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('nome_prod')
            .setLabel('Nome do produto')
            .setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('preco_prod')
            .setLabel('Preço')
            .setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('img_prod')
            .setLabel('Imagem URL')
            .setStyle(TextInputStyle.Short)
        )
      );

      return i.showModal(modal);
    }
  }

  /* ===== MODAIS ===== */
  if(i.isModalSubmit()){

    if(i.customId==='modal_pix'){
      data.config.pix = i.fields.getTextInputValue('pix_input');
      save(data);
      return i.reply({content:'PIX alterado!',ephemeral:true});
    }

    if(i.customId==='modal_visual'){
      data.config.cor = i.fields.getTextInputValue('cor_input');
      save(data);
      return i.reply({content:'Cor alterada!',ephemeral:true});
    }

    if(i.customId==='modal_bot'){
      await client.user.setUsername(i.fields.getTextInputValue('nome_bot'));
      await client.user.setAvatar(i.fields.getTextInputValue('avatar_bot'));
      return i.reply({content:'Bot atualizado!',ephemeral:true});
    }

    if(i.customId==='modal_produto'){
      const id = Date.now().toString();
      data.produtos[id]={
        nome:i.fields.getTextInputValue('nome_prod'),
        preco:i.fields.getTextInputValue('preco_prod'),
        imagem:i.fields.getTextInputValue('img_prod'),
        estoque:0
      };
      save(data);
      return i.reply({content:`Produto criado! ID: ${id}`,ephemeral:true});
    }
  }

});

client.login(process.env.TOKEN);