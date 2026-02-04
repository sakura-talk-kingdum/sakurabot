export async function handleModalSubmit(interaction, context) {
  const { supabase } = context;
  const id = interaction.customId.split(":")[1];

  const { data: modal } = await supabase
    .from("modals").select("*").eq("id", id).single();

  const values = {};
  modal.fields.forEach((f, i) => {
    values[f.name] = interaction.fields.getTextInputValue(`field_${i}`);
  });

  await supabase.from("modal_responses").insert({
    modal_id: id,
    user_id: interaction.user.id,
    username: interaction.user.username,
    values
  });

  await interaction.reply({
    content: "送信完了！",
    ephemeral: true
  });
}
