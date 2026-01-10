import { data as ping } from "./ping.js";
import { data as auth } from "./auth.js";
import { data as report } from "./report.js";
import { data as msgpin } from "./msgpin.js";
import { data as unpin } from "./unpin.js";
import { data as timeout } from "./timeout.js";
import { data as untimeout } from "./untimeout.js";
import { data as gachas } from "./gachas.js";
import { data as imihubun } from "./imihubun.js";
import { data as modal } from "./modal.js";
import { data as modalview } from "./modalview.js";
// 他も同様に追加

export const commands = [
  ping,
  auth,
  report,
  msgpin,
  unpin,
  timeout,
  untimeout,
  gachas,
  imihubun,
  modal,
  modalview
].map(cmd => cmd.toJSON());
