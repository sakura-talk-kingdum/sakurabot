export async function handleInteraction(interaction) {
  if (interaction.isChatInputCommand()) {
    const { handleCommand } = await import("./interactions/commands/interaction.js")
    return handleCommand(interaction)
  }

  if (interaction.isButton()) {
    const { handleButton } = await import("./interactions/buttons/index.js")
    return handleButton(interaction)
  }

  if (interaction.isModalSubmit()) {
    const { handleModal } = await import("./interactions/modals/index.js")
    return handleModal(interaction)
  }
}
