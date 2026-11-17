import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export const fmtDate = (iso) => format(parseISO(iso), "EEEE d MMMM yyyy", { locale: fr });
export const fmtDay = (iso) => format(parseISO(iso), "d", { locale: fr });
export const fmtMonth = (iso) => format(parseISO(iso), "MMM", { locale: fr });
export const fmtHours = (c) => `${c.heure_debut.replace(":", "h")} – ${c.heure_fin.replace(":", "h")}`;

export const RADE_CENTER = [48.375, -4.47];
