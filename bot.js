const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { Octokit } = require('@octokit/rest');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const commands = [
  new SlashCommandBuilder()
    .setName('setnumber')
    .setDescription('Set the number displayed on the website')
    .addIntegerOption(option =>
      option
        .setName('number')
        .setDescription('The number to display on the site')
        .setRequired(true)
    ),
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered globally.');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'setnumber') return;

  const number = interaction.options.getInteger('number');
  await interaction.deferReply();

  try {
    // Get current SHA of data.json (required for updates)
    let sha;
    try {
      const { data } = await octokit.repos.getContent({
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        path: 'data.json',
      });
      sha = data.sha;
    } catch {
      // File doesn't exist yet — will be created fresh
    }

    const content = Buffer.from(
      JSON.stringify({ number, updated: new Date().toISOString() }, null, 2)
    ).toString('base64');

    await octokit.repos.createOrUpdateFileContents({
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      path: 'data.json',
      message: `Set number to ${number}`,
      content,
      ...(sha ? { sha } : {}),
    });

    await interaction.editReply(`Number set to **${number}** — website updated!`);
  } catch (err) {
    console.error(err);
    await interaction.editReply('Failed to update the website. Check your GitHub token and repo settings.');
  }
});

client.login(process.env.DISCORD_TOKEN);
