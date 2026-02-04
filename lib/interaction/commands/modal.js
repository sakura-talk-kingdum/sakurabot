export default async function modal(interaction, context) {
  const {
    PermissionFlagsBits,
    supabase,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
  } = context;

  await interaction.deferReply();
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
    await interaction.editReply({ content: '権限がありません', ephemeral: true });
    return;
  }

  const id = interaction.options.getString("id");

  const fields = [];
  for (let i = 1; i <= 5; i++) {
    const name = interaction.options.getString(`name${i}`);
    const type = interaction.options.getString(`type${i}`);
    if (name && type) fields.push({ name, type });
  }

  await supabase.from("modals").insert({
    id,
    embed_title: interaction.options.getString("title"),
    embed_description: interaction.options.getString("description"),
    modal_title: interaction.options.getString("modaltitle"),
    fields
  });

  const embed = new EmbedBuilder()
    .setTitle(interaction.options.getString("title"))
    .setDescription(interaction.options.getString("description"));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`modal_open:${id}`)
      .setLabel("回答する")
      .setStyle(ButtonStyle.Primary)
  );

  interaction.editReply({ embeds: [embed], components: [row] });
}
