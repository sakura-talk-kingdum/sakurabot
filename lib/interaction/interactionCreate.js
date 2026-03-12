import { handleCommand } from "./commands/interaction.js";
import { handleButton } from "./buttons/modal.js";
import { handleModalSubmit } from "./modals/submit.js";

export async function handleInteractionCreate(interaction, context) {
  const { client } = context;

  if (client.shard && client.shard.ids[0] !== 0) return;

  if (interaction.isChatInputCommand()) {
    return handleCommand(interaction, context);
  }

  if (interaction.isButton()) {
    return handleButton(interaction, context);
  }

  if (interaction.isModalSubmit()) {
    return handleModalSubmit(interaction, context);
  }
}
