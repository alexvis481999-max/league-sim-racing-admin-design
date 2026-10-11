export const TOUGE_HUD_PLUGIN='touge_hud';
export function requiresTougeHud(scenario:string|null,game:unknown,discipline:unknown) {
  return game==='assetto_corsa'&&(scenario==='time_attack'||scenario==='double_elimination_tournament'&&discipline==='touge');
}
/** Applied to drafts as well as executable settings; keeps other selected plugins. */
export function withRequiredEventPlugins<T extends Record<string,unknown>>(scenario:string|null,settings:T):T {
  const event=settings.event as Record<string,unknown>|undefined;
  if(!requiresTougeHud(scenario,event?.gameCode,event?.disciplineCode))return settings;
  const copy=structuredClone(settings);
  const entry=copy.entry as Record<string,unknown>|undefined;
  const qualification=entry?.qualification as Record<string,unknown>|undefined;
  for(const value of [copy.game,qualification?.game]) {
    if(!value||typeof value!=='object'||Array.isArray(value))continue;
    const game=value as Record<string,unknown>,choices=(game.catalogChoices??{}) as Record<string,unknown>;
    game.catalogChoices={...choices,pluginCodes:[...new Set([...(Array.isArray(choices.pluginCodes)?choices.pluginCodes:[]),TOUGE_HUD_PLUGIN])]};
  }
  return copy;
}
