// Fielders' send-offs when a wicket falls ({N} = the batter).
const AUSSIE_SLEDGES = [
  "SEE YA, {N}! DON'T LET THE GATE HIT YA!",
  "WALK FASTER, YA FLAMIN' GALAH!",
  "MY NAN'S GOT BETTER FOOTWORK AND TWO NEW HIPS!",
  "OI {N}! BAR'S THAT WAY. YOU'LL NEED IT!",
  "YOU BAT LIKE A STUNNED MULLET!",
  "BRING ON THE NEXT VICTIM!",
  "HOPE YOU BROUGHT A BOOK, {N}. LONG SERIES!",
  "WAS THAT A SHOT OR A CRY FOR HELP?",
  "RACK OFF, {N}! HOO-ROO!",
  "STREWTH! SEEN BETTER HANDS ON A CLOCK!",
  "FAIR DINKUM, MY DOG READS SPIN BETTER!",
  "YOU'RE NOT EVEN THE BEST BATTER IN YOUR STREET!",
  "THAT'S LUNCH SORTED, BOYS! {N} ON TOAST!",
  "BEEN MORE RESISTANCE FROM A WET SERVIETTE!",
  "{N}, MATE, WAS THE BAT A GIFT?",
  "TELL YA MUM I SAID G'DAY!",
  "CARRY HIS BAT FOR HIM, IT'S HEAVY WHEN IT'S CLEAN!",
  "HE'S GONE LIKE A FREE BARBIE AT A FOOTY CLUB!",
  "CHEERS FOR COMING, {N}! WORTH THE AIRFARE?",
  "THAT'S THE MOST HE'S MOVED HIS FEET ALL DAY!",
  "OFF YA GO! DRINKS ARE ON YOU TONIGHT!",
  "HAVE A BIT OF A LIE DOWN, CHAMP!",
  "GROUNDSMAN'S BATTED LONGER THAN THAT!",
  "YEAAAHHH! GET IN THERE! WHO'S NEXT?!",
];

const ENGLISH_SLEDGES = [
  "WELL BOWLED, CHAPS. JOLLY GOOD.",
  "OH I SAY. BAD LUCK, OLD BEAN.",
  "SORRY ABOUT THAT, {N}. TERRIBLY SORRY.",
  "I SAY, THAT'S RATHER OUT, ISN'T IT?",
  "GOODNESS. WELL. THERE WE ARE.",
  "DO MIND THE STEPS ON YOUR WAY UP.",
  "CUP OF TEA, ANYONE? NO? RIGHT-O.",
  "HARD LINES, OLD CHAP. HARD LINES.",
  "GOSH. WHAT A PALAVER.",
  "SPLENDID! ...SORRY. COMMISERATIONS.",
  "TA-RA, {N}! DO WRITE!",
  "BIT OF A NAUGHTY SHOT, IF I'M HONEST.",
  "OOH, CHEEKY. NO OFFENCE MEANT.",
  "MUM'S DOING SCONES LATER, IF YOU FANCY.",
  "STEADY ON, LADS. STEADY ON.",
  "I SHAN'T SAY ANYTHING. BUT... OUT.",
  "LOVELY WEATHER FOR IT, AT LEAST.",
  "WELL PLAYED... UNTIL THAT BIT.",
  "{N}, YOU DROPPED THIS. YOUR WICKET.",
  "OH DEAR. OH DEAR, OH DEAR.",
  "SORRY! SORRY. WAS THAT TOO MUCH?",
  "CHIN UP, {N}. TOMORROW'S ANOTHER DAY.",
];

// Chirps from the close fielders when the bat is beaten.
const AUSSIE_CHIRPS = [
  "TRY HITTING IT, MATE!",
  "IS THAT BAT FOR DECORATION?",
  "NOT EVEN CLOSE, CHAMP!",
  "HE'S GOT NO IDEA, BOYS!",
  "KEEP SWINGING, WE'LL GET YA!",
];
const ENGLISH_CHIRPS = ["OH, WELL LEFT. SORT OF.", "BAD LUCK, OLD CHAP. MISSED AGAIN.", "STEADY ON, NEARLY HAD IT."];

export function pickChirp(fieldingAbbr) {
  const pool = fieldingAbbr === "AUS" ? AUSSIE_CHIRPS : ENGLISH_CHIRPS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Up to `count` different send-offs from the fielding side. */
export function pickSledges(fieldingAbbr, batterName, count) {
  const pool = [...(fieldingAbbr === "AUS" ? AUSSIE_SLEDGES : ENGLISH_SLEDGES)];
  const lines = [];
  while (lines.length < count && pool.length) {
    lines.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].replace(/\{N\}/g, batterName.toUpperCase()));
  }
  return lines;
}
