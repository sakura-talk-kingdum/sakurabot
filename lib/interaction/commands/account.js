export default async function account(interaction, context) {
  const { MessageFlags, getAccount, setSNS } = context;
  const sub = interaction.options.getSubcommand();

  if (sub === "info") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser("user") || interaction.user;

    const acc = await getAccount(target.id);
    if (!acc)
      return interaction.editReply({
        content: "このユーザーはまだアカウントありません！",
        flags: MessageFlags.Ephemeral
      });

    return interaction.editReply({
      embeds: [
        {
          title: `${target.username} のアカウント情報`,
          fields: [
            { name: "XP", value: `${acc.xp}`, inline: true },
            { name: "VC XP", value: `${acc.vcxp}`, inline: true },
            { name: "Level", value: `${acc.level}`, inline: true },
            { name: "VC Level", value: `${acc.vclevel}`, inline: true },
            {
              name: "SNS",
              value: Object.keys(acc.sns || {}).length
                ? "```\n" + JSON.stringify(acc.sns, null, 2) + "\n```"
                : "未設定"
            }
          ]
        }
      ]
    });
  }

  if (sub === "settings") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const set = interaction.options.getString("set");
    const type = interaction.options.getString("type");
    const value = interaction.options.getString("value");

    const err = await setSNS(interaction.user.id, type, value);
    if (err.error)
      return interaction.editReply("設定できませんでした…🥲");

    return interaction.editReply(`SNS **${type}** を **${value}** に設定したよ！`);
  }
}
