export default async function auth(interaction, context) {
  const {
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
  } = context;

  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    await interaction.reply({ content: '❌ 管理者のみ使用可能です', flags: 64 });
    return;
  }
  const authUrl = `https://bot.sakurahp.f5.si/auth`;
  const embed = new EmbedBuilder()
    .setTitle('🔐 認証パネル')
    .setDescription('以下のボタンから認証を進めてください。')
    .setColor(0x5865F2);
  const row = new ActionRowBuilder()
    .addComponents(new ButtonBuilder().setLabel('認証サイトへ').setStyle(ButtonStyle.Link).setURL(authUrl));
  return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
}
