// ============================================================
// WORD SYSTEM
// ============================================================
// Curated tiers (highest priority): space + video games + funny.
// General dictionary is fetched at boot and bucketed by length.
//
// pickShipWords(lvl) returns 5 words of length === lvl with unique first letters.
// For each slot we roll a tier (50% space/games, 25% funny, 25% general).
// If the rolled tier has no word of that length+letter, we fall back to the next.
// ============================================================

const CURATED = {
  // SPACE — astronomy, sci-fi, ships, cosmology
  space: [
    'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
    'ai','io','ufo','sun','moon','star','mars','luna','nova','dust','dark','warp','beam','core','bolt','bay','cell','crew','dock','ebon','eden','exit','fuel','flux','foil','gas','grav','helm','hull','ion','jet','lens','lift','mass','mist','muon','navy','node','orb','path','pole','port','prow','quad','quasar','rad','ray','red','rim','rove','scan','silo','solar','tech','tow','tug','void','warp','wave','wing','xeno','yarn','zone','zero','zoom',
    'orbit','comet','crater','cosmos','cobra','crash','cosmic','cipher','crown','cruise','cruiser','cosmonaut','crater',
    'galaxy','gamma','glide','gravity','geode','geosphere','genesis',
    'helix','hyper','horizon','helmet','hatch','hover','heatshield',
    'impact','inertia','infrared','interstellar','ignite','impulse',
    'kepler','kelvin','kerosene','keplerian',
    'launch','laser','lunar','launchpad','lightyear','luminous','lasergun',
    'meteor','module','magnet','meridian','mainsail','mercury','mission',
    'nebula','neutron','nova','nucleus','navigator','nightside',
    'orbital','oxygen','observatory','onslaught','outerspace','outpost','onboard',
    'plasma','planet','phantom','propulsion','probe','pulsar','parsec','phoenix','photon','photonic','perigee','perihelion','propellant',
    'quasar','quantum','quark','quench','quintuple',
    'rocket','radar','radio','radiation','reentry','retrograde','retrofire','rover','roscosmos',
    'satellite','spaceship','starship','space','station','sunspot','solar','starlight','supernova','singularity','spacewalk','spacesuit','stargate','starbase','stardust','spaceport','starfighter',
    'thrust','thruster','telescope','tachyon','telemetry','terraform','transmit','trajectory',
    'umbra','universe','undock','umbral','uplink',
    'vacuum','vector','venus','volley','voyager','vortex','vehicle',
    'wormhole','wavelength','warp','warpdrive','warpcore',
    'xenon','xenith',
    'yawn','yield','yacht',
    'zenith','zodiac','zephyr','zircon','zerogravity',
    'andromeda','antimatter','asteroid','astronaut','astronomer','astronomy','astrophysics','aurora','airlock','apogee',
    'blackhole','bigbang','beacon','battlestar','battleship','blastoff','booster','blueshift',
    'cosmonaut','constellation','centrifuge','crewmember','countdown','capsule',
    'docking','darkmatter','dwarfstar','dyson',
    'exoplanet','event','escape','eclipse','electromagnetic','emission',
    'frontier','firmament','flightdeck','flyby','futurama',
    'galactic','gargantuan','geomagnetic','gravitywell',
    'heliosphere','heliopause','hyperspace','heliocentric','heliographic',
    'interstellar','intergalactic','infinity','ionosphere','imperial',
    'jupiter','jettison','jovian',
    'krypton','kessler',
    'lagrangian','lightspeed','liftoff',
    'magnetar','milkyway','meteorite','mothership','mooncrater','multiverse','microgravity',
    'neptune','newhorizons',
    'observatory','outerspace','overdrive',
    'planetarium','perigee','perihelion','plutonium','progenitor','protostar','propellant',
    'quintessence',
    'redshift','refueling','retrograde','reentry','radioactive','radiosignal','retrothrust',
    'spacestation','spacecraft','solarsystem','singularity','supercluster','spaceflight','spacetime','spacewalker','starcluster','stargazer','stellar','stratosphere','stratosphere',
    'telescopic','teleport','thermosphere','transorbital',
    'ultraviolet','universe','uranus',
    'velocity','venusian','vehicular','vacuumchamber',
    'whitedwarf','wormhole',
    'xenobiology','xerographic',
  ],

  // VIDEO GAMES — gaming culture, mechanics, slang
  games: [
    'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
    'gg','xp','op','rp','dps','pvp','pve','dot','hp','mp',
    'aim','arc','axe','bow','bot','cap','co','do','duo','elf','exp','farm','frag','game','goal','grab','grim','heal','hex','hit','jab','jam','jump','keep','kit','lag','lan','lap','loot','mage','mana','mass','meta','miss','mod','nerf','noob','orb','pace','pact','park','pawn','pick','plot','poke','pose','prep','quest','race','rage','raid','rare','rank','rest','revive','rng','roll','room','run','save','scan','seek','skin','slay','slide','slime','slot','smith','snipe','soul','spam','spawn','stat','stun','sub','swap','swift','tag','tank','task','team','test','tier','tomb','tool','trap','turn','tutor','twin','use','user','wand','warp','ward','wave','well','wing','win','wire','xp','yawn','yarn','yeet','zap','zone',
    'attack','agility','arena','armor','assist','avatar','aggro',
    'boost','beast','blade','blast','blink','boss','build','bonus','battle','barbarian','barricade',
    'combo','combat','crit','clutch','controller','console','cutscene','contest','captures','class','crafting','content','crush','curse',
    'damage','death','defend','defense','demo','dodge','doom','dragon','dungeon','duel','drop','dungeoneer','daggers',
    'engage','engine','energy','enemy','equip','enchant','endgame','encounter','endure','event','exit',
    'fight','final','finale','finisher','fortress','frenzy','flag','flank','fragment','frostbite','flask',
    'gauntlet','glory','glitch','grind','goblin','golem','gnoll','gear','goal','genre','guard','guild','gladiator',
    'health','helmet','heist','heroic','hero','headshot','hardcore','hover',
    'invade','impale','inventory','indie','idle','imp','invincible','immortal','intro',
    'joust','jaw','journey','jewel',
    'kill','knight','kingpin','kindle','knockout','keystone','kobold',
    'level','laser','launch','legacy','legend','legendary','lava','lich','loot','lobby','lockout',
    'mage','melee','minion','mission','monster','master','mecha','melt','match','manor','mage',
    'noob','ninja','nemesis','nuke','nightmare','nightly',
    'orc','onslaught','overlord','outpost','outlaw','overdrive','offline','online',
    'pirate','platform','player','potion','power','press','prowl','puzzle','pwned',
    'quake','quest','quick','quill','quench',
    'ranger','raider','rebel','reload','respawn','revive','rocket','roleplay','rune','rouge','rush',
    'sigil','snipe','sniper','sword','shield','shooter','speedrun','spawn','strike','smash','speedhack','startup','stealth','strafe',
    'tank','target','thief','toxic','treasure','trap','troll','trophy','tyrant','tutorial','tank','target','tournament','team',
    'undead','unique','upgrade','unlock','unstoppable','useable',
    'victory','venom','viper','victor','valor','vault','volley',
    'warrior','wizard','warlord','weapon','wraith','wand','wave','warp','wargame','warzone',
    'xp','xenomorph',
    'yield','yellow',
    'zombie','zealot','zigzag','zoned','zoomies',
    'achievement','adventure','annihilate','assassin','autoaim','arcade','asynchronous',
    'battlefield','battlepass','breakthrough','blockade','battlestation','botmatch','bossfight','beatemup',
    'campaign','catastrophe','character','checkpoint','collectible','controller','crossplay','cutscene','crouchjump',
    'damageover','dungeoneer','damageboost','deathmatch','difficulty','dungeoncrawler',
    'experience','extralife','endgame',
    'firebrand','firewall','firepower','frontline','franchise','firefight',
    'gamepad','gameplay','gauntlet','gunfighter','gigabyte',
    'highscore','headshot','hyperdrive','hyperjump',
    'intercept','invincible','infiltrate','inventory','invincibility',
    'juggernaut','justify','jurisdiction',
    'killstreak','killshot','kingdom','knockdown',
    'leaderboard','levelup','launchpad','loadout','longbow','legendary',
    'massacre','minimap','multiplayer','mainboss','machinegun','marauder',
    'newgame','navigator','notorious','nightvision',
    'objective','overpower','onslaught','offensive','overlord','overworld',
    'powerup','powerful','platinum','playthrough','protagonist',
    'questline',
    'respawn','renegade','revenge','rocketlauncher','roleplay',
    'savepoint','speedrun','strategy','stronghold','superboss','superpower','starsystem',
    'teleport','tournament','tournament','treachery','trapdoor','triplekill','triumph',
    'unlimited','unstoppable','unkillable',
    'velocity','vendetta','victorious','vigilante',
    'wavelength','warmaster','warzone','wreckage',
    'xenophobe',
    'yellowbelt',
    'zerglings','zombiehorde',
  ],

  // FUNNY — silly, playful, onomatopoeic, fun-to-say words
  funny: [
    'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
    'oof','wow','hmm','huh','aha','meh','yip','yap','blob','blip','bonk','bork','burp','clop','dink','flap','flop','floof','glop','goof','gulp','honk','hoot','klop','mew','moo','nope','nub','oof','pew','plop','poof','pop','puff','quack','snip','snug','splat','swap','toot','wiggle','wonk','yeet','zonk',
    'wobble','noodle','jiggle','wiggle','squiggle','snazzy','snappy','sloppy','snazzy','sneaky','silly','sassy','sappy','smelly','smushy','snobby','soggy','spiffy','stinky','stuffy','sturdy','swanky','tacky','tipsy','trendy','tubby','twerpy','twirly','wacky','whacky','whimsy','woolly','wormy','wussy','yappy','yucky','zany','zippy',
    'bamboozle','flummox','kerfuffle','shenanigan','lollygag','hooligan','bumblebee','cantankerous','curmudgeon','discombobulate','flabbergast','floccinaucinihilipilification','gobbledygook','gobsmacked','gargantuan','hippopotamus','hodgepodge','hullabaloo','jibberjabber','kerplunk','knickknack','lickety','malarkey','mishmash','mumbo','nincompoop','obfuscate','persnickety','pumpernickel','quibble','rapscallion','shenanigans','skedaddle','snickerdoodle','snollygoster','snooty','snorkel','splendiferous','squabble','tomfoolery','whippersnapper','whatchamacallit','wishywashy','yokel','zigzag',
    'bongo','dingo','flamingo','gizmo','jumbo','limbo','mango','tango','tofu','yoyo',
    'bouncy','crunchy','fluffy','frumpy','gloopy','goopy','goosey','hoppy','jolly','jumpy','knobby','lumpy','marshy','mucky','peppy','perky','plucky','poppy','pulpy','ritzy','roomy','sloppy','snazzy','snippy','snooty','soapy','soggy','sparkly','spongy','squashy','squishy','stripy','stubby','sudsy','swirly','tangy','wormy','zesty','zippy',
    'bafflement','befuddle','bewilder','bonkers','bumpkin','codswallop','collywobbles','crinkle','crumpet','dilly','dinghy','doohickey','doozie','dweeb','flapjack','flibbertigibbet','frou','galoshes','gunky','huzzah','jamboree','jibbet','kabob','kaput','kazoo','kibosh','kit','kazoo','lazybones','lopsided','lummox','muumuu','newt','nincompoop','noggin','noodle','nudnik','oddball','ouchie','peewee','piffle','pizzazz','poppycock','razzle','razzmatazz','schlep','schmooze','scrumptious','smithereens','snazzy','snickerdoodle','snippet','snurfle','squee','squelch','squiggle','tatty','thingamabob','thingamajig','tipsy','tuxedo','twiddle','twinkletoes','umpteen','wallop','whatnot','whippet','wibble','widget','wonky','xylophone','yippee','zebra','zinger',
  ],
};

// Dictionary: filled on boot from fetched word list, bucketed by length.
// Map<number, string[]>
const DICT_BY_LENGTH = new Map();
let DICT_MAX_LENGTH = 15; // updated when dictionary loads
let dictReady = false;

// Curated by length (built on boot) — Map<themeName, Map<length, string[]>>
const CURATED_BY_LENGTH = {
  space: new Map(),
  games: new Map(),
  funny: new Map(),
};

// Bucket curated lists by length
function bucketCurated() {
  for (const theme of Object.keys(CURATED)) {
    const m = CURATED_BY_LENGTH[theme];
    for (const w of new Set(CURATED[theme])) {
      const cleaned = w.toLowerCase().replace(/[^a-z]/g, '');
      if (!cleaned) continue;
      const len = cleaned.length;
      if (!m.has(len)) m.set(len, []);
      m.get(len).push(cleaned);
    }
  }
}
bucketCurated();

// Profanity blocklist (small, coarse — better to over-filter)
const PROFANITY = new Set([
  'fuck','fucking','fucked','fucker','shit','shitty','shitting','cunt','cock','cocks','dick','dicks','piss','pissed','pissing','tits','tit','asshole','assholes','bitch','bitches','bitching','bastard','bastards','damn','damned','damnit','goddamn','crap','crappy','prick','pricks','slut','sluts','whore','whores','wanker','bollocks','bullshit',
  'nigger','nigga','niggers','niggas','faggot','faggots','fag','fags','retard','retards','retarded','spic','spics','kike','kikes','chink','chinks','wetback','wetbacks',
  'porn','porno','penis','vagina','boob','boobs','nipple','nipples','horny','sex','sexy','cum','cums','jerkoff',
  'kill','rape','rapist','suicide','murder','murderer',
]);

function isCleanWord(w) {
  if (!w || w.length < 1) return false;
  if (!/^[a-z]+$/.test(w)) return false;
  if (PROFANITY.has(w)) return false;
  return true;
}

// Fetch the dictionary at boot. Falls back gracefully if offline.
async function loadDictionary() {
  const url = 'https://cdn.jsdelivr.net/gh/dwyl/english-words@master/words_alpha.txt';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('dict fetch failed: ' + res.status);
    const text = await res.text();
    let count = 0, maxLen = 0;
    for (const raw of text.split('\n')) {
      const w = raw.trim().toLowerCase();
      if (!isCleanWord(w)) continue;
      const len = w.length;
      if (!DICT_BY_LENGTH.has(len)) DICT_BY_LENGTH.set(len, []);
      DICT_BY_LENGTH.get(len).push(w);
      if (len > maxLen) maxLen = len;
      count++;
    }
    DICT_MAX_LENGTH = Math.min(maxLen, 28); // cap reasonably
    dictReady = true;
    return { count, maxLen };
  } catch (e) {
    // Fallback: synthesize a dictionary from the curated lists themselves
    console.warn('dictionary load failed, using curated-only fallback:', e);
    let maxLen = 0;
    for (const theme of Object.keys(CURATED_BY_LENGTH)) {
      for (const [len, arr] of CURATED_BY_LENGTH[theme]) {
        if (!DICT_BY_LENGTH.has(len)) DICT_BY_LENGTH.set(len, []);
        for (const w of arr) DICT_BY_LENGTH.get(len).push(w);
        if (len > maxLen) maxLen = len;
      }
    }
    DICT_MAX_LENGTH = Math.min(maxLen, 20);
    dictReady = true;
    return { count: 0, maxLen, fallback: true };
  }
}

function randFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Pick a word of exactly `targetLen` letters, with first letter NOT in `excludeFirsts`.
// Weighted: 50% space, 25% games, 25% funny+general (split). Falls through tiers.
function pickWordOfLength(targetLen, excludeFirsts) {
  // Shuffle the priority order each call for variety, but keep weights.
  const tiers = [];
  const r = Math.random();
  if (r < 0.30) tiers.push('space','games','funny','general');
  else if (r < 0.55) tiers.push('games','space','funny','general');
  else if (r < 0.75) tiers.push('funny','space','games','general');
  else tiers.push('general','space','games','funny');

  for (const tier of tiers) {
    let pool;
    if (tier === 'general') pool = DICT_BY_LENGTH.get(targetLen);
    else pool = CURATED_BY_LENGTH[tier].get(targetLen);
    if (!pool || pool.length === 0) continue;
    // Try up to 30 random samples from this tier
    for (let i = 0; i < 30; i++) {
      const cand = pool[Math.floor(Math.random() * pool.length)];
      if (!excludeFirsts.has(cand[0])) return cand;
    }
    // Linear scan fallback within this tier
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    for (const cand of shuffled) {
      if (!excludeFirsts.has(cand[0])) return cand;
    }
  }
  return null;
}

function pickShipWords(lvl) {
  const cfg = LEVEL_CONFIG[lvl - 1];
  const targetLen = cfg.wordLength;
  const used = new Set();
  const result = [];
  let safety = 0;
  while (result.length < 5 && safety++ < 30) {
    const cand = pickWordOfLength(targetLen, used);
    if (!cand) break;
    used.add(cand[0]);
    result.push(cand);
  }
  // If we couldn't fill 5 (very unlikely), pad from any tier ignoring first-letter rule
  if (result.length < 5) {
    const allOfLen = (DICT_BY_LENGTH.get(targetLen) || []).slice();
    for (const t of Object.keys(CURATED_BY_LENGTH)) {
      const arr = CURATED_BY_LENGTH[t].get(targetLen);
      if (arr) allOfLen.push(...arr);
    }
    while (result.length < 5 && allOfLen.length > 0) {
      result.push(allOfLen[Math.floor(Math.random() * allOfLen.length)]);
    }
    while (result.length < 5) result.push('a');
  }
  return { up: result[0], down: result[1], left: result[2], right: result[3], fire: result[4] };
}

// ============================================================
// LEVEL CONFIG — generated dynamically once dictionary loads.
// 1 level per length, advancing requires more kills each tier.
// ============================================================
let LEVEL_CONFIG = [];

function buildLevelConfig() {
  // Score thresholds: 5, 10, 18, 28, 40, 54, 70, 88, 108, 130, ...
  // Each level adds (5 + 2 * (n-1)) more score than previous.
  const thresholds = [];
  let total = 0;
  for (let n = 1; n <= 40; n++) {
    total += 5 + 2 * (n - 1);
    thresholds.push(total);
  }

  LEVEL_CONFIG = [];
  for (let len = 1; len <= DICT_MAX_LENGTH; len++) {
    // Skip lengths that have no available words at all
    const hasGen = (DICT_BY_LENGTH.get(len) || []).length > 0;
    let hasCurated = false;
    for (const t of Object.keys(CURATED_BY_LENGTH)) {
      if ((CURATED_BY_LENGTH[t].get(len) || []).length > 0) { hasCurated = true; break; }
    }
    if (!hasGen && !hasCurated) continue;

    const n = LEVEL_CONFIG.length + 1;
    const isLast = false; // we'll patch the last one after the loop
    LEVEL_CONFIG.push({
      n,
      label: `LEVEL ${n} — ${len} LETTER${len === 1 ? '' : 'S'}`,
      sub: len === 1
        ? 'single letters — type the letter on each side'
        : `${len}-letter words — type the word on each side`,
      wordLength: len,
      scoreToAdvance: thresholds[n - 1] || (thresholds[thresholds.length - 1] + 50 * (n - thresholds.length)),
    });
  }
  // Final level never advances
  if (LEVEL_CONFIG.length > 0) {
    LEVEL_CONFIG[LEVEL_CONFIG.length - 1].scoreToAdvance = Infinity;
  }
}
