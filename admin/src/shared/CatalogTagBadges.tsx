import {Chip,Stack,Tooltip} from '@mui/material';

/** Shared corner badges for catalogue images and skin previews. */
export function CatalogTagBadges({tags}:{tags:readonly string[]}) {
  const unique=[...new Set(tags.map(tag=>tag.trim()).filter(Boolean))];
  if(!unique.length)return null;
  const names:Record<string,string>={ac:'AC',acc:'ACC',iracing:'iRacing'};
  return <Stack direction="row" useFlexGap flexWrap="wrap" gap={.5} aria-label="Теги" sx={{position:'absolute',top:8,right:8,maxWidth:'calc(100% - 64px)',justifyContent:'flex-end',zIndex:1}}>
    {unique.map(tag=><Tooltip key={tag} title={tag}><Chip size="small" label={names[tag.toLowerCase()]??tag} sx={{maxWidth:'100%',height:23,bgcolor:'rgba(15,18,25,.88)',color:'#fff',border:'1px solid rgba(255,255,255,.18)',fontSize:'.73rem','& .MuiChip-label':{px:1}}}/></Tooltip>)}
  </Stack>;
}
