export default async function modalview(interaction, context) {
  const { PermissionFlagsBits, supabase, AttachmentBuilder } = context;
  await interaction.deferReply();
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
    await interaction.editReply({ content: '権限がありません', ephemeral: true });
    return;
  }
  const id = interaction.options.getString("id");
  const csv = interaction.options.getBoolean("csv");

  const { data: modal } = await supabase
    .from("modals").select("*").eq("id", id).single();

  const { data: responses } = await supabase
    .from("modal_responses").select("*").eq("modal_id", id);

  if (csv) {
    const headers = ["username", ...modal.fields.map(f => f.name)];
    const rows = responses.map(r =>
      [r.username, ...modal.fields.map(f => r.values[f.name] ?? "")]
        .map(v => `"${v}"`).join(",")
    );

    const csvData = [headers.join(","), ...rows].join("\n");
    const file = new AttachmentBuilder(
      Buffer.from(csvData),
      { name: `${id}.csv` }
    );

    interaction.editReply({ files: [file] });
    return;
  }

  return sendPage(interaction, modal, responses, context);
}

const PER_PAGE = 20;

function sendPage(interaction, modal, responses, context) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = context;
  const start = 0;
  const slice = responses.slice(start, start + PER_PAGE);

  const embed = new EmbedBuilder()
    .setTitle(modal.modal_title)
    .setDescription(
      ["ユーザー名", ...modal.fields.map(f => f.name)].join(" | ")
    );

  slice.forEach(r => {
    embed.addFields({
      name: "\u200b",
      value: [
        r.username,
        ...modal.fields.map(f => r.values[f.name] ?? "-")
      ].join(" | ")
    });
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`modal_page:${modal.id}:0`)
      .setLabel("◀")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`modal_page:${modal.id}:1`)
      .setLabel("▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(responses.length <= PER_PAGE)
  );

  if (interaction.replied || interaction.deferred) {
    return interaction.editReply({ embeds: [embed], components: [row] });
  }
  return interaction.reply({ embeds: [embed], components: [row] });
}
