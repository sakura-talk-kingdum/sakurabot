import auth from './auth.js';
import gachas from './gachas.js';
import gatyalist from './gatyalist.js';
import gatyareload from './gatyareload.js';
import imihubun from './imihubun.js';
import modal from './modal.js';
import modalview from './modalview.js';
import msgpin from './msgpin.js';
import ping from './ping.js';
import play from './play.js';
import playlist from './playlist.js';
import poll from './poll.js';
import report from './report.js';
import skip from './skip.js';
import stop from './stop.js';
import timeout from './timeout.js';
import unpin from './unpin.js';
import untimeout from './untimeout.js';

const commands = {
  account,
  auth,
  gachas,
  gatyalist,
  gatyareload,
  imihubun,
  modal,
  modalview,
  msgpin,
  ping,
  play,
  playlist,
  poll,
  report,
  skip,
  stop,
  timeout,
  unpin,
  untimeout
};

export async function handleCommand(interaction, context) {
  const fn = commands[interaction.commandName];
  if (!fn) return;

  await fn(interaction, context);
}
