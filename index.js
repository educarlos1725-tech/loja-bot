require('dotenv').config();
const express = require('express');
const app = express();
app.get('/', (req,res)=>res.send('Bot online'));
app.listen(3000);

const {
Client,
GatewayIntentBits,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
EmbedBuilder,
PermissionsBitField,
ChannelType
} = require('discord.js');

const { QuickDB } = require('quick.db');
const db = new QuickDB();

const client = new Client({
intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

client.once('ready', async () => {
console.log('Bot online');

await client.application.commands.set([
{ name: 'admin', description: 'Painel da loja' }
]);
});

client.on('interactionCreate', async (i) => {

if (i.isChatInputCommand() && i.commandName === 'admin') {
await i.deferReply({ephemeral:true});

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId('criar').setLabel('Criar Produto').setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId('listar').setLabel('Listar Produtos').setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId('estoque').setLabel('Adicionar Estoque').setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId('enviar').setLabel('Enviar Produto').setStyle(ButtonStyle.Danger),
);

return i.editReply({content:'🛒 Painel Admin',components:[row]});
}

if(i.isButton()){

// CRIAR PRODUTO
if(i.customId==='criar'){
await i.reply({content:'Digite:\n`nome | preco | descricao`',ephemeral:true});

const filter=m=>m.author.id===i.user.id;
const msg=await i.channel.awaitMessages({filter,max:1});
const [nome,preco,desc]=msg.first().content.split('|').map(x=>x.trim());

await db.set(`prod_${nome}`,{nome,preco,desc,estoque:[]});
return i.followUp({content:'Produto criado!',ephemeral:true});
}

// LISTAR
if(i.customId==='listar'){
const data=await db.all();
const prods=data.filter(p=>p.id.startsWith('prod_'));
if(!prods.length) return i.reply({content:'Nenhum produto.',ephemeral:true});

let txt='';
for(let p of prods){
txt+=`**${p.value.nome}** | R$${p.value.preco} | Estoque: ${p.value.estoque.length}\n`;
}

return i.reply({content:txt,ephemeral:true});
}

// ESTOQUE
if(i.customId==='estoque'){
await i.reply({content:'Digite:\n`nome | item`',ephemeral:true});

const filter=m=>m.author.id===i.user.id;
const msg=await i.channel.awaitMessages({filter,max:1});
const [nome,item]=msg.first().content.split('|').map(x=>x.trim());

let prod=await db.get(`prod_${nome}`);
if(!prod) return i.followUp({content:'Produto não existe',ephemeral:true});

prod.estoque.push(item);
await db.set(`prod_${nome}`,prod);

return i.followUp({content:'Item adicionado!',ephemeral:true});
}

// ENVIAR PRODUTO
if(i.customId==='enviar'){
await i.reply({content:'Digite:\n`nome | #canal`',ephemeral:true});

const filter=m=>m.author.id===i.user.id;
const msg=await i.channel.awaitMessages({filter,max:1});
const [nome,canalTag]=msg.first().content.split('|').map(x=>x.trim());

const canal=i.guild.channels.cache.find(c=>c.toString()===canalTag);
let prod=await db.get(`prod_${nome}`);
if(!prod) return i.followUp({content:'Produto não existe',ephemeral:true});

const embed=new EmbedBuilder()
.setTitle(prod.nome)
.setDescription(prod.desc)
.addFields(
{name:'Preço',value:`R$${prod.preco}`},
{name:'Estoque',value:`${prod.estoque.length}`}
);

const row=new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`buy_${nome}`).setLabel('Comprar').setStyle(ButtonStyle.Success)
);

canal.send({embeds:[embed],components:[row]});
return i.followUp({content:'Produto enviado!',ephemeral:true});
}

// COMPRAR
if(i.customId.startsWith('buy_')){
const nome=i.customId.replace('buy_','');
let prod=await db.get(`prod_${nome}`);

if(prod.estoque.length===0)
return i.reply({content:'Sem estoque',ephemeral:true});

const canal=await i.guild.channels.create({
name:`compra-${i.user.username}`,
type:ChannelType.GuildText,
permissionOverwrites:[
{id:i.guild.id,deny:[PermissionsBitField.Flags.ViewChannel]},
{id:i.user.id,allow:[PermissionsBitField.Flags.ViewChannel]}
]
});

canal.send(`Faça o PIX de R$${prod.preco} e aguarde.`);
return i.reply({content:`Canal criado: ${canal}`,ephemeral:true});
}

}

});

client.login(process.env.TOKEN);