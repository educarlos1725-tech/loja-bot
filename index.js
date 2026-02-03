require('dotenv').config();
const express = require('express');
const app = express();
app.get('/', (req,res)=>res.send('OK'));
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
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.MessageContent
]});

client.once('ready', async () => {
console.log('Bot online');

await client.application.commands.set([
{ name: 'admin', description: 'Painel da loja' }
]);
});

client.on('interactionCreate', async (i) => {

// COMANDO ADMIN
if (i.isChatInputCommand() && i.commandName === 'admin') {
await i.deferReply({flags:64});

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId('criar').setLabel('Criar Produto').setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId('listar').setLabel('Listar Produtos').setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId('estoque').setLabel('Adicionar Estoque').setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId('enviar').setLabel('Enviar Produto').setStyle(ButtonStyle.Danger)
);

return i.editReply({content:'🛒 Painel Admin',components:[row]});
}

if(i.isButton()){
await i.deferReply({flags:64});

// CRIAR PRODUTO
if(i.customId==='criar'){
i.followUp({content:'Digite:\n`nome | preco | descricao`'});
const filter=m=>m.author.id===i.user.id;
const msg=await i.channel.awaitMessages({filter,max:1});
const [nome,preco,desc]=msg.first().content.split('|').map(x=>x.trim());

await db.set(`prod_${nome}`,{nome,preco,desc,estoque:[]});
return i.editReply({content:'Produto criado!'});
}

// LISTAR
if(i.customId==='listar'){
const data=await db.all();
const prods=data.filter(p=>p.id.startsWith('prod_'));
if(!prods.length) return i.editReply({content:'Nenhum produto.'});

let txt='';
for(let p of prods){
txt+=`**${p.value.nome}** | R$${p.value.preco} | Estoque: ${p.value.estoque.length}\n`;
}
return i.editReply({content:txt});
}

// ESTOQUE
if(i.customId==='estoque'){
i.followUp({content:'Digite:\n`nome | item`'});
const filter=m=>m.author.id===i.user.id;
const msg=await i.channel.awaitMessages({filter,max:1});
const [nome,item]=msg.first().content.split('|').map(x=>x.trim());

let prod=await db.get(`prod_${nome}`);
if(!prod) return i.editReply({content:'Produto não existe'});

prod.estoque.push(item);
await db.set(`prod_${nome}`,prod);
return i.editReply({content:'Item adicionado!'});
}

// ENVIAR PRODUTO
if(i.customId==='enviar'){
i.followUp({content:'Digite:\n`nome | #canal`'});
const filter=m=>m.author.id===i.user.id;
const msg=await i.channel.awaitMessages({filter,max:1});
const [nome,canalTag]=msg.first().content.split('|').map(x=>x.trim());

const canal=i.guild.channels.cache.find(c=>c.toString()===canalTag);
let prod=await db.get(`prod_${nome}`);
if(!prod) return i.editReply({content:'Produto não existe'});

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
return i.editReply({content:'Produto enviado!'});
}

// COMPRAR
if(i.customId.startsWith('buy_')){
const nome=i.customId.replace('buy_','');
let prod=await db.get(`prod_${nome}`);

if(prod.estoque.length===0)
return i.editReply({content:'Sem estoque'});

const canal=await i.guild.channels.create({
name:`compra-${i.user.username}`,
type:ChannelType.GuildText,
permissionOverwrites:[
{id:i.guild.id,deny:[PermissionsBitField.Flags.ViewChannel]},
{id:i.user.id,allow:[PermissionsBitField.Flags.ViewChannel]}
]
});

canal.send(`Faça o PIX de R$${prod.preco} e aguarde.`);
return i.editReply({content:`Canal criado: ${canal}`});
}

}

});

client.login(process.env.TOKEN);