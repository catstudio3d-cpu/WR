/* Original WildRide pictograms. No third-party artwork or course graphics. */
const SKILL_TOPICS=[
 {id:'balance',name:'姿勢與平衡',en:'BALANCE',skills:['posture','balance'],shape:'<circle cx="50" cy="23" r="7"/><path d="M50 32v25m-22-14 22-7 22 7M50 57 34 75m16-18 16 18M17 82h66M22 82l-8 8m64-8 8 8"/>'},
 {id:'control',name:'操控與煞車',en:'CONTROL',skills:['controls','brake','rearbrake'],shape:'<circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="9"/><path d="M50 20v12m30 18H68M50 80V68M20 50h12M29 29l9 9m33-9-9 9M29 71l9-9m33 9-9-9"/>'},
 {id:'turn',name:'轉向技巧',en:'TURNS',skills:['turns','tight','pivot','hop'],shape:'<path d="M25 83V45c0-33 50-33 50 0v24M62 57l13 13 13-13M13 82h24"/><circle cx="25" cy="45" r="4"/>'},
 {id:'hill',name:'坡地騎乘',en:'HILLS',skills:['hills','restart'],shape:'<path d="M14 80h72M20 73 64 26l22 47M39 60l15-16M46 43l10-1-1 10"/><circle cx="33" cy="66" r="7"/><circle cx="62" cy="51" r="7"/>'},
 {id:'obstacle',name:'障礙通過',en:'OBSTACLES',skills:['frontlift','logs','blip','zap','splatter'],shape:'<path d="M13 83h24V66h23V46h26M18 57c8-32 33-38 56-25M62 22l14 10-12 10"/><circle cx="22" cy="64" r="6"/>'},
 {id:'terrain',name:'抓地與路線',en:'TERRAIN',skills:['terrain','traction','lineplan','etiquette'],shape:'<path d="m15 79 24-56 16 33 11-19 20 42M43 81l14-15-11-12 9-12M15 89h71"/>'},
 {id:'rescue',name:'自救與救援',en:'RESCUE',skills:['rescue','recovery'],shape:'<path d="M22 23h56v58H22zM42 34h16v12h12v16H58v12H42V62H30V46h12zM40 23v-9h20v9"/>'},
 {id:'setup',name:'車輛與裝備',en:'SETUP',skills:['setup','fieldrepair'],shape:'<path d="M25 62C12 37 30 16 51 16s35 17 32 38L65 66H25l5 18h30l5-18M25 43h31l13 12M56 43l4-10M33 73h22"/>'},
 {id:'special',name:'獨立專項',en:'SPECIAL',skills:['wheelie','sand','slide','jump'],shape:'<circle cx="28" cy="73" r="13"/><circle cx="76" cy="38" r="13"/><path d="m28 73 13-31 20 10 15-14M41 42l-3-17 13-8M42 27l20 1M25 58l17 8 19-14M14 91h42"/>'}
];
function skillIcon(topicId){const topic=SKILL_TOPICS.find(t=>t.id===topicId)||SKILL_TOPICS[0];const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('aria-hidden','true');svg.setAttribute('class','skill-pictogram');svg.innerHTML='<g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">'+topic.shape+'</g>';return svg}
function topicForSkill(id){return SKILL_TOPICS.find(t=>t.skills.includes(id))}
/* Skill-specific silhouettes share the same off-road motorcycle geometry. */
const RIDER_SKILL_MARKS={
 posture:{name:'坐姿騎乘',rider:'<circle cx="48" cy="27" r="7"/><path d="M49 27h6M44 38l-5 15 18 7-8 13h9M47 39l11 9h11"/>'},
 balance:{name:'站姿騎乘',rider:'<circle cx="49" cy="12" r="7"/><path d="M50 12h6M45 23l-6 18 13 11-5 18h10M47 25l10 9 9 12"/>'}
};
function riderSkillIcon(id){const mark=RIDER_SKILL_MARKS[id];const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('aria-hidden','true');svg.setAttribute('class','skill-pictogram rider-pictogram');svg.dataset.rider=id;svg.innerHTML='<g fill="none" stroke="currentColor" stroke-width="3.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="23" cy="76" r="12"/><circle cx="78" cy="76" r="12"/><path d="m23 76 14-23 17 18H23m31 0 14-25 10 30M27 53h18m23-7-3-9h9M54 71h9M10 92h80"/><path d="M37 59h12v8H37z" fill="currentColor" stroke="none"/>'+mark.rider+'</g>';return svg}
