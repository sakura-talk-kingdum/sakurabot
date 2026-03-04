export async function handleButton(interaction, context) {
  const {
    supabase,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle
  } = context;

  const [type, id, page] = interaction.customId.split(":");

  // モーダル表示
  if (type === "modal_open") {
    const { data: modal } = await supabase
      .from("modals").select("*").eq("id", id).single();

    const modalUI = new ModalBuilder()
      .setCustomId(`modal_submit:${id}`)
      .setTitle(modal.modal_title);

    modal.fields.forEach((f, i) => {
      modalUI.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(`field_${i}`)
            .setLabel(f.name)
            .setStyle(
              f.type === "SHORT"
                ? TextInputStyle.Short
                : TextInputStyle.Paragraph
            )
        )
      );
    });

    await interaction.showModal(modalUI);
  }

  // ページング
  if (type === "modal_page") {
    const { data: modal } = await supabase
      .from("modals").select("*").eq("id", id).single();

    const { data: responses } = await supabase
      .from("modal_responses").select("*").eq("modal_id", id);

    return sendPage({
      interaction,
      modal,
      responses,
      page: Number(page),
      ActionRowBuilder: context.ActionRowBuilder,
      ButtonBuilder: context.ButtonBuilder,
      ButtonStyle: context.ButtonStyle,
      EmbedBuilder: context.EmbedBuilder
    });
  }
}

const PER_PAGE = 20;

function sendPage({
  interaction,
  modal,
  responses,
  page,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
}) {
  const start = page * PER_PAGE;
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
      .setCustomId(`modal_page:${modal.id}:${page - 1}`)
      .setLabel("◀")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`modal_page:${modal.id}:${page + 1}`)
      .setLabel("▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(start + PER_PAGE >= responses.length)
  );

  if (interaction.replied || interaction.deferred) {
    return interaction.update({ embeds: [embed], components: [row] });
  }
  return interaction.reply({ embeds: [embed], components: [row] });
}
