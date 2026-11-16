export const emailModes = ["off", "weekly", "replies"];

export function emailMode(settings) {
  return emailModes.includes(settings?.emailMode) ? settings.emailMode : "off";
}

export function recipeName(value) {
  return value.trim().replace(/[.!?]+$/, "").replace(/^["“]|["”]$/g, "").trim().toLowerCase();
}

export function interpretMenuReply(text, picks, recipes) {
  const confirmation = text.trim().match(/^confirm delete ([0-9a-f]{12})$/i);
  if (confirmation) return { type: "confirmDelete", code: confirmation[1].toLowerCase() };
  const deletion = text.trim().match(/^(?:please\s+)?delete\s+(?:the\s+)?(.+?)(?:\s+from (?:the |our )?(?:recipe )?library|\s+recipe)?[.!?]*$/i);
  if (deletion && !/\b(?:week|menu|plan)\b/i.test(deletion[1])) {
    return { type: "requestDelete", name: recipeName(deletion[1]) };
  }
  const swap = text.match(/^\s*(?:please\s+)?(?:swap|replace)\s+(.+?)\s+(?:for|with)\s+([^\n]+)\s*$/i);
  if (swap) {
    const outgoing = picks.filter((recipe) => recipeName(recipe.name) === recipeName(swap[1]));
    const incoming = recipes.filter((recipe) => recipeName(recipe.name) === recipeName(swap[2]));
    if (outgoing.length === 1 && incoming.length === 1 && !picks.some(({ uid }) => uid === incoming[0].uid)) {
      return { type: "swap", outgoing: outgoing[0], incoming: incoming[0] };
    }
    return { type: "clarify" };
  }

  const url = text.match(/https?:\/\/[^\s<>"\])]+/i)?.[0].replace(/[.,!?]+$/, "");
  if (url) {
    const directImport = /^(?:please\s+)?(?:add|import)\b/i.test(text.trim());
    return { type: directImport ? "import" : "suggestion", url };
  }
  if (/^(?:can we (?:do|have) )?something (?:quicker|faster|quick|that takes less time)[?.!]*$/i.test(text.trim())) return { type: "quicker" };
  return { type: "clarify" };
}
