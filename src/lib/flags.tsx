/** ISO2 codes for national teams. Club teams map to null (no flag). */
export const TEAM_FLAGS: Record<string, string | null> = {
  // Americas
  Argentina: "ar",
  Brazil: "br",
  Mexico: "mx",
  USA: "us",
  "United States": "us",
  Canada: "ca",
  Uruguay: "uy",
  Colombia: "co",
  Ecuador: "ec",
  Chile: "cl",
  Paraguay: "py",
  Venezuela: "ve",
  Peru: "pe",
  Bolivia: "bo",
  "Costa Rica": "cr",
  Jamaica: "jm",
  Panama: "pa",
  Honduras: "hn",
  "Trinidad & Tobago": "tt",
  "Trinidad and Tobago": "tt",

  // Europe
  France: "fr",
  Germany: "de",
  Spain: "es",
  Portugal: "pt",
  England: "gb-eng",
  Netherlands: "nl",
  Belgium: "be",
  Croatia: "hr",
  Switzerland: "ch",
  Norway: "no",
  Serbia: "rs",
  Poland: "pl",
  Ukraine: "ua",
  Denmark: "dk",
  Sweden: "se",
  Scotland: "gb-sct",
  Wales: "gb-wls",
  Italy: "it",
  Austria: "at",
  Greece: "gr",
  Turkey: "tr",
  Hungary: "hu",
  Slovakia: "sk",
  "Czech Republic": "cz",
  Romania: "ro",
  Bulgaria: "bg",
  Albania: "al",
  Slovenia: "si",
  Finland: "fi",
  Iceland: "is",
  Ireland: "ie",

  // Africa
  Morocco: "ma",
  Senegal: "sn",
  Algeria: "dz",
  Egypt: "eg",
  Nigeria: "ng",
  Ghana: "gh",
  Cameroon: "cm",
  Tunisia: "tn",
  "Ivory Coast": "ci",
  "Côte d'Ivoire": "ci",
  "South Africa": "za",
  Mali: "ml",
  Zambia: "zm",
  "DR Congo": "cd",
  "Democratic Republic of Congo": "cd",
  Tanzania: "tz",
  Kenya: "ke",
  Ethiopia: "et",

  // Asia & Oceania
  Japan: "jp",
  "South Korea": "kr",
  "North Korea": "kp",
  Iran: "ir",
  Australia: "au",
  "Saudi Arabia": "sa",
  Qatar: "qa",
  UAE: "ae",
  China: "cn",
  India: "in",
  "New Zealand": "nz",
  Vietnam: "vn",
  Myanmar: "mm",
  Thailand: "th",
  Indonesia: "id",
  Philippines: "ph",
  Malaysia: "my",
  Singapore: "sg",
  Iraq: "iq",
  Jordan: "jo",
  Syria: "sy",
  Uzbekistan: "uz",
  Kazakhstan: "kz",

  // Club teams — no flag
  "Real Madrid": null,
  Arsenal: null,
  "Manchester City": null,
  "Manchester United": null,
  Liverpool: null,
  Chelsea: null,
  "Tottenham Hotspur": null,
  "Bayern Munich": null,
  "Borussia Dortmund": null,
  Barcelona: null,
  "Atletico Madrid": null,
  "Inter Milan": null,
  "AC Milan": null,
  Juventus: null,
  "Paris Saint-Germain": null,
  "Ajax": null,
  "Porto": null,
  "Benfica": null,
  "Celtic": null,
  "Rangers": null,
};

interface FlagImgProps {
  team: string;
  size?: 15 | 12;
}

export function FlagImg({ team, size = 15 }: FlagImgProps) {
  const iso2 = TEAM_FLAGS[team];
  if (!iso2) return null;

  const w = size === 12 ? 16 : 20;
  const h = size;

  return (
    <img
      src={`https://flagcdn.com/${w}x${h}/${iso2}.png`}
      width={w}
      height={h}
      alt={team}
      style={{
        display: "inline",
        verticalAlign: "middle",
        marginRight: 4,
        borderRadius: 1,
        flexShrink: 0,
      }}
    />
  );
}
